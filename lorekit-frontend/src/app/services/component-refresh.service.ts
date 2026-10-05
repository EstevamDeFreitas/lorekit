import { computed, Injectable, signal } from '@angular/core';
import { DISCARD_PENDING_SAVES_EVENT } from '../utils/pending-save-event';
import { WorkspaceTabViewHostService } from './workspace-tab-view-host.service';

@Injectable({ providedIn: 'root' })
export class ComponentRefreshService {
  private readonly refreshRevision = signal(0);

  constructor(private readonly tabViewHost: WorkspaceTabViewHostService) {}

  readonly usePrimaryOutlet = computed(() => this.refreshRevision() % 2 === 0);

  refresh(): void {
    this.tabViewHost.invalidateAll();
    this.refreshRevision.update(revision => revision + 1);
  }

  refreshFromRemote(): void {
    window.dispatchEvent(new Event('lorekit:history-external-change'));
    window.dispatchEvent(new Event(DISCARD_PENDING_SAVES_EVENT));
    this.refresh();
  }
}
