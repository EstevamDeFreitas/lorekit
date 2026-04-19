import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { IrpwCharacterSheet } from '../models/irpw-character-sheet.model';

@Injectable({
  providedIn: 'root'
})
export class IrpwCharacterSheetService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  /**
   * Returns the character sheet for a given character, or null if it does not yet exist.
   * The sheet ID mirrors the character ID (weak entity: sheet existence depends on character).
   */
  getSheet(characterId: string): IrpwCharacterSheet | null {
    return this.crud.findById('IRPWCharacterSheet', characterId);
  }

  /**
   * Creates or updates the character sheet for the given character.
   * On creation the sheet is given the same ID as the character.
   */
  saveSheet(characterId: string, sheet: IrpwCharacterSheet): IrpwCharacterSheet {
    const existing = this.crud.findById('IRPWCharacterSheet', characterId);
    if (existing) {
      return this.crud.update('IRPWCharacterSheet', characterId, sheet) as IrpwCharacterSheet;
    } else {
      const newSheet = { ...sheet, id: characterId };
      return this.crud.create('IRPWCharacterSheet', newSheet) as IrpwCharacterSheet;
    }
  }

  deleteSheet(characterId: string): void {
    this.crud.delete('IRPWCharacterSheet', characterId);
  }
}
