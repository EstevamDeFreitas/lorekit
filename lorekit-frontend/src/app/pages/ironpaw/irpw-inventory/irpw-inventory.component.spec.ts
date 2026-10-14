import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DbProvider } from '../../../app.config';
import { CharacterService } from '../../../services/character.service';
import { EntityHistoryService } from '../../../services/entity-history.service';
import { IrpwCharacterSheetService } from '../../../services/irpw-character-sheet.service';
import { IrpwItemCatalogService } from '../../../services/irpw-item-catalog.service';
import { IrpwCurrencyService } from '../../../services/irpw-currency.service';
import { parseWallet } from '../../../models/irpw-currency.model';
import { IrpwInventoryComponent } from './irpw-inventory.component';
import { IrpwWalletComponent } from '../irpw-wallet/irpw-wallet.component';

describe('Ironpaw inventory actions', () => {
  let fixture: ComponentFixture<IrpwInventoryComponent>;
  let inventory: IrpwInventoryComponent;
  let sheets: IrpwCharacterSheetService;
  let catalog: IrpwItemCatalogService;
  beforeEach(async () => {
    const rows: Record<string, Record<string, Record<string, unknown>>> = { Item: {}, IRPWItem: {}, IRPWCharacterSheet: {}, IRPWCurrency: {} };
    const crud = {
      findAll: (table: string) => Object.values(rows[table] ?? {}).map(row => structuredClone(row)),
      findById: (table: string, id: string) => rows[table]?.[id] ? structuredClone(rows[table][id]) : null,
      create: (table: string, data: Record<string, unknown>) => { const id = String(data['id'] || crypto.randomUUID()); rows[table][id] = structuredClone({ ...data, id }); return structuredClone(rows[table][id]); },
      update: (table: string, id: string, data: Record<string, unknown>) => { rows[table][id] = { ...rows[table][id], ...structuredClone(data) }; return structuredClone(rows[table][id]); },
    };
    await TestBed.configureTestingModule({ imports: [IrpwInventoryComponent], providers: [
      { provide: DbProvider, useValue: { getCrudHelper: () => crud } },
      { provide: CharacterService, useValue: { getCharacter: () => null } },
      { provide: EntityHistoryService, useValue: { observe: () => undefined, register: () => () => undefined, applying: signal(false), activate: () => undefined, capture: () => Promise.resolve() } },
    ] }).compileComponents();
    sheets = TestBed.inject(IrpwCharacterSheetService); catalog = TestBed.inject(IrpwItemCatalogService);
    sheets.saveSheet('hero', { id: 'hero' });
    fixture = TestBed.createComponent(IrpwInventoryComponent); fixture.componentRef.setInput('characterId', 'hero'); inventory = fixture.componentInstance;
    fixture.detectChanges(); await fixture.whenStable();
  });
  it('creates an item in the sheet and catalog using the simple form', async () => {
    inventory.changeQuickCategory('consumable'); inventory.quickItem.name = 'Poção'; inventory.quickItem.effects = 'Recuperação'; inventory.createQuickItem();
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(catalog.getItems()[0].name).toBe('Poção');
    expect(inventory.inventory.entries[0].sourceItemId).toBe(catalog.getItems()[0].id);
    const actions = fixture.nativeElement.querySelector('.item-actions button') as HTMLButtonElement;
    actions.click(); fixture.detectChanges();
    const popover = fixture.nativeElement.querySelector('.item-details-popover') as HTMLElement;
    expect(popover.matches(':popover-open')).toBeTrue();
    expect(popover.textContent).toContain('Usar uma unidade');
    expect(popover.textContent).toContain('Recuperação');
    popover.hidePopover();
  });
  it('opens item creation in a modal and closes it after adding an item', async () => {
    inventory.openAdd(); fixture.detectChanges(); await fixture.whenStable();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.querySelector('app-nav-button[label="Criar item"]')).toBeTruthy();
    inventory.addMode = 'create'; inventory.quickItem.name = 'Lanterna'; inventory.createQuickItem();
    fixture.detectChanges(); await fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(inventory.inventory.entries[0].snapshot.name).toBe('Lanterna');
  });
  it('moves equipment between slots and back to the backpack without stale references', () => {
    const draft = catalog.createDraft('weapon'); draft.name = 'Espada'; draft.definition.equipmentSlots = ['primary', 'secondary'];
    inventory.addItem(catalog.saveItem(draft)); const entry = inventory.inventory.entries[0];
    inventory.equip(entry, 'primary'); inventory.equip(entry, 'secondary');
    expect(inventory.inventory.equipment.primary).toBeNull();
    expect(inventory.inventory.equipment.secondary).toBe(entry.instanceId);
    inventory.unequip('secondary');
    expect(inventory.inventory.equipment.secondary).toBeNull();
    expect(inventory.inventory.backpackOrder).toContain(entry.instanceId);
  });
  it('preserves wallet changes when the inventory saves from a cached sheet', () => {
    const item = catalog.saveItem({ ...catalog.createDraft(), name: 'Corda' });
    const currency = TestBed.inject(IrpwCurrencyService).saveCurrency({ id: '', name: 'Créditos', description: '', units: [{ id: 'credits', name: 'Créditos', convertAt: null }] });
    const wallet = fixture.debugElement.query(By.directive(IrpwWalletComponent)).componentInstance as IrpwWalletComponent;
    wallet.selectedCurrency = currency.id; wallet.add(); wallet.setBalance(currency.id, 'credits', '50');
    inventory.addItem(item);
    expect(parseWallet(sheets.getSheet('hero')!.wallet)!.accounts[0].balances['credits']).toBe(50);
  });
});
