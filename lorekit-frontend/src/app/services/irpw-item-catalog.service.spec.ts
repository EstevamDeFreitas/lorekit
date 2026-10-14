import { TestBed } from '@angular/core/testing';
import { DbProvider } from '../app.config';
import { IrpwItemCatalogService } from './irpw-item-catalog.service';
import { IrpwCharacterSheetService } from './irpw-character-sheet.service';
import { createEmptyInventory, createEmptyItemDefinition, parseIrpwInventory } from '../models/irpw-item.model';

describe('Shared item catalog persistence', () => {
  let catalog: IrpwItemCatalogService;
  let sheets: IrpwCharacterSheetService;
  let rows: Record<string, Record<string, Record<string, unknown>>>;
  beforeEach(() => {
    rows = { Item: {}, IRPWItem: {}, IRPWCharacterSheet: {} };
    const crud = {
      findAll: (table: string) => Object.values(rows[table] ?? {}).map(row => structuredClone(row)),
      findById: (table: string, id: string) => rows[table]?.[id] ? structuredClone(rows[table][id]) : null,
      create: (table: string, data: Record<string, unknown>) => { const id = String(data['id']); rows[table][id] = structuredClone(data); return structuredClone(data); },
      update: (table: string, id: string, data: Record<string, unknown>) => { rows[table][id] = { ...rows[table][id], ...structuredClone(data) }; return structuredClone(rows[table][id]); },
    };
    TestBed.configureTestingModule({ providers: [{ provide: DbProvider, useValue: { getCrudHelper: () => crud } }] });
    catalog = TestBed.inject(IrpwItemCatalogService); sheets = TestBed.inject(IrpwCharacterSheetService);
  });
  it('updates every linked sheet, preserving quantities, notes, and wallet', () => {
    const item = catalog.saveItem({ ...catalog.createDraft('weapon'), name: 'Espada' });
    const inventory = createEmptyInventory();
    inventory.entries.push({ instanceId: 'one', sourceItemId: item.id, quantity: 7, notes: 'Presente', location: 'backpack', snapshot: { name: 'Espada', description: '', definition: createEmptyItemDefinition('weapon') } }); inventory.backpackOrder.push('one');
    for (const id of ['a', 'b']) sheets.saveSheet(id, { id, inventory: JSON.stringify(inventory), wallet: 'saldo preservado' });
    const stale = sheets.getSheet('a')!;
    catalog.saveItem({ ...item, name: 'Espada encantada', effects: 'Luz', definition: { ...item.definition, stackLimit: 3 } });
    for (const id of ['a', 'b']) {
      const sheet = sheets.getSheet(id)!; const resolved = parseIrpwInventory(sheet.inventory)!;
      expect(resolved.entries.every(entry => entry.snapshot.name === 'Espada encantada' && entry.snapshot.effects === 'Luz')).toBeTrue();
      expect(resolved.entries.reduce((total, entry) => total + entry.quantity, 0)).toBe(7);
      expect(resolved.entries.every(entry => entry.notes === 'Presente')).toBeTrue();
      expect(sheet.wallet).toBe('saldo preservado');
    }
    sheets.saveSheet('a', stale);
    expect(parseIrpwInventory(sheets.getSheet('a')!.inventory)!.entries[0].snapshot.name).toBe('Espada encantada');
  });
  it('keeps unsupported inventory payloads untouched', () => {
    sheets.saveSheet('unknown', { id: 'unknown', inventory: '{"version":99,"entries":[]}' });
    catalog.saveItem({ ...catalog.createDraft(), name: 'Corda' });
    expect(sheets.getSheet('unknown')!.inventory).toBe('{"version":99,"entries":[]}');
  });
});
