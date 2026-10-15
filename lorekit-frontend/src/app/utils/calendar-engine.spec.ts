import { CalendarDate, CalendarRules, CalendarConditionalText } from '../models/calendar.model';
import { CalendarEngine, CalendarValidationError, calendarStructuralKey, defaultCalendarRules, normalizeCalendarRules, normalizeTerrestrialSeconds, parseCalendarDate, parseCalendarRules, terrestrialHoursToSeconds } from './calendar-engine';

describe('custom calendar engine', () => {
  let rules: CalendarRules;
  const date = (year: number, day = 1, monthId = 'month-1'): CalendarDate => ({ version: 1, calendarId: 'calendar', revisionId: 'revision', precision: 'day', year, monthId, day });
  beforeEach(() => { rules = defaultCalendarRules(); });

  it('normalizes annual totals while rejecting malformed and unsafe rules', () => {
    rules.daysPerYear = 999;
    expect(normalizeCalendarRules(rules).daysPerYear).toBe(360);
    expect(() => parseCalendarRules('{invalid')).toThrowError(CalendarValidationError);
    expect(() => normalizeCalendarRules({ ...rules, version: 2 })).toThrowError(CalendarValidationError);
    expect(() => normalizeCalendarRules({ ...rules, months: [null] })).toThrowError(CalendarValidationError);
    rules.months[0].days = Number.MAX_SAFE_INTEGER;
    expect(() => normalizeCalendarRules(rules)).toThrowError(CalendarValidationError);
  });
  it('round-trips negative years and variable months without rounding', () => {
    rules.months = rules.months.slice(0, 3);
    rules.months[0].days = 40; rules.months[1].days = 40; rules.months[2].days = 20;
    const engine = new CalendarEngine(rules);
    expect(engine.daysPerYear).toBe(100);
    for (let ordinal = -1001; ordinal <= 1001; ordinal++) expect(engine.toOrdinal(engine.fromOrdinal(ordinal))).toBe(ordinal);
    expect(engine.fromOrdinal(-1)).toEqual({ year: -1, monthId: 'month-3', day: 20 });
    expect(() => engine.toOrdinal({ year: 1.5, monthId: 'month-1', day: 1 })).toThrow();
    expect(() => engine.toOrdinal({ year: Number.MAX_SAFE_INTEGER, monthId: 'month-1', day: 1 })).toThrow();
  });
  it('supports monthless years and rejects monthly precision', () => {
    rules.months = []; rules.daysPerYear = 400;
    const engine = new CalendarEngine(rules);
    expect(engine.fromOrdinal(-1)).toEqual({ year: -1, day: 400 });
    expect(engine.toOrdinal({ year: 1, day: 1 })).toBe(400);
    expect(() => engine.bounds({ ...date(0), precision: 'month', day: undefined })).toThrow();
    expect(() => engine.toOrdinal({ year: 0, day: 401 })).toThrow();
  });
  it('handles continuous and restart weeks at month and year boundaries', () => {
    rules.week.days = rules.week.days.slice(0, 5); rules.months[0].days = 37;
    const continuous = new CalendarEngine(rules);
    expect(continuous.weekday({ year: 0, monthId: 'month-1', day: 37 })).toBe(1);
    expect(continuous.weekday({ year: 0, monthId: 'month-2', day: 1 })).toBe(2);
    expect(continuous.weekday(continuous.fromOrdinal(-1))).toBe(4);
    rules.week.mode = 'restart';
    expect(new CalendarEngine(rules).weekday({ year: 0, monthId: 'month-2', day: 1 })).toBe(0);
    rules.months = []; rules.daysPerYear = 37;
    expect(new CalendarEngine(rules).weekday({ year: 1, day: 1 })).toBe(0);
    rules.week.enabled = false;
    expect(new CalendarEngine(rules).weekday({ year: 1, day: 1 })).toBeNull();
  });
  it('keeps local time independent from terrestrial duration with exact decimal conversion', () => {
    rules.clock.hoursPerDay = 30; rules.clock.dayDurationTerrestrialSeconds = terrestrialHoursToSeconds('36');
    const engine = new CalendarEngine(rules);
    expect(engine.secondsPerDay).toBe(108000);
    expect(Number(rules.clock.dayDurationTerrestrialSeconds) / 30 / 60).toBe(72);
    expect(terrestrialHoursToSeconds('0.0001')).toBe('0.36');
    expect(normalizeTerrestrialSeconds('0001,2300')).toBe('1.23');
    expect(engine.validateTime({ hour: 29, minute: 59, second: 59 })).toBe(107999);
    expect(() => engine.validateTime({ hour: 30, minute: 0, second: 0 })).toThrow();
    expect(() => engine.validateTime({ hour: 0, minute: -1, second: 0 })).toThrow();
    expect(() => normalizeTerrestrialSeconds('Infinity')).toThrow();
    expect(() => normalizeTerrestrialSeconds('0')).toThrow();
  });
  it('distinguishes a whole day from midnight and clips partial reference years', () => {
    const engine = new CalendarEngine(rules);
    expect(engine.bounds(date(0)).end).toEqual({ day: 1, second: 0 });
    expect(engine.bounds({ ...date(0), time: { hour: 0, minute: 0, second: 0 } }).end).toEqual({ day: 0, second: 1 });
    expect(engine.bounds({ ...date(0), time: { hour: 23, minute: 59, second: 59 } }).end).toEqual({ day: 1, second: 0 });
    rules.counts[0].reference.day = 15;
    const reference = new CalendarEngine(rules);
    const annual: CalendarDate = { version: 1, calendarId: 'c', revisionId: 'r', precision: 'year', year: 0, countId: 'origin', side: 'before' };
    expect(reference.bounds(annual).end.day).toBe(14);
    expect(reference.bounds({ ...annual, side: 'after' }).start.day).toBe(14);
    expect(() => reference.bounds({ ...date(0, 1), countId: 'origin', side: 'after' })).toThrow();
    expect(() => engine.bounds({ ...annual, monthId: 'month-1' })).toThrow();
    expect(() => engine.bounds({ ...annual, time: { hour: 0, minute: 0, second: 0 } })).toThrow();
  });
  it('validates ranges without inventing a precise order for overlapping partial dates', () => {
    const engine = new CalendarEngine(rules);
    expect(() => engine.validateRange(date(0, 1), date(0, 3))).not.toThrow();
    expect(() => engine.validateRange(date(0, 1), date(0, 1))).not.toThrow();
    expect(() => engine.validateRange(date(0, 3), date(0, 1))).toThrow();
    const annual: CalendarDate = { version: 1, calendarId: 'calendar', revisionId: 'revision', precision: 'year', year: 0 };
    expect(() => engine.validateRange(annual, date(0, 20))).toThrow();
    expect(() => engine.validateRange(annual, { ...annual, year: 1 })).not.toThrow();
    expect(() => engine.validateRange(date(0), { ...date(1), revisionId: 'different' })).toThrow();
  });
  it('round-trips year labels on both sides of start-year and mid-year references', () => {
    for (const referenceDay of [1, 15]) for (const firstYear of [0, 1] as const) {
      rules.counts[0].reference = { year: 3, monthId: 'month-1', day: referenceDay };
      rules.counts[0].firstYear = firstYear;
      const engine = new CalendarEngine(rules);
      for (let ordinal = -721; ordinal < 2000; ordinal += 7) {
        const point = engine.fromOrdinal(ordinal), counted = engine.countedYear(point);
        expect(engine.fromCountedYear(counted.year, counted.side)).toBe(point.year);
        if (counted.side === 'before') expect(counted.year).toBeGreaterThan(0);
      }
      expect(() => engine.fromCountedYear(0, 'before')).toThrow();
    }
  });
  it('formats short and narrative dates using variants for partial precision', () => {
    rules.months[5].days = 40; rules.months[5].name = 'Sexto mês';
    rules.counts[0].afterName = 'pós-revolução'; rules.counts[0].afterAbbreviation = 'PR';
    const engine = new CalendarEngine(rules), value = date(3, 37, 'month-6');
    expect(engine.format(value, 'short')).toBe('37/06/0004 PR');
    expect(engine.format(value, 'narrative')).toBe('37º dia do Sexto mês, ano 4 pós-revolução');
    expect(engine.format({ ...value, precision: 'year', monthId: undefined, day: undefined }, 'narrative')).toBe('ano 4 pós-revolução');
    expect(engine.format(date(99999), 'short')).toContain('100000');
    rules.formats[0].day = [{ token: 'unknown' } as never];
    expect(() => normalizeCalendarRules(rules)).toThrow();
  });
  it('finds overlapping seasons including both sides of the annual boundary', () => {
    rules.seasons = [
      { id: 'winter', name: 'Inverno', color: '#60a5fa', start: { monthId: 'month-12', day: 20 }, end: { monthId: 'month-2', day: 10 } },
      { id: 'rains', name: 'Chuvas', color: '#4ade80', start: { monthId: 'month-1', day: 1 }, end: { monthId: 'month-1', day: 10 } },
    ];
    const engine = new CalendarEngine(rules);
    expect(engine.seasons({ year: -3, monthId: 'month-1', day: 10 }).map(s => s.id)).toEqual(['winter', 'rains']);
    expect(engine.seasons({ year: 0, monthId: 'month-12', day: 20 }).map(s => s.id)).toEqual(['winter']);
    expect(engine.seasons({ year: 0, monthId: 'month-6', day: 1 })).toEqual([]);
  });
  it('separates presentation changes from structural revisions and validates date JSON', () => {
    const oldKey = calendarStructuralKey(rules);
    rules.months[0].name = 'Aurora'; rules.counts[0].afterName = 'da Fundação';
    expect(calendarStructuralKey(rules)).toBe(oldKey);
    rules.months[0].days++;
    expect(calendarStructuralKey(rules)).not.toBe(oldKey);
    expect(() => parseCalendarDate('"text"')).toThrow();
    expect(() => parseCalendarDate('{"version":2}')).toThrow();
    expect(parseCalendarDate('')).toBeNull();
    expect(parseCalendarDate(JSON.stringify(date(0)), new CalendarEngine(rules))).toEqual(date(0));
  });
  it('evaluates conditional text at the day boundary without executing user text', () => {
    const conditional: CalendarConditionalText = { mode: 'all', conditions: [{ field: 'day', operator: 'lt', value: 13 }], whenTrue: 'Dia de luz', whenFalse: 'Dia da noite' };
    rules.formats[0].day = [{ conditional }]; const engine = new CalendarEngine(rules);
    expect(engine.format(date(0, 12))).toBe('Dia de luz'); expect(engine.format(date(0, 13))).toBe('Dia da noite'); expect(engine.format(date(0, 14))).toBe('Dia da noite');
    conditional.conditions[0].operator = 'lte'; expect(engine.format(date(0, 13))).toBe('Dia de luz');
    conditional.whenTrue = '<script>alert(1)</script>'; expect(engine.format(date(0, 1))).toBe('<script>alert(1)</script>');
  });
  it('combines AND/OR conditions and distinguishes missing day or time from a false rule', () => {
    const conditional: CalendarConditionalText = { mode: 'all', conditions: [{ field: 'day', operator: 'lt', value: 13 }, { field: 'hour', operator: 'between', value: 6, end: 18 }], whenTrue: 'Luz', whenFalse: 'Noite', whenUnknown: 'Horário desconhecido' };
    rules.formats[0].day = [{ conditional }]; rules.formats[0].year = [{ conditional }]; const engine = new CalendarEngine(rules);
    expect(engine.format(date(0, 12))).toBe('Horário desconhecido');
    expect(engine.format({ ...date(0, 12), time: { hour: 10, minute: 0, second: 0 } })).toContain('Luz');
    expect(engine.format(date(0, 20))).toBe('Noite');
    expect(engine.format({ version: 1, calendarId: 'c', revisionId: 'r', precision: 'year', year: 0 })).toBe('Horário desconhecido');
    conditional.mode = 'any'; expect(engine.format(date(0, 12))).toBe('Luz'); expect(engine.format(date(0, 20))).toBe('Horário desconhecido');
  });
  it('supports monthless day rules, weekday and displayed year comparisons', () => {
    rules.months = []; rules.daysPerYear = 400; rules.counts[0].reference = { year: 0, day: 1 };
    rules.formats[0].day = [{ conditional: { mode: 'all', conditions: [{ field: 'dayOfYear', operator: 'between', value: 10, end: 20 }, { field: 'weekday', operator: 'eq', value: 5 }, { field: 'year', operator: 'eq', value: 1 }], whenTrue: 'Celebração', whenFalse: 'Dia comum' } }];
    const engine = new CalendarEngine(rules);
    expect(engine.format({ version: 1, calendarId: 'c', revisionId: 'r', precision: 'day', year: 0, day: 12 })).toBe('Celebração');
  });
  it('rejects malformed predicates, reversed ranges and executable expressions', () => {
    const rule = { conditional: { mode: 'all', conditions: [{ field: 'day', operator: 'between', value: 20, end: 10 }], whenTrue: 'A', whenFalse: 'B' } };
    const raw = JSON.parse(JSON.stringify(rules)); raw.formats[0].day = [rule]; expect(() => normalizeCalendarRules(raw)).toThrowError(/intervalo/);
    rule.conditional.conditions[0] = { field: 'day', operator: 'eval', value: 1, end: 2 }; raw.formats[0].day = [rule]; expect(() => normalizeCalendarRules(raw)).toThrowError(/desconhecidos/);
    raw.formats[0].day = [{ conditional: { mode: 'all', conditions: [], whenTrue: 'A', whenFalse: 'B' } }]; expect(() => normalizeCalendarRules(raw)).toThrowError(/1 e 20/);
  });

});
