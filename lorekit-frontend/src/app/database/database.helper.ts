import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { schema, TableDef } from './schema';

type IncludeDef = {table:string, firstOnly?: boolean, isParent?: boolean};


type SqlMigration = {
  id: string;
  kind: 'sql';
  sql: string | string[];
};

type TsMigration = {
  id: string;
  kind: 'ts';
  run: (db: any) => void;
};

export type PluginMigration = SqlMigration | TsMigration;

export type PluginMigrationBundle = {
  pluginId: string;
  migrations: PluginMigration[];
};

const ALLOW_DESTRUCTIVE_MIGRATIONS = false;
const PLUGIN_STATUS_READY = 'ready';
const PLUGIN_STATUS_FAILED = 'failed';

declare const window: any;

export const ElectronSafeAPI = {
  get electron() {
    return window?.electronAPI ?? {
      // fallback para web: mock simples
      getDbPath: async () => 'browser-mode.db',
      getImagePath: async () => 'browser-images',
      readFile: async () => null,
      writeFile: async () => null
    };
  }
};

export async function openDbAndEnsureSchema() {
  const SQL = await initSqlJs({
    locateFile: (file) => `assets/${file}`,
  });

  // AGORA aguardando IPC/bridge corretamente
  const dbPath = await ElectronSafeAPI.electron.getDbPath();
  const data: Uint8Array | null = await ElectronSafeAPI.electron.readFile(dbPath);

  const db = data ? new SQL.Database(new Uint8Array(data)) : new SQL.Database();
  db.exec("PRAGMA foreign_keys = ON");

  ensureSchema(db);

  // garante que o arquivo inicial existe/atualiza schema no disco
  await persistDbToDisk(db);

  return db;
}

export async function persistDbToDisk(db: any) {
  try {
    const dbPath = await ElectronSafeAPI.electron.getDbPath();
    const binary = db.export();
    await ElectronSafeAPI.electron.writeFile(dbPath, binary);
  } catch (e) {
    console.error('Failed to persist DB', e);
  }
}

function ensureSchema(db: any) {
  runCoreMigrations(db);
}

function runCoreMigrations(db: any) {
  for (const t of schema) {
    db.exec(buildCreateTableSQL(t));

    const existing = getExistingColumns(db, t.name);
    const schemaColumns = new Set(t.columns.map(c => c.name));

    for (const col of t.columns) {
      if (!existing.has(col.name)) {
        db.exec(`ALTER TABLE "${t.name}" ADD COLUMN ${col.def}`);
      }
    }

    const columnsToRemove = Array.from(existing).filter(col => !schemaColumns.has(col));
    if (columnsToRemove.length > 0) {
      if (!ALLOW_DESTRUCTIVE_MIGRATIONS) {
        console.warn(
          `Skipping destructive core migration on "${t.name}". Columns not in schema: ${columnsToRemove.join(', ')}. ` +
          `Enable ALLOW_DESTRUCTIVE_MIGRATIONS with backup strategy to allow DROP COLUMN.`
        );
      } else {
        backupTableBeforeDestructiveChange(db, t.name);
        for (const col of columnsToRemove) {
          db.exec(`ALTER TABLE "${t.name}" DROP COLUMN "${col}"`);
        }
      }
    }

    if (t.indexes) for (const idx of t.indexes) db.exec(idx);

    if (t.insertCommands) {
      for (const cmd of t.insertCommands) {
        try {
          db.exec(cmd);
        } catch (e) {
          console.log(`Insert command skipped (probably already exists): ${cmd}`);
        }
      }
    }
  }
}

