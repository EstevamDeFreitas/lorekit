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
      return this.crud.findAll('Location', {}, [{"table": "LocationCategory", "firstOnly": true}, {"table": "Image", "firstOnly": false}, {"table": "Personalization", "firstOnly": true}, {"table": "Location", "firstOnly": true, "isParent":true}, {"table": "World", "firstOnly": true, "isParent":true}], {parentTable: 'Location', parentId: locationId});
    }

    return this.crud.findAll('Location', {}, [{"table": "LocationCategory", "firstOnly": true}, {"table": "Image", "firstOnly": false}, {"table": "Personalization", "firstOnly": true}, {"table": "World", "firstOnly": true, "isParent":true}]);
  }

  saveLocation(location: Location, locationCategoryId: string, worldId?: string, locationId?: string) : Location {
    if (location.id != '') {
      location = <Location>this.crud.update('Location', location.id, location);

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Location',
        parentId: location.id,
        entityTable: 'LocationCategory'
      });

      if(locationCategoryId){
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: location.id,
          entityTable: 'LocationCategory',
          entityId: locationCategoryId
        });
      }

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Location',
        entityTable: 'Location',
        entityId: location.id
      });

      if (locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Location',
          entityId: location.id
        });
      }

      this.crud.deleteWhen('Relationship', {
        parentTable: 'World',
        entityTable: 'Location',
        entityId: location.id
      });

      if(worldId) {
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
      {"table": "Image", "firstOnly": false},
      {"table": "World", "firstOnly": true, "isParent":true},
      {"table": "Personalization", "firstOnly": true},
      {"table": "Location", "firstOnly": true, "isParent":true},
    ]);
  }

  getLocationByWorldId(worldId: string) : Location[] {
    return <Location[]>this.crud.findAll('Location', {}, [{"table": "LocationCategory", "firstOnly": true}, {"table": "Image", "firstOnly": false}, {"table": "Personalization", "firstOnly": true}, {"table": "Location", "firstOnly": true, "isParent":true}, {"table": "World", "firstOnly": true, "isParent":true}], {parentTable: 'World', parentId: worldId});
  }

  canReparentLocation(locationId: string, parentLocationId: string | null): boolean {
    try {
      this.assertCanReparentLocation(locationId, parentLocationId);
      return true;
    } catch {
      return false;
    }
  }

  reparentLocation(locationId: string, parentLocationId: string | null): Location {
    this.assertCanReparentLocation(locationId, parentLocationId);

    this.crud.deleteWhen('Relationship', {
      parentTable: 'Location',
      entityTable: 'Location',
      entityId: locationId
    });

    if (parentLocationId) {
      this.crud.create('Relationship', {
        parentTable: 'Location',
        parentId: parentLocationId,
        entityTable: 'Location',
        entityId: locationId
      });
    }

    return this.getLocationById(locationId);
  }

  private assertCanReparentLocation(locationId: string, parentLocationId: string | null) {
    if (!locationId) {
      throw new Error('Localidade inválida para mover.');
    }

    if (locationId === parentLocationId) {
      throw new Error('Uma localidade não pode ser filha de si mesma.');
    }

    const location = this.getLocationById(locationId);
    if (!location) {
      throw new Error('Localidade de origem não encontrada.');
    }

    if (!parentLocationId) {
      return;
    }

    const parentLocation = this.getLocationById(parentLocationId);
    if (!parentLocation) {
      throw new Error('Localidade de destino não encontrada.');
    }

    const locationWorldId = location.ParentWorld?.id || null;
    const parentWorldId = parentLocation.ParentWorld?.id || null;

    if (locationWorldId !== parentWorldId) {
      throw new Error('A localidade precisa continuar no mesmo mundo.');
    }

    if (this.isLocationAncestor(locationId, parentLocationId)) {
      throw new Error('Não é possível mover uma localidade para dentro de um descendente.');
    }
  }

  private isLocationAncestor(ancestorId: string, locationId: string): boolean {
    let currentParentId = this.getParentLocationId(locationId);

    while (currentParentId) {
      if (currentParentId === ancestorId) {
        return true;
      }

      currentParentId = this.getParentLocationId(currentParentId);
    }

    return false;
  }

  private getParentLocationId(locationId: string): string | null {
    const relationship = this.crud.findFirst('Relationship', {
      parentTable: 'Location',
      entityTable: 'Location',
      entityId: locationId
    }) as { parentId?: string } | null;

    return relationship?.parentId || null;
  }

}
