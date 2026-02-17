import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { ElectronSafeAPI, persistDbToDisk } from '../database/database.helper';
import { schema } from '../database/schema';

type EntityRef = { table: string; id: string };

type LorekitImageBundle = {
  imageId: string;
  dataBase64: string;
  originalPath?: string;
  extension?: string;
};

type LorekitBundle = {
  format: 'lorekit-entity-bundle';
  version: 1;
  exportedAt: string;
  rootEntity: EntityRef;
  includedEntityTypes: string[];
  entitiesByTable: Record<string, Record<string, any>[]>;
  images: LorekitImageBundle[];
};

@Injectable({
  providedIn: 'root'
})
export class EntityTransferService {
  constructor(private dbProvider: DbProvider) {}

  private get db() {
    return this.dbProvider.getDb<any>();
  }

  async exportEntityBundle(table: string, id: string): Promise<void> {
    const root = this.findRowByEntityRef({ table, id });
    if (!root) {
      throw new Error('Entidade não encontrada para exportação.');
    }

    const { entitiesByTable, relationshipRows } = this.collectConnectedGraph({ table, id });
    const images = await this.collectImageBundles(entitiesByTable['Image'] || []);

    if (relationshipRows.length) {
      entitiesByTable['Relationship'] = relationshipRows;
    }

    const bundle: LorekitBundle = {
      format: 'lorekit-entity-bundle',
      version: 1,
      exportedAt: new Date().toISOString(),
      rootEntity: { table, id },
      includedEntityTypes: Object.keys(entitiesByTable).sort(),
      entitiesByTable,
      images,
    };

    const baseName = (root['name'] || root['title'] || id || 'entity').toString();
    const fileName = `${table}-${this.sanitizeFileName(baseName)}.lorekit`;
    this.downloadTextFile(fileName, JSON.stringify(bundle, null, 2), 'application/lorekit+json');
  }

