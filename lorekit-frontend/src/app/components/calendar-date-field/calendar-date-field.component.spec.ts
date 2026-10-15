import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { DbProvider } from '../../database/db-provider.service';
import { ensureSchema } from '../../database/database.helper';
import { runLocalMigrations } from '../../database/local-migrations';
import { CalendarService } from '../../services/calendar.service';
import { DynamicFieldService } from '../../services/dynamic-field.service';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../services/ui-field-config.service';
import { defaultCalendarRules } from '../../utils/calendar-engine';
import { createFieldLayoutItem, UiConfigPayload } from '../../models/ui-field-config.model';
import { EntityConfiguredFieldsComponent } from '../entity-configured-fields/entity-configured-fields.component';
import { CalendarDatePickerComponent } from '../calendar-date-picker/calendar-date-picker.component';
import { ComboBoxComponent } from '../combo-box/combo-box.component';
import { CalendarDateFieldComponent } from './calendar-date-field.component';

describe('compact calendar dynamic field', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>, provider: DbProvider, calendars: CalendarService, fields: DynamicFieldService, overlay: OverlayContainer, first: string, second: string, fieldId: string, layout: UiConfigPayload;
  beforeAll(async () => { SQL = await initSqlJs({ locateFile: file => 'assets/' + file }); });
  function configure(snapshot?: Uint8Array): void {
    TestBed.configureTestingModule({ imports: [EntityConfiguredFieldsComponent], providers: [DbProvider, CalendarService, DynamicFieldService, UiFieldConfigService] });
    provider = TestBed.inject(DbProvider); const db = new SQL.Database(snapshot); ensureSchema(db); runLocalMigrations(db); provider.setDb(db, async () => {});
    calendars = TestBed.inject(CalendarService); fields = TestBed.inject(DynamicFieldService); overlay = TestBed.inject(OverlayContainer);
  }
  beforeEach(async () => {
    configure(); const crud = provider.getCrudHelper();
    crud.create('World', { id: 'world', name: 'Mundo', description: '' }); crud.create('World', { id: 'outside', name: 'Outro mundo', description: '' });
    crud.create('Character', { id: 'person', name: 'Pessoa', description: '' }); crud.create('Relationship', { parentTable: 'World', parentId: 'world', entityTable: 'Character', entityId: 'person' });
    first = (await calendars.save({ id: '', worldId: 'world', name: 'Imperial', description: '', latestRevisionId: '' }, defaultCalendarRules())).calendar.id;
    const rules = defaultCalendarRules(); rules.clock.hoursPerDay = 30;
    second = (await calendars.save({ id: '', worldId: 'world', name: 'Solar', description: '', latestRevisionId: '' }, rules)).calendar.id;
    await calendars.save({ id: '', worldId: 'outside', name: 'Indisponível neste mundo', description: '', latestRevisionId: '' }, defaultCalendarRules());
    fieldId = fields.saveDynamicField({ id: '', name: 'Nascimento', entityTable: 'Character', fieldType: 'calendar-date', isEditorField: false, options: JSON.stringify({ version: 1, kind: 'calendar-date', mode: 'selectable', allowTime: true, bindings: {} }) }).id;
    layout = getSystemDefaultConfig('Character'); layout.tabs[0].items = [createFieldLayoutItem('dynamic:' + fieldId, 1, 1, 12, 1)];
  });
  afterEach(async () => { await provider.flushPendingWrites(); overlay.getContainerElement().innerHTML = ''; provider.close(); });
  function createFixture() {
    const fixture = TestBed.createComponent(EntityConfiguredFieldsComponent); fixture.componentRef.setInput('entityTable', 'Character'); fixture.componentRef.setInput('entity', { id: 'person', name: 'Pessoa' }); fixture.componentRef.setInput('layout', layout); fixture.componentRef.setInput('activeTabId', layout.tabs[0].id); fixture.detectChanges(); return fixture;
  }
  it('keeps the input inside a one-row cell and opens the selector outside clipping ancestors', () => {
    const fixture = createFixture(); fixture.nativeElement.style.width = '220px'; fixture.detectChanges();
    const fieldElement = fixture.nativeElement.querySelector('app-calendar-date-field') as HTMLElement;
    expect(fieldElement.querySelector('app-calendar-date-picker')).toBeNull();
    expect(fieldElement.getBoundingClientRect().height).toBeLessThanOrEqual(56);
    expect(fieldElement.scrollWidth).toBeLessThanOrEqual(fieldElement.clientWidth + 1);
    (fieldElement.querySelector('.calendar-trigger') as HTMLButtonElement).click(); fixture.detectChanges();
    const panel = overlay.getContainerElement().querySelector('.date-panel') as HTMLElement;
    expect(panel).not.toBeNull(); expect(fieldElement.contains(panel)).toBeFalse();
    const component = fixture.debugElement.query(By.directive(CalendarDateFieldComponent)).componentInstance as CalendarDateFieldComponent;
    expect(component.calendars().map(c => c.name)).toEqual(jasmine.arrayContaining(['Imperial', 'Solar'])); expect(component.calendars().length).toBe(2);
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(component.isOpen()).toBeFalse(); expect(fields.getEntityDynamicFieldsValues('Character', 'person')).toEqual([]); fixture.destroy();
  });
  it('saves a selected calendar and date through the rendered field and restores the value after reopening the database', async () => {
    let fixture = createFixture(); (fixture.nativeElement.querySelector('.calendar-trigger') as HTMLButtonElement).click(); fixture.detectChanges();
    const combo = fixture.debugElement.queryAll(By.directive(ComboBoxComponent)).map(d => d.componentInstance as ComboBoxComponent).find(c => c.label() === 'Calendário')!;
    // Overlay content is attached to the origin view, but rendered in the global overlay container.
    expect(combo).toBeDefined(); combo.selectItem(calendars.get(second)); fixture.detectChanges();
    const picker = fixture.debugElement.query(By.directive(CalendarDatePickerComponent)).componentInstance as CalendarDatePickerComponent;
    picker.form.patchValue({ year: 4, day: 12 });
    (overlay.getContainerElement().querySelector('app-calendar-date-picker .primary') as HTMLButtonElement).click(); fixture.detectChanges();
    const values = fields.getEntityDynamicFieldsValues('Character', 'person'); expect(values.length).toBe(1);
    const saved = JSON.parse(values[0].value); expect(saved.calendarId).toBe(second); expect(saved.year).toBe(3); expect(saved.day).toBe(12); expect(saved.time).toBeUndefined();
    expect(overlay.getContainerElement().querySelector('.date-panel')).toBeNull();
    expect((fixture.nativeElement.querySelector('.date-input input') as HTMLInputElement).value).toContain('12/01/0004');
    await provider.flushPendingWrites(); const snapshot = provider.getDb<InstanceType<typeof SQL.Database>>().export(); fixture.destroy(); provider.close(); TestBed.resetTestingModule(); configure(snapshot);
    fixture = createFixture(); expect((fixture.nativeElement.querySelector('.date-input input') as HTMLInputElement).value).toContain('12/01/0004'); expect(JSON.parse(fields.getEntityDynamicFieldsValues('Character', 'person')[0].value).calendarId).toBe(second); fixture.destroy();
  });
  it('preserves the last value when another calendar is selected but dismissed or an invalid date is submitted', () => {
    const calendar = calendars.get(first)!; const saved = { version: 1, calendarId: first, revisionId: calendar.latestRevisionId, precision: 'day', year: 0, monthId: 'month-1', day: 10 };
    fields.saveEntityDynamicFieldsValues('Character', 'person', [{ id: '', value: JSON.stringify(saved), ParentDynamicField: fields.getDynamicFields('Character')[0] }]);
    const fixture = createFixture(), component = fixture.debugElement.query(By.directive(CalendarDateFieldComponent)).componentInstance as CalendarDateFieldComponent;
    component.open(); fixture.detectChanges(); component.selectCalendar(second); fixture.detectChanges();
    expect(component.pickerValue()).toBeNull(); component.close(); fixture.detectChanges(); expect(fields.getEntityDynamicFieldsValues('Character', 'person')[0].value).toBe(JSON.stringify(saved));
    component.open(); fixture.detectChanges(); const picker = fixture.debugElement.query(By.directive(CalendarDatePickerComponent)).componentInstance as CalendarDatePickerComponent;
    picker.form.controls.day.setValue(37); picker.apply(); fixture.detectChanges(); expect(picker.error()).toContain('30'); expect(component.isOpen()).toBeTrue();
    expect(fields.getEntityDynamicFieldsValues('Character', 'person')[0].value).toBe(JSON.stringify(saved)); component.close(); fixture.destroy();
  });
  it('clears a value explicitly and never substitutes rules for a missing revision', () => {
    const unresolved = JSON.stringify({ version: 1, calendarId: first, revisionId: 'not-received', precision: 'year', year: 4 });
    fields.saveEntityDynamicFieldsValues('Character', 'person', [{ id: '', value: unresolved, ParentDynamicField: fields.getDynamicFields('Character')[0] }]);
    const fixture = createFixture(); expect((fixture.nativeElement.querySelector('.date-input input') as HTMLInputElement).value).toBe('Data indisponível');
    (fixture.nativeElement.querySelector('.calendar-trigger') as HTMLButtonElement).click(); fixture.detectChanges(); expect(overlay.getContainerElement().textContent).toContain('indisponível');
    expect(fields.getEntityDynamicFieldsValues('Character', 'person')[0].value).toBe(unresolved);
    (fixture.nativeElement.querySelector('.clear-date') as HTMLButtonElement).click(); fixture.detectChanges(); expect(fields.getEntityDynamicFieldsValues('Character', 'person')[0].value).toBe(''); fixture.destroy();
  });
  it('keeps a fixed calendar and saves annual precision without inventing day, month or time', () => {
    const field = fields.getDynamicFields('Character')[0], calendar = calendars.get(first)!;
    fields.saveDynamicField({ ...field, options: JSON.stringify({ version: 1, kind: 'calendar-date', mode: 'fixed', allowTime: true, bindings: { world: { calendarId: first, revisionId: calendar.latestRevisionId } } }) });
    const fixture = createFixture(), component = fixture.debugElement.query(By.directive(CalendarDateFieldComponent)).componentInstance as CalendarDateFieldComponent;
    component.open(); fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.directive(ComboBoxComponent)).filter(d => (d.componentInstance as ComboBoxComponent).label() === 'Calendário').length).toBe(0);
    const picker = fixture.debugElement.query(By.directive(CalendarDatePickerComponent)).componentInstance as CalendarDatePickerComponent;
    picker.form.patchValue({ precision: 'year', year: 4 }); picker.apply(); fixture.detectChanges();
    const saved = JSON.parse(fields.getEntityDynamicFieldsValues('Character', 'person')[0].value);
    expect(saved.calendarId).toBe(first); expect(saved.year).toBe(3); expect(saved.precision).toBe('year'); expect(saved.monthId).toBeUndefined(); expect(saved.day).toBeUndefined(); expect(saved.time).toBeUndefined(); fixture.destroy();
  });
  it('rejects a date from another world without emitting or saving it', () => {
    const fixture = createFixture(), component = fixture.debugElement.query(By.directive(CalendarDateFieldComponent)).componentInstance as CalendarDateFieldComponent;
    const calendar = calendars.list('outside')[0]; component.open(); fixture.detectChanges();
    component.update({ version: 1, calendarId: calendar.id, revisionId: calendar.latestRevisionId, precision: 'year', year: 0 });
    expect(component.error()).toContain('outro mundo'); expect(component.isOpen()).toBeTrue(); expect(fields.getEntityDynamicFieldsValues('Character', 'person')).toEqual([]); component.close(); fixture.destroy();
  });

});
