import { fakeAsync, TestBed, ComponentFixture, tick } from '@angular/core/testing';
import { IrpwContentManagerComponent } from './irpw-content-manager.component';
import {
  IrpwItemCatalogService,
  IrpwCatalogItem,
} from '../../../services/irpw-item-catalog.service';
import { IrpwItemPortabilityService } from '../../../services/irpw-item-portability.service';
import { createEmptyItemDefinition } from '../../../models/irpw-item.model';

describe('Ironpaw content manager UI', () => {
  let fixture: ComponentFixture<IrpwContentManagerComponent>;
  let source: IrpwCatalogItem;
  let catalog: jasmine.SpyObj<IrpwItemCatalogService>;
  beforeEach(async () => {
    source = {
      id: 'sword',
      name: 'Espada',
      description: 'Uma espada de ferro.',
      definition: createEmptyItemDefinition('weapon'),
    };
    catalog = jasmine.createSpyObj('catalog', ['getItems', 'createDraft', 'saveItem']);
    catalog.getItems.and.returnValue([source]);
    catalog.saveItem.and.returnValue(source);
    catalog.createDraft.and.callFake(() => ({
      id: '',
      name: '',
      description: '',
      definition: createEmptyItemDefinition(),
    }));
    await TestBed.configureTestingModule({
      imports: [IrpwContentManagerComponent],
      providers: [
        { provide: IrpwItemCatalogService, useValue: catalog },
        { provide: IrpwItemPortabilityService, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(IrpwContentManagerComponent);
    fixture.detectChanges();
  });
  it('opens an item with shared fields and a live preview', () => {
    fixture.nativeElement.querySelector('.catalog-row').click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-input[label="Nome"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('app-icon-selector'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.preview-panel').textContent,
    ).toContain('Espada');
    expect(
      fixture.nativeElement
        .querySelector('.manager-grid')
        .classList.contains('show-editor'),
    ).toBeTrue();
  });
  it('keeps the rules section separate and editable without losing the draft', () => {
    fixture.nativeElement.querySelector('.catalog-row').click();
    fixture.detectChanges();
    const tabs = fixture.nativeElement.querySelectorAll('.editor-tabs button');
    tabs[1].click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.rules-fields').hidden,
    ).toBeFalse();
    expect(fixture.componentInstance.selectedItem?.name).toBe('Espada');
  });
  it('does not mutate the catalog definition while editing the selected copy', () => {
    fixture.componentInstance.selectItem(source);
    fixture.componentInstance.toggleWeaponProperty('heavy', true);
    expect(source.definition.weapon?.properties).toEqual([]);
  });
  it('reloads the catalog when archived items are requested', () => {
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector(
      '.archived-toggle input',
    );
    checkbox.click();
    fixture.detectChanges();
    expect(catalog.getItems).toHaveBeenCalledWith(true);
  });
  it('saves item color changes automatically', fakeAsync(() => {
    fixture.componentInstance.selectItem(source);
    fixture.componentInstance.setItemColor('#ef4444');
    fixture.componentInstance.setBackgroundColor('#1e1b4b');
    tick(350);
    expect(catalog.saveItem).toHaveBeenCalled();
  }));
  it('initializes category-specific fields when choosing consumables and protection', () => {
    fixture.componentInstance.newItem();
    fixture.componentInstance.changeCategory('consumable');
    expect(
      fixture.componentInstance.selectedItem?.definition.consumable?.subtype,
    ).toBe('utility');
    fixture.componentInstance.changeCategory('protection');
    expect(
      fixture.componentInstance.selectedItem?.definition.protection?.tier,
    ).toBe('light');
  });
});
