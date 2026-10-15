import { portableFormatPart } from './calendar-format';
import { CalendarRules } from '../models/calendar.model';
import { normalizeCalendarRules } from './calendar-engine';

/** IDs inside a rules document are stable only within that document, never database identities. */
export function portableCalendarRules(rules: CalendarRules): CalendarRules {
  const normalized = normalizeCalendarRules(rules);
  const point = (p: { monthId?: string; day: number }) => ({ ...(p.monthId ? { monthId: p.monthId } : {}), day: p.day });
  const parts = (items: CalendarRules['formats'][number]['year']) => items.map(portableFormatPart);
  const c = normalized.clock;
  const value: CalendarRules = {
    version: 1, daysPerYear: normalized.daysPerYear,
    months: normalized.months.map(m => ({ id: m.id, name: m.name, abbreviation: m.abbreviation, days: m.days })),
    week: { enabled: normalized.week.enabled, mode: normalized.week.mode, anchor: normalized.week.anchor, days: normalized.week.days.map(d => ({ id: d.id, name: d.name, abbreviation: d.abbreviation })) },
    clock: { hoursPerDay: c.hoursPerDay, minutesPerHour: c.minutesPerHour, secondsPerMinute: c.secondsPerMinute, hourName: c.hourName, minuteName: c.minuteName, secondName: c.secondName, hourAbbreviation: c.hourAbbreviation, minuteAbbreviation: c.minuteAbbreviation, secondAbbreviation: c.secondAbbreviation, ...(c.dayDurationTerrestrialSeconds ? { dayDurationTerrestrialSeconds: c.dayDurationTerrestrialSeconds } : {}) },
    counts: normalized.counts.map(c => ({ id: c.id, name: c.name, description: c.description, reference: { year: c.reference.year, ...point(c.reference) }, beforeName: c.beforeName, beforeAbbreviation: c.beforeAbbreviation, afterName: c.afterName, afterAbbreviation: c.afterAbbreviation, firstYear: c.firstYear })),
    seasons: normalized.seasons.map(s => ({ id: s.id, name: s.name, color: s.color, start: point(s.start), end: point(s.end) })),
    formats: normalized.formats.map(f => ({ id: f.id, name: f.name, year: parts(f.year), month: parts(f.month), day: parts(f.day), time: parts(f.time) })),
  };
  const months = new Map(value.months.map((m, i) => [m.id, 'month-' + (i + 1)]));
  value.months.forEach(m => { m.id = months.get(m.id)!; });
  value.week.days.forEach((day, i) => { day.id = 'weekday-' + (i + 1); });
  value.counts.forEach((count, i) => { count.id = 'count-' + (i + 1); if (count.reference.monthId) count.reference.monthId = months.get(count.reference.monthId); delete count.sourceAgeId; });
  value.seasons.forEach((season, i) => { season.id = 'season-' + (i + 1); if (season.start.monthId) season.start.monthId = months.get(season.start.monthId); if (season.end.monthId) season.end.monthId = months.get(season.end.monthId); });
  value.formats.forEach((format, i) => { format.id = 'format-' + (i + 1); });
  return value;
}
export function calendarRuleDifferences(source: CalendarRules, target: CalendarRules): string[] {
  const a = portableCalendarRules(source), b = portableCalendarRules(target), result: string[] = [];
  if (JSON.stringify(a.months) !== JSON.stringify(b.months) || a.daysPerYear !== b.daysPerYear) result.push('Meses, nomes ou dias do ano diferentes');
  if (JSON.stringify(a.week) !== JSON.stringify(b.week)) result.push('Semana diferente');
  if (JSON.stringify(a.clock) !== JSON.stringify(b.clock)) result.push('Relógio ou duração do dia diferente');
  if (JSON.stringify(a.counts) !== JSON.stringify(b.counts)) result.push('Contagem dos anos diferente');
  if (JSON.stringify(a.seasons) !== JSON.stringify(b.seasons)) result.push('Estações diferentes');
  if (JSON.stringify(a.formats) !== JSON.stringify(b.formats)) result.push('Formatos diferentes');
  return result;
}
