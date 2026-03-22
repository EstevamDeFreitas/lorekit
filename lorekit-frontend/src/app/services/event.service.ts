import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import {
  TimelineEvent,
  TimelineEventRelatedEntity,
  timelineEventRelationTables,
} from '../models/timeline-event.model';

export interface SaveTimelineEventPayload {
  timelineId: string;
  eventTypeId?: string | null;
  locationId?: string | null;
  relatedEntities?: TimelineEventRelatedEntity[];
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getEventsByTimelineId(timelineId: string): TimelineEvent[] {
    const events = this.crud.findAll('Event', {}, this.getEventIncludes(), {
      parentTable: 'Timeline',
      parentId: timelineId,
    }) as TimelineEvent[];

    return events.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getEventById(eventId: string): TimelineEvent {
    return this.crud.findById('Event', eventId, this.getEventIncludes()) as TimelineEvent;
  }

  saveEvent(event: TimelineEvent, payload: SaveTimelineEventPayload): TimelineEvent {
    if (event.id) {
      this.crud.update('Event', event.id, event);
    } else {
      event = this.crud.create('Event', event) as TimelineEvent;
    }

    this.syncTimelineRelationship(event.id, payload.timelineId);
    this.syncSingleParentRelationship('EventType', event.id, payload.eventTypeId);
    this.syncSingleParentRelationship('Location', event.id, payload.locationId);
    this.syncRelatedEntities(event.id, payload.relatedEntities || []);

    return this.getEventById(event.id);
  }

  saveEventOrdering(events: Array<Pick<TimelineEvent, 'id' | 'sortOrder' | 'chronologyOrder'>>) {
    for (const event of events) {
      this.crud.update('Event', event.id, {
        sortOrder: event.sortOrder,
        chronologyOrder: event.chronologyOrder,
      });
    }
  }

  deleteEvent(eventId: string, deleteRelatedItems: boolean = true) {
    return this.crud.delete('Event', eventId, deleteRelatedItems);
  }

  private getEventIncludes() {
    return [
      { table: 'Image', firstOnly: false },
      { table: 'Personalization', firstOnly: true },
      { table: 'Timeline', firstOnly: true, isParent: true },
      { table: 'EventType', firstOnly: true, isParent: true },
      { table: 'Location', firstOnly: true, isParent: true },
      ...timelineEventRelationTables.map(table => ({ table, firstOnly: false })),
    ];
  }

  private syncTimelineRelationship(eventId: string, timelineId: string) {
    this.crud.deleteWhen('Relationship', {
      parentTable: 'Timeline',
      entityTable: 'Event',
      entityId: eventId,
    });

    this.crud.create('Relationship', {
      parentTable: 'Timeline',
      parentId: timelineId,
      entityTable: 'Event',
      entityId: eventId,
    });
  }

  private syncSingleParentRelationship(parentTable: 'EventType' | 'Location', eventId: string, parentId?: string | null) {
    this.crud.deleteWhen('Relationship', {
      parentTable,
      entityTable: 'Event',
      entityId: eventId,
    });

    if (!parentId) {
      return;
    }

    this.crud.create('Relationship', {
      parentTable,
      parentId,
      entityTable: 'Event',
      entityId: eventId,
    });
  }

  private syncRelatedEntities(eventId: string, relatedEntities: TimelineEventRelatedEntity[]) {
    for (const table of timelineEventRelationTables) {
      this.crud.deleteWhen('Relationship', {
        parentTable: 'Event',
        parentId: eventId,
        entityTable: table,
      });
    }

    const uniqueRefs = relatedEntities.filter((item, index, arr) =>
      arr.findIndex(candidate => candidate.entityTable === item.entityTable && candidate.entityId === item.entityId) === index
    );

    for (const relatedEntity of uniqueRefs) {
      this.crud.create('Relationship', {
        parentTable: 'Event',
        parentId: eventId,
        entityTable: relatedEntity.entityTable,
        entityId: relatedEntity.entityId,
      });
    }
  }
}
