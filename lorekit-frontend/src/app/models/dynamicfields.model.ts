export type DynamicFieldType = 'text' | 'options' | 'editor' | 'entity' | 'image' | 'slider' | 'list' | 'chart';

export type SliderFieldOptions = {
  version: 1;
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  unit?: string;
  defaultValue: number;
};

export type ListColumnType = 'text' | 'number' | 'boolean' | 'date';

export interface ListColumn {
  id: string;
  label: string;
  type: ListColumnType;
}

export type ListFieldOptions = {
  version: 1;
  kind: 'list';
  mode: 'table' | 'headless';
  columns: ListColumn[];
};

export type ChartType = 'radar' | 'bar' | 'line';

export interface ChartSeriesOptions {
  id: string;
  label: string;
  color: string;
}

export type ChartFieldOptions = {
  version: 1;
  kind: 'chart';
  chartType: ChartType;
  title: string;
  legend: string;
  color: string;
  series: ChartSeriesOptions[];
  categories?: string[];
};

export type DynamicFieldStructuredOptions = SliderFieldOptions | ListFieldOptions | ChartFieldOptions;

export interface SliderFieldValue {
  value: number;
}

export interface ListFieldValue {
  items: Array<Record<string, string | number | boolean>> | string[];
}

export interface ChartFieldValue {
  labels: string[];
  series: Array<{ id: string; values: number[] }>;
}

export const CHART_SERIES_COLORS = ['#facc15', '#60a5fa', '#f472b6', '#4ade80', '#c084fc', '#fb923c'];

export function defaultSliderFieldOptions(): SliderFieldOptions {
  return { version: 1, kind: 'slider', min: 0, max: 100, step: 1, unit: '', defaultValue: 0 };
}

export function defaultListFieldOptions(): ListFieldOptions {
  return {
    version: 1,
    kind: 'list',
    mode: 'table',
    columns: [{ id: 'item', label: 'Item', type: 'text' }],
  };
}

export function defaultChartFieldOptions(): ChartFieldOptions {
  return {
    version: 1,
    kind: 'chart',
    chartType: 'radar',
    title: '',
    legend: '',
    color: '#facc15',
    categories: ['Categoria 1', 'Categoria 2', 'Categoria 3'],
    series: [{ id: 'series-1', label: 'Serie 1', color: '#facc15' }],
  };
}

export function parseDynamicFieldOptions(fieldType: DynamicFieldType, serialized?: string | null): DynamicFieldStructuredOptions | null {
  if (fieldType === 'slider') return normalizeSliderOptions(parseJson(serialized), defaultSliderFieldOptions());
  if (fieldType === 'list') return normalizeListOptions(parseJson(serialized), defaultListFieldOptions());
  if (fieldType === 'chart') return normalizeChartOptions(parseJson(serialized), defaultChartFieldOptions());
  return null;
}

export function serializeDynamicFieldOptions(options: DynamicFieldStructuredOptions): string {
  if (options.kind === 'chart' && options.chartType === 'radar') {
    const { series, ...radar } = options;
    return JSON.stringify(radar);
  }
  return JSON.stringify(options);
}

