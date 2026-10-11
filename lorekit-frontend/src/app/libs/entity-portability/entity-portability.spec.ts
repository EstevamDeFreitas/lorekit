import { DynamicField } from '../../models/dynamicfields.model';
import { EntityBundleV2, PortableDynamicField } from '../../models/entity-bundle.model';
import { UiConfigPayload } from '../../models/ui-field-config.model';
import { parseEntityBundleManifest, validateEntityBundle } from './entity-bundle.validator';
import { EntityExportSource, LocalEntityRef, LocalRelationship, planCharacterExport } from './entity-export.planner';
import { EntityImportDestination, planEntityImport, sameDynamicField } from './entity-import.planner';

function layout(token = 'schema:age'): UiConfigPayload {
  return { version: 2, columns: 12, rowHeight: 56, tabs: [{ id: 'tab:local', name: 'Geral',
    items: [{ id: 'field:local', kind: 'field', token, col: 1, row: 1, width: 3, height: 1 }] }] };
}
function relation(parentTable: string, parentId: string, entityTable: string, entityId: string): LocalRelationship {
  return { parentTable, parentId, entityTable, entityId };
}
class Source implements EntityExportSource {
  readonly rows = new Map<string, Record<string, unknown>>();
  readonly edges: LocalRelationship[] = [];
  readonly reads: string[] = [];
  denied = new Set<string>();
  currentLayout = layout();
  add(table: string, id: string, data: Record<string, unknown> = {}): this { this.rows.set(`${table}:${id}`, { id, ...data }); return this; }
  find(ref: LocalEntityRef): Record<string, unknown> | null { const key = `${ref.table}:${ref.id}`; this.reads.push(key); return this.rows.get(key) ?? null; }
  canRead(ref: LocalEntityRef): boolean { return !this.denied.has(`${ref.table}:${ref.id}`); }
  relationships(): LocalRelationship[] { return this.edges; }
  layout(): UiConfigPayload { return this.currentLayout; }
}
function sourceFixture(): Source {
  const source = new Source().add('World', 'world').add('Character', 'a', { name: 'A', description: '', internalSecret: 'not portable' })
    .add('Character', 'b', { name: 'B', description: '' }).add('Character', 'child', { name: 'Child', description: '' })
    .add('DynamicField', 'field', { name: 'Força', entityTable: 'Character', fieldType: 'text', isEditorField: 0 })
    .add('DynamicFieldValue', 'va', { value: '10' }).add('DynamicFieldValue', 'vb', { value: 'private' });
  source.edges.push(relation('World', 'world', 'Character', 'a'), relation('World', 'world', 'Character', 'b'),
    relation('World', 'world', 'Character', 'child'), relation('Character', 'a', 'Character', 'child'),
    relation('Character', 'a', 'DynamicFieldValue', 'va'), relation('Character', 'b', 'DynamicFieldValue', 'vb'),
    relation('DynamicField', 'field', 'DynamicFieldValue', 'va'), relation('DynamicField', 'field', 'DynamicFieldValue', 'vb'));
  return source;
}
function manifest(): EntityBundleV2 {
  return { format: 'lorekit-entity-bundle', version: 2, exportedAt: '2026-10-11T12:00:00Z',
    root: { type: 'Character', key: 'c1' }, entities: [
      { type: 'Character', key: 'c1', schemaVersion: 1, data: { name: 'A', description: '', age: 24 } },
      { type: 'Character', key: 'c2', schemaVersion: 1, data: { name: 'Filho', description: '' } },
      { type: 'DynamicFieldValue', key: 'v1', schemaVersion: 1, data: { value: '10', fieldKey: 'f1' } },
    ], relationships: [
      { kind: 'hierarchy', from: { type: 'Character', key: 'c1' }, to: { type: 'Character', key: 'c2' } },
      { kind: 'owned', from: { type: 'Character', key: 'c1' }, to: { type: 'DynamicFieldValue', key: 'v1' } },
    ], dynamicFields: [{ key: 'f1', name: 'Força', entityTable: 'Character', fieldType: 'text', isEditorField: false }],
    layouts: [{ ownerKey: 'c1', layout: layout('dynamic:f1') }], externalReferences: [], assets: [] };
}
class Destination implements EntityImportDestination {
  readonly worlds = new Map<string, Record<string, unknown>>([['destination', { id: 'destination', name: 'Meu mundo' }]]);
  fields: DynamicField[] = [];
  writable = true;
  existing = new Set<string>();
  world(id: string): Record<string, unknown> | null { return this.worlds.get(id) ?? null; }
  canWriteWorld(): boolean { return this.writable; }
  dynamicFields(): DynamicField[] { return this.fields; }
  idExists(table: string, id: string): boolean { return this.existing.has(`${table}:${id}`); }
}
function ids(): () => string { let i = 0; return () => `00000000-0000-4000-8000-${String(++i).padStart(12, '0')}`; }

