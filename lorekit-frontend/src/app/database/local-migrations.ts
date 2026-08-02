import type { BindParams, SqlValue } from 'sql.js';
import { schema, TableDef } from './schema';
import { SYNC_ENTITIES } from './sync-entity-registry';

export const LOCAL_SCHEMA_VERSION = 2;

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
      for (const table of schema) {
        addMissingColumns(db, table);
      }

      // A versão anterior do schema declarava acidentalmente uma tabela vazia.
      // Esta é uma remoção conhecida e versionada, nunca uma inferência automática.
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

  // Triggers são declarativos e podem ser recriados com segurança. Isso também
  // cobre um banco já marcado como v2 após uma atualização do registro.
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

function getExistingColumns(db: SqlDatabase, tableName: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
  if (!result.length) {
    return new Set();
  }

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
      "lastError" TEXT
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
}

function createSyncTriggers(db: SqlDatabase): void {
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
          INSERT INTO "_SyncDirty" (
            "entityType", "entityId", "operation", "changedAt"
          ) VALUES (
            ${quoteLiteral(definition.entityType)},
            CAST(${rowAlias}.${quoteIdentifier(definition.primaryKey)} AS TEXT),
            ${quoteLiteral(operation)},
            strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          )
          ON CONFLICT("entityType", "entityId") DO UPDATE SET
            "operation" = excluded."operation",
            "changedAt" = excluded."changedAt";
        END
      `);
    }
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
