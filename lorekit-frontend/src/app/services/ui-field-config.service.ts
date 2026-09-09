import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { createFieldLayoutItem, normalizeUiConfigPayload, UiConfigPayload, UiFieldCatalogItem, UiFieldConfig, UiFieldControl, UiFieldTemplate } from '../models/ui-field-config.model';
import { DynamicField } from '../models/dynamicfields.model';
import { DynamicFieldService } from './dynamic-field.service';

type ScopeMode = 'entity' | 'parent' | 'global';

type RelationshipRow = {
  parentTable: string;
  parentId: string;
};

@Injectable({
  providedIn: 'root'
})
export class UiFieldConfigService {
  private crud: CrudHelper;

  constructor(
    private dbProvider: DbProvider,
    private dynamicFieldService: DynamicFieldService,
  ) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getCatalog(entityTable: string): UiFieldCatalogItem[] {
    const fixedFields = getSystemCatalog(entityTable);
    const dynamicFields = this.dynamicFieldService.getDynamicFields(entityTable)
      .map((field) => ({
        token: `dynamic:${field.id}`,
        key: field.id,
        label: field.name,
        source: 'dynamic' as const,
        isEditorField: !!field.isEditorField,
        fieldType: field.fieldType || 'text',
        control: dynamicControl(field),
      }));

    return [...fixedFields, ...dynamicFields];
  }

  saveDynamicField(field: DynamicField): DynamicField {
    return this.dynamicFieldService.saveDynamicField(field);
  }

  getResolvedConfig(entityTable: string, entityId: string | null): UiConfigPayload {
    const rows = this.getRowsForEntityTable(entityTable);
    const entityRow = entityId
      ? rows.find((row) => row.entityId === entityId)
      : undefined;

    if (entityRow) {
      if (entityRow.templateId) {
        const tpl = this.getTemplates(entityTable).find((t) => t.id === entityRow.templateId);
        if (tpl) return this.parseTemplateConfig(tpl);
      }
      return this.parseConfigOrDefault(entityTable, entityRow.uiConfig);
    }

    if (entityId) {
      const parents = this.getParentRelationships(entityTable, entityId);
      const parentRow = rows.find((row) => {
        if (!row.parentEntityTable || !row.parentEntityId) {
          return false;
        }
        return parents.some((parent) => (
          parent.parentTable === row.parentEntityTable &&
          parent.parentId === row.parentEntityId
        ));
      });

      if (parentRow) {
        if (parentRow.templateId) {
          const tpl = this.getTemplates(entityTable).find((t) => t.id === parentRow.templateId);
          if (tpl) return this.parseTemplateConfig(tpl);
        }
        return this.parseConfigOrDefault(entityTable, parentRow.uiConfig);
      }
    }

    const globalRow = rows.find((row) => (
      !row.entityId &&
      !row.parentEntityTable &&
      !row.parentEntityId
    ));

    if (globalRow) {
      if (globalRow.templateId) {
        const tpl = this.getTemplates(entityTable).find((t) => t.id === globalRow.templateId);
        if (tpl) return this.parseTemplateConfig(tpl);
      }
      return this.parseConfigOrDefault(entityTable, globalRow.uiConfig);
    }

    return getSystemDefaultConfig(entityTable);
  }

  hasEntityConfig(entityTable: string, entityId: string): boolean {
    return this.getRowsForEntityTable(entityTable).some((row) => row.entityId === entityId);
  }

  saveConfig(options: {
    entityTable: string;
    scopeMode: ScopeMode;
    uiConfig: UiConfigPayload;
    entityId?: string | null;
    parentEntityTable?: string | null;
    parentEntityId?: string | null;
    templateId?: string | null;
  }): UiFieldConfig {
    const rowToSave = this.buildScopeRow(options);
    const existing = this.findExistingByScope(rowToSave);

    if (existing) {
      const updated = this.crud.update('UiFieldConfig', existing.id, {
        uiConfig: JSON.stringify(options.uiConfig),
        templateId: options.templateId ?? null,
      });
      return updated as UiFieldConfig;
    }

    const created = this.crud.create('UiFieldConfig', {
      id: crypto.randomUUID(),
      uiConfig: JSON.stringify(options.uiConfig),
      entityTable: rowToSave.entityTable,
      entityId: rowToSave.entityId,
      parentEntityTable: rowToSave.parentEntityTable,
      parentEntityId: rowToSave.parentEntityId,
      templateId: options.templateId ?? null,
    });

    return created as UiFieldConfig;
  }

  deleteConfig(options: {
    entityTable: string;
    scopeMode: ScopeMode;
    entityId?: string | null;
    parentEntityTable?: string | null;
    parentEntityId?: string | null;
  }): boolean {
    const rowToDelete = this.buildScopeRow(options);
    const existing = this.findExistingByScope(rowToDelete);

    if (!existing) {
      return false;
    }

    this.crud.deleteWhen('UiFieldConfig', { id: existing.id });
    return true;
  }

