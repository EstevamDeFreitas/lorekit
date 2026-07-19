import { DestroyRef } from '@angular/core';

export class FlushableDebounce {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingTask: (() => void) | null = null;

  constructor(
    destroyRef: DestroyRef,
    private readonly delayMs: number
  ) {
    destroyRef.onDestroy(() => this.flush());
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