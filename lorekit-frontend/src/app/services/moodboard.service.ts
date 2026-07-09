import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { Moodboard, MoodboardItem } from '../models/moodboard.model';

@Injectable({
  providedIn: 'root',
})
export class MoodboardService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getMoodboards(worldId: string | null | undefined) : Moodboard[] {
    let existsRelation = worldId ? { parentId: worldId, parentTable: 'World' } : undefined;

    return this.crud.findAll('Moodboard', {}, [
      { "table": "Personalization", "firstOnly": true },
      { "table": "Image", "firstOnly": false },
      { "table": "World", "firstOnly": true, "isParent": true }
    ], existsRelation);
  }

  getMoodboard(id:string){
    return this.crud.findById('Moodboard', id, [
      { "table": "Personalization", "firstOnly": true },
      { "table": "Image", "firstOnly": false },
      { "table": "World", "firstOnly": true, "isParent": true },
      { "table": "MoodboardItem", "firstOnly": false }
    ]);
  }

  saveMoodboard(moodboard: Moodboard, worldId: string | null, items:MoodboardItem[]): Moodboard {
      if (moodboard.id != '') {
        moodboard = <Moodboard>this.crud.update('Moodboard', moodboard.id, moodboard);

        this.crud.deleteWhen('Relationship', {
          parentTable: 'World',
          entityTable: 'Moodboard',
          entityId: moodboard.id
        });

        if (worldId) {
          this.crud.create('Relationship', {
            parentTable: 'World',
            parentId: worldId,
            entityTable: 'Moodboard',
            entityId: moodboard.id
          });
        }

      } else {
        moodboard = <Moodboard>this.crud.create('Moodboard', moodboard);

        if (worldId) {
          this.crud.create('Relationship', {
            parentTable: 'World',
            parentId: worldId,
            entityTable: 'Moodboard',
            entityId: moodboard.id
          });
        }
      }

      if(items.length > 0){
        items.forEach(item => {
          this.saveMoodboardItem(item, moodboard.id);
        })
      }

      return moodboard;
    }

    saveMoodboardItem(item:MoodboardItem, moodboardId:string){

      if(item.id != ''){
        item = <MoodboardItem>this.crud.update('MoodboardItem', item.id, item);

        this.crud.deleteWhen('Relationship', {
          parentTable: 'Moodboard',
          entityTable: 'MoodboardItem',
          entityId: item.id
        });

        this.crud.create('Relationship', {
            parentTable: 'Moodboard',
            parentId: moodboardId,
            entityTable: 'MoodboardItem',
            entityId: item.id
          });
      }
      else{
        item = <MoodboardItem>this.crud.create('MoodboardItem', item);

        this.crud.create('Relationship', {
          parentTable: 'Moodboard',
          parentId: moodboardId,
          entityTable: 'MoodboardItem',
          entityId: item.id
        });
      }

    }
}