  private buildScopeRow(options: {
    entityTable: string;
    scopeMode: ScopeMode;
    entityId?: string | null;
    parentEntityTable?: string | null;
    parentEntityId?: string | null;
  }): UiFieldConfig {
    const row = new UiFieldConfig();
    row.entityTable = options.entityTable;

    if (options.scopeMode === 'entity') {
      row.entityId = options.entityId ?? null;
      row.parentEntityTable = null;
      row.parentEntityId = null;
      return row;
    }

    if (options.scopeMode === 'parent') {
      row.entityId = null;
      row.parentEntityTable = options.parentEntityTable ?? null;
      row.parentEntityId = options.parentEntityId ?? null;
      return row;
    }

    row.entityId = null;
    row.parentEntityTable = null;
    row.parentEntityId = null;
    return row;
  }

  private findExistingByScope(target: UiFieldConfig): UiFieldConfig | null {
    const rows = this.getRowsForEntityTable(target.entityTable);
    const match = rows.find((row) => (
      (row.entityId ?? null) === (target.entityId ?? null) &&
      (row.parentEntityTable ?? null) === (target.parentEntityTable ?? null) &&
      (row.parentEntityId ?? null) === (target.parentEntityId ?? null)
    ));

    return match ?? null;
  }

  private getRowsForEntityTable(entityTable: string): UiFieldConfig[] {
    const rows = this.crud.findAll('UiFieldConfig', { entityTable });
    return rows as UiFieldConfig[];
  }

  private getParentRelationships(entityTable: string, entityId: string): RelationshipRow[] {
    const db = this.dbProvider.getDb<any>();
    const sql = `
      SELECT parentTable, parentId
      FROM "Relationship"
      WHERE entityTable = ? AND entityId = ?
    `;

    const result = db.exec(sql, [entityTable, entityId]);
    if (!result.length) {
      return [];
    }

    const columns = result[0].columns;
    return result[0].values.map((row: unknown[]) => {
      const parentTable = row[columns.indexOf('parentTable')];
      const parentId = row[columns.indexOf('parentId')];
      return {
        parentTable: String(parentTable),
        parentId: String(parentId),
      };
    });
  }

  private parseConfigOrDefault(entityTable: string, uiConfig: string, legacyTabName = 'Propriedades'): UiConfigPayload {
    try {
      return normalizeUiConfigPayload(JSON.parse(uiConfig), legacyTabName);
    } catch {
      return getSystemDefaultConfig(entityTable);
    }
  }

  // ─── Template methods ───────────────────────────────────────────────────────

  getEntityItemsForTable(tableName: string): { value: string; label: string }[] {
    const db = this.dbProvider.getDb<any>();
    const pragma = db.exec(`PRAGMA table_info("${tableName}")`);
    if (!pragma.length) return [];

    const nameIndex = pragma[0].columns.indexOf('name');
    const cols = pragma[0].values.map((row: unknown[]) => String(row[nameIndex]));
    const labelColumn = cols.includes('name') ? 'name' : cols.includes('title') ? 'title' : null;

    const sql = labelColumn
      ? `SELECT id, "${labelColumn}" as label FROM "${tableName}" ORDER BY "${labelColumn}" COLLATE NOCASE`
      : `SELECT id FROM "${tableName}" ORDER BY id`;

    const result = db.exec(sql);
    if (!result.length) return [];

    const columns = result[0].columns;
    return result[0].values.map((row: unknown[]) => {
      const id = String(row[columns.indexOf('id')]);
      const labelRaw = columns.includes('label') ? row[columns.indexOf('label')] : null;
      return { value: id, label: labelRaw ? String(labelRaw) : id };
    });
  }

  getTemplates(entityTable: string): UiFieldTemplate[] {
    const rows = this.crud.findAll('UiFieldTemplate', { entityTable });
    return rows as UiFieldTemplate[];
  }

  saveTemplate(name: string, entityTable: string, uiConfig: UiConfigPayload): UiFieldTemplate {
    const existing = this.crud.findAll('UiFieldTemplate', { entityTable, name }) as UiFieldTemplate[];
    const payload = JSON.stringify(uiConfig);

    if (existing.length > 0) {
      this.crud.update('UiFieldTemplate', existing[0].id, { uiConfig: payload });
      return { ...existing[0], uiConfig: payload };
    }

    const created = this.crud.create('UiFieldTemplate', {
      id: crypto.randomUUID(),
      name,
      entityTable,
      uiConfig: payload,
    });
    return created as UiFieldTemplate;
  }

