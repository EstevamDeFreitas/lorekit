import { DynamicFieldType } from '../../models/dynamicfields.model';
import {
  ENTITY_BUNDLE_LIMITS, PortableDynamicField, PortabilityIssue, PortableEntityType,
} from '../../models/entity-bundle.model';
import { normalizeUiConfigPayload, UiConfigPayload } from '../../models/ui-field-config.model';
import { immutableCopy, projectPortableRow, REFERENCE_TYPES } from './entity-portability.registry';
import { needsRichContentCodec, validateDynamicField, validatePortableDynamicValue } from './entity-bundle.validator';

export interface LocalEntityRef { table: string; id: string; }
export interface LocalRelationship { parentTable: string; parentId: string; entityTable: string; entityId: string; }
export interface EntityExportSource {
  find(ref: LocalEntityRef): Record<string, unknown> | null;
  relationships(): readonly LocalRelationship[];
  /** Required seam for authorization; graph connectivity never grants read access. */
  canRead(ref: LocalEntityRef): boolean;
  layout(characterId: string): UiConfigPayload;
}
export interface PlannedExportEntity {
  source: LocalEntityRef;
  key: string;
  reason: 'root' | 'descendant' | 'owned';
  data: Record<string, unknown>;
}
export interface EntityExportPlan {
  rootKey: string;
  worldId: string;
  includeChildren: boolean;
  entities: PlannedExportEntity[];
  dynamicFields: Array<{ sourceId: string; definition: PortableDynamicField }>;
  layouts: Array<{ ownerKey: string; layout: UiConfigPayload }>;
  relationships: Array<{ kind: 'hierarchy' | 'owned'; fromKey: string; toKey: string }>;
  externalReferences: Array<{ ownerKey: string; targetType: string; kind: 'relationship' | 'dynamic-field' }>;
  issues: PortabilityIssue[];
}

/** An immutable local preview, not a serializable bundle. Source IDs stay local. */
export function planCharacterExport(
  source: EntityExportSource,
  rootId: string,
  options: { includeChildren?: boolean } = {},
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
    if (!issues.some(item => item.code === code && item.message === message)) issues.push({ code, message, blocking: true });
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
        dependencyData = projectPortableRow('DynamicFieldValue', { value: dependency['value'] ?? null, fieldKey: field.key });
        validatePortableDynamicValue(field, dependencyData['value']);
        if (field.fieldType === 'entity' && dependency['value']) {
          // Do not publish foreign IDs or guess identity by name in the preview.
          dependencyData['value'] = null;
          externalReferences.push({ ownerKey, targetType: field.targetEntityTable!, kind: 'dynamic-field' });
          issue('ENTITY_REFERENCE_CODEC_PENDING', 'Campos de entidade precisam de resolução e remapeamento v2.');
        }
        if (field.fieldType === 'image' && dependency['value']) {
          dependencyData['value'] = null;
          issue('ASSET_CODEC_PENDING', 'Uma galeria dinâmica precisa do empacotamento de assets v2.');
        }
        if ((field.fieldType === 'editor' || field.isEditorField) && needsRichContentCodec(dependency['value'])) issue('RICH_TEXT_CODEC_PENDING', 'Texto estruturado precisa do codec v2 antes de gerar o arquivo.');
      } else if (rel.entityTable === 'Image') {
        dependencyData = { usageKey: dependency['usageKey'] };
        issue('ASSET_CODEC_PENDING', 'Imagens precisam do empacotamento de assets v2.');
      } else {
        dependencyData = projectPortableRow(rel.entityTable as PortableEntityType, dependency);
        if (dependencyData['contentJson']) issue('RICH_TEXT_CODEC_PENDING', 'Personalização estruturada precisa de um adaptador v2.');
      }
      entities.push({ source: { table: rel.entityTable, id: rel.entityId }, key, reason: 'owned', data: dependencyData });
      edges.push({ kind: 'owned', fromKey: ownerKey, toKey: key });
      checkLimit();
    }
    for (const incoming of relations.filter(edge => edge.entityTable === 'Character' && edge.entityId === current.id)) {
      if (incoming.parentTable === 'World' || incoming.parentTable === 'Character') continue;
      if (REFERENCE_TYPES.has(incoming.parentTable)) externalReferences.push({ ownerKey, targetType: incoming.parentTable, kind: 'relationship' });
      else issue('UNSUPPORTED_DEPENDENCY', 'Há uma referência de entrada sem classificação v2.');
    }
    // Weak entity by ID, not a Relationship edge. Never silently miss it.
    const sheetRef = { table: 'IRPWCharacterSheet', id: current.id };
    if (!source.canRead(sheetRef) || source.find(sheetRef)) issue('UNSUPPORTED_DEPENDENCY', 'A ficha Ironpaw precisa de um adaptador v2 próprio.');
    checkLimit();
  }
  return immutableCopy({ rootKey: 'character-1', worldId, includeChildren, entities,
    dynamicFields: [...definitions.values()], layouts, relationships: edges, externalReferences, issues });
}
