import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, gt, isNull, lt, max, or, sql } from 'drizzle-orm';
import { AuthenticatedRequest } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import {
  syncChanges,
  syncOperations,
  syncRecords,
  syncResolutionHistory,
  vaultMembers,
} from '../database/schema';
import { PullSyncQueryDto } from './dto/pull-sync-query.dto';
import { PushSyncDto, SyncOperationDto } from './dto/push-sync.dto';
import {
  ResolutionHistoryQueryDto,
  ResolutionReportBatchDto,
  ResolutionReportDto,
} from './dto/resolution-history.dto';
import { SnapshotSyncQueryDto } from './dto/snapshot-sync-query.dto';
import {
  SYNC_CONTRACT_VERSION,
  SYNC_ENTITY_TYPES,
  SYNC_PULL_LIMIT,
  SYNC_PUSH_LIMIT,
} from './sync-contract';

type SyncOperation = 'upsert' | 'delete';
type Transaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];

type RecordSnapshot = {
  operation: SyncOperation;
  payload: Record<string, unknown> | null;
  modifiedAt: bigint;
  changeId: string;
};

type PushResult = {
  operationId: string;
  entityType: string;
  entityId: string;
  status: 'applied' | 'conflict' | 'superseded' | 'rejected';
  version: string;
  errorCode?: 'SYNC_CLOCK_OUT_OF_RANGE';
  serverTime?: string;
  modifiedAt?: string;
  changeId?: string;
  remotePayload?: Record<string, unknown> | null;
  remoteOperation?: SyncOperation;
  remoteModifiedAt?: string;
  remoteChangeId?: string;
};

type SnapshotCursor = {
  entityType: string;
  entityId: string;
  snapshotCursor: string;
};

