import { DestroyRef, inject } from '@angular/core';
import {
  DISCARD_PENDING_SAVES_EVENT,
  FLUSH_PENDING_SAVES_EVENT,
  PendingSaveEventDetail,
  pendingSaveEventMatchesTab,
} from './pending-save-event';
import { WORKSPACE_TAB_CONTEXT, WorkspaceTabContext } from '../models/workspace-tab-context';

function currentTabContext(): WorkspaceTabContext | null {
  try {
    return inject(WORKSPACE_TAB_CONTEXT, { optional: true });
  } catch {
    // The helper is also constructed directly in unit tests and non-Angular utilities.
    return null;
  }
}

export class FlushableDebounce {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingTask: (() => void) | null = null;
  private readonly onFlushPendingSaves = (event: Event): void => {
    const detail = (event as CustomEvent<PendingSaveEventDetail>).detail;
    if (!pendingSaveEventMatchesTab(detail, this.tabContext?.tabId)) return;
    if (!this.pendingTask) return;
    if (!detail) {
      this.flush();
      return;
    }
    detail.flushes.push(Promise.resolve().then(() => this.flush()));
  };
  private readonly onDiscardPendingSaves = (event: Event): void => {
    const detail = (event as CustomEvent<PendingSaveEventDetail>).detail;
    if (pendingSaveEventMatchesTab(detail, this.tabContext?.tabId)) this.discard();
  };
  private readonly unregisterActivation?: () => void;

  constructor(
    destroyRef: DestroyRef,
    private readonly delayMs: number,
    private readonly tabContext: WorkspaceTabContext | null = currentTabContext()
  ) {
    window.addEventListener(FLUSH_PENDING_SAVES_EVENT, this.onFlushPendingSaves);
    window.addEventListener(DISCARD_PENDING_SAVES_EVENT, this.onDiscardPendingSaves);
    this.unregisterActivation = this.tabContext?.onActiveChange(active => {
      if (active) {
        if (this.pendingTask && !this.timer) {
          this.timer = setTimeout(() => this.runPendingTask(), this.delayMs);
        }
      } else {
        this.clearTimer();
      }
    });
    destroyRef.onDestroy(() => {
      window.removeEventListener(FLUSH_PENDING_SAVES_EVENT, this.onFlushPendingSaves);
      window.removeEventListener(DISCARD_PENDING_SAVES_EVENT, this.onDiscardPendingSaves);
      this.unregisterActivation?.();
      this.flush();
    });
  }

  schedule(task: () => void): void {
    this.clearTimer();
    this.pendingTask = task;
    if (!this.tabContext || this.tabContext.active()) {
      this.timer = setTimeout(() => this.runPendingTask(), this.delayMs);
    }
  }

  flush(): void {
    if (!this.pendingTask) {
      this.clearTimer();
      return;
    }

    this.clearTimer();
    this.runPendingTask();
  }

  discard(): void {
    this.clearTimer();
    this.pendingTask = null;
  }

  private runPendingTask(): void {
    const task = this.pendingTask;
    this.pendingTask = null;
    this.timer = null;
    task?.();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
