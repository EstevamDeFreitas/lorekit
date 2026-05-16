import { Injectable, Type } from '@angular/core';
import { TabEntityType } from '../models/workspace.model';

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
      import('../pages/ironpaw/irpw-character-sheet/irpw-character-sheet.component').then(
        m => m.IrpwCharacterSheetComponent
      ),
    inputKey: '',
  },
  'view:vocations': {
    loader: () =>
      import('../pages/ironpaw/irpw-vocations/irpw-vocations.component').then(
        m => m.IrpwVocationsComponent
      ),
    inputKey: '',
  },
};

@Injectable({ providedIn: 'root' })
export class ComponentRegistryService {
  private cache = new Map<string, Type<any>>();

  /** Returns the registry key for a given tab (entity type or 'view:viewName'). */
  static registryKey(entityType: TabEntityType, entityId: string): string {
    return entityType === 'view' ? `view:${entityId}` : entityType;
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

  /** Returns the @Input() name for the entity id of a given entity type. */
  getInputKey(entityType: TabEntityType, entityId: string): string {
    const key = ComponentRegistryService.registryKey(entityType, entityId);
    return REGISTRY[key]?.inputKey ?? '';
  }
}
