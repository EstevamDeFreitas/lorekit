import { DynamicField } from '../models/dynamicfields.model';
import { UI_FIELD_LAYOUT_EXPORT_FORMAT, UI_FIELD_LAYOUT_EXPORT_VERSION } from '../models/ui-field-config.model';
import { UiFieldLayoutPortabilityService } from './ui-field-layout-portability.service';

describe('UiFieldLayoutPortabilityService', () => {
  let fields: DynamicField[];
  let saveDynamicField: jasmine.Spy;
  let saveConfig: jasmine.Spy;
  let saveTemplate: jasmine.Spy;
  let service: UiFieldLayoutPortabilityService;

  beforeEach(() => {
    fields = [];
    saveDynamicField = jasmine.createSpy('saveDynamicField').and.callFake((field: DynamicField) => ({ ...field, id: field.id || 'created-id' }));
    const crud = { findAll: jasmine.createSpy('findAll').and.returnValue([]) };
    const dynamicFields = { getDynamicFields: jasmine.createSpy('getDynamicFields').and.callFake(() => fields), saveDynamicField };
    const configs = {
      getTemplates: jasmine.createSpy('getTemplates').and.returnValue([]),
      saveTemplate: saveTemplate = jasmine.createSpy('saveTemplate').and.returnValue({ id: 'template-id' }),
      saveConfig: saveConfig = jasmine.createSpy('saveConfig').and.returnValue({ id: 'config-id' }),
    };
    service = new UiFieldLayoutPortabilityService({ getCrudHelper: () => crud } as any, dynamicFields as any, configs as any);
  });

  it('exports dynamic fields without local ids', () => {
    fields = [{ id: 'local-uuid', name: 'Forca', entityTable: 'Character', fieldType: 'text', isEditorField: false }];

    const exported = service.exportLayout('Character', {
      version: 1, columns: 12, rowHeight: 56,
      items: [{ token: 'dynamic:local-uuid', col: 1, row: 1, width: 3, height: 1 }],
    });

    expect(exported.format).toBe(UI_FIELD_LAYOUT_EXPORT_FORMAT);
    expect(exported.version).toBe(UI_FIELD_LAYOUT_EXPORT_VERSION);
    expect(JSON.stringify(exported)).not.toContain('local-uuid');
    expect(exported.layout.items[0].token).toBe('dynamic:forca');
  });

  it('accepts exported optional fields encoded as null', () => {
    const document = validDocument([{ key: 'forca', name: 'Forca', fieldType: 'text', options: null, isEditorField: false, targetEntityTable: null }], ['forca']);

    expect(() => service.prepareLayoutImport(JSON.stringify(document))).not.toThrow();
  });

  it('omits null optional fields from future exports', () => {
    fields = [{ id: 'local-uuid', name: 'Forca', entityTable: 'Character', fieldType: 'text', options: null as unknown as string, isEditorField: false, targetEntityTable: null as unknown as string }];

    const exported = service.exportLayout('Character', {
      version: 1, columns: 12, rowHeight: 56,
      items: [{ token: 'dynamic:local-uuid', col: 1, row: 1, width: 3, height: 1 }],
    });

    expect(exported.dynamicFields[0].options).toBeUndefined();
    expect(exported.dynamicFields[0].targetEntityTable).toBeUndefined();
    expect(JSON.stringify(exported)).not.toContain(':null');
  });
  it('rejects invalid JSON without persisting fields', () => {
    expect(() => service.prepareLayoutImport('{invalid')).toThrowError('O conteudo informado nao e um JSON valido.');
    expect(saveDynamicField).not.toHaveBeenCalled();
    expect(saveConfig).not.toHaveBeenCalled();
    expect(saveTemplate).not.toHaveBeenCalled();
  });

  it('plans creation for missing fields and reuse for equivalent fields', () => {
    fields = [{ id: 'existing-id', name: 'Forca', entityTable: 'Character', fieldType: 'text', isEditorField: false }];
    const document = validDocument([{ key: 'forca', name: 'Forca', fieldType: 'text', isEditorField: false }, { key: 'mana', name: 'Mana', fieldType: 'text', isEditorField: false }], ['forca', 'mana']);

    const plan = service.prepareLayoutImport(JSON.stringify(document));

    expect(plan.reusedFields.map(field => field.id)).toEqual(['existing-id']);
    expect(plan.fieldsToCreate.map(field => field.name)).toEqual(['Mana']);
  });

  it('saves the imported global layout without duplicating equivalent dynamic fields', () => {
    fields = [{ id: 'existing-id', name: 'Forca', entityTable: 'Character', fieldType: 'text', isEditorField: false }];
    const document = validDocument([{ key: 'forca', name: 'Forca', fieldType: 'text', isEditorField: false }], ['forca']);

    const plan = service.prepareLayoutImport(JSON.stringify(document));
    service.applyLayoutImport(plan, 'replace-global');

    expect(saveDynamicField).not.toHaveBeenCalled();
    expect(saveConfig).toHaveBeenCalledWith({
      entityTable: 'Character',
      scopeMode: 'global',
      uiConfig: {
        version: 1,
        columns: 12,
        rowHeight: 56,
        items: [{ token: 'dynamic:existing-id', col: 1, row: 1, width: 1, height: 1 }],
      },
    });
  });

  it('rejects a dynamic field with the same name and a different definition', () => {
    fields = [{ id: 'existing-id', name: 'Forca', entityTable: 'Character', fieldType: 'options', options: 'baixo;alto', isEditorField: false }];
    const document = validDocument([{ key: 'forca', name: 'Forca', fieldType: 'text', isEditorField: false }], ['forca']);

    expect(() => service.prepareLayoutImport(JSON.stringify(document))).toThrowError('O campo dinamico "Forca" ja existe com uma definicao diferente.');
    expect(saveDynamicField).not.toHaveBeenCalled();
    expect(saveConfig).not.toHaveBeenCalled();
    expect(saveTemplate).not.toHaveBeenCalled();
  });
});

function validDocument(dynamicFields: any[], dynamicKeys: string[]) {
  return {
    format: UI_FIELD_LAYOUT_EXPORT_FORMAT,
    version: UI_FIELD_LAYOUT_EXPORT_VERSION,
    entityTable: 'Character',
    layout: {
      version: 1,
      columns: 12,
      rowHeight: 56,
      items: dynamicKeys.map((key, index) => ({ token: 'dynamic:' + key, col: index + 1, row: 1, width: 1, height: 1 })),
    },
    dynamicFields,
  };
}
