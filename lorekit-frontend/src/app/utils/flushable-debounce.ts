import { DestroyRef } from '@angular/core';
import {
  DISCARD_PENDING_SAVES_EVENT,
  FLUSH_PENDING_SAVES_EVENT,
} from './pending-save-event';

export class FlushableDebounce {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingTask: (() => void) | null = null;
  private readonly onFlushPendingSaves = (): void => this.flush();
  private readonly onDiscardPendingSaves = (): void => this.discard();

  constructor(
    destroyRef: DestroyRef,
    private readonly delayMs: number
  ) {
    window.addEventListener(FLUSH_PENDING_SAVES_EVENT, this.onFlushPendingSaves);
    window.addEventListener(DISCARD_PENDING_SAVES_EVENT, this.onDiscardPendingSaves);
    destroyRef.onDestroy(() => {
      window.removeEventListener(FLUSH_PENDING_SAVES_EVENT, this.onFlushPendingSaves);
      window.removeEventListener(DISCARD_PENDING_SAVES_EVENT, this.onDiscardPendingSaves);
      this.flush();
    });
  }

  schedule(task: () => void): void {
    this.clearTimer();
    this.pendingTask = task;
    this.timer = setTimeout(() => this.runPendingTask(), this.delayMs);
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