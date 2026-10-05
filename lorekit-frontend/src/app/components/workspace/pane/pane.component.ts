import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { WorkspacePane, WorkspaceTab } from '../../../models/workspace.model';
import { WorkspaceTabBarComponent } from '../tab-bar/tab-bar.component';
import { TabManagerService } from '../../../services/tab-manager.service';
import { ComponentRegistryService } from '../../../services/component-registry.service';
import { EntityHistoryService } from '../../../services/entity-history.service';
import { WorkspaceTabViewHostService } from '../../../services/workspace-tab-view-host.service';

@Component({
  selector: 'app-workspace-pane',
  standalone: true,
  imports: [WorkspaceTabBarComponent],
  styleUrl: './pane.component.css',
  host: {
    'class': 'flex flex-col min-h-0 min-w-0 md:min-w-[200px] overflow-hidden',
    '[style.flex-basis.%]': 'flexRatio()',

    '(mousedown)': 'focusPane($event)',
    '(focusin)': 'focusPane($event)',
  },
  templateUrl: './pane.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspacePaneComponent implements AfterViewInit, OnChanges, OnDestroy {
  pane = input.required<WorkspacePane>();
  flexRatio = input<number>(100);
  focused = input(false);

  tabManager = inject(TabManagerService);
  private readonly tabViewHost = inject(WorkspaceTabViewHostService);
  private registry = inject(ComponentRegistryService);
  private readonly history = inject(EntityHistoryService);
  private viewOutlet?: ViewContainerRef;
  private readonly refreshViewsEffect = effect(() => {
    this.tabViewHost.generation();
    if (this.viewOutlet) this.syncActiveView();
  });

  @ViewChild('tabViewOutlet', { read: ViewContainerRef })
  set tabViewOutlet(outlet: ViewContainerRef | undefined) {
    this.viewOutlet = outlet;
    this.syncActiveView();
  }

  ngAfterViewInit(): void {
    if (this.viewOutlet) this.tabViewHost.registerOutlet(this.pane().id, this.viewOutlet);
    this.syncActiveView();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.syncActiveView();
  }

  ngOnDestroy(): void {
    if (this.viewOutlet) {
      this.tabViewHost.detachContainer(this.viewOutlet);
      this.tabViewHost.unregisterOutlet(this.pane().id, this.viewOutlet);
    }
  }

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

  getTabInputs(tab: { entityType: any; entityId: string; id: string }): Record<string, unknown> {
    return this.registry.getTabInputs(tab.entityType, tab.entityId);
  }

  getActiveTab(): WorkspaceTab | undefined {
    const pane = this.pane();
    return pane.tabs.find(tab => tab.id === pane.activeTabId);
  }

  private syncActiveView(): void {
    const outlet = this.viewOutlet;
    if (!outlet) return;
    this.tabViewHost.activate(this.getActiveTab(), outlet, this.focused(), this.getActiveTab() ? this.getTabInputs(this.getActiveTab()!) : {});
  }
}