const MAX_FUTURE_CLOCK_MS = 5 * 60 * 1000;
const RESOLUTION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly database: DatabaseService) {}

  capabilities() {
    return {
      contractVersion: SYNC_CONTRACT_VERSION,
      entityTypes: SYNC_ENTITY_TYPES,
      pushLimit: SYNC_PUSH_LIMIT,
      pullLimit: SYNC_PULL_LIMIT,
      serverTime: Date.now().toString(),
      blobs: { maxBytes: 25 * 1024 * 1024 },
    };
  }

  async status(vaultId: string, auth: AuthenticatedRequest) {
    await this.requireMembership(vaultId, auth.userId, false);
    const [recordStats] = await this.database.db
      .select({ count: count() })
      .from(syncRecords)
      .where(and(eq(syncRecords.vaultId, vaultId), isNull(syncRecords.deletedAt)));
    const [changeStats] = await this.database.db
      .select({ cursor: max(syncChanges.sequence) })
      .from(syncChanges)
      .where(eq(syncChanges.vaultId, vaultId));
    return {
      vaultId,
      recordCount: Number(recordStats?.count ?? 0),
      latestCursor: (changeStats?.cursor ?? 0n).toString(),
      contractVersion: SYNC_CONTRACT_VERSION,
      serverTime: Date.now().toString(),
    };
  }

  async changes(vaultId: string, query: PullSyncQueryDto, auth: AuthenticatedRequest) {
    await this.requireMembership(vaultId, auth.userId, false);
    const after = this.parseBigInt(query.after, 'after');
    const changeRows = await this.database.db
      .select()
      .from(syncChanges)
      .where(and(eq(syncChanges.vaultId, vaultId), gt(syncChanges.sequence, after)))
      .orderBy(asc(syncChanges.sequence))
      .limit(query.limit);

    const changes = changeRows.map(row => ({
      sequence: row.sequence.toString(),
      entityType: row.entityType,
      entityId: row.entityId,
      operation: row.operation,
      version: row.recordVersion.toString(),
      payload: row.payload,
      modifiedAt: row.modifiedAt.toString(),
      changeId: row.changeId,
      createdAt: row.createdAt.toISOString(),
    }));
    const cursor = changes.at(-1)?.sequence ?? query.after;
    this.logger.log(JSON.stringify({ event: 'sync.pull', vaultId, count: changes.length, cursor }));
    return {
      changes,
      cursor,
      hasMore: changes.length === query.limit,
      serverTime: Date.now().toString(),
    };
  }

  async snapshot(vaultId: string, query: SnapshotSyncQueryDto, auth: AuthenticatedRequest) {
    await this.requireMembership(vaultId, auth.userId, false);
    const decoded = query.cursor ? this.decodeSnapshotCursor(query.cursor) : null;
    const snapshotCursor = decoded?.snapshotCursor ?? await this.latestCursor(vaultId);
    const keyCondition = decoded
      ? or(
          gt(syncRecords.entityType, decoded.entityType),
          and(
            eq(syncRecords.entityType, decoded.entityType),
            gt(syncRecords.entityId, decoded.entityId),
          ),
        )
      : undefined;
    const recordRows = await this.database.db
      .select()
      .from(syncRecords)
      .where(and(eq(syncRecords.vaultId, vaultId), keyCondition))
      .orderBy(asc(syncRecords.entityType), asc(syncRecords.entityId))
      .limit(query.limit + 1);
    const hasMore = recordRows.length > query.limit;
    const page = hasMore ? recordRows.slice(0, query.limit) : recordRows;
    const last = page.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeSnapshotCursor({
          entityType: last.entityType,
          entityId: last.entityId,
          snapshotCursor,
        })
      : null;

    return {
      records: page.map(row => ({
        entityType: row.entityType,
        entityId: row.entityId,
        operation: row.deletedAt ? 'delete' : 'upsert',
        version: row.version.toString(),
        schemaVersion: row.schemaVersion,
        payload: row.payload,
        modifiedAt: row.modifiedAt.toString(),
        changeId: row.changeId,
      })),
      nextCursor,
      snapshotCursor,
      serverTime: Date.now().toString(),
    };
  }

  async push(vaultId: string, input: PushSyncDto, auth: AuthenticatedRequest) {
    await this.requireMembership(vaultId, auth.userId, true);
    await this.pruneResolutionHistory();
    const deviceId = auth.deviceId;
    if (!deviceId) throw new BadRequestException('Authenticated device is required');
    const protocolVersion = input.protocolVersion ?? 1;

    const results = await this.database.db.transaction(async transaction => {
      const batchResults: PushResult[] = [];
      for (const operation of input.operations) {
        const lockKey = `${vaultId}:${deviceId}:${operation.operationId}`;
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

        const [processed] = await transaction
          .select({ result: syncOperations.result })
          .from(syncOperations)
          .where(and(
            eq(syncOperations.vaultId, vaultId),
            eq(syncOperations.deviceId, deviceId),
            eq(syncOperations.operationId, operation.operationId),
          ))
          .limit(1);
        if (processed) {
          const processedResult = processed.result as PushResult;
          batchResults.push(processedResult.status === 'rejected'
            ? { ...processedResult, serverTime: Date.now().toString() }
            : processedResult);
          continue;
        }

        const clockRejection = protocolVersion === 2
          ? this.clockRejection(operation)
          : null;
        if (clockRejection) {
          const rejected: PushResult = {
            operationId: operation.operationId,
            entityType: operation.entityType,
            entityId: operation.entityId,
            status: 'rejected',
            version: '0',
            errorCode: 'SYNC_CLOCK_OUT_OF_RANGE',
            serverTime: clockRejection,
          };
          await transaction.insert(syncOperations).values({
            operationId: operation.operationId,
            vaultId,
            deviceId,
            result: rejected,
          });
          batchResults.push(rejected);
          continue;
        }

        const [current] = await transaction
          .select()
          .from(syncRecords)
          .where(and(
            eq(syncRecords.vaultId, vaultId),
            eq(syncRecords.entityType, operation.entityType),
            eq(syncRecords.entityId, operation.entityId),
          ))
          .for('update')
          .limit(1);

        const result = await this.applyOperation(
          transaction,
          vaultId,
          protocolVersion,
          operation,
          current,
          auth,
        );
        await transaction.insert(syncOperations).values({
          operationId: operation.operationId,
          vaultId,
          deviceId,
          result,
        });
        batchResults.push(result);
      }
      return batchResults;
    });

    this.logger.log(JSON.stringify({
      event: 'sync.push',
      vaultId,
      userId: auth.userId,
      deviceId,
      count: results.length,
      conflicts: results.filter(result => result.status === 'conflict').length,
      superseded: results.filter(result => result.status === 'superseded').length,
    }));
    return { results, serverTime: Date.now().toString() };
  }

  async resolutions(
    vaultId: string,
    query: ResolutionHistoryQueryDto,
    auth: AuthenticatedRequest,
  ) {
    await this.requireMembership(vaultId, auth.userId, false);
    await this.pruneResolutionHistory();
    const before = query.before ? new Date(query.before) : undefined;
    const historyRows = await this.database.db
      .select()
      .from(syncResolutionHistory)
      .where(and(
        eq(syncResolutionHistory.vaultId, vaultId),
        before ? lt(syncResolutionHistory.createdAt, before) : undefined,
      ))
      .orderBy(desc(syncResolutionHistory.createdAt))
      .limit(query.limit);

    return {
      resolutions: historyRows.map(row => ({
        resolutionKey: row.resolutionKey,
        entityType: row.entityType,
        entityId: row.entityId,
        winnerOperation: row.winnerOperation,
        winnerPayload: row.winnerPayload,
        winnerModifiedAt: row.winnerModifiedAt.toString(),
        winnerChangeId: row.winnerChangeId,
        loserOperation: row.loserOperation,
        loserPayload: row.loserPayload,
        loserModifiedAt: row.loserModifiedAt.toString(),
        loserChangeId: row.loserChangeId,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      })),
      nextCursor: historyRows.length === query.limit
        ? historyRows.at(-1)?.createdAt.toISOString() ?? null
        : null,
      serverTime: Date.now().toString(),
    };
  }

  async reportResolutions(
    vaultId: string,
    input: ResolutionReportBatchDto,
    auth: AuthenticatedRequest,
  ) {
    await this.requireMembership(vaultId, auth.userId, true);
    const deviceId = auth.deviceId;
    if (!deviceId) throw new BadRequestException('Authenticated device is required');
    await this.pruneResolutionHistory();

    for (const report of input.resolutions) {
      const expectedKey = this.resolutionKey(
        vaultId,
        report.entityType,
        report.entityId,
        report.winnerChangeId,
        report.loserChangeId,
      );
      if (report.resolutionKey !== expectedKey) {
        throw new BadRequestException('Resolution key does not match its changes');
      }
    }

    if (input.resolutions.length) {
      await this.database.db
        .insert(syncResolutionHistory)
        .values(input.resolutions.map(report => this.reportValues(vaultId, deviceId, report)))
        .onConflictDoNothing();
    }
    return { accepted: input.resolutions.length, serverTime: Date.now().toString() };
  }

  private async applyOperation(
    transaction: Transaction,
    vaultId: string,
    protocolVersion: number,
    operation: SyncOperationDto,
    current: typeof syncRecords.$inferSelect | undefined,
    auth: AuthenticatedRequest,
  ): Promise<PushResult> {
    const baseVersion = operation.baseVersion === null || operation.baseVersion === undefined
      ? null
      : this.parseBigInt(operation.baseVersion, 'baseVersion');
    const currentVersion = current?.version ?? 0n;

    if (protocolVersion === 1) {
      const identicalCreate = Boolean(
        current
        && baseVersion === null
        && operation.operation === 'upsert'
        && !current.deletedAt
        && isDeepStrictEqual(current.payload, operation.payload),
      );
      if (identicalCreate) return this.appliedResult(operation, currentVersion, current);
      if ((current && baseVersion !== currentVersion)
        || (!current && baseVersion !== null && baseVersion !== 0n)) {
        return {
          operationId: operation.operationId,
          entityType: operation.entityType,
          entityId: operation.entityId,
          status: 'conflict',
          version: currentVersion.toString(),
          remotePayload: current?.payload ?? null,
          remoteOperation: current?.deletedAt ? 'delete' : 'upsert',
        };
      }
    }

    const incoming = this.operationSnapshot(operation, protocolVersion);
    if (current && protocolVersion === 2) {
      const remote = this.recordSnapshot(current);
      if (incoming.changeId === remote.changeId) {
        return this.appliedResult(operation, currentVersion, current);
      }
      const incomingWins = compareSyncClock(incoming, remote) > 0;
      if (!incomingWins) {
        await this.archiveResolution(
          transaction,
          vaultId,
          operation.entityType,
          operation.entityId,
          remote,
          incoming,
          auth.deviceId,
        );
        return {
          operationId: operation.operationId,
          entityType: operation.entityType,
          entityId: operation.entityId,
          status: 'superseded',
          version: currentVersion.toString(),
          modifiedAt: remote.modifiedAt.toString(),
          changeId: remote.changeId,
          remotePayload: remote.payload,
          remoteOperation: remote.operation,
          remoteModifiedAt: remote.modifiedAt.toString(),
          remoteChangeId: remote.changeId,
        };
      }
      await this.archiveResolution(
        transaction,
        vaultId,
        operation.entityType,
        operation.entityId,
        incoming,
        remote,
        auth.deviceId,
      );
    }

    const version = currentVersion + 1n;
    const now = new Date();
    const payload = incoming.operation === 'delete' ? null : incoming.payload ?? {};
    const deletedAt = incoming.operation === 'delete' ? now : null;

    if (current) {
      await transaction
        .update(syncRecords)
        .set({
          payload,
          version,
          schemaVersion: operation.schemaVersion,
          modifiedAt: incoming.modifiedAt,
          changeId: incoming.changeId,
          deletedAt,
          updatedAt: now,
        })
        .where(and(
          eq(syncRecords.vaultId, vaultId),
          eq(syncRecords.entityType, operation.entityType),
          eq(syncRecords.entityId, operation.entityId),
        ));
    } else {
      await transaction.insert(syncRecords).values({
        vaultId,
        entityType: operation.entityType,
        entityId: operation.entityId,
        payload,
        version,
        schemaVersion: operation.schemaVersion,
        modifiedAt: incoming.modifiedAt,
        changeId: incoming.changeId,
        deletedAt,
      });
    }

    await transaction.insert(syncChanges).values({
      vaultId,
      entityType: operation.entityType,
      entityId: operation.entityId,
      operation: incoming.operation,
      recordVersion: version,
      payload,
      modifiedAt: incoming.modifiedAt,
      changeId: incoming.changeId,
      actorUserId: auth.userId,
      actorDeviceId: auth.deviceId,
    });
    return this.appliedResult(operation, version, {
      modifiedAt: incoming.modifiedAt,
      changeId: incoming.changeId,
    });
  }

  private operationSnapshot(operation: SyncOperationDto, protocolVersion: number): RecordSnapshot {
    const modifiedAt = protocolVersion === 2
      ? this.parseBigInt(operation.modifiedAt!, 'modifiedAt')
      : BigInt(Date.now());
    return {
      operation: operation.operation,
      payload: operation.operation === 'delete' ? null : operation.payload ?? {},
      modifiedAt,
      changeId: protocolVersion === 2
        ? operation.changeId!
        : createHash('md5').update(operation.operationId).digest('hex'),
    };
  }

  private recordSnapshot(current: typeof syncRecords.$inferSelect): RecordSnapshot {
    return {
      operation: current.deletedAt ? 'delete' : 'upsert',
      payload: current.deletedAt ? null : current.payload ?? {},
      modifiedAt: current.modifiedAt,
      changeId: current.changeId,
    };
  }

  private clockRejection(operation: SyncOperationDto): string | null {
    if (!operation.modifiedAt || !operation.changeId) {
      throw new BadRequestException('Protocol v2 requires modifiedAt and changeId');
    }
    const modifiedAt = this.parseBigInt(operation.modifiedAt, 'modifiedAt');
    if (modifiedAt > BigInt(Date.now() + MAX_FUTURE_CLOCK_MS)) {
      return Date.now().toString();
    }
    return null;
  }

  private appliedResult(
    operation: SyncOperationDto,
    version: bigint,
    clock?: Pick<typeof syncRecords.$inferSelect, 'modifiedAt' | 'changeId'>,
  ): PushResult {
    return {
      operationId: operation.operationId,
      entityType: operation.entityType,
      entityId: operation.entityId,
      status: 'applied',
      version: version.toString(),
      ...(clock ? { modifiedAt: clock.modifiedAt.toString(), changeId: clock.changeId } : {}),
    };
  }

  private async archiveResolution(
    transaction: Transaction,
    vaultId: string,
    entityType: string,
    entityId: string,
    winner: RecordSnapshot,
    loser: RecordSnapshot,
    deviceId: string | null | undefined,
  ): Promise<void> {
    if (winner.changeId === loser.changeId || this.sameSnapshot(winner, loser)) return;
    await transaction
      .insert(syncResolutionHistory)
      .values({
        resolutionKey: this.resolutionKey(vaultId, entityType, entityId, winner.changeId, loser.changeId),
        vaultId,
        entityType,
        entityId,
        winnerOperation: winner.operation,
        winnerPayload: winner.payload,
        winnerModifiedAt: winner.modifiedAt,
        winnerChangeId: winner.changeId,
        loserOperation: loser.operation,
        loserPayload: loser.payload,
        loserModifiedAt: loser.modifiedAt,
        loserChangeId: loser.changeId,
        resolvedByDeviceId: deviceId,
        expiresAt: new Date(Date.now() + RESOLUTION_RETENTION_MS),
      })
      .onConflictDoNothing();
  }

  private reportValues(vaultId: string, deviceId: string, report: ResolutionReportDto) {
    return {
      resolutionKey: report.resolutionKey,
      vaultId,
      entityType: report.entityType,
      entityId: report.entityId,
      winnerOperation: report.winnerOperation,
      winnerPayload: report.winnerPayload ?? null,
      winnerModifiedAt: this.parseBigInt(report.winnerModifiedAt, 'winnerModifiedAt'),
      winnerChangeId: report.winnerChangeId,
      loserOperation: report.loserOperation,
      loserPayload: report.loserPayload ?? null,
      loserModifiedAt: this.parseBigInt(report.loserModifiedAt, 'loserModifiedAt'),
      loserChangeId: report.loserChangeId,
      resolvedByDeviceId: deviceId,
      expiresAt: new Date(Date.now() + RESOLUTION_RETENTION_MS),
    };
  }

  private resolutionKey(
    vaultId: string,
    entityType: string,
    entityId: string,
    winnerChangeId: string,
    loserChangeId: string,
  ): string {
    const pair = [winnerChangeId, loserChangeId].sort().join(':');
    return createHash('sha256')
      .update(`${vaultId}:${entityType}:${entityId}:${pair}`)
      .digest('hex');
  }

  private sameSnapshot(left: RecordSnapshot, right: RecordSnapshot): boolean {
    return left.operation === right.operation && isDeepStrictEqual(left.payload, right.payload);
  }

  private async latestCursor(vaultId: string): Promise<string> {
    const [row] = await this.database.db
      .select({ cursor: max(syncChanges.sequence) })
      .from(syncChanges)
      .where(eq(syncChanges.vaultId, vaultId));
    return (row?.cursor ?? 0n).toString();
  }

  private encodeSnapshotCursor(cursor: SnapshotCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeSnapshotCursor(value: string): SnapshotCursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as SnapshotCursor;
      if (
        !parsed
        || typeof parsed.entityType !== 'string'
        || typeof parsed.entityId !== 'string'
        || !/^\d+$/.test(parsed.snapshotCursor)
      ) {
        throw new Error('invalid cursor');
      }
      return parsed;
    } catch {
      throw new BadRequestException('Invalid snapshot cursor');
    }
  }

  private async pruneResolutionHistory(): Promise<void> {
    await this.database.db
      .delete(syncResolutionHistory)
      .where(lt(syncResolutionHistory.expiresAt, new Date()));
  }

  private async requireMembership(vaultId: string, userId: string, write: boolean) {
    const [membership] = await this.database.db
      .select({ role: vaultMembers.role })
      .from(vaultMembers)
      .where(and(eq(vaultMembers.vaultId, vaultId), eq(vaultMembers.userId, userId)))
      .limit(1);
    if (!membership) throw new NotFoundException('Vault not found');
    if (write && membership.role === 'viewer') throw new ForbiddenException('Vault is read-only');
    return membership;
  }

  private parseBigInt(value: string, field: string): bigint {
    try {
      const parsed = BigInt(value);
      if (parsed < 0n) throw new Error('negative');
      return parsed;
    } catch {
      throw new BadRequestException(`${field} must be an unsigned bigint string`);
    }
  }
}

export function compareSyncClock(
  left: Pick<RecordSnapshot, 'modifiedAt' | 'changeId'>,
  right: Pick<RecordSnapshot, 'modifiedAt' | 'changeId'>,
): number {
  if (left.modifiedAt !== right.modifiedAt) return left.modifiedAt > right.modifiedAt ? 1 : -1;
  if (left.changeId === right.changeId) return 0;
  return left.changeId > right.changeId ? 1 : -1;
}