export function isValidDynamicFieldOptions(fieldType: DynamicFieldType, serialized?: string | null): boolean {
  if (fieldType !== 'slider' && fieldType !== 'list' && fieldType !== 'chart') return true;
  if (!serialized) return false;
  const parsed = parseJson(serialized);
  if (!isRecord(parsed) || parsed['version'] !== 1 || parsed['kind'] !== fieldType) return false;
  if (fieldType === 'slider') {
    return Number.isFinite(Number(parsed['min'])) && Number.isFinite(Number(parsed['max'])) &&
      Number(parsed['max']) >= Number(parsed['min']) && Number(parsed['step']) > 0;
  }
  if (fieldType === 'list') {
    return (parsed['mode'] === 'table' || parsed['mode'] === 'headless') && Array.isArray(parsed['columns']);
  }
  const validBaseColor = typeof parsed['color'] === 'string' && /^#[0-9a-f]{6}$/i.test(parsed['color']);
  const series = parsed['series'];
  const validSeries = series === undefined || (Array.isArray(series) && series.length > 0 && series.every(item => isRecord(item) && typeof item['label'] === 'string' && !!item['label'].trim() && typeof item['color'] === 'string' && /^#[0-9a-f]{6}$/i.test(item['color'])));
  if (parsed['chartType'] === 'radar') {
    const categories = parsed['categories'];
    return validBaseColor && (categories === undefined ? validSeries : Array.isArray(categories) && categories.length >= 3 && categories.length <= 12 && categories.every(item => typeof item === 'string' && !!item.trim()) && new Set(categories.map(item => item.trim())).size === categories.length);
  }
  return (parsed['chartType'] === 'radar' || parsed['chartType'] === 'bar' || parsed['chartType'] === 'line') && validBaseColor && validSeries;
}

export function normalizeSliderValue(raw: unknown, options: SliderFieldOptions): number {
  const candidate = typeof raw === 'number' ? raw : Number(raw);
  const fallback = Number.isFinite(options.defaultValue) ? options.defaultValue : options.min;
  const value = Number.isFinite(candidate) ? candidate : fallback;
  const clamped = Math.min(options.max, Math.max(options.min, value));
  const steps = Math.round((clamped - options.min) / options.step);
  return Number((options.min + steps * options.step).toFixed(10));
}

export function serializeSliderValue(raw: unknown, options: SliderFieldOptions): string {
  return JSON.stringify({ value: normalizeSliderValue(raw, options) } satisfies SliderFieldValue);
}

export function parseSliderValue(serialized: string | null | undefined, options: SliderFieldOptions): number {
  const parsed = parseJson(serialized);
  if (isRecord(parsed) && 'value' in parsed) return normalizeSliderValue(parsed['value'], options);
  return normalizeSliderValue(serialized, options);
}

export function parseListValue(serialized: string | null | undefined, options: ListFieldOptions): ListFieldValue {
  const parsed = parseJson(serialized);
  if (options.mode === 'headless') {
    const source = isRecord(parsed) && Array.isArray(parsed['items']) ? parsed['items'] : Array.isArray(parsed) ? parsed : [];
    return { items: source.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) };
  }

  const source = isRecord(parsed) && Array.isArray(parsed['items']) ? parsed['items'] : [];
  return {
    items: source.filter(isRecord).map(row => normalizeListRow(row, options.columns)),
  };
}

export function serializeListValue(value: ListFieldValue): string {
  return JSON.stringify(value);
}

export function parseChartValue(serialized: string | null | undefined): ChartFieldValue {
  const parsed = parseJson(serialized);
  const labels = isRecord(parsed) && Array.isArray(parsed['labels']) ? parsed['labels'] : [];
  const legacyValues = isRecord(parsed) && Array.isArray(parsed['values']) ? parsed['values'] : [];
  const rawSeries = isRecord(parsed) && Array.isArray(parsed['series'])
    ? parsed['series']
    : [{ id: 'series-1', values: legacyValues }];
  const series = rawSeries.map((item, index) => {
    const values = isRecord(item) && Array.isArray(item['values']) ? item['values'] : [];
    return { id: isRecord(item) && typeof item['id'] === 'string' ? item['id'] : `series-${index + 1}`, values };
  });
  const pairs = labels.map((label, index) => ({
    label: String(label ?? '').trim(),
    values: series.map(item => Number(item.values[index])),
  })).filter(item => item.label && item.values.some(value => Number.isFinite(value))).slice(0, 12);
  return {
    labels: pairs.map(item => item.label),
    series: series.map(item => ({ id: item.id, values: pairs.map(pair => Number.isFinite(pair.values[series.indexOf(item)]) ? pair.values[series.indexOf(item)] : 0) })),
  };
}

export function serializeChartValue(value: ChartFieldValue): string {
  const series = value.series?.length ? value.series : [{ id: 'series-1', values: [] }];
  const pairs = value.labels.map((label, index) => ({
    label: label.trim(),
    values: series.map(item => Number(item.values[index])),
  }))
    .filter(item => item.label && item.values.some(value => Number.isFinite(value)))
    .slice(0, 12);
  return JSON.stringify({
    labels: pairs.map(item => item.label),
    series: series.map((item, seriesIndex) => ({ id: item.id, values: pairs.map(pair => Number.isFinite(pair.values[seriesIndex]) ? pair.values[seriesIndex] : 0) })),
  } satisfies ChartFieldValue);
}

/** Align Radar values by category name, not position, when its configuration changes. */
export function reconcileRadarValue(options: ChartFieldOptions, value: ChartFieldValue): ChartFieldValue {
  const labels = options.categories ?? defaultChartFieldOptions().categories!;
  const source = value.series[0];
  return {
    labels: [...labels],
    series: [{ id: 'series-1', values: labels.map(label => {
      const index = value.labels.indexOf(label);
      const numeric = index >= 0 ? source?.values[index] : undefined;
      return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : 0;
    }) }],
  };
}

function normalizeSliderOptions(raw: unknown, fallback: SliderFieldOptions): SliderFieldOptions {
  if (!isRecord(raw)) return fallback;
  const min = finiteNumber(raw['min'], fallback.min);
  const max = Math.max(min, finiteNumber(raw['max'], fallback.max));
  const step = Math.max(Number.EPSILON, finiteNumber(raw['step'], fallback.step));
  const defaultValue = normalizeSliderValue(raw['defaultValue'], { ...fallback, min, max, step });
  return { version: 1, kind: 'slider', min, max, step, unit: stringValue(raw['unit']), defaultValue };
}

function normalizeListOptions(raw: unknown, fallback: ListFieldOptions): ListFieldOptions {
  if (!isRecord(raw)) return fallback;
  const mode = raw['mode'] === 'headless' ? 'headless' : 'table';
  const columns = Array.isArray(raw['columns'])
    ? raw['columns'].map((column, index) => normalizeColumn(column, index)).filter((column): column is ListColumn => !!column)
    : fallback.columns;
  return { version: 1, kind: 'list', mode, columns: columns.length ? columns : fallback.columns };
}

function normalizeChartOptions(raw: unknown, fallback: ChartFieldOptions): ChartFieldOptions {
  if (!isRecord(raw)) return fallback;
  const chartType = raw['chartType'] === 'bar' || raw['chartType'] === 'line' ? raw['chartType'] : 'radar';
  const color = typeof raw['color'] === 'string' && /^#[0-9a-f]{6}$/i.test(raw['color']) ? raw['color'] : fallback.color;
  const rawSeries = Array.isArray(raw['series']) ? raw['series'] : [];
  const series = rawSeries.map((item, index) => normalizeChartSeries(item, index, color)).filter((item): item is ChartSeriesOptions => !!item);
  const rawCategories = Array.isArray(raw['categories']) ? raw['categories'] : chartType === 'radar' && series.length > 1 ? series.map(item => item.label) : fallback.categories ?? [];
  const categories = [...new Set(rawCategories.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))].slice(0, 12);
  return { version: 1, kind: 'chart', chartType, title: stringValue(raw['title']), legend: stringValue(raw['legend']), color, categories, series: chartType === 'radar' ? [{ id: 'series-1', label: 'Valor', color }] : series.length ? series : [{ id: 'series-1', label: stringValue(raw['legend']) || 'Serie 1', color }] };
}

