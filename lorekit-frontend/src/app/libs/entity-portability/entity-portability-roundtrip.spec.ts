import initSqlJs from 'sql.js/dist/sql-wasm.js';
import type { Database } from 'sql.js';
import { ensureSchema } from '../../database/database.helper';
import { runLocalMigrations, LOCAL_SCHEMA_VERSION } from '../../database/local-migrations';
import { SYNC_ENTITIES, toSyncPayload } from '../../database/sync-entity-registry';
import { planCharacterExport, EntityExportSource } from './entity-export.planner';
import { buildEntityArchive } from './entity-export.builder';
import { EntityArchive, decodeEntityArchive, encodeEntityArchive, encodeStoredZip, decodeStoredZip, sha256 } from './entity-archive.codec';
import { EntityImportDestination, EntityImportPlan, planEntityImport, importDestinationFingerprint } from './entity-import.planner';
import { resolveImportContent } from './entity-import.content';
import { applyEntityImport, EntityImportHost } from './entity-import.executor';
import { canonicalJson } from './entity-portability.registry';
import { normalizeLegacyDynamicValue, validateEntityBundle } from './entity-bundle.validator';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMzwAAAAASUVORK5CYII='), char => char.charCodeAt(0));
const doc = (blocks: unknown[]) => JSON.stringify({ format: 'lorekit-editor', version: 1, blocks });
const paragraph = (content: unknown[]) => ({ type: 'paragraph', content });
const text = (value: string) => ({ kind: 'text', text: value, bold: true });

