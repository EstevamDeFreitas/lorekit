import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkspaceLockService {
  private releaseCurrentLock: (() => void) | null = null;
  private channel: BroadcastChannel | null = null;

  async acquire(workspaceKey: string): Promise<boolean> {
    this.release();
    this.channel = typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel(`lorekit-workspace:${workspaceKey}`);

    if (!navigator.locks) {
      // Navegadores modernos usados pelo Lorekit implementam Web Locks. O
      // BroadcastChannel continua ativo para comunicar mudança de proprietário.
      this.channel?.postMessage({ type: 'workspace-opened' });
      return true;
    }

    let resolveAcquired!: (acquired: boolean) => void;
    const acquired = new Promise<boolean>(resolve => {
      resolveAcquired = resolve;
    });
    let release!: () => void;
    const hold = new Promise<void>(resolve => {
      release = resolve;
    });

    void navigator.locks.request(
      `lorekit-workspace:${workspaceKey}`,
      { mode: 'exclusive', ifAvailable: true },
      async lock => {
        resolveAcquired(Boolean(lock));
        if (!lock) return;
        this.releaseCurrentLock = release;
        this.channel?.postMessage({ type: 'workspace-writer-opened' });
        await hold;
      },
    ).catch(() => resolveAcquired(false));

    return await acquired;
  }

  release(): void {
    this.releaseCurrentLock?.();
    this.releaseCurrentLock = null;
    this.channel?.postMessage({ type: 'workspace-writer-closed' });
    this.channel?.close();
    this.channel = null;
  }
}
