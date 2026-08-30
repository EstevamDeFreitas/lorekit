import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '../../../components/button/button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { InputComponent } from '../../../components/input/input.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { EventType } from '../../../models/event-type.model';
import { GreatMark, buildGreatMarkRelatedEntities } from '../../../models/great-mark.model';
import { TimelineEventRelatedEntity } from '../../../models/timeline-event.model';
import { Location } from '../../../models/location.model';
import { getPersonalizationValue, hexToRgba } from '../../../models/personalization.model';
import { EntityMentionService, MentionEntity } from '../../../services/entity-mention.service';
import { EventTypeService } from '../../../services/event-type.service';
import { GreatMarkService } from '../../../services/great-mark.service';
import { LocationService } from '../../../services/location.service';

interface GreatMarkDialogData {
  id?: string;
  timelineId: string;
  defaultSortOrder: number;
  worldId?: string | null;
}

@Component({
  selector: 'app-great-mark-edit',
  imports: [ButtonComponent, ComboBoxComponent, FormsModule, IconButtonComponent, InputComponent, PersonalizationButtonComponent, TextAreaComponent],
  template: `
    <div class="w-full max-w-[980px] max-h-[82vh] overflow-y-auto scrollbar-dark pr-1 flex flex-col gap-5">
      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <input type="text" class="min-w-0 flex-1 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-none" [(ngModel)]="mark.name" />
        <div class="flex shrink-0 flex-wrap justify-end gap-2">
          @if (mark.id) {
            <app-personalization-button [entityId]="mark.id" [entityTable]="'GreatMark'" [size]="'xl'"></app-personalization-button>
          }
          <app-icon-button icon="fa-solid fa-xmark" buttonType="secondary" size="xl" (click)="dialogRef.close()"></app-icon-button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <app-input class="w-full min-w-0" label="Início (ano)" type="number" size="xs" [(value)]="mark.startDate"></app-input>
        <app-input class="w-full min-w-0" label="Fim (ano)" type="number" size="xs" [(value)]="mark.endDate"></app-input>
        <app-input class="w-full min-w-0" label="Faixa do marco" type="number" size="xs" [(value)]="mark.lane"></app-input>
        <app-input class="w-full min-w-0" label="Data exibida" size="xs" [(value)]="mark.displayDate"></app-input>
        <app-combo-box label="Tipo do evento" class="w-full" [items]="eventTypes" compareProp="id" displayProp="name" [(comboValue)]="selectedEventTypeId"></app-combo-box>
        <app-combo-box label="Local principal" class="w-full" [items]="locations" compareProp="id" displayProp="name" [(comboValue)]="selectedLocationId"></app-combo-box>
      </div>

      <p class="-mt-2 text-xs text-zinc-500">O ponto do marco fica automaticamente no centro do intervalo. A personalização define o ícone.</p>
      <app-text-area label="Descrição" [(value)]="mark.description" height="h-32"></app-text-area>

      <div class="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 flex flex-col gap-3">
        <div>
          <h3 class="font-semibold">Entidades relacionadas</h3>
          <p class="text-xs text-zinc-400">Adicione quantas entidades quiser para conectar o marco com o restante do sistema.</p>
        </div>
        <div class="flex flex-wrap gap-2 min-h-10">
          @for (item of relatedEntities; track item.entityTable + '-' + item.entityId) {
            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm" [style]="'border: solid 1px ' + (getPersonalizationValue(item, 'color') || 'var(--color-zinc-900)') + ';' + ' background: ' + hexToRgba(getPersonalizationValue(item, 'color') || 'var(--color-zinc-800)', 0.25)">
              <span class="text-zinc-200">{{ item.label }}</span>
              <span class="text-zinc-500 text-xs">{{ item.subtitle }}</span>
              <button type="button" class="text-zinc-400 hover:text-white cursor-pointer" (click)="removeRelatedEntity(item)"><i class="fa-solid fa-xmark"></i></button>
            </span>
          }
          @if (relatedEntities.length === 0) { <span class="text-sm text-zinc-500">Nenhuma entidade relacionada.</span> }
        </div>
        <div class="relative">
          <div class="flex gap-2">
            <input type="text" [(ngModel)]="relatedSearchTerm" (ngModelChange)="onRelatedSearchChange($event)" placeholder="Buscar mundos, personagens, documentos, organizações..." class="flex-1 rounded-lg px-3 py-2 bg-zinc-925 border border-zinc-800 text-sm focus:outline-none focus:border-zinc-100 placeholder:text-white/20" />
            <app-button label="Limpar" buttonType="secondary" size="sm" (click)="clearRelatedSearch()"></app-button>
          </div>
          @if (searchResults.length > 0) {
            <div class="absolute z-20 top-full mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 shadow-lg max-h-56 overflow-y-auto scrollbar-dark">
              @for (result of searchResults; track result.entityTable + '-' + result.entityId) {
                <button type="button" class="w-full text-left px-3 py-2 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900 cursor-pointer" (click)="addRelatedEntity(result)">
                  <div class="font-medium">{{ result.label }}</div><div class="text-xs text-zinc-500">{{ result.subtitle }}</div>
                </button>
              }
            </div>
          }
        </div>
      </div>

      <div class="flex flex-wrap justify-between gap-3 pt-2">
        <div>@if (mark.id) { <app-button label="Excluir" buttonType="danger" size="sm" (click)="deleteMark()"></app-button> }</div>
        <div class="flex gap-2"><app-icon-button title="Salvar" icon="fa-solid fa-floppy-disk" buttonType="primary" size="xl" (click)="saveMark()"></app-icon-button></div>
      </div>
    </div>
  `,
  styleUrl: './great-mark-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GreatMarkEditComponent {
  readonly dialogRef = inject<DialogRef<unknown>>(DialogRef<unknown>);
  readonly data = inject<GreatMarkDialogData>(DIALOG_DATA);
  private readonly greatMarkService = inject(GreatMarkService);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly locationService = inject(LocationService);
  private readonly mentionService = inject(EntityMentionService);
  private readonly confirm = inject(ConfirmService);
  readonly getPersonalizationValue = getPersonalizationValue;
  readonly hexToRgba = hexToRgba;

  mark = new GreatMark('', '', '', this.data.defaultSortOrder);
  eventTypes: EventType[] = [];
  locations: Location[] = [];
  selectedEventTypeId: string | null = null;
  selectedLocationId: string | null = null;
  relatedEntities: TimelineEventRelatedEntity[] = [];
  relatedSearchTerm = '';
  searchResults: MentionEntity[] = [];

  constructor() {
    this.eventTypes = this.eventTypeService.getEventTypes();
    this.locations = this.data.worldId ? this.locationService.getLocationByWorldId(this.data.worldId) : this.locationService.getLocations();
    if (this.data.id) {
      const storedMark = this.greatMarkService.getGreatMarkById(this.data.id);
      if (storedMark) {
        this.mark = storedMark;
        this.selectedEventTypeId = this.mark.ParentEventType?.id || null;
        this.selectedLocationId = this.mark.ParentLocation?.id || null;
        this.relatedEntities = buildGreatMarkRelatedEntities(this.mark);
      }
    }
  }

  saveMark(): void {
    if (!this.mark.name.trim()) return;
    this.mark.description ||= '';
    this.mark.startDate = Math.round(Number(this.mark.startDate) || 0);
    this.mark.endDate = Math.max(this.mark.startDate, Math.round(Number(this.mark.endDate) || this.mark.startDate));
    this.mark.lane = Math.max(0, Math.round(Number(this.mark.lane) || 0));
    this.mark.date = Math.round((this.mark.startDate + this.mark.endDate) / 2);
    this.mark.sortOrder = this.mark.date;
    const savedMark = this.greatMarkService.saveGreatMark(this.mark, {
      timelineId: this.data.timelineId,
      eventTypeId: this.selectedEventTypeId,
      locationId: this.selectedLocationId,
      relatedEntities: this.relatedEntities,
    });
    this.dialogRef.close({ saved: true, markId: savedMark.id });
  }

  deleteMark(): void {
    this.confirm.ask(`Tem certeza que deseja excluir o grande marco ${this.mark.name}?`).then(confirmed => {
      if (!confirmed) return;
      this.greatMarkService.deleteGreatMark(this.mark.id, false);
      this.dialogRef.close({ deleted: true });
    });
  }

  onRelatedSearchChange(term: string): void {
    const normalized = term.trim();
    this.searchResults = normalized
      ? this.mentionService.search(normalized, 8).filter(item => !this.relatedEntities.some(related => related.entityTable === item.entityTable && related.entityId === item.entityId))
      : [];
  }

  addRelatedEntity(result: MentionEntity): void {
    if (this.relatedEntities.some(item => item.entityTable === result.entityTable && item.entityId === result.entityId)) return;
    this.relatedEntities = [...this.relatedEntities, { entityTable: result.entityTable, entityId: result.entityId, label: result.label, subtitle: result.subtitle }];
    this.clearRelatedSearch();
  }

  removeRelatedEntity(item: TimelineEventRelatedEntity): void {
    this.relatedEntities = this.relatedEntities.filter(related => !(related.entityTable === item.entityTable && related.entityId === item.entityId));
  }

  clearRelatedSearch(): void {
    this.relatedSearchTerm = '';
    this.searchResults = [];
  }
}
