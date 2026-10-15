import { TestBed } from '@angular/core/testing';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { DbProvider } from '../database/db-provider.service';
import { ensureSchema } from '../database/database.helper';
import { runLocalMigrations } from '../database/local-migrations';
import { CalendarBinding, CalendarDate } from '../models/calendar.model';
import { CalendarService } from './calendar.service';
import { CalendarTimelineService } from './calendar-timeline.service';
import { DynamicFieldService } from './dynamic-field.service';
import { defaultCalendarRules } from '../utils/calendar-engine';

describe('calendar timeline conversion', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>, provider: DbProvider, service: CalendarTimelineService, calendars: CalendarService, binding: CalendarBinding, reference: CalendarDate;
  beforeAll(async () => { SQL = await initSqlJs({ locateFile: file => 'assets/' + file }); });
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [DbProvider, CalendarService, CalendarTimelineService] });
    provider = TestBed.inject(DbProvider);
    const db = new SQL.Database(); ensureSchema(db); runLocalMigrations(db); provider.setDb(db, async () => {});
    const crud = provider.getCrudHelper();
    crud.create('World', { id: 'world', name: 'Mundo', description: '' });
    crud.create('Timeline', { id: 'timeline', name: 'História', description: '' });
    crud.create('Relationship', { parentTable: 'World', parentId: 'world', entityTable: 'Timeline', entityId: 'timeline' });
    for (const [table, id, start, end] of [['Event', 'event', 1, 3], ['Age', 'age', -1, 3], ['GreatMark', 'mark', 0, 0]] as const) {
      crud.create(table, { id, name: id, description: 'texto original', startDate: start, endDate: end, ...(table === 'Event' ? { date: 'durante a guerra' } : {}) });
      crud.create('Relationship', { parentTable: 'Timeline', parentId: 'timeline', entityTable: table, entityId: id });
    }
    calendars = TestBed.inject(CalendarService); service = TestBed.inject(CalendarTimelineService);
    const saved = await calendars.save({ id: '', worldId: 'world', name: 'Imperial', description: '', latestRevisionId: '' }, defaultCalendarRules());
    binding = { calendarId: saved.calendar.id, revisionId: saved.revision.id };
    reference = { version: 1, ...binding, precision: 'day', year: 0, monthId: 'month-1', day: 1 };
  });
  afterEach(async () => { await provider.flushPendingWrites(); provider.close(); });
  const plan = () => service.plan('timeline', binding, 'year', 0, reference);

  it('plans without writes and preserves annual precision and legacy text', () => {
    const draft = plan();
    expect(draft.items.every(i => i.start?.precision === 'year')).toBeTrue();
    expect(draft.items.find(i => i.source.id === 'event')!.start!.year).toBe(1);
    expect(service.timeline('timeline').calendarId).toBeNull();
    expect(provider.getCrudHelper().findById('Event', 'event').date).toBe('durante a guerra');
  });
  it('requires manual association for fractional positions', async () => {
    provider.getCrudHelper().update('Event', 'event', { startDate: 1.5 });
    const draft = plan();
    expect(draft.items.find(i => i.source.id === 'event')!.error).toContain('fracionária');
    await expectAsync(service.commit(draft)).toBeRejected();
    expect(service.timeline('timeline').calendarId).toBeNull();
  });
  it('converts an age to shared counting while preserving source content and endpoints', async () => {
    const draft = plan(); draft.items.find(i => i.source.id === 'age')!.convertAge = true;
    await service.commit(draft); await service.commit(draft);
    const timeline = service.timeline('timeline');
    const resolved = calendars.resolve({ calendarId: timeline.calendarId!, revisionId: timeline.calendarRevisionId! });
    const converted = resolved.engine.rules.counts.find(c => c.sourceAgeId === 'age')!;
    expect(converted.description).toBe('texto original');
    expect(calendars.revisions(binding.calendarId).length).toBe(2);
    const age = provider.getCrudHelper().findById('Age', 'age');
    expect(age.startDate).toBe(-1); expect(age.endDate).toBe(3); expect(age.description).toBe('texto original');
    expect(age.calendarConvertedCountId).toBe(converted.id);
  });
  it('rejects stale previews and rolls back a conversion failure', async () => {
    const stale = plan(); provider.getCrudHelper().update('Event', 'event', { name: 'Mudou' });
    await expectAsync(service.commit(stale)).toBeRejectedWithError(/mudou/);
    const draft = plan(), real = provider.runInTransaction.bind(provider);
    spyOn(provider, 'runInTransaction').and.callFake(operation => real(async () => { await operation(); throw new Error('simulated failure'); }));
    await expectAsync(service.commit(draft)).toBeRejectedWithError('simulated failure');
    expect(service.timeline('timeline').calendarId).toBeNull();
    expect(provider.getCrudHelper().findById('Event', 'event').calendarStartJson).toBeNull();
  });
  it('preserves recent dates and shared rules when returning to free chronology', async () => {
    await service.commit(plan());
    const start = { ...reference, year: 10 }, end = { ...reference, year: 11 };
    service.saveItemDates('Event', 'event', 'timeline', start, end);
    await service.detach('timeline');
    const event = provider.getCrudHelper().findById('Event', 'event');
    expect(event.startDate).toBe(10); expect(event.endDate).toBe(11);
    expect(JSON.parse(event.calendarStartJson).year).toBe(10);
    expect(service.timeline('timeline').calendarId).toBeNull();
    expect(calendars.get(binding.calendarId)).not.toBeNull();
  });
  it('requires explicit mapping when switching to a different calendar', async () => {
    await service.commit(plan());
    const saved = await calendars.save({ id: '', worldId: 'world', name: 'Outro', description: '', latestRevisionId: '' }, defaultCalendarRules());
    const next = { calendarId: saved.calendar.id, revisionId: saved.revision.id };
    const draft = service.plan('timeline', next, 'year', 0, { ...reference, ...next });
    expect(draft.items.every(i => i.error.includes('manualmente'))).toBeTrue();
    for (const item of draft.items) { item.start = { ...reference, ...next }; item.end = { ...reference, ...next }; service.validateItem(item, draft); }
    await service.commit(draft);
    expect(service.timeline('timeline').calendarId).toBe(saved.calendar.id);
  });
  it('does not duplicate converted counts after a failed disk write and retry', async () => {
    let failed = true;
    const snapshot = provider.getDb<InstanceType<typeof SQL.Database>>().export();
    provider.setDb(new SQL.Database(snapshot), async () => { if (failed) throw new Error('disk failure'); });
    const draft = plan(); draft.items.find(item => item.table === 'Age')!.convertAge = true;
    await expectAsync(service.commit(draft)).toBeRejectedWithError('disk failure');
    failed = false; await service.commit(draft);
    const timeline = service.timeline('timeline');
    expect(calendars.resolve({ calendarId: timeline.calendarId!, revisionId: timeline.calendarRevisionId! }).engine.rules.counts.filter(c => c.sourceAgeId === 'age').length).toBe(1);
  });
  it('reopens two shared timelines, an independent calendar and a dynamic date offline across revisions', async () => {
    const crud = provider.getCrudHelper();
    crud.create('Timeline', { id: 'second', name: 'Outra história', description: '' });
    crud.create('Relationship', { parentTable: 'World', parentId: 'world', entityTable: 'Timeline', entityId: 'second' });
    await service.commit(plan()); await service.commit(service.plan('second', binding, 'day', 0, reference));
    const otherRules = defaultCalendarRules(); otherRules.months = []; otherRules.daysPerYear = 400; otherRules.counts[0].reference = { year: 0, day: 1 };
    await calendars.save({ id: '', worldId: 'world', name: 'Solar', description: '', latestRevisionId: '' }, otherRules);
    crud.create('Character', { id: 'person', name: 'Pessoa', description: '' });
    crud.create('Relationship', { parentTable: 'World', parentId: 'world', entityTable: 'Character', entityId: 'person' });
    const fields = TestBed.inject(DynamicFieldService);
    const field = fields.saveDynamicField({ id: '', name: 'Nascimento', entityTable: 'Character', fieldType: 'calendar-date', isEditorField: false, options: JSON.stringify({ version: 1, kind: 'calendar-date', mode: 'fixed', allowTime: true, bindings: { world: binding } }) });
    fields.saveEntityDynamicFieldsValues('Character', 'person', [{ id: '', value: JSON.stringify(reference), ParentDynamicField: field }]);
    const rules = defaultCalendarRules(); rules.months[0].days = 20;
    const published = await calendars.save(calendars.get(binding.calendarId)!, rules, binding.revisionId);
    const next = { ...binding, revisionId: published.revision.id };
    await service.commit(service.plan('second', next, 'day', 0, { ...reference, ...next }));
    await provider.flushPendingWrites(); const snapshot = provider.getDb<InstanceType<typeof SQL.Database>>().export();
    provider.setDb(new SQL.Database(snapshot), async () => {});
    expect(calendars.list('world').length).toBe(2);
    expect(service.timeline('timeline').calendarRevisionId).toBe(binding.revisionId);
    expect(service.timeline('second').calendarRevisionId).toBe(next.revisionId);
    expect(calendars.resolve(binding).engine.daysPerYear).toBe(360); expect(calendars.resolve(next).engine.daysPerYear).toBe(350);
    const stored = JSON.parse(provider.getCrudHelper().findAll('DynamicFieldValue')[0].value);
    calendars.validateDate(stored, 'world'); expect(stored.revisionId).toBe(binding.revisionId);
    expect(JSON.parse(provider.getCrudHelper().findById('GreatMark', 'mark').calendarStartJson).year).toBe(0);
  });

});
