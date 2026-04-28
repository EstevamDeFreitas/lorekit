export type UiFieldSource = 'schema' | 'dynamic';

export interface UiFieldCatalogItem {
  token: string;
  key: string;
  label: string;
  source: UiFieldSource;
  isEditorField: boolean;
  fieldType?: string;
}

export interface UiFieldLayoutItem {
  token: string;
  col: number;
  row: number;
  width: number;
  height: number;
}

export interface UiConfigPayload {
  version: number;
  columns: number;
  rowHeight: number;
  items: UiFieldLayoutItem[];
}

export class UiFieldConfig {
  id: string;
  uiConfig: string;
  entityTable: string;
  entityId: string | null;
  parentEntityTable: string | null;
  parentEntityId: string | null;

  constructor() {
    this.id = '';
    this.uiConfig = '';
    this.entityTable = '';
    this.entityId = null;
    this.parentEntityTable = null;
    this.parentEntityId = null;
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
