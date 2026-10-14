import { Injectable, inject, signal } from '@angular/core';
import { DbProvider } from '../app.config';
import { IrpwCurrency, parseWallet, validateCurrency } from '../models/irpw-currency.model';
import { IrpwCharacterSheet } from '../models/irpw-character-sheet.model';

@Injectable({ providedIn: 'root' })
export class IrpwCurrencyService {
  private readonly crud = inject(DbProvider).getCrudHelper();
  readonly changes = signal(0);
  getCurrencies(): IrpwCurrency[] {
    return (this.crud.findAll('IRPWCurrency') as { id: string; name: string; description: string; unitsJson: string }[]).flatMap(row => {
      try {
        const units = JSON.parse(row.unitsJson) as IrpwCurrency['units'];
        if (!Array.isArray(units) || units.some(unit => !unit || typeof unit.id !== 'string' || typeof unit.name !== 'string')) return [];
        const currency = { id: row.id, name: row.name ?? '', description: row.description ?? '', units };
        return validateCurrency(currency).length ? [] : [currency];
      } catch { return []; }
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  saveCurrency(currency: IrpwCurrency): IrpwCurrency {
    const errors = validateCurrency(currency);
    if (errors.length) throw new Error(errors.join(' '));
    const previous = this.getCurrencies().find(item => item.id === currency.id);
    const removed = previous?.units.filter(unit => !currency.units.some(next => next.id === unit.id)) ?? [];
    if (removed.length && (this.crud.findAll('IRPWCharacterSheet') as IrpwCharacterSheet[]).some(sheet => {
      const wallet = parseWallet(sheet.wallet);
      return !!sheet.wallet && (!wallet || wallet.accounts.some(account => account.currencyId === currency.id && removed.some(unit => account.balances[unit.id] > 0)));
    })) throw new Error('Uma unidade removida ainda tem saldo em uma ficha. Zere ou transfira esse saldo antes de removê-la.');
    const saved = { ...structuredClone(currency), id: currency.id || crypto.randomUUID(), name: currency.name.trim() };
    const row = { id: saved.id, name: saved.name, description: saved.description, unitsJson: JSON.stringify(saved.units) };
    if (previous) this.crud.update('IRPWCurrency', saved.id, row); else this.crud.create('IRPWCurrency', row);
    this.changes.update(value => value + 1);
    return saved;
  }
}
