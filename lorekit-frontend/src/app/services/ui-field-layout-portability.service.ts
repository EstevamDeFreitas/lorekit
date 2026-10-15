import { Injectable, Optional } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { schema } from '../database/schema';
import { DynamicField, DynamicFieldType, isValidDynamicFieldOptions } from '../models/dynamicfields.model';
import { normalizeUiConfigPayload, PortableCalendarReference, PortableDynamicFieldDefinition, UiConfigPayload, UiFieldConfig, UiFieldLayoutExportDocument, UiFieldLayoutFieldItem, UiFieldTemplate, UI_FIELD_LAYOUT_EXPORT_FORMAT, UI_FIELD_LAYOUT_EXPORT_VERSION } from '../models/ui-field-config.model';
import { CalendarService } from './calendar.service';
import { CalendarBinding } from '../models/calendar.model';
import { parseCalendarFieldOptions } from '../utils/calendar-field-options';
import { normalizeCalendarRules } from '../utils/calendar-engine';
import { calendarRuleDifferences, portableCalendarRules } from '../utils/calendar-portability';
import { DynamicFieldService } from './dynamic-field.service';
import { getSystemCatalog, UiFieldConfigService } from './ui-field-config.service';

export type UiFieldLayoutImportDestination = 'replace-global' | 'create-template';

export interface UiFieldLayoutImportPlan {
  document: UiFieldLayoutExportDocument;
  fieldsToCreate: DynamicField[];
  reusedFields: DynamicField[];
  hasExistingGlobalConfig: boolean;
  unresolvedCalendarReferences?: PortableCalendarReference[];
  calendarAssociations?: Record<string, CalendarLayoutAssociation>;
  serialized?: string;
}
export interface CalendarLayoutAssociation { worldId: string; binding: CalendarBinding; acceptDifferences: boolean; }

@Injectable({ providedIn: 'root' })
export class UiFieldLayoutPortabilityService {
  private readonly crud: CrudHelper;

  constructor(dbProvider: DbProvider, private readonly dynamicFields: DynamicFieldService, private readonly configs: UiFieldConfigService, @Optional() private readonly calendars: CalendarService | null = null) {
    this.crud = dbProvider.getCrudHelper();
  }

  exportLayout(entityTable: string, layout: UiConfigPayload): UiFieldLayoutExportDocument {
    const fields = new Map(this.dynamicFields.getDynamicFields(entityTable).map(field => [field.id, field]));
    const exported = new Map<string, PortableDynamicFieldDefinition>();
    const calendarReferences: PortableCalendarReference[] = [];
    const tabs = layout.tabs.map(tab => ({
      ...tab,
      items: tab.items.map(item => {
        if (item.kind !== 'field' || !item.token.startsWith('dynamic:')) return { ...item };
        const field = fields.get(item.token.slice(8));
        if (!field) throw new Error('Um campo dinamico usado neste layout nao foi encontrado.');
        const key = dynamicKey(field.name);
        if (!exported.has(key)) {
          const definition = portableField(field, key);
          if (field.fieldType === 'calendar-date') {
            const options = parseCalendarFieldOptions(field.options);
            if (options.mode === 'fixed') for (const [worldId, binding] of Object.entries(options.bindings)) {
              if (!this.calendars) throw new Error('Serviço de calendários indisponível.');
              const resolved = this.calendars.resolve(binding, worldId), rules = portableCalendarRules(resolved.engine.rules);
              calendarReferences.push({ key: 'calendar-' + (calendarReferences.length + 1), fieldKey: key, label: resolved.calendar.name, rules,
                ...(binding.countId ? { countKey: rules.counts[resolved.engine.rules.counts.findIndex(c => c.id === binding.countId)]?.id } : {}),
                ...(binding.formatId ? { formatKey: rules.formats[resolved.engine.rules.formats.findIndex(f => f.id === binding.formatId)]?.id } : {}) });
            }
            definition.options = JSON.stringify({ version: 1, kind: 'calendar-date', mode: options.mode, allowTime: options.allowTime, bindings: {} });
          }
          exported.set(key, definition);
        }
        return { ...item, id: 'field:dynamic:' + key, token: 'dynamic:' + key };
      }),
    }));
    return { format: UI_FIELD_LAYOUT_EXPORT_FORMAT, version: UI_FIELD_LAYOUT_EXPORT_VERSION, entityTable, layout: { version: 2, columns: layout.columns, rowHeight: layout.rowHeight, tabs }, dynamicFields: [...exported.values()], ...(calendarReferences.length ? { calendarReferences } : {}) };
  }

