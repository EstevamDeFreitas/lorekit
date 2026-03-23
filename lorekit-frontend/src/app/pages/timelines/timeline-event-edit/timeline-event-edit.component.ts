import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from "../../../components/button/button.component";
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { InputComponent } from "../../../components/input/input.component";
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { TextAreaComponent } from "../../../components/text-area/text-area.component";
import { ComboBoxComponent } from "../../../components/combo-box/combo-box.component";
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';
import { EventType } from '../../../models/event-type.model';
import {
  TimelineEvent,
  TimelineEventRelatedEntity,
  buildTimelineEventRelatedEntities,
} from '../../../models/timeline-event.model';
import { Location } from '../../../models/location.model';
import { MentionEntity, EntityMentionService } from '../../../services/entity-mention.service';
import { EventService } from '../../../services/event.service';
import { EventTypeService } from '../../../services/event-type.service';
import { LocationService } from '../../../services/location.service';

interface TimelineEventDialogData {
  id?: string;
  timelineId: string;
  defaultSortOrder: number;
  worldId?: string | null;
}

@Component({
  selector: 'app-timeline-event-edit',
  standalone: true,
  imports: [ButtonComponent, ComboBoxComponent, FormsModule, IconButtonComponent, InputComponent, PersonalizationButtonComponent, TextAreaComponent],
  template: `
    <div class="w-[52rem] max-w-[94vw] flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold">{{ event.id ? 'Editar Evento' : 'Novo Evento' }}</h2>
          <p class="text-sm text-zinc-400">A ordem real da timeline é controlada pelo campo de ordem cronológica.</p>
        </div>
        <div class="flex items-center gap-2">
          @if (event.id) {
            <app-personalization-button [entityId]="event.id" [entityTable]="'Event'" [size]="'lg'"></app-personalization-button>
          }
          <app-icon-button icon="fa-solid fa-xmark" buttonType="secondary" size="lg" (click)="dialogRef.close()"></app-icon-button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <app-input label="Nome" [(value)]="event.name"></app-input>
        <app-input label="Conceito" [(value)]="event.concept"></app-input>
        <app-input label="Data exibida" [(value)]="event.date"></app-input>
        <app-input label="Ordem cronológica" type="number" [(value)]="event.chronologyOrder"></app-input>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <app-combo-box
          label="Tipo do evento"
          [items]="eventTypes"
          compareProp="id"
          displayProp="name"
          [(comboValue)]="selectedEventTypeId">
        </app-combo-box>
        <app-combo-box
          label="Local principal"
          [items]="locations"
          compareProp="id"
          displayProp="name"
          [(comboValue)]="selectedLocationId">
        </app-combo-box>
      </div>

      <app-text-area label="Descrição" [(value)]="event.description" height="h-32"></app-text-area>

      <div class="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 flex flex-col gap-3">
        <div>
          <h3 class="font-semibold">Entidades relacionadas</h3>
          <p class="text-xs text-zinc-400">Adicione quantas entidades quiser para conectar o evento com o restante do sistema.</p>
        </div>

        <div class="flex flex-wrap gap-2 min-h-10">
          @for (item of relatedEntities; track item.entityTable + '-' + item.entityId) {
            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-sm">
              <span class="text-zinc-200">{{ item.label }}</span>
              <span class="text-zinc-500 text-xs">{{ item.subtitle }}</span>
              <button type="button" class="text-zinc-400 hover:text-white cursor-pointer" (click)="removeRelatedEntity(item)">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </span>
          }
          @if (relatedEntities.length === 0) {
            <span class="text-sm text-zinc-500">Nenhuma entidade relacionada.</span>
          }
        </div>

        <div class="relative">
          <div class="flex gap-2">
            <input
              type="text"
              [(ngModel)]="relatedSearchTerm"
              (ngModelChange)="onRelatedSearchChange($event)"
              placeholder="Buscar mundos, personagens, documentos, organizações..."
              class="flex-1 rounded-lg px-3 py-2 bg-zinc-925 border border-zinc-800 text-sm focus:outline-none focus:border-zinc-100 placeholder:text-white/20"
            />
            <app-button label="Limpar" buttonType="secondary" size="sm" (click)="clearRelatedSearch()"></app-button>
          </div>

          @if (searchResults.length > 0) {
            <div class="absolute z-20 top-full mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 shadow-lg max-h-56 overflow-y-auto scrollbar-dark">
              @for (result of searchResults; track result.entityTable + '-' + result.entityId) {
                <button
                  type="button"
                  class="w-full text-left px-3 py-2 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-900 cursor-pointer"
                  (click)="addRelatedEntity(result)">
                  <div class="font-medium">{{ result.label }}</div>
                  <div class="text-xs text-zinc-500">{{ result.subtitle }}</div>
                </button>
              }
            </div>
          }
        </div>
      </div>

      <div class="flex justify-between gap-2 pt-2">
        <div>
          @if (event.id) {
            <app-button label="Excluir" buttonType="danger" size="sm" (click)="deleteEvent()"></app-button>
          }
        </div>
        <div class="flex gap-2">
          <app-button label="Cancelar" buttonType="secondary" size="sm" (click)="dialogRef.close()"></app-button>
          <app-button label="Salvar" buttonType="primary" size="sm" (click)="saveEvent()"></app-button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './timeline-event-edit.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TimelineEventEditComponent {
  readonly dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  readonly data = inject<TimelineEventDialogData>(DIALOG_DATA);
  private readonly eventService = inject(EventService);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly locationService = inject(LocationService);
  private readonly mentionService = inject(EntityMentionService);
  private readonly confirm = inject(ConfirmService);

  event = new TimelineEvent('', '', '', this.data.defaultSortOrder, this.data.defaultSortOrder);
  eventTypes: EventType[] = [];
  locations: Location[] = [];
  selectedEventTypeId: string | null = null;
  selectedLocationId: string | null = null;
  relatedEntities: TimelineEventRelatedEntity[] = [];
  relatedSearchTerm = '';
  searchResults: MentionEntity[] = [];
  private initialChronologyOrder = this.data.defaultSortOrder;

  constructor() {
    this.eventTypes = this.eventTypeService.getEventTypes();
    this.locations = this.data.worldId ? this.locationService.getLocationByWorldId(this.data.worldId) : this.locationService.getLocations();

    if (this.data.id) {
      this.event = this.eventService.getEventById(this.data.id);
      this.initialChronologyOrder = this.event.chronologyOrder;
      this.selectedEventTypeId = this.event.ParentEventType?.id || null;
      this.selectedLocationId = this.event.ParentLocation?.id || null;
      this.relatedEntities = buildTimelineEventRelatedEntities(this.event);
    }
  }

  saveEvent() {
    if (!this.event.name.trim()) {
      return;
    }

    this.event.description = this.event.description || '';
    this.event.sortOrder = Number(this.event.chronologyOrder || 0);
    this.event.chronologyOrder = Number(this.event.chronologyOrder || 0);

    const reorderRequired = !this.event.id || this.initialChronologyOrder !== this.event.chronologyOrder;

    const savedEvent = this.eventService.saveEvent(this.event, {
      timelineId: this.data.timelineId,
      eventTypeId: this.selectedEventTypeId,
      locationId: this.selectedLocationId,
      relatedEntities: this.relatedEntities,
    });

    this.dialogRef.close({
      saved: true,
      reorderRequired,
      eventId: savedEvent.id,
    });
  }

  deleteEvent() {
    this.confirm.ask(`Tem certeza que deseja excluir o evento ${this.event.name}?`).then(confirmed => {
      if (!confirmed) {
        return;
      }

      this.eventService.deleteEvent(this.event.id, false);
      this.dialogRef.close({ deleted: true });
    });
  }

  onRelatedSearchChange(term: string) {
    const normalized = term.trim();
    if (!normalized) {
      this.searchResults = [];
      return;
    }

    this.searchResults = this.mentionService.search(normalized, 8).filter(item =>
      !this.relatedEntities.some(related => related.entityTable === item.entityTable && related.entityId === item.entityId)
    );
  }

  addRelatedEntity(result: MentionEntity) {
    if (this.relatedEntities.some(item => item.entityTable === result.entityTable && item.entityId === result.entityId)) {
      return;
    }

    this.relatedEntities = [
      ...this.relatedEntities,
      {
        entityTable: result.entityTable,
        entityId: result.entityId,
        label: result.label,
        subtitle: result.subtitle,
      }
    ];

    this.clearRelatedSearch();
  }

  removeRelatedEntity(item: TimelineEventRelatedEntity) {
    this.relatedEntities = this.relatedEntities.filter(related =>
      !(related.entityTable === item.entityTable && related.entityId === item.entityId)
    );
  }

  clearRelatedSearch() {
    this.relatedSearchTerm = '';
    this.searchResults = [];
  }
}
