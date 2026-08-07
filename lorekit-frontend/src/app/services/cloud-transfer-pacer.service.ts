import { Injectable } from '@angular/core';

export const CLOUD_BLOB_REQUEST_SPACING_MS = 1_500;

@Injectable({ providedIn: 'root' })
export class CloudTransferPacerService {
  private queue: Promise<void> = Promise.resolve();
  private nextAllowedAt = 0;

  waitForTurn(): Promise<void> {
    const turn = this.queue.then(async () => {
      const waitMs = Math.max(0, this.nextAllowedAt - Date.now());
      if (waitMs > 0) {
        await new Promise<void>(resolve => window.setTimeout(resolve, waitMs));
      }
      this.nextAllowedAt = Date.now() + CLOUD_BLOB_REQUEST_SPACING_MS;
    });
    this.queue = turn.catch(() => undefined);
    return turn;
  }
}
