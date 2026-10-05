import { InjectionToken, signal } from '@angular/core';

/** Runtime-only context inherited by a tab page and all of its child editors. */
export class WorkspaceTabContext {
  readonly active = signal(false);
  readonly focused = signal(false);

  private readonly activationListeners = new Set<(active: boolean) => void>();

  constructor(readonly tabId: string) {}

  onActiveChange(listener: (active: boolean) => void): () => void {
    this.activationListeners.add(listener);
    if (this.active()) listener(true);
    return () => this.activationListeners.delete(listener);
  }

  setActive(active: boolean): void {
    if (this.active() === active) return;
    this.active.set(active);
    this.activationListeners.forEach(listener => listener(active));
  }

  setFocused(focused: boolean): void {
    this.focused.set(focused);
  }

  release(): void {
    this.setActive(false);
    this.setFocused(false);
    this.activationListeners.clear();
  }
}

export const WORKSPACE_TAB_CONTEXT = new InjectionToken<WorkspaceTabContext>(
  'WORKSPACE_TAB_CONTEXT'
);