describe('Entity export v2 scope planner', () => {
  it('includes the root, children and own dynamic values without visiting the world graph or other consumers', () => {
    const source = sourceFixture(); const plan = planCharacterExport(source, 'a');
    expect(plan.entities.map(entity => `${entity.source.table}:${entity.source.id}`)).toEqual(['Character:a', 'DynamicFieldValue:va', 'Character:child']);
    expect(source.reads).not.toContain('Character:b'); expect(source.reads).not.toContain('DynamicFieldValue:vb');
    expect(plan.dynamicFields.length).toBe(1); expect(plan.dynamicFields[0].definition.key).toBe('field-1');
    expect(plan.entities[0].data['internalSecret']).toBeUndefined();
  });
  it('does not collect children when disabled', () => {
    const source = sourceFixture(); const plan = planCharacterExport(source, 'a', { includeChildren: false });
    expect(plan.entities.some(entity => entity.source.id === 'child')).toBeFalse();
    expect(source.reads).not.toContain('Character:child');
  });
  it('never includes ancestors even when the root is a child', () => {
    const source = sourceFixture(); const plan = planCharacterExport(source, 'child');
    expect(plan.entities.map(entity => entity.source.id)).toEqual(['child']); expect(source.reads).not.toContain('Character:a');
  });
  it('collects definitions used by the layout without values and remaps local UI IDs', () => {
    const source = sourceFixture().add('DynamicField', 'unused', { name: 'Mana', entityTable: 'Character', fieldType: 'text', isEditorField: 0 });
    source.currentLayout = layout('dynamic:unused');
    const plan = planCharacterExport(source, 'a');
    expect(plan.dynamicFields.map(field => field.sourceId)).toEqual(['unused', 'field']);
    expect(plan.layouts[0].layout.tabs[0].id).toBe('tab-1');
    expect((plan.layouts[0].layout.tabs[0].items[0] as { token: string }).token).toBe('dynamic:field-1');
    expect(source.currentLayout.tabs[0].id).toBe('tab:local');
  });
  it('keeps captured previews immutable after source changes', () => {
    const source = sourceFixture(); const plan = planCharacterExport(source, 'a'); source.rows.get('Character:a')!['name'] = 'Changed';
    expect(plan.entities[0].data['name']).toBe('A'); expect(Object.isFrozen(plan.entities[0].data)).toBeTrue();
  });
  it('rejects a cycle rather than truncating it', () => {
    const source = sourceFixture(); source.edges.push(relation('Character', 'child', 'Character', 'a'));
    expect(() => planCharacterExport(source, 'a')).toThrowError(/Ciclo/);
  });
  it('rejects a child in another world', () => {
    const source = sourceFixture().add('World', 'other');
    source.edges.find(edge => edge.parentTable === 'World' && edge.entityId === 'child')!.parentId = 'other';
    expect(() => planCharacterExport(source, 'a')).toThrowError(/outro mundo/);
  });
  it('rejects ambiguous and absent world ownership instead of graph inference', () => {
    const source = sourceFixture().add('World', 'other'); source.edges.push(relation('World', 'other', 'Character', 'a'));
    expect(() => planCharacterExport(source, 'a')).toThrowError(/vínculo único/);
    source.edges.splice(0, source.edges.length, relation('Location', 'location', 'Character', 'a'));
    expect(() => planCharacterExport(source, 'a')).toThrowError(/vínculo único/);
  });
  it('rejects multiple parents and shared owned values', () => {
    const source = sourceFixture(); source.edges.push(relation('Character', 'b', 'Character', 'child'));
    expect(() => planCharacterExport(source, 'a')).toThrowError(/Mais de um pai/);
    source.edges.pop(); source.edges.push(relation('Character', 'b', 'DynamicFieldValue', 'va'));
    expect(() => planCharacterExport(source, 'a')).toThrowError(/proprietário ambíguo/);
  });
  it('requires exactly one definition for a value', () => {
    const source = sourceFixture(); source.edges.push(relation('DynamicField', 'other-field', 'DynamicFieldValue', 'va'));
    expect(() => planCharacterExport(source, 'a')).toThrowError(/definição única/);
  });
  it('checks read permission before fetching the root, child, value and definition', () => {
    for (const denied of ['Character:a', 'Character:child', 'DynamicFieldValue:va', 'DynamicField:field']) {
      const source = sourceFixture(); source.denied.add(denied);
      expect(() => planCharacterExport(source, 'a')).toThrowError(/leitura negado/); expect(source.reads).not.toContain(denied);
    }
  });
  it('warns about unsupported dependencies without reading their content', () => {
    const source = sourceFixture().add('Document', 'secret', { content: 'secret' });
    source.edges.push(relation('Character', 'a', 'Document', 'secret'));
    const plan = planCharacterExport(source, 'a'); expect(plan.issues.some(item => item.code === 'UNSUPPORTED_DEPENDENCY' && item.blocking)).toBeTrue();
    expect(source.reads).not.toContain('Document:secret');
  });
  it('detects the Ironpaw weak dependency by character ID', () => {
    const source = sourceFixture().add('IRPWCharacterSheet', 'a', { inventory: '[]' });
    expect(planCharacterExport(source, 'a').issues.some(item => item.message.includes('Ironpaw'))).toBeTrue();
  });
  it('does not fetch species/location references or reveal their IDs in external previews', () => {
    const source = sourceFixture(); source.edges.push(relation('Species', 'secret-species', 'Character', 'a'));
    const refs = planCharacterExport(source, 'a').externalReferences;
    expect(refs).toEqual([{ ownerKey: 'character-1', targetType: 'Species', kind: 'relationship' }]);
    expect(JSON.stringify(refs)).not.toContain('secret-species'); expect(source.reads).not.toContain('Species:secret-species');
  });
  it('marks image resources, rich text and entity-valued fields as requiring codecs', () => {
    const source = sourceFixture().add('Image', 'image', { usageKey: 'profile', filePath: '/private/path.png' });
    source.edges.push(relation('Character', 'a', 'Image', 'image'));
    source.rows.get('Character:a')!['description'] = '{"kind":"mention","entityId":"foreign-id"}';
    source.rows.get('DynamicField:field')!['fieldType'] = 'entity'; source.rows.get('DynamicField:field')!['targetEntityTable'] = 'Species';
    const plan = planCharacterExport(source, 'a');
    expect(plan.issues.map(item => item.code)).toEqual(jasmine.arrayContaining(['ASSET_CODEC_PENDING', 'RICH_TEXT_CODEC_PENDING', 'ENTITY_REFERENCE_CODEC_PENDING']));
    expect(JSON.stringify(plan.entities.find(entity => entity.source.table === 'Image')!.data)).not.toContain('/private/path.png');
    expect(plan.entities.find(entity => entity.source.id === 'va')!.data['value']).toBeNull();
  });
});

