import { isDeepStrictEqual } from 'node:util';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, gt, isNull, max, sql } from 'drizzle-orm';
import { AuthenticatedRequest } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import {
  syncChanges,
  syncOperations,
  syncRecords,
  vaultMembers,
} from '../database/schema';
import { PullSyncQueryDto } from './dto/pull-sync-query.dto';
import { PushSyncDto, SyncOperationDto } from './dto/push-sync.dto';
import {
  SYNC_CONTRACT_VERSION,
  SYNC_ENTITY_TYPES,
  SYNC_PULL_LIMIT,
  SYNC_PUSH_LIMIT,
} from './sync-contract';

type PushResult = {
  operationId: string;
  entityType: string;
  entityId: string;
  status: 'applied' | 'conflict';
  version: string;
  remotePayload?: Record<string, unknown> | null;
  remoteOperation?: 'upsert' | 'delete';
};

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
    };
  }

  async changes(vaultId: string, query: PullSyncQueryDto, auth: AuthenticatedRequest) {
    await this.requireMembership(vaultId, auth.userId, false);
    const after = this.parseBigInt(query.after, 'after');
    const rows = await this.database.db
      .select()
      .from(syncChanges)
      .where(and(eq(syncChanges.vaultId, vaultId), gt(syncChanges.sequence, after)))
      .orderBy(asc(syncChanges.sequence))
      .limit(query.limit);

    const changes = rows.map(row => ({
      sequence: row.sequence.toString(),
      entityType: row.entityType,
      entityId: row.entityId,
      operation: row.operation,
      version: row.recordVersion.toString(),
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    }));
    const cursor = changes.at(-1)?.sequence ?? query.after;
    this.logger.log(JSON.stringify({ event: 'sync.pull', vaultId, count: changes.length, cursor }));
    return { changes, cursor, hasMore: changes.length === query.limit };
  }

  async push(vaultId: string, input: PushSyncDto, auth: AuthenticatedRequest) {
    await this.requireMembership(vaultId, auth.userId, true);
    const deviceId = auth.deviceId;
    if (!deviceId) throw new BadRequestException('Authenticated device is required');

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
          batchResults.push(processed.result as PushResult);
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

    const conflicts = results.filter(result => result.status === 'conflict').length;
    this.logger.log(JSON.stringify({
      event: 'sync.push',
      vaultId,
      userId: auth.userId,
      deviceId: auth.deviceId,
      count: results.length,
      conflicts,
    }));
    return { results };
  }

  private async applyOperation(
    transaction: Parameters<Parameters<typeof this.database.db.transaction>[0]>[0],
    vaultId: string,
    operation: SyncOperationDto,
    current: typeof syncRecords.$inferSelect | undefined,
    auth: AuthenticatedRequest,
  ): Promise<PushResult> {
    const baseVersion = operation.baseVersion === null || operation.baseVersion === undefined
      ? null
      : this.parseBigInt(operation.baseVersion, 'baseVersion');
    const currentVersion = current?.version ?? 0n;
    const identicalCreate = Boolean(
      current
      && baseVersion === null
      && operation.operation === 'upsert'
      && !current.deletedAt
      && isDeepStrictEqual(current.payload, operation.payload),
    );

    if (identicalCreate) {
      return this.appliedResult(operation, currentVersion);
    }
    if ((current && baseVersion !== currentVersion) || (!current && baseVersion !== null && baseVersion !== 0n)) {
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

    const version = currentVersion + 1n;
    const now = new Date();
    const payload = operation.operation === 'delete' ? null : operation.payload ?? {};
    const deletedAt = operation.operation === 'delete' ? now : null;

    if (current) {
      await transaction
        .update(syncRecords)
        .set({
          payload,
          version,
          schemaVersion: operation.schemaVersion,
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
        deletedAt,
      });
    }

    await transaction.insert(syncChanges).values({
      vaultId,
      entityType: operation.entityType,
      entityId: operation.entityId,
      operation: operation.operation,
      recordVersion: version,
      payload,
      actorUserId: auth.userId,
      actorDeviceId: auth.deviceId,
    });
    return this.appliedResult(operation, version);
  }

  private appliedResult(operation: SyncOperationDto, version: bigint): PushResult {
    return {
      operationId: operation.operationId,
      entityType: operation.entityType,
      entityId: operation.entityId,
      status: 'applied',
      version: version.toString(),
    };
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
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${field} must be an unsigned bigint string`);
    }
  }
}
