import {
  defaultChartFieldOptions,
  defaultListFieldOptions,
  defaultSliderFieldOptions,
  isValidDynamicFieldOptions,
  normalizeSliderValue,
  parseChartValue,
  parseDynamicFieldOptions,
  reconcileRadarValue,
  parseListValue,
  parseSliderValue,
  serializeChartValue,
  serializeDynamicFieldOptions,
} from './dynamicfields.model';

describe('dynamic field structured models', () => {
  it('stores Radar categories without configurable series', () => {
    const options = { ...defaultChartFieldOptions(), categories: ['Força', 'Agilidade', 'Magia'] };
    const serialized = serializeDynamicFieldOptions(options);
    expect(JSON.parse(serialized).series).toBeUndefined();
    expect(isValidDynamicFieldOptions('chart', serialized)).toBeTrue();
    expect(isValidDynamicFieldOptions('chart', serializeDynamicFieldOptions({ ...options, categories: ['Força', 'Magia'] }))).toBeFalse();
    expect(isValidDynamicFieldOptions('chart', serializeDynamicFieldOptions({ ...options, categories: ['Força', 'Força', 'Magia'] }))).toBeFalse();
    expect(parseDynamicFieldOptions('chart', serialized)).toEqual({ ...options, series: [{ id: 'series-1', label: 'Valor', color: options.color }] });
  });

  it('keeps every fixed Radar category, aligning saved values by name', () => {
    const options = { ...defaultChartFieldOptions(), categories: ['Magia', 'Força', 'Defesa'] };
    const saved = parseChartValue(JSON.stringify({ labels: ['Força', 'Magia', 'Removida'], values: [8, 5, 9] }));
    expect(reconcileRadarValue(options, saved)).toEqual({ labels: ['Magia', 'Força', 'Defesa'], series: [{ id: 'series-1', values: [5, 8, 0] }] });
    expect(reconcileRadarValue(options, parseChartValue('')).series[0].values).toEqual([0, 0, 0]);
  });

  it('keeps Bar and Line series configuration unchanged', () => {
    const options = { ...defaultChartFieldOptions(), chartType: 'bar' as const, series: [{ id: 'current', label: 'Atual', color: '#60a5fa' }, { id: 'target', label: 'Meta', color: '#facc15' }] };
    expect(parseDynamicFieldOptions('chart', serializeDynamicFieldOptions(options))).toEqual(options);
  });

  it('normalizes slider values to the configured range and step', () => {
    const options = { ...defaultSliderFieldOptions(), min: 0, max: 10, step: 2, defaultValue: 4 };

    expect(normalizeSliderValue(9, options)).toBe(10);
    expect(normalizeSliderValue(-4, options)).toBe(0);
    expect(parseSliderValue(JSON.stringify({ value: 'not-a-number' }), options)).toBe(4);
  });

  it('parses table and headless list values with safe defaults', () => {
    const table = parseListValue(JSON.stringify({ items: [{ item: 'Sword', unknown: 'ignored' }] }), defaultListFieldOptions());
    expect(table.items).toEqual([{ item: 'Sword' }]);

    const headless = parseListValue(JSON.stringify({ items: ['One', '', 42] }), { ...defaultListFieldOptions(), mode: 'headless' });
    expect(headless.items).toEqual(['One']);
  });

  it('keeps only valid chart label/value pairs', () => {
    const parsed = parseChartValue(JSON.stringify({ labels: ['A', 'B', ''], values: [2, 'bad', 4] }));
    expect(parsed).toEqual({ labels: ['A'], series: [{ id: 'series-1', values: [2] }] });
    expect(JSON.parse(serializeChartValue({ labels: ['A'], series: [{ id: 'series-1', values: [2] }] }))).toEqual({ labels: ['A'], series: [{ id: 'series-1', values: [2] }] });

    const multiple = parseChartValue(JSON.stringify({
      labels: ['Forca', 'Agilidade'],
      series: [
        { id: 'power', values: [8, 5] },
        { id: 'speed', values: [4, 9] },
      ],
    }));
    expect(multiple).toEqual({
      labels: ['Forca', 'Agilidade'],
      series: [
        { id: 'power', values: [8, 5] },
        { id: 'speed', values: [4, 9] },
      ],
    });
  });

  it('validates structured field options and rejects mismatched kinds', () => {
    const slider = serializeDynamicFieldOptions(defaultSliderFieldOptions());
    const chart = serializeDynamicFieldOptions(defaultChartFieldOptions());

    expect(isValidDynamicFieldOptions('slider', slider)).toBeTrue();
    expect(isValidDynamicFieldOptions('chart', chart)).toBeTrue();
    expect(isValidDynamicFieldOptions('list', slider)).toBeFalse();
    expect(isValidDynamicFieldOptions('slider', '{"kind":"slider"}')).toBeFalse();
  });
});
