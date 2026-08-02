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

@Component({
  selector: 'app-workspace-pane',
  standalone: true,
  imports: [NgComponentOutlet, WorkspaceTabBarComponent],
  host: {
    'class': 'flex flex-col min-h-0 min-w-0 md:min-w-[200px] overflow-hidden',
    '[style.flex-basis.%]': 'flexRatio()',

    '(mousedown)': 'tabManager.setFocusedPane(pane().id)',
  },
  template: `
      <!-- Tab bar -->
      <app-workspace-tab-bar [pane]="pane()" />

      <!-- Content area -->
      <div class="flex-1 overflow-hidden relative">
        @if (pane().tabs.length === 0) {
          <!-- Empty pane placeholder -->
          <div class="h-full flex flex-col items-center justify-center text-zinc-600 gap-3 select-none">
            <i class="fa-solid fa-table-columns text-3xl"></i>
            <p class="text-sm">Painel vazio</p>
            <p class="text-xs">Abra uma entidade pelo painel lateral</p>
            @if (tabManager.snapshot.panes.length > 1) {
              <button
                type="button"
                class="mt-1 inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                (click)="tabManager.closePane(pane().id)">
                <i class="fa-solid fa-xmark"></i>
                Fechar painel
              </button>
            }
          </div>
        } @else {
          @for (tab of pane().tabs; track tab.id) {
            @if (tab.id === pane().activeTabId) {
              <div class="absolute inset-0 overflow-y-auto overflow-x-hidden scrollbar-dark px-3">
                @if (tab.resolvedComponent) {
                  @if (componentRefresh.usePrimaryOutlet()) {
                    <ng-container
                      *ngComponentOutlet="tab.resolvedComponent; inputs: getTabInputs(tab)">
                    </ng-container>
                  } @else {
                    <ng-container
                      *ngComponentOutlet="tab.resolvedComponent; inputs: getTabInputs(tab)">
                    </ng-container>
                  }
                } @else {
                  <!-- Loading -->
                  <div class="h-full flex items-center justify-center text-zinc-500 text-sm">
                    <i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Carregando...
                  </div>
                }
              </div>
            }
          }
        }
      </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspacePaneComponent {
  pane = input.required<WorkspacePane>();
  flexRatio = input<number>(100);

  tabManager = inject(TabManagerService);
  readonly componentRefresh = inject(ComponentRefreshService);
  private registry = inject(ComponentRegistryService);


  getTabInputs(tab: { entityType: any; entityId: string; id: string }): Record<string, string> {
    return this.registry.getTabInputs(tab.entityType, tab.entityId);
  }
}
