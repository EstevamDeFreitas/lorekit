import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SerializableLayout,
  SerializableTab,
  TabEntityType,
  WorkspaceLayout,
  WorkspacePane,
  WorkspaceTab,
} from '../models/workspace.model';
import { GlobalParameterService } from './global-parameter.service';
import { ComponentRegistryService } from './component-registry.service';

const LAYOUT_KEY = 'CurrentUILayout';

const DEFAULT_SECTION = 'character';

/** Sections that open directly as view-tabs instead of showing a list in the sidebar. */
const VIEW_SECTIONS: Record<string, { title: string; icon: string }> = {
  relations: { title: 'Relações', icon: 'fa-solid fa-share-nodes' },
  'character-sheet': { title: 'Fichas de Personagem', icon: 'fa-solid fa-address-card' },
  vocations: { title: 'Vocações', icon: 'fa-solid fa-hat-wizard' },
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
  private readonly _layout$ = new BehaviorSubject<WorkspaceLayout>(emptyLayout());
  readonly layout$ = this._layout$.asObservable();

  constructor(
    private globalParamService: GlobalParameterService,
    private registry: ComponentRegistryService
  ) {
    this.restoreLayout();
  }

  get snapshot(): WorkspaceLayout {
    return this._layout$.getValue();
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  /** Opens a sidebar section. If the section is a direct-view (relations, etc.) opens a tab instead. */
  setActiveSidebarSection(section: string): void {
    const viewMeta = VIEW_SECTIONS[section];
    if (viewMeta) {
      this.openTab('view', section, viewMeta.title, viewMeta.icon);
      return;
    }
    this.update(l => ({ ...l, activeSidebarSection: section, sidebarVisible: true }));
  }

  toggleSidebar(): void {
    this.update(l => ({ ...l, sidebarVisible: !l.sidebarVisible }));
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
  ): void {
    const layout = this.snapshot;
    const paneId = layout.focusedPaneId;
    const pane = layout.panes.find(p => p.id === paneId);
    if (!pane) return;

    // If already opened anywhere, just focus/activate it. Do not replace current tab.
    for (const p of layout.panes) {
      const existing = p.tabs.find(
        t => t.entityType === entityType && t.entityId === entityId
      );
      if (existing) {
        this.update(l => ({
          ...l,
          focusedPaneId: p.id,
          panes: l.panes.map(lp =>
            lp.id === p.id ? { ...lp, activeTabId: existing.id } : lp
          ),
        }));
        return;
      }
    }

    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId);
    if (!activeTab) {
      this.openTab(entityType, entityId, title, icon, paneId);
      return;
    }

    // New id forces @for(track tab.id) to unmount old outlet and mount a fresh component tree.
    const replacementTabId = newTabId();

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

    // First pass: replace tab metadata and clear component reference to force teardown.
    this.update(l => ({
      ...l,
      focusedPaneId: paneId,
      panes: l.panes.map(p => {
        if (p.id !== paneId) return p;
        return {
          ...p,
          tabs: p.tabs.map(t => (t.id === activeTab.id ? substitutedTab : t)),
          activeTabId: replacementTabId,
        };
      }),
    }));

    // Second pass: load and attach component again, forcing a fresh instance.
    this.registry.getComponent(entityType, entityId).then(component => {
      if (!component) return;
      this.update(l => ({
        ...l,
        panes: l.panes.map(p => ({
          ...p,
          tabs: p.tabs.map(t =>
            t.id === replacementTabId &&
            t.entityType === entityType &&
            t.entityId === entityId
              ? { ...t, resolvedComponent: component }
              : t
          ),
        })),
      }));
    });
  }

  openTab(
    entityType: TabEntityType,
    entityId: string,
    title: string,
    icon: string,
    targetPaneId?: string
  ): void {
    const layout = this.snapshot;

    // Check if tab already exists in any pane
    for (const pane of layout.panes) {
      const existing = pane.tabs.find(
        t => t.entityType === entityType && t.entityId === entityId
      );
      if (existing) {
        this.update(l => ({
          ...l,
          focusedPaneId: pane.id,
          panes: l.panes.map(p =>
            p.id === pane.id ? { ...p, activeTabId: existing.id } : p
          ),
        }));
        return;
      }
    }

    // Determine target pane — guard against stale focusedPaneId after drag-drop removes a pane
    const paneId = targetPaneId ?? layout.focusedPaneId;
    const effectivePaneId = layout.panes.find(p => p.id === paneId)?.id ?? layout.panes[0]?.id;
    if (!effectivePaneId) return;

    const tab: WorkspaceTab = {
      id: newTabId(),
      title,
      icon,
      entityType,
      entityId,
      paneId: effectivePaneId,
      isDirty: false,
    };

    // Async-load the component; update tab once resolved
    this.registry.getComponent(entityType, entityId).then(component => {
      if (!component) return;
      this.update(l => ({
        ...l,
        panes: l.panes.map(p => ({
          ...p,
          tabs: p.tabs.map(t =>
            t.id === tab.id ? { ...t, resolvedComponent: component } : t
          ),
        })),
      }));
    });

    this.update(l => ({
      ...l,
      focusedPaneId: effectivePaneId,
      panes: l.panes.map(p =>
        p.id === effectivePaneId
          ? { ...p, tabs: [...p.tabs, tab], activeTabId: tab.id }
          : p
      ),
    }));
  }

  closeTab(tabId: string, paneId: string): void {
    this.update(l => {
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
    });
  }

  setActiveTab(paneId: string, tabId: string): void {
    this.update(l => ({
      ...l,
      focusedPaneId: paneId,
      panes: l.panes.map(p =>
        p.id === paneId ? { ...p, activeTabId: tabId } : p
      ),
    }));
  }

  setFocusedPane(paneId: string): void {
    this.update(l => ({ ...l, focusedPaneId: paneId }));
  }

  moveTab(tabId: string, fromPaneId: string, toPaneId: string, insertIndex?: number): void {
    this.update(l => {
      const fromPane = l.panes.find(p => p.id === fromPaneId);
      const toPane = l.panes.find(p => p.id === toPaneId);
      if (!fromPane || !toPane) return l;

      const tab = fromPane.tabs.find(t => t.id === tabId);
      if (!tab) return l;

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
    });
  }

  splitPane(sourcePaneId: string): void {
    this.update(l => {
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
    });
  }

  closePane(paneId: string): void {
    this.update(l => {
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
    });
  }

  setPaneRatios(ratios: number[]): void {
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

  private update(fn: (l: WorkspaceLayout) => WorkspaceLayout): void {
    const next = fn(this.snapshot);
    this._layout$.next(next);
    this.saveLayout();
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
