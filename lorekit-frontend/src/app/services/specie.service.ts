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

  getSpecies(mainSpecieId: string | null | undefined, worldId: string | null | undefined): Specie[] {

    let existsRelation = mainSpecieId ? { parentId: mainSpecieId, parentTable: 'Species' } : undefined;

    if (!existsRelation && worldId && worldId != '') {
      existsRelation = { parentId: worldId, parentTable: 'World' };
    }

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

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Location',
        entityTable: 'Species',
        entityId: specie.id
      });

      if (locationId) {
        this.crud.create('Relationship', {
          parentTable: 'Location',
          parentId: locationId,
          entityTable: 'Species',
          entityId: specie.id
        });
      }

      this.crud.deleteWhen('Relationship', {
          parentTable: 'World',
          entityTable: 'Species',
          entityId: specie.id
        });

      if(worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Species',
          entityId: specie.id
        });
      }

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Species',
        entityTable: 'Species',
        entityId: specie.id
      });

      if(mainSpecie) {
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

  canReparentSpecie(specieId: string, parentSpecieId: string | null): boolean {
    try {
      this.assertCanReparentSpecie(specieId, parentSpecieId);
      return true;
    } catch {
      return false;
    }
  }

  reparentSpecie(specieId: string, parentSpecieId: string | null): Specie {
    this.assertCanReparentSpecie(specieId, parentSpecieId);

    this.crud.deleteWhen('Relationship', {
      parentTable: 'Species',
      entityTable: 'Species',
      entityId: specieId
    });

    if (parentSpecieId) {
      this.crud.create('Relationship', {
        parentTable: 'Species',
        parentId: parentSpecieId,
        entityTable: 'Species',
        entityId: specieId
      });
    }

    return this.getSpecie(specieId);
  }

  private assertCanReparentSpecie(specieId: string, parentSpecieId: string | null) {
    if (!specieId) {
      throw new Error('Espécie inválida para mover.');
    }

    if (specieId === parentSpecieId) {
      throw new Error('Uma espécie não pode ser filha de si mesma.');
    }

    const specie = this.getSpecie(specieId);
    if (!specie) {
      throw new Error('Espécie de origem não encontrada.');
    }

    if (!parentSpecieId) {
      return;
    }

    const parentSpecie = this.getSpecie(parentSpecieId);
    if (!parentSpecie) {
      throw new Error('Espécie de destino não encontrada.');
    }

    const specieWorldId = specie.ParentWorld?.id || null;
    const parentWorldId = parentSpecie.ParentWorld?.id || null;

    if (specieWorldId !== parentWorldId) {
      throw new Error('A espécie precisa continuar no mesmo mundo.');
    }

    if (this.isSpecieAncestor(specieId, parentSpecieId)) {
      throw new Error('Não é possível mover uma espécie para dentro de um descendente.');
    }
  }

  private isSpecieAncestor(ancestorId: string, specieId: string): boolean {
    let currentParentId = this.getParentSpecieId(specieId);

    while (currentParentId) {
      if (currentParentId === ancestorId) {
        return true;
      }

      currentParentId = this.getParentSpecieId(currentParentId);
    }

    return false;
  }

  private getParentSpecieId(specieId: string): string | null {
    const relationship = this.crud.findFirst('Relationship', {
      parentTable: 'Species',
      entityTable: 'Species',
      entityId: specieId
    }) as { parentId?: string } | null;

    return relationship?.parentId || null;
  }
}
