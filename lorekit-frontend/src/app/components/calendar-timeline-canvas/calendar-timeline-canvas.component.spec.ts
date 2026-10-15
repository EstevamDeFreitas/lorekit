import { Image } from '../../models/image.model';
import { flushPendingComponentSaves } from '../../utils/pending-save-event';
import { TestBed } from '@angular/core/testing';
import { CalendarTimelineCanvasComponent } from './calendar-timeline-canvas.component';
import { CalendarService } from '../../services/calendar.service';
import { CalendarTimelineService } from '../../services/calendar-timeline.service';
import { CalendarEngine, defaultCalendarRules } from '../../utils/calendar-engine';

describe('calendar timeline interaction', () => {
  const engine = new CalendarEngine(defaultCalendarRules());
  const binding = { calendarId: 'c', revisionId: 'r' };
  const date = { version: 1, ...binding, precision: 'day', year: 0, monthId: 'month-1', day: 1 };
  const records = Array.from({ length: 4 }, (_, i) => ({ table: 'Event', source: { id: 'event-' + i, name: 'Evento ' + i, description: '', startDate: 0, endDate: 0, calendarStartJson: JSON.stringify(date), calendarEndJson: JSON.stringify(date) } }));
  const storage = { records: () => records, saveItemDates: jasmine.createSpy(), flush: jasmine.createSpy() };
  beforeEach(() => { storage.saveItemDates.calls.reset(); storage.flush.calls.reset(); storage.flush.and.resolveTo(); TestBed.configureTestingModule({ imports: [CalendarTimelineCanvasComponent], providers: [{ provide: CalendarService, useValue: { resolve: () => ({ engine }) } }, { provide: CalendarTimelineService, useValue: storage }] }); });
  it('keeps a focal date during zoom and does not reset navigation after refresh', () => {
    const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
    fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
    const component = fixture.componentInstance; component.start.set(0); component.span.set(100);
    const focal = component.start() + component.span() * .25; component.zoom(.5, .25);
    expect(component.start() + component.span() * .25).toBe(focal);
    const start = component.start(); fixture.componentRef.setInput('refresh', 1); fixture.detectChanges();
    expect(component.start()).toBe(start); fixture.destroy();
  });
  it('groups dense events while keeping every event accessible', () => {
    const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
    fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
    const component = fixture.componentInstance, group = component.groups()[0];
    expect(group.items.length).toBe(4); component.openGroup(group); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.group-details>button').length).toBe(4);
    const edit = jasmine.createSpy('edit'); component.editItem.subscribe(edit);
    fixture.nativeElement.querySelector('.group-details>button').click();
    expect(edit).toHaveBeenCalledWith({ table: 'Event', id: 'event-0' }); fixture.destroy();
  });
  it('blocks leaving during a failed drag write and retries persistence without moving twice', async () => {
    const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
    fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
    const component = fixture.componentInstance; component.start.set(0); component.span.set(30); component.width.set(1000);
    const item = component.groups()[0].items[0];
    component.startDrag(new PointerEvent('pointerdown', { button: 0, clientX: 100 }), item);
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200 }));
    storage.flush.and.rejectWith(new Error('disk unavailable'));
    await expectAsync(flushPendingComponentSaves()).toBeRejectedWithError('disk unavailable');
    expect(component.error()).toContain('disk unavailable'); expect(storage.saveItemDates).toHaveBeenCalledTimes(1);
    storage.flush.and.resolveTo(); await flushPendingComponentSaves();
    expect(storage.saveItemDates).toHaveBeenCalledTimes(1); expect(component.error()).toBe(''); fixture.destroy();
  });

  it('keeps overlapping intervals that begin outside the viewport in an accessible group', () => {
    const previous = records.map(r => ({ ...r.source }));
    try {
      records.forEach((r, i) => { r.source.calendarStartJson = JSON.stringify({ ...date, year: -i - 1 }); r.source.calendarEndJson = JSON.stringify({ ...date, year: 2 }); });
      const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
      fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
      const component = fixture.componentInstance; component.start.set(0); component.span.set(30);
      expect(component.groups().length).toBe(1); expect(component.groups()[0].items.length).toBe(4);
      component.openGroup(component.groups()[0]); fixture.detectChanges(); expect(fixture.nativeElement.querySelectorAll('.group-details>button').length).toBe(4); fixture.destroy();
    } finally { records.forEach((r, i) => r.source = previous[i]); }
  });

  it('renders original event bars and diamonds with personalization, images and separate lanes', () => {
    const original = records.map(record => ({ ...record.source }));
    try {
      records.forEach((record, i) => Object.assign(record.source, { lane: i, Personalization: { contentJson: JSON.stringify({ color: '#aabbcc', icon: 'fa-book' }) }, Images: [new Image('image', 'default', 'data:image/png;base64,aA==')], calendarEndJson: JSON.stringify(i === 0 ? { ...date, day: 20 } : date) }));
      const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
      fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
      const component = fixture.componentInstance; component.start.set(0); component.span.set(30); component.width.set(1000); fixture.detectChanges();
      const bars = fixture.nativeElement.querySelectorAll('.event-bar.timeline-interactive-item');
      expect(bars.length).toBe(4); expect(bars[0].classList.contains('compact-event')).toBeFalse();
      expect(bars[1].classList.contains('compact-event')).toBeTrue();
      expect(bars[0].style.getPropertyValue('--event-color')).toBe('#aabbcc');
      expect(bars[0].style.backgroundImage).toContain('data:image/png');
      expect(bars[1].querySelector('.compact-event-icon').classList.contains('fa-book')).toBeTrue();
      expect(bars[0].style.top).not.toBe(bars[1].style.top);
      expect(bars[0].querySelectorAll('.range-handle').length).toBe(2);
      const edit = jasmine.createSpy(); component.editItem.subscribe(edit);
      bars[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); expect(edit).toHaveBeenCalledWith({ table: 'Event', id: 'event-1' }); fixture.destroy();
    } finally { records.forEach((record, i) => { record.source = original[i]; }); }
  });

  it('resizes one calendar boundary and preserves the other date', async () => {
    const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
    fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
    const component = fixture.componentInstance; component.start.set(0); component.span.set(30); component.width.set(1000);
    const item = component.groups()[0].items[0];
    component.startDrag(new PointerEvent('pointerdown', { button: 0, clientX: 100 }), item, 'end');
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200 })); await flushPendingComponentSaves();
    const args = storage.saveItemDates.calls.mostRecent().args;
    expect(args[3]).toEqual(item.start); expect(args[4].day).toBe(4); fixture.destroy();
  });

  it('renders marks with the original circular marker and periods as range bars', () => {
    records.push({ table: 'GreatMark', source: { ...records[0].source, id: 'mark', name: 'Marco' } }, { table: 'Age', source: { ...records[0].source, id: 'age', name: 'Período' } });
    try {
      const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
      fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.great-mark .great-mark-dot')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.age-bar .range-handle.end')).not.toBeNull(); fixture.destroy();
    } finally { records.splice(-2); }
  });

  it('reveals a dense group when focusing one of its events from the index', () => {
    const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
    fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
    fixture.componentInstance.focusItem('Event', 'event-2'); fixture.detectChanges();
    expect(fixture.componentInstance.group()?.items.some(item => item.source.id === 'event-2')).toBeTrue(); fixture.destroy();
  });

  it('expands a point using the rendered end handle and previews the new bar before saving', async () => {
    const rest = records.splice(1);
    const original = { ...records[0].source };
    const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
    try {
      fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
      const component = fixture.componentInstance; component.start.set(0); component.span.set(30); component.width.set(1000); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.event-bar').classList.contains('compact-event')).toBeTrue();
      fixture.nativeElement.querySelector('.event-bar .range-handle.end').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 300 })); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.event-bar').classList.contains('compact-event')).toBeFalse();
      expect(storage.saveItemDates).not.toHaveBeenCalled();
      await flushPendingComponentSaves();
      const args = storage.saveItemDates.calls.mostRecent().args;
      expect(args[3].day).toBe(1); expect(args[4].day).toBe(7);
    } finally { fixture.destroy(); records[0].source = original; records.push(...rest); }
  });

  it('collapses a calendar interval to one date when its end is dragged beyond the start', async () => {
    const rest = records.splice(1), original = { ...records[0].source };
    records[0].source.calendarEndJson = JSON.stringify({ ...date, day: 10 });
    const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
    try {
      fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
      const component = fixture.componentInstance; component.start.set(0); component.span.set(30); component.width.set(1000); fixture.detectChanges();
      fixture.nativeElement.querySelector('.event-bar .range-handle.end').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 500 }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0 })); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.event-bar').classList.contains('compact-event')).toBeTrue();
      await flushPendingComponentSaves();
      const args = storage.saveItemDates.calls.mostRecent().args;
      expect(args[4]).toEqual(args[3]); expect(component.error()).toBe('');
    } finally { fixture.destroy(); records[0].source = original; records.push(...rest); }
  });

  it('resizes monthly events across months of different lengths without enforcing a fixed duration', async () => {
    const rules = defaultCalendarRules(); rules.months[0].days = 40; rules.months[1].days = 20;
    const monthlyEngine = new CalendarEngine(rules);
    TestBed.inject(CalendarService).resolve = () => ({ engine: monthlyEngine } as ReturnType<CalendarService['resolve']>);
    const rest = records.splice(1), original = { ...records[0].source };
    const monthly = { version: 1, ...binding, precision: 'month', year: 0, monthId: 'month-1' };
    records[0].source.calendarStartJson = JSON.stringify(monthly); records[0].source.calendarEndJson = JSON.stringify(monthly);
    const fixture = TestBed.createComponent(CalendarTimelineCanvasComponent);
    try {
      fixture.componentRef.setInput('timeline', { id: 't', calendarId: 'c', calendarRevisionId: 'r' }); fixture.detectChanges();
      const component = fixture.componentInstance; component.start.set(0); component.span.set(100); component.width.set(1000); fixture.detectChanges();
      fixture.nativeElement.querySelector('.event-bar .range-handle.end').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 400 }));
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 800 })); await flushPendingComponentSaves();
      const args = storage.saveItemDates.calls.mostRecent().args;
      expect(args[3]).toEqual(monthly); expect(args[4].monthId).toBe('month-2'); expect(args[4].precision).toBe('month'); expect(component.error()).toBe('');
    } finally { fixture.destroy(); records[0].source = original; records.push(...rest); }
  });

});
