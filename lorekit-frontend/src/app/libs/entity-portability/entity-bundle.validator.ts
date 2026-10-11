import {
  ENTITY_BUNDLE_FORMAT, ENTITY_BUNDLE_LIMITS, ENTITY_BUNDLE_VERSION,
  EntityBundleV2, PortableDynamicField, PortableEntityRef,
} from '../../models/entity-bundle.model';
import { isValidDynamicFieldOptions } from '../../models/dynamicfields.model';
import { normalizeUiConfigPayload } from '../../models/ui-field-config.model';
import { immutableCopy, isPortableEntityType, REFERENCE_TYPES, validatePortableData } from './entity-portability.registry';

const FIELD_TYPES = new Set(['text', 'options', 'editor', 'entity', 'image', 'slider', 'list', 'chart']);
const CHARACTER_FIELDS = new Set(['age', 'height', 'weight', 'occupation', 'alignment', 'personality', 'appearance', 'objectives']);
const MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

export function parseEntityBundleManifest(serialized: string): EntityBundleV2 {
  if (new TextEncoder().encode(serialized).byteLength > ENTITY_BUNDLE_LIMITS.manifestBytes) {
    throw new Error('O manifest excede o limite de 8 MiB.');
  }
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw new Error('O manifest não é um JSON válido.'); }
  return validateEntityBundle(value);
}