describe('Entity bundle v2 manifest validation', () => {
  it('validates, copies and freezes a supported manifest', () => {
    const raw = manifest(); const parsed = parseEntityBundleManifest(JSON.stringify(raw)); raw.entities[0].data['name'] = 'Changed';
    expect(parsed.entities[0].data['name']).toBe('A'); expect(Object.isFrozen(parsed.entities[0])).toBeTrue();
  });
  it('rejects v1, backups, unknown schemas and malformed JSON', () => {
    for (const raw of [{ ...manifest(), version: 1 }, { ...manifest(), format: 'lorekit-full-backup' }]) expect(() => validateEntityBundle(raw)).toThrowError(/Formato não suportado/);
    const raw = manifest(); raw.entities[0].schemaVersion = 2 as 1; expect(() => validateEntityBundle(raw)).toThrowError(/schema/);
    expect(() => parseEntityBundleManifest('{')).toThrowError(/JSON válido/);
  });
  it('rejects arbitrary tables, columns and metadata', () => {
    const raw = manifest(); (raw.entities[0] as { type: string }).type = 'GlobalParameter'; expect(() => validateEntityBundle(raw)).toThrow();
    const column = manifest(); column.entities[0].data['filePath'] = '/etc/file'; expect(() => validateEntityBundle(column)).toThrowError(/Campo não portátil/);
    expect(() => validateEntityBundle({ ...manifest(), _SyncOutbox: [] })).toThrowError(/Propriedade não permitida/);
  });
  it('rejects duplicate keys, missing roots and malformed scalar values', () => {
    const raw = manifest(); raw.entities[1].key = 'c1'; expect(() => validateEntityBundle(raw)).toThrowError(/duplicada/);
    const absent = manifest(); absent.root.key = 'absent'; expect(() => validateEntityBundle(absent)).toThrowError(/raiz ausente/);
    const invalid = manifest(); invalid.entities[0].data['age'] = '24'; expect(() => validateEntityBundle(invalid)).toThrowError(/Valor inválido/);
  });
  it('rejects disconnected entities and dependencies without an owner', () => {
    const raw = manifest(); raw.relationships.shift(); expect(() => validateEntityBundle(raw)).toThrowError(/fora da árvore/);
    const value = manifest(); value.relationships.pop(); expect(() => validateEntityBundle(value)).toThrowError(/fora da árvore/);
  });
  it('rejects cycles, duplicate edges, illegal edge direction and fake references', () => {
    const cycle = manifest(); cycle.relationships.push({ kind: 'hierarchy', from: { type: 'Character', key: 'c2' }, to: cycle.root }); expect(() => validateEntityBundle(cycle)).toThrow();
    const duplicate = manifest(); duplicate.relationships.push(duplicate.relationships[0]); expect(() => validateEntityBundle(duplicate)).toThrowError(/duplicada/);
    const direction = manifest(); direction.relationships[1].from = { type: 'DynamicFieldValue', key: 'v1' }; expect(() => validateEntityBundle(direction)).toThrow();
    const missing = manifest(); missing.relationships[0].to.key = 'missing'; expect(() => validateEntityBundle(missing)).toThrowError(/Referência interna/);
  });
  it('rejects missing and unused field definitions and undeclared layout tokens', () => {
    const raw = manifest(); raw.dynamicFields = []; expect(() => validateEntityBundle(raw)).toThrowError(/Definição dinâmica ausente/);
    const unused = manifest(); unused.dynamicFields.push({ ...unused.dynamicFields[0], key: 'f2' }); expect(() => validateEntityBundle(unused)).toThrowError(/sem uso/);
    const token = manifest(); token.layouts[0].layout = layout('dynamic:not-declared'); expect(() => validateEntityBundle(token)).toThrowError(/não declarado/);
  });
  it('rejects raw entity IDs and verifies internal dynamic references', () => {
    const raw = manifest(); raw.dynamicFields[0].fieldType = 'entity'; raw.dynamicFields[0].targetEntityTable = 'Character';
    expect(() => validateEntityBundle(raw)).toThrowError(/IDs locais/);
    raw.entities[2].data['value'] = null; raw.entities[2].data['entityKey'] = 'c2'; expect(() => validateEntityBundle(raw)).not.toThrow();
    raw.entities[2].data['entityKey'] = 'v1'; expect(() => validateEntityBundle(raw)).toThrowError(/Alvo dinâmico/);
  });
  it('validates declared external dynamic slots and refuses dangling ones', () => {
    const raw = manifest(); raw.dynamicFields[0].fieldType = 'entity'; raw.dynamicFields[0].targetEntityTable = 'Species';
    raw.entities[2].data = { fieldKey: 'f1', value: null, externalReferenceKey: 'ref1' };
    raw.externalReferences.push({ key: 'ref1', ownerKey: 'c1', targetType: 'Species', kind: 'dynamic-field', fieldKey: 'f1' });
    expect(() => validateEntityBundle(raw)).not.toThrow(); raw.externalReferences[0].ownerKey = 'c2'; expect(() => validateEntityBundle(raw)).toThrow();
  });
  it('rejects rich/asset-bearing payloads until their codecs are implemented', () => {
    const raw = manifest(); raw.entities[0].data['description'] = '{"blocks":[]}'; expect(() => validateEntityBundle(raw)).toThrowError(/codec/);
    const image = manifest(); image.dynamicFields[0].fieldType = 'image'; expect(() => validateEntityBundle(image)).toThrowError(/codec/);
  });
  it('validates asset metadata and rejects traversal, missing and unused assets', () => {
    const raw = manifest(); raw.entities.push({ type: 'Image', key: 'i1', schemaVersion: 1, data: { usageKey: 'profile', assetKey: 'asset1' } });
    raw.relationships.push({ kind: 'owned', from: raw.root, to: { type: 'Image', key: 'i1' } });
    raw.assets.push({ key: 'asset1', path: 'assets/asset1', mimeType: 'image/png', sizeBytes: 20, sha256: 'a'.repeat(64) });
    expect(() => validateEntityBundle(raw)).not.toThrow();
    raw.assets[0].path = '../asset1'; expect(() => validateEntityBundle(raw)).toThrowError(/Caminho/);
    raw.assets = []; expect(() => validateEntityBundle(raw)).toThrowError(/Asset de imagem ausente/);
    const unused = manifest(); unused.assets.push({ key: 'unused', path: 'assets/unused', mimeType: 'image/png', sizeBytes: 20, sha256: 'a'.repeat(64) });
    expect(() => validateEntityBundle(unused)).toThrowError(/Asset sem uso/);
  });
  it('enforces manifest bytes and record limits', () => {
    expect(() => parseEntityBundleManifest(' '.repeat(8 * 1024 * 1024 + 1))).toThrowError(/8 MiB/);
    const raw = manifest(); raw.entities = Array.from({ length: 5001 }, () => raw.entities[0]); expect(() => validateEntityBundle(raw)).toThrowError(/limite de registros/);
  });
  it('preserves supported slider, list and chart values without normalization or data loss', () => {
    const cases = [
      { type: 'slider', options: { version: 1, kind: 'slider', min: 0, max: 100, step: 5, defaultValue: 0 }, value: { value: 25 } },
      { type: 'list', options: { version: 1, kind: 'list', mode: 'table', columns: [{ id: 'item', label: 'Item', type: 'text' }, { id: 'count', label: 'Count', type: 'number' }] }, value: { items: [{ item: 'Espada', count: 2 }] } },
      { type: 'chart', options: { version: 1, kind: 'chart', chartType: 'bar', title: '', legend: '', color: '#facc15', series: [{ id: 'base', label: 'Base', color: '#facc15' }] }, value: { labels: ['A', 'B'], series: [{ id: 'base', values: [1, 2] }] } },
    ];
    for (const entry of cases) {
      const raw = manifest(); raw.dynamicFields[0].fieldType = entry.type as PortableDynamicField['fieldType'];
      raw.dynamicFields[0].options = JSON.stringify(entry.options); raw.entities[2].data['value'] = JSON.stringify(entry.value);
      expect(validateEntityBundle(raw).entities[2].data['value']).toBe(raw.entities[2].data['value']);
    }
  });
  it('rejects malformed structured definitions, out-of-range sliders, nested list cells and mismatched chart lengths', () => {
    const slider = manifest(); slider.dynamicFields[0].fieldType = 'slider';
    slider.dynamicFields[0].options = JSON.stringify({ version: 1, kind: 'slider', min: 0, max: 10, step: 2, defaultValue: 0 });
    slider.entities[2].data['value'] = '{"value":3}'; expect(() => validateEntityBundle(slider)).toThrowError(/faixa ou do passo/);
    const list = manifest(); list.dynamicFields[0].fieldType = 'list';
    list.dynamicFields[0].options = JSON.stringify({ version: 1, kind: 'list', mode: 'table', columns: [{ id: 'item', label: 'Item', type: 'text' }] });
    list.entities[2].data['value'] = '{"items":[{"item":{"entityId":"foreign"}}]}'; expect(() => validateEntityBundle(list)).toThrowError(/Célula/);
    list.dynamicFields[0].options = '{"version":1,"kind":"list","mode":"table","columns":[{}]}'; expect(() => validateEntityBundle(list)).toThrow();
    const chart = manifest(); chart.dynamicFields[0].fieldType = 'chart';
    chart.dynamicFields[0].options = '{"version":1,"kind":"chart","chartType":"radar","color":"#facc15"}';
    chart.entities[2].data['value'] = '{"labels":["A"],"series":[{"id":"base","values":[1,2]}]}'; expect(() => validateEntityBundle(chart)).toThrowError(/Série/);
  });
  it('enforces structural depth and individual asset limits', () => {
    const raw = manifest(); raw.entities = [raw.entities[0]]; raw.relationships = []; raw.dynamicFields = []; raw.layouts = [];
    for (let i = 1; i <= 65; i++) {
      const key = `child-${i}`; raw.entities.push({ type: 'Character', key, schemaVersion: 1, data: { name: key, description: '' } });
      raw.relationships.push({ kind: 'hierarchy', from: { type: 'Character', key: i === 1 ? 'c1' : `child-${i - 1}` }, to: { type: 'Character', key } });
    }
    expect(() => validateEntityBundle(raw)).toThrowError(/profundidade/);
    const oversized = manifest(); oversized.assets.push({ key: 'large', path: 'assets/large', mimeType: 'image/png', sizeBytes: 25 * 1024 * 1024 + 1, sha256: 'a'.repeat(64) });
    expect(() => validateEntityBundle(oversized)).toThrowError(/Tamanho/);
  });
});

