import { normalizeUiConfigPayload } from './ui-field-config.model';

describe('UiFieldConfig payload', () => {
  it('normalizes a legacy layout into one named v2 tab without losing geometry', () => {
    const result = normalizeUiConfigPayload({
      version: 1,
      columns: 12,
      rowHeight: 56,
      items: [{ token: 'schema:age', col: 2, row: 3, width: 4, height: 5 }],
    }, 'Ficha principal');

    expect(result.version).toBe(2);
    expect(result.tabs[0].name).toBe('Ficha principal');
    expect(result.tabs[0].items[0]).toEqual({
      id: 'field:schema:age', kind: 'field', token: 'schema:age',
      col: 2, row: 3, width: 4, height: 5,
    });
  });

  it('uses Propriedades when a legacy tab name is blank', () => {
    const result = normalizeUiConfigPayload({ version: 1, columns: 12, rowHeight: 56, items: [] }, '  ');
    expect(result.tabs[0]).toEqual({ id: 'tab:propriedades', name: 'Propriedades', items: [] });
  });

  it('preserves v2 separators, labels and colors', () => {
    const result = normalizeUiConfigPayload({
      version: 2,
      columns: 12,
      rowHeight: 56,
      tabs: [{ id: 'tab:one', name: 'Geral', items: [{
        id: 'separator:one', kind: 'separator', orientation: 'vertical', label: 'Dados',
        color: '#AABBCC', col: 1, row: 1, width: 1, height: 4,
      }] }],
    });
    expect(result.tabs[0].items[0]).toEqual(jasmine.objectContaining({ orientation: 'vertical', label: 'Dados', color: '#AABBCC' }));
  });

  it('rejects duplicate tab names, duplicate fields and invalid colors', () => {
    const field = (id: string, token: string, color?: string) => ({ id, kind: 'field', token, col: 1, row: 1, width: 1, height: 1, color });
    expect(() => normalizeUiConfigPayload({ version: 2, columns: 12, rowHeight: 56, tabs: [
      { id: 'a', name: 'Geral', items: [] }, { id: 'b', name: ' geral ', items: [] },
    ] })).toThrow();
    expect(() => normalizeUiConfigPayload({ version: 2, columns: 12, rowHeight: 56, tabs: [
      { id: 'a', name: 'A', items: [field('one', 'schema:age')] },
      { id: 'b', name: 'B', items: [field('two', 'schema:age')] },
    ] })).toThrow();
    expect(() => normalizeUiConfigPayload({ version: 2, columns: 12, rowHeight: 56, tabs: [
      { id: 'a', name: 'A', items: [field('one', 'schema:age', 'red')] },
    ] })).toThrow();
  });
});
