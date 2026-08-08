import { inject, Injectable, signal } from '@angular/core';
import type { Database, QueryExecResult, SqlValue } from 'sql.js';
import { DbProvider } from '../database/db-provider.service';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { ElectronSafeAPI } from '../database/database.helper';
import { isElectronRuntime } from '../utils/runtime-platform';
import { flushPendingComponentSaves } from '../utils/pending-save-event';
import {
  getSyncEntity,
  SYNC_ENTITIES,
  SyncEntityDefinition,
  toSyncPayload,
} from '../database/sync-entity-registry';
import { AuthService } from './auth.service';
import { AssetResolverService } from './asset-resolver.service';
import { CloudTransferPacerService } from './cloud-transfer-pacer.service';
import { ComponentRefreshService } from './component-refresh.service';
import { LegacyAssetMigrationService } from './legacy-asset-migration.service';
import {
  CloudSyncApiService,
  RemoteSyncChange,
  SnapshotSyncRecord,
  SyncOperation,
  SyncPushOperation,
  SyncPushResult,
  SyncResolution,
} from './cloud-sync-api.service';

export interface LocalSyncConflict {
  entityType: string;
  entityId: string;
  remoteOperation: SyncOperation;
  localPayload: Record<string, unknown> | null;
  remotePayload: Record<string, unknown> | null;
  remoteVersion: string;
  detectedAt: string;
}


export interface SyncStartOptions {
  initialTimeoutMs?: number;
  requireInitialSuccess?: boolean;
  metadataOnly?: boolean;
}

type ClockSnapshot = {
  operation: SyncOperation;
  payload: Record<string, unknown> | null;
  modifiedAt: string;
  changeId: string;
};

