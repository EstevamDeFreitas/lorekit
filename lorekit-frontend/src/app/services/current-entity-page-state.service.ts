import { Injectable } from '@angular/core';

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
