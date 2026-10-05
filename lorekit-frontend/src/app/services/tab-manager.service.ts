import { inject, Injectable, signal } from '@angular/core';
import { EntityHistoryService } from './entity-history.service';
import { BehaviorSubject } from 'rxjs';
import {
  buildRelationsViewEntityId,
  parseRelationsViewEntityId,
  RelationViewRoot,
  RELATIONS_VIEW_SECTION_ID,
  SerializableLayout,
  SerializableTab,
  TabEntityType,
  WorkspaceLayout,
  WorkspacePane,
  WorkspaceTab,
} from '../models/workspace.model';
import { GlobalParameterService } from './global-parameter.service';
import { ComponentRegistryService } from './component-registry.service';
import { flushPendingComponentSaves } from '../utils/pending-save-event';

const LAYOUT_KEY = 'CurrentUILayout';

const DEFAULT_SECTION = 'character';

/** Sections that open directly as view-tabs instead of showing a list in the sidebar. */
const VIEW_SECTIONS: Record<string, { title: string; icon: string }> = {
  relations: { title: 'Relações', icon: 'fa-solid fa-share-nodes' },
  'content-manager': { title: 'Gerenciador de Conteúdo', icon: 'fa-solid fa-box-open' },
};

function newPaneId() {
  return 'pane-' + crypto.randomUUID();
}
function newTabId() {
  return 'tab-' + crypto.randomUUID();
}

function emptyLayout(): WorkspaceLayout {
  const paneId = newPaneId();
  return {
    panes: [{ id: paneId, tabs: [], activeTabId: null }],
    splitRatios: [100],
    focusedPaneId: paneId,
    activeSidebarSection: DEFAULT_SECTION,
    sidebarVisible: true,
  };
}

@Injectable({ providedIn: 'root' })
export class TabManagerService {
  private readonly history = inject(EntityHistoryService);
  private readonly _layout$ = new BehaviorSubject<WorkspaceLayout>(emptyLayout());
  private transitionQueue: Promise<void> = Promise.resolve();
  readonly transitionError = signal(false);
  readonly layout$ = this._layout$.asObservable();

  constructor(
    private globalParamService: GlobalParameterService,
    private registry: ComponentRegistryService
  ) {
    this.restoreLayout();
    let historyTabKey = '';
    this.layout$.subscribe(layout => {
      const pane = layout.panes.find(item => item.id === layout.focusedPaneId);
      const tab = pane?.tabs.find(item => item.id === pane.activeTabId);
      const key = `${pane?.id}:${tab?.id}`;
      if (key === historyTabKey) return;
      historyTabKey = key;
      const aliases: Record<string, string> = { Specie: 'Species', CharacterSheet: 'IRPWCharacterSheet', Vocations: 'IRPWVocation' };
      this.history.activate(tab && tab.entityType !== 'view' ? { table: aliases[tab.entityType] ?? tab.entityType, id: tab.entityId } : null);
    });
  }

