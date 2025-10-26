import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../enviroments/environment';
import { Personalization } from '../models/personalization.model';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class PersonalizationService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }
  getPersonalization(entityTable: string, entityId: string) : Personalization {
    let entity = this.crud.findById(entityTable, entityId, [{"table": "Personalization", "firstOnly": true}]);

    return entity.Personalization;
  }

  savePersonalization(personalization: Personalization, entityTable?: string, entityId?: string) : Personalization {
    if (personalization.id != '') {
      personalization = <Personalization>this.crud.update('Personalization', personalization.id, personalization);
    } else {
      personalization = <Personalization>this.crud.create('Personalization', personalization);

      this.crud.create('Relationship', {
        parentTable: entityTable,
        parentId: entityId,
        entityTable: 'Personalization',
        entityId: personalization.id
      });
    }
    return personalization;
  }



}
