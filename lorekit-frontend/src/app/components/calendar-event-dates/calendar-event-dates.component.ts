import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CalendarDatePickerComponent } from '../calendar-date-picker/calendar-date-picker.component';
import { CalendarService } from '../../services/calendar.service';
import { CalendarTimelineService } from '../../services/calendar-timeline.service';
import { CalendarBinding, CalendarDate } from '../../models/calendar.model';
import { parseCalendarDate } from '../../utils/calendar-engine';

@Component({ selector: 'app-calendar-event-dates', imports: [CalendarDatePickerComponent], templateUrl: './calendar-event-dates.component.html', styleUrl: './calendar-event-dates.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class CalendarEventDatesComponent {
  readonly timelineId = input.required<string>(); readonly startJson = input<string | null | undefined>(); readonly endJson = input<string | null | undefined>();
  readonly defaultPosition = input(0); readonly defaultDate = input<CalendarDate | undefined>();
  readonly datesChange = output<{ start: string; end: string }>(); readonly validityChange = output<string>();
  private readonly calendars = inject(CalendarService); private readonly timelines = inject(CalendarTimelineService);
  readonly start = signal<CalendarDate | null>(null); readonly end = signal<CalendarDate | null>(null); readonly error = signal('');
  readonly binding = computed<CalendarBinding | null>(() => { const t = this.timelines.timeline(this.timelineId()); return t.calendarId && t.calendarRevisionId ? { calendarId: t.calendarId, revisionId: t.calendarRevisionId, countId: t.calendarCountId ?? undefined, formatId: t.calendarFormatId ?? undefined } : null; });
  constructor() {
    effect(() => {
      const binding = this.binding(), start = this.startJson(), end = this.endJson(), suggested = this.defaultDate(), position = this.defaultPosition();
      if (!binding) return;
      untracked(() => {
        try {
          const timeline = this.timelines.timeline(this.timelineId()), { engine } = this.calendars.resolve(binding, timeline.ParentWorld?.id), map = this.timelines.projection(timeline);
          const ordinal = map ? map.referenceOrdinal + (position - map.referencePosition) * (map.unit === 'year' ? map.daysPerYear : 1) : position;
          const point = engine.fromOrdinal(Math.round(ordinal));
          const fallback: CalendarDate = suggested ?? { version: 1, calendarId: binding.calendarId, revisionId: binding.revisionId, precision: 'day', ...point };
          this.start.set(parseCalendarDate(start, engine) ?? fallback); this.end.set(parseCalendarDate(end, engine) ?? this.start()); engine.validateRange(this.start()!, this.end()!); this.error.set(''); this.validityChange.emit('');
          if (!start || !end) this.datesChange.emit({ start: JSON.stringify(this.start()), end: JSON.stringify(this.end()) });
        } catch (e) { const message = e instanceof Error ? e.message : 'Data indisponível.'; this.error.set(message); this.validityChange.emit(message); }
      });
    });
  }
  update(side: 'start' | 'end', date: CalendarDate | null): void {
    if (side === 'start') this.start.set(date); else this.end.set(date);
    try {
      if (!this.start() || !this.end() || !this.binding()) throw new Error('Defina as datas de início e fim.');
      const engine = this.calendars.resolve(this.binding()!).engine;
      engine.validateRange(this.start()!, this.end()!); this.error.set(''); this.validityChange.emit('');
      this.datesChange.emit({ start: JSON.stringify(this.start()), end: JSON.stringify(this.end()) });
    } catch (e) { const error = e instanceof Error ? e.message : 'Intervalo inválido.'; this.error.set(error); this.validityChange.emit(error); }
  }
}
