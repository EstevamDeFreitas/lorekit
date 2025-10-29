import { Injectable } from '@angular/core';
import { environment } from '../../enviroments/environment';
import { HttpClient } from '@angular/common/http';
import { Location, LocationCategory } from '../models/location.model';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }


  getLocations(locationId?: string) : Location[] {
    if (locationId) {
      return this.crud.findAll('Location', {}, [{"table": "LocationCategory", "firstOnly": true}, {"table": "Image", "firstOnly": true}, {"table": "Personalization", "firstOnly": true}], {parentTable: 'Location', parentId: locationId});
    }

    return this.crud.findAll('Location', {}, [{"table": "LocationCategory", "firstOnly": true}, {"table": "Image", "firstOnly": true}, {"table": "Personalization", "firstOnly": true}]);
  }

  saveLocation(location: Location, locationCategoryId: string, worldId?: string, locationId?: string) : Location {
    if (location.id != '') {
      location = <Location>this.crud.update('Location', location.id, location);

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Location',
        parentId: location.id,
        entityTable: 'LocationCategory'
      });

      this.crud.create('Relationship', {
        parentTable: 'Location',
        parentId: location.id,
        entityTable: 'LocationCategory',
        entityId: locationCategoryId
      });

      if (locationId) {
        this.crud.deleteWhen('Relationship', {
          parentTable: 'Location',
          entityTable: 'Location',
          entityId: location.id
        });

        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Location',
          entityId: location.id
        });
      }

      if(worldId) {
        this.crud.deleteWhen('Relationship', {
          parentTable: 'World',
          entityTable: 'Location',
          entityId: location.id
        });

        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Location',
          entityId: location.id
        });
      }

      return location;
    } else {
      location = <Location>this.crud.create('Location', location);
      this.crud.create('Relationship', {
        parentTable: 'Location',
        parentId: location.id,
        entityTable: 'LocationCategory',
        entityId: locationCategoryId
      });
      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Location',
          entityId: location.id
        });
      }

      if(locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Location',
          entityId: location.id
        });
      }
      return location;
    }
  }

  deleteLocation(locationId: string, deleteRelatedItems: boolean = false) {
    return this.crud.delete('Location', locationId, deleteRelatedItems);
  }

  getLocationById(locationId: string) : Location {
    return this.crud.findById('Location', locationId, [
      {"table": "LocationCategory", "firstOnly": true},
      {"table": "Image", "firstOnly": true},
      {"table": "World", "firstOnly": true, "isParent":true},
      {"table": "Personalization", "firstOnly": true},
      {"table": "Location", "firstOnly": true, "isParent":true},
    ]);
  }

  getLocationByWorldId(worldId: string) : Location[] {
    return <Location[]>this.crud.findAll('Location', {}, [{"table": "LocationCategory", "firstOnly": true}, {"table": "Image", "firstOnly": true}, {"table": "Personalization", "firstOnly": true}], {parentTable: 'World', parentId: worldId});
  }

}
