import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { Character } from '../models/character.model';

@Injectable({
  providedIn: 'root'
})
export class CharacterService {
  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getCharacters(worldId: string | null | undefined) : Character[] {
    let existsRelation = worldId ? { parentId: worldId, parentTable: 'World' } : undefined;

    return this.crud.findAll('Character', {}, [
      {"table": "Personalization", "firstOnly": true},
      {"table": "Image", "firstOnly": false},
      {"table": "World", "firstOnly":true, "isParent": true},
      {"table": "Species", "firstOnly":true, "isParent": true},
      {"table": "Location", "firstOnly":true, "isParent": true}
    ], existsRelation);
  }

  getCharacter(characterId: string) : Character {
    return this.crud.findById('Character', characterId, [
      {"table": "Personalization", "firstOnly": true},
      {"table": "Image", "firstOnly": false},
      {"table": "World", "firstOnly":true, "isParent": true},
      {"table": "Species", "firstOnly":true, "isParent": true},
      {"table": "Location", "firstOnly":true, "isParent": true}
    ]);
  }

  saveCharacter(character: any, worldId: string | null, specieId: string | null) : Character {
    if (character.id != '') {
      character = <Character>this.crud.update('Character', character.id, character);

      this.crud.deleteWhen('Relationship', {
        parentTable: 'World',
        entityTable: 'Character',
        entityId: character.id
      });

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Character',
          entityId: character.id
        });
      }

      this.crud.deleteWhen('Relationship', {
        parentTable: 'Species',
        entityTable: 'Character',
        entityId: character.id
      });

      if (specieId) {
        this.crud.create('Relationship', {
          parentTable: 'Species',
          parentId: specieId,
          entityTable: 'Character',
          entityId: character.id
        });
      }

      return character;
    } else {
      const newCharacter = <Character>this.crud.create('Character', character);

      if (worldId) {
        this.crud.create('Relationship', {
          parentTable: 'World',
          parentId: worldId,
          entityTable: 'Character',
          entityId: newCharacter.id
        });
      }

      if (specieId) {
        this.crud.create('Relationship', {
          parentTable: 'Species',
          parentId: specieId,
          entityTable: 'Character',
          entityId: newCharacter.id
        });
      }

      return newCharacter;
    }
  }

  deleteCharacter(characterId: string, deleteRelationships: boolean = false) : void {
    this.crud.delete('Character', characterId, deleteRelationships);
  }

}
