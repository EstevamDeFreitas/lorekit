import { inject, Injectable, signal } from '@angular/core';
import type { Database, QueryExecResult, SqlValue } from 'sql.js';
import { DbProvider } from '../database/db-provider.service';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { ElectronSafeAPI } from '../database/database.helper';
import { isElectronRuntime } from '../utils/runtime-platform';
import {
  getSyncEntity,
  SYNC_ENTITIES,
  SyncEntityDefinition,
  toSyncPayload,
} from '../database/sync-entity-registry';
import { AuthService } from './auth.service';
import { AssetResolverService } from './asset-resolver.service';
import { LegacyAssetMigrationService } from './legacy-asset-migration.service';
import {
  CloudSyncApiService,
  RemoteSyncChange,
  SyncPushOperation,
  SyncPushResult,
} from './cloud-sync-api.service';

export interface LocalSyncConflict {
  entityType: string;
  entityId: string;
  remoteOperation: 'upsert' | 'delete';
  localPayload: Record<string, unknown> | null;
  remotePayload: Record<string, unknown> | null;
  remoteVersion: string;
  detectedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SyncEngineService {
  private readonly dbProvider = inject(DbProvider);
  private readonly auth = inject(AuthService);
  private readonly api = inject(CloudSyncApiService);
  private vaultId: string | null = null;
  private readonly browserStorage = inject(BrowserDatabaseStorageService);
  private readonly assetResolver = inject(AssetResolverService);
  private readonly legacyAssetMigration = inject(LegacyAssetMigrationService);
  private syncInFlight: Promise<void> | null = null;
  private intervalId: number | null = null;
  private retryTimerId: number | null = null;
  private debounceTimerId: number | null = null;
  private retryAttempt = 0;
  private unsubscribeMutation: (() => void) | null = null;

  readonly syncing = signal(false);
  readonly lastSyncAt = signal<string | null>(null);
  readonly conflictCount = signal(0);

  async start(vaultId: string): Promise<void> {
    if (this.vaultId === vaultId && this.intervalId !== null) {
      await this.syncNow();
      return;
    }
    this.stop();
    this.vaultId = vaultId;
    await this.prepareFirstLink(vaultId);
    await this.legacyAssetMigration.migrateForSync();

    this.unsubscribeMutation = this.dbProvider.subscribeToMutations(() => this.scheduleDebounced());
    window.addEventListener('online', this.onOnline);
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.intervalId = window.setInterval(() => void this.syncNow(), 30_000);
    await this.syncNow();
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
  }

  async syncNow(): Promise<void> {
    if (this.syncInFlight) return this.syncInFlight;
    if (!this.canSync()) return;

    this.syncInFlight = this.runSync()
      .catch(error => {
        const message = error instanceof Error ? error.message : 'Falha desconhecida de sincronização.';
        this.auth.markSyncError(message);
        this.scheduleRetry();
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
      remoteOperation: row['operation'] as 'upsert' | 'delete',
      localPayload: parseJson(row['localPayload']),
      remotePayload: parseJson(row['remotePayload']),
      remoteVersion: String(row['remoteVersion']),
      detectedAt: String(row['detectedAt']),
    }));
  }

