import { Injectable } from '@angular/core';
import { World } from '../models/world.model';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';

@Injectable({
  providedIn: 'root'
})
export class WorldService {

  private crud : CrudHelper;

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getWorlds() : World[] {
    return this.crud.findAll('World', {}, [{"table": "Personalization", "firstOnly": true}, {"table": "Image", "firstOnly": true}]);
  }

  getWorldById(id: string) : World {
    return this.crud.findById('World', id, [{"table": "Personalization", "firstOnly": true}, {"table": "Image", "firstOnly": true}]);
  }

  createWorld(world: World) {
    return this.crud.create('World', world);
  }

  updateWorld(id: string, world: World) {
    return this.crud.update('World', id, world);
  }

  deleteWorld(id: string, deleteRelatedItems: boolean = false) {
    return this.crud.delete('World', id, deleteRelatedItems);
  }

}
