import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../database/db-provider.service';

@Injectable({
  providedIn: 'root'
})
export class GlobalParameterService {
  constructor(private dbProvider : DbProvider) {}

  private get crud(): CrudHelper { return this.dbProvider.getCrudHelper(); }

  getParameter(key: string) : string | null {
    if (!this.dbProvider.ready()) return null;
    const param = this.crud.findFirst('GlobalParameter', {key: key});
    return param ? param.value : null;
  }

  setParameter(key: string, value: string) : void {
    const existing = this.crud.findFirst('GlobalParameter', {key: key});
    if (existing) {
      this.crud.updateKey('GlobalParameter', key, value);
    } else {
      this.crud.create('GlobalParameter', {key: key, value: value});
    }
  }

}
