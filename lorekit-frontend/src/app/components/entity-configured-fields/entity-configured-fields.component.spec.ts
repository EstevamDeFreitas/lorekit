import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { DynamicField } from '../../models/dynamicfields.model';
import { UiConfigPayload, UiFieldCatalogItem } from '../../models/ui-field-config.model';
import { DynamicFieldService } from '../../services/dynamic-field.service';
import { UiFieldConfigService } from '../../services/ui-field-config.service';
import { EntityConfiguredFieldsComponent } from './entity-configured-fields.component';

describe('EntityConfiguredFieldsComponent', () => {
  const saveValues = jasmine.createSpy('saveEntityDynamicFieldsValues');
  const dynamicTemplates: DynamicField[] = [
    field('text', 'Texto', 'text'), field('options', 'Opções', 'options'), field('entity', 'Entidade', 'entity'),
    field('image', 'Imagem', 'image'), field('editor', 'Editor', 'editor', true),
  ];
  const catalog: UiFieldCatalogItem[] = [
    { token: 'schema:age', key: 'age', label: 'Idade', source: 'schema', isEditorField: false, fieldType: 'input', control: 'input' },
    ...dynamicTemplates.map(template => ({
      token: `dynamic:${template.id}`, key: template.id, label: template.name, source: 'dynamic' as const,
      isEditorField: !!template.isEditorField, fieldType: template.fieldType,
      control: template.fieldType === 'text' ? 'input' as const : template.fieldType as any,
    })),
  ];

  beforeEach(async () => {
    saveValues.calls.reset();
    await TestBed.configureTestingModule({
      imports: [EntityConfiguredFieldsComponent],
      providers: [
        { provide: UiFieldConfigService, useValue: { getCatalog: () => catalog, getEntityItemsForTable: () => [{ value: 'one', label: 'Um' }] } },
        { provide: DynamicFieldService, useValue: { getDynamicFields: () => dynamicTemplates, getEntityDynamicFieldsValues: () => [], saveEntityDynamicFieldsValues: saveValues } },
      ],
    }).compileComponents();
  });

  it('exposes entity, table, layout and active tab inputs and emits native changes and save requests', () => {
    const fixture = createFixture(layout([{ id: 'age', kind: 'field', token: 'schema:age', color: '#ef4444', col: 1, row: 1, width: 3, height: 1 }]));
    const component = fixture.componentInstance;
    const changes: any[] = [];
    let saves = 0;
    component.nativeFieldChange.subscribe(value => changes.push(value));
    component.requestSave.subscribe(() => saves++);

    component.setSchemaValue('age', '42');

    expect(component.entityTable()).toBe('Character');
    expect((component.entity() as any).age).toBe('42');
    expect(changes).toEqual([{ key: 'age', value: '42' }]);
    expect(saves).toBe(1);
    expect(fixture.nativeElement.querySelector('.configured-field--colored').style.borderColor).toBeTruthy();
  });

  it('renders horizontal and vertical separators, optional labels and grid geometry', () => {
    const fixture = createFixture(layout([
      { id: 'horizontal', kind: 'separator', orientation: 'horizontal', label: 'Dados', color: '#123456', col: 1, row: 1, width: 6, height: 1 },
      { id: 'vertical', kind: 'separator', orientation: 'vertical', col: 7, row: 1, width: 1, height: 4 },
    ]));
    const separators = fixture.nativeElement.querySelectorAll('.separator');

    expect(separators.length).toBe(2);
    expect(separators[0].textContent).toContain('Dados');
    expect(separators[1].classList).toContain('separator--vertical');
    expect(separators[1].querySelector('.separator-label')).toBeNull();
    expect(fixture.componentInstance.gridMinHeight()).toBe('448px');
  });

  it('loads every dynamic control and persists text, option, entity, image and editor values', fakeAsync(() => {
    const fixture = createFixture(layout([]));
    const component = fixture.componentInstance;
    expect(dynamicTemplates.map(template => component.getTokenMetadata(`dynamic:${template.id}`)?.control))
      .toEqual(['input', 'options', 'entity', 'image', 'editor']);
    expect(component.dynamicOptions(dynamicTemplates[1])).toEqual([]);
    expect(component.entityOptionsByFieldId['entity']).toEqual([{ value: 'one', label: 'Um' }]);

    component.onDynamicValueChange('text', 'texto');
    component.onDynamicValueChange('options', 'opção');
    component.onDynamicValueChange('entity', 'one');
    component.onDynamicImageValueChange('image', 'image-id');
    component.onDynamicEditorSave({ type: 'doc' }, 'editor');
    tick(220);

    expect(saveValues).toHaveBeenCalled();
    const values = saveValues.calls.mostRecent().args[2];
    expect(Object.fromEntries(values.map((value: any) => [value.ParentDynamicField.id, value.value]))).toEqual(jasmine.objectContaining({
      text: 'texto', options: 'opção', entity: 'one', image: 'image-id', editor: JSON.stringify({ type: 'doc' }),
    }));
  }));

  function createFixture(fieldLayout: UiConfigPayload) {
    const fixture = TestBed.createComponent(EntityConfiguredFieldsComponent);
    fixture.componentRef.setInput('entityTable', 'Character');
    fixture.componentRef.setInput('entity', { id: 'character-1', name: 'Heroína', age: '' });
    fixture.componentRef.setInput('layout', fieldLayout);
    fixture.componentRef.setInput('activeTabId', 'tab:main');
    fixture.detectChanges();
    return fixture;
  }
});

function field(id: string, name: string, fieldType: any, isEditorField = false): DynamicField {
  return { id, name, entityTable: 'Character', fieldType, isEditorField, targetEntityTable: fieldType === 'entity' ? 'World' : undefined };
}

function layout(items: any[]): UiConfigPayload {
  return { version: 2, columns: 12, rowHeight: 56, tabs: [{ id: 'tab:main', name: 'Principal', items }] };
}
