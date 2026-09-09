export type UiFieldSource = 'schema' | 'dynamic';
export type UiFieldControl = 'input' | 'textarea' | 'editor' | 'options' | 'entity' | 'image';

export interface UiFieldCatalogItem {
  token: string;
  key: string;
  label: string;
  source: UiFieldSource;
  isEditorField: boolean;
  fieldType?: string;
  control: UiFieldControl;
}

export interface UiFieldLayoutItemBase {
  id: string;
  kind: 'field' | 'separator';
  col: number;
  row: number;
  width: number;
  height: number;
  color?: string;
}

export interface UiFieldLayoutFieldItem extends UiFieldLayoutItemBase {
  kind: 'field';
  token: string;
}

export interface UiFieldLayoutSeparatorItem extends UiFieldLayoutItemBase {
  kind: 'separator';
  orientation: 'horizontal' | 'vertical';
  label?: string;
}

export type UiFieldLayoutItem = UiFieldLayoutFieldItem | UiFieldLayoutSeparatorItem;

export interface UiFieldLayoutTab {
  id: string;
  name: string;
  items: UiFieldLayoutItem[];
}

export interface UiConfigPayload {
  version: 2;
  columns: number;
  rowHeight: number;
  tabs: UiFieldLayoutTab[];
}

export interface LegacyUiFieldLayoutItem {
  token: string;
  col: number;
  row: number;
  width: number;
  height: number;
}

export interface LegacyUiConfigPayload {
  version: number;
  columns: number;
  rowHeight: number;
  items: LegacyUiFieldLayoutItem[];
}

export const UI_FIELD_LAYOUT_EXPORT_FORMAT = 'lorekit-ui-field-layout';
export const UI_FIELD_LAYOUT_EXPORT_VERSION = 2;

export interface PortableDynamicFieldDefinition {
  key: string;
  name: string;
  fieldType: string;
  options?: string;
  isEditorField: boolean;
  targetEntityTable?: string;
}

export interface UiFieldLayoutExportDocument {
  format: typeof UI_FIELD_LAYOUT_EXPORT_FORMAT;
  version: typeof UI_FIELD_LAYOUT_EXPORT_VERSION;
  entityTable: string;
  layout: UiConfigPayload;
  dynamicFields: PortableDynamicFieldDefinition[];
}

export function createFieldLayoutItem(token: string, col: number, row: number, width: number, height: number): UiFieldLayoutFieldItem {
  return { id: `field:${token}`, kind: 'field', token, col, row, width, height };
}

export function normalizeUiConfigPayload(value: unknown, legacyTabName = 'Propriedades'): UiConfigPayload {
  if (!isRecord(value)) throw new Error('A configuracao do layout e invalida.');
  const columns = integerInRange(value['columns'], 1, 24);
  const rowHeight = integerInRange(value['rowHeight'], 24, 200);
  if (Array.isArray(value['items'])) {
    const name = legacyTabName.trim() || 'Propriedades';
    return validateUiConfigPayload({
      version: 2,
      columns,
      rowHeight,
      tabs: [{ id: legacyTabId(name), name, items: value['items'].map((item) => normalizeLegacyItem(item)) }],
    });
  }
  if (value['version'] !== 2 || !Array.isArray(value['tabs'])) throw new Error('A configuracao do layout e invalida.');
  return validateUiConfigPayload({ version: 2, columns, rowHeight, tabs: value['tabs'].map((tab) => normalizeTab(tab)) });
}