  updateTemplate(id: string, name: string, uiConfig: UiConfigPayload): void {
    this.crud.update('UiFieldTemplate', id, {
      name,
      uiConfig: JSON.stringify(uiConfig),
    });
  }

  deleteTemplate(id: string): void {
    this.crud.deleteWhen('UiFieldTemplate', { id });
  }

  parseTemplateConfig(template: UiFieldTemplate): UiConfigPayload {
    return this.parseConfigOrDefault(template.entityTable, template.uiConfig, template.name);
  }
}

export function getSystemCatalog(entityTable: string): UiFieldCatalogItem[] {
  if (entityTable === 'Culture') {
    return [
      systemField('values', 'Valores', 'input'),
      systemField('technologyLevel', 'Nivel Tecnologico', 'input'),
      systemField('language', 'Linguagem', 'input'),
      systemField('traditions', 'Tradicoes', 'editor'),
      systemField('socialStructure', 'Estrutura Social', 'editor'),
      systemField('beliefSystems', 'Crencas', 'editor'),
      systemField('culinaryPractices', 'Praticas Culinarias', 'editor'),
      systemField('concept', 'Conceito', 'textarea'),
    ];
  }

  if (entityTable === 'Character') {
    return [
      systemField('age', 'Idade', 'input'),
      systemField('height', 'Altura', 'input'),
      systemField('weight', 'Peso', 'input'),
      systemField('occupation', 'Ocupacao', 'input'),
      systemField('alignment', 'Alinhamento', 'input'),
      systemField('personality', 'Personalidade', 'editor'),
      systemField('appearance', 'Aparencia', 'editor'),
      systemField('objectives', 'Objetivos', 'editor'),
    ];
  }

  if (entityTable === 'Species') {
    return [
      systemField('classification', 'Classificacao', 'input'),
      systemField('diet', 'Dieta', 'input'),
      systemField('averageLifespan', 'Expectativa de Vida (anos)', 'input'),
      systemField('averageHeight', 'Altura media (metros)', 'input'),
      systemField('averageWeight', 'Peso medio (kg)', 'input'),
      systemField('physicalCharacteristics', 'Caracteristicas fisicas', 'editor'),
      systemField('behavioralCharacteristics', 'Caracteristicas comportamentais', 'editor'),
    ];
  }

  if (entityTable === 'World') {
    return [
      systemField('concept', 'Conceito', 'textarea'),
    ];
  }

  return [];
}

export function getSystemDefaultConfig(entityTable: string): UiConfigPayload {
  let items: Array<[string, number, number, number, number]> = [];
  if (entityTable === 'Culture') {
    items = [['schema:values', 1, 1, 4, 1], ['schema:technologyLevel', 5, 1, 4, 1], ['schema:language', 9, 1, 4, 1], ['schema:traditions', 1, 2, 6, 6], ['schema:socialStructure', 7, 2, 6, 6], ['schema:beliefSystems', 1, 8, 6, 6], ['schema:culinaryPractices', 7, 8, 6, 6]];
  } else if (entityTable === 'Character') {
    items = [['schema:age', 1, 1, 2, 1], ['schema:height', 3, 1, 2, 1], ['schema:weight', 5, 1, 2, 1], ['schema:occupation', 7, 1, 3, 1], ['schema:alignment', 10, 1, 3, 1], ['schema:personality', 1, 2, 6, 6], ['schema:appearance', 7, 2, 6, 6], ['schema:objectives', 1, 8, 12, 6]];
  } else if (entityTable === 'Species') {
    items = [['schema:classification', 1, 1, 3, 1], ['schema:diet', 4, 1, 3, 1], ['schema:averageLifespan', 7, 1, 3, 1], ['schema:averageHeight', 10, 1, 3, 1], ['schema:averageWeight', 1, 2, 3, 1], ['schema:physicalCharacteristics', 1, 3, 6, 6], ['schema:behavioralCharacteristics', 7, 3, 6, 6]];
  } else if (entityTable === 'World') {
    items = [['schema:concept', 1, 1, 12, 2]];
  }
  return { version: 2, columns: 12, rowHeight: 56, tabs: [{ id: 'tab:properties', name: 'Propriedades', items: items.map(([token, col, row, width, height]) => createFieldLayoutItem(token, col, row, width, height)) }] };
}

function systemField(key: string, label: string, control: UiFieldControl): UiFieldCatalogItem {
  return { token: `schema:${key}`, key, label, source: 'schema', isEditorField: control === 'editor', fieldType: control, control };
}

function dynamicControl(field: DynamicField): UiFieldControl {
  if (field.fieldType === 'image' || field.fieldType === 'entity' || field.fieldType === 'options') return field.fieldType;
  return field.isEditorField || field.fieldType === 'editor' ? 'editor' : 'input';
}
