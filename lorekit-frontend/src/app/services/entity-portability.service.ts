import { Injectable } from '@angular/core';
import { DbProvider } from '../database/db-provider.service';
import { EntityExportPlan, planCharacterExport } from '../libs/entity-portability/entity-export.planner';
import { EntityImportPlan, planEntityImport, ImportResolutions, EntityImportDestination, ImportTable, importDestinationFingerprint } from '../libs/entity-portability/entity-import.planner';
import { buildEntityArchive } from '../libs/entity-portability/entity-export.builder';
import { EntityArchive, decodeEntityArchive, encodeEntityArchive } from '../libs/entity-portability/entity-archive.codec';
import { resolveImportContent } from '../libs/entity-portability/entity-import.content';
import { applyEntityImport, EntityImportHost } from '../libs/entity-portability/entity-import.executor';
import { canonicalJson, REFERENCE_TYPES } from '../libs/entity-portability/entity-portability.registry';
import { ENTITY_BUNDLE_LIMITS } from '../models/entity-bundle.model';
import type { DynamicField } from '../models/dynamicfields.model';
import { UiFieldConfigService } from './ui-field-config.service';
import { ImageService } from './image.service';
import { WorkspaceRuntimeService } from './workspace-runtime.service';
import { AuthService } from './auth.service';
import { SyncEngineService } from './sync-engine.service';
import { EntityChangeService } from './entity-change.service';
import { schema } from '../database/schema';

export interface ExportPreview { id: string; name: string; characters: number; documents: number; fields: number; images: number; warnings: string[]; }
export interface ImportPackagePreview { id: string; name: string; characters: number; images: number; manifest: EntityArchive['manifest']; }
interface Session { archive: EntityArchive; db: object; vaultId: string | null; userId: string | null; created: number; plan?: EntityImportPlan; }
const SOURCE_TABLES = new Set(['Character', 'World', 'Personalization', 'Image', 'DynamicFieldValue', 'DynamicField', 'IRPWCharacterSheet', 'Document', 'IRPWCurrency']);
const IMPORT_TABLES = new Set<ImportTable>(['Character', 'Document', 'Personalization', 'Image', 'DynamicFieldValue', 'DynamicField', 'Relationship', 'UiFieldConfig', 'IRPWCharacterSheet', 'IRPWCurrency']);

@Injectable({ providedIn: 'root' })
export class EntityPortabilityService {
  private readonly exports = new Map<string, Session>();
  private readonly imports = new Map<string, Session>();
  private applicationTail: Promise<unknown> = Promise.resolve();
  constructor(private readonly dbProvider: DbProvider, private readonly configs: UiFieldConfigService,
    private readonly images: ImageService, private readonly workspace: WorkspaceRuntimeService,
    private readonly auth: AuthService, private readonly sync: SyncEngineService, private readonly changes: EntityChangeService) {}

  canImport(): boolean { return this.dbProvider.ready() && !this.dbProvider.readOnly() && this.workspace.vault()?.role !== 'viewer'; }
  worlds(): Array<{ id: string; name: string }> { return this.dbProvider.ready() ? this.dbProvider.getCrudHelper().findAll('World') : []; }

  prepareExportV2(table: string, id: string, options: { includeChildren?: boolean; omitUnsupported?: boolean } = {}): EntityExportPlan {
    if (table !== 'Character') throw new Error('A exportação v2 suporta personagens e seus descendentes.');
    if (!this.dbProvider.ready()) throw new Error('O workspace não está disponível.');
    const crud = this.dbProvider.getCrudHelper();
    return planCharacterExport({
      find: ref => { if (!SOURCE_TABLES.has(ref.table)) throw new Error('Tabela fora do escopo de exportação.'); return crud.findById(ref.table, ref.id); },
      relationships: () => crud.findAll('Relationship'), links: () => crud.findAll('Link'),
      canRead: ref => this.dbProvider.ready() && SOURCE_TABLES.has(ref.table),
      layout: characterId => this.configs.getResolvedConfig('Character', characterId),
    }, id, options);
  }

