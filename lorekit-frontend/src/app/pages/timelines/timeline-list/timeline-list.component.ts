import { CommonModule, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { Timeline } from '../../../models/timeline.model';
import { World } from '../../../models/world.model';
import { TimelineService } from '../../../services/timeline.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-timeline-list',
  standalone: true,
  imports: [CommonModule, NgClass, ComboBoxComponent, IconButtonComponent, FormOverlayDirective],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row gap-4">
        <div class="w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
          <div class="flex flex-row justify-between mb-6">
            <h2 class="text-base mb-4">Linhas do Tempo</h2>
            <app-icon-button
              size="sm"
              buttonType="secondary"
              icon="fa-solid fa-plus"
              appFormOverlay
              [title]="'Criar Linha do Tempo'"
              [fields]="getFormFields()"
              (onSave)="createTimeline($event)">
            </app-icon-button>
          </div>

          @if (!selectedWorldId) {
            <div class="mb-4">
              <app-combo-box
                class="w-full"
                label="Filtro de mundo"
                [items]="availableWorlds"
                compareProp="id"
                displayProp="name"
                [(comboValue)]="manualWorldFilter"
                (comboValueChange)="onWorldSelect()">
              </app-combo-box>
            </div>
          }

          <div class="flex flex-col gap-3 w-full">
            @for (timeline of timelines; track timeline.id) {
              <button
                type="button"
                class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2 text-left"
                [ngClass]="selectedTimelineId === timeline.id ? 'text-yellow-300' : 'text-zinc-400'"
                (click)="selectTimeline(timeline.id)">
                <div class="flex flex-row items-center">
                  <i class="fa-solid" [ngClass]="'fa-timeline'"></i>
                </div>
                <h2 [title]="timeline.name" class="text-xs">{{ timeline.name }}</h2>
              </button>
            }

            @if (timelines.length === 0) {
              <p class="text-xs text-zinc-500">Nenhuma linha do tempo encontrada.</p>
            }
          </div>
        </div>

        <div class="flex-1 min-h-[60vh]">
          @if (selectedTimelineId) {
            <div class="rounded-md px-2">
              @if (showTimelineEditor && timelineEditComponent) {
                <ng-container *ngComponentOutlet="timelineEditComponent; inputs: { timelineIdInput: selectedTimelineId }"></ng-container>
              }
              @else {
                <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
                  Carregando linha do tempo...
                </div>
              }
            </div>
          }
          @else {
            <div class="h-full rounded-md flex items-center justify-center text-zinc-500">
              Selecione uma linha do tempo para editar
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './timeline-list.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TimelineListComponent implements OnInit {
  private timelineService = inject(TimelineService);
  private worldService = inject(WorldService);
  private worldStateService = inject(WorldStateService);

  timelines: Timeline[] = [];
  availableWorlds: World[] = [];
  selectedWorldId = '';
  manualWorldFilter = '';

  selectedTimelineId = '';
  showTimelineEditor = false;
  timelineEditComponent: any = null;

  ngOnInit() {
    this.availableWorlds = this.worldService.getWorlds();

    this.worldStateService.currentWorld$.subscribe(world => {
      this.selectedWorldId = world?.id || '';
      if (this.selectedWorldId) {
        this.manualWorldFilter = '';
      }
      this.loadTimelines();
    });

    this.loadTimelines();
  }

  loadTimelines() {
    const activeWorldId = this.selectedWorldId || this.manualWorldFilter || undefined;
    this.timelines = this.timelineService.getTimelines(activeWorldId);

    if (this.selectedTimelineId && !this.timelines.some(timeline => timeline.id === this.selectedTimelineId)) {
      this.selectedTimelineId = '';
      this.showTimelineEditor = false;
    }
  }

  onWorldSelect() {
    this.loadTimelines();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.selectedWorldId || this.manualWorldFilter || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
    ];
  }

  createTimeline(formData: Record<string, string>) {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    this.timelineService.saveTimeline(new Timeline('', name, ''), this.selectedWorldId || this.manualWorldFilter || formData['world'] || null);
    this.loadTimelines();
  }

  async selectTimeline(timelineId: string) {
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
