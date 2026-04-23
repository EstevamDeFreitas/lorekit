import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { IrpwSpecie } from '../models/irpw-specie.model';

@Injectable({
  providedIn: 'root'
})
export class IrpwSpecieService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getConfig(specieId: string): IrpwSpecie | null {
    return this.crud.findById('IRPWSpecie', specieId) as IrpwSpecie | null;
  }

  saveConfig(specieId: string, config: IrpwSpecie): IrpwSpecie {
    const existing = this.crud.findById('IRPWSpecie', specieId);
    if (existing) {
      return this.crud.update('IRPWSpecie', specieId, config) as IrpwSpecie;
    }

    return this.crud.create('IRPWSpecie', { ...config, id: specieId }) as IrpwSpecie;
  }
}