function fixture(): { source: EntityExportSource; reads: string[] } {
  const rows = new Map<string, Record<string, unknown>>(); const reads: string[] = [];
  const add = (table: string, id: string, data: Record<string, unknown>) => rows.set(`${table}:${id}`, { id, ...data });
  add('World', 'origin-world', { name: 'Origem' });
  add('Character', 'origin-character', { name: 'A', description: doc([paragraph([text('Olá '), { kind: 'mention', entityTable: 'Character', entityId: 'origin-child', label: 'Filho' }, { kind: 'mention', entityTable: 'Species', entityId: 'secret-species-id', label: 'Oculto' }]), { type: 'image', url: 'lorekit-asset://00000000-0000-4000-8000-000000000050', caption: [text('Retrato')], layout: { withBorder: false, withBackground: false, stretched: false, width: 'auto' } }]), age: 24 });
  add('Character', 'origin-child', { name: 'Filho', description: '' }); add('Character', 'unrelated-character', { name: 'SECRET-OTHER', description: 'PRIVATE-OTHER-CONTENT' });
  add('Personalization', 'origin-personalization', { contentJson: '{"icon":"fa-solid fa-user","color":"#34d399"}' });
  add('Image', 'origin-image', { usageKey: 'profile', filePath: '/images/private-source.png', blobId: '00000000-0000-4000-8000-000000000050' });
  add('DynamicField', 'origin-field', { name: 'Força', entityTable: 'Character', fieldType: 'text', isEditorField: 0 });
  add('DynamicField', 'origin-gallery', { name: 'Galeria', entityTable: 'Character', fieldType: 'image', isEditorField: 0 });
  add('DynamicField', 'origin-ref', { name: 'Parceiro', entityTable: 'Character', fieldType: 'entity', targetEntityTable: 'Character', isEditorField: 0 });
  add('DynamicFieldValue', 'own-value', { value: '20' }); add('DynamicFieldValue', 'private-other-value', { value: 'PRIVATE-OTHER-VALUE' });
  add('DynamicFieldValue', 'own-gallery', { value: '["lorekit-asset://00000000-0000-4000-8000-000000000050"]' }); add('DynamicFieldValue', 'own-reference', { value: 'origin-child' });
  add('Document', 'origin-document', { title: 'História', content: doc([paragraph([{ kind: 'mention', entityTable: 'Character', entityId: 'origin-character', label: 'A' }])]), type: 'document' });
  add('Document', 'origin-nested-doc', { title: 'Detalhes', content: 'Documento filho', type: 'document' });
  add('IRPWCharacterSheet', 'origin-character', { wallet: '{"version":1,"accounts":[{"currencyId":"origin-currency","balances":{"origin-unit":17}}]}', inventory: JSON.stringify({ version: 1, entries: [{ instanceId: 'origin-instance', sourceItemId: 'private-catalog-item', sourcePortableId: 'private-portable', sourceRevision: 2, snapshot: { name: 'Espada', description: '', effects: 'Efeito próprio', definition: { version: 1, category: 'weapon', imageReference: 'lorekit-asset://00000000-0000-4000-8000-000000000050' } }, quantity: 2, notes: 'Presente', location: 'equipment', slot: 'primary' }], backpackOrder: [], equipment: { primary: 'origin-instance' } }), attributes: '{"BODY":{"value":4}}', habilities: '[{"id":"origin-ability","name":"Golpe","description":"Descrição","type":"technical"}]', favoriteActions: '["attack:origin-instance","ability:character:origin-character:origin-ability"]', seriousWoundCount: 1 });
  add('IRPWCurrency', 'origin-currency', { name: 'Crédito', description: '', unitsJson: '[{"id":"origin-unit","name":"Créditos","convertAt":null}]' });
  const edges: Array<{ parentTable: string; parentId: string; entityTable: string; entityId: string }> = [];
  const edge = (parentTable: string, parentId: string, entityTable: string, entityId: string) => edges.push({ parentTable, parentId, entityTable, entityId });
  for (const id of ['origin-character', 'origin-child', 'unrelated-character']) edge('World', 'origin-world', 'Character', id);
  edge('Character', 'origin-character', 'Character', 'origin-child');
  for (const [table, id] of [['Personalization', 'origin-personalization'], ['Image', 'origin-image'], ['DynamicFieldValue', 'own-value'], ['DynamicFieldValue', 'own-gallery'], ['DynamicFieldValue', 'own-reference'], ['Document', 'origin-document']]) edge('Character', 'origin-character', table, id);
  edge('Document', 'origin-document', 'Document', 'origin-nested-doc');
  edge('World', 'origin-world', 'Document', 'origin-document'); edge('World', 'origin-world', 'Document', 'origin-nested-doc');
  edge('Character', 'unrelated-character', 'DynamicFieldValue', 'private-other-value');
  edge('DynamicField', 'origin-field', 'DynamicFieldValue', 'own-value'); edge('DynamicField', 'origin-field', 'DynamicFieldValue', 'private-other-value');
  edge('DynamicField', 'origin-gallery', 'DynamicFieldValue', 'own-gallery'); edge('DynamicField', 'origin-ref', 'DynamicFieldValue', 'own-reference');
  return { reads, source: { find: ref => { const key = `${ref.table}:${ref.id}`; reads.push(key); return rows.get(key) || null; }, relationships: () => edges, canRead: () => true,
    layout: () => ({ version: 2, columns: 12, rowHeight: 56, tabs: [{ id: 'origin-layout', name: 'Geral', items: [{ id: 'origin-layout-item', kind: 'field', token: 'dynamic:origin-field', col: 1, row: 1, width: 3, height: 1 }] }] }) } };
}
async function archiveFixture(): Promise<EntityArchive> {
  const { source } = fixture(); return buildEntityArchive(planCharacterExport(source, 'origin-character'), { read: async () => ({ bytes: new Uint8Array(PNG).buffer, mimeType: 'image/png' }), label: () => null });
}
function scalar(db: Database, sql: string): unknown { return db.exec(sql)[0]?.values[0]?.[0]; }
function query(db: Database, table: string, id?: string): Record<string, unknown>[] {
  const result = db.exec(`SELECT * FROM "${table}"${id ? ' WHERE id = ?' : ''}`, id ? [id] : undefined)[0];
  return result ? result.values.map(row => Object.fromEntries(result.columns.map((column, i) => [column, row[i]]))) : [];
}
function destination(db: Database): EntityImportDestination {
  return { world: id => query(db, 'World', id)[0] || null, canWriteWorld: () => true,
    dynamicFields: () => query(db, 'DynamicField') as unknown as ReturnType<EntityImportDestination['dynamicFields']>, idExists: (table, id) => query(db, table, id).length > 0 };
}