export const SYNC_MUTATION_DEBOUNCE_MS = 15_000;
const RATE_LIMIT_MIN_RETRY_MS = 15_000;
const CLOCK_REFRESH_MS = 60 * 60 * 1000;
const RESOLUTION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class SyncEngineService {
  private readonly dbProvider = inject(DbProvider);
  private readonly auth = inject(AuthService);
  private readonly api = inject(CloudSyncApiService);
  private readonly browserStorage = inject(BrowserDatabaseStorageService);
  private readonly assetResolver = inject(AssetResolverService);
  private readonly transferPacer = inject(CloudTransferPacerService);
  private readonly legacyAssetMigration = inject(LegacyAssetMigrationService);
  private readonly componentRefresh = inject(ComponentRefreshService);
  private vaultId: string | null = null;
  private syncInFlight: Promise<void> | null = null;
  private intervalId: number | null = null;
  private retryTimerId: number | null = null;
  private debounceTimerId: number | null = null;
  private retryAttempt = 0;
  private unsubscribeMutation: (() => void) | null = null;
  private readonly recentlyPushedChangeIds = new Set<string>();

  readonly syncing = signal(false);
  readonly lastSyncAt = signal<string | null>(null);
  readonly conflictCount = signal(0);

  async start(vaultId: string, options: SyncStartOptions = {}): Promise<void> {
    if (this.vaultId === vaultId && this.intervalId !== null) {
      if (options.initialTimeoutMs !== undefined) {
        await this.runInitialSync(options);
      } else {
        await this.syncNow();
      }
      return;
    }

    this.stop();
    this.vaultId = vaultId;
    this.subscribe();
    const deadline = options.initialTimeoutMs === undefined
      ? undefined
      : Date.now() + options.initialTimeoutMs;

    try {
      await this.prepareFirstLink(vaultId, deadline);
      if (options.initialTimeoutMs !== undefined) {
        await this.runSync(deadline, options.metadataOnly ?? true);
      } else {
        await this.legacyAssetMigration.migrateForSync();
        await this.syncNow();
      }
    } catch (error) {
      const message = describeSyncError(error);
      this.auth.markSyncError(message);
      this.scheduleRetry(error);
      if (options.requireInitialSuccess) throw error;
    }

    if (options.metadataOnly) {
      window.setTimeout(() => {
        void this.legacyAssetMigration.migrateForSync()
          .then(() => this.syncNow());
      }, 0);
    }
  }

  stop(): void {
    this.vaultId = null;
    this.syncInFlight = null;
    this.unsubscribeMutation?.();
    this.unsubscribeMutation = null;
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('focus', this.onFocus);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.intervalId !== null) window.clearInterval(this.intervalId);
    if (this.retryTimerId !== null) window.clearTimeout(this.retryTimerId);
    if (this.debounceTimerId !== null) window.clearTimeout(this.debounceTimerId);
    this.intervalId = null;
    this.retryTimerId = null;
    this.debounceTimerId = null;
    this.recentlyPushedChangeIds.clear();
  }

  async syncNow(): Promise<void> {
    if (this.syncInFlight) return this.syncInFlight;
    if (!this.canSync()) return;

    this.syncInFlight = this.runSync()
      .catch(error => {
        this.auth.markSyncError(describeSyncError(error));
        this.scheduleRetry(error);
      })
      .finally(() => {
        this.syncInFlight = null;
        this.syncing.set(false);
      });
    return this.syncInFlight;
  }

  conflicts(): LocalSyncConflict[] {
    if (!this.dbProvider.ready()) return [];
    return rows(this.db().exec(`
      SELECT "entityType", "entityId", "operation", "localPayload", "remotePayload",
             "remoteVersion", "detectedAt"
      FROM "_SyncConflicts"
      ORDER BY "detectedAt"
    `)).map(row => ({
      entityType: String(row['entityType']),
      entityId: String(row['entityId']),
      remoteOperation: row['operation'] as SyncOperation,
      localPayload: parseJson(row['localPayload']),
      remotePayload: parseJson(row['remotePayload']),
      remoteVersion: String(row['remoteVersion']),
      detectedAt: String(row['detectedAt']),
    }));
  }


  async keepMine(conflict: LocalSyncConflict): Promise<void> {
    const operation = conflict.localPayload === null ? 'delete' : 'upsert';
    const clock = this.touchLocalClock(conflict.entityType, conflict.entityId, operation);
    const definition = getSyncEntity(conflict.entityType);
    this.db().run(
      `INSERT INTO "_SyncOutbox" (
        "operationId", "entityType", "entityId", "operation", "baseVersion",
        "schemaVersion", "payload", "createdAt", "modifiedAt", "changeId"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        conflict.entityType,
        conflict.entityId,
        operation,
        conflict.remoteVersion,
        definition.schemaVersion,
        conflict.localPayload === null ? null : JSON.stringify(conflict.localPayload),
        new Date().toISOString(),
        clock.modifiedAt,
        clock.changeId,
      ],
    );
    this.deleteConflict(conflict);
    this.dbProvider.requestPersist();
    await this.syncNow();
  }

  async useCloud(conflict: LocalSyncConflict): Promise<void> {
    const change: RemoteSyncChange = {
      sequence: '0',
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      operation: conflict.remoteOperation,
      version: conflict.remoteVersion,
      payload: conflict.remotePayload,
      modifiedAt: String(this.normalizedNow()),
      changeId: randomChangeId(),
      createdAt: new Date().toISOString(),
    };
    this.db().exec('BEGIN IMMEDIATE');
    try {
      this.setCaptureSuppressed(true);
      this.applyRemoteChange(change);
      this.clearLocalPending(conflict.entityType, conflict.entityId);
      this.deleteConflict(conflict);
      this.setCaptureSuppressed(false);
      this.db().exec('COMMIT');
    } catch (error) {
      this.db().exec('ROLLBACK');
      throw error;
    }
    this.updateCounts();
    this.dbProvider.requestPersist();
  }

  private async runInitialSync(options: SyncStartOptions): Promise<void> {
    const deadline = options.initialTimeoutMs === undefined
      ? undefined
      : Date.now() + options.initialTimeoutMs;
    try {
      await this.runSync(deadline, options.metadataOnly ?? true);
    } catch (error) {
      this.auth.markSyncError(describeSyncError(error));
      this.scheduleRetry(error);
      if (options.requireInitialSuccess) throw error;
    }
  }

  private async runSync(deadline?: number, metadataOnly = false): Promise<void> {
    const vaultId = this.vaultId;
    if (!vaultId || !this.canSync()) throw new Error('A nuvem não está disponível.');
    this.pruneResolutionHistory();
    this.syncing.set(true);

    await this.ensureClockCalibrated(vaultId, deadline, deadline !== undefined);
    await this.ensureSnapshot(vaultId, deadline);
    await this.pullAll(vaultId, deadline);

    if (!metadataOnly) {
      await this.reportResolutionHistory(vaultId);
      await this.syncPendingBlobs(vaultId, 'pending');
      this.prepareOutbox();
      await this.pushAll(vaultId, deadline);
      await this.syncPendingBlobs(vaultId, 'delete');
      await this.pullAll(vaultId, deadline);
      await this.reportResolutionHistory(vaultId);
      await this.assetResolver.hydrateImages(vaultId);
      await this.assetResolver.hydrateCanonicalReferences(vaultId);
    }

    this.retryAttempt = 0;
    this.auth.clearError();
    const timestamp = new Date().toISOString();
    this.lastSyncAt.set(timestamp);
    this.setState('lastSyncAt', timestamp);
    this.updateCounts();
    this.dbProvider.requestPersist();
  }

  private async ensureClockCalibrated(
    vaultId: string,
    deadline?: number,
    force = false,
  ): Promise<void> {
    const calibratedAt = Number(this.getState('clockCalibratedAt') ?? 0);
    if (!force && Date.now() - calibratedAt < CLOCK_REFRESH_MS) return;
    const startedAt = Date.now();
    const status = await this.api.status(vaultId, this.remaining(deadline));
    this.calibrateClock(status.serverTime, startedAt, Date.now());
    this.setState('contractVersion', String(status.contractVersion));
  }

  private calibrateClock(serverTime: string, startedAt: number, completedAt: number): void {
    const serverMs = Number(serverTime);
    if (!Number.isFinite(serverMs)) return;
    const midpoint = Math.round((startedAt + completedAt) / 2);
    const oldOffset = Number(this.getState('clockOffsetMs') ?? 0);
    const newOffset = Math.round(serverMs - midpoint);
    const delta = newOffset - oldOffset;

    if (delta !== 0) {
      this.db().run(`
        UPDATE "_SyncRecordClock"
        SET
          "modifiedAt" = CAST(CAST("modifiedAt" AS INTEGER) + ? AS TEXT),
          "capturedOffsetMs" = ?
        WHERE "source" = 'local'
          AND EXISTS (
            SELECT 1 FROM "_SyncDirty" dirty
            WHERE dirty."entityType" = "_SyncRecordClock"."entityType"
              AND dirty."entityId" = "_SyncRecordClock"."entityId"
          )
          AND NOT EXISTS (
            SELECT 1 FROM "_SyncOutbox" outbox
            WHERE outbox."entityType" = "_SyncRecordClock"."entityType"
              AND outbox."entityId" = "_SyncRecordClock"."entityId"
              AND outbox."attempts" > 0
              AND outbox."changeId" = "_SyncRecordClock"."changeId"
          )
      `, [delta, newOffset]);
      this.db().run(`
        UPDATE "_SyncOutbox"
        SET "modifiedAt" = CAST(CAST("modifiedAt" AS INTEGER) + ? AS TEXT)
        WHERE "attempts" = 0
      `, [delta]);
      this.db().run(`
        UPDATE "_SyncDirty"
        SET "changedAt" = COALESCE((
          SELECT clock."modifiedAt" FROM "_SyncRecordClock" clock
          WHERE clock."entityType" = "_SyncDirty"."entityType"
            AND clock."entityId" = "_SyncDirty"."entityId"
        ), "changedAt")
      `);
    }
    this.setState('clockOffsetMs', String(newOffset));
    this.setState('clockCalibratedAt', String(Date.now()));
    this.dbProvider.requestPersist();
  }

  private async ensureSnapshot(vaultId: string, deadline?: number): Promise<void> {
    if (Number(this.getState('contractVersion') ?? 1) < 2) return;
    if (this.getState('lwwSnapshotVersion') === '2') return;

    let cursor: string | undefined;
    let snapshotCursor = '0';
    do {
      const startedAt = Date.now();
      const response = await this.api.snapshot(vaultId, cursor, 500, this.remaining(deadline));
      this.calibrateClock(response.serverTime, startedAt, Date.now());
      await this.applyRemoteBatch(response.records.map(record => this.snapshotAsChange(record)));
      snapshotCursor = response.snapshotCursor;
      cursor = response.nextCursor ?? undefined;
    } while (cursor);

    this.setState('cursor', snapshotCursor);
    this.setState('lwwSnapshotVersion', '2');
    this.dbProvider.requestPersist();
  }

  private snapshotAsChange(record: SnapshotSyncRecord): RemoteSyncChange {
    return {
      sequence: '0',
      entityType: record.entityType,
      entityId: record.entityId,
      operation: record.operation,
      version: record.version,
      payload: record.payload,
      modifiedAt: record.modifiedAt,
      changeId: record.changeId,
      createdAt: new Date().toISOString(),
    };
  }

  private async syncPendingBlobs(vaultId: string, state: 'pending' | 'delete'): Promise<void> {
    const pending = rows(this.db().exec(`
      SELECT "blobId", "localPath", "mimeType", "originalName", "sha256", "state"
      FROM "_BlobOutbox"
      WHERE "state" = ?
      ORDER BY "createdAt"
    `, [state]));
    const user = this.auth.user();

    for (const item of pending) {
      const blobId = String(item['blobId']);
      try {
        if (state === 'delete') {
          try {
            await this.transferPacer.waitForTurn();
            await this.api.deleteBlob(vaultId, blobId);
          } catch (error) {
            if (!isHttpStatus(error, 404)) throw error;
          }
        } else {
          let bytes: Uint8Array | ArrayBuffer | null = null;
          if (isElectronRuntime()) {
            const localPath = item['localPath'];
            if (typeof localPath === 'string' && localPath) {
              bytes = await ElectronSafeAPI.electron.readFile(localPath);
            }
          } else if (user) {
            bytes = (await this.browserStorage.readBlob(user.id, vaultId, blobId))?.bytes ?? null;
          }
          if (!bytes) throw new Error(`Arquivo local não encontrado para o blob ${blobId}.`);
          await this.transferPacer.waitForTurn();
          await this.api.uploadBlob(
            vaultId,
            blobId,
            bytes,
            String(item['mimeType']),
            String(item['sha256']),
            typeof item['originalName'] === 'string' ? item['originalName'] : blobId,
          );
        }
        this.db().run(`DELETE FROM "_BlobOutbox" WHERE "blobId" = ?`, [blobId]);
        this.dbProvider.requestPersist();
      } catch (error) {
        const message = describeSyncError(error);
        this.db().run(
          `UPDATE "_BlobOutbox" SET "lastError" = ? WHERE "blobId" = ?`,
          [message.slice(0, 500), blobId],
        );
        this.dbProvider.requestPersist();
        throw error;
      }
    }
  }

  private prepareOutbox(): void {
    const db = this.db();
    const dirtyRows = rows(db.exec(`
      SELECT dirty."entityType", dirty."entityId", dirty."operation",
             clock."modifiedAt", clock."changeId"
      FROM "_SyncDirty" dirty
      JOIN "_SyncRecordClock" clock
        ON clock."entityType" = dirty."entityType"
       AND clock."entityId" = dirty."entityId"
      WHERE NOT EXISTS (
        SELECT 1 FROM "_SyncOutbox" outbox
        WHERE outbox."entityType" = dirty."entityType"
          AND outbox."entityId" = dirty."entityId"
      )
      ORDER BY CAST(clock."modifiedAt" AS INTEGER)
    `));
    if (!dirtyRows.length) return;

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const dirty of dirtyRows) {
        const entityType = String(dirty['entityType']);
        const entityId = String(dirty['entityId']);
        const operation = dirty['operation'] as SyncOperation;
        const definition = getSyncEntity(entityType);
        const payload = operation === 'delete' ? null : this.localPayload(definition, entityId);
        const baseVersion = scalar(db.exec(
          `SELECT "version" FROM "_SyncVersions" WHERE "entityType" = ? AND "entityId" = ?`,
          [entityType, entityId],
        ));
        db.run(
          `INSERT INTO "_SyncOutbox" (
            "operationId", "entityType", "entityId", "operation", "baseVersion",
            "schemaVersion", "payload", "createdAt", "modifiedAt", "changeId"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            entityType,
            entityId,
            operation,
            baseVersion === undefined ? null : String(baseVersion),
            definition.schemaVersion,
            payload === null ? null : JSON.stringify(payload),
            new Date().toISOString(),
            String(dirty['modifiedAt']),
            String(dirty['changeId']),
          ],
        );
        db.run(
          `DELETE FROM "_SyncDirty" WHERE "entityType" = ? AND "entityId" = ?`,
          [entityType, entityId],
        );
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  private async pushAll(vaultId: string, deadline?: number): Promise<void> {
    while (true) {
      const batch = rows(this.db().exec(`
        SELECT * FROM "_SyncOutbox" ORDER BY CAST("modifiedAt" AS INTEGER) LIMIT 100
      `));
      if (!batch.length) return;
      const operations: SyncPushOperation[] = batch.map(row => ({
        operationId: String(row['operationId']),
        entityType: String(row['entityType']),
        entityId: String(row['entityId']),
        operation: row['operation'] as SyncOperation,
        baseVersion: row['baseVersion'] === null ? null : String(row['baseVersion']),
        schemaVersion: Number(row['schemaVersion']),
        modifiedAt: String(row['modifiedAt']),
        changeId: String(row['changeId']),
        ...(row['payload'] === null ? {} : { payload: parseJson(row['payload']) ?? {} }),
      }));
      this.rememberLocalChanges(operations);
      this.db().run(
        `UPDATE "_SyncOutbox" SET "attempts" = "attempts" + 1, "lastError" = NULL
         WHERE "operationId" IN (${batch.map(() => '?').join(', ')})`,
        batch.map(row => String(row['operationId'])),
      );
      try {
        const startedAt = Date.now();
        const response = await this.api.push(vaultId, operations, this.remaining(deadline));
        this.calibrateClock(response.serverTime, startedAt, Date.now());
        await this.applyPushResults(response.results, batch);
      } catch (error) {
        if (isClockRangeError(error)) {
          this.requeueClockRejectedBatch(batch, error);
        } else {
          const message = describeSyncError(error).slice(0, 500);
          this.db().run(
            `UPDATE "_SyncOutbox" SET "lastError" = ?
             WHERE "operationId" IN (${batch.map(() => '?').join(', ')})`,
            [message, ...batch.map(row => String(row['operationId']))],
          );
        }
        this.dbProvider.requestPersist();
        throw error;
      }
      this.dbProvider.requestPersist();
    }
  }

  private async applyPushResults(
    results: SyncPushResult[],
    batch: Record<string, SqlValue>[],
  ): Promise<void> {
    for (const result of results) {
      const outbox = batch.find(row => row['operationId'] === result.operationId);
      if (!outbox) continue;
      if (result.status === 'rejected') {
        this.requeueClockRejectedRows([outbox], result.serverTime ?? null);
      } else if (result.status === 'conflict') {
        this.storeLegacyConflict(result, outbox);
      } else if (result.status === 'superseded') {
        const remote: RemoteSyncChange = {
          sequence: '0',
          entityType: result.entityType,
          entityId: result.entityId,
          operation: result.remoteOperation ?? 'upsert',
          version: result.version,
          payload: result.remotePayload ?? null,
          modifiedAt: result.remoteModifiedAt ?? result.modifiedAt ?? '0',
          changeId: result.remoteChangeId ?? result.changeId ?? randomChangeId(),
          createdAt: new Date().toISOString(),
        };
        this.db().run(`DELETE FROM "_SyncOutbox" WHERE "operationId" = ?`, [result.operationId]);
        await this.applyRemoteBatch([remote]);
      } else {
        this.setKnownVersion(result.entityType, result.entityId, result.version);
        if (result.modifiedAt && result.changeId) {
          const currentClock = this.clockFor(result.entityType, result.entityId);
          if (currentClock?.changeId === String(outbox['changeId'])) {
            this.setRecordClock(
              result.entityType,
              result.entityId,
              outbox['operation'] as SyncOperation,
              result.modifiedAt,
              result.changeId,
              'remote',
            );
          }
        }
        this.db().run(`DELETE FROM "_SyncOutbox" WHERE "operationId" = ?`, [result.operationId]);
      }
    }
    this.prepareOutbox();
  }

  private storeLegacyConflict(
    result: SyncPushResult,
    outbox: Record<string, SqlValue>,
  ): void {
    this.db().run(
      `INSERT INTO "_SyncConflicts" (
        "entityType", "entityId", "operation", "localPayload", "remotePayload",
        "remoteVersion", "detectedAt"
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT("entityType", "entityId") DO UPDATE SET
        "operation" = excluded."operation",
        "localPayload" = excluded."localPayload",
        "remotePayload" = excluded."remotePayload",
        "remoteVersion" = excluded."remoteVersion",
        "detectedAt" = excluded."detectedAt"`,
      [
        result.entityType,
        result.entityId,
        result.remoteOperation ?? 'upsert',
        outbox['payload'],
        result.remotePayload === undefined ? null : JSON.stringify(result.remotePayload),
        result.version,
        new Date().toISOString(),
      ],
    );
    this.db().run(`DELETE FROM "_SyncOutbox" WHERE "operationId" = ?`, [result.operationId]);
  }

  private async pullAll(vaultId: string, deadline?: number): Promise<void> {
    let cursor = this.getState('cursor') ?? '0';
    while (true) {
      const startedAt = Date.now();
      const response = await this.api.changes(vaultId, cursor, 500, this.remaining(deadline));
      this.calibrateClock(response.serverTime, startedAt, Date.now());
      if (response.changes.length) {
        await this.applyRemoteBatch(response.changes);
        cursor = response.cursor;
        this.setState('cursor', cursor);
        this.dbProvider.requestPersist();
      }
      if (!response.hasMore || response.changes.length === 0) return;
    }
  }

  private async applyRemoteBatch(changes: RemoteSyncChange[]): Promise<void> {
    if (!changes.length) return;

    const containsExternalContentChanges = changes.some(change =>
      !this.isOwnChange(change)
      && !syncPayloadsEqual(this.localContent(change), this.remoteContent(change))
    );
    if (containsExternalContentChanges) {
      await flushPendingComponentSaves();
      await this.dbProvider.flushPendingWrites();
    }

    const contentBefore = new Map<string, Record<string, unknown> | null>();
    const lastChangeByKey = new Map<string, RemoteSyncChange>();
    for (const change of changes) {
      const key = this.contentKey(change);
      if (!contentBefore.has(key)) contentBefore.set(key, this.localContent(change));
      lastChangeByKey.set(key, change);
    }

    await this.dbProvider.runInTransaction(async () => {
      this.setCaptureSuppressed(true);
      for (const change of changes) await this.reconcileRemoteChange(change);
      this.setCaptureSuppressed(false);
    });

    const externalContentChanged = [...lastChangeByKey.entries()].some(([key, change]) =>
      !this.isOwnChange(change)
      && !syncPayloadsEqual(contentBefore.get(key) ?? null, this.localContent(change))
    );
    for (const change of changes) this.recentlyPushedChangeIds.delete(change.changeId);
    if (externalContentChanged) this.componentRefresh.refreshFromRemote();
  }

  private async reconcileRemoteChange(change: RemoteSyncChange): Promise<boolean> {
    if (syncPayloadsEqual(this.localContent(change), this.remoteContent(change))) {
      this.clearLocalPending(change.entityType, change.entityId);
      this.setKnownVersion(change.entityType, change.entityId, change.version);
      this.setRecordClock(
        change.entityType,
        change.entityId,
        change.operation,
        change.modifiedAt,
        change.changeId,
        'remote',
      );
      return false;
    }

    const hasLocalChange = Number(scalar(this.db().exec(`
      SELECT EXISTS(
        SELECT 1 FROM "_SyncDirty" WHERE "entityType" = ? AND "entityId" = ?
        UNION ALL
        SELECT 1 FROM "_SyncOutbox" WHERE "entityType" = ? AND "entityId" = ?
      )
    `, [change.entityType, change.entityId, change.entityType, change.entityId])) ?? 0) === 1;

    if (!hasLocalChange) {
      this.applyRemoteChange(change);
      return true;
    }

    const local = this.localClockSnapshot(change.entityType, change.entityId);
    const remote: ClockSnapshot = {
      operation: change.operation,
      payload: change.payload,
      modifiedAt: change.modifiedAt,
      changeId: change.changeId,
    };
    if (local?.changeId === remote.changeId) {
      this.clearLocalPending(change.entityType, change.entityId);
      this.applyRemoteChange(change);
      return true;
    }

    if (!local) {
      this.clearLocalPending(change.entityType, change.entityId);
      this.applyRemoteChange(change);
      return true;
    }

    if (compareSyncClock(local, remote) > 0) {
      await this.archiveResolution(change.entityType, change.entityId, local, remote);
      this.setKnownVersion(change.entityType, change.entityId, change.version);
      return false;
    }

    await this.archiveResolution(change.entityType, change.entityId, remote, local);
    this.clearLocalPending(change.entityType, change.entityId);
    this.applyRemoteChange(change);
    return true;
  }

  private localContent(change: Pick<RemoteSyncChange, 'entityType' | 'entityId'>): Record<string, unknown> | null {
    return this.localPayload(getSyncEntity(change.entityType), change.entityId);
  }

  private remoteContent(change: RemoteSyncChange): Record<string, unknown> | null {
    if (change.operation === 'delete') return null;
    const definition = getSyncEntity(change.entityType);
    return {
      ...(change.payload ?? {}),
      [definition.primaryKey]: change.entityId,
    };
  }

  private contentKey(change: Pick<RemoteSyncChange, 'entityType' | 'entityId'>): string {
    return `${change.entityType}\u0000${change.entityId}`;
  }


  private isOwnChange(change: Pick<RemoteSyncChange, 'changeId' | 'actorDeviceId'>): boolean {
    return isOwnSyncChange(change, this.auth.deviceId(), this.recentlyPushedChangeIds);
  }

  private rememberLocalChanges(operations: readonly SyncPushOperation[]): void {
    for (const operation of operations) this.recentlyPushedChangeIds.add(operation.changeId);
    while (this.recentlyPushedChangeIds.size > 2_000) {
      const oldest = this.recentlyPushedChangeIds.values().next().value;
      if (typeof oldest !== 'string') break;
      this.recentlyPushedChangeIds.delete(oldest);
    }
  }

  private applyRemoteChange(change: RemoteSyncChange): void {
    const definition = getSyncEntity(change.entityType);
    if (change.operation === 'delete') {
      this.db().run(
        `DELETE FROM ${quoteIdentifier(change.entityType)}
         WHERE ${quoteIdentifier(definition.primaryKey)} = ?`,
        [change.entityId],
      );
    } else if (change.payload) {
      this.upsertRemotePayload(definition, change.entityId, change.payload);
    }
    this.setKnownVersion(change.entityType, change.entityId, change.version);
    this.setRecordClock(
      change.entityType,
      change.entityId,
      change.operation,
      change.modifiedAt,
      change.changeId,
      'remote',
    );
  }

  private upsertRemotePayload(
    definition: SyncEntityDefinition,
    entityId: string,
    payload: Record<string, unknown>,
  ): void {
    const existingColumns = new Set(
      rows(this.db().exec(`PRAGMA table_info(${quoteIdentifier(definition.entityType)})`))
        .map(row => String(row['name'])),
    );
    const record: Record<string, unknown> = { ...payload, [definition.primaryKey]: entityId };
    if (definition.entityType === 'Image' && !('filePath' in record)) record['filePath'] = '';
    const keys = Object.keys(record).filter(key => existingColumns.has(key));
    const updateKeys = keys.filter(key => key !== definition.primaryKey);
    const updateClause = updateKeys.length
      ? `DO UPDATE SET ${updateKeys.map(key => `${quoteIdentifier(key)} = excluded.${quoteIdentifier(key)}`).join(', ')}`
      : 'DO NOTHING';
    this.db().run(
      `INSERT INTO ${quoteIdentifier(definition.entityType)} (${keys.map(quoteIdentifier).join(', ')})
       VALUES (${keys.map(() => '?').join(', ')})
       ON CONFLICT(${quoteIdentifier(definition.primaryKey)}) ${updateClause}`,
      keys.map(key => toSqlValue(record[key])),
    );
  }

  private async prepareFirstLink(vaultId: string, deadline?: number): Promise<void> {
    const currentVault = this.getState('vaultId');
    const currentUser = this.getState('userId');
    const userId = this.auth.user()?.id;
    if (currentVault === vaultId && currentUser === userId) return;

    const startedAt = Date.now();
    const status = await this.api.status(vaultId, this.remaining(deadline));
    this.calibrateClock(status.serverTime, startedAt, Date.now());
    const summary = this.localSummary();
    const localCount = Object.values(summary).reduce((total, value) => total + value, 0);
    if (localCount > 0 && isElectronRuntime()) {
      const isNewAccount = Boolean(currentUser && currentUser !== userId);
      const message = [
        isNewAccount
          ? 'Este banco local estava vinculado a outra conta. Criar um novo vínculo?'
          : 'Enviar o conteúdo local para a nuvem?',
        `Entidades: ${localCount}`,
        `Imagens: ${summary['Image'] ?? 0}`,
        `Registros já existentes na nuvem: ${status.recordCount}`,
        'A modificação mais recente de cada registro será preservada automaticamente.',
      ].join('\n');
      if (!window.confirm(message)) {
        this.auth.setSyncEnabled(false);
        throw new Error('Vínculo com a nuvem cancelado.');
      }
      this.markAllLocalRecordsDirty();
    }

    this.setState('vaultId', vaultId);
    if (userId) this.setState('userId', userId);
    this.setState('contractVersion', String(status.contractVersion));
    this.setState('lwwSnapshotVersion', '0');
    this.dbProvider.requestPersist();
  }

  private localSummary(): Record<string, number> {
    return Object.fromEntries(SYNC_ENTITIES.map(definition => [
      definition.entityType,
      Number(scalar(this.db().exec(
        `SELECT COUNT(*) FROM ${quoteIdentifier(definition.entityType)}`,
      )) ?? 0),
    ]));
  }

  private markAllLocalRecordsDirty(): void {
    const db = this.db();
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const definition of SYNC_ENTITIES) {
        const modifiedAt = String(this.normalizedNow());
        db.exec(`
          INSERT INTO "_SyncRecordClock" (
            "entityType", "entityId", "operation", "modifiedAt", "changeId",
            "capturedOffsetMs", "source"
          )
          SELECT ${quoteLiteral(definition.entityType)},
                 CAST(${quoteIdentifier(definition.primaryKey)} AS TEXT),
                 'upsert',
                 ${quoteLiteral(modifiedAt)},
                 lower(hex(randomblob(16))),
                 CAST(${quoteLiteral(this.getState('clockOffsetMs') ?? '0')} AS INTEGER),
                 'local'
          FROM ${quoteIdentifier(definition.entityType)}
          ON CONFLICT("entityType", "entityId") DO UPDATE SET
            "operation" = 'upsert',
            "modifiedAt" = excluded."modifiedAt",
            "changeId" = excluded."changeId",
            "capturedOffsetMs" = excluded."capturedOffsetMs",
            "source" = 'local';

          INSERT INTO "_SyncDirty" ("entityType", "entityId", "operation", "changedAt")
          SELECT "entityType", "entityId", "operation", "modifiedAt"
          FROM "_SyncRecordClock"
          WHERE "entityType" = ${quoteLiteral(definition.entityType)}
          ON CONFLICT("entityType", "entityId") DO UPDATE SET
            "operation" = excluded."operation", "changedAt" = excluded."changedAt";
        `);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  private localPayload(
    definition: SyncEntityDefinition,
    entityId: string,
  ): Record<string, unknown> | null {
    const result = rows(this.db().exec(
      `SELECT * FROM ${quoteIdentifier(definition.entityType)}
       WHERE ${quoteIdentifier(definition.primaryKey)} = ?`,
      [entityId],
    ))[0];
    return result ? toSyncPayload(definition, result) : null;
  }

  private localClockSnapshot(entityType: string, entityId: string): ClockSnapshot | null {
    const clock = this.clockFor(entityType, entityId);
    if (!clock) return null;
    const definition = getSyncEntity(entityType);
    const outboxPayload = scalar(this.db().exec(
      `SELECT "payload" FROM "_SyncOutbox"
       WHERE "entityType" = ? AND "entityId" = ?
       ORDER BY "createdAt" DESC LIMIT 1`,
      [entityType, entityId],
    ));
    const payload = clock.operation === 'delete'
      ? null
      : outboxPayload !== undefined
        ? parseJson(outboxPayload)
        : this.localPayload(definition, entityId);
    return { ...clock, payload };
  }

  private clockFor(
    entityType: string,
    entityId: string,
  ): Omit<ClockSnapshot, 'payload'> | null {
    const row = rows(this.db().exec(
      `SELECT "operation", "modifiedAt", "changeId"
       FROM "_SyncRecordClock" WHERE "entityType" = ? AND "entityId" = ?`,
      [entityType, entityId],
    ))[0];
    return row ? {
      operation: row['operation'] as SyncOperation,
      modifiedAt: String(row['modifiedAt']),
      changeId: String(row['changeId']),
    } : null;
  }

  private touchLocalClock(
    entityType: string,
    entityId: string,
    operation: SyncOperation,
  ): Omit<ClockSnapshot, 'payload'> {
    const modifiedAt = String(this.normalizedNow());
    const changeId = randomChangeId();
    this.setRecordClock(entityType, entityId, operation, modifiedAt, changeId, 'local');
    return { operation, modifiedAt, changeId };
  }

  private setRecordClock(
    entityType: string,
    entityId: string,
    operation: SyncOperation,
    modifiedAt: string,
    changeId: string,
    source: 'local' | 'remote',
  ): void {
    this.db().run(
      `INSERT INTO "_SyncRecordClock" (
        "entityType", "entityId", "operation", "modifiedAt", "changeId",
        "capturedOffsetMs", "source"
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT("entityType", "entityId") DO UPDATE SET
        "operation" = excluded."operation",
        "modifiedAt" = excluded."modifiedAt",
        "changeId" = excluded."changeId",
        "capturedOffsetMs" = excluded."capturedOffsetMs",
        "source" = excluded."source"`,
      [
        entityType,
        entityId,
        operation,
        modifiedAt,
        changeId,
        Number(this.getState('clockOffsetMs') ?? 0),
        source,
      ],
    );
  }

  private async archiveResolution(
    entityType: string,
    entityId: string,
    winner: ClockSnapshot,
    loser: ClockSnapshot,
  ): Promise<void> {
    if (
      winner.changeId === loser.changeId
      || (winner.operation === loser.operation && payloadsEqual(winner.payload, loser.payload))
    ) return;
    const resolutionKey = await this.resolutionKey(
      entityType,
      entityId,
      winner.changeId,
      loser.changeId,
    );
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + RESOLUTION_RETENTION_MS).toISOString();
    this.db().run(
      `INSERT OR IGNORE INTO "_SyncResolutionHistory" (
        "resolutionKey", "entityType", "entityId",
        "winnerOperation", "winnerPayload", "winnerModifiedAt", "winnerChangeId",
        "loserOperation", "loserPayload", "loserModifiedAt", "loserChangeId",
        "createdAt", "expiresAt"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resolutionKey,
        entityType,
        entityId,
        winner.operation,
        winner.payload === null ? null : JSON.stringify(winner.payload),
        winner.modifiedAt,
        winner.changeId,
        loser.operation,
        loser.payload === null ? null : JSON.stringify(loser.payload),
        loser.modifiedAt,
        loser.changeId,
        createdAt,
        expiresAt,
      ],
    );
    this.db().run(
      `INSERT OR IGNORE INTO "_SyncResolutionOutbox" ("resolutionKey") VALUES (?)`,
      [resolutionKey],
    );
  }

  private async resolutionKey(
    entityType: string,
    entityId: string,
    firstChangeId: string,
    secondChangeId: string,
  ): Promise<string> {
    const pair = [firstChangeId, secondChangeId].sort().join(':');
    const source = `${this.vaultId}:${entityType}:${entityId}:${pair}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private async reportResolutionHistory(vaultId: string): Promise<void> {
    const pending = rows(this.db().exec(`
      SELECT history.*
      FROM "_SyncResolutionOutbox" outbox
      JOIN "_SyncResolutionHistory" history
        ON history."resolutionKey" = outbox."resolutionKey"
      ORDER BY history."createdAt"
      LIMIT 100
    `));
    if (!pending.length) return;
    const resolutions = pending.map(row => this.resolutionFromRow(row));
    try {
      await this.api.reportResolutions(vaultId, resolutions);
      this.db().run(
        `DELETE FROM "_SyncResolutionOutbox"
         WHERE "resolutionKey" IN (${pending.map(() => '?').join(', ')})`,
        pending.map(row => String(row['resolutionKey'])),
      );
    } catch (error) {
      const message = describeSyncError(error).slice(0, 500);
      this.db().run(
        `UPDATE "_SyncResolutionOutbox"
         SET "attempts" = "attempts" + 1, "lastError" = ?
         WHERE "resolutionKey" IN (${pending.map(() => '?').join(', ')})`,
        [message, ...pending.map(row => String(row['resolutionKey']))],
      );
    }
  }

  private resolutionFromRow(row: Record<string, SqlValue>): SyncResolution {
    return {
      resolutionKey: String(row['resolutionKey']),
      entityType: String(row['entityType']),
      entityId: String(row['entityId']),
      winnerOperation: row['winnerOperation'] as SyncOperation,
      winnerPayload: parseJson(row['winnerPayload']),
      winnerModifiedAt: String(row['winnerModifiedAt']),
      winnerChangeId: String(row['winnerChangeId']),
      loserOperation: row['loserOperation'] as SyncOperation,
      loserPayload: parseJson(row['loserPayload']),
      loserModifiedAt: String(row['loserModifiedAt']),
      loserChangeId: String(row['loserChangeId']),
    };
  }

  private pruneResolutionHistory(): void {
    if (!this.dbProvider.ready()) return;
    const now = new Date().toISOString();
    this.db().run(
      `DELETE FROM "_SyncResolutionOutbox"
       WHERE "resolutionKey" IN (
         SELECT "resolutionKey" FROM "_SyncResolutionHistory" WHERE "expiresAt" < ?
       )`,
      [now],
    );
    this.db().run(`DELETE FROM "_SyncResolutionHistory" WHERE "expiresAt" < ?`, [now]);
  }

  private clearLocalPending(entityType: string, entityId: string): void {
    this.db().run(
      `DELETE FROM "_SyncDirty" WHERE "entityType" = ? AND "entityId" = ?`,
      [entityType, entityId],
    );
    this.db().run(
      `DELETE FROM "_SyncOutbox" WHERE "entityType" = ? AND "entityId" = ?`,
      [entityType, entityId],
    );
  }

  private requeueClockRejectedBatch(
    batch: Record<string, SqlValue>[],
    error: unknown,
  ): void {
    this.requeueClockRejectedRows(batch, clockErrorServerTime(error));
  }

  private requeueClockRejectedRows(
    batch: Record<string, SqlValue>[],
    serverTime: string | null,
  ): void {
    if (serverTime) {
      const now = Date.now();
      this.calibrateClock(serverTime, now, now);
    }
    for (const row of batch) {
      const entityType = String(row['entityType']);
      const entityId = String(row['entityId']);
      const currentChangeId = scalar(this.db().exec(
        `SELECT "changeId" FROM "_SyncRecordClock"
         WHERE "entityType" = ? AND "entityId" = ?`,
        [entityType, entityId],
      ));
      const isCurrentChange = currentChangeId === row['changeId'];
      if (isCurrentChange) {
      const modifiedAt = String(this.normalizedNow());
      this.db().run(
        `UPDATE "_SyncRecordClock"
         SET "modifiedAt" = ?, "capturedOffsetMs" = ?
         WHERE "entityType" = ? AND "entityId" = ? AND "changeId" = ?`,
        [
          modifiedAt,
          Number(this.getState('clockOffsetMs') ?? 0),
          entityType,
          entityId,
          String(row['changeId']),
        ],
      );
      this.db().run(
        `INSERT INTO "_SyncDirty" ("entityType", "entityId", "operation", "changedAt")
         VALUES (?, ?, ?, ?)
         ON CONFLICT("entityType", "entityId") DO UPDATE SET
           "operation" = excluded."operation", "changedAt" = excluded."changedAt"`,
        [entityType, entityId, row['operation'], modifiedAt],
      );
      }
      this.db().run(`DELETE FROM "_SyncOutbox" WHERE "operationId" = ?`, [row['operationId']]);
    }
  }

  private normalizedNow(): number {
    return Date.now() + Number(this.getState('clockOffsetMs') ?? 0);
  }

  private setKnownVersion(entityType: string, entityId: string, version: string): void {
    this.db().run(
      `INSERT INTO "_SyncVersions" ("entityType", "entityId", "version") VALUES (?, ?, ?)
       ON CONFLICT("entityType", "entityId") DO UPDATE SET "version" = excluded."version"`,
      [entityType, entityId, version],
    );
  }

  private setCaptureSuppressed(suppressed: boolean): void {
    this.db().run(
      `UPDATE "_SyncControl" SET "suppressCapture" = ? WHERE "id" = 1`,
      [suppressed ? 1 : 0],
    );
  }

  private getState(key: string): string | null {
    const value = scalar(this.db().exec(
      `SELECT "value" FROM "_SyncState" WHERE "key" = ?`,
      [key],
    ));
    return value === undefined ? null : String(value);
  }

  private setState(key: string, value: string): void {
    this.db().run(
      `INSERT INTO "_SyncState" ("key", "value") VALUES (?, ?)
       ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`,
      [key, value],
    );
  }

  private deleteConflict(conflict: Pick<LocalSyncConflict, 'entityType' | 'entityId'>): void {
    this.db().run(
      `DELETE FROM "_SyncConflicts" WHERE "entityType" = ? AND "entityId" = ?`,
      [conflict.entityType, conflict.entityId],
    );
    this.updateCounts();
  }

  private updateCounts(): void {
    this.conflictCount.set(Number(scalar(this.db().exec(
      `SELECT COUNT(*) FROM "_SyncConflicts"`,
    )) ?? 0));
  }

  private subscribe(): void {
    this.unsubscribeMutation = this.dbProvider.subscribeToMutations(() => this.scheduleDebounced());
    window.addEventListener('online', this.onOnline);
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.intervalId = window.setInterval(() => void this.syncNow(), 30_000);
  }

  private scheduleDebounced(): void {
    if (!this.canSync()) return;
    if (this.debounceTimerId !== null) window.clearTimeout(this.debounceTimerId);
    this.debounceTimerId = window.setTimeout(() => {
      this.debounceTimerId = null;
      void this.syncNow();
    }, SYNC_MUTATION_DEBOUNCE_MS);
  }

  private scheduleRetry(error: unknown): void {
    if (!this.auth.isAuthenticated() || !this.auth.syncEnabled()) return;
    if (this.retryTimerId !== null) window.clearTimeout(this.retryTimerId);
    const baseDelay = Math.min(300_000, 2_000 * 2 ** this.retryAttempt++);
    const jitteredDelay = Math.round(baseDelay * (0.75 + Math.random() * 0.5));
    const retryDelay = Math.max(jitteredDelay, rateLimitRetryDelay(error) ?? 0);
    this.retryTimerId = window.setTimeout(() => {
      this.retryTimerId = null;
      void this.syncNow();
    }, retryDelay);
  }

  private remaining(deadline?: number): number | undefined {
    if (deadline === undefined) return undefined;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('A sincronização inicial excedeu 10 segundos.');
    return remaining;
  }

  private canSync(): boolean {
    return Boolean(
      this.vaultId
      && this.dbProvider.ready()
      && !this.dbProvider.readOnly()
      && this.auth.isAuthenticated()
      && this.auth.syncEnabled()
      && navigator.onLine,
    );
  }

  private db(): Database {
    return this.dbProvider.getDb<Database>();
  }

  private readonly onOnline = () => void this.syncNow();
  private readonly onFocus = () => void this.syncNow();
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void this.syncNow();
  };
}

function rows(result: QueryExecResult[]): Record<string, SqlValue>[] {
  if (!result.length) return [];
  const [query] = result;
  return query.values.map(values => Object.fromEntries(
    query.columns.map((column, index) => [column, values[index]]),
  ));
}

function scalar(result: QueryExecResult[]): SqlValue | undefined {
  return result[0]?.values[0]?.[0];
}

function parseJson(value: SqlValue | undefined): Record<string, unknown> | null {
  if (typeof value !== 'string') return null;
  return JSON.parse(value) as Record<string, unknown>;
}

export function compareSyncClock(
  left: Pick<ClockSnapshot, 'modifiedAt' | 'changeId'>,
  right: Pick<ClockSnapshot, 'modifiedAt' | 'changeId'>,
): number {
  const leftTime = BigInt(left.modifiedAt);
  const rightTime = BigInt(right.modifiedAt);
  if (leftTime !== rightTime) return leftTime > rightTime ? 1 : -1;
  if (left.changeId === right.changeId) return 0;
  return left.changeId > right.changeId ? 1 : -1;
}

export function syncPayloadsEqual(
  left: Record<string, unknown> | null,
  right: Record<string, unknown> | null,
): boolean {
  return JSON.stringify(canonicalizeSyncValue(left)) === JSON.stringify(canonicalizeSyncValue(right));
}

function payloadsEqual(
  left: Record<string, unknown> | null,
  right: Record<string, unknown> | null,
): boolean {
  return syncPayloadsEqual(left, right);
}

export function isOwnSyncChange(
  change: Pick<RemoteSyncChange, 'changeId' | 'actorDeviceId'>,
  currentDeviceId: string | null,
  recentlyPushedChangeIds: ReadonlySet<string>,
): boolean {
  return Boolean(
    (currentDeviceId && change.actorDeviceId === currentDeviceId)
    || recentlyPushedChangeIds.has(change.changeId)
  );
}

function canonicalizeSyncValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeSyncValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalizeSyncValue(nested)]),
  );
}

