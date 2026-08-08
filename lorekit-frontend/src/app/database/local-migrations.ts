import type { BindParams, SqlValue } from 'sql.js';
import { schema, TableDef } from './schema';
import { SYNC_ENTITIES } from './sync-entity-registry';

export const LOCAL_SCHEMA_VERSION = 3;

interface SqlDatabase {
  exec(sql: string, params?: BindParams): Array<{
    columns: string[];
    values: SqlValue[][];
  }>;
}

interface LocalMigration {
  readonly version: number;
  readonly name: string;
  readonly up: (db: SqlDatabase) => void;
}

const migrations: readonly LocalMigration[] = [
  {
    version: 1,
    name: 'baseline-aditivo-do-schema',
    up: db => {
      for (const table of schema) addMissingColumns(db, table);
      db.exec('DROP TABLE IF EXISTS ""');
    },
  },
  {
    version: 2,
    name: 'infraestrutura-local-de-sincronizacao',
    up: db => {
      createSyncTables(db);
      createSyncTriggers(db);
    },
  },
  {
    version: 3,
    name: 'relogio-lww-e-historico-de-resolucoes',
    up: db => {
      createSyncTables(db);
      backfillRecordClocks(db);
      createSyncTriggers(db);
    },
  },
];

export function runLocalMigrations(db: SqlDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_SchemaMetadata" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL
    )
  `);

  const currentVersion = getCurrentVersion(db);
  const pendingMigrations = migrations.filter(migration => migration.version > currentVersion);

  for (const migration of pendingMigrations) {
    db.exec('BEGIN IMMEDIATE');
    try {
      migration.up(db);
      setMetadata(db, 'schemaVersion', String(migration.version));
      setMetadata(db, 'lastMigration', migration.name);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  if (getCurrentVersion(db) >= 2) {
    createSyncTables(db);
    createSyncTriggers(db);
  }
}

function getCurrentVersion(db: SqlDatabase): number {
  const result = db.exec(
    'SELECT "value" FROM "_SchemaMetadata" WHERE "key" = ?',
    ['schemaVersion'],
  );
  const rawValue = result[0]?.values[0]?.[0];
  const parsedValue = typeof rawValue === 'string' ? Number.parseInt(rawValue, 10) : 0;
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function setMetadata(db: SqlDatabase, key: string, value: string): void {
  db.exec(
    `INSERT INTO "_SchemaMetadata" ("key", "value") VALUES (?, ?)
     ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`,
    [key, value],
  );
}

function addMissingColumns(db: SqlDatabase, table: TableDef): void {
  const existingColumns = getExistingColumns(db, table.name);
  for (const column of table.columns) {
    if (!existingColumns.has(column.name)) {
      db.exec(`ALTER TABLE ${quoteIdentifier(table.name)} ADD COLUMN ${column.def}`);
    }
  }
}

function addColumnIfMissing(db: SqlDatabase, table: string, column: string, definition: string): void {
  if (!getExistingColumns(db, table).has(column)) {
    db.exec(`ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${quoteIdentifier(column)} ${definition}`);
  }
}

function getExistingColumns(db: SqlDatabase, tableName: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
  if (!result.length) return new Set();
  const nameIndex = result[0].columns.indexOf('name');
  return new Set(result[0].values.map(row => String(row[nameIndex])));
}

function createSyncTables(db: SqlDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_SyncControl" (
      "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
      "suppressCapture" INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO "_SyncControl" ("id", "suppressCapture") VALUES (1, 0);

    CREATE TABLE IF NOT EXISTS "_SyncDirty" (
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "operation" TEXT NOT NULL CHECK ("operation" IN ('upsert', 'delete')),
      "changedAt" TEXT NOT NULL,
      PRIMARY KEY ("entityType", "entityId")
    );

    CREATE TABLE IF NOT EXISTS "_SyncOutbox" (
      "operationId" TEXT NOT NULL PRIMARY KEY,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "operation" TEXT NOT NULL CHECK ("operation" IN ('upsert', 'delete')),
      "baseVersion" TEXT,
      "schemaVersion" INTEGER NOT NULL,
      "payload" TEXT,
      "createdAt" TEXT NOT NULL,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "modifiedAt" TEXT,
      "changeId" TEXT
    );
    CREATE INDEX IF NOT EXISTS "idx_sync_outbox_created" ON "_SyncOutbox" ("createdAt");

    CREATE TABLE IF NOT EXISTS "_SyncVersions" (
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "version" TEXT NOT NULL,
      PRIMARY KEY ("entityType", "entityId")
    );

    CREATE TABLE IF NOT EXISTS "_SyncState" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL
    );
    INSERT OR IGNORE INTO "_SyncState" ("key", "value") VALUES ('clockOffsetMs', '0');

    CREATE TABLE IF NOT EXISTS "_SyncRecordClock" (
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "operation" TEXT NOT NULL CHECK ("operation" IN ('upsert', 'delete')),
      "modifiedAt" TEXT NOT NULL,
      "changeId" TEXT NOT NULL,
      "capturedOffsetMs" INTEGER NOT NULL DEFAULT 0,
      "source" TEXT NOT NULL CHECK ("source" IN ('local', 'remote')),
      PRIMARY KEY ("entityType", "entityId")
    );

    CREATE TABLE IF NOT EXISTS "_SyncConflicts" (
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "operation" TEXT NOT NULL,
      "localPayload" TEXT,
      "remotePayload" TEXT,
      "remoteVersion" TEXT NOT NULL,
      "detectedAt" TEXT NOT NULL,
      PRIMARY KEY ("entityType", "entityId")
    );

    CREATE TABLE IF NOT EXISTS "_SyncResolutionHistory" (
      "resolutionKey" TEXT NOT NULL PRIMARY KEY,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "winnerOperation" TEXT NOT NULL,
      "winnerPayload" TEXT,
      "winnerModifiedAt" TEXT NOT NULL,
      "winnerChangeId" TEXT NOT NULL,
      "loserOperation" TEXT NOT NULL,
      "loserPayload" TEXT,
      "loserModifiedAt" TEXT NOT NULL,
      "loserChangeId" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "idx_sync_resolution_created" ON "_SyncResolutionHistory" ("createdAt");

    CREATE TABLE IF NOT EXISTS "_SyncResolutionOutbox" (
      "resolutionKey" TEXT NOT NULL PRIMARY KEY,
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT
    );

    CREATE TABLE IF NOT EXISTS "_BlobOutbox" (
      "blobId" TEXT NOT NULL PRIMARY KEY,
      "localPath" TEXT,
      "mimeType" TEXT NOT NULL,
      "originalName" TEXT,
      "sha256" TEXT NOT NULL,
      "state" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TEXT NOT NULL,
      "lastError" TEXT
    );

    CREATE TABLE IF NOT EXISTS "_LocalBlobCache" (
      "blobId" TEXT NOT NULL PRIMARY KEY,
      "cacheKey" TEXT NOT NULL,
      "mimeType" TEXT,
      "sha256" TEXT,
      "updatedAt" TEXT NOT NULL
    );
  `);

  addColumnIfMissing(db, '_SyncOutbox', 'modifiedAt', 'TEXT');
  addColumnIfMissing(db, '_SyncOutbox', 'changeId', 'TEXT');
  db.exec(`
    UPDATE "_SyncOutbox"
    SET
      "modifiedAt" = COALESCE("modifiedAt", CAST(strftime('%s', "createdAt") AS INTEGER) * 1000),
      "changeId" = COALESCE("changeId", lower(hex(randomblob(16))))
    WHERE "modifiedAt" IS NULL OR "changeId" IS NULL
  `);
}

