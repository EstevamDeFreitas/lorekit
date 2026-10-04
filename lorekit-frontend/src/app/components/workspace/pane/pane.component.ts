import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { WorkspacePane } from '../../../models/workspace.model';
import { WorkspaceTabBarComponent } from '../tab-bar/tab-bar.component';
import { TabManagerService } from '../../../services/tab-manager.service';
import { ComponentRegistryService } from '../../../services/component-registry.service';
import { ComponentRefreshService } from '../../../services/component-refresh.service';
import { EntityHistoryService } from '../../../services/entity-history.service';

@Component({
  selector: 'app-workspace-pane',
  standalone: true,
  imports: [NgComponentOutlet, WorkspaceTabBarComponent],
  host: {
    'class': 'flex flex-col min-h-0 min-w-0 md:min-w-[200px] overflow-hidden',
    '[style.flex-basis.%]': 'flexRatio()',

    '(mousedown)': 'focusPane($event)',
    '(focusin)': 'focusPane($event)',
  },
  templateUrl: './pane.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspacePaneComponent {
  pane = input.required<WorkspacePane>();
  flexRatio = input<number>(100);

  tabManager = inject(TabManagerService);
  readonly componentRefresh = inject(ComponentRefreshService);
  private registry = inject(ComponentRegistryService);
  private readonly history = inject(EntityHistoryService);

  focusPane(event: Event): void {
    this.tabManager.setFocusedPane(this.pane().id);
    const context = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-history-entity]') : null;
    const table = context?.dataset['historyTable'];
    const id = context?.dataset['historyEntity'];
    if (table && id) this.history.activate({ table, id });
  }

  private readonly fullBleedEntityTypes = new Set([
    'Character', 'Document', 'World', 'Location', 'Specie', 'Culture', 'Organization', 'Object',
  ]);

  usesFullBleedEditor(entityType: string): boolean {
    return this.fullBleedEntityTypes.has(entityType);
  }

  getTabInputs(tab: { entityType: any; entityId: string; id: string }): Record<string, string> {
    return this.registry.getTabInputs(tab.entityType, tab.entityId);
  }
}
