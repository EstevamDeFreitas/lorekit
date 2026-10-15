import { CalendarDate } from '../models/calendar.model';
import { CalendarEngine, defaultCalendarRules } from './calendar-engine';
import { availableCalendarScales, calendarTicks, moveCalendarDates } from './calendar-timeline-layout';

describe('calendar timeline layout', () => {
  const date = (year: number, day = 1, monthId = 'month-1'): CalendarDate => ({ version: 1, calendarId: 'c', revisionId: 'r', precision: 'day', year, monthId, day });
  it('uses actual month boundaries and omits unavailable scales', () => {
    const rules = defaultCalendarRules(); rules.months = rules.months.slice(0, 3); rules.months[0].days = 40; rules.months[1].days = 40; rules.months[2].days = 20;
    const engine = new CalendarEngine(rules), ticks = calendarTicks(engine, 0, 100, 'month');
    expect(ticks.map(t => t.day)).toEqual([0, 40, 80, 100]);
    expect((ticks[1].day - ticks[0].day) / (ticks[3].day - ticks[2].day)).toBe(2);
    rules.months = []; rules.daysPerYear = 400; rules.week.enabled = false;
    expect(availableCalendarScales(new CalendarEngine(rules))).toEqual(['century', 'decade', 'year', 'day']);
  });
  it('generates only visible divisions even thousands of years from the origin', () => {
    const engine = new CalendarEngine(defaultCalendarRules()), start = engine.daysPerYear * 500_000;
    const ticks = calendarTicks(engine, start, start + 20, 'day');
    expect(ticks.length).toBe(21); expect(ticks[0].day).toBe(start);
    expect(calendarTicks(engine, 0, engine.daysPerYear * 10000, 'day').length).toBeLessThanOrEqual(300);
  });
  it('respects before/after century boundaries and partial origin years without invented zero', () => {
    const rules = defaultCalendarRules(), engine = new CalendarEngine(rules), year = engine.daysPerYear;
    const ticks = calendarTicks(engine, -200 * year, 200 * year, 'century');
    expect(ticks.find(t => t.day === 0)!.label).toBe('Século 1 PO');
    expect(ticks.find(t => t.day === -100 * year)!.label).toBe('Século 1 AO');
    expect(ticks.find(t => t.day === 100 * year)!.label).toBe('Século 2 PO');
    rules.counts[0].reference.day = 15;
    const partial = calendarTicks(new CalendarEngine(rules), 0, year, 'year');
    expect(partial.find(t => t.day === 0)!.label).toBe('1 AO');
    expect(partial.find(t => t.day === 14)!.label).toBe('1 PO');
  });
  it('splits restart weeks at month boundaries', () => {
    const rules = defaultCalendarRules(); rules.week.mode = 'restart'; rules.months[0].days = 10;
    const ticks = calendarTicks(new CalendarEngine(rules), 0, 20, 'week');
    expect(ticks.map(t => t.day)).toEqual([0, 7, 10, 17]);
  });
  it('preserves exact day and subday intervals when moving', () => {
    const engine = new CalendarEngine(defaultCalendarRules()), start = { ...date(0, 29), time: { hour: 2, minute: 30, second: 0 } }, end = { ...date(0, 1, 'month-2'), time: { hour: 4, minute: 0, second: 0 } };
    const moved = moveCalendarDates(engine, start, end, 5);
    expect(moved.start.day).toBe(4); expect(moved.start.monthId).toBe('month-2'); expect(moved.start.time).toEqual(start.time);
    expect(engine.bounds(moved.end).end.day - engine.bounds(moved.start).start.day).toBe(engine.bounds(end).end.day - engine.bounds(start).start.day);
  });
  it('preserves annual precision and blocks monthly moves that change duration', () => {
    const rules = defaultCalendarRules(); rules.months[0].days = 40; rules.months[1].days = 20;
    const engine = new CalendarEngine(rules), annual: CalendarDate = { version: 1, calendarId: 'c', revisionId: 'r', precision: 'year', year: 0 };
    const moved = moveCalendarDates(engine, annual, { ...annual, year: 2 }, engine.daysPerYear);
    expect(moved.start).toEqual({ ...annual, year: 1 }); expect(moved.end.year).toBe(3);
    const monthly: CalendarDate = { ...annual, precision: 'month', monthId: 'month-1' };
    expect(() => moveCalendarDates(engine, monthly, monthly, 40)).toThrowError(/duração ou a precisão/);
  });
  it('samples months and restart weeks across a narrow viewport instead of truncating its beginning', () => {
    const rules = defaultCalendarRules(); rules.week.mode = 'restart'; const engine = new CalendarEngine(rules);
    expect(calendarTicks(engine, 0, 360, 'month', undefined, 4).map(t => t.day)).toEqual([0, 120, 240, 360]);
    const weeks = calendarTicks(engine, -360, 360, 'week', undefined, 4);
    expect(weeks.length).toBeLessThanOrEqual(4); expect(weeks.at(-1)!.day).toBeGreaterThan(0);
  });

});