function backfillRecordClocks(db: SqlDatabase): void {
  const offsetExpression = `COALESCE(CAST((SELECT "value" FROM "_SyncState" WHERE "key" = 'clockOffsetMs') AS INTEGER), 0)`;
  const nowExpression = normalizedNowExpression();

  for (const definition of SYNC_ENTITIES) {
    const table = quoteIdentifier(definition.entityType);
    const primaryKey = quoteIdentifier(definition.primaryKey);
    db.exec(`
      INSERT OR IGNORE INTO "_SyncRecordClock" (
        "entityType", "entityId", "operation", "modifiedAt", "changeId", "capturedOffsetMs", "source"
      )
      SELECT
        ${quoteLiteral(definition.entityType)},
        CAST(record.${primaryKey} AS TEXT),
        COALESCE(dirty."operation", 'upsert'),
        CASE
          WHEN dirty."changedAt" IS NOT NULL
            THEN CAST(CAST(strftime('%s', dirty."changedAt") AS INTEGER) * 1000 AS TEXT)
          WHEN versions."version" IS NOT NULL THEN '0'
          ELSE CAST(${nowExpression} AS TEXT)
        END,
        lower(hex(randomblob(16))),
        ${offsetExpression},
        CASE WHEN versions."version" IS NOT NULL AND dirty."changedAt" IS NULL THEN 'remote' ELSE 'local' END
      FROM ${table} record
      LEFT JOIN "_SyncDirty" dirty
        ON dirty."entityType" = ${quoteLiteral(definition.entityType)}
       AND dirty."entityId" = CAST(record.${primaryKey} AS TEXT)
      LEFT JOIN "_SyncVersions" versions
        ON versions."entityType" = ${quoteLiteral(definition.entityType)}
       AND versions."entityId" = CAST(record.${primaryKey} AS TEXT)
    `);
  }

  db.exec(`
    INSERT OR IGNORE INTO "_SyncRecordClock" (
      "entityType", "entityId", "operation", "modifiedAt", "changeId", "capturedOffsetMs", "source"
    )
    SELECT
      dirty."entityType",
      dirty."entityId",
      dirty."operation",
      CAST(CAST(strftime('%s', dirty."changedAt") AS INTEGER) * 1000 AS TEXT),
      lower(hex(randomblob(16))),
      COALESCE(CAST((SELECT "value" FROM "_SyncState" WHERE "key" = 'clockOffsetMs') AS INTEGER), 0),
      'local'
    FROM "_SyncDirty" dirty;

    INSERT OR IGNORE INTO "_SyncRecordClock" (
      "entityType", "entityId", "operation", "modifiedAt", "changeId", "capturedOffsetMs", "source"
    )
    SELECT
      outbox."entityType",
      outbox."entityId",
      outbox."operation",
      outbox."modifiedAt",
      outbox."changeId",
      COALESCE(CAST((SELECT "value" FROM "_SyncState" WHERE "key" = 'clockOffsetMs') AS INTEGER), 0),
      'local'
    FROM "_SyncOutbox" outbox;
  `);
}

