import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { CalendarEditComponent } from './calendar-edit.component';
import { CalendarService } from '../../../services/calendar.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { defaultCalendarRules } from '../../../utils/calendar-engine';
import { FLUSH_PENDING_SAVES_EVENT, PendingSaveEventDetail } from '../../../utils/pending-save-event';

describe('calendar editor workflow', () => {
  const calendar = { id: 'c', worldId: 'w', name: 'Imperial', description: '', latestRevisionId: 'r' };
  let service: { get: jasmine.Spy; revision: jasmine.Spy; save: jasmine.Spy };
  beforeEach(() => {
    service = { get: jasmine.createSpy().and.returnValue(calendar), revision: jasmine.createSpy().and.returnValue({ id: 'r', calendarId: 'c', revision: 1, rulesJson: JSON.stringify(defaultCalendarRules()) }), save: jasmine.createSpy().and.rejectWith(new Error('disk unavailable')) };
    TestBed.configureTestingModule({ imports: [CalendarEditComponent], providers: [{ provide: CalendarService, useValue: service }, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'c' } } } }, { provide: TabManagerService, useValue: {} }] });
  });
  it('previews changed rules, supports keyboard reordering and protects unsaved drafts', async () => {
    const fixture = TestBed.createComponent(CalendarEditComponent); fixture.detectChanges();
    const component = fixture.componentInstance;
    component.month(0, 'days', 40); fixture.detectChanges();
    expect(component.preview().engine!.daysPerYear).toBe(370);
    expect(fixture.nativeElement.textContent).toContain('nova revisão');
    component.move('month', 1, -1); expect(component.draft().months[0].id).toBe('month-2');
    const event = new CustomEvent<PendingSaveEventDetail>(FLUSH_PENDING_SAVES_EVENT, { detail: { flushes: [] } });
    window.dispatchEvent(event); await expectAsync(Promise.all(event.detail.flushes)).toBeRejected();
    await component.save(); expect(component.dirty()).toBeTrue(); expect(component.error()).toContain('disk unavailable');
    component.discard(); expect(component.dirty()).toBeFalse(); expect(component.preview().engine!.daysPerYear).toBe(360);
    fixture.destroy();
  });
  it('shows all sections and validates monthless configuration and partial formats', () => {
    const fixture = TestBed.createComponent(CalendarEditComponent); fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.querySelectorAll('.section-nav button').length).toBe(6);
    component.monthless(true); component.annualDays(400); fixture.detectChanges();
    expect(component.preview().engine!.daysPerYear).toBe(400);
    component.section.set('Formatos'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Somente ano');
    component.annualDays(0); expect(component.preview().error).toBeTruthy();
    fixture.destroy();
  });
  it('reorders format parts by accessible buttons and updates the example', () => {
    const fixture = TestBed.createComponent(CalendarEditComponent); fixture.detectChanges(); const component = fixture.componentInstance;
    component.formatPart(0, 'day', 0, { literal: 'Primeiro' }); component.formatPart(0, 'day', 1, { literal: 'Segundo' }); component.section.set('Formatos'); fixture.detectChanges();
    const dayVariant = [...fixture.nativeElement.querySelectorAll('details')].find((details: unknown) => (details as HTMLElement).querySelector('summary')?.textContent === 'Dia completo') as HTMLDetailsElement; dayVariant.open = true;
    const button = dayVariant.querySelector('app-calendar-format-part button[aria-label="Mover parte 1 para baixo"]') as HTMLButtonElement; button.click(); fixture.detectChanges();
    expect(component.sampleText('short')).toContain('SegundoPrimeiro'); expect(component.dirty()).toBeTrue(); fixture.destroy();
  });
  it('edits conditional text through the builder and previews the boundary', () => {
    const fixture = TestBed.createComponent(CalendarEditComponent); fixture.detectChanges(); const component = fixture.componentInstance;
    component.edit(r => { r.formats[0].day = []; }); component.addConditionalPart(0, 'day'); component.section.set('Formatos'); fixture.detectChanges();
    expect(component.sampleText('short')).toBe('Dia de luz');
    component.sample.update(date => ({ ...date!, day: 13 })); expect(component.sampleText('short')).toBe('Dia da noite');
    const truthInput = [...fixture.nativeElement.querySelectorAll('app-calendar-format-part label')].find((label: unknown) => (label as HTMLElement).textContent?.trim().startsWith('Se verdadeiro'))?.querySelector('input') as HTMLInputElement;
    truthInput.value = 'Aurora'; truthInput.dispatchEvent(new Event('input')); fixture.detectChanges(); component.sample.update(date => ({ ...date!, day: 12 }));
    expect(component.sampleText('short')).toBe('Aurora'); fixture.destroy();
  });

});
