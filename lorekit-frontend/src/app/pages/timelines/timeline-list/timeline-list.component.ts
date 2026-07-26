import { Dialog } from '@angular/cdk/dialog';
import { CommonModule, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { TreeViewListComponent } from '../../../components/entity-lateral-menu/entity-lateral-menu.component';
import { buildTreeViewNodes, filterTreeViewNodes, TreeViewNode, TreeViewReparentRequest } from '../../../components/entity-lateral-menu/tree-view.models';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { SafeDeleteComponent } from '../../../components/safe-delete/safe-delete.component';
import { Timeline } from '../../../models/timeline.model';
import { World } from '../../../models/world.model';
import { EntityHierarchyService } from '../../../services/entity-hierarchy.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { TimelineService } from '../../../services/timeline.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-timeline-list',
  standalone: true,
  imports: [CommonModule, NgClass, FormsModule, ComboBoxComponent, IconButtonComponent, FormOverlayDirective, TreeViewListComponent],
  template: `
    <div class="flex flex-col h-full relative">
      <div class="flex flex-row h-full gap-4">
        <div [ngClass]="panelMode() ? 'flex-1 overflow-hidden' : (showsidebar ? 'transition-all duration-300 overflow-clip shrink-0 w-80' : 'transition-all duration-300 overflow-clip shrink-0 w-0')">
          <div [ngClass]="panelMode() ? 'w-full bg-zinc-925 p-3 h-full overflow-y-auto scrollbar-dark' : 'w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800'">

            <div class="mb-4">
              <app-combo-box class="w-full" label="Filtro de mundo" [items]="availableWorlds" compareProp="id" displayProp="name" [(comboValue)]="selectedWorldId" (comboValueChange)="onWorldSelect()"></app-combo-box>
            </div>

            <div class="flex flex-row items-center gap-1 mb-4">
              <div class="flex flex-row flex-1 text-xs items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus-within:border-white">
                <div class="w-8 h-5 flex flex-row justify-center items-center"><i class="fa fa-search"></i></div>
                <input type="text" [(ngModel)]="searchTerm" (ngModelChange)="filterTimelines()" placeholder="Pesquisar..." class="w-full p-1 bg-transparent border-none outline-none placeholder:text-white/10" />
              </div>
              <app-icon-button size="sm" buttonType="secondaryActive" icon="fa-solid fa-plus" appFormOverlay [title]="'Criar Linha do Tempo'" [fields]="getFormFields()" (onSave)="createTimeline($event)"></app-icon-button>
            </div>

            <app-tree-view-list
              [openInDialog]="false"
              [allowCreate]="true"
              [useCustomCreate]="true"
              [dragEnabled]="!searchTerm.trim()"
              [dragContextId]="'timeline-list:' + (selectedWorldId || 'root')"
              [canReparent]="canReparentTimeline"
              [fallbackIcon]="'fa-timeline'"
              [createTitle]="'Criar Linha do Tempo'"
              [createFieldLabel]="'Nome'"
              [emptyChildrenLabel]="'Nenhuma linha do tempo encontrada'"
              (onDocumentSelect)="selectTimeline($event.id)"
              (onCreateChild)="createChildTimeline($event)"
              (onReparentRequested)="reparentTimeline($event)"
              (onDelete)="deleteTimeline($event)"
              (onDocumentNewTab)="newTabTimeline($event)"
              [documentArray]="filteredTimelineTreeNodes">
            </app-tree-view-list>
          </div>
        </div>

        @if (!panelMode()) {
          <small class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer" [ngClass]="[showsidebar ? 'start-92' : 'start-12']" (click)="showsidebar = !showsidebar">
            <i class="fa-solid text-zinc-400" [ngClass]="[showsidebar ? 'fa-angles-left' : 'fa-angles-right']"></i>
          </small>
        }

        @if (!panelMode()) {
          <div class="flex-1 min-h-[60vh]">
            @if (selectedTimelineId) {
              <div class="rounded-md px-2">
                @if (showTimelineEditor && timelineEditComponent) {
                  <ng-container *ngComponentOutlet="timelineEditComponent; inputs: { timelineIdInput: selectedTimelineId }"></ng-container>
                }
                @else {
                  <div class="h-full rounded-md flex items-center justify-center text-zinc-500">Carregando linha do tempo...</div>
                }
              </div>
            }
            @else {
              <div class="h-full rounded-md flex items-center justify-center text-zinc-500">Selecione uma linha do tempo para editar</div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './timeline-list.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TimelineListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly timelineService = inject(TimelineService);
  private readonly worldService = inject(WorldService);
  private readonly worldStateService = inject(WorldStateService);
  private readonly entityHierarchyService = inject(EntityHierarchyService);
  private readonly safeDeleteDialog = inject(Dialog);

  timelines: Timeline[] = [];
  timelineTreeNodes: TreeViewNode[] = [];
  filteredTimelineTreeNodes: TreeViewNode[] = [];
  searchTerm = '';
  availableWorlds: World[] = [];
  selectedWorldId = '';
  panelMode = input<boolean>(false);
  tabManager = inject(TabManagerService);
  showsidebar = true;
  selectedTimelineId = '';
  showTimelineEditor = false;
  timelineEditComponent: any = null;

  readonly canReparentTimeline = (draggedId: string, newParentId: string | null) =>
    this.entityHierarchyService.canReparent('Timeline', draggedId, newParentId);

  ngOnInit() {
    this.availableWorlds = this.worldService.getWorlds();

    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      this.selectedWorldId = world?.id || '';
      this.loadTimelines();
    });

    this.loadTimelines();
  }

  loadTimelines() {
    this.timelines = this.timelineService.getTimelines(this.selectedWorldId || undefined).sort((a, b) => a.name.localeCompare(b.name));
    this.timelineTreeNodes = buildTreeViewNodes(this.timelines, timeline => timeline.name, timeline => timeline.ParentTimeline?.id);
    this.filterTimelines();

    if (this.selectedTimelineId && !this.timelines.some(timeline => timeline.id === this.selectedTimelineId)) {
      this.selectedTimelineId = '';
      this.showTimelineEditor = false;
    }
  }

  filterTimelines() {
    this.filteredTimelineTreeNodes = filterTreeViewNodes(this.timelineTreeNodes, this.searchTerm);
  }

  onWorldSelect() {
    this.loadTimelines();
  }

  deleteTimeline(timelineId: string) {
    const timeline = this.timelineService.getTimelineById(timelineId);

    this.safeDeleteDialog.open(SafeDeleteComponent, {
      data: {
        entityName: timeline.name,
        entityTable: 'Timeline',
        entityId: timelineId
      },
      panelClass: 'screen-dialog',
      width: '400px',
    });
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.selectedWorldId || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
    ];
  }

  createChildTimeline(event: { parentId: string, formData: Record<string, string> }) {
    const name = event.formData['name']?.trim();
    const parent = this.timelines.find(timeline => timeline.id === event.parentId);
    if (!name || !parent) {
      return;
    }

    const child = this.timelineService.saveTimeline(
      new Timeline('', name, ''),
      parent.ParentWorld?.id || this.selectedWorldId || null
    );
    this.entityHierarchyService.reparent('Timeline', child.id, parent.id);
    this.loadTimelines();
  }

  reparentTimeline(event: TreeViewReparentRequest) {
    try {
      this.entityHierarchyService.reparent('Timeline', event.draggedId, event.newParentId);
      this.loadTimelines();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Falha ao reorganizar a linha do tempo.');
    }
  }

  createTimeline(formData: Record<string, string>) {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    this.timelineService.saveTimeline(new Timeline('', name, ''), this.selectedWorldId || formData['world'] || null);
    this.loadTimelines();
  }

  async newTabTimeline(timelineId: string) {
    if (this.panelMode()) {
      const timeline = this.timelines.find(item => item.id === timelineId);
      this.tabManager.openTab('Timeline', timelineId, timeline?.name ?? 'Linha do Tempo', 'fa-solid fa-timeline');
      this.selectedTimelineId = timelineId;
      return;
    }
    if (this.selectedTimelineId === timelineId) {
      return;
    }

    this.showTimelineEditor = false;
    this.selectedTimelineId = '';

    if (!this.timelineEditComponent) {
      const { TimelineEditComponent } = await import('../timeline-edit/timeline-edit.component');
      this.timelineEditComponent = TimelineEditComponent;
    }

    setTimeout(() => {
      this.selectedTimelineId = timelineId;
      this.showTimelineEditor = true;
    }, 0);
  }

  async selectTimeline(timelineId: string) {
    if (this.panelMode()) {
      const timeline = this.timelines.find(item => item.id === timelineId);
      this.tabManager.substituteCurrentTab('Timeline', timelineId, timeline?.name ?? 'Linha do Tempo', 'fa-solid fa-timeline');
      this.selectedTimelineId = timelineId;
      return;
    }
    if (this.selectedTimelineId === timelineId) {
      return;
    }

    this.showTimelineEditor = false;
    this.selectedTimelineId = '';

    if (!this.timelineEditComponent) {
      const { TimelineEditComponent } = await import('../timeline-edit/timeline-edit.component');
      this.timelineEditComponent = TimelineEditComponent;
    }

    setTimeout(() => {
      this.selectedTimelineId = timelineId;
      this.showTimelineEditor = true;
    }, 0);
  }
}
