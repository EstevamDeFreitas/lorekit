export const FLUSH_PENDING_SAVES_EVENT = 'lorekit:flush-pending-saves';
export const DISCARD_PENDING_SAVES_EVENT = 'lorekit:discard-pending-saves';

export type PendingSaveEventDetail = {
  flushes: Promise<unknown>[];
  /** Omitted for existing workspace-wide flushes. */
  tabId?: string;
};

let flushQueue: Promise<void> = Promise.resolve();

export function pendingSaveEventMatchesTab(
  detail: PendingSaveEventDetail | undefined,
  tabId: string | null | undefined
): boolean {
  return !detail?.tabId || detail.tabId === tabId;
}

export function flushPendingComponentSaves(tabId?: string): Promise<void> {
  const operation = flushQueue.then(() => flushPendingComponentSavesNow(tabId));
  flushQueue = operation.catch(() => undefined);
  return operation;
}

async function flushPendingComponentSavesNow(tabId?: string): Promise<void> {
  for (let round = 0; round < 2; round++) {
    const event = new CustomEvent<PendingSaveEventDetail>(FLUSH_PENDING_SAVES_EVENT, {
      detail: { flushes: [], tabId },
    });
    window.dispatchEvent(event);

    await Promise.all(event.detail.flushes);
    if (event.detail.flushes.length === 0) return;
  }
}
