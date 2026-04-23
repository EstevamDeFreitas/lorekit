import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { IrpwVocation } from '../models/irpw-vocation.model';

@Injectable({
  providedIn: 'root'
})
export class IrpwVocationService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getVocations(): IrpwVocation[] {
    return this.crud.findAll('IRPWVocation', {}, [
      { table: 'Personalization', firstOnly: true },
    ]) as IrpwVocation[];
  }

  getVocation(vocationId: string): IrpwVocation | null {
    return this.crud.findById('IRPWVocation', vocationId, [
      { table: 'Personalization', firstOnly: true },
    ]) as IrpwVocation | null;
  }

  saveVocation(vocation: IrpwVocation): IrpwVocation {
    if (vocation.id) {
      return this.crud.update('IRPWVocation', vocation.id, vocation) as IrpwVocation;
    }

    return this.crud.create('IRPWVocation', vocation) as IrpwVocation;
  }

  deleteVocation(vocationId: string): void {
    this.crud.delete('IRPWVocation', vocationId);
  }
}
