import { UiFieldConfig, UiFieldTemplate } from '../models/ui-field-config.model';
import { getSystemCatalog, getSystemDefaultConfig, UiFieldConfigService } from './ui-field-config.service';

describe('UiFieldConfigService', () => {
  let rows: UiFieldConfig[];
  let templates: UiFieldTemplate[];
  let service: UiFieldConfigService;

  beforeEach(() => {
    rows = [];
    templates = [];
    const crud = {
      findAll: jasmine.createSpy('findAll').and.callFake((table: string) => table === 'UiFieldTemplate' ? templates : rows),
    };
    const db = { exec: jasmine.createSpy('exec').and.returnValue([{ columns: ['parentTable', 'parentId'], values: [['World', 'world-1']] }]) };
    service = new UiFieldConfigService({ getCrudHelper: () => crud, getDb: () => db } as any, { getDynamicFields: () => [] } as any);
  });

  it('resolves entity, parent, global and default layouts in precedence order', () => {
    rows = [
      config('global', layout('Global')),
      config('parent', layout('Pai'), { parentEntityTable: 'World', parentEntityId: 'world-1' }),
      config('entity', layout('Entidade'), { entityId: 'character-1' }),
    ];

    expect(service.getResolvedConfig('Character', 'character-1').tabs[0].name).toBe('Entidade');
    rows = rows.filter(row => row.id !== 'entity');
    expect(service.getResolvedConfig('Character', 'character-1').tabs[0].name).toBe('Pai');
    rows = rows.filter(row => row.id !== 'parent');
    expect(service.getResolvedConfig('Character', 'character-1').tabs[0].name).toBe('Global');
    rows = [];
    expect(service.getResolvedConfig('Character', 'character-1')).toEqual(getSystemDefaultConfig('Character'));
  });

  it('normalizes legacy layouts from entity, parent, global and template sources', () => {
    const legacy = JSON.stringify({ version: 1, columns: 12, rowHeight: 56, items: [{ token: 'schema:age', col: 2, row: 3, width: 4, height: 1 }] });
    for (const row of [
      config('entity', legacy, { entityId: 'character-1' }),
      config('parent', legacy, { parentEntityTable: 'World', parentEntityId: 'world-1' }),
      config('global', legacy),
    ]) {
      rows = [row];
      const resolved = service.getResolvedConfig('Character', 'character-1');
      expect(resolved.version).toBe(2);
      expect(resolved.tabs[0].items[0]).toEqual(jasmine.objectContaining({ token: 'schema:age', col: 2, row: 3, width: 4, height: 1 }));
    }

    templates = [{ id: 'template-1', name: 'Ficha importada', entityTable: 'Character', uiConfig: legacy }];
    rows = [{ ...config('entity', '', { entityId: 'character-1' }), templateId: 'template-1' }];
    expect(service.getResolvedConfig('Character', 'character-1').tabs[0].name).toBe('Ficha importada');
  });

  it('maps every default schema token to a supported explicit control', () => {
    for (const table of ['Character', 'Culture', 'Species', 'World']) {
      const catalog = new Map(getSystemCatalog(table).map(item => [item.token, item]));
      const tokens = getSystemDefaultConfig(table).tabs.flatMap(tab => tab.items)
        .filter(item => item.kind === 'field').map(item => item.token);
      expect(tokens.every(token => !!catalog.get(token)?.control)).toBeTrue();
    }
  });
});

function config(id: string, uiConfig: string, scope: Partial<UiFieldConfig> = {}): UiFieldConfig {
  return Object.assign(new UiFieldConfig(), { id, entityTable: 'Character', uiConfig, ...scope });
}

function layout(name: string): string {
  return JSON.stringify({ version: 2, columns: 12, rowHeight: 56, tabs: [{ id: 'tab:' + name.toLowerCase(), name, items: [] }] });
}
