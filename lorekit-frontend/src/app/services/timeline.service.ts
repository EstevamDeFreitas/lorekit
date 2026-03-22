import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { Timeline } from '../models/timeline.model';

@Injectable({
  providedIn: 'root'
})
export class TimelineService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getTimelines(worldId?: string | null): Timeline[] {
    const existsRelation = worldId ? { parentTable: 'World', parentId: worldId } : undefined;

    return this.crud.findAll('Timeline', {}, [
      { table: 'Personalization', firstOnly: true },
      { table: 'Image', firstOnly: false },
      { table: 'World', firstOnly: true, isParent: true },
    ], existsRelation);
  }

  getTimelineById(id: string): Timeline {
    return this.crud.findById('Timeline', id, [
      { table: 'Personalization', firstOnly: true },
      { table: 'Image', firstOnly: false },
      { table: 'World', firstOnly: true, isParent: true },
    ]);
  }

  saveTimeline(timeline: Timeline, worldId?: string | null): Timeline {
    if (timeline.id) {
      timeline = this.crud.update('Timeline', timeline.id, timeline) as Timeline;

      this.crud.deleteWhen('Relationship', {
        parentTable: 'World',
        entityTable: 'Timeline',
        entityId: timeline.id,
      });

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Timeline',
          entityId: timeline.id,
        });
      }

      return timeline;
    }

    timeline = this.crud.create('Timeline', timeline) as Timeline;

    if (worldId) {
      this.crud.create('Relationship', {
        parentTable: 'World',
        parentId: worldId,
        entityTable: 'Timeline',
        entityId: timeline.id,
      });
    }

    return timeline;
  }

  deleteTimeline(timelineId: string, deleteRelatedItems: boolean = true) {
    return this.crud.delete('Timeline', timelineId, deleteRelatedItems);
  }
}
