import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { GreatMark } from '../models/great-mark.model';

@Injectable({
  providedIn: 'root'
})
export class GreatMarkService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getGreatMarksByTimelineId(timelineId: string): GreatMark[] {
    const marks = this.crud.findAll('GreatMark', {}, [
      { table: 'Image', firstOnly: false },
      { table: 'Personalization', firstOnly: true },
      { table: 'Timeline', firstOnly: true, isParent: true },
    ], { parentTable: 'Timeline', parentId: timelineId }) as GreatMark[];

    return marks
      .map(mark => this.normalizeDate(mark))
      .sort((a, b) => a.date - b.date);
  }

  getGreatMarkById(markId: string): GreatMark {
    const mark = this.crud.findById('GreatMark', markId, [
      { table: 'Image', firstOnly: false },
      { table: 'Personalization', firstOnly: true },
      { table: 'Timeline', firstOnly: true, isParent: true },
    ]) as GreatMark;
    return mark ? this.normalizeDate(mark) : mark;
  }

  saveGreatMark(mark: GreatMark, timelineId: string): GreatMark {
    mark.date = Math.round(Number(mark.date) || 0);
    mark.sortOrder = mark.date;
    if (mark.id) {
      mark = this.crud.update('GreatMark', mark.id, mark) as GreatMark;
    } else {
      mark = this.crud.create('GreatMark', mark) as GreatMark;
    }

    this.crud.deleteWhen('Relationship', {
      parentTable: 'Timeline',
      entityTable: 'GreatMark',
      entityId: mark.id,
    });

    this.crud.create('Relationship', {
      parentTable: 'Timeline',
      parentId: timelineId,
      entityTable: 'GreatMark',
      entityId: mark.id,
    });

    return this.getGreatMarkById(mark.id);
  }
  async saveDate(markId: string, date: number): Promise<void> {
    const fallback = this.getGreatMarkById(markId);
    const rawValue = Number(date);
    const value = Number.isFinite(rawValue) ? Math.round(rawValue) : Math.round(Number(fallback?.date ?? fallback?.sortOrder ?? 0));
    this.crud.update('GreatMark', markId, { date: value, sortOrder: value });
    await this.dbProvider.flushPendingWrites();
  }

  private normalizeDate(mark: GreatMark): GreatMark {
    const legacyOrder = Number(mark.sortOrder);
    const rawDate = Number(mark.date);
    const hasExplicitDate = mark.date !== null && mark.date !== undefined && Number.isFinite(rawDate);
    const date = hasExplicitDate ? Math.round(rawDate) : (Number.isFinite(legacyOrder) ? Math.round(legacyOrder) : 0);
    mark.date = date;
    mark.sortOrder = Number.isFinite(legacyOrder) ? Math.round(legacyOrder) : date;
    return mark;
  }
  deleteGreatMark(markId: string, deleteRelatedItems: boolean = true) {
    return this.crud.delete('GreatMark', markId, deleteRelatedItems);
  }

  saveGreatMarkOrdering(marks: Array<Pick<GreatMark, 'id' | 'sortOrder'>>) {
    for (const mark of marks) {
      this.crud.update('GreatMark', mark.id, {
        sortOrder: mark.sortOrder,
      });
    }
  }
}
