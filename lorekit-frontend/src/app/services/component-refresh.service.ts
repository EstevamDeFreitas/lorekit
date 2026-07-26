import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ComponentRefreshService {
  private readonly refreshRevision = signal(0);

  readonly usePrimaryOutlet = computed(() => this.refreshRevision() % 2 === 0);

  refresh(): void {
    this.refreshRevision.update(revision => revision + 1);
  }
}
