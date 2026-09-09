import { Injectable } from '@angular/core';
import { UiConfigPayload } from '../models/ui-field-config.model';

export function layoutTabStateId(tabId: string): string {
  return `layout:${tabId}`;
}

export function resolveEntityTab(currentTab: string, layout: UiConfigPayload, fixedTabs: string[]): string {
  if (fixedTabs.includes(currentTab)) return currentTab;
  const layoutIds = new Set(layout.tabs.map(tab => layoutTabStateId(tab.id)));
  return layoutIds.has(currentTab) ? currentTab : layoutTabStateId(layout.tabs[0].id);
}

export function activeLayoutTabId(currentTab: string, layout: UiConfigPayload): string {
  const match = layout.tabs.find(tab => layoutTabStateId(tab.id) === currentTab);
  return match?.id ?? layout.tabs[0].id;
}

@Injectable({ providedIn: 'root' })
export class CurrentEntityPageStateService {
  private readonly currentTabs = new Map<string, string>();

  getCurrentTab(pageKey: string, entityId: string, fallbackTab: string): string {
    const key = this.buildKey(pageKey, entityId);
    return key ? (this.currentTabs.get(key) ?? fallbackTab) : fallbackTab;
  }

  setCurrentTab(pageKey: string, entityId: string, tab: string): void {
    const key = this.buildKey(pageKey, entityId);
    const normalizedTab = tab.trim();
    if (!key || !normalizedTab) {
      return;
    }

    this.currentTabs.set(key, normalizedTab);
  }

  private buildKey(pageKey: string, entityId: string): string | null {
    const normalizedPageKey = pageKey.trim();
    const normalizedEntityId = entityId.trim();
    return normalizedPageKey && normalizedEntityId
      ? `${normalizedPageKey}:${normalizedEntityId}`
      : null;
  }
}
