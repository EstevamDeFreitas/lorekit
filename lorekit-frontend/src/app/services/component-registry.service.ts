import { Injectable, Type } from '@angular/core';
import {
  parseRelationsViewEntityId,
  RELATIONS_VIEW_SECTION_ID,
  TabEntityType,
} from '../models/workspace.model';

export interface RegistryEntry {
  loader: () => Promise<Type<any>>;
  /** @Input() name on the edit component for the entity id */
  inputKey: string;
}

/** Maps entity types and view names to their lazy-loaded components + input key. */
const REGISTRY: Record<string, RegistryEntry> = {
  Character: {
    loader: () =>
      import('../pages/characters/character-edit/character-edit.component').then(
        m => m.CharacterEditComponent
      ),
    inputKey: 'characterIdInput',
  },
  Document: {
    loader: () =>
      import('../pages/documents/document-edit/document-edit.component').then(
        m => m.DocumentEditComponent
      ),
    inputKey: 'documentIdInput',
  },
  Location: {
    loader: () =>
      import('../pages/locations/location-edit/location-edit.component').then(
        m => m.LocationEditComponent
      ),
    inputKey: 'locationIdInput',
  },
  Specie: {
    loader: () =>
      import('../pages/species/specie-edit/specie-edit.component').then(
        m => m.SpecieEditComponent
      ),
    inputKey: 'specieIdInput',
  },
  Culture: {
    loader: () =>
      import('../pages/cultures/culture-edit/culture-edit.component').then(
        m => m.CultureEditComponent
      ),
    inputKey: 'cultureIdInput',
  },
  Organization: {
    loader: () =>
      import('../pages/organizations/organization-edit/organization-edit.component').then(
        m => m.OrganizationEditComponent
      ),
    inputKey: 'organizationIdInput',
  },
  Object: {
    loader: () =>
      import('../pages/objects/object-edit/object-edit.component').then(
        m => m.ObjectEditComponent
      ),
    inputKey: 'objectIdInput',
  },
  Timeline: {
    loader: () =>
      import('../pages/timelines/timeline-edit/timeline-edit.component').then(
        m => m.TimelineEditComponent
      ),
    inputKey: 'timelineIdInput',
  },
  World: {
    loader: () =>
      import('../pages/world/world-info/world-info.component').then(
        m => m.WorldInfoComponent
      ),
    inputKey: 'worldIdInput',
  },
  CharacterSheet: {
    loader: () =>
      import('../pages/ironpaw/irpw-character-sheet/irpw-character-sheet.component').then(
        m => m.IrpwCharacterSheetComponent
      ),
    inputKey: 'characterIdInput',
  },
  Vocations: {
    loader: () =>
      import('../pages/ironpaw/irpw-vocations/irpw-vocations.component').then(
        m => m.IrpwVocationsComponent
      ),
    inputKey: 'vocationIdInput',
  },
  // ── View tabs (no entity id input) ─────────────────────────────────────────
  'view:relations': {
    loader: () =>
      import('../pages/relations/relation-graph/relation-graph.component').then(
        m => m.RelationGraphComponent
      ),
    inputKey: '',
  },
  'view:character-sheet': {
    loader: () =>
      import('../pages/ironpaw/irpw-character-sheet/irpw-character-sheet-list.component').then(
        m => m.IrpwCharacterSheetListComponent
      ),
    inputKey: '',
  },
  'view:vocations': {
    loader: () =>
      import('../pages/ironpaw/irpw-vocations/irpw-vocations-list.component').then(
        m => m.IrpwVocationsListComponent
      ),
    inputKey: '',
  },
};

@Injectable({ providedIn: 'root' })
export class ComponentRegistryService {
  private cache = new Map<string, Type<any>>();

  /** Returns the registry key for a given tab (entity type or 'view:viewName'). */
  static registryKey(entityType: TabEntityType, entityId: string): string {
    if (entityType !== 'view') {
      return entityType;
    }

    if (entityId === RELATIONS_VIEW_SECTION_ID || !!parseRelationsViewEntityId(entityId)) {
      return `view:${RELATIONS_VIEW_SECTION_ID}`;
    }

    return `view:${entityId}`;
  }

  /** Lazy-loads and caches the component for a tab. */
  async getComponent(entityType: TabEntityType, entityId: string): Promise<Type<any> | null> {
    const key = ComponentRegistryService.registryKey(entityType, entityId);
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    const entry = REGISTRY[key];
    if (!entry) {
      console.warn(`ComponentRegistry: no entry for key "${key}"`);
      return null;
    }
    const component = await entry.loader();
    this.cache.set(key, component);
    return component;
  }

  /** Returns all @Input() bindings needed to render a tab component. */
  getTabInputs(entityType: TabEntityType, entityId: string): Record<string, string> {
    if (entityType !== 'view') {
      const key = ComponentRegistryService.registryKey(entityType, entityId);
      const inputKey = REGISTRY[key]?.inputKey ?? '';
      return inputKey ? { [inputKey]: entityId } : {};
    }

    const relationRoot = parseRelationsViewEntityId(entityId);
    if (relationRoot) {
      return {
        rootTable: relationRoot.table,
        rootId: relationRoot.id,
      };
    }

    return {};
  }
}
