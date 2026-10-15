import { CalendarEventDatesComponent } from '../../../components/calendar-event-dates/calendar-event-dates.component';
import { CalendarTimelineService } from '../../../services/calendar-timeline.service';
import { CalendarDate } from '../../../models/calendar.model';
import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '../../../components/button/button.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { InputComponent } from '../../../components/input/input.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';
import { Age } from '../../../models/age.model';
import { AgeService } from '../../../services/age.service';
interface AgeDialogData {
  id?: string;
  timelineId: string;
  calendarDefaultDate?: CalendarDate;
  defaultStartDate: number;
}
@Component({
  selector: 'app-age-edit',
  imports: [CalendarEventDatesComponent, EntityHistoryContextDirective, ButtonComponent, IconButtonComponent, InputComponent, PersonalizationButtonComponent, TextAreaComponent],
  templateUrl: './age-edit.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AgeEditComponent {
  private readonly calendarTimeline = inject(CalendarTimelineService);
  calendarDateError = '';
  calendarSaveError = '';
  hasCalendar(): boolean { return !!this.calendarTimeline.timeline(this.data.timelineId).calendarId; }
  readonly dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  readonly data = inject<AgeDialogData>(DIALOG_DATA);
  private readonly ageService = inject(AgeService);
  private readonly confirm = inject(ConfirmService);
  age = new Age('', '', '', this.data.defaultStartDate, this.data.defaultStartDate);
  constructor() {
    if (this.data.id) {
      const storedAge = this.ageService.getAgeById(this.data.id);
      if (storedAge) this.age = storedAge;
    }
  }
  async saveAge(): Promise<void> {
    if (this.calendarDateError) return;
    this.calendarSaveError = '';
    try {
      this.calendarTimeline.prepareRecord(this.age, this.data.timelineId);

    if (!this.age.name.trim()) return;
    this.age.description ||= '';
    const savedAge = this.ageService.saveAge(this.age, this.data.timelineId);
    this.age = savedAge;
    await this.calendarTimeline.flush();
    this.dialogRef.close({ saved: true, ageId: savedAge.id });

    } catch (error) { this.calendarSaveError = error instanceof Error ? error.message : 'Não foi possível salvar.'; }
  }

  deleteAge() {
    this.confirm.ask(`Tem certeza que deseja excluir a era ${this.age.name}?`).then(confirmed => {
      if (!confirmed) return;
      this.ageService.deleteAge(this.age.id, false);
      this.dialogRef.close({ deleted: true });
    });
  }
}
