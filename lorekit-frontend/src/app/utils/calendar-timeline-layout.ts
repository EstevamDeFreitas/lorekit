import { CalendarDate } from '../models/calendar.model';
import { CalendarEngine, calendarModulo } from './calendar-engine';

export type CalendarScale = 'century' | 'decade' | 'year' | 'month' | 'week' | 'day';
export interface CalendarTick { day: number; label: string; }
export function availableCalendarScales(engine: CalendarEngine): CalendarScale[] {
  return (['century', 'decade', 'year', ...(engine.rules.months.length ? ['month'] : []), ...(engine.rules.week.enabled ? ['week'] : []), 'day'] as CalendarScale[]);
}
export function calendarTicks(engine: CalendarEngine, start: number, end: number, scale: CalendarScale, countId?: string, maximum = 300): CalendarTick[] {
  if (!availableCalendarScales(engine).includes(scale)) return [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const ticks: CalendarTick[] = [], days = new Set<number>();
  const add = (day: number, label?: string): void => {
    if (day < start || day > end || days.has(day) || ticks.length >= maximum) return;
    const point = engine.fromOrdinal(day);
    let text = label;
    if (!text) {
      const counted = engine.rules.counts.length ? engine.countedYear(point, countId) : { year: point.year, side: 'after' as const, abbreviation: '' };
      if (scale === 'century' || scale === 'decade') {
        const size = scale === 'century' ? 100 : 10;
        const first = counted.side === 'before' ? 1 : engine.rules.counts.length ? engine.count(countId).firstYear : 0;
        const group = Math.floor((counted.year - first) / size);
        text = (scale === 'century' ? 'Século ' + (group + 1) : 'Década ' + (group * size + first) + '–' + (group * size + first + size - 1)) + ' ' + counted.abbreviation;
      } else if (scale === 'year') text = counted.year + ' ' + counted.abbreviation;
      else if (scale === 'month') text = engine.rules.months.find(m => m.id === point.monthId)?.name ?? String(point.day);
      else if (scale === 'week') text = 'Semana · ' + point.day;
      else text = String(point.day);
    }
    ticks.push({ day, label: text.trim() }); days.add(day);
  };
  if (scale === 'century' || scale === 'decade' || scale === 'year') {
    const base = scale === 'century' ? 100 : scale === 'decade' ? 10 : 1;
    const size = base * Math.max(1, Math.ceil((end - start) / engine.daysPerYear / base / Math.max(1, maximum - 3)));
    const firstYear = engine.fromOrdinal(Math.floor(start)).year, lastYear = engine.fromOrdinal(Math.ceil(end)).year;
    if (engine.rules.counts.length) {
      const count = engine.count(countId), anchor = engine.toOrdinal(count.reference), partial = calendarModulo(anchor, engine.daysPerYear) !== 0;
      for (const [phase, side] of [[count.reference.year + (partial ? 1 : 0), 'before'], [count.reference.year, 'after']] as const) {
        let year = phase + Math.ceil((firstYear - phase) / size) * size;
        let iterations = 0;
        for (; year <= lastYear && iterations++ < maximum; year += size) {
          const day = engine.toOrdinal({ year, monthId: engine.rules.months[0]?.id, day: 1 });
          if ((side === 'before' && day < anchor) || (side === 'after' && day >= anchor)) add(day);
        }
      }
      add(anchor);
    } else {
      for (let year = Math.ceil(firstYear / size) * size, count = 0; year <= lastYear && count++ < maximum; year += size) add(engine.toOrdinal({ year, monthId: engine.rules.months[0]?.id, day: 1 }));
    }
  } else if (scale === 'day') {
    const stride = Math.max(1, Math.ceil((end - start) / Math.max(1, maximum - 1)));
    for (let day = Math.ceil(start / stride) * stride; day <= end && ticks.length < maximum; day += stride) add(day);
  } else if (scale === 'week' && engine.rules.week.mode === 'continuous') {
    const base = engine.rules.week.days.length;
    const size = base * Math.max(1, Math.ceil((end - start) / base / Math.max(1, maximum - 1)));
    for (let day = Math.ceil((start + engine.rules.week.anchor) / size) * size - engine.rules.week.anchor; day <= end && ticks.length < maximum; day += size) add(day);
  } else {
    // Address month/restarting-week boundaries directly, so density sampling spans the whole viewport.
    const blocks = engine.rules.months.length ? engine.rules.months.map(m => ({ monthId: m.id, length: m.days })) : [{ monthId: undefined, length: engine.daysPerYear }];
    const units = blocks.map(b => scale === 'month' ? 1 : Math.ceil(b.length / engine.rules.week.days.length));
    const offsets: number[] = []; let unitsPerYear = 0;
    for (const count of units) { offsets.push(unitsPerYear); unitsPerYear += count; }
    const indexAt = (day: number): number => {
      const point = engine.fromOrdinal(day), block = Math.max(0, blocks.findIndex(b => b.monthId === point.monthId));
      return point.year * unitsPerYear + offsets[block] + (scale === 'month' ? 0 : Math.floor((point.day - 1) / engine.rules.week.days.length));
    };
    const first = indexAt(Math.floor(start)), last = indexAt(Math.ceil(end));
    const stride = Math.max(1, Math.ceil((last - first) / Math.max(1, maximum - 1)));
    for (let index = first, count = 0; index <= last && count++ < maximum + 1; index += stride) {
      const year = Math.floor(index / unitsPerYear), local = calendarModulo(index, unitsPerYear);
      let block = offsets.length - 1; while (block > 0 && offsets[block] > local) block--;
      const day = scale === 'month' ? 1 : 1 + (local - offsets[block]) * engine.rules.week.days.length;
      add(engine.toOrdinal({ year, monthId: blocks[block].monthId, day }));
    }
  }

  return ticks.sort((a, b) => a.day - b.day);
}
export function moveCalendarDates(engine: CalendarEngine, start: CalendarDate, end: CalendarDate, days: number): { start: CalendarDate; end: CalendarDate } {
  const a = engine.bounds(start), b = engine.bounds(end);
  const next = { start: shiftCalendarDate(engine, start, days), end: shiftCalendarDate(engine, end, days) }, c = engine.bounds(next.start), d = engine.bounds(next.end);
  const delta = c.start.day - a.start.day;
  if (d.start.day - b.start.day !== delta || c.end.day - a.end.day !== delta || d.end.day - b.end.day !== delta) throw new Error('Este movimento altera a duração ou a precisão. Edite os limites pelo formulário.');
  engine.validateRange(next.start, next.end); return next;
}

export function shiftCalendarDate(engine: CalendarEngine, date: CalendarDate, days: number): CalendarDate {
  const original = engine.bounds(date).start.day;
  let shifted: CalendarDate;
  if (date.precision === 'year') shifted = { ...date, year: date.year + Math.round(days / engine.daysPerYear) };
  else if (date.precision === 'month') {
    const point = engine.fromOrdinal(original + Math.round(days));
    shifted = { ...date, year: point.year, monthId: point.monthId };
  } else shifted = { ...date, ...engine.fromOrdinal(original + Math.round(days)) };
  if (date.countId) {
    const point = { year: shifted.year, monthId: shifted.monthId ?? engine.rules.months[0]?.id, day: shifted.day ?? 1 };
    shifted.side = engine.countedYear(point, date.countId).side;
  }
  engine.bounds(shifted); return shifted;
}
