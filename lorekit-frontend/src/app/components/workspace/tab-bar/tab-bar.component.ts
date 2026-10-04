import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnChanges,
  inject,
  input,
  OnInit,
  SimpleChanges,
  signal,
  ViewChild,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDragPlaceholder,
} from '@angular/cdk/drag-drop';
import { WorkspacePane, WorkspaceTab } from '../../../models/workspace.model';
import { TabManagerService } from '../../../services/tab-manager.service';
import { getEntityStyle } from '../../../models/entity-colors';

@Component({
  selector: 'app-workspace-tab-bar',
  host: {
    '(window:resize)': 'syncMobileViewport()',
  },
  standalone: true,
  imports: [CdkDrag, CdkDropList, CdkDragPlaceholder],
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceTabBarComponent implements AfterViewInit, OnChanges, OnDestroy, OnInit {
  pane = input.required<WorkspacePane>();

  tabManager = inject(TabManagerService);

  contextMenu = signal<{ x: number; y: number; tab: WorkspaceTab } | null>(null);
  readonly isMobileViewport = signal(false);

  @ViewChild('tabScroll') private tabScroll?: ElementRef<HTMLElement>;
  private paneResizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.syncMobileViewport();
  }

  ngAfterViewInit(): void {
    const paneElement = this.getPaneElement();
    if (paneElement && typeof ResizeObserver !== 'undefined') {
      this.paneResizeObserver = new ResizeObserver(() => this.updatePaneGlow());
      this.paneResizeObserver.observe(paneElement);
    }
    this.scheduleActiveTabReveal();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.scheduleActiveTabReveal();
  }

  ngOnDestroy(): void {
    this.paneResizeObserver?.disconnect();
  }

  syncMobileViewport(): void {
    this.isMobileViewport.set(window.matchMedia('(max-width: 767px)').matches);
    this.scheduleActiveTabReveal();
  }

  updatePaneGlow(): void {
    const strip = this.tabScroll?.nativeElement;
    const paneElement = this.getPaneElement();
    const activeTab = strip?.querySelector<HTMLElement>('.workspace-tab--active');
    const activeTabModel = this.pane().tabs.find(tab => tab.id === this.pane().activeTabId);

    if (!strip || !paneElement || !activeTab || !activeTabModel) {
      this.clearPaneGlow();
      return;
    }

    const paneBounds = paneElement.getBoundingClientRect();
    if (paneBounds.width <= 0) return;

    const tabBounds = activeTab.getBoundingClientRect();
    const centerX = Math.min(
      paneBounds.width,
      Math.max(0, tabBounds.left + tabBounds.width / 2 - paneBounds.left)
    );
    const position = `${(centerX / paneBounds.width) * 100}%`;
    const color = this.getTabAccentColor(activeTabModel) ?? 'var(--color-yellow-300)';

    paneElement.style.setProperty('--workspace-pane-glow-position', position);
    paneElement.style.setProperty('--workspace-pane-glow-color', color);
  }

  isActiveTab(tab: WorkspaceTab): boolean {
    return tab.id === this.pane().activeTabId;
  }

  getTabAccentColor(tab: WorkspaceTab): string | null {
    if (tab.id !== this.pane().activeTabId) {
      return null;
    }

    const entityTable = tab.entityType === 'Specie'
      ? 'Species'
      : tab.entityType === 'view' && tab.entityId.startsWith('relations')
        ? 'Relationship'
        : tab.entityType;
    const entityStyle = getEntityStyle(entityTable);

    return entityStyle ? 'var(--color-' + entityStyle.color + ')' : null;
  }

  closeTab(event: MouseEvent, tabId: string): void {
    event.stopPropagation();
    this.tabManager.closeTab(tabId, this.pane().id);
  }

  onDrop(event: CdkDragDrop<{ paneId: string }>): void {
    const { tabId, paneId: fromPaneId } = event.item.data as {
      tabId: string;
      paneId: string;
    };
    const toPaneId = event.container.data.paneId;
    this.tabManager.moveTab(tabId, fromPaneId, toPaneId, event.currentIndex);
  }

  openContextMenu(event: MouseEvent, tab: WorkspaceTab): void {
    event.preventDefault();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, tab });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  ctxClose(): void {
    const ctx = this.contextMenu();
    if (ctx) this.tabManager.closeTab(ctx.tab.id, this.pane().id);
    this.closeContextMenu();
  }

  ctxCloseOthers(): void {
    const ctx = this.contextMenu();
    if (!ctx) return;
    this.pane().tabs
      .filter(t => t.id !== ctx.tab.id)
      .forEach(t => this.tabManager.closeTab(t.id, this.pane().id));
    this.closeContextMenu();
  }

  ctxMoveToNewPane(): void {
    const ctx = this.contextMenu();
    if (!ctx) return;
    this.tabManager.splitPane(this.pane().id);
    // After split, move tab to the new pane (last pane)
    const newLayout = this.tabManager.snapshot;
    const newPane = newLayout.panes[newLayout.panes.length - 1];
    if (newPane) {
      this.tabManager.moveTab(ctx.tab.id, this.pane().id, newPane.id);
    }
    this.closeContextMenu();
  }

  ctxClosePane(): void {
    this.tabManager.closePane(this.pane().id);
    this.closeContextMenu();
  }

  canClosePane(): boolean {
    return this.tabManager.snapshot.panes.length > 1;
  }

  private scheduleActiveTabReveal(): void {
    requestAnimationFrame(() => {
      const strip = this.tabScroll?.nativeElement;
      const activeTab = strip?.querySelector<HTMLElement>('.workspace-tab--active');
      if (!strip || !activeTab) {
        this.clearPaneGlow();
        return;
      }

      const stripBounds = strip.getBoundingClientRect();
      const tabBounds = activeTab.getBoundingClientRect();
      const edgeSpacing = 8;
      let scrollDelta = 0;

      if (tabBounds.left < stripBounds.left + edgeSpacing) {
        scrollDelta = tabBounds.left - stripBounds.left - edgeSpacing;
      } else if (tabBounds.right > stripBounds.right - edgeSpacing) {
        scrollDelta = tabBounds.right - stripBounds.right + edgeSpacing;
      }

      if (scrollDelta !== 0) {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        strip.scrollBy({ left: scrollDelta, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      } else {
        this.updatePaneGlow();
      }
    });
  }

  private clearPaneGlow(): void {
    const paneElement = this.getPaneElement();
    paneElement?.style.removeProperty('--workspace-pane-glow-position');
    paneElement?.style.removeProperty('--workspace-pane-glow-color');
  }

  private getPaneElement(): HTMLElement | null {
    return this.tabScroll?.nativeElement.closest<HTMLElement>('app-workspace-pane') ?? null;
  }
}
