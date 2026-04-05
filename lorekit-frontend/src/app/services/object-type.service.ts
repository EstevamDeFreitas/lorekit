import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { ObjectType } from '../models/object.model';

@Injectable({
  providedIn: 'root'
})
export class ObjectTypeService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getObjectTypes(): ObjectType[] {
    return this.crud.findAll('ObjectType');
  }

  saveObjectType(objectType: ObjectType): ObjectType {
    if (objectType.id != '') {
      return <ObjectType>this.crud.update('ObjectType', objectType.id, objectType);
    } else {
      return <ObjectType>this.crud.create('ObjectType', objectType);
    }
  }

  deleteObjectType(objectType: ObjectType) {
    return this.crud.delete('ObjectType', objectType.id);
  }

  getObjectTypeById(objectTypeId: string): ObjectType {
    return this.crud.findById('ObjectType', objectTypeId);
  }
}
