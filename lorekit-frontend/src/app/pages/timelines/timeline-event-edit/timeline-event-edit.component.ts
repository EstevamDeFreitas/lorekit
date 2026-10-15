import { CalendarEventDatesComponent } from '../../../components/calendar-event-dates/calendar-event-dates.component';
import { CalendarTimelineService } from '../../../services/calendar-timeline.service';
import { CalendarDate } from '../../../models/calendar.model';
import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../../directives/history-field.directive';
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
import { SafeDeleteButtonComponent } from "../../../components/safe-delete-button/safe-delete-button.component";
import { getPersonalizationValue, hexToRgba } from '../../../models/personalization.model';

interface TimelineEventDialogData {
  id?: string;
  timelineId: string;
  calendarDefaultDate?: CalendarDate;
  defaultSortOrder: number;
  worldId?: string | null;
}

@Component({
  selector: 'app-timeline-event-edit',
  standalone: true,
  imports: [CalendarEventDatesComponent, EntityHistoryContextDirective, HistoryFieldDirective, ButtonComponent, ComboBoxComponent, FormsModule, IconButtonComponent, InputComponent, PersonalizationButtonComponent, TextAreaComponent, SafeDeleteButtonComponent],
  templateUrl: './timeline-event-edit.component.html',
  styleUrl: './timeline-event-edit.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TimelineEventEditComponent {
  private readonly calendarTimeline = inject(CalendarTimelineService);
  calendarDateError = '';
  calendarSaveError = '';
  hasCalendar(): boolean { return !!this.calendarTimeline.timeline(this.data.timelineId).calendarId; }
  readonly dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  readonly data = inject<TimelineEventDialogData>(DIALOG_DATA);
  private readonly eventService = inject(EventService);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly locationService = inject(LocationService);
  private readonly mentionService = inject(EntityMentionService);
  private readonly confirm = inject(ConfirmService);

  public getPersonalizationValue = getPersonalizationValue;
  public hexToRgba = hexToRgba;

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
      const storedEvent = this.eventService.getEventById(this.data.id);
      if (storedEvent) {
        this.event = storedEvent;
        this.initialChronologyOrder = this.event.chronologyOrder;
        this.selectedEventTypeId = this.event.ParentEventType?.id || null;
        this.selectedLocationId = this.event.ParentLocation?.id || null;
        this.relatedEntities = buildTimelineEventRelatedEntities(this.event);
      }
    }
  }

  async saveEvent(): Promise<void> {
    if (this.calendarDateError) return;
    this.calendarSaveError = '';
    try {
      this.calendarTimeline.prepareRecord(this.event, this.data.timelineId);

    if (!this.event.name.trim()) {
      return;
    }

    this.event.description = this.event.description || '';
    this.event.startDate = Math.round(Number(this.event.startDate) || 0);
    this.event.endDate = Math.max(this.event.startDate, Math.round(Number(this.event.endDate) || this.event.startDate));
    this.event.lane = Math.max(0, Math.round(Number(this.event.lane) || 0));
    this.event.sortOrder = this.event.startDate;
    this.event.chronologyOrder = this.event.startDate;
    const reorderRequired = !this.event.id || this.initialChronologyOrder !== this.event.chronologyOrder;

    const savedEvent = this.eventService.saveEvent(this.event, {
      timelineId: this.data.timelineId,
      eventTypeId: this.selectedEventTypeId,
      locationId: this.selectedLocationId,
      relatedEntities: this.relatedEntities,
    });

    this.event = savedEvent;
    await this.calendarTimeline.flush();
    this.dialogRef.close({
      saved: true,
      reorderRequired,
      eventId: savedEvent.id,
    });

    } catch (error) { this.calendarSaveError = error instanceof Error ? error.message : 'Não foi possível salvar.'; }
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
