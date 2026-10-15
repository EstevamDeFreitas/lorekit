import { CalendarEventDatesComponent } from '../../../components/calendar-event-dates/calendar-event-dates.component';
import { CalendarTimelineService } from '../../../services/calendar-timeline.service';
import { CalendarDate } from '../../../models/calendar.model';
import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../../directives/history-field.directive';
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
  calendarDefaultDate?: CalendarDate;
  defaultSortOrder: number;
  worldId?: string | null;
}

@Component({
  selector: 'app-great-mark-edit',
  imports: [CalendarEventDatesComponent, EntityHistoryContextDirective, HistoryFieldDirective, ButtonComponent, ComboBoxComponent, FormsModule, IconButtonComponent, InputComponent, PersonalizationButtonComponent, TextAreaComponent],
  templateUrl: './great-mark-edit.component.html',
  styleUrl: './great-mark-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GreatMarkEditComponent {
  private readonly calendarTimeline = inject(CalendarTimelineService);
  calendarDateError = '';
  calendarSaveError = '';
  hasCalendar(): boolean { return !!this.calendarTimeline.timeline(this.data.timelineId).calendarId; }
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

  async saveMark(): Promise<void> {
    if (this.calendarDateError) return;
    this.calendarSaveError = '';
    try {
      this.calendarTimeline.prepareRecord(this.mark, this.data.timelineId);

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
    this.mark = savedMark;
    await this.calendarTimeline.flush();
    this.dialogRef.close({ saved: true, markId: savedMark.id });

    } catch (error) { this.calendarSaveError = error instanceof Error ? error.message : 'Não foi possível salvar.'; }
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