function createSyncTriggers(db: SqlDatabase): void {
  const offsetExpression = `COALESCE(CAST((SELECT "value" FROM "_SyncState" WHERE "key" = 'clockOffsetMs') AS INTEGER), 0)`;
  for (const definition of SYNC_ENTITIES) {
    for (const action of ['INSERT', 'UPDATE', 'DELETE'] as const) {
      const suffix = action.toLowerCase();
      const rowAlias = action === 'DELETE' ? 'OLD' : 'NEW';
      const operation = action === 'DELETE' ? 'delete' : 'upsert';
      const triggerName = `_sync_${definition.entityType}_${suffix}`;

      db.exec(`DROP TRIGGER IF EXISTS ${quoteIdentifier(triggerName)}`);
      db.exec(`
        CREATE TRIGGER ${quoteIdentifier(triggerName)}
        AFTER ${action} ON ${quoteIdentifier(definition.entityType)}
        WHEN COALESCE((SELECT "suppressCapture" FROM "_SyncControl" WHERE "id" = 1), 0) = 0
        BEGIN
          INSERT INTO "_SyncRecordClock" (
            "entityType", "entityId", "operation", "modifiedAt", "changeId", "capturedOffsetMs", "source"
          ) VALUES (
            ${quoteLiteral(definition.entityType)},
            CAST(${rowAlias}.${quoteIdentifier(definition.primaryKey)} AS TEXT),
            ${quoteLiteral(operation)},
            CAST(${normalizedNowExpression()} AS TEXT),
            lower(hex(randomblob(16))),
            ${offsetExpression},
            'local'
          )
          ON CONFLICT("entityType", "entityId") DO UPDATE SET
            "operation" = excluded."operation",
            "modifiedAt" = excluded."modifiedAt",
            "changeId" = excluded."changeId",
            "capturedOffsetMs" = excluded."capturedOffsetMs",
            "source" = 'local';

          INSERT INTO "_SyncDirty" ("entityType", "entityId", "operation", "changedAt")
          SELECT "entityType", "entityId", "operation", "modifiedAt"
          FROM "_SyncRecordClock"
          WHERE "entityType" = ${quoteLiteral(definition.entityType)}
            AND "entityId" = CAST(${rowAlias}.${quoteIdentifier(definition.primaryKey)} AS TEXT)
          ON CONFLICT("entityType", "entityId") DO UPDATE SET
            "operation" = excluded."operation",
            "changedAt" = excluded."changedAt";
        END
      `);
    }
  }
}

function normalizedNowExpression(): string {
  return `CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
    + COALESCE(CAST((SELECT "value" FROM "_SyncState" WHERE "key" = 'clockOffsetMs') AS INTEGER), 0)`;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
