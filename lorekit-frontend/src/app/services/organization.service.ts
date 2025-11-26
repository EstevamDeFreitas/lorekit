import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { Organization } from '../models/organization.model';

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getOrganization(id: string): Organization {
    return this.crud.findById('Organization', id, [
      {"table": "Personalization", "firstOnly": true},
      {"table": "Image", "firstOnly": false},
      {"table": "World", "firstOnly":true, "isParent": true},
      {"table": "Location", "firstOnly":true, "isParent": true},
      {"table": "OrganizationType", "firstOnly":true}
    ]);
  }

  getOrganizations(worldId: string | null | undefined): Organization[] {
    let existsRelation = worldId ? { parentId: worldId, parentTable: 'World' } : undefined;

    return this.crud.findAll('Organization', {}, [
      {"table": "Personalization", "firstOnly": true},
      {"table": "Image", "firstOnly": false},
      {"table": "World", "firstOnly":true, "isParent": true},
      {"table": "Location", "firstOnly":true, "isParent": true},
      {"table": "OrganizationType", "firstOnly":true}
    ], existsRelation);
  }

  saveOrganization(organization: Organization, worldId: string | null, locationId: string | null, organizationTypeId: string | null) : Organization {
    if (organization.id != '') {
      organization = <Organization>this.crud.update('Organization', organization.id, organization);

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Location',
        entityTable: 'Organization',
        entityId: organization.id
      });

      if (locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Organization',
          entityId: organization.id
        });
      }

      this.crud.deleteWhen('Relationship', {
        parentTable: 'World',
        entityTable: 'Organization',
        entityId: organization.id
      });

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Organization',
          entityId: organization.id
        });
      }

      this.crud.deleteWhen('Relationship', {
        parentTable: 'OrganizationType',
        parentId: organization.id,
        entityTable: 'OrganizationType',
      });

      if (organizationTypeId) {
        this.crud.create('Relationship', {
          entityTable: 'OrganizationType',
          entityId: organizationTypeId,
          parentTable: 'Organization',
          parentId: organization.id
        });
      }

    } else {
      organization = <Organization>this.crud.create('Organization', organization);

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Organization',
          entityId: organization.id
        });
      }

      if (locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Organization',
          entityId: organization.id
        });
      }

      if (organizationTypeId) {
        this.crud.create('Relationship', {
          entityTable: 'OrganizationType',
          entityId: organizationTypeId,
          parentTable: 'Organization',
          parentId: organization.id
        });
      }
    }

    return organization;
  }

  deleteOrganization(organization: Organization, deleteRelatedItems: boolean = false) {
    return this.crud.delete('Organization', organization.id, deleteRelatedItems);
  }

}
