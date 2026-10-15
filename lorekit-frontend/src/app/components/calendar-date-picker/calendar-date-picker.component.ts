import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CalendarBinding, CalendarDate, CalendarPrecision, CalendarRules, CalendarSide } from '../../models/calendar.model';
import { CalendarEngine } from '../../utils/calendar-engine';
import { CalendarService } from '../../services/calendar.service';

@Component({
  selector: 'app-calendar-date-picker', imports: [ReactiveFormsModule],
  templateUrl: './calendar-date-picker.component.html', styleUrls: ['../calendar-controls.css', './calendar-date-picker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarDatePickerComponent {
  private readonly calendars = inject(CalendarService);
  readonly binding = input<CalendarBinding | null>(null);
  readonly rules = input<CalendarRules | null>(null);
  readonly value = input<CalendarDate | null>(null);
  readonly allowTime = input(false);
  readonly label = input('Data');
  readonly valueChange = output<CalendarDate | null>();
  readonly invalid = output<string>();
  private displayedCountId = '';
  readonly error = signal('');
  readonly preview = signal('');
  readonly contextLabel = signal('');
  readonly state = computed(() => {
    try {
      const binding = this.binding();
      if (!binding) return { engine: null, error: 'Selecione um calendário.' };
      const rules = this.rules();
      return { engine: rules ? new CalendarEngine(rules) : this.calendars.resolve(binding).engine, error: '' };
    } catch (e) { return { engine: null, error: e instanceof Error ? e.message : 'Calendário indisponível.' }; }
  });
  readonly form = new FormGroup({
    precision: new FormControl<CalendarPrecision>('day', { nonNullable: true }),
    countId: new FormControl('', { nonNullable: true }), side: new FormControl<CalendarSide>('after', { nonNullable: true }),
    year: new FormControl<number | null>(1), monthId: new FormControl('', { nonNullable: true }), day: new FormControl<number | null>(1),
    withTime: new FormControl(false, { nonNullable: true }), hour: new FormControl<number | null>(0), minute: new FormControl<number | null>(0), second: new FormControl<number | null>(0),
  });
  constructor() {
    effect(() => {
      const engine = this.state().engine, date = this.value(), binding = this.binding();
      if (!engine || !binding) return;
      let year = 1, side: CalendarSide = 'after';
      const countId = date?.countId ?? binding.countId ?? engine.rules.counts[0]?.id ?? '';
      try {
        if (date) {
          const point = engine.fromOrdinal(engine.bounds(date).start.day);
          const counted = countId ? engine.countedYear(point, countId) : { year: date.year, side: 'after' as const };
          year = counted.year; side = date.side ?? counted.side;
          this.preview.set(engine.format(date, binding.formatId, countId));
          this.contextLabel.set(this.metadata(engine, date));
        } else { this.preview.set('Nenhuma data definida.'); this.contextLabel.set(''); }
        this.error.set('');
      } catch (e) { this.error.set(e instanceof Error ? e.message : 'Data indisponível.'); }
      this.displayedCountId = countId;
      this.form.setValue({ precision: date?.precision ?? 'day', countId, side, year, monthId: date?.monthId ?? engine.rules.months[0]?.id ?? '', day: date?.day ?? 1,
        withTime: !!date?.time, hour: date?.time?.hour ?? 0, minute: date?.time?.minute ?? 0, second: date?.time?.second ?? 0 }, { emitEvent: false });
    });
  }
  changeCount(countId: string): void {
    const engine = this.state().engine;
    if (!engine || countId === this.displayedCountId) return;
    const f = this.form.getRawValue();
    try {
      if (f.year === null) throw new Error('Informe o ano antes de trocar a contagem.');
      const year = this.displayedCountId ? engine.fromCountedYear(f.year, f.side, this.displayedCountId) : f.year;
      const date: CalendarDate = { version: 1, calendarId: this.binding()!.calendarId, revisionId: this.binding()!.revisionId, precision: f.precision, year,
        ...(this.displayedCountId ? { countId: this.displayedCountId, side: f.side } : {}),
        ...(f.precision !== 'year' && engine.rules.months.length ? { monthId: f.monthId } : {}), ...(f.precision === 'day' ? { day: f.day ?? NaN } : {}),
      };
      const point = engine.fromOrdinal(engine.bounds(date).start.day), counted = engine.countedYear(point, countId);
      this.form.patchValue({ countId, year: counted.year, side: counted.side }, { emitEvent: false });
      this.displayedCountId = countId; this.error.set('');
    } catch (e) { this.form.controls.countId.setValue(this.displayedCountId, { emitEvent: false }); this.error.set(e instanceof Error ? e.message : 'Revise a data antes de trocar a contagem.'); }
  }
  apply(): void {
    try {
      const engine = this.state().engine, binding = this.binding();
      if (!engine || !binding) throw new Error(this.state().error);
      const f = this.form.getRawValue();
      if (f.year === null) throw new Error('Informe o ano.');
      const year = f.countId ? engine.fromCountedYear(f.year, f.side, f.countId) : f.year;
      const date: CalendarDate = { version: 1, calendarId: binding.calendarId, revisionId: binding.revisionId, precision: f.precision, year,
        ...(f.countId ? { countId: f.countId, side: f.side } : {}),
        ...(f.precision !== 'year' && engine.rules.months.length ? { monthId: f.monthId } : {}),
        ...(f.precision === 'day' ? { day: f.day ?? NaN } : {}),
        ...(f.precision === 'day' && this.allowTime() && f.withTime ? { time: { hour: f.hour ?? NaN, minute: f.minute ?? NaN, second: f.second ?? NaN } } : {}),
      };
      engine.bounds(date); this.error.set(''); this.preview.set(engine.format(date, binding.formatId, f.countId)); this.contextLabel.set(this.metadata(engine, date)); this.valueChange.emit(date);
    } catch (e) { const error = e instanceof Error ? e.message : 'Data inválida.'; this.error.set(error); this.invalid.emit(error); }
  }
  private metadata(engine: CalendarEngine, date: CalendarDate): string {
    if (date.precision !== 'day') return '';
    const point = engine.fromOrdinal(engine.bounds(date).start.day), weekday = engine.weekday(point);
    return [weekday === null ? '' : engine.rules.week.days[weekday].name, ...engine.seasons(point).map(s => s.name)].filter(Boolean).join(' · ');
  }
  clear(): void { this.error.set(''); this.preview.set('Nenhuma data definida.'); this.contextLabel.set(''); this.valueChange.emit(null); }
}
