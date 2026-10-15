import { TestBed } from '@angular/core/testing';
import { CalendarEventDatesComponent } from './calendar-event-dates.component';
import { CalendarService } from '../../services/calendar.service';
import { CalendarTimelineService } from '../../services/calendar-timeline.service';
import { CalendarEngine, defaultCalendarRules } from '../../utils/calendar-engine';
import { CalendarDate } from '../../models/calendar.model';

describe('structured event dates', () => {
  const engine = new CalendarEngine(defaultCalendarRules()), binding = { calendarId: 'c', revisionId: 'r' };
  beforeEach(() => TestBed.configureTestingModule({ imports: [CalendarEventDatesComponent], providers: [
    { provide: CalendarService, useValue: { resolve: () => ({ engine }) } },
    { provide: CalendarTimelineService, useValue: { timeline: () => ({ id: 't', calendarId: 'c', calendarRevisionId: 'r' }), projection: () => null } },
  ] }));
  it('applies a suggested annual date without inventing its day or time', () => {
    const fixture = TestBed.createComponent(CalendarEventDatesComponent), emit = jasmine.createSpy();
    fixture.componentRef.setInput('timelineId', 't'); fixture.componentRef.setInput('defaultDate', { version: 1, ...binding, precision: 'year', year: -4 }); fixture.componentInstance.datesChange.subscribe(emit); fixture.detectChanges();
    const saved = JSON.parse(emit.calls.mostRecent().args[0].start);
    expect(saved.precision).toBe('year'); expect(saved.year).toBe(-4); expect(saved.day).toBeUndefined(); expect(saved.time).toBeUndefined(); fixture.destroy();
  });
  it('keeps the last valid interval when an attempted end precedes the start', () => {
    const fixture = TestBed.createComponent(CalendarEventDatesComponent), emit = jasmine.createSpy();
    const date: CalendarDate = { version: 1, ...binding, precision: 'day', year: 2, monthId: 'month-1', day: 10 };
    fixture.componentRef.setInput('timelineId', 't'); fixture.componentRef.setInput('startJson', JSON.stringify(date)); fixture.componentRef.setInput('endJson', JSON.stringify({ ...date, year: 3 })); fixture.componentInstance.datesChange.subscribe(emit); fixture.detectChanges();
    fixture.componentInstance.update('end', { ...date, year: 1 }); expect(emit).not.toHaveBeenCalled(); expect(fixture.componentInstance.error()).toBeTruthy();
    fixture.componentInstance.update('end', { ...date, year: 4, time: { hour: 2, minute: 3, second: 4 } }); expect(emit).toHaveBeenCalled(); expect(JSON.parse(emit.calls.mostRecent().args[0].end).time.hour).toBe(2); fixture.destroy();
  });
});
