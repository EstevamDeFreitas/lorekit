import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { UiConfigPayload, UiFieldCatalogItem, UiFieldConfig, UiFieldTemplate } from '../models/ui-field-config.model';
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
        return this.parseConfigOrDefault(entityTable, parentRow.uiConfig);
      }
    }

    const globalRow = rows.find((row) => (
      !row.entityId &&
      !row.parentEntityTable &&
      !row.parentEntityId
    ));

    if (globalRow) {
      return this.parseConfigOrDefault(entityTable, globalRow.uiConfig);
    }

    return getSystemDefaultConfig(entityTable);
  }

  saveConfig(options: {
    entityTable: string;
    scopeMode: ScopeMode;
    uiConfig: UiConfigPayload;
    entityId?: string | null;
    parentEntityTable?: string | null;
    parentEntityId?: string | null;
  }): UiFieldConfig {
    const rowToSave = this.buildScopeRow(options);
    const existing = this.findExistingByScope(rowToSave);

    if (existing) {
      const updated = this.crud.update('UiFieldConfig', existing.id, {
        uiConfig: JSON.stringify(options.uiConfig),
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

  private parseConfigOrDefault(entityTable: string, uiConfig: string): UiConfigPayload {
    try {
      const parsed = JSON.parse(uiConfig) as UiConfigPayload;
      if (!parsed || !Array.isArray(parsed.items)) {
        return getSystemDefaultConfig(entityTable);
      }

      return {
        version: parsed.version ?? 1,
        columns: parsed.columns ?? 12,
        rowHeight: parsed.rowHeight ?? 56,
        items: parsed.items,
      };
    } catch {
      return getSystemDefaultConfig(entityTable);
    }
  }

  // ─── Template methods ───────────────────────────────────────────────────────

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
    return this.parseConfigOrDefault(template.entityTable, template.uiConfig);
  }
}

export function getSystemCatalog(entityTable: string): UiFieldCatalogItem[] {
  if (entityTable === 'Culture') {
    return [
      { token: 'schema:values', key: 'values', label: 'Valores', source: 'schema', isEditorField: false },
      { token: 'schema:technologyLevel', key: 'technologyLevel', label: 'Nivel Tecnologico', source: 'schema', isEditorField: false },
      { token: 'schema:language', key: 'language', label: 'Linguagem', source: 'schema', isEditorField: false },
      { token: 'schema:traditions', key: 'traditions', label: 'Tradicoes', source: 'schema', isEditorField: true },
      { token: 'schema:socialStructure', key: 'socialStructure', label: 'Estrutura Social', source: 'schema', isEditorField: true },
      { token: 'schema:beliefSystems', key: 'beliefSystems', label: 'Crencas', source: 'schema', isEditorField: true },
      { token: 'schema:culinaryPractices', key: 'culinaryPractices', label: 'Praticas Culinarias', source: 'schema', isEditorField: true },
      { token: 'schema:concept', key: 'concept', label: 'Conceito', source: 'schema', isEditorField: false },
    ];
  }

  if (entityTable === 'Character') {
    return [
      { token: 'schema:age', key: 'age', label: 'Idade', source: 'schema', isEditorField: false },
      { token: 'schema:height', key: 'height', label: 'Altura', source: 'schema', isEditorField: false },
      { token: 'schema:weight', key: 'weight', label: 'Peso', source: 'schema', isEditorField: false },
      { token: 'schema:occupation', key: 'occupation', label: 'Ocupacao', source: 'schema', isEditorField: false },
      { token: 'schema:alignment', key: 'alignment', label: 'Alinhamento', source: 'schema', isEditorField: false },
      { token: 'schema:personality', key: 'personality', label: 'Personalidade', source: 'schema', isEditorField: true },
      { token: 'schema:appearance', key: 'appearance', label: 'Aparencia', source: 'schema', isEditorField: true },
      { token: 'schema:objectives', key: 'objectives', label: 'Objetivos', source: 'schema', isEditorField: true },
    ];
  }

  if (entityTable === 'Species') {
    return [
      { token: 'schema:classification', key: 'classification', label: 'Classificacao', source: 'schema', isEditorField: false },
      { token: 'schema:diet', key: 'diet', label: 'Dieta', source: 'schema', isEditorField: false },
      { token: 'schema:averageLifespan', key: 'averageLifespan', label: 'Expectativa de Vida (anos)', source: 'schema', isEditorField: false },
      { token: 'schema:averageHeight', key: 'averageHeight', label: 'Altura media (metros)', source: 'schema', isEditorField: false },
      { token: 'schema:averageWeight', key: 'averageWeight', label: 'Peso medio (kg)', source: 'schema', isEditorField: false },
      { token: 'schema:physicalCharacteristics', key: 'physicalCharacteristics', label: 'Caracteristicas fisicas', source: 'schema', isEditorField: true },
      { token: 'schema:behavioralCharacteristics', key: 'behavioralCharacteristics', label: 'Caracteristicas comportamentais', source: 'schema', isEditorField: true },
    ];
  }

  if (entityTable === 'World') {
    return [
      { token: 'schema:concept', key: 'concept', label: 'Conceito', source: 'schema', isEditorField: false },
    ];
  }

  return [];
}

export function getSystemDefaultConfig(entityTable: string): UiConfigPayload {
  if (entityTable === 'Culture') {
    return {
      version: 1,
      columns: 12,
      rowHeight: 56,
      items: [
        { token: 'schema:values', col: 1, row: 1, width: 4, height: 1 },
        { token: 'schema:technologyLevel', col: 5, row: 1, width: 4, height: 1 },
        { token: 'schema:language', col: 9, row: 1, width: 4, height: 1 },
        { token: 'schema:traditions', col: 1, row: 2, width: 6, height: 6 },
        { token: 'schema:socialStructure', col: 7, row: 2, width: 6, height: 6 },
        { token: 'schema:beliefSystems', col: 1, row: 8, width: 6, height: 6 },
        { token: 'schema:culinaryPractices', col: 7, row: 8, width: 6, height: 6 },
      ],
    };
  }

  if (entityTable === 'Character') {
    return {
      version: 1,
      columns: 12,
      rowHeight: 56,
      items: [
        { token: 'schema:age', col: 1, row: 1, width: 2, height: 1 },
        { token: 'schema:height', col: 3, row: 1, width: 2, height: 1 },
        { token: 'schema:weight', col: 5, row: 1, width: 2, height: 1 },
        { token: 'schema:occupation', col: 7, row: 1, width: 3, height: 1 },
        { token: 'schema:alignment', col: 10, row: 1, width: 3, height: 1 },
        { token: 'schema:personality', col: 1, row: 2, width: 6, height: 6 },
        { token: 'schema:appearance', col: 7, row: 2, width: 6, height: 6 },
        { token: 'schema:objectives', col: 1, row: 8, width: 12, height: 6 },
      ],
    };
  }

  if (entityTable === 'Species') {
    return {
      version: 1,
      columns: 12,
      rowHeight: 56,
      items: [
        { token: 'schema:classification', col: 1, row: 1, width: 3, height: 1 },
        { token: 'schema:diet', col: 4, row: 1, width: 3, height: 1 },
        { token: 'schema:averageLifespan', col: 7, row: 1, width: 3, height: 1 },
        { token: 'schema:averageHeight', col: 10, row: 1, width: 3, height: 1 },
        { token: 'schema:averageWeight', col: 1, row: 2, width: 3, height: 1 },
        { token: 'schema:physicalCharacteristics', col: 1, row: 3, width: 6, height: 6 },
        { token: 'schema:behavioralCharacteristics', col: 7, row: 3, width: 6, height: 6 },
      ],
    };
  }

  if (entityTable === 'World') {
    return {
      version: 1,
      columns: 12,
      rowHeight: 56,
      items: [
        { token: 'schema:concept', col: 1, row: 1, width: 12, height: 2 },
      ],
    };
  }

  return {
    version: 1,
    columns: 12,
    rowHeight: 56,
    items: [],
  };
}
