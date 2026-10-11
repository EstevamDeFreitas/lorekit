import { Injectable } from '@angular/core';
import { DbProvider } from '../app.config';
import { EntityExportPlan, planCharacterExport } from '../libs/entity-portability/entity-export.planner';
import { EntityImportPlan, planEntityImport } from '../libs/entity-portability/entity-import.planner';
import { parseEntityBundleManifest } from '../libs/entity-portability/entity-bundle.validator';
import type { DynamicField } from '../models/dynamicfields.model';
import { UiFieldConfigService } from './ui-field-config.service';

const SOURCE_TABLES = new Set(['Character', 'World', 'Personalization', 'Image', 'DynamicFieldValue', 'DynamicField', 'IRPWCharacterSheet']);

/** V2 preview APIs intentionally have no export-file/import-write entry point yet. */
@Injectable({ providedIn: 'root' })
export class EntityPortabilityService {
  constructor(private readonly dbProvider: DbProvider, private readonly configs: UiFieldConfigService) {}

  prepareExportV2(table: string, id: string, options: { includeChildren?: boolean } = {}): EntityExportPlan {
    if (table !== 'Character') throw new Error('Este marco v2 suporta somente personagens.');
    if (!this.dbProvider.ready()) throw new Error('O workspace não está disponível.');
    const crud = this.dbProvider.getCrudHelper();
    return planCharacterExport({
      find: reference => {
        if (!SOURCE_TABLES.has(reference.table)) throw new Error('Tabela não permitida na prévia v2.');
        return crud.findById(reference.table, reference.id) as Record<string, unknown> | null;
      },
      relationships: () => crud.findAll('Relationship'),
      // Future server ACLs must limit data before it arrives here. Connectivity
      // is not a permission: the current local workspace is already readable.
      canRead: reference => this.dbProvider.ready() && SOURCE_TABLES.has(reference.table),
      layout: characterId => this.configs.getResolvedConfig('Character', characterId),
    }, id, options);
  }

  prepareImportManifestV2(serializedManifest: string, destinationWorldId: string): EntityImportPlan {
    if (!this.dbProvider.ready()) throw new Error('O workspace não está disponível.');
    const crud = this.dbProvider.getCrudHelper();
    const manifest = parseEntityBundleManifest(serializedManifest);
    return planEntityImport(manifest, destinationWorldId, {
      world: id => crud.findById('World', id),
      canWriteWorld: () => !this.dbProvider.readOnly(),
      dynamicFields: () => crud.findAll('DynamicField', { entityTable: 'Character' }) as DynamicField[],
      idExists: (table, id) => Boolean(crud.findById(table, id)),
    });
  }
}