  async createExportPreview(id: string, options: { includeChildren?: boolean; omitUnsupported?: boolean }): Promise<ExportPreview> {
    const state = this.state(); const plan = this.prepareExportV2('Character', id, options);
    const archive = await buildEntityArchive(plan, {
      read: reference => this.images.readEntityAsset(reference),
      label: (type, targetId) => {
        const row = this.reference(type, targetId, plan.worldId); return row ? String(row['name'] || row['title'] || 'Referência externa') : null;
      },
    });
    this.guard(state, false); const key = crypto.randomUUID(); this.limitSessions(this.exports);
    this.exports.set(key, { ...state, archive });
    const warnings = plan.issues.filter(issue => issue.code === 'UNSUPPORTED_DEPENDENCY').map(issue => issue.message);
    if (archive.manifest.entities.some(entity => entity.type === 'IRPWCharacterSheet')) warnings.push('Ironpaw: inventário preservado como snapshots independentes; vínculos de catálogo e favoritos herdados não são copiados.');
    return { id: key, name: String(archive.manifest.entities.find(entity => entity.key === archive.manifest.root.key)!.data['name']),
      characters: archive.manifest.entities.filter(entity => entity.type === 'Character').length, documents: archive.manifest.entities.filter(entity => entity.type === 'Document').length,
      fields: archive.manifest.dynamicFields.length, images: archive.manifest.assets.length, warnings };
  }
  async downloadExport(id: string): Promise<void> {
    const session = this.get(this.exports, id); this.guard(session, false); const bytes = await encodeEntityArchive(session.archive); this.guard(session, false);
    const name = String(session.archive.manifest.entities.find(entity => entity.key === session.archive.manifest.root.key)!.data['name']);
    const filename = `Character-${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').slice(0, 80) || 'personagem'}.lorekit`;
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: 'application/lorekit+zip' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.exports.delete(id);
  }
  async openImportPackage(file: File): Promise<ImportPackagePreview> {
    if (!this.canImport()) throw new Error('Sem permissão de importação neste workspace.');
    if (!file.size || file.size > ENTITY_BUNDLE_LIMITS.packageBytes) throw new Error('O pacote deve ter no máximo 100 MiB.');
    const state = this.state(); const archive = await decodeEntityArchive(new Uint8Array(await file.arrayBuffer())); this.guard(state, true);
    const id = crypto.randomUUID(); this.limitSessions(this.imports); this.imports.set(id, { ...state, archive });
    return { id, name: String(archive.manifest.entities.find(entity => entity.key === archive.manifest.root.key)!.data['name']),
      characters: archive.manifest.entities.filter(entity => entity.type === 'Character').length, images: archive.manifest.assets.length, manifest: archive.manifest };
  }
  async prepareImportPreview(id: string, worldId: string, resolutions: ImportResolutions = {}): Promise<EntityImportPlan> {
    const session = this.get(this.imports, id); this.guard(session, true);
    let plan = planEntityImport(session.archive.manifest, worldId, this.destination(), undefined, { ...resolutions, verifiedAssets: true });
    if (!plan.issues.some(issue => issue.blocking)) plan = await resolveImportContent(plan);
    this.guard(session, true); session.plan = plan; return plan;
  }
  referenceCandidates(type: string, worldId: string): Array<{ id: string; label: string }> {
    if (!REFERENCE_TYPES.has(type)) return [];
    return this.dbProvider.getCrudHelper().findAll(type).filter((row: Record<string, unknown>) => this.reference(type, String(row['id']), worldId))
      .map((row: Record<string, unknown>) => ({ id: String(row['id']), label: String(row['name'] || row['title'] || row['id']) }));
  }
  applyImportPreview(id: string): Promise<string> {
    const result = this.applicationTail.catch(() => undefined).then(async () => {
      const session = this.get(this.imports, id); if (!session.plan) throw new Error('Prepare a prévia antes de importar.'); this.guard(session, true);
      const resume = await this.sync.pauseForEntityImport();
      try {
        const root = await applyEntityImport(session.plan, session.archive, this.host(session));
        this.changes.notifySave('Character', root); return root;
      } finally { resume(); }
    });
    this.applicationTail = result; return result;
  }
  releasePreview(id: string): void { this.exports.delete(id); this.imports.delete(id); }

  private destination(): EntityImportDestination {
    const crud = this.dbProvider.getCrudHelper();
    return { world: id => crud.findById('World', id), canWriteWorld: () => this.canImport(),
      dynamicFields: () => crud.findAll('DynamicField', { entityTable: 'Character' }) as DynamicField[],
      idExists: (table, id) => Boolean(crud.findById(table, id)), reference: (type, id, world) => this.reference(type, id, world) };
  }
  private reference(type: string, id: string, worldId: string, visited = new Set<string>()): Record<string, unknown> | null {
    if (!REFERENCE_TYPES.has(type) || !this.dbProvider.ready()) return null;
    const crud = this.dbProvider.getCrudHelper(); const row = crud.findById(type, id); if (!row) return null;
    if (type === 'World') return id === worldId ? row : null;
    const key = `${type}:${id}`; if (visited.has(key) || visited.size > 64) return null; visited.add(key);
    const worldEdges = crud.findAll('Relationship', { parentTable: 'World', entityTable: type, entityId: id });
    if (worldEdges.length) return worldEdges.length === 1 && worldEdges[0].parentId === worldId ? row : null;
    if (type === 'IRPWVocation' || type === 'IRPWCurrency') return row; // Explicit selection from the workspace-global catalog.
    if (type === 'Document') {
      const owners = crud.findAll('Relationship', { entityTable: type, entityId: id }).filter((edge: { parentTable: string }) => ['Character', 'Document'].includes(edge.parentTable));
      if (owners.length === 1 && this.reference(owners[0].parentTable, owners[0].parentId, worldId, visited)) return row;
    }
    return null;
  }
  private state(): Omit<Session, 'archive'> {
    if (!this.dbProvider.ready()) throw new Error('Workspace indisponível.');
    return { db: this.dbProvider.getDb(), vaultId: this.workspace.vault()?.id || null, userId: this.auth.user()?.id || null, created: Date.now() };
  }
  private guard(session: Omit<Session, 'archive'>, write: boolean): void {
    if (!this.dbProvider.ready() || this.dbProvider.getDb() !== session.db || (this.workspace.vault()?.id || null) !== session.vaultId || (this.auth.user()?.id || null) !== session.userId) throw new Error('O workspace mudou. Abra o pacote novamente.');
    if (write && !this.canImport()) throw new Error('Sem permissão de escrita.');
  }
  private get(map: Map<string, Session>, id: string): Session { const session = map.get(id); if (!session || Date.now() - session.created > 30 * 60 * 1000) { map.delete(id); throw new Error('A prévia expirou. Abra o arquivo novamente.'); } return session; }
  private limitSessions(map: Map<string, Session>): void { while (map.size >= 3) map.delete(map.keys().next().value!); }