export function runPluginMigrations(db: any, bundle: PluginMigrationBundle) {
  ensurePluginRuntimeStateTable(db);
  ensurePluginMigrationHistoryTable(db);

  const orderedMigrations = [...bundle.migrations].sort((a, b) => a.id.localeCompare(b.id));

  for (const migration of orderedMigrations) {
    if (hasPluginMigrationBeenApplied(db, bundle.pluginId, migration.id)) {
      continue;
    }

    try {
      db.exec('BEGIN');
      executePluginMigration(db, migration);
      recordAppliedPluginMigration(db, bundle.pluginId, migration.id);
      markPluginStatus(db, bundle.pluginId, PLUGIN_STATUS_READY, true);
      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch (_) {
        // no-op: rollback best effort
      }

      markPluginStatus(db, bundle.pluginId, PLUGIN_STATUS_FAILED, false, String(error));
      throw new Error(`Plugin migration failed for plugin "${bundle.pluginId}" on migration "${migration.id}": ${String(error)}`);
    }
  }
}

function executePluginMigration(db: any, migration: PluginMigration) {
  if (migration.kind === 'sql') {
    const sqlCommands = Array.isArray(migration.sql) ? migration.sql : [migration.sql];

    for (const sql of sqlCommands) {
      assertSqlMigrationIsSafe(sql);
      db.exec(sql);
    }
    return;
  }

  migration.run(db);
}

function assertSqlMigrationIsSafe(sql: string) {
  const normalized = sql.toUpperCase();
  const hasDropColumn = normalized.includes('DROP COLUMN');
  if (!hasDropColumn) {
    return;
  }

  const hasExplicitStrategy = normalized.includes('/* ALLOW_DESTRUCTIVE */') && normalized.includes('/* BACKUP:');
  if (!hasExplicitStrategy) {
    throw new Error(
      'Destructive plugin migration detected (DROP COLUMN). Provide explicit strategy comments: ' +
      '/* ALLOW_DESTRUCTIVE */ and /* BACKUP:<table> */.'
    );
  }
}

function ensurePluginRuntimeStateTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "PluginRuntimeState" (
      "pluginId" TEXT NOT NULL PRIMARY KEY,
      "status" TEXT NOT NULL,
      "enabled" INTEGER NOT NULL DEFAULT 0,
      "lastError" TEXT,
      "updatedAt" TEXT NOT NULL
    );
  `);
}

function ensurePluginMigrationHistoryTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "PluginMigrationHistory" (
      "pluginId" TEXT NOT NULL,
      "migrationId" TEXT NOT NULL,
      "appliedAt" TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_plugin_migration_history_unique"
    ON "PluginMigrationHistory" ("pluginId", "migrationId");
  `);
}

function hasPluginMigrationBeenApplied(db: any, pluginId: string, migrationId: string): boolean {
  const result = db.exec(
    `SELECT 1 FROM "PluginMigrationHistory" WHERE "pluginId" = ? AND "migrationId" = ? LIMIT 1`,
    [pluginId, migrationId]
  );
  return result.length > 0 && result[0].values.length > 0;
}

function recordAppliedPluginMigration(db: any, pluginId: string, migrationId: string) {
  db.run(
    `INSERT INTO "PluginMigrationHistory" ("pluginId", "migrationId", "appliedAt") VALUES (?, ?, ?)` ,
    [pluginId, migrationId, new Date().toISOString()]
  );
}

function markPluginStatus(db: any, pluginId: string, status: string, enabled: boolean, lastError: string | null = null) {
  db.run(
    `INSERT INTO "PluginRuntimeState" ("pluginId", "status", "enabled", "lastError", "updatedAt")
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT("pluginId") DO UPDATE SET
      "status" = excluded."status",
      "enabled" = excluded."enabled",
      "lastError" = excluded."lastError",
      "updatedAt" = excluded."updatedAt"`,
    [pluginId, status, enabled ? 1 : 0, lastError, new Date().toISOString()]
  );
}

function backupTableBeforeDestructiveChange(db: any, tableName: string) {
  const backupTable = `${tableName}__backup_before_destructive`;
  db.exec(`CREATE TABLE IF NOT EXISTS "${backupTable}" AS SELECT * FROM "${tableName}"`);
}

function buildCreateTableSQL(t: TableDef) {
  const parts = [...t.columns.map(c => c.def), ...(t.fks ?? [])];
  console.log(`Creating table if not exists "${t.name}" with columns: ${parts.join(", ")}`);
  return `CREATE TABLE IF NOT EXISTS "${t.name}" (\n  ${parts.join(",\n  ")}\n);`;
}

