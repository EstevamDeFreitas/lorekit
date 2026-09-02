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

export const UI_FIELD_LAYOUT_EXPORT_FORMAT = 'lorekit-ui-field-layout';
export const UI_FIELD_LAYOUT_EXPORT_VERSION = 1;

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