  private host(session: Session): EntityImportHost {
    const db = this.dbProvider.getDb(); const crud = this.dbProvider.getCrudHelper(); const provider = this.dbProvider;
    const persist = async () => { this.guard(session, true); await provider.flushPendingWrites(); };
    return {
      identity: provider, guard: () => this.guard(session, true),
      fresh: plan => {
        this.guard(session, true); const destination = this.destination(); const world = destination.world(plan.destinationWorldId);
        if (!world) throw new Error('O mundo de destino foi removido.'); const references: Record<string, unknown> = {};
        for (const ref of plan.bundle.externalReferences) {
          const target = plan.resolutions.references?.[ref.key]; if (!target) continue;
          const row = destination.reference!(ref.targetType, target, plan.destinationWorldId); if (!row) throw new Error('Referência de destino mudou.'); references[ref.key] = row;
        }
        if (canonicalJson({ base: importDestinationFingerprint(world, destination.dynamicFields()), references }) !== plan.destinationFingerprint) throw new Error('O destino mudou desde a prévia. Gere uma nova prévia.');
        for (const row of plan.rows) if (!IMPORT_TABLES.has(row.table) || crud.findById(row.table, row.id)) throw new Error('Identidade já existente ou tabela não permitida.');
      },
      receipt: id => { const row = db.exec('SELECT "rootId", "digest" FROM "_EntityImportReceipts" WHERE "operationId" = ?', [id])[0]?.values[0]; return row ? { rootId: String(row[0]), digest: String(row[1]) } : null; },
      rootExists: id => Boolean(crud.findById('Character', id)),
      journal: (id, state, ids) => { db.run('INSERT INTO "_AssetOperations" ("operationId", "state", "assetIds", "createdAt") VALUES (?, ?, ?, ?) ON CONFLICT("operationId") DO UPDATE SET "state" = excluded."state", "assetIds" = excluded."assetIds"', [id, state, JSON.stringify(ids), new Date().toISOString()]); provider.requestPersist(); },
      clearJournal: id => { db.run('DELETE FROM "_AssetOperations" WHERE "operationId" = ?', [id]); provider.requestPersist(); }, persist,
      stage: async (metadata, bytes, blobId, operationId) => this.images.stageEntityAsset({ bytes, mimeType: metadata.mimeType, sha256: metadata.sha256 }, blobId, operationId),
      cleanup: async blobId => {
        this.guard(session, true); const path = db.exec('SELECT "localPath" FROM "_BlobOutbox" WHERE "blobId" = ?', [blobId])[0]?.values[0]?.[0];
        await this.images.cleanupStagedAsset({ blobId, localPath: typeof path === 'string' ? path : null }); provider.requestPersist();
      },
      transaction: fn => provider.runInTransaction(async () => { fn(); provider.requestPersist(); }),
      insert: row => {
        if (!IMPORT_TABLES.has(row.table)) throw new Error('Tabela não permitida.');
        const columns = new Set(schema.find(table => table.name === row.table)!.columns.map(column => column.name));
        const data = { ...row.data, id: row.id }; const keys = Object.keys(data);
        if (keys.some(key => !columns.has(key)) || Object.values(data).some(value => value !== null && !['string', 'number'].includes(typeof value))) throw new Error('Payload de escrita inválido.');
        db.run(`INSERT INTO "${row.table}" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(data) as Array<string | number | null>);
      },
      saveReceipt: (id, root, digest) => db.run('INSERT INTO "_EntityImportReceipts" ("operationId", "rootId", "digest", "createdAt") VALUES (?, ?, ?, ?)', [id, root, digest, new Date().toISOString()]),
    };
  }
}
