import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { schema } from '../database/schema';
import { DynamicField, DynamicFieldType } from '../models/dynamicfields.model';
import { normalizeUiConfigPayload, PortableDynamicFieldDefinition, UiConfigPayload, UiFieldConfig, UiFieldLayoutExportDocument, UiFieldLayoutFieldItem, UiFieldTemplate, UI_FIELD_LAYOUT_EXPORT_FORMAT, UI_FIELD_LAYOUT_EXPORT_VERSION } from '../models/ui-field-config.model';
import { DynamicFieldService } from './dynamic-field.service';
import { getSystemCatalog, UiFieldConfigService } from './ui-field-config.service';

export type UiFieldLayoutImportDestination = 'replace-global' | 'create-template';

export interface UiFieldLayoutImportPlan {
  document: UiFieldLayoutExportDocument;
  fieldsToCreate: DynamicField[];
  reusedFields: DynamicField[];
  hasExistingGlobalConfig: boolean;
}

@Injectable({ providedIn: 'root' })
export class UiFieldLayoutPortabilityService {
  private readonly crud: CrudHelper;

  constructor(dbProvider: DbProvider, private readonly dynamicFields: DynamicFieldService, private readonly configs: UiFieldConfigService) {
    this.crud = dbProvider.getCrudHelper();
  }

  exportLayout(entityTable: string, layout: UiConfigPayload): UiFieldLayoutExportDocument {
    const fields = new Map(this.dynamicFields.getDynamicFields(entityTable).map(field => [field.id, field]));
    const exported = new Map<string, PortableDynamicFieldDefinition>();
    const tabs = layout.tabs.map(tab => ({
      ...tab,
      items: tab.items.map(item => {
        if (item.kind !== 'field' || !item.token.startsWith('dynamic:')) return { ...item };
        const field = fields.get(item.token.slice(8));
        if (!field) throw new Error('Um campo dinamico usado neste layout nao foi encontrado.');
        const key = dynamicKey(field.name);
        exported.set(key, portableField(field, key));
        return { ...item, token: 'dynamic:' + key };
      }),
    }));
    return { format: UI_FIELD_LAYOUT_EXPORT_FORMAT, version: UI_FIELD_LAYOUT_EXPORT_VERSION, entityTable, layout: { version: 2, columns: layout.columns, rowHeight: layout.rowHeight, tabs }, dynamicFields: [...exported.values()] };
  }

  prepareLayoutImport(serialized: string): UiFieldLayoutImportPlan {
    let raw: unknown;
    try { raw = JSON.parse(serialized); } catch { throw new Error('O conteudo informado nao e um JSON valido.'); }
    const document = parseDocument(raw);
    this.validate(document);
    const existingByName = new Map(this.dynamicFields.getDynamicFields(document.entityTable).map(field => [normalize(field.name), field]));
    const fieldsToCreate: DynamicField[] = [];
    const reusedFields: DynamicField[] = [];
    for (const definition of document.dynamicFields) {
      const existing = existingByName.get(normalize(definition.name));
      if (!existing) {
        fieldsToCreate.push({ id: '', name: definition.name.trim(), entityTable: document.entityTable, fieldType: definition.fieldType as DynamicFieldType, options: definition.options, isEditorField: definition.isEditorField, targetEntityTable: definition.targetEntityTable });
      } else if (!sameDefinition(existing, definition)) {
        throw new Error('O campo dinamico "' + definition.name + '" ja existe com uma definicao diferente.');
      } else {
        reusedFields.push(existing);
      }
    }
    const rows = this.crud.findAll('UiFieldConfig', { entityTable: document.entityTable }) as UiFieldConfig[];
    return { document, fieldsToCreate, reusedFields, hasExistingGlobalConfig: rows.some(row => !row.entityId && !row.parentEntityTable && !row.parentEntityId) };
  }

  applyLayoutImport(plan: UiFieldLayoutImportPlan, destination: UiFieldLayoutImportDestination, templateName?: string): UiFieldConfig | UiFieldTemplate {
    const name = templateName?.trim() ?? '';
    if (destination === 'create-template') {
      if (!name) throw new Error('Informe um nome para o novo template.');
      if (this.configs.getTemplates(plan.document.entityTable).some(template => normalize(template.name) === normalize(name))) {
        throw new Error('Ja existe um template com este nome para a entidade importada.');
      }
    }
    const fields = new Map<string, DynamicField>();
    for (const field of plan.reusedFields) fields.set(dynamicKey(field.name), field);
    for (const field of plan.fieldsToCreate) {
      const created = this.dynamicFields.saveDynamicField(field);
      fields.set(dynamicKey(created.name), created);
    }
    const layout: UiConfigPayload = {
      version: 2,
      columns: plan.document.layout.columns,
      rowHeight: plan.document.layout.rowHeight,
      tabs: plan.document.layout.tabs.map(tab => ({
        ...tab,
        items: tab.items.map(item => {
          if (item.kind !== 'field' || !item.token.startsWith('dynamic:')) return { ...item };
          const field = fields.get(item.token.slice(8));
          if (!field) throw new Error('Um campo dinamico importado nao pode ser resolvido.');
          return { ...item, token: 'dynamic:' + field.id } as UiFieldLayoutFieldItem;
        }),
      })),
    };
    if (destination === 'create-template') return this.configs.saveTemplate(name, plan.document.entityTable, layout);
    return this.configs.saveConfig({ entityTable: plan.document.entityTable, scopeMode: 'global', uiConfig: layout });
  }

