import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { createNpcDefinition } from '@lorekit/ironpaw';
import { IrpwNpcCatalogComponent } from './irpw-npc-catalog.component';
import {
  IrpwNpcCatalogService,
  IrpwCatalogNpc,
} from '../../../services/irpw-npc-catalog.service';
import { ImageService } from '../../../services/image.service';

describe('NPC constructor', () => {
  let fixture: ComponentFixture<IrpwNpcCatalogComponent>;
  let catalog: jasmine.SpyObj<IrpwNpcCatalogService>;
  beforeEach(async () => {
    catalog = jasmine.createSpyObj('NpcCatalog', [
      'list',
      'createDraft',
      'save',
      'get',
    ]);
    catalog.list.and.returnValue([]);
    catalog.createDraft.and.callFake(() => ({
      id: '',
      name: '',
      color: '#a1a1aa',
      portraitImageId: null,
      definition: createNpcDefinition(),
      revision: 0,
      archived: false,
    }));
    catalog.save.and.callFake((npc: IrpwCatalogNpc) => ({
      ...npc,
      id: 'saved',
      revision: 1,
    }));
    await TestBed.configureTestingModule({
      imports: [IrpwNpcCatalogComponent],
      providers: [
        { provide: IrpwNpcCatalogService, useValue: catalog },
        { provide: ImageService, useValue: { getImage: () => null } },
        { provide: Dialog, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(IrpwNpcCatalogComponent);
    fixture.detectChanges();
  });
  it('creates an incidental narrative NPC and shows rules only when NA is set', () => {
    const component = fixture.componentInstance;
    component.create();
    component.form.controls.name.setValue('Guarda');
    component.save();
    fixture.detectChanges();
    expect(catalog.save).toHaveBeenCalled();
    expect(component.selected()?.definition.threatLevel).toBeNull();
    component.form.controls.threatLevel.setValue(3);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.rule-summary').textContent,
    ).toContain('1d10+3');
    expect(component.preview()?.resistance).toBe(0);
    component.form.controls.protection.setValue('Carapaça');
    component.form.controls.resistanceAdjustment.setValue(2);
    expect(component.preview()?.resistance).toBe(5);
  });
  it('limits basic actions and refuses rule errors without saving', () => {
    const component = fixture.componentInstance;
    component.create();
    component.form.controls.name.setValue('Guarda');
    for (let index = 0; index < 5; index++) component.addAction();
    expect(component.form.controls.actions.length).toBe(4);
    component.form.controls.threatLevel.setValue(9);
    fixture.detectChanges();
    expect(component.ruleErrors().length).toBeGreaterThan(0);
  });
  it('clears numeric effects when a competence becomes a narrative property', () => {
    const component = fixture.componentInstance;
    component.create();
    component.addTag();
    const tag = component.form.controls.tags.at(0);
    tag.patchValue({ modifier: 2, diceModifier: 1, type: 'property' });
    component.tagTypeChanged(0);
    expect(tag.getRawValue()).toEqual(
      jasmine.objectContaining({ modifier: 0, diceModifier: 0 }),
    );
  });
});
