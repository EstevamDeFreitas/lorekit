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
  | 'Moodboard'
  | 'CharacterSheet'
  | 'Vocations'
  | 'view'; // view tabs have no entity id: relations, character-sheet, vocations, etc.

export const RELATIONS_VIEW_SECTION_ID = 'relations';
const RELATIONS_VIEW_SEPARATOR = '|';

export type RelationViewRoot = {
  table: string;
  id: string;
};

/**
 * For relation view tabs:
 * - default view: "relations"
 * - rooted view:  "relations|Table|uuid"
 */
export function buildRelationsViewEntityId(root?: RelationViewRoot | null): string {
  if (!root?.table || !root?.id) {
    return RELATIONS_VIEW_SECTION_ID;
  }

  return [
    RELATIONS_VIEW_SECTION_ID,
    encodeURIComponent(root.table),
    encodeURIComponent(root.id),
  ].join(RELATIONS_VIEW_SEPARATOR);
}

export function parseRelationsViewEntityId(entityId: string): RelationViewRoot | null {
  if (!entityId.startsWith(`${RELATIONS_VIEW_SECTION_ID}${RELATIONS_VIEW_SEPARATOR}`)) {
    return null;
  }

  const [, rawTable, rawId] = entityId.split(RELATIONS_VIEW_SEPARATOR);
  if (!rawTable || !rawId) {
    return null;
  }

  try {
    return {
      table: decodeURIComponent(rawTable),
      id: decodeURIComponent(rawId),
    };
  }
  catch {
    return null;
  }
}

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
