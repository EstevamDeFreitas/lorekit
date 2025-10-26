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


  getLocations() : Location[] {
    return this.crud.findAll('Location', {}, [{"table": "LocationCategory", "firstOnly": true}, {"table": "Image", "firstOnly": true}, {"table": "Personalization", "firstOnly": true}]);
  }

  saveLocation(location: Location, locationCategoryId: string) : Location {
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

      return location;
    } else {
      location = <Location>this.crud.create('Location', location);
      this.crud.create('Relationship', {
        parentTable: 'Location',
        parentId: location.id,
        entityTable: 'LocationCategory',
        entityId: locationCategoryId
      });
      return location;
    }
  }

  deleteLocation(locationId: string, deleteRelatedItems: boolean = false) {
    return this.crud.delete('Location', locationId, deleteRelatedItems);
  }

  getLocationById(locationId: string) : Location {
    return this.crud.findById('Location', locationId, [{"table": "LocationCategory", "firstOnly": true}, {"table": "Image", "firstOnly": true}, {"table": "Personalization", "firstOnly": true}]);
  }

  getLocationByWorldId(worldId: string) : Location[] {
    return <Location[]>this.crud.findAll('Location', {}, [{"table": "LocationCategory", "firstOnly": true}, {"table": "Image", "firstOnly": true}, {"table": "Personalization", "firstOnly": true}], {parentTable: 'World', parentId: worldId});
  }

}
