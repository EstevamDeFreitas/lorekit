import { DynamicField } from '../models/dynamicfields.model';
import { UiConfigPayload, UI_FIELD_LAYOUT_EXPORT_FORMAT, UI_FIELD_LAYOUT_EXPORT_VERSION } from '../models/ui-field-config.model';
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

    const exported = service.exportLayout('Character', v2Layout('dynamic:local-uuid'));

    expect(exported.format).toBe(UI_FIELD_LAYOUT_EXPORT_FORMAT);
    expect(exported.version).toBe(UI_FIELD_LAYOUT_EXPORT_VERSION);
    expect(JSON.stringify(exported)).not.toContain('local-uuid');
    expect((exported.layout.tabs[0].items[0] as any).token).toBe('dynamic:forca');
  });

  it('accepts exported optional fields encoded as null', () => {
    const document = validDocument([{ key: 'forca', name: 'Forca', fieldType: 'text', options: null, isEditorField: false, targetEntityTable: null }], ['forca']);

    expect(() => service.prepareLayoutImport(JSON.stringify(document))).not.toThrow();
  });

  it('omits null optional fields from future exports', () => {
    fields = [{ id: 'local-uuid', name: 'Forca', entityTable: 'Character', fieldType: 'text', options: null as unknown as string, isEditorField: false, targetEntityTable: null as unknown as string }];

    const exported = service.exportLayout('Character', v2Layout('dynamic:local-uuid'));

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
    expect(saveConfig).toHaveBeenCalled();
    const saved = saveConfig.calls.mostRecent().args[0];
    expect(saved.entityTable).toBe('Character');
    expect(saved.scopeMode).toBe('global');
    expect(saved.uiConfig.tabs[0].items[0]).toEqual(jasmine.objectContaining({ token: 'dynamic:existing-id' }));
  });

  it('round-trips multiple tabs, separators and colors', () => {
    fields = [{ id: 'local-uuid', name: 'Forca', entityTable: 'Character', fieldType: 'text', isEditorField: false }];
    const layout = v2Layout('dynamic:local-uuid');
    layout.tabs[0].items[0].color = '#ef4444';
    layout.tabs.push({ id: 'tab:visual', name: 'Visual', items: [{
      id: 'separator:visual', kind: 'separator', orientation: 'vertical', label: 'Retrato',
      color: '#123456', col: 1, row: 1, width: 1, height: 4,
    }] });

    const exported = service.exportLayout('Character', layout);
    const plan = service.prepareLayoutImport(JSON.stringify(exported));
    service.applyLayoutImport(plan, 'create-template', 'Ficha completa');

    expect(saveTemplate).toHaveBeenCalled();
    const saved = saveTemplate.calls.mostRecent().args[2];
    expect(saved.tabs.map((tab: any) => tab.name)).toEqual(['Geral', 'Visual']);
    expect(saved.tabs[0].items[0]).toEqual(jasmine.objectContaining({ token: 'dynamic:local-uuid', color: '#ef4444' }));
    expect(saved.tabs[1].items[0]).toEqual(jasmine.objectContaining({ kind: 'separator', orientation: 'vertical', label: 'Retrato', color: '#123456' }));
  });

  it('normalizes portable v1 documents before applying and performs no writes when invalid', () => {
    const legacy = {
      format: UI_FIELD_LAYOUT_EXPORT_FORMAT,
      version: 1,
      entityTable: 'Character',
      layout: { version: 1, columns: 12, rowHeight: 56, items: [{ token: 'schema:age', col: 2, row: 3, width: 4, height: 1 }] },
      dynamicFields: [],
    };
    const plan = service.prepareLayoutImport(JSON.stringify(legacy));
    expect(plan.document.layout.tabs[0].name).toBe('Propriedades');
    expect(plan.document.layout.tabs[0].items[0]).toEqual(jasmine.objectContaining({ token: 'schema:age', col: 2, row: 3, width: 4, height: 1 }));

    legacy.layout.items[0].col = 20;
    expect(() => service.prepareLayoutImport(JSON.stringify(legacy))).toThrow();
    expect(saveDynamicField).not.toHaveBeenCalled();
    expect(saveConfig).not.toHaveBeenCalled();
    expect(saveTemplate).not.toHaveBeenCalled();
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
      version: 2,
      columns: 12,
      rowHeight: 56,
      tabs: [{ id: 'tab:geral', name: 'Geral', items: dynamicKeys.map((key, index) => ({ id: 'field:' + key, kind: 'field', token: 'dynamic:' + key, col: index + 1, row: 1, width: 1, height: 1 })) }],
    },
    dynamicFields,
  };
}

function v2Layout(token: string): UiConfigPayload {
  return {
    version: 2 as const,
    columns: 12,
    rowHeight: 56,
    tabs: [{ id: 'tab:geral', name: 'Geral', items: [{ id: 'field:one', kind: 'field' as const, token, col: 1, row: 1, width: 3, height: 1 }] }],
  };
}
