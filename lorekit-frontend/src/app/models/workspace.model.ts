import { Type } from '@angular/core';

export type TabEntityType =
  | 'Character'
  | 'Document'
  | 'Location'
  | 'Specie'
  | 'Culture'
  | 'Organization'
  | 'Object'
  | 'Timeline'
  | 'World'
  | 'CharacterSheet'
  | 'Vocations'
  | 'view'; // view tabs have no entity id: relations, character-sheet, vocations, etc.

export interface WorkspaceTab {
  id: string;
  title: string;
  icon: string;
  entityType: TabEntityType;
  /** For entity tabs: entity UUID. For view tabs: view name (e.g. 'relations', 'character-sheet') */
  entityId: string;
  paneId: string;
  isDirty: boolean;
  /** Loaded async — NOT serialized to disk */
  resolvedComponent?: Type<any>;
}

export interface WorkspacePane {
  id: string;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
}

export interface WorkspaceLayout {
  panes: WorkspacePane[];
  /** flex-basis percentage for each pane — length matches panes.length */
  splitRatios: number[];
  focusedPaneId: string;
  /** Which entity section is shown in the left sidebar (e.g. 'character', 'document') */
  activeSidebarSection: string;
  sidebarVisible: boolean;
}

// ── Serializable (persisted) versions ──────────────────────────────────────

export interface SerializableTab {
  id: string;
  title: string;
  icon: string;
  entityType: TabEntityType;
  entityId: string;
  paneId: string;
  isDirty: boolean;
}

export interface SerializableLayout {
  panes: {
    id: string;
    tabs: SerializableTab[];
    activeTabId: string | null;
  }[];
  splitRatios: number[];
  focusedPaneId: string;
  activeSidebarSection: string;
  sidebarVisible: boolean;
}
