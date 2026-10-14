import { DynamicFieldType } from '../../models/dynamicfields.model';
import {
  ENTITY_BUNDLE_LIMITS, PortableDynamicField, PortabilityIssue, PortableEntityType,
} from '../../models/entity-bundle.model';
import { normalizeUiConfigPayload, UiConfigPayload } from '../../models/ui-field-config.model';
import { immutableCopy, projectPortableRow, REFERENCE_TYPES } from './entity-portability.registry';
import { needsRichContentCodec, validateDynamicField, validatePortableDynamicValue, normalizeLegacyDynamicValue } from './entity-bundle.validator';

export interface LocalEntityRef { table: string; id: string; }
export interface LocalRelationship { parentTable: string; parentId: string; entityTable: string; entityId: string; }
export interface EntityExportSource {
  find(ref: LocalEntityRef): Record<string, unknown> | null;
  relationships(): readonly LocalRelationship[];
  links?(): readonly Record<string, unknown>[];
  /** Required seam for authorization; graph connectivity never grants read access. */
  canRead(ref: LocalEntityRef): boolean;
  layout(characterId: string): UiConfigPayload;
}
export interface PlannedExportEntity {
  source: LocalEntityRef;
  key: string;
  reason: 'root' | 'descendant' | 'owned';
  data: Record<string, unknown>;
  ownerCharacterKey?: string;
}
export interface EntityExportPlan {
  rootKey: string;
  worldId: string;
  includeChildren: boolean;
  entities: PlannedExportEntity[];
  dynamicFields: Array<{ sourceId: string; definition: PortableDynamicField }>;
  layouts: Array<{ ownerKey: string; layout: UiConfigPayload }>;
  relationships: Array<{ kind: 'hierarchy' | 'owned'; fromKey: string; toKey: string }>;
  externalReferences: Array<{ ownerKey: string; targetType: string; kind: 'relationship' | 'dynamic-field'; sourceId?: string; fieldKey?: string; label?: string }>;
  issues: PortabilityIssue[];
}

