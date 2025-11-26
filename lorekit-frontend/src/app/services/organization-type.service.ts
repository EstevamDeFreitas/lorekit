import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { OrganizationType } from '../models/organization.model';

@Injectable({
  providedIn: 'root'
})
export class OrganizationTypeService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getOrganizationTypes() : OrganizationType[] {
    return this.crud.findAll('OrganizationType');
  }

  saveOrganizationType(orgType: OrganizationType) : OrganizationType {
    if (orgType.id != '') {
      return <OrganizationType>this.crud.update('OrganizationType', orgType.id, orgType);
    } else {
      return <OrganizationType>this.crud.create('OrganizationType', orgType);
    }
  }

  deleteOrganizationType(orgType: OrganizationType) {
    return this.crud.delete('OrganizationType', orgType.id);
  }

  getOrganizationTypeById(orgTypeId: string) : OrganizationType {
    return this.crud.findById('OrganizationType', orgTypeId);
  }

}
