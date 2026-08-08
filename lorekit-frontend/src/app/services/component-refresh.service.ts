import { computed, Injectable, signal } from '@angular/core';
import { DISCARD_PENDING_SAVES_EVENT } from '../utils/pending-save-event';

@Injectable({ providedIn: 'root' })
export class ComponentRefreshService {
  private readonly refreshRevision = signal(0);

  readonly usePrimaryOutlet = computed(() => this.refreshRevision() % 2 === 0);

  refresh(): void {
    this.refreshRevision.update(revision => revision + 1);
  }

  refreshFromRemote(): void {
    window.dispatchEvent(new Event(DISCARD_PENDING_SAVES_EVENT));
    this.refresh();
  }
}