  async importBundleFromFile(file: File): Promise<EntityRef> {
    const text = await file.text();

    let bundle: LorekitBundle;
    try {
      bundle = JSON.parse(text) as LorekitBundle;
    } catch {
      throw new Error('Arquivo inválido: não foi possível interpretar o JSON.');
    }

    this.validateBundle(bundle);

    const existingColumnsCache = new Map<string, Set<string>>();
    const primaryKeyCache = new Map<string, string>();
    const imagePayloadById = new Map<string, LorekitImageBundle>((bundle.images || []).map(img => [img.imageId, img]));

    this.db.exec('BEGIN');
    try {
      const tables = Object.keys(bundle.entitiesByTable || {});
      const nonRelationshipTables = tables.filter(t => t !== 'Relationship');
      const sortedTables = [...nonRelationshipTables, ...(tables.includes('Relationship') ? ['Relationship'] : [])];

      for (const table of sortedTables) {
        const rows = bundle.entitiesByTable[table] || [];
        if (!rows.length) continue;

        const existingColumns = this.getExistingColumns(table, existingColumnsCache);
        if (!existingColumns.size) continue;

        const pkColumn = this.getPrimaryKeyColumn(table, primaryKeyCache, existingColumns);

        for (const row of rows) {
          const filteredRow: Record<string, any> = {};
          for (const [k, v] of Object.entries(row || {})) {
            if (existingColumns.has(k)) {
              filteredRow[k] = v;
            }
          }

          if (!Object.keys(filteredRow).length) continue;

          if (table === 'Image') {
            await this.restoreImageFile(filteredRow, bundle.entitiesByTable['Relationship'] || [], imagePayloadById);
          }

          this.upsertRow(table, filteredRow, pkColumn);
        }
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    await persistDbToDisk(this.db);

    return bundle.rootEntity;
  }

  private validateBundle(bundle: any): asserts bundle is LorekitBundle {
    if (!bundle || typeof bundle !== 'object') {
      throw new Error('Arquivo inválido.');
    }
    if (bundle.format !== 'lorekit-entity-bundle' || bundle.version !== 1) {
      throw new Error('Formato de importação não suportado.');
    }
    if (!bundle.rootEntity?.table || !bundle.rootEntity?.id) {
      throw new Error('Arquivo inválido: entidade raiz não encontrada.');
    }
    if (!bundle.entitiesByTable || typeof bundle.entitiesByTable !== 'object') {
      throw new Error('Arquivo inválido: conteúdo de entidades ausente.');
    }
  }

  private collectConnectedGraph(root: EntityRef) {
    const queued: EntityRef[] = [root];
    const visited = new Set<string>();
    const entityIdsByTable = new Map<string, Set<string>>();
    const relationshipRowsById = new Map<string, Record<string, any>>();

    while (queued.length > 0) {
      const current = queued.shift()!;
      const currentKey = this.nodeKey(current.table, current.id);
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      if (!entityIdsByTable.has(current.table)) {
        entityIdsByTable.set(current.table, new Set());
      }
      entityIdsByTable.get(current.table)!.add(current.id);

      const relRows = this.selectRows(
        `SELECT * FROM "Relationship" WHERE (parentTable = ? AND parentId = ?) OR (entityTable = ? AND entityId = ?)`,
        [current.table, current.id, current.table, current.id]
      );

      for (const rel of relRows) {
        const relKey = (rel['id'] || `${rel['parentTable']}|${rel['parentId']}|${rel['entityTable']}|${rel['entityId']}`).toString();
        relationshipRowsById.set(relKey, rel);

        const neighbor = rel['parentTable'] === current.table && rel['parentId'] === current.id
          ? { table: rel['entityTable'], id: rel['entityId'] }
          : { table: rel['parentTable'], id: rel['parentId'] };

        if (!neighbor.table || !neighbor.id) continue;
        if (!this.tableExistsInSchema(neighbor.table)) continue;

        const neighborKey = this.nodeKey(neighbor.table, neighbor.id);
        if (!visited.has(neighborKey)) {
          queued.push(neighbor);
        }
      }
    }

    const entitiesByTable: Record<string, Record<string, any>[]> = {};
    for (const [table, ids] of entityIdsByTable.entries()) {
      if (table === 'Relationship') continue;

      const rows: Record<string, any>[] = [];
      for (const id of ids) {
        const row = this.findRowByEntityRef({ table, id });
        if (row) rows.push(row);
      }

      if (rows.length) {
        entitiesByTable[table] = rows;
      }
    }

    return {
      entitiesByTable,
      relationshipRows: Array.from(relationshipRowsById.values())
    };
  }

  private async collectImageBundles(imageRows: Record<string, any>[]): Promise<LorekitImageBundle[]> {
    const bundles: LorekitImageBundle[] = [];

    for (const img of imageRows) {
      if (!img?.['id'] || !img?.['filePath']) continue;
      const binary = await ElectronSafeAPI.electron.readFile(img['filePath']);
      if (!binary) continue;

      bundles.push({
        imageId: img['id'],
        dataBase64: this.uint8ToBase64(binary),
        originalPath: img['filePath'],
        extension: this.extractExtension(img['filePath'])
      });
    }

    return bundles;
  }

  private async restoreImageFile(
    imageRow: Record<string, any>,
    relationshipRows: Record<string, any>[],
    imagePayloadById: Map<string, LorekitImageBundle>
  ): Promise<void> {
    const imageId = imageRow['id'];
    if (!imageId) return;

    const imagePayload = imagePayloadById.get(imageId);
    if (!imagePayload?.dataBase64) return;

    const rel = relationshipRows.find(r => r['entityTable'] === 'Image' && r['entityId'] === imageId);
    const parentDir = rel?.['parentTable'] ? String(rel['parentTable']).toLowerCase() : 'misc';

    const imageRoot = await ElectronSafeAPI.electron.getImagePath();
    const ext = imagePayload.extension || this.extractExtension(imagePayload.originalPath || '') || 'png';
    const filePath = `${imageRoot}/${parentDir}/imported-${imageId}.${ext}`;

    const binary = this.base64ToUint8(imagePayload.dataBase64);
    await ElectronSafeAPI.electron.writeFile(filePath, binary);

    imageRow['filePath'] = filePath;
  }

  private upsertRow(table: string, row: Record<string, any>, pkColumn: string): void {
    const pkValue = row[pkColumn];
    if (pkValue === undefined || pkValue === null || pkValue === '') return;

    const existsResult = this.db.exec(`SELECT 1 FROM "${table}" WHERE "${pkColumn}" = ? LIMIT 1`, [pkValue]);
    const exists = existsResult.length > 0 && (existsResult[0].values?.length || 0) > 0;

    const columns = Object.keys(row);
    if (!columns.length) return;

    if (exists) {
      const updatableColumns = columns.filter(c => c !== pkColumn);
      if (!updatableColumns.length) return;

      const setClause = updatableColumns.map(c => `"${c}" = ?`).join(', ');
      const values = updatableColumns.map(c => this.toSqlValue(row[c]));

      this.db.run(
        `UPDATE "${table}" SET ${setClause} WHERE "${pkColumn}" = ?`,
        [...values, pkValue]
      );
      return;
    }

    const placeholders = columns.map(() => '?').join(', ');
    this.db.run(
      `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
      columns.map(c => this.toSqlValue(row[c]))
    );
  }

  private findRowByEntityRef(ref: EntityRef): Record<string, any> | null {
    if (!this.tableExistsInSchema(ref.table)) return null;

    const existingColumns = this.getExistingColumns(ref.table);
    if (!existingColumns.size) return null;

    const pkColumn = this.getPrimaryKeyColumn(ref.table, undefined, existingColumns);
    const rows = this.selectRows(
      `SELECT * FROM "${ref.table}" WHERE "${pkColumn}" = ? LIMIT 1`,
      [ref.id]
    );
    return rows[0] || null;
  }

  private selectRows(sql: string, params: any[] = []): Record<string, any>[] {
    const result = this.db.exec(sql, params);
    if (!result.length) return [];

    const cols = result[0].columns;
    return result[0].values.map((row: any[]) => {
      const obj: Record<string, any> = {};
      for (let i = 0; i < cols.length; i++) {
        obj[cols[i]] = row[i];
      }
      return obj;
    });
  }

  private getExistingColumns(table: string, cache?: Map<string, Set<string>>): Set<string> {
    if (cache?.has(table)) {
      return cache.get(table)!;
    }

    const rows = this.selectRows(`PRAGMA table_info("${table}")`);
    const cols = new Set(rows.map(r => r['name']).filter(Boolean));

    if (cache) {
      cache.set(table, cols);
    }

    return cols;
  }

  private getPrimaryKeyColumn(
    table: string,
    cache?: Map<string, string>,
    preloadedColumns?: Set<string>
  ): string {
    if (cache?.has(table)) {
      return cache.get(table)!;
    }

    const rows = this.selectRows(`PRAGMA table_info("${table}")`);
    const pk = rows.find(r => Number(r['pk']) > 0)?.['name'];
    const fallbackColumns = preloadedColumns || this.getExistingColumns(table);
    const resolved = pk || (fallbackColumns.has('id') ? 'id' : Array.from(fallbackColumns)[0]);

    if (cache && resolved) {
      cache.set(table, resolved);
    }

    return resolved;
  }

  private tableExistsInSchema(table: string): boolean {
    return schema.some(s => s.name === table);
  }

  private toSqlValue(v: any) {
    return v === undefined ? null : v;
  }

  private nodeKey(table: string, id: string): string {
    return `${table}::${id}`;
  }

  private extractExtension(path: string): string | undefined {
    const normalized = (path || '').replace(/\\/g, '/');
    const lastDot = normalized.lastIndexOf('.');
    if (lastDot < 0 || lastDot === normalized.length - 1) return undefined;
    return normalized.substring(lastDot + 1).toLowerCase();
  }

  private sanitizeFileName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'entity';
  }

  private downloadTextFile(fileName: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
