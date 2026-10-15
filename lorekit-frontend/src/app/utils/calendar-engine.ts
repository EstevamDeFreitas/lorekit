import { renderConditionalText, validateCalendarFormatPart } from './calendar-format';
import { CalendarDate, CalendarFormat, CalendarFormatPart, CalendarPoint, CalendarRules, CalendarSide, CalendarTime, CalendarYearCount } from '../models/calendar.model';

export class CalendarValidationError extends Error {
  constructor(message: string, readonly field = '') { super(message); this.name = 'CalendarValidationError'; }
}
const fail = (message: string, field = ''): never => { throw new CalendarValidationError(message, field); };
const integer = (n: number, field: string, min = Number.MIN_SAFE_INTEGER): number =>
  Number.isSafeInteger(n) && n >= min ? n : fail('Informe um número inteiro dentro da faixa permitida.', field);
const safe = (n: number): number => integer(n, 'range');
export const calendarModulo = (n: number, divisor: number): number => ((n % divisor) + divisor) % divisor;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function defaultCalendarFormats(): CalendarFormat[] {
  const year: CalendarFormatPart[] = [{ token: 'year' }, { literal: ' ' }, { token: 'abbreviation' }];
  const month: CalendarFormatPart[] = [{ token: 'month', width: 2 }, { literal: '/' }, ...year];
  const day: CalendarFormatPart[] = [{ token: 'day', width: 2 }, { literal: '/' }, { token: 'month', width: 2 }, { literal: '/' }, { token: 'year', width: 4 }, { literal: ' ' }, { token: 'abbreviation' }];
  const time: CalendarFormatPart[] = [{ literal: ' ' }, { token: 'hour', width: 2 }, { literal: ':' }, { token: 'minute', width: 2 }, { literal: ':' }, { token: 'second', width: 2 }];
  return [
    { id: 'short', name: 'Curto', year, month, day, time },
    { id: 'narrative', name: 'Narrativo', year: [{ literal: 'ano ' }, { token: 'year' }, { literal: ' ' }, { token: 'side' }],
      month: [{ token: 'monthName' }, { literal: ', ano ' }, { token: 'year' }, { literal: ' ' }, { token: 'side' }],
      day: [{ token: 'dayOrdinal' }, { literal: ' dia do ' }, { token: 'monthName' }, { literal: ', ano ' }, { token: 'year' }, { literal: ' ' }, { token: 'side' }], time },
  ];
}
export function defaultCalendarRules(): CalendarRules {
  return {
    version: 1, months: Array.from({ length: 12 }, (_, i) => ({ id: 'month-' + (i + 1), name: 'Mês ' + (i + 1), abbreviation: 'M' + (i + 1), days: 30 })), daysPerYear: 360,
    week: { enabled: true, mode: 'continuous', anchor: 0, days: ['Primeiro', 'Segundo', 'Terceiro', 'Quarto', 'Quinto', 'Sexto', 'Sétimo'].map((name, i) => ({ id: 'weekday-' + i, name, abbreviation: name.slice(0, 3) })) },
    clock: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60, hourName: 'hora', minuteName: 'minuto', secondName: 'segundo', hourAbbreviation: 'h', minuteAbbreviation: 'min', secondAbbreviation: 's' },
    counts: [{ id: 'origin', name: 'Origem', description: '', reference: { year: 0, monthId: 'month-1', day: 1 }, beforeName: 'antes da origem', beforeAbbreviation: 'AO', afterName: 'após a origem', afterAbbreviation: 'PO', firstYear: 1 }],
    seasons: [], formats: defaultCalendarFormats(),
  };
}
export function normalizeCalendarRules(raw: unknown): CalendarRules {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Configuração de calendário inválida.');
  const value = clone(raw) as CalendarRules;
  if (value.version !== 1 || !Array.isArray(value.months) || !value.week || !value.clock || !Array.isArray(value.counts) || !Array.isArray(value.seasons) || !Array.isArray(value.formats)) fail('Versão ou configuração de calendário inválida.');
  try {
    const engine = new CalendarEngine(value);
    engine.validateRules();
    value.daysPerYear = engine.daysPerYear;
  } catch (error) {
    if (error instanceof CalendarValidationError) throw error;
    fail('Configuração de calendário inválida.');
  }
  return value;
}
export function parseCalendarRules(serialized: string): CalendarRules {
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); } catch { return fail('O calendário não contém JSON válido.'); }
  return normalizeCalendarRules(parsed);
}
/** Normalize decimal input without converting its stored representation to binary floating point. */
export function normalizeTerrestrialSeconds(value: string): string {
  const input = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(input) || !Number.isFinite(Number(input)) || Number(input) <= 0) fail('Informe uma duração positiva em segundos terrestres.', 'clock.dayDurationTerrestrialSeconds');
  const [whole, fraction = ''] = input.split('.');
  const w = whole.replace(/^0+(?=\d)/, '');
  const f = fraction.replace(/0+$/, '');
  return w + (f ? '.' + f : '');
}
export function terrestrialHoursToSeconds(hours: string): string {
  const normalized = normalizeTerrestrialSeconds(hours);
  const [whole, fraction = ''] = normalized.split('.');
  const result = (BigInt(whole + fraction) * 3600n).toString().padStart(fraction.length + 1, '0');
  return normalizeTerrestrialSeconds(fraction.length ? result.slice(0, -fraction.length) + '.' + result.slice(-fraction.length) : result);
}
export function calendarStructuralKey(rules: CalendarRules): string {
  return JSON.stringify({ months: rules.months.map(m => ({ id: m.id, days: m.days })), daysPerYear: rules.months.length ? undefined : rules.daysPerYear,
    week: { enabled: rules.week.enabled, mode: rules.week.mode, anchor: rules.week.anchor, days: rules.week.days.map(d => d.id) },
    clock: { hoursPerDay: rules.clock.hoursPerDay, minutesPerHour: rules.clock.minutesPerHour, secondsPerMinute: rules.clock.secondsPerMinute, dayDurationTerrestrialSeconds: rules.clock.dayDurationTerrestrialSeconds },
    counts: rules.counts.map(c => ({ id: c.id, reference: c.reference, firstYear: c.firstYear })), seasons: rules.seasons.map(s => ({ id: s.id, start: s.start, end: s.end })) });
}
export interface CalendarInstant { day: number; second: number; }
export interface CalendarBounds { start: CalendarInstant; end: CalendarInstant; }
export function compareCalendarInstants(a: CalendarInstant, b: CalendarInstant): number { return a.day === b.day ? a.second - b.second : a.day < b.day ? -1 : 1; }