function randomChangeId(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function toSqlValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Uint8Array) {
    return value;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return JSON.stringify(value);
}

function isHttpStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === status;
}

function isClockRangeError(error: unknown): boolean {
  return clockErrorBody(error)?.['code'] === 'SYNC_CLOCK_OUT_OF_RANGE';
}

function clockErrorServerTime(error: unknown): string | null {
  const value = clockErrorBody(error)?.['serverTime'];
  return typeof value === 'string' ? value : null;
}

function clockErrorBody(error: unknown): Record<string, unknown> | null {
  if (typeof error !== 'object' || error === null || !('error' in error)) return null;
  const body = (error as { error?: unknown }).error;
  if (typeof body !== 'object' || body === null) return null;
  if ('message' in body && typeof body.message === 'object' && body.message !== null) {
    return body.message as Record<string, unknown>;
  }
  return body as Record<string, unknown>;
}

function describeSyncError(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha desconhecida de sincronização.';
}

export function rateLimitRetryDelay(error: unknown): number | null {
  if (!isHttpStatus(error, 429)) return null;

  const headers = (error as { headers?: unknown }).headers;
  let retryAfter: string | null = null;
  if (headers && typeof headers === 'object' && 'get' in headers) {
    const getHeader = (headers as { get(name: string): string | null }).get;
    if (typeof getHeader === 'function') retryAfter = getHeader.call(headers, 'Retry-After');
  }

  let requestedDelay = 0;
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      requestedDelay = Math.ceil(seconds * 1_000);
    } else {
      const retryAt = Date.parse(retryAfter);
      if (Number.isFinite(retryAt)) requestedDelay = Math.max(0, retryAt - Date.now());
    }
  }

  return Math.max(RATE_LIMIT_MIN_RETRY_MS, requestedDelay);
}
