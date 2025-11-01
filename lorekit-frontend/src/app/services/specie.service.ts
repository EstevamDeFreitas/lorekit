import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { Specie } from '../models/specie.model';

@Injectable({
  providedIn: 'root'
})
export class SpecieService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getSpecies(mainSpecieId: string | null | undefined): Specie[] {

    let existsRelation = mainSpecieId ? { parentId: mainSpecieId, parentTable: 'Species' } : undefined;

    return this.crud.findAll('Species', {}, [
      {"table": "Personalization", "firstOnly": true},
      {"table": "Image", "firstOnly": false},
      {"table": "World", "firstOnly":true, "isParent": true},
      {"table": "Location", "firstOnly":true, "isParent": true},
      {"table": "Species", "firstOnly":true, "isParent": true}
    ], existsRelation);
  }

  getSpecie(specieId: string) : Specie {
    return this.crud.findById('Species', specieId, [
      {"table": "Personalization", "firstOnly": true},
      {"table": "Image", "firstOnly": false},
      {"table": "World", "firstOnly":true, "isParent": true},
      {"table": "Location", "firstOnly":true, "isParent": true},
      {"table": "Species", "firstOnly":true, "isParent": true}
    ]);
  }

  saveSpecie(specie: Specie, worldId: string | null, locationId: string | null, mainSpecie: string | null) : Specie {
    if (specie.id != '') {
      specie = <Specie>this.crud.update('Species', specie.id, specie);

      if (locationId) {
        this.crud.deleteWhen('Relationship', {
          parentTable: 'Location',
          entityTable: 'Species',
          entityId: specie.id
        });

        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Species',
          entityId: specie.id
        });
      }

      if(worldId) {
        this.crud.deleteWhen('Relationship', {
          parentTable: 'World',
          entityTable: 'Species',
          entityId: specie.id
        });

        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Species',
          entityId: specie.id
        });
      }

      if(mainSpecie) {
        this.crud.deleteWhen('Relationship', {
          parentTable: 'Species',
          entityTable: 'Species',
          entityId: specie.id
        });

        this.crud.create('Relationship', {
          parentTable: 'Species',
          parentId: mainSpecie,
          entityTable: 'Species',
          entityId: specie.id
        });
      }
    } else {
      specie = <Specie>this.crud.create('Species', specie);

      if(worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Species',
          entityId: specie.id
        });
      }

      if (locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Species',
          entityId: specie.id
        });
      }

      if(mainSpecie) {
        this.crud.create('Relationship', {
          parentTable: 'Species',
          parentId: mainSpecie,
          entityTable: 'Species',
          entityId: specie.id
        });
      }
    }

    return specie;
  }

  deleteSpecie(specieId: string, deleteRelatedItems: boolean = false) {
    return this.crud.delete('Species', specieId, deleteRelatedItems);
  }
}