export class CalendarEngine {
  readonly daysPerYear: number;
  readonly secondsPerDay: number;
  private readonly offsets: number[];
  constructor(readonly rules: CalendarRules) {
    this.offsets = [];
    let total = 0;
    for (const month of rules.months) { this.offsets.push(total); total = safe(total + integer(month.days, 'months.days', 1)); }
    this.daysPerYear = rules.months.length ? total : integer(rules.daysPerYear, 'daysPerYear', 1);
    this.secondsPerDay = safe(integer(rules.clock.hoursPerDay, 'clock.hoursPerDay', 1) * integer(rules.clock.minutesPerHour, 'clock.minutesPerHour', 1) * integer(rules.clock.secondsPerMinute, 'clock.secondsPerMinute', 1));
  }
  validateRules(): void {
    const names = (items: Array<{ id: string; name: string }>, field: string): void => {
      if (items.some(m => typeof m.id !== 'string' || !m.id || typeof m.name !== 'string' || !m.name.trim()) || new Set(items.map(m => m.id)).size !== items.length) fail('Informe nomes e identificadores únicos.', field);
    };
    names(this.rules.months, 'months'); names(this.rules.counts, 'counts'); names(this.rules.seasons, 'seasons'); names(this.rules.formats, 'formats');
    if (this.rules.months.some(m => typeof m.abbreviation !== 'string')) fail('Abreviação de mês inválida.', 'months');
    const week = this.rules.week;
    if (typeof week.enabled !== 'boolean' || !['continuous', 'restart'].includes(week.mode) || !Array.isArray(week.days)) fail('Configuração de semana inválida.', 'week');
    names(week.days, 'week.days');
    if (week.days.some(d => typeof d.abbreviation !== 'string')) fail('Abreviação de dia inválida.', 'week.days');
    if (week.enabled && !week.days.length) fail('Adicione pelo menos um dia à semana.', 'week.days');
    integer(week.anchor, 'week.anchor', 0);
    if (week.enabled && week.anchor >= week.days.length) fail('Escolha um dia inicial válido.', 'week.anchor');
    for (const key of ['hourName', 'minuteName', 'secondName', 'hourAbbreviation', 'minuteAbbreviation', 'secondAbbreviation'] as const) if (typeof this.rules.clock[key] !== 'string' || !this.rules.clock[key].trim()) fail('Informe o nome e a abreviação da unidade.', 'clock.' + key);
    const duration = this.rules.clock.dayDurationTerrestrialSeconds;
    if (duration !== undefined) {
      if (typeof duration !== 'string') fail('Duração terrestre inválida.');
      this.rules.clock.dayDurationTerrestrialSeconds = normalizeTerrestrialSeconds(duration);
    }
    for (const c of this.rules.counts) {
      this.toOrdinal(c.reference);
      if (c.firstYear !== 0 && c.firstYear !== 1) fail('O primeiro ano deve ser zero ou um.', 'counts');
      for (const key of ['description', 'beforeName', 'beforeAbbreviation', 'afterName', 'afterAbbreviation'] as const) if (typeof c[key] !== 'string' || (key !== 'description' && !c[key].trim())) fail('Informe nomes e abreviações para os dois lados.', 'counts');
    }
    for (const s of this.rules.seasons) {
      if (!/^#[0-9a-f]{6}$/i.test(s.color)) fail('Informe uma cor válida para a estação.', 'seasons');
      this.toOrdinal({ year: 0, ...s.start }); this.toOrdinal({ year: 0, ...s.end });
    }
    if (!this.rules.formats.length) fail('Adicione pelo menos um formato.', 'formats');
    for (const f of this.rules.formats) for (const key of ['year', 'month', 'day', 'time'] as const) {
      if (!Array.isArray(f[key])) fail('Formato de data inválido.', 'formats');
      for (const part of f[key]) {
        try { validateCalendarFormatPart(part); } catch (e) { fail(e instanceof Error ? e.message : 'Formato inválido.', 'formats'); }
      }
    }
  }
  toOrdinal(point: CalendarPoint): number {
    integer(point.year, 'year'); integer(point.day, 'day', 1);
    const index = this.rules.months.findIndex(m => m.id === point.monthId);
    if (this.rules.months.length && index < 0) fail('Selecione um mês deste calendário.', 'monthId');
    if (!this.rules.months.length && point.monthId !== undefined) fail('Este calendário não utiliza meses.', 'monthId');
    const length = index >= 0 ? this.rules.months[index].days : this.daysPerYear;
    if (point.day > length) fail('Escolha um dia entre 1 e ' + length + '.', 'day');
    return safe(safe(point.year * this.daysPerYear) + (index >= 0 ? this.offsets[index] : 0) + point.day - 1);
  }
  fromOrdinal(ordinal: number): CalendarPoint {
    integer(ordinal, 'range');
    const year = Math.floor(ordinal / this.daysPerYear);
    const dayOfYear = calendarModulo(ordinal, this.daysPerYear);
    if (!this.rules.months.length) return { year, day: dayOfYear + 1 };
    let index = this.offsets.length - 1;
    while (index > 0 && this.offsets[index] > dayOfYear) index--;
    return { year, monthId: this.rules.months[index].id, day: dayOfYear - this.offsets[index] + 1 };
  }
  validateTime(time: CalendarTime): number {
    const c = this.rules.clock;
    integer(time.hour, 'time.hour', 0); integer(time.minute, 'time.minute', 0); integer(time.second, 'time.second', 0);
    if (time.hour >= c.hoursPerDay || time.minute >= c.minutesPerHour || time.second >= c.secondsPerMinute) fail('Horário fora dos limites: horas 0–' + (c.hoursPerDay - 1) + ', minutos 0–' + (c.minutesPerHour - 1) + ', segundos 0–' + (c.secondsPerMinute - 1) + '.', 'time');
    return safe((time.hour * c.minutesPerHour + time.minute) * c.secondsPerMinute + time.second);
  }
  bounds(date: CalendarDate): CalendarBounds {
    if (date.version !== 1 || typeof date.calendarId !== 'string' || !date.calendarId || typeof date.revisionId !== 'string' || !date.revisionId) fail('Referência de calendário inválida.');
    integer(date.year, 'year');
    if (!['year', 'month', 'day'].includes(date.precision)) fail('Precisão de data inválida.', 'precision');
    if (date.precision === 'year' && (date.monthId !== undefined || date.day !== undefined)) fail('Uma data anual não pode conter mês ou dia.', 'precision');
    if (date.precision === 'month' && (!this.rules.months.length || date.day !== undefined)) fail('Precisão mensal indisponível ou com dia preenchido.', 'precision');
    if (date.time && date.precision !== 'day') fail('Defina o dia antes de informar horário.', 'time');
    const monthId = date.precision === 'year' ? this.rules.months[0]?.id : date.monthId;
    const start = this.toOrdinal({ year: date.year, monthId, day: date.precision === 'day' ? integer(date.day as number, 'day', 1) : 1 });
    let end = date.precision === 'year' ? safe(start + this.daysPerYear) : date.precision === 'month' ? safe(start + this.rules.months.find(m => m.id === date.monthId)!.days) : safe(start + 1);
    let lower = start;
    if (date.side !== undefined) {
      if (!date.countId || !['before', 'after'].includes(date.side)) fail('Contagem ou lado inválido.', 'countId');
      const ref = this.toOrdinal(this.count(date.countId).reference);
      if (date.side === 'before') end = Math.min(end, ref); else lower = Math.max(lower, ref);
      if (end <= lower) fail('Esta data não pertence ao lado escolhido do marco.', 'side');
    } else if (date.countId && !this.rules.counts.some(c => c.id === date.countId)) fail('Contagem dos anos indisponível.', 'countId');
    if (date.time) {
      const second = this.validateTime(date.time);
      return { start: { day: lower, second }, end: second + 1 === this.secondsPerDay ? { day: safe(lower + 1), second: 0 } : { day: lower, second: second + 1 } };
    }
    return { start: { day: lower, second: 0 }, end: { day: end, second: 0 } };
  }
  validateRange(start: CalendarDate, end: CalendarDate): void {
    if (start.calendarId !== end.calendarId || start.revisionId !== end.revisionId) fail('Os limites devem utilizar o mesmo calendário e revisão.');
    const a = this.bounds(start), b = this.bounds(end);
    if (compareCalendarInstants(a.start, b.start) === 0 && compareCalendarInstants(a.end, b.end) === 0) return;
    if (compareCalendarInstants(b.start, a.end) < 0) fail('O fim deve ocorrer após o início. Defina maior precisão se necessário.', 'end');
  }
  count(id?: string): CalendarYearCount {
    const count = id ? this.rules.counts.find(c => c.id === id) : this.rules.counts[0];
    return count ?? fail('Contagem dos anos indisponível.', 'countId');
  }
  countedYear(point: CalendarPoint, countId?: string): { year: number; side: CalendarSide; name: string; abbreviation: string } {
    const c = this.count(countId), ordinal = this.toOrdinal(point), anchor = this.toOrdinal(c.reference);
    const after = ordinal >= anchor;
    const partialBefore = calendarModulo(anchor, this.daysPerYear) !== 0;
    const year = after ? safe(point.year - c.reference.year + c.firstYear) : safe(c.reference.year - point.year + (partialBefore ? 1 : 0));
    return { year, side: after ? 'after' : 'before', name: after ? c.afterName : c.beforeName, abbreviation: after ? c.afterAbbreviation : c.beforeAbbreviation };
  }
  fromCountedYear(year: number, side: CalendarSide, countId?: string): number {
    const c = this.count(countId);
    integer(year, 'year', side === 'before' ? 1 : c.firstYear);
    const partialBefore = calendarModulo(this.toOrdinal(c.reference), this.daysPerYear) !== 0;
    return safe(side === 'after' ? c.reference.year + year - c.firstYear : c.reference.year - year + (partialBefore ? 1 : 0));
  }
  weekday(point: CalendarPoint): number | null {
    if (!this.rules.week.enabled) return null;
    const ordinal = this.toOrdinal(point);
    return calendarModulo(this.rules.week.mode === 'continuous' ? safe(ordinal + this.rules.week.anchor) : point.day - 1, this.rules.week.days.length);
  }
  seasons(point: CalendarPoint): CalendarRules['seasons'] {
    const day = calendarModulo(this.toOrdinal(point), this.daysPerYear);
    return this.rules.seasons.filter(s => {
      const start = this.toOrdinal({ year: 0, ...s.start }), end = this.toOrdinal({ year: 0, ...s.end });
      return start <= end ? day >= start && day <= end : day >= start || day <= end;
    });
  }
  format(date: CalendarDate, formatId?: string, countId?: string): string {
    const bounds = this.bounds(date), point = this.fromOrdinal(bounds.start.day);
    const counted = this.rules.counts.length ? this.countedYear(point, countId ?? date.countId) : { year: point.year, side: 'after' as const, name: '', abbreviation: '' };
    const format = this.rules.formats.find(f => f.id === formatId) ?? this.rules.formats[0];
    if (!format) fail('Formato indisponível.');
    const monthIndex = this.rules.months.findIndex(m => m.id === point.monthId);
    const values = { day: String(point.day), dayOrdinal: point.day + 'º', month: String(monthIndex + 1), monthName: this.rules.months[monthIndex]?.name ?? '', monthOrdinal: (monthIndex + 1) + 'º', year: String(counted.year), side: counted.name, abbreviation: counted.abbreviation,
      hour: String(date.time?.hour ?? ''), minute: String(date.time?.minute ?? ''), second: String(date.time?.second ?? '') };
    // Monthless daily forms have an explicit fallback; no guessed removal of literal separators.
    const needsMonth = format.day.some(part => 'token' in part && ['month', 'monthName', 'monthOrdinal'].includes(part.token));
    const parts = !this.rules.months.length && date.precision === 'day' && needsMonth
      ? [{ token: 'dayOrdinal' as const }, { literal: ' dia do ano ' }, ...format.year] : format[date.precision];
    const conditionalValues = {
      year: counted.year,
      ...(date.precision !== 'year' && this.rules.months.length ? { month: monthIndex + 1 } : {}),
      ...(date.precision === 'day' ? { day: point.day, dayOfYear: calendarModulo(bounds.start.day, this.daysPerYear) + 1, ...(this.rules.week.enabled ? { weekday: this.weekday(point)! + 1 } : {}) } : {}),
      ...(date.time ? { hour: date.time.hour, minute: date.time.minute, second: date.time.second } : {}),
    };
    const render = (items: CalendarFormatPart[]): string => items.map(p => 'literal' in p ? p.literal : 'conditional' in p ? renderConditionalText(p.conditional, conditionalValues) : p.width && /^\d+$/.test(values[p.token]) ? values[p.token].padStart(p.width, '0') : values[p.token]).join('');
    return (render(parts) + (date.time ? render(format.time) : '')).trim();
  }
}
export function parseCalendarDate(serialized: string | null | undefined, engine?: CalendarEngine): CalendarDate | null {
  if (!serialized) return null;
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { return fail('Data de calendário inválida.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Data de calendário inválida.');
  const date = value as CalendarDate;
  if (engine) engine.bounds(date);
  else if (date.version !== 1 || typeof date.calendarId !== 'string' || !date.calendarId || typeof date.revisionId !== 'string' || !date.revisionId || !['year', 'month', 'day'].includes(date.precision) || !Number.isSafeInteger(date.year)) fail('Data de calendário inválida.');
  return date;
}