/** Validates the manifest only. Binary verification belongs to the archive/asset codec. */
export function validateEntityBundle(value: unknown): EntityBundleV2 {
  const raw = record(value);
  if (raw['format'] !== ENTITY_BUNDLE_FORMAT || raw['version'] !== ENTITY_BUNDLE_VERSION) {
    throw new Error('Formato não suportado. Pacotes v1 e backups não podem ser importados como entidade v2.');
  }
  keys(raw, ['format', 'version', 'exportedAt', 'root', 'entities', 'relationships', 'dynamicFields', 'layouts', 'externalReferences', 'assets']);
  if (typeof raw['exportedAt'] !== 'string' || !Number.isFinite(Date.parse(raw['exportedAt']))) throw new Error('Data de exportação inválida.');
  const root = ref(raw['root']);
  if (root.type !== 'Character') throw new Error('A raiz v2 deve ser um personagem.');
  const entities = array(raw['entities']);
  const relationships = array(raw['relationships']);
  const fields = array(raw['dynamicFields']);
  const layouts = array(raw['layouts']);
  const references = array(raw['externalReferences']);
  const assets = array(raw['assets']);
  if (entities.length + relationships.length + fields.length + layouts.length + references.length > ENTITY_BUNDLE_LIMITS.records) {
    throw new Error('O pacote excede o limite de registros.');
  }
  if (assets.length > ENTITY_BUNDLE_LIMITS.assets) throw new Error('O pacote excede o limite de imagens.');

  const uniqueKeys = new Set<string>();
  const entityByKey = new Map<string, { type: string; data: Record<string, unknown> }>();
  for (const item of entities) {
    const entry = record(item);
    keys(entry, ['type', 'key', 'schemaVersion', 'data']);
    if (!isPortableEntityType(entry['type']) || entry['schemaVersion'] !== 1) throw new Error('Tipo ou schema de entidade não suportado.');
    const key = uniqueKey(entry['key'], uniqueKeys);
    const data = record(entry['data']);
    validatePortableData(entry['type'], data);
    if (entry['type'] === 'Personalization' && data['contentJson']) throw new Error('Personalização requer o codec v2.');
    if (entry['type'] === 'Character') {
      if (Object.values(data).some(needsRichContentCodec)) throw new Error('Conteúdo estruturado requer o codec de texto/imagens v2.');
    }
    entityByKey.set(key, { type: entry['type'], data });
  }
  const rootEntity = entityByKey.get(root.key);
  if (!rootEntity || rootEntity.type !== root.type) throw new Error('Entidade raiz ausente.');
  const assertEntity = (reference: PortableEntityRef): void => {
    if (entityByKey.get(reference.key)?.type !== reference.type) throw new Error('Referência interna inválida.');
  };

  const fieldByKey = new Map<string, PortableDynamicField>();
  for (const item of fields) {
    const entry = record(item);
    keys(entry, ['key', 'entityTable', 'name', 'fieldType', 'isEditorField', 'options', 'targetEntityTable']);
    uniqueKey(entry['key'], uniqueKeys);
    validateDynamicField(entry);
    const field = entry as unknown as PortableDynamicField;
    fieldByKey.set(field.key, field);
  }
  const usedFields = new Set<string>();
  const externalByKey = new Map<string, Record<string, unknown>>();
  for (const item of references) {
    const entry = record(item);
    keys(entry, ['key', 'ownerKey', 'targetType', 'kind', 'fieldKey']);
    const key = uniqueKey(entry['key'], uniqueKeys);
    if (entityByKey.get(string(entry['ownerKey']))?.type !== 'Character'
      || !REFERENCE_TYPES.has(string(entry['targetType']))) throw new Error('Referência externa inválida.');
    if (entry['kind'] === 'dynamic-field') {
      const field = fieldByKey.get(string(entry['fieldKey']));
      if (!field || field.fieldType !== 'entity' || field.targetEntityTable !== entry['targetType']) throw new Error('Referência externa de campo inválida.');
    } else if (entry['kind'] !== 'relationship' || entry['fieldKey'] !== undefined) throw new Error('Tipo de referência externa inválido.');
    externalByKey.set(key, entry);
  }

  const parents = new Map<string, string>();
  const owners = new Map<string, string>();
  const children = new Map<string, string[]>();
  const edgeKeys = new Set<string>();
  for (const item of relationships) {
    const edge = record(item);
    keys(edge, ['kind', 'from', 'to']);
    const from = ref(edge['from']);
    const to = ref(edge['to']);
    assertEntity(from); assertEntity(to);
    const edgeKey = `${edge['kind']}:${from.key}:${to.key}`;
    if (edgeKeys.has(edgeKey)) throw new Error('Relação duplicada.');
    edgeKeys.add(edgeKey);
    if (edge['kind'] === 'hierarchy') {
      if (from.type !== 'Character' || to.type !== 'Character' || to.key === root.key || parents.has(to.key)) throw new Error('Hierarquia inválida.');
      parents.set(to.key, from.key);
      children.set(from.key, [...(children.get(from.key) ?? []), to.key]);
    } else if (edge['kind'] === 'owned') {
      if (from.type !== 'Character' || to.type === 'Character' || owners.has(to.key)) throw new Error('Dependência com proprietário inválido.');
      owners.set(to.key, from.key);
    } else throw new Error('Relação não suportada.');
  }
  const reached = new Set<string>();
  const queue = [{ key: root.key, depth: 0 }];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (reached.has(current.key) || current.depth > ENTITY_BUNDLE_LIMITS.depth) throw new Error('Ciclo ou profundidade inválida.');
    reached.add(current.key);
    queue.push(...(children.get(current.key) ?? []).map(key => ({ key, depth: current.depth + 1 })));
  }
  for (const [key, entity] of entityByKey) {
    if (entity.type === 'Character' ? !reached.has(key) : !reached.has(owners.get(key) ?? '')) throw new Error('Entidade fora da árvore exportada.');
  }

  const valueSlots = new Set<string>();
  const usedReferences = new Set<string>();
  for (const [key, entity] of entityByKey) {
    if (entity.type !== 'DynamicFieldValue') continue;
    const field = fieldByKey.get(string(entity.data['fieldKey']));
    if (!field) throw new Error('Definição dinâmica ausente.');
    const slot = `${owners.get(key)}:${field.key}`;
    if (valueSlots.has(slot)) throw new Error('Mais de um valor para o mesmo campo e proprietário.');
    valueSlots.add(slot);
    usedFields.add(field.key);
    const internal = entity.data['entityKey'];
    const external = entity.data['externalReferenceKey'];
    if (internal !== undefined || external !== undefined) {
      if (field.fieldType !== 'entity' || entity.data['value'] !== null || (internal !== undefined && external !== undefined)) throw new Error('Referência dinâmica inválida.');
      if (internal !== undefined && entityByKey.get(string(internal))?.type !== field.targetEntityTable) throw new Error('Alvo dinâmico interno inválido.');
      if (external !== undefined) {
        const reference = externalByKey.get(string(external));
        if (!reference || reference['kind'] !== 'dynamic-field' || reference['fieldKey'] !== field.key || reference['ownerKey'] !== owners.get(key)) throw new Error('Alvo dinâmico externo inválido.');
        usedReferences.add(string(external));
      }
    } else if (field.fieldType === 'entity' && entity.data['value']) throw new Error('IDs locais não são valores portáteis de entidade.');
    if ((field.fieldType === 'editor' || field.isEditorField) && needsRichContentCodec(entity.data['value'])) throw new Error('Conteúdo de editor requer o codec v2.');
    if (field.fieldType === 'image' && entity.data['value']) throw new Error('Galerias dinâmicas requerem o codec de assets v2.');
    validatePortableDynamicValue(field, entity.data['value']);
  }
  for (const [key, reference] of externalByKey) {
    if (reference['kind'] === 'dynamic-field' && !usedReferences.has(key)) throw new Error('Referência externa sem valor correspondente.');
  }
  const layoutOwners = new Set<string>();
  for (const item of layouts) {
    const entry = record(item);
    keys(entry, ['ownerKey', 'layout']);
    const ownerKey = string(entry['ownerKey']);
    if (entityByKey.get(ownerKey)?.type !== 'Character' || layoutOwners.has(ownerKey)) throw new Error('Proprietário do layout inválido.');
    layoutOwners.add(ownerKey);
    const layout = normalizeUiConfigPayload(entry['layout']);
    if (layout.tabs.length > 50 || layout.tabs.flatMap(tab => tab.items).length > 200) throw new Error('Layout excede o limite de itens.');
    for (const item of layout.tabs.flatMap(tab => tab.items)) {
      if (item.kind !== 'field') continue;
      if (item.token.startsWith('dynamic:') && fieldByKey.has(item.token.slice(8))) usedFields.add(item.token.slice(8));
      else if (!item.token.startsWith('schema:') || !CHARACTER_FIELDS.has(item.token.slice(7))) throw new Error('Campo do layout não declarado.');
    }
  }
  if ([...fieldByKey.keys()].some(key => !usedFields.has(key))) throw new Error('Definição dinâmica sem uso no pacote.');

  let totalBytes = 0;
  const assetKeys = new Set<string>();
  const assetPaths = new Set<string>();
  for (const item of assets) {
    const asset = record(item);
    keys(asset, ['key', 'path', 'mimeType', 'sizeBytes', 'sha256']);
    const key = uniqueKey(asset['key'], uniqueKeys);
    const path = string(asset['path']);
    if (path !== `assets/${key}` || assetPaths.has(path)) throw new Error('Caminho de asset inválido ou duplicado.');
    if (!MIME_TYPES.has(string(asset['mimeType'])) || !/^[a-f0-9]{64}$/.test(string(asset['sha256']))) throw new Error('Metadados de asset inválidos.');
    const size = asset['sizeBytes'];
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1 || size > ENTITY_BUNDLE_LIMITS.assetBytes) throw new Error('Tamanho de asset inválido.');
    totalBytes += size;
    if (totalBytes > ENTITY_BUNDLE_LIMITS.totalAssetBytes) throw new Error('Assets excedem o limite total.');
    assetKeys.add(key); assetPaths.add(path);
  }
  const usedAssets = new Set<string>();
  for (const entity of entityByKey.values()) {
    if (entity.type !== 'Image') continue;
    const key = string(entity.data['assetKey']);
    if (!assetKeys.has(key)) throw new Error('Asset de imagem ausente.');
    usedAssets.add(key);
  }
  if ([...assetKeys].some(key => !usedAssets.has(key))) throw new Error('Asset sem uso no pacote.');
  // Normalize layouts without retaining unrecognized metadata from a UI payload.
  const normalized = { ...raw, layouts: layouts.map(item => {
    const entry = record(item);
    return { ownerKey: entry['ownerKey'], layout: normalizeUiConfigPayload(entry['layout']) };
  }) };
  return immutableCopy(normalized as unknown as EntityBundleV2);
}

