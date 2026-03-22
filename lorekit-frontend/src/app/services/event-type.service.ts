import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { EventType } from '../models/event-type.model';

@Injectable({
  providedIn: 'root'
})
export class EventTypeService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getEventTypes(): EventType[] {
    return this.crud.findAll('EventType') as EventType[];
  }

  getEventTypeById(eventTypeId: string): EventType {
    return this.crud.findById('EventType', eventTypeId) as EventType;
  }

  saveEventType(eventType: EventType): EventType {
    if (eventType.id) {
      return this.crud.update('EventType', eventType.id, eventType) as EventType;
    }

    return this.crud.create('EventType', eventType) as EventType;
  }

  deleteEventType(eventType: EventType) {
    return this.crud.delete('EventType', eventType.id);
  }
}