export function validateUiConfigPayload(payload: UiConfigPayload): UiConfigPayload {
  if (!payload.tabs.length) throw new Error('O layout precisa conter ao menos uma aba.');
  const tabIds = new Set<string>();
  const tabNames = new Set<string>();
  const itemIds = new Set<string>();
  const fieldTokens = new Set<string>();
  for (const tab of payload.tabs) {
    const normalizedName = tab.name.trim().toLocaleLowerCase();
    if (!tab.id.trim() || tabIds.has(tab.id) || !normalizedName || tabNames.has(normalizedName)) throw new Error('Cada aba precisa de id e nome unicos.');
    tabIds.add(tab.id);
    tabNames.add(normalizedName);
    for (const item of tab.items) {
      if (!item.id.trim() || itemIds.has(item.id)) throw new Error('Cada item do layout precisa de um id unico.');
      itemIds.add(item.id);
      validatePosition(item, payload.columns);
      if (item.color !== undefined && !isHexColor(item.color)) throw new Error('A cor de um item do layout e invalida.');
      if (item.kind === 'field') {
        if (!item.token.trim() || fieldTokens.has(item.token)) throw new Error('Um campo nao pode aparecer mais de uma vez no layout.');
        fieldTokens.add(item.token);
      }
    }
  }
  return payload;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function normalizeLegacyItem(value: unknown): UiFieldLayoutFieldItem {
  if (!isRecord(value) || typeof value['token'] !== 'string') throw new Error('Um item do layout e invalido.');
  return createFieldLayoutItem(value['token'], positiveInteger(value['col']), positiveInteger(value['row']), positiveInteger(value['width']), positiveInteger(value['height']));
}

function normalizeTab(value: unknown): UiFieldLayoutTab {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['name'] !== 'string' || !Array.isArray(value['items'])) throw new Error('Uma aba do layout e invalida.');
  return { id: value['id'], name: value['name'].trim(), items: value['items'].map((item) => normalizeItem(item)) };
}

function normalizeItem(value: unknown): UiFieldLayoutItem {
  if (!isRecord(value) || typeof value['id'] !== 'string' || (value['kind'] !== 'field' && value['kind'] !== 'separator')) throw new Error('Um item do layout e invalido.');
  const base = {
    id: value['id'], col: positiveInteger(value['col']), row: positiveInteger(value['row']),
    width: positiveInteger(value['width']), height: positiveInteger(value['height']),
    ...(typeof value['color'] === 'string' && value['color'] ? { color: value['color'] } : {}),
  };
  if (value['kind'] === 'field') {
    if (typeof value['token'] !== 'string') throw new Error('Um campo do layout e invalido.');
    return { ...base, kind: 'field', token: value['token'] };
  }
  if (value['orientation'] !== 'horizontal' && value['orientation'] !== 'vertical') throw new Error('Um separador do layout e invalido.');
  return { ...base, kind: 'separator', orientation: value['orientation'], ...(typeof value['label'] === 'string' && value['label'].trim() ? { label: value['label'].trim() } : {}) };
}

function validatePosition(item: UiFieldLayoutItem, columns: number): void {
  if (![item.col, item.row, item.width, item.height].every((part) => Number.isInteger(part) && part >= 1) || item.col + item.width - 1 > columns) throw new Error('A posicao de um item do layout e invalida.');
}

function positiveInteger(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1) throw new Error('Uma dimensao do layout e invalida.');
  return value as number;
}

function integerInRange(value: unknown, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error('Uma dimensao do layout e invalida.');
  return value as number;
}

function legacyTabId(name: string): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `tab:${slug || 'properties'}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class UiFieldConfig {
  id: string;
  uiConfig: string;
  entityTable: string;
  entityId: string | null;
  parentEntityTable: string | null;
  parentEntityId: string | null;
  templateId: string | null;

  constructor() {
    this.id = '';
    this.uiConfig = '';
    this.entityTable = '';
    this.entityId = null;
    this.parentEntityTable = null;
    this.parentEntityId = null;
    this.templateId = null;
  }
}

export class UiFieldTemplate {
  id: string;
  name: string;
  entityTable: string;
  uiConfig: string;

  constructor() {
    this.id = '';
    this.name = '';
    this.entityTable = '';
    this.uiConfig = '';
  }
}
