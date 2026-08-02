export type SyncOperation = 'upsert' | 'delete';

export interface SyncEntityDefinition {
  readonly entityType: string;
  readonly primaryKey: 'id' | 'key';
  readonly schemaVersion: number;
  readonly localOnlyFields: readonly string[];
}

const entity = (
  entityType: string,
  primaryKey: 'id' | 'key' = 'id',
  localOnlyFields: readonly string[] = [],
): SyncEntityDefinition => ({
  entityType,
  primaryKey,
  schemaVersion: 1,
  localOnlyFields,
});

/**
 * Contrato único das entidades que podem atravessar a fronteira de sync.
 * Alterações aqui precisam ser acompanhadas por uma migration local e pela
 * allowlist equivalente no servidor.
 */
export const SYNC_ENTITIES = [
  entity('World'),
  entity('LocationCategory'),
  entity('Location'),
  entity('Item'),
  entity('Document'),
  entity('Personalization'),
  entity('Image', 'id', ['filePath']),
  entity('Species'),
  entity('Character'),
  entity('Relationship'),
  entity('Culture'),
  entity('GlobalParameter', 'key'),
  entity('Organization'),
  entity('OrganizationType'),
  entity('Object'),
  entity('ObjectType'),
  entity('Timeline'),
  entity('GreatMark'),
  entity('EventType'),
  entity('Event'),
  entity('Link'),
  entity('DynamicField'),
  entity('DynamicFieldValue'),
  entity('UiFieldConfig'),
  entity('UiFieldTemplate'),
  entity('Moodboard'),
  entity('MoodboardItem'),
  entity('IRPWCharacterSheet'),
  entity('IRPWSpecie'),
  entity('IRPWItem'),
  entity('IRPWVocation'),
] as const satisfies readonly SyncEntityDefinition[];

export const SYNC_ENTITY_BY_TYPE = new Map(
  SYNC_ENTITIES.map(definition => [definition.entityType, definition]),
);

export function getSyncEntity(entityType: string): SyncEntityDefinition {
  const definition = SYNC_ENTITY_BY_TYPE.get(entityType);
  if (!definition) {
    throw new Error(`Entidade não sincronizável: ${entityType}`);
  }
  return definition;
}

export function toSyncPayload(
  definition: SyncEntityDefinition,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const ignoredFields = new Set(definition.localOnlyFields);
  return Object.fromEntries(
    Object.entries(row).filter(([field]) => !ignoredFields.has(field)),
  );
}
