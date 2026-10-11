import type { DynamicField } from '../../models/dynamicfields.model';
import type { EntityBundleV2, PortableDynamicField, PortabilityIssue } from '../../models/entity-bundle.model';
import { validateEntityBundle } from './entity-bundle.validator';
import { canonicalJson, canonicalOptions, immutableCopy } from './entity-portability.registry';

export type ImportTable = 'Character' | 'Personalization' | 'Image' | 'DynamicFieldValue' | 'DynamicField' | 'Relationship' | 'UiFieldConfig';
export interface EntityImportDestination {
  world(id: string): Record<string, unknown> | null;
  canWriteWorld(id: string): boolean;
  dynamicFields(): readonly DynamicField[];
  idExists(table: ImportTable, id: string): boolean;
}
export interface PlannedImportRow { table: ImportTable; id: string; data: Record<string, unknown>; }
export interface EntityImportPlan {
  operationId: string;
  destinationWorldId: string;
  destinationFingerprint: string;
  rootId: string;
  bundle: EntityBundleV2;
  rows: PlannedImportRow[];
  reusedFields: Array<{ key: string; id: string }>;
  assets: Array<{ key: string; blobId: string }>;
  issues: PortabilityIssue[];
}

/** Preparation only: this function has no database/file mutation capability. */
export function planEntityImport(
  raw: unknown,
  destinationWorldId: string,
  destination: EntityImportDestination,
  createId: () => string = () => crypto.randomUUID(),
): EntityImportPlan {
  const bundle = validateEntityBundle(raw);
  if (!destination.canWriteWorld(destinationWorldId)) throw new Error('Sem permissão de escrita no mundo de destino.');
  const world = destination.world(destinationWorldId);
  if (!world) throw new Error('O mundo de destino não foi encontrado.');
  const fields = destination.dynamicFields();
  const issues: PortabilityIssue[] = [];
  const rows: PlannedImportRow[] = [];
  const reusedFields: EntityImportPlan['reusedFields'] = [];
  const ids = new Map<string, string>();
  const allocated = new Set<string>();
  const newId = (table?: ImportTable): string => {
    const id = createId();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      || allocated.has(id) || (table && destination.idExists(table, id))) throw new Error('O gerador produziu uma identidade inválida ou já existente.');
    allocated.add(id); return id;
  };
  const operationId = newId();
  const add = (table: ImportTable, data: Record<string, unknown>, id = newId(table)): string => {
    rows.push({ table, id, data }); return id;
  };
  const fieldIdByKey = new Map<string, string>();
  const incomingNames = new Set<string>();
  for (const field of bundle.dynamicFields) {
    const name = normalizeName(field.name);
    const named = fields.filter(local => local.entityTable === 'Character' && normalizeName(local.name) === name);
    const matches = named.filter(local => sameDynamicField(local, field));
    if (incomingNames.has(name) || named.length > 1 || (named.length === 1 && matches.length !== 1)) {
      issues.push({ code: 'DYNAMIC_FIELD_CONFLICT', message: `O campo "${field.name}" precisa de uma resolução explícita.`, blocking: true });
    } else if (matches.length === 1) {
      fieldIdByKey.set(field.key, matches[0].id);
      reusedFields.push({ key: field.key, id: matches[0].id });
    } else {
      const { key, ...definition } = field;
      fieldIdByKey.set(key, add('DynamicField', { ...definition, isEditorField: field.isEditorField ? 1 : 0 }));
    }
    incomingNames.add(name);
  }
  for (const entity of bundle.entities) ids.set(entity.key, newId(entity.type));
  const assets = bundle.assets.map(asset => ({ key: asset.key, blobId: newId() }));
  const assetByKey = new Map(assets.map(asset => [asset.key, asset.blobId]));
  if (assets.length) issues.push({ code: 'ASSET_EXECUTOR_PENDING', message: 'Imagens precisam de validação binária e aplicação pelo executor v2.', blocking: true });
  if (bundle.externalReferences.length) issues.push({ code: 'EXTERNAL_REFERENCE_UNRESOLVED', message: 'Referências externas precisam ser vinculadas ou removidas explicitamente.', blocking: true });
  for (const entity of bundle.entities) {
    const id = ids.get(entity.key)!;
    let data: Record<string, unknown> = { ...entity.data };
    if (entity.type === 'DynamicFieldValue') {
      data = { value: entity.data['entityKey'] ? ids.get(String(entity.data['entityKey']))! : entity.data['value'] };
      const fieldId = fieldIdByKey.get(String(entity.data['fieldKey']));
      if (fieldId) add('Relationship', { parentTable: 'DynamicField', parentId: fieldId, entityTable: 'DynamicFieldValue', entityId: id });
    }
    if (entity.type === 'Image') {
      const blobId = assetByKey.get(String(entity.data['assetKey']))!;
      data = { usageKey: entity.data['usageKey'], blobId, filePath: `lorekit-asset://${blobId}` };
    }
    add(entity.type, data, id);
    if (entity.type === 'Character') add('Relationship', { parentTable: 'World', parentId: destinationWorldId, entityTable: 'Character', entityId: id });
  }
  for (const edge of bundle.relationships) {
    add('Relationship', { parentTable: edge.from.type, parentId: ids.get(edge.from.key)!, entityTable: edge.to.type, entityId: ids.get(edge.to.key)! });
  }
  for (const entry of bundle.layouts) {
    const layout = JSON.parse(JSON.stringify(entry.layout)) as typeof entry.layout;
    let resolved = true;
    for (const item of layout.tabs.flatMap(tab => tab.items)) {
      if (item.kind !== 'field' || !item.token.startsWith('dynamic:')) continue;
      const fieldId = fieldIdByKey.get(item.token.slice(8));
      if (!fieldId) { resolved = false; continue; }
      item.token = `dynamic:${fieldId}`;
    }
    if (resolved) add('UiFieldConfig', { entityTable: 'Character', entityId: ids.get(entry.ownerKey)!,
      parentEntityTable: null, parentEntityId: null, templateId: null, uiConfig: JSON.stringify(layout) });
  }
  const orderedRows = [...rows.filter(row => row.table !== 'Relationship'), ...rows.filter(row => row.table === 'Relationship')];
  return immutableCopy({ operationId, destinationWorldId, destinationFingerprint: importDestinationFingerprint(world, fields),
    rootId: ids.get(bundle.root.key)!, bundle, rows: orderedRows, reusedFields, assets, issues });
}

export function importDestinationFingerprint(world: Record<string, unknown>, fields: readonly DynamicField[]): string {
  return canonicalJson({ world, fields: [...fields].sort((a, b) => a.id.localeCompare(b.id)) });
}
export function sameDynamicField(local: DynamicField, incoming: PortableDynamicField): boolean {
  return local.entityTable === incoming.entityTable && normalizeName(local.name) === normalizeName(incoming.name)
    && (local.fieldType || 'text') === incoming.fieldType && Boolean(local.isEditorField) === incoming.isEditorField
    && (local.targetEntityTable || '') === (incoming.targetEntityTable || '')
    && canonicalOptions(local.options) === canonicalOptions(incoming.options);
}
function normalizeName(name: string): string { return name.trim().normalize('NFC').toLocaleLowerCase('pt-BR'); }