export function validateDynamicField(entry: Record<string, unknown>): void {
  if (entry['entityTable'] !== 'Character' || !string(entry['name']).trim()
    || !FIELD_TYPES.has(string(entry['fieldType'])) || typeof entry['isEditorField'] !== 'boolean') throw new Error('Definição dinâmica inválida.');
  if (entry['options'] !== undefined && typeof entry['options'] !== 'string') throw new Error('Opções dinâmicas inválidas.');
  if (entry['targetEntityTable'] !== undefined && !REFERENCE_TYPES.has(string(entry['targetEntityTable']))) throw new Error('Tipo alvo inválido.');
  if (entry['fieldType'] === 'entity' && !REFERENCE_TYPES.has(string(entry['targetEntityTable']))) throw new Error('Alvo do campo de entidade ausente.');
  if (!isValidDynamicFieldOptions(entry['fieldType'] as PortableDynamicField['fieldType'], entry['options'] as string | undefined)) throw new Error('Opções estruturadas inválidas.');
  if (entry['fieldType'] === 'list') {
    const options = record(JSON.parse(entry['options'] as string));
    keys(options, ['version', 'kind', 'mode', 'columns']);
    const columnIds = new Set<string>();
    for (const item of array(options['columns'])) {
      const column = record(item); keys(column, ['id', 'label', 'type']);
      uniqueKey(column['id'], columnIds); string(column['label']);
      if (!['text', 'number', 'boolean', 'date'].includes(string(column['type']))) throw new Error('Tipo de coluna inválido.');
    }
    if (options['mode'] === 'table' && !columnIds.size) throw new Error('A lista precisa de colunas.');
  }
}