  prepareLayoutImport(serialized: string, associations: Record<string, CalendarLayoutAssociation> = {}): UiFieldLayoutImportPlan {
    let raw: unknown;
    try { raw = JSON.parse(serialized); } catch { throw new Error('O conteudo informado nao e um JSON valido.'); }
    const document = parseDocument(raw);
    this.validate(document);
    const rows = this.crud.findAll('UiFieldConfig', { entityTable: document.entityTable }) as UiFieldConfig[];
    const hasExistingGlobalConfig = rows.some(row => !row.entityId && !row.parentEntityTable && !row.parentEntityId);
    const missing = (document.calendarReferences ?? []).filter(reference => !associations[reference.key]);
    if (missing.length) return { document, fieldsToCreate: [], reusedFields: [], hasExistingGlobalConfig, unresolvedCalendarReferences: missing, serialized, calendarAssociations: associations };
    for (const reference of document.calendarReferences ?? []) {
      if (!this.calendars) throw new Error('Serviço de calendários indisponível.');
      const association = associations[reference.key];
      if (!association?.worldId) throw new Error('Selecione o mundo de destino.');
      const resolved = this.calendars.resolve(association.binding, association.worldId);
      const differences = calendarRuleDifferences(reference.rules, resolved.engine.rules);
      if (differences.length && !association.acceptDifferences) throw new Error('Confirme as diferenças do calendário: ' + differences.join('; ') + '.');
      const definition = document.dynamicFields.find(field => field.key === reference.fieldKey)!;
      const options = parseCalendarFieldOptions(definition.options), binding = { ...association.binding };
      if (reference.countKey && !binding.countId) {
        const index = reference.rules.counts.findIndex(c => c.id === reference.countKey);
        if (differences.length || !resolved.engine.rules.counts[index]) throw new Error('Selecione a contagem dos anos de destino.');
        binding.countId = resolved.engine.rules.counts[index].id;
      }
      if (reference.formatKey && !binding.formatId) {
        const index = reference.rules.formats.findIndex(f => f.id === reference.formatKey);
        if (differences.length || !resolved.engine.rules.formats[index]) throw new Error('Selecione o formato de destino.');
        binding.formatId = resolved.engine.rules.formats[index].id;
      }
      this.calendars.resolve(binding, association.worldId);
      if (options.bindings[association.worldId]) throw new Error('Associe referências distintas deste campo a mundos de destino distintos.');
      options.bindings[association.worldId] = binding; definition.options = JSON.stringify(options);
    }
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
    return { document, fieldsToCreate, reusedFields, hasExistingGlobalConfig, ...(document.calendarReferences?.length ? { unresolvedCalendarReferences: [], serialized, calendarAssociations: associations } : {}) };
  }

