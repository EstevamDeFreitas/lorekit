export interface EntityStyle {
  color: string;
  icon: string;
}

export type StyledEntityTable =
  | 'World'
  | 'Location'
  | 'Document'
  | 'Timeline'
  | 'Moodboard'
  | 'Species'
  | 'Character'
  | 'Culture'
  | 'Organization'
  | 'Object'
  | 'Relationship';

export const ENTITY_STYLES: Record<StyledEntityTable, EntityStyle> = {
  World: { color: 'yellow-400', icon: 'fa-solid fa-earth' },
  Location: { color: 'emerald-400', icon: 'fa-solid fa-location-dot' },
  Document: { color: 'olive-400', icon: 'fa-solid fa-file' },
  Timeline: { color: 'mist-400', icon: 'fa-solid fa-timeline' },
  Moodboard: { color: 'pink-400', icon: 'fa-solid fa-table-cells-large' },
  Species: { color: 'lime-400', icon: 'fa-solid fa-paw' },
  Character: { color: 'sky-400', icon: 'fa-solid fa-users' },
  Culture: { color: 'amber-400', icon: 'fa-solid fa-mortar-pestle' },
  Organization: { color: 'blue-400', icon: 'fa-solid fa-building' },
  Object: { color: 'rose-400', icon: 'fa-solid fa-cube' },
  Relationship: { color: 'green-400', icon: 'fa-solid fa-share-nodes' },
};

export function getEntityStyle(entityTable: string): EntityStyle | undefined {
  return ENTITY_STYLES[entityTable as StyledEntityTable];
}
