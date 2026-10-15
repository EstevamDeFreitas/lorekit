import { TestBed } from '@angular/core/testing';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { CalendarTimelineConfigComponent } from './calendar-timeline-config.component';
import { DbProvider } from '../../database/db-provider.service';
import { ensureSchema } from '../../database/database.helper';
import { runLocalMigrations } from '../../database/local-migrations';
import { CalendarService } from '../../services/calendar.service';
import { CalendarTimelineService } from '../../services/calendar-timeline.service';
import { ConfirmService } from '../confirm-dialog/confirm-dialog.component';
import { defaultCalendarRules } from '../../utils/calendar-engine';

describe('calendar conversion wizard', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>, provider: DbProvider, calendars: CalendarService, calendarId: string;
  beforeAll(async () => { SQL = await initSqlJs({ locateFile: file => 'assets/' + file }); });
  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [CalendarTimelineConfigComponent], providers: [DbProvider, CalendarService, CalendarTimelineService, { provide: ConfirmService, useValue: { ask: async () => true } }] });
    provider = TestBed.inject(DbProvider); const db = new SQL.Database(); ensureSchema(db); runLocalMigrations(db); provider.setDb(db, async () => {});
    const crud = provider.getCrudHelper(); crud.create('World', { id: 'world', name: 'Mundo', description: '' }); crud.create('Timeline', { id: 'timeline', name: 'História', description: '' });
    crud.create('Relationship', { parentTable: 'World', parentId: 'world', entityTable: 'Timeline', entityId: 'timeline' });
    crud.create('Event', { id: 'event', name: 'Fundação', description: 'Original', startDate: 1, endDate: 1, date: 'Na aurora' });
    crud.create('Relationship', { parentTable: 'Timeline', parentId: 'timeline', entityTable: 'Event', entityId: 'event' });
    calendars = TestBed.inject(CalendarService); const saved = await calendars.save({ id: '', worldId: 'world', name: 'Imperial', description: '', latestRevisionId: '' }, defaultCalendarRules()); calendarId = saved.calendar.id;
  });
  afterEach(async () => { await provider.flushPendingWrites(); provider.close(); });
  it('allows cancelling every step without writing proposed dates', () => {
    for (let step = 0; step < 4; step++) {
      const fixture = TestBed.createComponent(CalendarTimelineConfigComponent); fixture.componentRef.setInput('timelineId', 'timeline'); fixture.detectChanges();
      const component = fixture.componentInstance; component.selectCalendar(calendarId); for (let n = 0; n < step; n++) component.next(); fixture.detectChanges();
      expect(component.step()).toBe(step); const cancelled = jasmine.createSpy(); component.cancelled.subscribe(cancelled);
      const button = [...fixture.nativeElement.querySelectorAll('footer button')].find((b: unknown) => (b as HTMLButtonElement).textContent === 'Cancelar') as HTMLButtonElement; button.click();
      expect(cancelled).toHaveBeenCalled(); expect(provider.getCrudHelper().findById('Timeline', 'timeline').calendarId).toBeNull(); expect(provider.getCrudHelper().findById('Event', 'event').calendarStartJson).toBeNull(); fixture.destroy();
    }
  });
  it('blocks fractional positions until reviewed and commits only after final confirmation', async () => {
    provider.getCrudHelper().update('Event', 'event', { startDate: 1.5 });
    const fixture = TestBed.createComponent(CalendarTimelineConfigComponent); fixture.componentRef.setInput('timelineId', 'timeline'); fixture.detectChanges();
    const component = fixture.componentInstance; component.selectCalendar(calendarId); component.next(); component.next();
    expect(component.step()).toBe(1); expect(component.error()).toContain('fracionária');
    const item = component.plan()!.items[0], date = { ...component.referenceDate()!, year: 2 };
    component.change(item, 'start', date); component.change(item, 'end', date); component.next(); component.next(); fixture.detectChanges();
    expect(component.step()).toBe(3); expect(provider.getCrudHelper().findById('Timeline', 'timeline').calendarId).toBeNull();
    await component.apply(); expect(provider.getCrudHelper().findById('Timeline', 'timeline').calendarId).toBe(calendarId); expect(provider.getCrudHelper().findById('Event', 'event').date).toBe('Na aurora'); fixture.destroy();
  });
});