export function needsRichContentCodec(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (/lorekit-asset:\/\/|(?:file|blob|data):|<\s*(?:img|iframe)\b/i.test(value)) return true;
  try { const parsed: unknown = JSON.parse(value); return parsed !== null && typeof parsed === 'object'; } catch { return false; }
}

export function validatePortableDynamicValue(field: PortableDynamicField, value: unknown): void {
  if (!value || !['slider', 'list', 'chart'].includes(field.fieldType)) return;
  let parsed: unknown;
  try { parsed = JSON.parse(string(value)); } catch { throw new Error('Valor dinâmico estruturado inválido.'); }
  const entry = record(parsed);
  if (field.fieldType === 'slider') {
    keys(entry, ['value']);
    if (typeof entry['value'] !== 'number' || !Number.isFinite(entry['value'])) throw new Error('Valor de slider inválido.');
    const options = record(JSON.parse(field.options!));
    const min = Number(options['min']); const max = Number(options['max']); const step = Number(options['step']);
    const position = (entry['value'] - min) / step;
    if (entry['value'] < min || entry['value'] > max || Math.abs(position - Math.round(position)) > 1e-6) throw new Error('Valor de slider fora da faixa ou do passo.');
  } else if (field.fieldType === 'list') {
    keys(entry, ['items']);
    const options = record(JSON.parse(field.options!));
    for (const item of array(entry['items'])) {
      if (options['mode'] === 'headless') { string(item); continue; }
      const row = record(item);
      const columns = array(options['columns']).map(record);
      keys(row, columns.map(column => string(column['id'])));
      for (const column of columns) {
        const cell = row[string(column['id'])];
        const type = column['type'];
        if (type === 'number' ? typeof cell !== 'number' || !Number.isFinite(cell)
          : type === 'boolean' ? typeof cell !== 'boolean' : typeof cell !== 'string') throw new Error('Célula de lista inválida.');
      }
    }
  } else {
    keys(entry, ['labels', 'series']);
    const labels = array(entry['labels']);
    if (!labels.every(item => typeof item === 'string') || labels.length > 12) throw new Error('Categorias de gráfico inválidas.');
    const seriesIds = new Set<string>();
    for (const item of array(entry['series'])) {
      const series = record(item); keys(series, ['id', 'values']); uniqueKey(series['id'], seriesIds);
      const values = array(series['values']);
      if (values.length !== labels.length || !values.every(item => typeof item === 'number' && Number.isFinite(item))) throw new Error('Série de gráfico inválida.');
    }
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objeto esperado no manifest.');
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Lista esperada no manifest.'); return value; }
function string(value: unknown): string { if (typeof value !== 'string' || !value) throw new Error('Texto obrigatório inválido.'); return value; }
function keys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Propriedade não permitida no manifest.');
}
function uniqueKey(value: unknown, seen: Set<string>): string {
  const key = string(value);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(key) || seen.has(key)) throw new Error('Chave inválida ou duplicada.');
  seen.add(key); return key;
}
function ref(value: unknown): PortableEntityRef {
  const entry = record(value); keys(entry, ['type', 'key']);
  if (!isPortableEntityType(entry['type']) || !/^[a-zA-Z0-9_-]{1,128}$/.test(string(entry['key']))) throw new Error('Referência de entidade inválida.');
  return entry as unknown as PortableEntityRef;
}
