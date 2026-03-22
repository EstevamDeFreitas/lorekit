import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass, NgStyle } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from "../../../components/button/button.component";
import { ComboBoxComponent } from "../../../components/combo-box/combo-box.component";
import { FormField, FormOverlayDirective } from "../../../components/form-overlay/form-overlay.component";
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { Timeline } from '../../../models/timeline.model';
import { World } from '../../../models/world.model';
import { TimelineService } from '../../../services/timeline.service';
import { WorldService } from '../../../services/world.service';
import { WorldStateService } from '../../../services/world-state.service';

@Component({
  selector: 'app-timeline-list',
  standalone: true,
  imports: [ButtonComponent, ComboBoxComponent, FormOverlayDirective, FormsModule, NgClass, NgStyle],
  template: `
    <div class="flex flex-col relative">
      <div class="flex flex-row justify-between items-center mb-4 sticky top-0 z-50 bg-zinc-950 py-2">
        <div>
          <h3 class="text-xl font-bold">Linhas do Tempo</h3>
          @if (selectedWorldName) {
            <p class="text-xs text-zinc-400 mt-1">Filtrado pelo mundo atual: {{ selectedWorldName }}</p>
          }
          @else {
            <p class="text-xs text-zinc-400 mt-1">Mostrando timelines globais e de todos os mundos.</p>
          }
        </div>
        <app-button
          buttonType="white"
          label="Nova"
          size="sm"
          appFormOverlay
          [title]="'Criar Linha do Tempo'"
          [fields]="getFormFields()"
          (onSave)="createTimeline($event)">
        </app-button>
      </div>

      @if (!selectedWorldId) {
        <div class="w-70 mb-4">
          <app-combo-box
            label="Associar novo item a um mundo"
            [items]="availableWorlds"
            compareProp="id"
            displayProp="name"
            [(comboValue)]="creationWorldId">
          </app-combo-box>
        </div>
      }

      @if (timelines.length === 0) {
        <div class="text-center py-16 text-zinc-400 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
          Nenhuma linha do tempo encontrada.
        </div>
      }
      @else {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          @for (timeline of timelines; track timeline.id) {
            @let bgImage = getImageByUsageKey(timeline.Images, 'default');
            <button
              type="button"
              (click)="openTimeline(timeline.id)"
              class="rounded-xl border border-zinc-800 p-4 text-left selectable-jump cursor-pointer"
              [ngStyle]="bgImage ? buildCardBgStyle(bgImage.filePath) : {'background-color': getPersonalizationValue(timeline, 'color') || 'var(--color-zinc-800)'}">
              <div class="flex flex-col gap-4 min-h-52" [ngClass]="getTextClass(getPersonalizationValue(timeline, 'color'))">
                <div class="flex items-center gap-2">
                  <i class="fa-solid" [ngClass]="getPersonalizationValue(timeline, 'icon') || 'fa-timeline'"></i>
                  <h4 class="text-lg font-bold line-clamp-2">{{ timeline.name }}</h4>
                </div>

                <p class="text-sm line-clamp-4 opacity-90">{{ timeline.concept || 'Sem conceito definido.' }}</p>

                <div class="mt-auto flex flex-wrap gap-2">
                  @if (timeline.ParentWorld) {
                    <span class="text-xs px-2 py-1 rounded-md bg-zinc-950/80 text-white border border-zinc-700">
                      <i class="fa-solid fa-earth me-1"></i>{{ timeline.ParentWorld.name }}
                    </span>
                  }
                  @else {
                    <span class="text-xs px-2 py-1 rounded-md bg-zinc-950/80 text-white border border-zinc-700">
                      <i class="fa-solid fa-globe me-1"></i>Global
                    </span>
                  }
                </div>
              </div>
            </button>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './timeline-list.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TimelineListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly timelineService = inject(TimelineService);
  private readonly worldService = inject(WorldService);
  private readonly worldStateService = inject(WorldStateService);

  public readonly getPersonalizationValue = getPersonalizationValue;
  public readonly getTextClass = getTextClass;
  public readonly getImageByUsageKey = getImageByUsageKey;

  timelines: Timeline[] = [];
  availableWorlds: World[] = [];
  selectedWorldId = '';
  selectedWorldName = '';
  creationWorldId: string | null = null;

  ngOnInit() {
    this.availableWorlds = this.worldService.getWorlds();

    this.worldStateService.currentWorld$.subscribe(world => {
      this.selectedWorldId = world?.id || '';
      this.selectedWorldName = world?.name || '';
      this.creationWorldId = this.selectedWorldId || null;
      this.loadTimelines();
    });

    this.loadTimelines();
  }

  loadTimelines() {
    this.timelines = this.timelineService.getTimelines(this.selectedWorldId || undefined);
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
      { key: 'world', label: 'Mundo', value: this.selectedWorldId || this.creationWorldId || '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
    ];
  }

  createTimeline(formData: Record<string, string>) {
    const name = formData['name']?.trim();
    if (!name) {
      return;
    }

    const timeline = this.timelineService.saveTimeline(new Timeline('', name, ''), this.selectedWorldId || formData['world'] || null);
    this.loadTimelines();
    this.openTimeline(timeline.id);
  }

  openTimeline(timelineId: string) {
    this.router.navigate(['/app/timeline/edit', timelineId]);
  }

  buildCardBgStyle(filePath?: string | null) {
    const url = buildImageUrl(filePath);
    return url ? {
      'background-image': `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.65)), url(${url})`,
      'background-size': 'cover',
      'background-position': 'center',
    } : null;
  }
}
