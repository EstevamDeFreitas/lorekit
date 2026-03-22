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

    return marks.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getGreatMarkById(markId: string): GreatMark {
    return this.crud.findById('GreatMark', markId, [
      { table: 'Image', firstOnly: false },
      { table: 'Personalization', firstOnly: true },
      { table: 'Timeline', firstOnly: true, isParent: true },
    ]);
  }

  saveGreatMark(mark: GreatMark, timelineId: string): GreatMark {
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
