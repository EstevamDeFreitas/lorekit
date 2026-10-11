import type { PortableEntityType, PortableScalar } from '../../models/entity-bundle.model';

type ColumnRule = 'text' | 'number' | 'integer';
/** Closed contract: adding a database column never automatically exports it. */
export const PORTABLE_COLUMNS: Readonly<Record<PortableEntityType, Readonly<Record<string, ColumnRule>>>> = {
  Character: {
    name: 'text', description: 'text', concept: 'text', personality: 'text', background: 'text',
    height: 'number', weight: 'number', age: 'integer', occupation: 'text', alignment: 'text',
    objectives: 'text', appearance: 'text',
  },
  Personalization: { contentJson: 'text' },
  DynamicFieldValue: { value: 'text', fieldKey: 'text', entityKey: 'text', externalReferenceKey: 'text' },
  Image: { usageKey: 'text', assetKey: 'text' },
};
export const REFERENCE_TYPES = new Set([
  'World', 'Character', 'Species', 'Location', 'Item', 'Document', 'Culture', 'Organization',
  'Object', 'Timeline', 'Age', 'GreatMark', 'Event', 'Moodboard', 'IRPWVocation',
]);

export function isPortableEntityType(value: unknown): value is PortableEntityType {
  return typeof value === 'string' && Object.hasOwn(PORTABLE_COLUMNS, value);
}

export function projectPortableRow(type: PortableEntityType, row: Record<string, unknown>): Record<string, PortableScalar> {
  const projected: Record<string, PortableScalar> = {};
  for (const column of Object.keys(PORTABLE_COLUMNS[type])) {
    if (Object.hasOwn(row, column)) projected[column] = row[column] as PortableScalar;
  }
  validatePortableData(type, projected);
  return projected;
}

export function validatePortableData(type: PortableEntityType, data: Record<string, unknown>): void {
  const columns = PORTABLE_COLUMNS[type];
  for (const [column, value] of Object.entries(data)) {
    const rule = Object.hasOwn(columns, column) ? columns[column] : undefined;
    if (!rule) throw new Error(`Campo não portátil: ${type}.${column}.`);
    if (value === null) continue;
    if (rule === 'text' ? typeof value !== 'string' : typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Valor inválido: ${type}.${column}.`);
    }
    if (rule === 'integer' && !Number.isInteger(value)) throw new Error(`Valor inteiro esperado: ${column}.`);
  }
  const required = type === 'Character' ? ['name', 'description']
    : type === 'Personalization' ? ['contentJson']
      : type === 'DynamicFieldValue' ? ['fieldKey'] : ['usageKey', 'assetKey'];
  for (const column of required) {
    if (typeof data[column] !== 'string') throw new Error(`Campo obrigatório ausente: ${type}.${column}.`);
  }
  if (type === 'DynamicFieldValue' && !Object.hasOwn(data, 'value')) throw new Error('Valor dinâmico ausente.');
}

/** Array order is meaningful (options, categories, columns); only object keys are normalized. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function canonicalOptions(options: string | null | undefined): string {
  if (!options) return '';
  try { return canonicalJson(JSON.parse(options)); } catch { return options; }
}

export function immutableCopy<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value)) as T;
  const freeze = (item: unknown): void => {
    if (item === null || typeof item !== 'object') return;
    Object.values(item).forEach(freeze);
    Object.freeze(item);
  };
  freeze(copy);
  return copy;
}