describe('Entity import v2 copy planner', () => {
  it('prepares copies with new identities, world links, field links and entity-specific layouts without mutations', () => {
    const destination = new Destination(); const before = JSON.stringify(destination); const raw = manifest();
    const plan = planEntityImport(raw, 'destination', destination, ids());
    expect(JSON.stringify(destination)).toBe(before); expect(raw.entities[0].key).toBe('c1'); expect(plan.rootId).not.toBe('c1');
    expect(plan.rows.filter(row => row.table === 'Character').length).toBe(2);
    expect(plan.rows.filter(row => row.table === 'Relationship' && row.data['parentTable'] === 'World').map(row => row.data['parentId'])).toEqual(['destination', 'destination']);
    expect(plan.rows.filter(row => row.table === 'DynamicField').length).toBe(1);
    const field = plan.rows.find(row => row.table === 'DynamicField')!;
    expect(plan.rows.some(row => row.table === 'Relationship' && row.data['parentTable'] === 'DynamicField' && row.data['parentId'] === field.id)).toBeTrue();
    const config = plan.rows.find(row => row.table === 'UiFieldConfig')!;
    expect(config.data['entityId']).toBe(plan.rootId); expect(config.data['parentEntityId']).toBeNull();
    expect(String(config.data['uiConfig'])).toContain(`dynamic:${field.id}`); expect(plan.issues).toEqual([]);
  });
  it('reuses equivalent definitions and rejects automatic overwrites for incompatible definitions', () => {
    const destination = new Destination(); destination.fields = [{ id: 'local-field', name: ' força ', entityTable: 'Character', fieldType: 'text', isEditorField: false }];
    const plan = planEntityImport(manifest(), 'destination', destination, ids()); expect(plan.reusedFields).toEqual([{ key: 'f1', id: 'local-field' }]);
    expect(plan.rows.some(row => row.table === 'DynamicField')).toBeFalse(); destination.fields[0].fieldType = 'options';
    const conflict = planEntityImport(manifest(), 'destination', destination, ids()); expect(conflict.issues[0].code).toBe('DYNAMIC_FIELD_CONFLICT');
    expect(destination.fields[0].fieldType).toBe('options');
  });
  it('compares option object keys canonically while preserving array order', () => {
    const local = { id: 'local', name: 'List', entityTable: 'Character', fieldType: 'list', isEditorField: false, options: '{"columns":["a","b"],"mode":"table"}' } as DynamicField;
    const incoming = { key: 'f', name: 'List', entityTable: 'Character', fieldType: 'list', isEditorField: false, options: '{"mode":"table","columns":["a","b"]}' } as PortableDynamicField;
    expect(sameDynamicField(local, incoming)).toBeTrue(); incoming.options = '{"mode":"table","columns":["b","a"]}'; expect(sameDynamicField(local, incoming)).toBeFalse();
  });
  it('blocks ambiguous local definitions and duplicate incoming names', () => {
    const destination = new Destination(); destination.fields = ['x', 'y'].map(id => ({ id, name: 'Força', entityTable: 'Character', fieldType: 'text', isEditorField: false }));
    expect(planEntityImport(manifest(), 'destination', destination, ids()).issues[0].code).toBe('DYNAMIC_FIELD_CONFLICT');
  });
  it('rejects missing worlds and read-only destinations', () => {
    const destination = new Destination(); expect(() => planEntityImport(manifest(), 'missing', destination, ids())).toThrowError(/não foi encontrado/);
    destination.writable = false; expect(() => planEntityImport(manifest(), 'destination', destination, ids())).toThrowError(/Sem permissão/);
  });
  it('rejects invalid, repeated and existing generated identities', () => {
    expect(() => planEntityImport(manifest(), 'destination', new Destination(), () => 'source-id')).toThrowError(/identidade inválida/);
    const generator = ids(); const id = generator(); expect(() => planEntityImport(manifest(), 'destination', new Destination(), () => id)).toThrowError(/identidade inválida/);
    const destination = new Destination(); destination.existing.add('DynamicField:00000000-0000-4000-8000-000000000002');
    expect(() => planEntityImport(manifest(), 'destination', destination, ids())).toThrowError(/já existente/);
  });
  it('remaps internal entity-valued fields to copied entities', () => {
    const raw = manifest(); raw.dynamicFields[0].fieldType = 'entity'; raw.dynamicFields[0].targetEntityTable = 'Character';
    raw.entities[2].data = { value: null, fieldKey: 'f1', entityKey: 'c2' };
    const plan = planEntityImport(raw, 'destination', new Destination(), ids()); const child = plan.rows.find(row => row.table === 'Character' && row.data['name'] === 'Filho')!;
    expect(plan.rows.find(row => row.table === 'DynamicFieldValue')!.data['value']).toBe(child.id);
  });
  it('requires explicit external-reference resolution rather than guessing by IDs or names', () => {
    const raw = manifest(); raw.externalReferences.push({ key: 'ref1', ownerKey: 'c1', targetType: 'Species', kind: 'relationship' });
    const plan = planEntityImport(raw, 'destination', new Destination(), ids()); expect(plan.issues.some(issue => issue.code === 'EXTERNAL_REFERENCE_UNRESOLVED')).toBeTrue();
  });
  it('creates a separate copy plan on each intentional import and tracks destination changes', () => {
    const generator = ids(); const destination = new Destination(); const first = planEntityImport(manifest(), 'destination', destination, generator);
    const second = planEntityImport(manifest(), 'destination', destination, generator); expect(second.rootId).not.toBe(first.rootId);
    destination.fields.push({ id: 'new', name: 'Mana', entityTable: 'Character', fieldType: 'text', isEditorField: false });
    expect(planEntityImport(manifest(), 'destination', destination, generator).destinationFingerprint).not.toBe(first.destinationFingerprint);
  });
  it('reserves new blob IDs and blocks asset application until binary verification is available', () => {
    const raw = manifest(); raw.entities.push({ type: 'Image', key: 'image', schemaVersion: 1, data: { usageKey: 'profile', assetKey: 'asset' } });
    raw.relationships.push({ kind: 'owned', from: raw.root, to: { type: 'Image', key: 'image' } });
    raw.assets.push({ key: 'asset', path: 'assets/asset', mimeType: 'image/png', sizeBytes: 20, sha256: 'a'.repeat(64) });
    const plan = planEntityImport(raw, 'destination', new Destination(), ids());
    expect(plan.assets[0].blobId).not.toBe('asset'); expect(plan.issues.some(issue => issue.code === 'ASSET_EXECUTOR_PENDING')).toBeTrue();
    expect(plan.rows.find(row => row.table === 'Image')!.data['blobId']).toBe(plan.assets[0].blobId);
    const firstRelationship = plan.rows.findIndex(row => row.table === 'Relationship');
    expect(plan.rows.slice(firstRelationship).every(row => row.table === 'Relationship')).toBeTrue();
  });
});