function normalizeChartSeries(value: unknown, index: number, fallbackColor: string): ChartSeriesOptions | null {
  if (!isRecord(value)) return null;
  const label = stringValue(value['label']).trim();
  if (!label) return null;
  const color = typeof value['color'] === 'string' && /^#[0-9a-f]{6}$/i.test(value['color']) ? value['color'] : index === 0 ? fallbackColor : CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
  return { id: stringValue(value['id']) || `series-${index + 1}`, label, color };
}

function normalizeListRow(row: Record<string, unknown>, columns: ListColumn[]): Record<string, string | number | boolean> {
  return Object.fromEntries(columns.map(column => [column.id, normalizeCell(row[column.id], column.type)]));
}

function normalizeCell(value: unknown, type: ListColumnType): string | number | boolean {
  if (type === 'number') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  if (type === 'boolean') return value === true || value === 'true';
  return String(value ?? '');
}

function normalizeColumn(value: unknown, index: number): ListColumn | null {
  if (!isRecord(value)) return null;
  const label = stringValue(value['label']).trim();
  if (!label) return null;
  const rawId = stringValue(value['id']).trim();
  const id = rawId || slugify(label) || `column-${index + 1}`;
  const type: ListColumnType = value['type'] === 'number' || value['type'] === 'boolean' || value['type'] === 'date' ? value['type'] : 'text';
  return { id, label, type };
}

function parseJson(value?: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stringValue(value: unknown): string { return typeof value === 'string' ? value : ''; }

function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class DynamicField {
  id: string;
  name: string;
  entityTable: string;
  options?: string;
  isEditorField: boolean = false;
  fieldType: DynamicFieldType = 'text';
  targetEntityTable?: string;

  constructor(id: string = '', name: string = '', entityTable: string = '', options: string = '') {
    this.id = id;
    this.name = name;
    this.entityTable = entityTable;
    this.options = options;
  }
}

export class DynamicFieldValue  {
  id: string;
  value: string;

  ParentDynamicField?: DynamicField;

  constructor(id: string = '', value: string = ''){
    this.id = id;
    this.value = value;
  }
}