  applyLayoutImport(plan: UiFieldLayoutImportPlan, destination: UiFieldLayoutImportDestination, templateName?: string): UiFieldConfig | UiFieldTemplate {
    if (plan.unresolvedCalendarReferences?.length) throw new Error('Associe os calendários antes de aplicar o layout.');
    if (plan.document.calendarReferences?.length) {
      plan = this.prepareLayoutImport(plan.serialized!, plan.calendarAssociations);
      if (plan.unresolvedCalendarReferences?.length) throw new Error('Existem referências de calendário não resolvidas.');
    }
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
      if ((field.fieldType === 'slider' || field.fieldType === 'list' || field.fieldType === 'chart' || field.fieldType === 'calendar-date') && !isValidDynamicFieldOptions(field.fieldType, field.options)) throw new Error('A configuracao de um campo dinamico e invalida.');
      if (field.fieldType === 'calendar-date' && Object.keys(parseCalendarFieldOptions(field.options).bindings).length) throw new Error('Use referências portáveis de calendário, sem IDs locais nas opções.');
      if (field.fieldType === 'entity' && (!field.targetEntityTable || !schema.some(table => table.name === field.targetEntityTable))) throw new Error('A entidade relacionada de um campo dinamico e invalida.');
      seenNames.add(name);
    }
    const keys = new Set<string>();
    for (const reference of document.calendarReferences ?? []) {
      if (!reference.key || keys.has(reference.key) || typeof reference.label !== 'string' || !document.dynamicFields.some(f => f.key === reference.fieldKey && f.fieldType === 'calendar-date')) throw new Error('Referência de calendário inválida.');
      keys.add(reference.key); normalizeCalendarRules(reference.rules);
      if (reference.countKey && !reference.rules.counts.some(c => c.id === reference.countKey)) throw new Error('Contagem portável inválida.');
      if (reference.formatKey && !reference.rules.formats.some(f => f.id === reference.formatKey)) throw new Error('Formato portável inválido.');
    }
  }
}

function parseDocument(raw: unknown): UiFieldLayoutExportDocument {
  if (!isRecord(raw) || raw['format'] !== UI_FIELD_LAYOUT_EXPORT_FORMAT || (raw['version'] !== 1 && raw['version'] !== 2 && raw['version'] !== UI_FIELD_LAYOUT_EXPORT_VERSION) || typeof raw['entityTable'] !== 'string' || !isRecord(raw['layout']) || !Array.isArray(raw['dynamicFields'])) throw new Error('O arquivo nao possui o formato de layout do Lorekit.');
  const layout = normalizeUiConfigPayload(raw['layout']);
  const dynamicFields = raw['dynamicFields'].map(field => {
    if (!isRecord(field) || typeof field['key'] !== 'string' || typeof field['name'] !== 'string' || typeof field['fieldType'] !== 'string' || typeof field['isEditorField'] !== 'boolean' || (field['options'] !== undefined && field['options'] !== null && typeof field['options'] !== 'string') || (field['targetEntityTable'] !== undefined && field['targetEntityTable'] !== null && typeof field['targetEntityTable'] !== 'string')) throw new Error('A definicao de um campo dinamico e invalida.');
    return { key: field['key'], name: field['name'], fieldType: field['fieldType'], options: typeof field['options'] === 'string' ? field['options'] : undefined, isEditorField: field['isEditorField'], targetEntityTable: typeof field['targetEntityTable'] === 'string' ? field['targetEntityTable'] : undefined };
  });
  if (raw['calendarReferences'] !== undefined && !Array.isArray(raw['calendarReferences'])) throw new Error('Manifesto de calendários inválido.');
  return { format: UI_FIELD_LAYOUT_EXPORT_FORMAT, version: UI_FIELD_LAYOUT_EXPORT_VERSION, entityTable: raw['entityTable'], layout, dynamicFields, ...(Array.isArray(raw['calendarReferences']) ? { calendarReferences: raw['calendarReferences'] as PortableCalendarReference[] } : {}) };
}

function portableField(field: DynamicField, key: string): PortableDynamicFieldDefinition { return { key, name: field.name, fieldType: field.fieldType || 'text', options: field.options ?? undefined, isEditorField: !!field.isEditorField, targetEntityTable: field.targetEntityTable ?? undefined }; }
function sameDefinition(existing: DynamicField, imported: PortableDynamicFieldDefinition): boolean { return (existing.fieldType || 'text') === imported.fieldType && (existing.options ?? '') === (imported.options ?? '') && !!existing.isEditorField === imported.isEditorField && (existing.targetEntityTable ?? '') === (imported.targetEntityTable ?? ''); }
function dynamicKey(name: string): string { return normalize(name); }
function normalize(name: string): string { return name.trim().toLocaleLowerCase(); }
function isFieldType(value: string): value is DynamicFieldType { return ['text', 'options', 'editor', 'entity', 'image', 'slider', 'list', 'chart', 'calendar-date'].includes(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
