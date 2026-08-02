import initSqlJs from 'sql.js/dist/sql-wasm.js';
import type { Database, SqlValue } from 'sql.js';
import { ensureSchema } from './database.helper';
import { LOCAL_SCHEMA_VERSION, runLocalMigrations } from './local-migrations';
import { SYNC_ENTITIES } from './sync-entity-registry';

describe('local database migrations', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;

  beforeAll(async () => {
    SQL = await initSqlJs({ locateFile: file => `assets/${file}` });
  });

  it('preserves unknown legacy columns and removes only the known invalid table', () => {
    const db = new SQL.Database();
    db.exec(`
      CREATE TABLE "World" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "legacyColumn" TEXT
      );
      CREATE TABLE "" ("id" TEXT NOT NULL PRIMARY KEY);
    `);

    ensureSchema(db);
    runLocalMigrations(db);

    const worldColumns = columnNames(db, 'World');
    expect(worldColumns).toContain('legacyColumn');
    expect(worldColumns).toContain('theme');
    expect(worldColumns).toContain('concept');
    expect(scalar(db, `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ''`)).toBe(0);
    expect(Number(scalar(
      db,
      `SELECT "value" FROM "_SchemaMetadata" WHERE "key" = 'schemaVersion'`,
    ))).toBe(LOCAL_SCHEMA_VERSION);
  });

  it('captures every synchronizable entity and respects remote-apply suppression', () => {
    const db = new SQL.Database();
    ensureSchema(db);
    runLocalMigrations(db);

    expect(Number(scalar(
      db,
      `SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name LIKE '_sync_%'`,
    ))).toBe(SYNC_ENTITIES.length * 3);

    db.run(
      `INSERT INTO "World" ("id", "name", "description") VALUES (?, ?, ?)`,
      ['world-1', 'Mundo', 'Descrição'],
    );

    const dirty = db.exec(
      `SELECT "entityType", "entityId", "operation" FROM "_SyncDirty"`,
    )[0].values[0];
    expect(dirty).toEqual(['World', 'world-1', 'upsert']);

    db.exec(`UPDATE "_SyncControl" SET "suppressCapture" = 1 WHERE "id" = 1`);
    db.run(
      `INSERT INTO "LocationCategory" ("id", "name") VALUES (?, ?)`,
      ['category-1', 'Região'],
    );
    expect(Number(scalar(db, `SELECT COUNT(*) FROM "_SyncDirty"`))).toBe(1);
  });

  it('uses key as the GlobalParameter identity and coalesces updates', () => {
    const db = new SQL.Database();
    ensureSchema(db);
    runLocalMigrations(db);

    db.run(
      `INSERT INTO "GlobalParameter" ("key", "Value") VALUES (?, ?)`,
      ['theme', 'dark'],
    );
    db.run(`UPDATE "GlobalParameter" SET "Value" = ? WHERE "key" = ?`, ['light', 'theme']);

    const dirty = db.exec(
      `SELECT "entityId", "operation" FROM "_SyncDirty" WHERE "entityType" = 'GlobalParameter'`,
    )[0].values;
    expect(dirty).toEqual([['theme', 'upsert']]);
  });
});

function columnNames(db: Database, tableName: string): string[] {
  const result = db.exec(`PRAGMA table_info("${tableName}")`)[0];
  const nameIndex = result.columns.indexOf('name');
  return result.values.map(row => String(row[nameIndex]));
}

function scalar(db: Database, sql: string): SqlValue | undefined {
  return db.exec(sql)[0]?.values[0]?.[0];
}
