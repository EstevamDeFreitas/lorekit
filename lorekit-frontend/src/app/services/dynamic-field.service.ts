import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { DynamicField, DynamicFieldValue } from '../models/dynamicfields.model';

@Injectable({
  providedIn: 'root'
})
export class DynamicFieldService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getDynamicFields(entityTable: string):DynamicField[] {
    let fields = this.crud.findAll('DynamicField', {entityTable: entityTable});

    return fields;
  }

  saveDynamicField(field: DynamicField): DynamicField {
    if (field.id != '') {
      field = <DynamicField>this.crud.update('DynamicField', field.id, field);
    } else {
      field = <DynamicField>this.crud.create('DynamicField', field);
    }
    return field;
  }

  deleteDynamicField(field: DynamicField) {
    this.crud.delete('DynamicField', field.id);
  }

  getEntityDynamicFieldsValues(entityTable: string, entityId: string): DynamicFieldValue[] {
    let value = this.crud.findAll('DynamicFieldValue', {}, [{"table": "DynamicField", "firstOnly": true, 'isParent':true}], {parentTable: entityTable, parentId: entityId});

    return value;
  }

  saveEntityDynamicFieldsValues(entityTable: string, entityId: string, values: DynamicFieldValue[]): void {
    values.forEach(value => {
      if (value.id != '') {
        this.crud.update('DynamicFieldValue', value.id, value);
      } else {
        let parent = value.ParentDynamicField;
        value = <DynamicFieldValue>this.crud.create('DynamicFieldValue', value);

        this.crud.create('Relationship', {
          parentTable: entityTable,
          parentId: entityId,
          entityTable: 'DynamicFieldValue',
          entityId: value.id
        });

        this.crud.create('Relationship', {
          parentTable: "DynamicField",
          parentId: parent?.id,
          entityTable: 'DynamicFieldValue',
          entityId: value.id
        });
      }
    });
  }

}
