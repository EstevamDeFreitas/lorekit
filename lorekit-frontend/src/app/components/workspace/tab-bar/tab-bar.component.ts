import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDragPlaceholder,
} from '@angular/cdk/drag-drop';
import { WorkspacePane, WorkspaceTab } from '../../../models/workspace.model';
import { TabManagerService } from '../../../services/tab-manager.service';

@Component({
  selector: 'app-workspace-tab-bar',
  standalone: true,
  imports: [NgClass, CdkDrag, CdkDropList, CdkDragPlaceholder],
  template: `
    <div
      class="flex flex-row items-stretch h-9 bg-zinc-925 border-b border-zinc-700 overflow-x-auto scrollbar-hide shrink-0"
      cdkDropList
      cdkDropListOrientation="horizontal"
      [cdkDropListData]="{ paneId: pane().id }"
      [id]="'drop-' + pane().id"
      (cdkDropListDropped)="onDrop($event)"
      (mousedown)="tabManager.setFocusedPane(pane().id)">

      <!-- Tabs -->
      @for (tab of pane().tabs; track tab.id) {
        <div
          cdkDrag
          [cdkDragData]="{ tabId: tab.id, paneId: pane().id }"
          class="flex flex-row items-center gap-1.5 px-3 h-full text-xs border-r border-zinc-700 cursor-pointer select-none shrink-0 group relative max-w-48 min-w-20"
          [ngClass]="getTabClasses(tab)"
          (click)="tabManager.setActiveTab(pane().id, tab.id)"
          (contextmenu)="openContextMenu($event, tab)">

          <!-- Drag placeholder -->
          <div *cdkDragPlaceholder class="w-24 h-full bg-zinc-700 opacity-40 rounded-sm"></div>

          <!-- Tab icon -->
          <i [class]="tab.icon" class="text-[10px] shrink-0 opacity-70"></i>

          <!-- Tab title -->
          <span class="overflow-hidden text-ellipsis whitespace-nowrap flex-1">{{ tab.title }}</span>

          <!-- Dirty indicator -->
          @if (tab.isDirty) {
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-300 shrink-0"></span>
          }

          <!-- Close button -->
          <button
            type="button"
            class="shrink-0 w-4 h-4 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 hover:bg-zinc-600 transition-opacity"
            [class.opacity-100]="tab.isDirty"
            (click)="closeTab($event, tab.id)"
            title="Fechar">
            <i class="fa-solid fa-xmark text-[9px]"></i>
          </button>
        </div>
      }

      <!-- Split pane button -->
      <button
        type="button"
        class="ml-auto flex items-center px-2 h-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 shrink-0 transition-colors"
        title="Dividir painel"
        (click)="tabManager.splitPane(pane().id)">
        <i class="fa-solid fa-table-columns text-xs"></i>
      </button>
    </div>

    <!-- Context menu -->
    @if (contextMenu()) {
      <div
        class="fixed z-50 bg-zinc-800 border border-zinc-600 rounded-md shadow-xl py-1 text-xs text-zinc-200 min-w-44"
        [style.left.px]="contextMenu()!.x"
        [style.top.px]="contextMenu()!.y"
        (mouseleave)="closeContextMenu()">
        <button class="w-full text-left px-3 py-1.5 hover:bg-zinc-700" (click)="ctxClose()">Fechar aba</button>
        <button class="w-full text-left px-3 py-1.5 hover:bg-zinc-700" (click)="ctxCloseOthers()">Fechar outras abas</button>
        <div class="border-t border-zinc-700 my-1"></div>
        <button class="w-full text-left px-3 py-1.5 hover:bg-zinc-700" (click)="ctxMoveToNewPane()">Mover para novo painel</button>
        @if (pane().tabs.length > 1) {
          <button class="w-full text-left px-3 py-1.5 hover:bg-zinc-700" (click)="ctxClosePane()">Fechar painel</button>
        }
      </div>
    }
  `,
  styles: [`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .cdk-drag-preview {
      background: #3f3f46;
      color: #e4e4e7;
      font-size: 0.75rem;
      padding: 0.25rem 0.75rem;
      border-radius: 0.25rem;
      border: 1px solid #71717a;
      box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
      opacity: 0.9;
    }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0, 0, 0.2, 1); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceTabBarComponent {
  pane = input.required<WorkspacePane>();

  tabManager = inject(TabManagerService);

  contextMenu = signal<{ x: number; y: number; tab: WorkspaceTab } | null>(null);

  getTabClasses(tab: WorkspaceTab): Record<string, boolean> {
    const isActive = tab.id === this.pane().activeTabId;
    return {
      'bg-zinc-900 text-zinc-100 border-t-2 border-t-yellow-300': isActive,
      'bg-zinc-925 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200': !isActive,
    };
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
}
