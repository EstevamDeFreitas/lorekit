import { Character } from "./character.model";
import { Culture } from "./culture.model";
import { Document } from "./document.model";
import { EventType } from "./event-type.model";
import { Image } from "./image.model";
import { Location } from "./location.model";
import { Organization } from "./organization.model";
import { Personalization } from "./personalization.model";
import { Specie } from "./specie.model";
import { Timeline } from "./timeline.model";
import { World } from "./world.model";

export const timelineEventRelationTables = [
  'World',
  'Document',
  'Location',
  'Species',
  'Character',
  'Culture',
  'Organization',
] as const;

export type TimelineEventRelationTable = typeof timelineEventRelationTables[number];

export interface TimelineEventRelatedEntity {
  entityTable: TimelineEventRelationTable;
  entityId: string;
  label: string;
  subtitle: string;
}

export class TimelineEvent {
  id: string;
  name: string;
  description: string;
  concept?: string | null;
  date?: string | null;
  sortOrder: number;
  chronologyOrder: number;

  Images?: Image[];
  Personalization?: Personalization | null;
  ParentTimeline?: Timeline | null;
  ParentLocation?: Location | null;
  ParentEventType?: EventType | null;

  Worlds?: World[];
  Documents?: Document[];
  Locations?: Location[];
  Species?: Specie[];
  Characters?: Character[];
  Cultures?: Culture[];
  Organizations?: Organization[];

  constructor(
    id: string = '',
    name: string = '',
    description: string = '',
    sortOrder: number = 0,
    chronologyOrder: number = 0,
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.sortOrder = sortOrder;
    this.chronologyOrder = chronologyOrder;
    this.concept = '';
    this.date = '';
  }
}

export function buildTimelineEventRelatedEntities(event: TimelineEvent): TimelineEventRelatedEntity[] {
  const refs: TimelineEventRelatedEntity[] = [];

  const pushItems = <T extends { id: string }>(
    items: T[] | undefined,
    entityTable: TimelineEventRelationTable,
    getLabel: (item: T) => string,
    subtitle: string,
  ) => {
    for (const item of items || []) {
      refs.push({
        entityTable,
        entityId: item.id,
        label: getLabel(item),
        subtitle,
      });
    }
  };

  pushItems(event.Worlds, 'World', item => item.name, 'Mundo');
  pushItems(event.Documents, 'Document', item => item.title, 'Documento');
  pushItems(event.Locations, 'Location', item => item.name, 'Localidade');
  pushItems(event.Species, 'Species', item => item.name, 'Espécie');
  pushItems(event.Characters, 'Character', item => item.name, 'Personagem');
  pushItems(event.Cultures, 'Culture', item => item.name, 'Cultura');
  pushItems(event.Organizations, 'Organization', item => item.name, 'Organização');

  return refs;
}