/** An immutable local preview, not a serializable bundle. Source IDs stay local. */
export function planCharacterExport(
  source: EntityExportSource,
  rootId: string,
  options: { includeChildren?: boolean; omitUnsupported?: boolean } = {},
): EntityExportPlan {
  const relations = source.relationships();
  const includeChildren = options.includeChildren !== false;
  const entities: PlannedExportEntity[] = [];
  const definitions = new Map<string, { sourceId: string; definition: PortableDynamicField }>();
  const layouts: EntityExportPlan['layouts'] = [];
  const edges: EntityExportPlan['relationships'] = [];
  const externalReferences: EntityExportPlan['externalReferences'] = [];
  const issues: PortabilityIssue[] = [];
  const visited = new Set<string>();
  const parentEdges = (id: string) => relations.filter(row => row.entityTable === 'Character' && row.entityId === id && row.parentTable === 'Character');
  const read = (table: string, id: string): Record<string, unknown> => {
    const reference = { table, id };
    if (!source.canRead(reference)) throw new Error('Acesso de leitura negado ao conteúdo selecionado.');
    const row = source.find(reference);
    if (!row) throw new Error('Uma entidade necessária não foi encontrada.');
    return row;
  };
  const world = (id: string): string => {
    const memberships = relations.filter(row => row.entityTable === 'Character' && row.entityId === id && row.parentTable === 'World');
    if (memberships.length !== 1) throw new Error('O personagem precisa ter um vínculo único e direto com um mundo.');
    read('World', memberships[0].parentId);
    return memberships[0].parentId;
  };
  read('Character', rootId);
  const worldId = world(rootId);
  // Validate ancestry without including or reading ancestor content.
  let ancestor: string | undefined = rootId;
  const ancestors = new Set<string>();
  while (ancestor) {
    if (ancestors.has(ancestor) || ancestors.size > ENTITY_BUNDLE_LIMITS.depth) throw new Error('Ciclo ou profundidade inválida na hierarquia.');
    ancestors.add(ancestor);
    if (world(ancestor) !== worldId) throw new Error('A hierarquia atravessa mundos.');
    const parents = parentEdges(ancestor);
    if (parents.length > 1) throw new Error('Mais de um pai estrutural para o personagem.');
    ancestor = parents[0]?.parentId;
  }
  const issue = (code: PortabilityIssue['code'], message: string): void => {
    if (!issues.some(item => item.code === code && item.message === message)) issues.push({ code, message, blocking: code === 'UNSUPPORTED_DEPENDENCY' && !options.omitUnsupported });
  };
  const checkLimit = (): void => {
    const count = entities.length + edges.length + definitions.size + layouts.length + externalReferences.length;
    if (count > ENTITY_BUNDLE_LIMITS.records) throw new Error('O plano excede o limite de registros.');
  };
  const addField = (fieldId: string): PortableDynamicField => {
    const existing = definitions.get(fieldId);
    if (existing) return existing.definition;
    const row = read('DynamicField', fieldId);
    const definition: PortableDynamicField = {
      key: `field-${definitions.size + 1}`,
      entityTable: row['entityTable'] as 'Character',
      name: row['name'] as string,
      fieldType: (row['fieldType'] || 'text') as DynamicFieldType,
      isEditorField: row['isEditorField'] === true || row['isEditorField'] === 1,
      ...(typeof row['options'] === 'string' ? { options: row['options'] } : {}),
      ...(typeof row['targetEntityTable'] === 'string' && row['targetEntityTable'] ? { targetEntityTable: row['targetEntityTable'] } : {}),
    };
    validateDynamicField(definition as unknown as Record<string, unknown>);
    definitions.set(fieldId, { sourceId: fieldId, definition });
    checkLimit();
    return definition;
  };
  const currencyKeys = new Map<string, string>();
  const documentIds = new Set<string>();
  const collectDocument = (id: string, parentKey: string, ownerKey: string, depth: number): void => {
    if (documentIds.has(id) || depth > ENTITY_BUNDLE_LIMITS.depth) throw new Error('Documento compartilhado, cíclico ou profundo demais.');
    documentIds.add(id);
    const incoming = relations.filter(row => row.entityTable === 'Document' && row.entityId === id);
    if (incoming.filter(row => row.parentTable !== 'World').length !== 1 || incoming.some(row => row.parentTable === 'World' && row.parentId !== worldId)) throw new Error('Proprietário ou mundo do documento inválido.');
    const row = read('Document', id); const key = `document-${documentIds.size}`;
    entities.push({ source: { table: 'Document', id }, key, reason: 'owned', ownerCharacterKey: ownerKey, data: projectPortableRow('Document', row) });
    edges.push({ kind: 'owned', fromKey: parentKey, toKey: key }); checkLimit();
    for (const outgoing of relations.filter(edge => edge.parentTable === 'Document' && edge.parentId === id)) {
      if (outgoing.entityTable === 'Document') { collectDocument(outgoing.entityId, key, ownerKey, depth + 1); continue; }
      if (!['Image', 'Personalization'].includes(outgoing.entityTable)) { issue('UNSUPPORTED_DEPENDENCY', 'Anexo de documento sem adaptador v2.'); continue; }
      const owners = relations.filter(edge => edge.entityTable === outgoing.entityTable && edge.entityId === outgoing.entityId);
      if (owners.length !== 1) throw new Error('Dependência de documento com proprietário ambíguo.');
      const data = read(outgoing.entityTable, outgoing.entityId); const ownedKey = `owned-${entities.length + 1}`;
      entities.push({ source: { table: outgoing.entityTable, id: outgoing.entityId }, key: ownedKey, reason: 'owned', ownerCharacterKey: ownerKey,
        data: outgoing.entityTable === 'Image' ? { ...data } : projectPortableRow('Personalization', data) });
      edges.push({ kind: 'owned', fromKey: key, toKey: ownedKey }); checkLimit();
    }
  };
  const queue = [{ id: rootId, depth: 0, parentKey: null as string | null }];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (visited.has(current.id) || current.depth > ENTITY_BUNDLE_LIMITS.depth) throw new Error('Ciclo ou profundidade inválida na hierarquia.');
    visited.add(current.id);
    if (world(current.id) !== worldId) throw new Error('Uma entidade filha pertence a outro mundo.');
    if (parentEdges(current.id).length > 1) throw new Error('Mais de um pai estrutural para o personagem.');
    const row = read('Character', current.id);
    const ownerKey = `character-${index + 1}`;
    const data = projectPortableRow('Character', row);
    entities.push({ source: { table: 'Character', id: current.id }, key: ownerKey, reason: index === 0 ? 'root' : 'descendant', data });
    if (Object.values(data).some(needsRichContentCodec)) issue('RICH_TEXT_CODEC_PENDING', 'Texto estruturado precisa do codec v2 antes de gerar o arquivo.');
    if (current.parentKey) edges.push({ kind: 'hierarchy', fromKey: current.parentKey, toKey: ownerKey });
    const layout = normalizeUiConfigPayload(source.layout(current.id));
    // UI item/tab IDs may embed local field IDs, so generate package-local IDs too.
    layout.tabs.forEach((tab, tabIndex) => {
      tab.id = `tab-${tabIndex + 1}`;
      tab.items.forEach((item, itemIndex) => {
        item.id = `item-${tabIndex + 1}-${itemIndex + 1}`;
        if (item.kind === 'field' && item.token.startsWith('dynamic:')) {
          item.token = `dynamic:${addField(item.token.slice(8)).key}`;
        }
      });
    });
    layouts.push({ ownerKey, layout });

    const owned = relations.filter(rel => rel.parentTable === 'Character' && rel.parentId === current.id);
    const slots = new Set<string>();
    for (const rel of owned) {
      if (rel.entityTable === 'Character') {
        if (includeChildren) {
          queue.push({ id: rel.entityId, depth: current.depth + 1, parentKey: ownerKey });
          if (queue.length > ENTITY_BUNDLE_LIMITS.records) throw new Error('A hierarquia excede o limite de registros.');
        }
        continue;
      }
      if (rel.entityTable === 'Document') { collectDocument(rel.entityId, ownerKey, ownerKey, 0); continue; }
      if (!['Personalization', 'Image', 'DynamicFieldValue'].includes(rel.entityTable)) {
        issue('UNSUPPORTED_DEPENDENCY', 'Há uma dependência sem adaptador v2. Nenhum conteúdo dessa dependência foi coletado.');
        continue;
      }
      const owners = relations.filter(edge => edge.entityTable === rel.entityTable && edge.entityId === rel.entityId && edge.parentTable !== 'DynamicField');
      if (owners.length !== 1) throw new Error('Uma dependência possui proprietário ambíguo.');
      const dependency = read(rel.entityTable, rel.entityId);
      const key = `owned-${entities.length + 1}`;
      let dependencyData: Record<string, unknown>;
      if (rel.entityTable === 'DynamicFieldValue') {
        const fieldEdges = relations.filter(edge => edge.entityTable === 'DynamicFieldValue' && edge.entityId === rel.entityId && edge.parentTable === 'DynamicField');
        if (fieldEdges.length !== 1) throw new Error('O valor dinâmico precisa de uma definição única.');
        const field = addField(fieldEdges[0].parentId);
        if (slots.has(field.key)) throw new Error('Mais de um valor para o mesmo campo e proprietário.');
        slots.add(field.key);
        dependencyData = projectPortableRow('DynamicFieldValue', { value: normalizeLegacyDynamicValue(field, dependency['value'] ?? null), fieldKey: field.key });
        validatePortableDynamicValue(field, dependencyData['value']);
        if (field.fieldType === 'entity' && dependency['value']) {
          // Do not publish foreign IDs or guess identity by name in the preview.
          externalReferences.push({ ownerKey, targetType: field.targetEntityTable!, kind: 'dynamic-field', sourceId: String(dependency['value']), fieldKey: field.key });
          issue('ENTITY_REFERENCE_CODEC_PENDING', 'Campos de entidade precisam de resolução e remapeamento v2.');
        }
        if (field.fieldType === 'image' && dependency['value']) {
          issue('ASSET_CODEC_PENDING', 'Uma galeria dinâmica precisa do empacotamento de assets v2.');
        }
        if ((field.fieldType === 'editor' || field.isEditorField) && needsRichContentCodec(dependency['value'])) issue('RICH_TEXT_CODEC_PENDING', 'Texto estruturado precisa do codec v2 antes de gerar o arquivo.');
      } else if (rel.entityTable === 'Image') {
        dependencyData = { ...dependency }; // Local snapshot only; builder projects portable image metadata.
        issue('ASSET_CODEC_PENDING', 'Imagens precisam do empacotamento de assets v2.');
      } else {
        dependencyData = projectPortableRow(rel.entityTable as PortableEntityType, dependency);
        if (dependencyData['contentJson']) issue('RICH_TEXT_CODEC_PENDING', 'Personalização estruturada precisa de um adaptador v2.');
      }
      entities.push({ source: { table: rel.entityTable, id: rel.entityId }, key, reason: 'owned', ownerCharacterKey: ownerKey, data: dependencyData });
      edges.push({ kind: 'owned', fromKey: ownerKey, toKey: key });
      checkLimit();
    }
    for (const incoming of relations.filter(edge => edge.entityTable === 'Character' && edge.entityId === current.id)) {
      if (incoming.parentTable === 'World' || incoming.parentTable === 'Character') continue;
      if (REFERENCE_TYPES.has(incoming.parentTable)) externalReferences.push({ ownerKey, targetType: incoming.parentTable, kind: 'relationship', sourceId: incoming.parentId });
      else issue('UNSUPPORTED_DEPENDENCY', 'Há uma referência de entrada sem classificação v2.');
    }
    // Weak entity by ID, not a Relationship edge. Never silently miss it.
    const sheetRef = { table: 'IRPWCharacterSheet', id: current.id };
    if (!source.canRead(sheetRef)) throw new Error('Acesso de leitura negado à ficha.');
    const sheet = source.find(sheetRef);
    if (sheet) {
      const key = `sheet-${index + 1}`;
      entities.push({ source: sheetRef, key, reason: 'owned', ownerCharacterKey: ownerKey, data: projectPortableRow('IRPWCharacterSheet', { ...sheet, ownerKey }) });
      edges.push({ kind: 'owned', fromKey: ownerKey, toKey: key });
      if (typeof sheet['wallet'] === 'string' && sheet['wallet']) {
        const wallet = JSON.parse(sheet['wallet']);
        if (wallet.version !== 1 || !Array.isArray(wallet.accounts)) throw new Error('Carteira Ironpaw inválida.');
        for (const account of wallet.accounts) {
          if (typeof account.currencyId !== 'string') throw new Error('Moeda da carteira inválida.');
          let currencyKey = currencyKeys.get(account.currencyId);
          if (!currencyKey) {
            currencyKey = `currency-${currencyKeys.size + 1}`; const currency = read('IRPWCurrency', account.currencyId);
            currencyKeys.set(account.currencyId, currencyKey);
            entities.push({ source: { table: 'IRPWCurrency', id: account.currencyId }, key: currencyKey, reason: 'owned', ownerCharacterKey: ownerKey, data: projectPortableRow('IRPWCurrency', { ...currency, description: currency['description'] ?? '' }) });
          }
          if (!edges.some(edge => edge.fromKey === ownerKey && edge.toKey === currencyKey)) edges.push({ kind: 'owned', fromKey: ownerKey, toKey: currencyKey });
        }
      }
    }
    checkLimit();
  }
  const selected = new Set(entities.filter(node => node.source.table === 'Character').map(node => node.source.id));
  if ((source.links?.() ?? []).some(link => (link['fromTable'] === 'Character' && selected.has(String(link['fromId']))) || (link['toTable'] === 'Character' && selected.has(String(link['toId']))))) issue('UNSUPPORTED_DEPENDENCY', 'Conexões do grafo (Link) não são anexos portáteis nesta versão.');
  return immutableCopy({ rootKey: 'character-1', worldId, includeChildren, entities,
    dynamicFields: [...definitions.values()], layouts, relationships: edges, externalReferences, issues });
}
