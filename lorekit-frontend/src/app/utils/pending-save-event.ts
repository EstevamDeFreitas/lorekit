export const FLUSH_PENDING_SAVES_EVENT = 'lorekit:flush-pending-saves';
export const DISCARD_PENDING_SAVES_EVENT = 'lorekit:discard-pending-saves';

export type PendingSaveEventDetail = {
  flushes: Promise<unknown>[];
};

export async function flushPendingComponentSaves(): Promise<void> {
  for (let round = 0; round < 2; round++) {
    const event = new CustomEvent<PendingSaveEventDetail>(FLUSH_PENDING_SAVES_EVENT, {
      detail: { flushes: [] },
    });
    window.dispatchEvent(event);

    await Promise.all(event.detail.flushes);
    if (event.detail.flushes.length === 0) return;
  }
}