  get snapshot(): WorkspaceLayout {
    return this._layout$.getValue();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  /** Opens a sidebar section. If the section is a direct-view (relations, etc.) opens a tab instead. */
  setActiveSidebarSection(section: string): void {
    const viewMeta = VIEW_SECTIONS[section];
    if (viewMeta) {
      if (section === RELATIONS_VIEW_SECTION_ID) {
        this.openRelationsTab();
        return;
      }

      this.openTab('view', section, viewMeta.title, viewMeta.icon);
      return;
    }
    this.update(l => ({ ...l, activeSidebarSection: section, sidebarVisible: true }));
  }

  openRelationsTab(root?: RelationViewRoot & { label?: string }, targetPaneId?: string): void {
    const viewMeta = VIEW_SECTIONS[RELATIONS_VIEW_SECTION_ID];
    if (!viewMeta) return;

    const entityId = buildRelationsViewEntityId(root ? { table: root.table, id: root.id } : null);
    const title = root?.label?.trim()
      ? `${viewMeta.title}: ${root.label.trim()}`
      : viewMeta.title;

    this.openTab('view', entityId, title, viewMeta.icon, targetPaneId);
  }

  pinActiveRelationsTab(root: RelationViewRoot & { label?: string }): void {
    if (!root?.table || !root?.id) return;

    const viewMeta = VIEW_SECTIONS[RELATIONS_VIEW_SECTION_ID];
    if (!viewMeta) return;

    const layout = this.snapshot;
    const focusedPane = layout.panes.find((pane) => pane.id === layout.focusedPaneId);
    if (!focusedPane?.activeTabId) return;

    const activeTab = focusedPane.tabs.find((tab) => tab.id === focusedPane.activeTabId);
    if (!activeTab || activeTab.entityType !== 'view') return;

    const isRelationsTab = activeTab.entityId === RELATIONS_VIEW_SECTION_ID || !!parseRelationsViewEntityId(activeTab.entityId);
    if (!isRelationsTab) return;

    const nextEntityId = buildRelationsViewEntityId({ table: root.table, id: root.id });
    const nextTitle = root.label?.trim()
      ? `${viewMeta.title}: ${root.label.trim()}`
      : viewMeta.title;

    if (activeTab.entityId === nextEntityId && activeTab.title === nextTitle) {
      return;
    }

    this.update(l => ({
      ...l,
      panes: l.panes.map(p => ({
        ...p,
        tabs: p.tabs.map(t =>
          t.id === activeTab.id
            ? {
                ...t,
                entityId: nextEntityId,
                title: nextTitle,
              }
            : t
        ),
      })),
    }));
  }

  toggleSidebar(): void {
    this.update(l => ({ ...l, sidebarVisible: !l.sidebarVisible }));
  }

  setSidebarVisible(visible: boolean): void {
    if (this.snapshot.sidebarVisible === visible) return;
    this.update(l => ({ ...l, sidebarVisible: visible }));
  }

  // ── Tab management ──────────────────────────────────────────────────────────

  /**
   * Opens an entity (or view) tab.
   * If a tab with the same entityType + entityId already exists in any pane, focuses it.
   * Otherwise creates a new tab in targetPaneId (or focused pane).
   */

  substituteCurrentTab(
    entityType: TabEntityType,
    entityId: string,
    title: string,
    icon: string
  ): Promise<boolean> {
    const replacementTabId = newTabId();
    const transition = this.update(layout => {
      const existingPane = layout.panes.find(pane => pane.tabs.some(
        tab => tab.entityType === entityType && tab.entityId === entityId
      ));
      const existingTab = existingPane?.tabs.find(
        tab => tab.entityType === entityType && tab.entityId === entityId
      );
      if (existingPane && existingTab) {
        return {
          ...layout,
          focusedPaneId: existingPane.id,
          panes: layout.panes.map(pane => pane.id === existingPane.id
            ? { ...pane, activeTabId: existingTab.id }
            : pane),
        };
      }

      const pane = layout.panes.find(item => item.id === layout.focusedPaneId);
      if (!pane) return layout;
      const activeTab = pane.tabs.find(tab => tab.id === pane.activeTabId);
      if (!activeTab) {
        const tab: WorkspaceTab = {
          id: replacementTabId,
          title,
          icon,
          entityType,
          entityId,
          paneId: pane.id,
          isDirty: false,
        };
        return {
          ...layout,
          panes: layout.panes.map(item => item.id === pane.id
            ? { ...item, tabs: [...item.tabs, tab], activeTabId: tab.id }
            : item),
        };
      }

      const substitutedTab: WorkspaceTab = {
        ...activeTab,
        id: replacementTabId,
        title,
        icon,
        entityType,
        entityId,
        isDirty: false,
        resolvedComponent: undefined,
      };
      return {
        ...layout,
        focusedPaneId: pane.id,
        panes: layout.panes.map(item => item.id !== pane.id ? item : {
          ...item,
          tabs: item.tabs.map(tab => tab.id === activeTab.id ? substitutedTab : tab),
          activeTabId: replacementTabId,
        }),
      };
    }, true, true);

    return transition.then(async committed => {
      if (!committed || !this.snapshot.panes.some(pane => pane.tabs.some(tab => tab.id === replacementTabId))) return committed;
      await this.resolveTabComponent(replacementTabId, entityType, entityId);
      return committed;
    });
  }

  openTab(
    entityType: TabEntityType,
    entityId: string,
    title: string,
    icon: string,
    targetPaneId?: string
  ): Promise<boolean> {
    const tabId = newTabId();
    const transition = this.update(layout => {
      const existingPane = layout.panes.find(pane => pane.tabs.some(
        tab => tab.entityType === entityType && tab.entityId === entityId
      ));
      const existingTab = existingPane?.tabs.find(
        tab => tab.entityType === entityType && tab.entityId === entityId
      );
      if (existingPane && existingTab) {
        return {
          ...layout,
          focusedPaneId: existingPane.id,
          panes: layout.panes.map(pane => pane.id === existingPane.id
            ? { ...pane, activeTabId: existingTab.id }
            : pane),
        };
      }

      const requestedPaneId = targetPaneId ?? layout.focusedPaneId;
      const pane = layout.panes.find(item => item.id === requestedPaneId) ?? layout.panes[0];
      if (!pane) return layout;

      const tab: WorkspaceTab = {
        id: tabId,
        title,
        icon,
        entityType,
        entityId,
        paneId: pane.id,
        isDirty: false,
      };
      return {
        ...layout,
        focusedPaneId: pane.id,
        panes: layout.panes.map(item => item.id === pane.id
          ? { ...item, tabs: [...item.tabs, tab], activeTabId: tab.id }
          : item),
      };
    }, true, true);

    return transition.then(async committed => {
      if (!committed || !this.snapshot.panes.some(pane => pane.tabs.some(tab => tab.id === tabId))) return committed;
      await this.resolveTabComponent(tabId, entityType, entityId);
      return committed;
    });
  }

  private async resolveTabComponent(tabId: string, entityType: TabEntityType, entityId: string): Promise<void> {
    try {
      const component = await this.registry.getComponent(entityType, entityId);
      if (!component) return;
      await this.update(layout => ({
        ...layout,
        panes: layout.panes.map(pane => ({
          ...pane,
          tabs: pane.tabs.map(tab => tab.id === tabId ? { ...tab, resolvedComponent: component } : tab),
        })),
      }), false);
    } catch (error) {
      console.error('TabManagerService: failed to load tab component', error);
    }
  }
  closeTab(tabId: string, paneId: string): Promise<boolean> {
    return this.update(l => {
      const pane = l.panes.find(p => p.id === paneId);
      if (!pane) return l;

      const tabIndex = pane.tabs.findIndex(t => t.id === tabId);
      const newTabs = pane.tabs.filter(t => t.id !== tabId);

      let newActiveTabId: string | null = pane.activeTabId;
      if (pane.activeTabId === tabId) {
        // Focus the tab to the left, or right, or null
        newActiveTabId =
          newTabs[tabIndex - 1]?.id ?? newTabs[tabIndex]?.id ?? null;
      }

      const updatedPane: WorkspacePane = {
        ...pane,
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };

      // Remove pane if empty and there is more than one pane
      if (newTabs.length === 0 && l.panes.length > 1) {
        const remainingPanes = l.panes.filter(p => p.id !== paneId);
        const newRatios = redistributeRatios(remainingPanes.length);
        return {
          ...l,
          panes: remainingPanes,
          splitRatios: newRatios,
          focusedPaneId:
            l.focusedPaneId === paneId
              ? (remainingPanes[0]?.id ?? '')
              : l.focusedPaneId,
        };
      }

      return {
        ...l,
        panes: l.panes.map(p => (p.id === paneId ? updatedPane : p)),
      };
    }, true, true);
  }

  setActiveTab(paneId: string, tabId: string): Promise<boolean> {
    return this.update(l => ({
      ...l,
      focusedPaneId: paneId,
      panes: l.panes.map(p =>
        p.id === paneId ? { ...p, activeTabId: tabId } : p
      ),
    }), true, true);
  }

  setFocusedPane(paneId: string): void {
    this.update(l => ({ ...l, focusedPaneId: paneId }), true, true);
  }

  moveTab(tabId: string, fromPaneId: string, toPaneId: string, insertIndex?: number): Promise<boolean> {
    return this.update(l => {
      const fromPane = l.panes.find(p => p.id === fromPaneId);
      const toPane = l.panes.find(p => p.id === toPaneId);
      if (!fromPane || !toPane) return l;

      const tab = fromPane.tabs.find(t => t.id === tabId);
      if (!tab) return l;

      if (fromPaneId === toPaneId) {
        const currentIndex = fromPane.tabs.findIndex(t => t.id === tabId);
        const reorderedTabs = [...fromPane.tabs];
        const [movedTab] = reorderedTabs.splice(currentIndex, 1);
        const targetIndex = Math.max(0, Math.min(insertIndex ?? reorderedTabs.length, reorderedTabs.length));
        reorderedTabs.splice(targetIndex, 0, movedTab);
        return {
          ...l,
          panes: l.panes.map(p =>
            p.id === fromPaneId ? { ...p, tabs: reorderedTabs } : p
          ),
          focusedPaneId: fromPaneId,
        };
      }
      const movedTab: WorkspaceTab = { ...tab, paneId: toPaneId };
      const newFromTabs = fromPane.tabs.filter(t => t.id !== tabId);
      const newToTabs = [...toPane.tabs];
      const idx = insertIndex ?? newToTabs.length;
      newToTabs.splice(idx, 0, movedTab);

      const fromActiveId =
        fromPane.activeTabId === tabId
          ? (newFromTabs[newFromTabs.length - 1]?.id ?? null)
          : fromPane.activeTabId;

      const updatedPanes = l.panes.map(p => {
        if (p.id === fromPaneId) {
          return { ...p, tabs: newFromTabs, activeTabId: fromActiveId };
        }
        if (p.id === toPaneId) {
          return { ...p, tabs: newToTabs, activeTabId: movedTab.id };
        }
        return p;
      });

      // If fromPane is now empty and there are multiple panes, remove it
      const fromPaneUpdated = updatedPanes.find(p => p.id === fromPaneId)!;
      if (fromPaneUpdated.tabs.length === 0 && updatedPanes.length > 1) {
        const remaining = updatedPanes.filter(p => p.id !== fromPaneId);
        return {
          ...l,
          panes: remaining,
          splitRatios: redistributeRatios(remaining.length),
          focusedPaneId: toPaneId,
        };
      }

      return { ...l, panes: updatedPanes, focusedPaneId: toPaneId };
    }, true, true);
  }

  splitPane(sourcePaneId: string): Promise<boolean> {
    return this.update(l => {
      const newPaneId = 'pane-' + crypto.randomUUID();
      const newPane: WorkspacePane = { id: newPaneId, tabs: [], activeTabId: null };
      const paneIndex = l.panes.findIndex(p => p.id === sourcePaneId);
      const insertAt = paneIndex >= 0 ? paneIndex + 1 : l.panes.length;
      const newPanes = [...l.panes];
      newPanes.splice(insertAt, 0, newPane);
      return {
        ...l,
        panes: newPanes,
        splitRatios: redistributeRatios(newPanes.length),
        focusedPaneId: newPaneId,
      };
    }, true, true);
  }

  closePane(paneId: string): Promise<boolean> {
    return this.update(l => {
      if (l.panes.length <= 1) return l; // never remove last pane
      const pane = l.panes.find(p => p.id === paneId);
      if (!pane) return l;

      // Merge tabs to the nearest adjacent pane
      const paneIndex = l.panes.findIndex(p => p.id === paneId);
      const targetIndex = paneIndex > 0 ? paneIndex - 1 : 1;
      const targetPane = l.panes[targetIndex];

      const mergedTabs = [
        ...targetPane.tabs,
        ...pane.tabs.map(t => ({ ...t, paneId: targetPane.id })),
      ];
      const newActiveTabId =
        pane.tabs.length > 0
          ? (pane.activeTabId ?? pane.tabs[0].id)
          : targetPane.activeTabId;

      const updatedPanes = l.panes
        .filter(p => p.id !== paneId)
        .map(p =>
          p.id === targetPane.id
            ? { ...p, tabs: mergedTabs, activeTabId: newActiveTabId }
            : p
        );

      return {
        ...l,
        panes: updatedPanes,
        splitRatios: redistributeRatios(updatedPanes.length),
        focusedPaneId: targetPane.id,
      };
    }, true, true);
  }

  previewPaneRatios(ratios: number[]): void {
    this.update(l => ({ ...l, splitRatios: ratios }), false);
  }

  commitPaneRatios(ratios: number[]): void {
    this.update(l => ({ ...l, splitRatios: ratios }));
  }

  markDirty(tabId: string, isDirty: boolean): void {
    this.update(l => ({
      ...l,
      panes: l.panes.map(p => ({
        ...p,
        tabs: p.tabs.map(t => (t.id === tabId ? { ...t, isDirty } : t)),
      })),
    }));
  }

  updateTabTitle(tabId: string, title: string): void {
    this.update(l => ({
      ...l,
      panes: l.panes.map(p => ({
        ...p,
        tabs: p.tabs.map(t => (t.id === tabId ? { ...t, title } : t)),
      })),
    }));
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  saveLayout(): void {
    const l = this.snapshot;
    const serializable: SerializableLayout = {
      panes: l.panes.map(p => ({
        id: p.id,
        activeTabId: p.activeTabId,
        tabs: p.tabs.map(t => ({
          id: t.id,
          title: t.title,
          icon: t.icon,
          entityType: t.entityType,
          entityId: t.entityId,
          paneId: t.paneId,
          isDirty: t.isDirty,
        } satisfies SerializableTab)),
      })),
      splitRatios: l.splitRatios,
      focusedPaneId: l.focusedPaneId,
      activeSidebarSection: l.activeSidebarSection,
      sidebarVisible: l.sidebarVisible,
    };
    try {
      this.globalParamService.setParameter(LAYOUT_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.error('TabManagerService: failed to save layout', e);
    }
  }

  private async restoreLayout(): Promise<void> {
    try {
      const raw = this.globalParamService.getParameter(LAYOUT_KEY);
      if (!raw) return;

      const saved: SerializableLayout = JSON.parse(raw);
      if (!saved?.panes?.length) return;

      // Resolve components for all tabs
      const resolvedPanes = await Promise.all(
        saved.panes.map(async p => {
          const tabs = await Promise.all(
            p.tabs.map(async t => {
              const component = await this.registry.getComponent(t.entityType, t.entityId).catch(() => null);
              return { ...t, resolvedComponent: component ?? undefined } as WorkspaceTab;
            })
          );
          return { ...p, tabs } as WorkspacePane;
        })
      );

      const validFocusedPaneId =
        resolvedPanes.find(p => p.id === saved.focusedPaneId)?.id ??
        resolvedPanes[0]?.id ?? '';

      this._layout$.next({
        panes: resolvedPanes,
        splitRatios: saved.splitRatios,
        focusedPaneId: validFocusedPaneId,
        activeSidebarSection: saved.activeSidebarSection ?? DEFAULT_SECTION,
        sidebarVisible: saved.sidebarVisible ?? true,
      });
    } catch (e) {
      console.warn('TabManagerService: could not restore layout, using default', e);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private update(
    fn: (l: WorkspaceLayout) => WorkspaceLayout,
    persist = true,
    serializeTransition = false
  ): Promise<boolean> {
    const current = this.snapshot;
    const next = fn(current);
    const outgoingTabIds = this.getTransitionTabIds(current, next);
    if (outgoingTabIds.length === 0 && !serializeTransition) {
      this.commitLayout(next, persist);
      return Promise.resolve(true);
    }

    const operation = this.transitionQueue.then(async () => {
      this.transitionError.set(false);
      const before = this.snapshot;
      const intended = fn(before);
      const tabIds = this.getTransitionTabIds(before, intended);
      try {
        await Promise.all(tabIds.map(tabId => flushPendingComponentSaves(tabId)));
      } catch (error) {
        console.error('TabManagerService: could not flush pending tab saves', error);
        this.transitionError.set(true);
        return false;
      }

      // Reapply the mutation to include unrelated focus/title/dirty changes made during the flush.
      this.commitLayout(fn(this.snapshot), persist);
      return true;
    });
    this.transitionQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private getTransitionTabIds(current: WorkspaceLayout, next: WorkspaceLayout): string[] {
    const currentTabs = new Map(current.panes.flatMap(pane => pane.tabs).map(tab => [tab.id, tab]));
    const nextTabIds = new Set(next.panes.flatMap(pane => pane.tabs).map(tab => tab.id));
    const outgoing = new Set<string>();

    // Closing/replacing any tab must settle that tab before its runtime view is destroyed.
    for (const tabId of currentTabs.keys()) {
      if (!nextTabIds.has(tabId)) outgoing.add(tabId);
    }

    // A pane's previous active view must save before another view is attached there.
    for (const pane of current.panes) {
      const nextPane = next.panes.find(item => item.id === pane.id);
      if (pane.activeTabId && pane.activeTabId !== nextPane?.activeTabId) {
        outgoing.add(pane.activeTabId);
      }
    }

    return [...outgoing];
  }

  private commitLayout(next: WorkspaceLayout, persist: boolean): void {
    this._layout$.next(next);
    if (persist) {
      this.saveLayout();
    }
  }
}

function redistributeRatios(count: number): number[] {
  if (count === 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? base + remainder : base
  );
}
