import initSqlJs from 'sql.js/dist/sql-wasm.js';

type ColumnDef = { name: string; def: string };
type TableDef = {
  name: string;
  columns: ColumnDef[];
  fks?: string[];
  indexes?: string[];
};

type IncludeDef = {table:string, firstOnly?: boolean};

declare const window: any;

export const ElectronSafeAPI = {
  get electron() {
    return window?.electronAPI ?? {
      // fallback para web: mock simples
      getDbPath: async () => 'browser-mode.db',
      readFile: async () => null,
      writeFile: async () => null
    };
  }
};

const schema: TableDef[] = [
  {
    name: "World",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "theme",       def: `"theme" TEXT` },
      { name: "concept",     def: `"concept" TEXT` },
    ]
  },
  {
    name: "Character",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "personality", def: `"personality" TEXT NOT NULL` },
      { name: "concept",     def: `"concept" TEXT` }
    ]
  },
  {
    name: "LocationCategory",
    columns: [
      { name: "id",   def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name", def: `"name" TEXT NOT NULL` },
    ]
  },
  {
    name: "Location",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "concept",     def: `"concept" TEXT` }
    ]
  },
  {
    name: "Item",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "concept",     def: `"concept" TEXT` },
    ]
  },
  {
    name: "Document",
    columns: [
      { name: "id",      def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "title",   def: `"title" TEXT NOT NULL` },
      { name: "content", def: `"content" TEXT NOT NULL` },
      { name: "type",    def: `"type" TEXT` },
    ]
  },
  {
    name: "Personalization",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "contentJson", def: `"contentJson" TEXT NOT NULL` }
    ]
  },
  {
    name: "Image",
    columns: [
      { name: "id",       def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "usageKey", def: `"usageKey" TEXT NOT NULL` },
      { name: "filePath", def: `"filePath" TEXT NOT NULL` },
    ]
  },
  {
    name: "Relationship",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "parentTable", def: `"parentTable" TEXT NOT NULL` },
      { name: "parentId",    def: `"parentId" TEXT NOT NULL` },
      { name: "entityTable", def: `"entityTable" TEXT NOT NULL` },
      { name: "entityId",    def: `"entityId" TEXT NOT NULL` },
    ]
  }
];

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
  await persistDb(db);

  return db;
}

async function persistDb(db: any) {
  try {
    const dbPath = await ElectronSafeAPI.electron.getDbPath();
    const binary = db.export();
    await ElectronSafeAPI.electron.writeFile(dbPath, binary);
  } catch (e) {
    console.error('Failed to persist DB', e);
  }
}

function ensureSchema(db: any) {
  for (const t of schema) {
    db.exec(buildCreateTableSQL(t));

    const existing = getExistingColumns(db, t.name);
    for (const col of t.columns) {
      if (!existing.has(col.name)) {
        db.exec(`ALTER TABLE "${t.name}" ADD COLUMN ${col.def}`);
      }
    }

    if (t.indexes) for (const idx of t.indexes) db.exec(idx);
  }
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
  private debugging: boolean = true;
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

    void persistDb(this.db);
    return data;
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

    void persistDb(this.db);
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

    void persistDb(this.db);
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

    void persistDb(this.db);
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
      const relSql = `
        SELECT entityTable, entityId
        FROM "Relationship"
        WHERE parentTable = ? AND parentId = ? AND entityTable = ?
      `;
      if(this.debugging){
        console.log(relSql, [table, id, relTable.table]);
      }
      const relRes = this.db.exec(relSql, [table, id, relTable.table]);
      const relRows = mapResult(relRes);


      const entities = [];
      for (const r of relRows) {
        const dataSql = `SELECT * FROM "${r.entityTable}" WHERE id = ?`;
        if(this.debugging){
          console.log(dataSql, [r.entityId]);
        }
        const dataRes = this.db.exec(dataSql, [r.entityId]);
        entities.push(...mapResult(dataRes));
      }
      if (relTable.firstOnly) {
        results[relTable.table] = entities[0] || null;
      } else {
        results[relTable.table + 's'] = entities;
      }
    }
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