  async keepMine(conflict: LocalSyncConflict): Promise<void> {
    const definition = getSyncEntity(conflict.entityType);
    const operationId = crypto.randomUUID();
    const operation = conflict.localPayload === null ? 'delete' : 'upsert';
    this.db().run(
      `INSERT INTO "_SyncOutbox" (
        "operationId", "entityType", "entityId", "operation", "baseVersion",
        "schemaVersion", "payload", "createdAt"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operationId,
        conflict.entityType,
        conflict.entityId,
        operation,
        conflict.remoteVersion,
        definition.schemaVersion,
        conflict.localPayload === null ? null : JSON.stringify(conflict.localPayload),
        new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
    };
    this.db().exec('BEGIN IMMEDIATE');
    try {
      this.setCaptureSuppressed(true);
      this.applyRemoteChange(change);
      this.db().run(
        `DELETE FROM "_SyncDirty" WHERE "entityType" = ? AND "entityId" = ?`,
        [conflict.entityType, conflict.entityId],
      );
      this.db().run(
        `DELETE FROM "_SyncOutbox" WHERE "entityType" = ? AND "entityId" = ?`,
        [conflict.entityType, conflict.entityId],
      );
      this.deleteConflict(conflict);
      this.setCaptureSuppressed(false);
      this.db().exec('COMMIT');
    } catch (error) {
      this.db().exec('ROLLBACK');
      throw error;
    }
    this.updateConflictCount();
    this.dbProvider.requestPersist();
  }

  private async runSync(): Promise<void> {
    const vaultId = this.vaultId;
    if (!vaultId) return;
    this.syncing.set(true);

    await this.syncPendingBlobs(vaultId, 'pending');
    this.prepareOutbox();
    await this.pushAll(vaultId);
    await this.syncPendingBlobs(vaultId, 'delete');
    await this.pullAll(vaultId);

    await this.assetResolver.hydrateImages(vaultId);
    await this.assetResolver.hydrateCanonicalReferences(vaultId);
    this.retryAttempt = 0;
    this.auth.clearError();
    const timestamp = new Date().toISOString();
    this.lastSyncAt.set(timestamp);
    this.setState('lastSyncAt', timestamp);
    this.updateConflictCount();
    this.dbProvider.requestPersist();
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
          if (!bytes) throw new Error(`Arquivo local n??o encontrado para o blob ${blobId}.`);
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
        const message = error instanceof Error ? error.message : 'Falha ao sincronizar o arquivo.';
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
      SELECT dirty."entityType", dirty."entityId", dirty."operation"
      FROM "_SyncDirty" dirty
      WHERE NOT EXISTS (
        SELECT 1 FROM "_SyncOutbox" outbox
        WHERE outbox."entityType" = dirty."entityType"
          AND outbox."entityId" = dirty."entityId"
      )
      ORDER BY dirty."changedAt"
    `));
    if (!dirtyRows.length) return;

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const dirty of dirtyRows) {
        const entityType = String(dirty['entityType']);
        const entityId = String(dirty['entityId']);
        const operation = dirty['operation'] as 'upsert' | 'delete';
        const definition = getSyncEntity(entityType);
        const payload = operation === 'delete' ? null : this.localPayload(definition, entityId);
        const baseVersion = scalar(
          db.exec(
            `SELECT "version" FROM "_SyncVersions" WHERE "entityType" = ? AND "entityId" = ?`,
            [entityType, entityId],
          ),
        );
        db.run(
          `INSERT INTO "_SyncOutbox" (
            "operationId", "entityType", "entityId", "operation", "baseVersion",
            "schemaVersion", "payload", "createdAt"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            entityType,
            entityId,
            operation,
            baseVersion === undefined ? null : String(baseVersion),
            definition.schemaVersion,
            payload === null ? null : JSON.stringify(payload),
            new Date().toISOString(),
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

  private async pushAll(vaultId: string): Promise<void> {
    while (true) {
      const batch = rows(this.db().exec(`
        SELECT * FROM "_SyncOutbox" ORDER BY "createdAt" LIMIT 100
      `));
      if (!batch.length) return;
      const operations: SyncPushOperation[] = batch.map(row => ({
        operationId: String(row['operationId']),
        entityType: String(row['entityType']),
        entityId: String(row['entityId']),
        operation: row['operation'] as 'upsert' | 'delete',
        baseVersion: row['baseVersion'] === null ? null : String(row['baseVersion']),
        schemaVersion: Number(row['schemaVersion']),
        ...(row['payload'] === null ? {} : { payload: parseJson(row['payload']) ?? {} }),
      }));
      const response = await this.api.push(vaultId, operations);
      this.applyPushResults(response.results, batch);
      this.dbProvider.requestPersist();
    }
  }

  private applyPushResults(results: SyncPushResult[], batch: Record<string, SqlValue>[]): void {
    const db = this.db();
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const result of results) {
        const outbox = batch.find(row => row['operationId'] === result.operationId);
        if (!outbox) continue;
        if (result.status === 'conflict') {
          db.run(
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
        } else {
          this.setKnownVersion(result.entityType, result.entityId, result.version);
        }
        db.run(`DELETE FROM "_SyncOutbox" WHERE "operationId" = ?`, [result.operationId]);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  private async pullAll(vaultId: string): Promise<void> {
    let cursor = this.getState('cursor') ?? '0';
    while (true) {
      const response = await this.api.changes(vaultId, cursor);
      if (response.changes.length) {
        this.applyRemoteBatch(response.changes);
        cursor = response.cursor;
        this.setState('cursor', cursor);
        this.dbProvider.requestPersist();
      }
      if (!response.hasMore || response.changes.length === 0) return;
    }
  }

  private applyRemoteBatch(changes: RemoteSyncChange[]): void {
    const db = this.db();
    db.exec('BEGIN IMMEDIATE');
    try {
      this.setCaptureSuppressed(true);
      for (const change of changes) {
        const hasLocalChange = Number(scalar(db.exec(`
          SELECT EXISTS(
            SELECT 1 FROM "_SyncDirty" WHERE "entityType" = ? AND "entityId" = ?
            UNION ALL
            SELECT 1 FROM "_SyncOutbox" WHERE "entityType" = ? AND "entityId" = ?
          )
        `, [change.entityType, change.entityId, change.entityType, change.entityId])) ?? 0) === 1;
        if (hasLocalChange) {
          const definition = getSyncEntity(change.entityType);
          const localPayload = this.localPayload(definition, change.entityId);
          db.run(
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
              change.entityType,
              change.entityId,
              change.operation,
              localPayload === null ? null : JSON.stringify(localPayload),
              change.payload === null ? null : JSON.stringify(change.payload),
              change.version,
              new Date().toISOString(),
            ],
          );
          continue;
        }
        this.applyRemoteChange(change);
      }
      this.setCaptureSuppressed(false);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  private applyRemoteChange(change: RemoteSyncChange): void {
    const definition = getSyncEntity(change.entityType);
    if (change.operation === 'delete') {
      this.db().run(
        `DELETE FROM ${quoteIdentifier(change.entityType)} WHERE ${quoteIdentifier(definition.primaryKey)} = ?`,
        [change.entityId],
      );
    } else if (change.payload) {
      this.upsertRemotePayload(definition, change.entityId, change.payload);
    }
    this.setKnownVersion(change.entityType, change.entityId, change.version);
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

  private async prepareFirstLink(vaultId: string): Promise<void> {
    const currentVault = this.getState('vaultId');
    const currentUser = this.getState('userId');
    const userId = this.auth.user()?.id;
    if (currentVault === vaultId && currentUser === userId) return;

    const summary = this.localSummary();
    const localCount = Object.values(summary).reduce((total, value) => total + value, 0);
    const status = await this.api.status(vaultId);
    if (localCount > 0 && isElectronRuntime()) {
      const isNewAccount = Boolean(currentUser && currentUser !== userId);
      const message = [
        isNewAccount
          ? 'Este banco local estava vinculado a outra conta. Criar um novo vínculo?'
          : 'Enviar o conteúdo local para a nuvem?',
        `Entidades: ${localCount}`,
        `Imagens: ${summary['Image'] ?? 0}`,
        `Registros já existentes na nuvem: ${status.recordCount}`,
        'IDs iguais com conteúdo diferente serão enviados para resolução de conflito.',
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
        db.exec(`
          INSERT INTO "_SyncDirty" ("entityType", "entityId", "operation", "changedAt")
          SELECT ${quoteLiteral(definition.entityType)},
                 CAST(${quoteIdentifier(definition.primaryKey)} AS TEXT),
                 'upsert',
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          FROM ${quoteIdentifier(definition.entityType)}
          WHERE 1
          ON CONFLICT("entityType", "entityId") DO UPDATE SET
            "operation" = 'upsert', "changedAt" = excluded."changedAt"
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
    this.updateConflictCount();
  }

  private updateConflictCount(): void {
    this.conflictCount.set(Number(scalar(this.db().exec(
      `SELECT COUNT(*) FROM "_SyncConflicts"`,
    )) ?? 0));
  }

  private scheduleDebounced(): void {
    if (!this.canSync()) return;
    if (this.debounceTimerId !== null) window.clearTimeout(this.debounceTimerId);
    this.debounceTimerId = window.setTimeout(() => {
      this.debounceTimerId = null;
      void this.syncNow();
    }, 1_000);
  }

  private scheduleRetry(): void {
    if (!this.canSync()) return;
    if (this.retryTimerId !== null) window.clearTimeout(this.retryTimerId);
    const baseDelay = Math.min(300_000, 2_000 * 2 ** this.retryAttempt++);
    const jitteredDelay = Math.round(baseDelay * (0.75 + Math.random() * 0.5));
    this.retryTimerId = window.setTimeout(() => {
      this.retryTimerId = null;
      void this.syncNow();
    }, jitteredDelay);
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
