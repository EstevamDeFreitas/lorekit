import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { WorldObject } from '../models/object.model';

@Injectable({
  providedIn: 'root'
})
export class ObjectService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getObject(id: string): WorldObject {
    return this.crud.findById('Object', id, [
      { "table": "Personalization", "firstOnly": true },
      { "table": "Image", "firstOnly": false },
      { "table": "World", "firstOnly": true, "isParent": true },
      { "table": "Location", "firstOnly": true, "isParent": true },
      { "table": "ObjectType", "firstOnly": true }
    ]);
  }

  getObjects(worldId: string | null | undefined): WorldObject[] {
    let existsRelation = worldId ? { parentId: worldId, parentTable: 'World' } : undefined;

    return this.crud.findAll('Object', {}, [
      { "table": "Personalization", "firstOnly": true },
      { "table": "Image", "firstOnly": false },
      { "table": "World", "firstOnly": true, "isParent": true },
      { "table": "Location", "firstOnly": true, "isParent": true },
      { "table": "ObjectType", "firstOnly": true }
    ], existsRelation);
  }

  saveObject(object: WorldObject, worldId: string | null, locationId: string | null, objectTypeId: string | null): WorldObject {
    if (object.id != '') {
      object = <WorldObject>this.crud.update('Object', object.id, object);

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Location',
        entityTable: 'Object',
        entityId: object.id
      });

      if (locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Object',
          entityId: object.id
        });
      }

      this.crud.deleteWhen('Relationship', {
        parentTable: 'World',
        entityTable: 'Object',
        entityId: object.id
      });

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Object',
          entityId: object.id
        });
      }

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Object',
        parentId: object.id,
        entityTable: 'ObjectType',
      });

      if (objectTypeId) {
        this.crud.create('Relationship', {
          entityTable: 'ObjectType',
          entityId: objectTypeId,
          parentTable: 'Object',
          parentId: object.id
        });
      }

    } else {
      object = <WorldObject>this.crud.create('Object', object);

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Object',
          entityId: object.id
        });
      }

      if (locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Object',
          entityId: object.id
        });
      }

      if (objectTypeId) {
        this.crud.create('Relationship', {
          entityTable: 'ObjectType',
          entityId: objectTypeId,
          parentTable: 'Object',
          parentId: object.id
        });
      }
    }

    return object;
  }

  deleteObject(object: WorldObject, deleteRelatedItems: boolean = false) {
    return this.crud.delete('Object', object.id, deleteRelatedItems);
  }
}
