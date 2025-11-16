import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class CultureService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getCultures(worldId: string | null | undefined) : any[] {
    let existsRelation = worldId ? { parentId: worldId, parentTable: 'World' } : undefined;

    return this.crud.findAll('Culture', {}, [
      {"table": "Personalization", "firstOnly": true},
      {"table": "Image", "firstOnly": false},
      {"table": "World", "firstOnly":true, "isParent": true},
      {"table": "Location", "firstOnly":true, "isParent": true}
    ], existsRelation);
  }

  getCulture(cultureId: string) : any {
    return this.crud.findById('Culture', cultureId, [
      {"table": "Personalization", "firstOnly": true},
      {"table": "Image", "firstOnly": false},
      {"table": "World", "firstOnly":true, "isParent": true},
      {"table": "Location", "firstOnly":true, "isParent": true}
    ]);
  }

  saveCulture(culture: any, worldId: string | null, locationId: string | null) : any {
    if (culture.id != '') {
      culture = this.crud.update('Culture', culture.id, culture);

      this.crud.deleteWhen('Relationship', {
        parentTable: 'World',
        entityTable: 'Culture',
        entityId: culture.id
      });

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Culture',
          entityId: culture.id
        });
      }

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Location',
        entityTable: 'Culture',
        entityId: culture.id
      });

      if (locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Culture',
          entityId: culture.id
        });
      }
    } else {
      culture = this.crud.create('Culture', culture);

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Culture',
          entityId: culture.id
        });
      }

      if (locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Culture',
          entityId: culture.id
        });
      }
    }
    return culture;
  }

  deleteCulture(cultureId: string, deleteRelationships: boolean = false) : void {
    this.crud.delete('Culture', cultureId, deleteRelationships);
  }
}