function getExistingColumns(db: any, table: string): Set<string> {
  const res = db.exec(`PRAGMA table_info("${table}")`);
  if (!res.length) return new Set();
  const cols = res[0];
  const idx = cols.columns.indexOf("name");
  return new Set(cols.values.map((row: any[]) => row[idx]));
}

function toSqlValue(v: any) {
  return v === undefined ? null : v;
}


export class CrudHelper {
  private debugging: boolean = false;
  constructor(private db: any) {}

  create(table: string, data: Record<string, any>) {
    const existing = getExistingColumns(this.db, table);

    // garante ID quando a tabela tem coluna 'id'
    if ((!data['id'] || data['id'] === '') && existing.has('id')) {
      data = { ...data, id: crypto.randomUUID() };
    }

    const keys = Object.keys(data).filter(k => existing.has(k));
    if (keys.length === 0) return;

    const values = keys.map(k => toSqlValue(data[k]));
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders})`;

    if(this.debugging){
      console.log(sql, values);
    }

    this.db.run(sql, values);

    void persistDbToDisk(this.db);
    return data;
  }

  updateKey(table: string, key: string, value : string) {
    const sql = `UPDATE "${table}" SET Value = ? WHERE key = ?`;

    if(this.debugging){
      console.log(sql, [value, key]);
    }
    this.db.run(sql, [value, key]);

    void persistDbToDisk(this.db);
  }

  update(table: string, id: string, data: Record<string, any>) {
    const existing = getExistingColumns(this.db, table);
    const keys = Object.keys(data).filter(k => existing.has(k) && k !== 'id');
    if (keys.length === 0) return;

    const setClause = keys.map(k => `"${k}" = ?`).join(', ');
    const values = keys.map(k => toSqlValue(data[k]));
    const sql = `UPDATE "${table}" SET ${setClause} WHERE id = ?`;

    if(this.debugging){
      console.log(sql, [...values, id]);
    }

    this.db.run(sql, [...values, id]);

    void persistDbToDisk(this.db);
    return data;
  }

  deleteWhen(table: string, where: Record<string, any>) {
    const clauses = Object.keys(where).map(k => `"${k}" = ?`);

    if (clauses.length === 0) throw new Error('deleteWhen requires at least one condition');

    const sql = `DELETE FROM "${table}" ${`WHERE ${clauses.join(' AND ')}`}`;

    if(this.debugging){
      console.log(sql, Object.values(where));
    }

    this.db.run(sql, Object.values(where));

    void persistDbToDisk(this.db);
  }

  delete(table: string, id: string, deleteRelatedItems: boolean = false) {
    const relsAsParent = mapResult(
      this.db.exec(
        `SELECT * FROM "Relationship" WHERE parentTable = ? AND parentId = ?`,
        [table, id]
      )
    );

    if (deleteRelatedItems) {
      for (const rel of relsAsParent) {
        this.delete(rel.entityTable, rel.entityId, true);
      }
    }

    this.db.run(`DELETE FROM "Relationship" WHERE parentTable = ? AND parentId = ?`, [table, id]);
    this.db.run(`DELETE FROM "Relationship" WHERE entityTable = ? AND entityId = ?`, [table, id]);

    const sql = `DELETE FROM "${table}" WHERE id = ?`;

    if(this.debugging){
      console.log(sql, [id]);
    }

    this.db.run(sql, [id]);

    void persistDbToDisk(this.db);
  }

  findById(table: string, id: string, include: IncludeDef[] = []) {
    const sql = `SELECT * FROM "${table}" WHERE id = ?`;
    if(this.debugging){
      console.log(sql, [id]);
    }
    const res = this.db.exec(sql, [id]);
    if (!res.length) return null;
    const row = mapResult(res)[0];

    if (include.length) {
      const inc = this.loadIncludes(table, id, include);
      Object.assign(row, inc);
    }
    return row;
  }

  //TODO: Implementar multiplo existsRelation
  findAll(table: string, where: Record<string, any> = {}, include: IncludeDef[] = [], existsRelation?: {parentTable: string, parentId: string}) {
    const clauses = Object.keys(where).map(k => `"${k}" = ?`);
    const sql = `SELECT * FROM "${table}"` + (clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '');
    if(this.debugging){
      console.log(sql, Object.values(where));
    }

    const res = this.db.exec(sql, Object.values(where));
    let rows = mapResult(res);

    if (existsRelation) {
      let rels = this.loadIncludes(existsRelation.parentTable, existsRelation.parentId, [{table: table}]);

      const relIds = new Set((rels[table + 's'] || []).map((r: any) => r.id));

      rows = rows.filter((r:any) => relIds.has(r.id));
    }

    if (include.length) {
      for (const row of rows) {
        const inc = this.loadIncludes(table, row.id, include);
        Object.assign(row, inc);
      }
    }

    return rows;
  }

  findFirst(table: string, where: Record<string, any> = {}, include: IncludeDef[] = []) {
    return this.findAll(table, where, include)[0];
  }

  private loadIncludes(table: string, id: string, include: IncludeDef[]) {
    const results: Record<string, any[]> = {};
    for (const relTable of include) {
      // Normal flow: current (table,id) is the parent; fetch its children in relTable.table
      if (!relTable.isParent) {
        const relSql = `
          SELECT entityTable, entityId
          FROM "Relationship"
          WHERE parentTable = ? AND parentId = ? AND entityTable = ?
        `;
        if (this.debugging) {
          console.log(relSql, [table, id, relTable.table]);
        }
        const relRes = this.db.exec(relSql, [table, id, relTable.table]);
        const relRows = mapResult(relRes);

        const entities: any[] = [];
        for (const r of relRows) {
          const dataSql = `SELECT * FROM "${r.entityTable}" WHERE id = ?`;
          if (this.debugging) {
            console.log(dataSql, [r.entityId]);
          }
          const dataRes = this.db.exec(dataSql, [r.entityId]);
          entities.push(...mapResult(dataRes));
        }
        if (relTable.firstOnly) {
          // Keep existing shape: singular key returns single object (or null)
          results[relTable.table] = entities[0] || null;
        } else {
          results[relTable.table + 's'] = entities;
        }
      } else {
        // Reverse flow: current (table,id) is the child; fetch its PARENT(s) from relTable.table
        const revSql = `
          SELECT parentTable, parentId
          FROM "Relationship"
          WHERE entityTable = ? AND entityId = ? AND parentTable = ?
        `;
        if (this.debugging) {
          console.log(revSql, [table, id, relTable.table]);
        }
        const revRes = this.db.exec(revSql, [table, id, relTable.table]);
        const revRows = mapResult(revRes);

        const parents: any[] = [];
        for (const r of revRows) {
          const parentSql = `SELECT * FROM "${r.parentTable}" WHERE id = ?`;
          if (this.debugging) {
            console.log(parentSql, [r.parentId]);
          }
          const parentRes = this.db.exec(parentSql, [r.parentId]);
          parents.push(...mapResult(parentRes));
        }

        const parentKeyBase = 'Parent' + relTable.table;
        if (relTable.firstOnly) {
          (results as any)[parentKeyBase] = parents[0] || null;
        } else {
          (results as any)[parentKeyBase + 's'] = parents;
        }
      }
    }
    return results;
  }

  public searchInTable(table: string, term: string, columns: string[]) {
    if (!columns.length) {
      return [];
    }
    const likeTerm = `%${term}%`;
    const clauses = columns.map(col => `"${col}" LIKE ?`).join(' OR ');
    const sql = `SELECT * FROM "${table}" WHERE ${clauses}`;

    if(this.debugging){
      console.log(sql, Array(columns.length).fill(likeTerm));
    }

    const stmt = this.db.prepare(sql);
    stmt.bind(Array(columns.length).fill(likeTerm));

    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    return results;
  }
}

function mapResult(res: any) {
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((row: any[]) => {
    const obj: Record<string, any> = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];
    return obj;
  });
}