  private validate(document: UiFieldLayoutExportDocument): void {
    if (!schema.some(table => table.name === document.entityTable)) throw new Error('A entidade declarada no arquivo nao e suportada nesta instalacao.');
    const items = document.layout.tabs.flatMap(tab => tab.items);
    if (items.length > 200) throw new Error('A configuracao do grid e invalida.');
    const schemaTokens = new Set(getSystemCatalog(document.entityTable).map(field => field.token));
    const definitions = new Map(document.dynamicFields.map(field => [field.key, field]));
    for (const item of items) {
      if (item.kind !== 'field') continue;
      if (item.token.startsWith('schema:')) {
        if (!schemaTokens.has(item.token)) throw new Error('O campo original "' + item.token + '" nao existe para esta entidade.');
      } else if (!item.token.startsWith('dynamic:') || !definitions.has(item.token.slice(8))) {
        throw new Error('Um campo dinamico usado no layout nao foi declarado.');
      }
    }
    const seenNames = new Set<string>();
    for (const field of document.dynamicFields) {
      const name = normalize(field.name);
      if (!name || field.key !== dynamicKey(field.name) || seenNames.has(name) || !isFieldType(field.fieldType)) throw new Error('A definicao de um campo dinamico e invalida.');
      if (field.fieldType === 'entity' && (!field.targetEntityTable || !schema.some(table => table.name === field.targetEntityTable))) throw new Error('A entidade relacionada de um campo dinamico e invalida.');
      seenNames.add(name);
    }
  }
}

function parseDocument(raw: unknown): UiFieldLayoutExportDocument {
  if (!isRecord(raw) || raw['format'] !== UI_FIELD_LAYOUT_EXPORT_FORMAT || (raw['version'] !== 1 && raw['version'] !== UI_FIELD_LAYOUT_EXPORT_VERSION) || typeof raw['entityTable'] !== 'string' || !isRecord(raw['layout']) || !Array.isArray(raw['dynamicFields'])) throw new Error('O arquivo nao possui o formato de layout do Lorekit.');
  const layout = normalizeUiConfigPayload(raw['layout']);
  const dynamicFields = raw['dynamicFields'].map(field => {
    if (!isRecord(field) || typeof field['key'] !== 'string' || typeof field['name'] !== 'string' || typeof field['fieldType'] !== 'string' || typeof field['isEditorField'] !== 'boolean' || (field['options'] !== undefined && field['options'] !== null && typeof field['options'] !== 'string') || (field['targetEntityTable'] !== undefined && field['targetEntityTable'] !== null && typeof field['targetEntityTable'] !== 'string')) throw new Error('A definicao de um campo dinamico e invalida.');
    return { key: field['key'], name: field['name'], fieldType: field['fieldType'], options: typeof field['options'] === 'string' ? field['options'] : undefined, isEditorField: field['isEditorField'], targetEntityTable: typeof field['targetEntityTable'] === 'string' ? field['targetEntityTable'] : undefined };
  });
  return { format: UI_FIELD_LAYOUT_EXPORT_FORMAT, version: UI_FIELD_LAYOUT_EXPORT_VERSION, entityTable: raw['entityTable'], layout, dynamicFields };
}

function portableField(field: DynamicField, key: string): PortableDynamicFieldDefinition { return { key, name: field.name, fieldType: field.fieldType || 'text', options: field.options ?? undefined, isEditorField: !!field.isEditorField, targetEntityTable: field.targetEntityTable ?? undefined }; }
function sameDefinition(existing: DynamicField, imported: PortableDynamicFieldDefinition): boolean { return (existing.fieldType || 'text') === imported.fieldType && (existing.options ?? '') === (imported.options ?? '') && !!existing.isEditorField === imported.isEditorField && (existing.targetEntityTable ?? '') === (imported.targetEntityTable ?? ''); }
function dynamicKey(name: string): string { return normalize(name); }
function normalize(name: string): string { return name.trim().toLocaleLowerCase(); }
function isFieldType(value: string): value is DynamicFieldType { return ['text', 'options', 'editor', 'entity', 'image'].includes(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
