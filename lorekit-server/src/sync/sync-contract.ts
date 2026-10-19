export const SYNC_CONTRACT_VERSION = 4;
export const SYNC_PUSH_LIMIT = 100;
export const SYNC_PULL_LIMIT = 500;

export const SYNC_ENTITY_TYPES = [
  'Calendar',
  'CalendarRevision',
  'World',
  'LocationCategory',
  'Location',
  'Item',
  'Document',
  'Personalization',
  'Image',
  'Species',
  'Character',
  'Relationship',
  'Culture',
  'GlobalParameter',
  'Organization',
  'OrganizationType',
  'Object',
  'ObjectType',
  'Timeline',
  'Age',
  'GreatMark',
  'EventType',
  'Event',
  'Link',
  'DynamicField',
  'DynamicFieldValue',
  'UiFieldConfig',
  'UiFieldTemplate',
  'Moodboard',
  'MoodboardItem',
  'IRPWCharacterSheet',
  'IRPWSpecie',
  'IRPWItem',
  'IRPWVocation',
  'IRPWCurrency',
  'IRPWNpc',
] as const;

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];
export type SyncOperationType = 'upsert' | 'delete';