describe('Entity portability v2 complete round trips', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  beforeAll(async () => { SQL = await initSqlJs({ locateFile: file => `assets/${file}` }); });
  function database(): Database { const db = new SQL.Database(); ensureSchema(db); runLocalMigrations(db); db.run('INSERT INTO World(id,name,description) VALUES (?,?,?)', ['destination', 'Destino', '']); db.exec('DELETE FROM _SyncDirty'); return db; }
  async function prepared(db: Database, archive: EntityArchive): Promise<EntityImportPlan> {
    return resolveImportContent(planEntityImport(archive.manifest, 'destination', destination(db), undefined, { verifiedAssets: true, references: Object.fromEntries(archive.manifest.externalReferences.map(ref => [ref.key, null])) }));
  }
  function host(db: Database) {
    const files = new Map<string, Uint8Array>(); const controls = { failInsert: false, failPersistAfterCommit: false, changeDuringStage: false, persistCount: 0 };
    const service: EntityImportHost = {
      identity: db, guard: () => undefined,
      fresh: plan => {
        const current = destination(db); if (canonicalJson({ base: importDestinationFingerprint(current.world('destination')!, current.dynamicFields()), references: {} }) !== plan.destinationFingerprint) throw new Error('stale preview');
        for (const row of plan.rows) if (current.idExists(row.table, row.id)) throw new Error('ID collision');
      },
      receipt: id => { const rows = db.exec('SELECT rootId,digest FROM _EntityImportReceipts WHERE operationId=?', [id])[0]?.values; return rows?.length ? { rootId: String(rows[0][0]), digest: String(rows[0][1]) } : null; },
      rootExists: id => query(db, 'Character', id).length > 0,
      journal: (id, state, ids) => db.run('INSERT INTO _AssetOperations(operationId,state,assetIds,createdAt) VALUES (?,?,?,?) ON CONFLICT(operationId) DO UPDATE SET state=excluded.state,assetIds=excluded.assetIds', [id, state, JSON.stringify(ids), 'now']),
      clearJournal: id => db.run('DELETE FROM _AssetOperations WHERE operationId=?', [id]),
      persist: async () => { controls.persistCount++; if (controls.failPersistAfterCommit && Number(scalar(db, 'SELECT COUNT(*) FROM _EntityImportReceipts'))) throw new Error('disk failed'); },
      stage: async (asset, bytes, id) => {
        files.set(id, new Uint8Array(bytes)); db.run('INSERT INTO _BlobOutbox(blobId,mimeType,sha256,state,createdAt) VALUES (?,?,?,?,?)', [id, asset.mimeType, asset.sha256, 'pending', 'now']);
        if (controls.changeDuringStage) db.run('UPDATE World SET name=? WHERE id=?', ['Changed', 'destination']); return { localPath: null };
      },
      cleanup: async id => { files.delete(id); db.run('DELETE FROM _BlobOutbox WHERE blobId=?', [id]); },
      transaction: async fn => { db.exec('BEGIN IMMEDIATE'); try { fn(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; } },
      insert: row => {
        if (controls.failInsert && row.table === 'Character') throw new Error('insert failed');
        const data = { ...row.data, id: row.id }; const keys = Object.keys(data); db.run(`INSERT INTO "${row.table}" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(data) as Array<string | number | null>);
      },
      saveReceipt: (id, root, digest) => db.run('INSERT INTO _EntityImportReceipts(operationId,rootId,digest,createdAt) VALUES (?,?,?,?)', [id, root, digest, 'now']),
    };
    return { service, files, controls };
  }
  it('packages selected entities and resources without leaking source identities, other consumers or paths', async () => {
    const { source, reads } = fixture(); const archive = await buildEntityArchive(planCharacterExport(source, 'origin-character'), { read: async () => ({ bytes: PNG.buffer as ArrayBuffer, mimeType: 'image/png' }), label: () => null });
    const serialized = JSON.stringify(archive.manifest);
    for (const secret of ['origin-character', 'origin-child', 'origin-field', 'origin-image', 'origin-currency', 'origin-unit', 'secret-species-id', 'private-catalog-item', 'PRIVATE-OTHER', '/images/']) expect(serialized).not.toContain(secret);
    expect(reads).not.toContain('Character:unrelated-character'); expect(reads).not.toContain('DynamicFieldValue:private-other-value');
    expect(archive.manifest.assets.length).toBe(1); expect(archive.manifest.entities.filter(entity => entity.type === 'Document').length).toBe(2);
  });
  it('round-trips the archive through a new SQLite world, preserving values, text, gallery, sheet, equipment and wallet', async () => {
    const archive = await decodeEntityArchive(await encodeEntityArchive(await archiveFixture()));
    const db = database(); const plan = await prepared(db, archive); const execution = host(db);
    const root = await applyEntityImport(plan, archive, execution.service); expect(query(db, 'Character').length).toBe(2);
    const character = query(db, 'Character', root)[0]; const description = JSON.parse(String(character['description']));
    expect(description.blocks[0].content[0].bold).toBeTrue(); expect(description.blocks[0].content[1].entityId).not.toBe('character-2');
    expect(description.blocks[0].content[2]).toEqual({ kind: 'text', text: 'Referência externa' });
    expect(description.blocks[1].url).toBe(`lorekit-asset://${plan.assets[0].blobId}`);
    expect(query(db, 'Document').length).toBe(2); expect(query(db, 'Personalization')[0]['contentJson']).toContain('#34d399');
    const sheet = query(db, 'IRPWCharacterSheet', root)[0]; expect(sheet['seriousWoundCount']).toBe(1);
    const inventory = JSON.parse(String(sheet['inventory'])); const entry = inventory.entries[0];
    expect(entry.quantity).toBe(2); expect(entry.snapshot.effects).toBe('Efeito próprio'); expect(entry.sourceItemId).toBeNull(); expect(inventory.equipment.primary).toBe(entry.instanceId);
    expect(entry.snapshot.definition.imageReference).toBe(`lorekit-asset://${plan.assets[0].blobId}`);
    const currency = query(db, 'IRPWCurrency')[0]; const unit = JSON.parse(String(currency['unitsJson']))[0]; const wallet = JSON.parse(String(sheet['wallet']));
    expect(wallet.accounts[0].currencyId).toBe(currency['id']); expect(wallet.accounts[0].balances[unit.id]).toBe(17); expect(unit.id).not.toBe('unit-1');
    expect(JSON.parse(String(sheet['favoriteActions']))[0]).toBe(`attack:${entry.instanceId}`);
    expect(execution.files.size).toBe(1); expect(scalar(db, 'SELECT COUNT(*) FROM _AssetOperations')).toBe(0);
    expect(scalar(db, 'SELECT COUNT(*) FROM _EntityImportReceipts')).toBe(1); expect(Number(scalar(db, 'SELECT COUNT(*) FROM _SyncDirty'))).toBeGreaterThan(10); db.close();
  });
  it('is idempotent for concurrent retries but permits a second intentional copy', async () => {
    const archive = await archiveFixture(); const db = database(); const plan = await prepared(db, archive); const execution = host(db);
    const results = await Promise.all([applyEntityImport(plan, archive, execution.service), applyEntityImport(plan, archive, execution.service)]);
    expect(results[0]).toBe(results[1]); expect(query(db, 'Character').length).toBe(2);
    const second = await prepared(db, archive); await applyEntityImport(second, archive, execution.service); expect(query(db, 'Character').length).toBe(4); db.close();
  });
  it('rolls back all rows, sync clocks and blobs on a transaction failure', async () => {
    const archive = await archiveFixture(); const db = database(); const plan = await prepared(db, archive); const execution = host(db); execution.controls.failInsert = true;
    await expectAsync(applyEntityImport(plan, archive, execution.service)).toBeRejectedWithError('insert failed');
    expect(query(db, 'Character').length).toBe(0); expect(query(db, 'DynamicField').length).toBe(0); expect(execution.files.size).toBe(0);
    expect(scalar(db, 'SELECT COUNT(*) FROM _SyncDirty')).toBe(0); expect(scalar(db, 'SELECT COUNT(*) FROM _BlobOutbox')).toBe(0); expect(scalar(db, 'SELECT COUNT(*) FROM _EntityImportReceipts')).toBe(0); db.close();
  });
  it('revalidates after staging and rejects a stale preview without creating entities', async () => {
    const archive = await archiveFixture(); const db = database(); const plan = await prepared(db, archive); const execution = host(db); execution.controls.changeDuringStage = true;
    await expectAsync(applyEntityImport(plan, archive, execution.service)).toBeRejectedWithError('stale preview'); expect(query(db, 'Character').length).toBe(0); expect(execution.files.size).toBe(0); db.close();
  });
  it('keeps committed resources and resumes persistence without duplication after a disk failure', async () => {
    const archive = await archiveFixture(); const db = database(); const plan = await prepared(db, archive); const execution = host(db); execution.controls.failPersistAfterCommit = true;
    await expectAsync(applyEntityImport(plan, archive, execution.service)).toBeRejectedWithError(/persistência falhou/);
    expect(query(db, 'Character').length).toBe(2); expect(execution.files.size).toBe(1); execution.controls.failPersistAfterCommit = false;
    await applyEntityImport(plan, archive, execution.service); expect(query(db, 'Character').length).toBe(2); expect(scalar(db, 'SELECT COUNT(*) FROM _AssetOperations')).toBe(0); db.close();
  });
  it('retains idempotency receipts after reopening SQLite', async () => {
    const archive = await archiveFixture(); const db = database(); const plan = await prepared(db, archive); await applyEntityImport(plan, archive, host(db).service);
    const restored = new SQL.Database(db.export()); runLocalMigrations(restored); expect(await applyEntityImport(plan, archive, host(restored).service)).toBe(plan.rootId);
    expect(query(restored, 'Character').length).toBe(2); db.close(); restored.close();
  });
  it('delivers the imported data contract to a second isolated database without local paths or import receipts', async () => {
    const archive = await archiveFixture(); const db = database(); const plan = await prepared(db, archive); await applyEntityImport(plan, archive, host(db).service);
    const second = new SQL.Database(); ensureSchema(second); runLocalMigrations(second); second.exec('UPDATE _SyncControl SET suppressCapture=1');
    for (const definition of SYNC_ENTITIES) {
      for (const row of query(db, definition.entityType)) {
        const data = toSyncPayload(definition, row); if (definition.entityType === 'Image') data['filePath'] = `lorekit-asset://${data['blobId']}`;
        const keys = Object.keys(data); second.run(`INSERT OR REPLACE INTO "${definition.entityType}" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(data) as Array<string | number | null>);
      }
    }
    expect(query(second, 'IRPWCharacterSheet', plan.rootId)[0]['wallet']).toBe(query(db, 'IRPWCharacterSheet', plan.rootId)[0]['wallet']);
    expect(query(second, 'Character').length).toBe(2); expect(scalar(second, 'SELECT COUNT(*) FROM _EntityImportReceipts')).toBe(0);
    expect(scalar(second, 'SELECT value FROM _SchemaMetadata WHERE key="schemaVersion"')).toBe(String(LOCAL_SCHEMA_VERSION)); db.close(); second.close();
  });
});

describe('Entity archive integrity and content boundaries', () => {
  it('rejects extras, traversal and unsupported compression', async () => {
    const archive = await archiveFixture(); const bytes = await encodeEntityArchive(archive); const files = decodeStoredZip(bytes);
    files.set('assets/extra', PNG); await expectAsync(decodeEntityArchive(encodeStoredZip(files))).toBeRejectedWithError(/não declarado/);
    expect(() => decodeStoredZip(encodeStoredZip(new Map([['../private', PNG]])))).toThrowError(/Caminho/);
    const compressed = new Uint8Array(bytes); const view = new DataView(compressed.buffer); const end = compressed.length - 22; const central = view.getUint32(end + 16, true); view.setUint16(central + 10, 8, true);
    await expectAsync(decodeEntityArchive(compressed)).toBeRejectedWithError(/ZIP STORE/);
  });
  it('verifies CRC, SHA-256 and raster signatures before any import', async () => {
    const archive = await archiveFixture(); const bytes = await encodeEntityArchive(archive); const corrupt = new Uint8Array(bytes); corrupt[50] ^= 1;
    await expectAsync(decodeEntityArchive(corrupt)).toBeRejected();
    const files = decodeStoredZip(bytes); const path = archive.manifest.assets[0].path; const bad = new Uint8Array(files.get(path)!); bad[bad.length - 1] ^= 1; files.set(path, bad);
    await expectAsync(decodeEntityArchive(encodeStoredZip(files))).toBeRejectedWithError(/corrompido/);
    const fake = new TextEncoder().encode('not a png image, despite a valid hash and size'); const manifest = structuredClone(archive.manifest); manifest.assets[0].sizeBytes = fake.length; manifest.assets[0].sha256 = await sha256(fake);
    const fakeArchive = { manifest, assets: new Map([[manifest.assets[0].key, fake]]) }; await expectAsync(encodeEntityArchive(fakeArchive)).toBeRejectedWithError(/Bytes/);
  });
  it('rejects source IDs/URLs, active HTML, undeclared mentions and opaque editor blocks', async () => {
    const archive = await archiveFixture(); const raw = structuredClone(archive.manifest); const root = raw.entities.find(entity => entity.key === raw.root.key)!;
    for (const content of ['<script>alert(1)</script>', doc([paragraph([{ kind: 'mention', entityTable: 'Character', entityId: 'source-id', label: 'secret' }])]), doc([{ type: 'unsupported', source: 'editorjs', originalType: 'secret', data: {} }]), doc([paragraph([text('safe')]), { type: 'image', url: '/private/source.png', caption: [], layout: { withBorder: false, withBackground: false, stretched: false, width: 'auto' } }])]) {
      root.data['description'] = content; expect(() => validateEntityBundle(raw)).toThrow();
    }
    await expectAsync(decodeEntityArchive(new TextEncoder().encode('{"format":"lorekit-entity-bundle","version":1}'))).toBeRejectedWithError(/v1/);
  });
  it('blocks prototype pollution and rich payload data hidden in unused block properties', async () => {
    const raw = structuredClone((await archiveFixture()).manifest); raw.entities[0].data['description'] = '{"format":"lorekit-editor","version":1,"blocks":[{"type":"paragraph","content":[],"url":"/private"}]}';
    expect(() => validateEntityBundle(raw)).toThrow(); raw.entities[0].data['description'] = '{"format":"lorekit-editor","version":1,"blocks":[{"type":"paragraph","content":[],"__proto__":{}}]}'; expect(() => validateEntityBundle(raw)).toThrowError(/Chave JSON/);
  });
});


describe('Legacy widget normalization for entity exports', () => {
  const field = (fieldType: 'slider' | 'list' | 'chart', options?: string) => ({ key: 'f', entityTable: 'Character' as const, name: 'Campo', fieldType, isEditorField: false, options });
  it('preserves slider values and headless list rows', () => {
    expect(normalizeLegacyDynamicValue(field('slider'), '42')).toBe('{"value":42}');
    expect(normalizeLegacyDynamicValue(field('list', '{"mode":"headless"}'), '["A","B"]')).toBe('{"items":["A","B"]}');
  });
  it('preserves chart labels and values and leaves unrecognized shapes for strict validation', () => {
    expect(JSON.parse(String(normalizeLegacyDynamicValue(field('chart'), '{"labels":["A"],"values":[5]}')))).toEqual({ labels: ['A'], series: [{ id: 'series-1', values: [5] }] });
    const opaque = '{"labels":["A"],"values":[5],"secret":"opaque"}';
    expect(normalizeLegacyDynamicValue(field('chart'), opaque)).toBe(opaque);
  });
});
