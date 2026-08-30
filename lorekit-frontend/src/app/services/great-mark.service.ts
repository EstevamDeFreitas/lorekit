import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { GreatMark } from '../models/great-mark.model';
import { TimelineEventRelatedEntity, timelineEventRelationTables } from '../models/timeline-event.model';

export interface SaveGreatMarkPayload {
  timelineId: string;
  eventTypeId?: string | null;
  locationId?: string | null;
  relatedEntities?: TimelineEventRelatedEntity[];
}

@Injectable({
  providedIn: 'root',
})
export class GreatMarkService {
  private readonly crud: CrudHelper;

  constructor(private readonly dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getGreatMarksByTimelineId(timelineId: string): GreatMark[] {
    const marks = this.crud.findAll('GreatMark', {}, this.getGreatMarkIncludes(), {
      parentTable: 'Timeline',
      parentId: timelineId,
    }) as GreatMark[];
    return marks.map(mark => this.normalizeRange(mark)).sort((a, b) => a.date - b.date);
  }

  getGreatMarkById(markId: string): GreatMark {
    const mark = this.crud.findById('GreatMark', markId, this.getGreatMarkIncludes()) as GreatMark;
    return mark ? this.normalizeRange(mark) : mark;
  }

  saveGreatMark(mark: GreatMark, payload: SaveGreatMarkPayload): GreatMark {
    this.normalizeRange(mark, true);
    if (mark.id) {
      this.crud.update('GreatMark', mark.id, mark);
    } else {
      mark = this.crud.create('GreatMark', mark) as GreatMark;
    }

    this.syncTimelineRelationship(mark.id, payload.timelineId);
    this.syncSingleParentRelationship('EventType', mark.id, payload.eventTypeId);
    this.syncSingleParentRelationship('Location', mark.id, payload.locationId);
    this.syncRelatedEntities(mark.id, payload.relatedEntities || []);
    return this.getGreatMarkById(mark.id);
  }

  async saveDate(markId: string, date: number): Promise<void> {
    const mark = this.getGreatMarkById(markId);
    const rawValue = Number(date);
    const value = Number.isFinite(rawValue) ? Math.round(rawValue) : Math.round(Number(mark?.date ?? mark?.sortOrder ?? 0));
    const duration = Math.max(0, (mark?.endDate ?? value) - (mark?.startDate ?? value));
    const startDate = Math.round(value - duration / 2);
    this.crud.update('GreatMark', markId, {
      date: value,
      startDate,
      endDate: startDate + duration,
      sortOrder: value,
    });
    await this.dbProvider.flushPendingWrites();
  }

  deleteGreatMark(markId: string, deleteRelatedItems: boolean = true) {
    return this.crud.delete('GreatMark', markId, deleteRelatedItems);
  }

  saveGreatMarkOrdering(marks: Array<Pick<GreatMark, 'id' | 'sortOrder'>>) {
    for (const mark of marks) this.crud.update('GreatMark', mark.id, { sortOrder: mark.sortOrder });
  }

  private normalizeRange(mark: GreatMark, deriveDateFromRange = false): GreatMark {
    const legacyDate = this.finiteInteger(mark.date, this.finiteInteger(mark.sortOrder, 0));
    const rawStart = Number(mark.startDate);
    const rawEnd = Number(mark.endDate);
    const usesLegacyPoint = (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd) || (rawStart === 0 && rawEnd === 0 && legacyDate !== 0));
    mark.startDate = usesLegacyPoint ? legacyDate : Math.round(rawStart);
    mark.endDate = usesLegacyPoint ? legacyDate : Math.max(mark.startDate, Math.round(rawEnd));
    mark.lane = Math.max(0, this.finiteInteger(mark.lane, 0));
    mark.displayDate = mark.displayDate || '{AutoGenDate}';
    mark.date = deriveDateFromRange ? Math.round((mark.startDate + mark.endDate) / 2) : legacyDate;
    mark.sortOrder = mark.date;
    return mark;
  }

  private finiteInteger(value: unknown, fallback: number): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
  }

  private getGreatMarkIncludes() {
    return [
      { table: 'Image', firstOnly: false },
      { table: 'Personalization', firstOnly: true },
      { table: 'Timeline', firstOnly: true, isParent: true },
      { table: 'EventType', firstOnly: true, isParent: true },
      { table: 'Location', firstOnly: true, isParent: true },
      ...timelineEventRelationTables.map(table => ({ table, firstOnly: false, subInclude: [{ table: 'Personalization', firstOnly: true }] })),
    ];
  }

  private syncTimelineRelationship(markId: string, timelineId: string): void {
    this.crud.deleteWhen('Relationship', { parentTable: 'Timeline', entityTable: 'GreatMark', entityId: markId });
    this.crud.create('Relationship', { parentTable: 'Timeline', parentId: timelineId, entityTable: 'GreatMark', entityId: markId });
  }

  private syncSingleParentRelationship(parentTable: 'EventType' | 'Location', markId: string, parentId?: string | null): void {
    this.crud.deleteWhen('Relationship', { parentTable, entityTable: 'GreatMark', entityId: markId });
    if (parentId) this.crud.create('Relationship', { parentTable, parentId, entityTable: 'GreatMark', entityId: markId });
  }

  private syncRelatedEntities(markId: string, relatedEntities: TimelineEventRelatedEntity[]): void {
    for (const table of timelineEventRelationTables) {
      this.crud.deleteWhen('Relationship', { parentTable: 'GreatMark', parentId: markId, entityTable: table });
    }
    const uniqueRefs = relatedEntities.filter((item, index, items) =>
      items.findIndex(candidate => candidate.entityTable === item.entityTable && candidate.entityId === item.entityId) === index,
    );
    for (const relatedEntity of uniqueRefs) {
      this.crud.create('Relationship', {
        parentTable: 'GreatMark', parentId: markId, entityTable: relatedEntity.entityTable, entityId: relatedEntity.entityId,
      });
    }
  }
}
