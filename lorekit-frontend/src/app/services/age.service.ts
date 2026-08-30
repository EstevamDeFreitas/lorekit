import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { Age } from '../models/age.model';
@Injectable({ providedIn: 'root' })
export class AgeService {
  private readonly crud: CrudHelper;
  constructor(private readonly dbProvider: DbProvider) {
    this.crud = dbProvider.getCrudHelper();
  }
  getAgesByTimelineId(timelineId: string): Age[] {
    return (this.crud.findAll('Age', {}, this.includes(), {
      parentTable: 'Timeline',
      parentId: timelineId,
    }) as Age[]).sort((a, b) => a.startDate - b.startDate || a.endDate - b.endDate);
  }
  getAgeById(ageId: string): Age {
    return this.crud.findById('Age', ageId, this.includes()) as Age;
  }
  saveAge(age: Age, timelineId: string): Age {
    age.startDate = Math.round(Number(age.startDate) || 0);
    age.endDate = Math.max(age.startDate, Math.round(Number(age.endDate) || 0));
    age = age.id
      ? this.crud.update('Age', age.id, age) as Age
      : this.crud.create('Age', age) as Age;
    this.crud.deleteWhen('Relationship', {
      parentTable: 'Timeline', entityTable: 'Age', entityId: age.id,
    });
    this.crud.create('Relationship', {
      parentTable: 'Timeline', parentId: timelineId, entityTable: 'Age', entityId: age.id,
    });
    return this.getAgeById(age.id);
  }
  async saveRange(ageId: string, startDate: number, endDate: number): Promise<void> {
    const start = Math.round(startDate);
    this.crud.update('Age', ageId, {
      startDate: start,
      endDate: Math.max(start, Math.round(endDate)),
    });
    await this.dbProvider.flushPendingWrites();
  }
  deleteAge(ageId: string, deleteRelatedItems: boolean = true) {
    return this.crud.delete('Age', ageId, deleteRelatedItems);
  }
  private includes() {
    return [
      { table: 'Image', firstOnly: false },
      { table: 'Personalization', firstOnly: true },
      { table: 'Timeline', firstOnly: true, isParent: true },
    ];
  }
}
