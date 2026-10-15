import { TestBed } from '@angular/core/testing';
import { CalendarDatePickerComponent } from './calendar-date-picker.component';
import { CalendarService } from '../../services/calendar.service';
import { defaultCalendarRules } from '../../utils/calendar-engine';

describe('calendar date picker', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [CalendarDatePickerComponent], providers: [{ provide: CalendarService, useValue: {} }] }));
  it('keeps invalid input from replacing a saved value and emits only selected precision', () => {
    const fixture = TestBed.createComponent(CalendarDatePickerComponent);
    fixture.componentRef.setInput('rules', defaultCalendarRules()); fixture.componentRef.setInput('binding', { calendarId: 'c', revisionId: 'r' });
    fixture.detectChanges();
    const component = fixture.componentInstance, changes = jasmine.createSpy('change'); component.valueChange.subscribe(changes);
    component.form.controls.day.setValue(37); component.apply(); fixture.detectChanges();
    expect(changes).not.toHaveBeenCalled(); expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('30');
    component.form.controls.precision.setValue('year'); component.apply();
    expect(changes.calls.mostRecent().args[0]).toEqual({ version: 1, calendarId: 'c', revisionId: 'r', precision: 'year', year: 0, countId: 'origin', side: 'after' });
  });
  it('distinguishes optional midnight, handles monthless controls, and clears without a default', () => {
    const fixture = TestBed.createComponent(CalendarDatePickerComponent), rules = defaultCalendarRules();
    rules.months = []; rules.daysPerYear = 400; rules.counts[0].reference = { year: 0, day: 1 };
    fixture.componentRef.setInput('rules', rules); fixture.componentRef.setInput('binding', { calendarId: 'c', revisionId: 'r' }); fixture.componentRef.setInput('allowTime', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select[formControlName="monthId"]')).toBeNull();
    const component = fixture.componentInstance, changes = jasmine.createSpy('change'); component.valueChange.subscribe(changes);
    component.apply(); expect(changes.calls.mostRecent().args[0].time).toBeUndefined();
    component.form.controls.withTime.setValue(true); component.apply(); expect(changes.calls.mostRecent().args[0].time).toEqual({ hour: 0, minute: 0, second: 0 });
    component.clear(); expect(changes.calls.mostRecent().args[0]).toBeNull();
  });
  it('changes the displayed counting without moving a registered date', () => {
    const fixture = TestBed.createComponent(CalendarDatePickerComponent), rules = defaultCalendarRules();
    rules.counts.push({ ...rules.counts[0], id: 'revolution', name: 'Revolução', reference: { year: 10, monthId: 'month-1', day: 1 } });
    fixture.componentRef.setInput('rules', rules); fixture.componentRef.setInput('binding', { calendarId: 'c', revisionId: 'r' });
    fixture.componentRef.setInput('value', { version: 1, calendarId: 'c', revisionId: 'r', precision: 'day', year: 3, monthId: 'month-6', day: 12 }); fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select[formControlName="countId"]') as HTMLSelectElement;
    select.value = 'revolution'; select.dispatchEvent(new Event('change')); const changes = jasmine.createSpy(); fixture.componentInstance.valueChange.subscribe(changes); fixture.componentInstance.apply();
    const date = changes.calls.mostRecent().args[0]; expect(date.year).toBe(3); expect(date.monthId).toBe('month-6'); expect(date.day).toBe(12); expect(date.side).toBe('before'); fixture.destroy();
  });

});
