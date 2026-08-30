import { Character } from './character.model';
import { Culture } from './culture.model';
import { Document } from './document.model';
import { EventType } from './event-type.model';
import { Image } from './image.model';
import { Location } from './location.model';
import { Organization } from './organization.model';
import { Personalization } from './personalization.model';
import { Specie } from './specie.model';
import { Timeline } from './timeline.model';
import { TimelineEventRelatedEntity, TimelineEventRelationTable } from './timeline-event.model';
import { World } from './world.model';
import { WorldObject } from './object.model';

export class GreatMark {
  id: string;
  name: string;
  description: string;
  concept?: string | null;
  date: number;
  startDate: number;
  endDate: number;
  lane: number;
  displayDate?: string | null;
  sortOrder: number;

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
  Objects?: WorldObject[];

  constructor(id: string = '', name: string = '', description: string = '', date: number = 0) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.date = date;
    this.startDate = date;
    this.endDate = date;
    this.lane = 0;
    this.displayDate = '{AutoGenDate}';
    this.sortOrder = date;
    this.concept = '';
  }
}

export function buildGreatMarkRelatedEntities(mark: GreatMark): TimelineEventRelatedEntity[] {
  const refs: TimelineEventRelatedEntity[] = [];
  const pushItems = <T extends { id: string, Personalization?: Personalization }>(
    items: T[] | undefined,
    entityTable: TimelineEventRelationTable,
    getLabel: (item: T) => string,
    subtitle: string,
  ) => {
    for (const item of items || []) {
      refs.push({ entityTable, entityId: item.id, label: getLabel(item), subtitle, Personalization: item.Personalization });
    }
  };

  pushItems(mark.Worlds, 'World', item => item.name, 'Mundo');
  pushItems(mark.Documents, 'Document', item => item.title, 'Documento');
  pushItems(mark.Locations, 'Location', item => item.name, 'Localidade');
  pushItems(mark.Species, 'Species', item => item.name, 'Espécie');
  pushItems(mark.Characters, 'Character', item => item.name, 'Personagem');
  pushItems(mark.Cultures, 'Culture', item => item.name, 'Cultura');
  pushItems(mark.Organizations, 'Organization', item => item.name, 'Organização');
  pushItems(mark.Objects, 'Object', item => item.name, 'Objeto');
  return refs;
}
