export const FLUSH_PENDING_SAVES_EVENT = 'lorekit:flush-pending-saves';

export type PendingSaveEventDetail = {
  flushes: Promise<unknown>[];
};
