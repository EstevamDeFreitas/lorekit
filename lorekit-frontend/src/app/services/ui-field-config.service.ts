import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';
import { UiConfigPayload, UiFieldCatalogItem, UiFieldConfig } from '../models/ui-field-config.model';
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

  return {
    version: 1,
    columns: 12,
    rowHeight: 56,
    items: [],
  };
}
