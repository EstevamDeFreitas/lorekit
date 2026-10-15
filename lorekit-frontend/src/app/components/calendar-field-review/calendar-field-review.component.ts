import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarFieldChangePlan, CalendarFieldImpactItem, CalendarFieldService } from '../../services/calendar-field.service';
import { CalendarService } from '../../services/calendar.service';
import { WorldService } from '../../services/world.service';
import { CalendarDatePickerComponent } from '../calendar-date-picker/calendar-date-picker.component';
import { CalendarDate } from '../../models/calendar.model';
import { parseCalendarFieldOptions } from '../../utils/calendar-field-options';

@Component({ selector: 'app-calendar-field-review', imports: [FormsModule, CalendarDatePickerComponent], templateUrl: './calendar-field-review.component.html', styleUrls: ['../calendar-controls.css', './calendar-field-review.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class CalendarFieldReviewComponent {
  readonly plan = inject<CalendarFieldChangePlan>(DIALOG_DATA);
  readonly ref = inject<DialogRef<boolean>>(DialogRef);
  readonly fields = inject(CalendarFieldService);
  readonly calendars = inject(CalendarService);
  readonly worlds = inject(WorldService).getWorlds();
  readonly error = signal(''); readonly saving = signal(false);
  readonly config = parseCalendarFieldOptions(this.plan.field.options);
  label(worldId: string): string { return this.worlds.find(w => w.id === worldId)?.name ?? worldId; }
  change(item: CalendarFieldImpactItem, date: CalendarDate | null): void { item.date = date; item.clearConfirmed = date === null; try { this.fields.validate(item, this.plan.field); } catch (e) { item.error = e instanceof Error ? e.message : 'Data inválida.'; } }
  async confirm(): Promise<void> {
    this.saving.set(true); this.error.set('');
    try { await this.fields.commit(this.plan); this.ref.close(true); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Não foi possível aplicar.'); }
    finally { this.saving.set(false); }
  }
}
