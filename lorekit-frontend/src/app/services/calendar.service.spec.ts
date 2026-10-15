import { TestBed } from '@angular/core/testing';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { DbProvider } from '../database/db-provider.service';
import { ensureSchema } from '../database/database.helper';
import { runLocalMigrations } from '../database/local-migrations';
import { defaultCalendarRules, parseCalendarRules } from '../utils/calendar-engine';
import { CalendarService } from './calendar.service';

describe('world calendar persistence', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  let provider: DbProvider;
  let service: CalendarService;
  beforeAll(async () => { SQL = await initSqlJs({ locateFile: file => 'assets/' + file }); });
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbProvider, CalendarService] });
    provider = TestBed.inject(DbProvider);
    const db = new SQL.Database(); ensureSchema(db); runLocalMigrations(db);
    provider.setDb(db, async () => {});
    provider.getCrudHelper().create('World', { id: 'world', name: 'Mundo', description: '' });
    provider.getCrudHelper().create('World', { id: 'other-world', name: 'Outro mundo', description: '' });
    service = TestBed.inject(CalendarService);
  });
  afterEach(async () => { await provider.flushPendingWrites(); provider.close(); });
  const create = () => service.save({ id: '', worldId: 'world', name: 'Imperial', description: '', latestRevisionId: '' }, defaultCalendarRules());

  it('isolates worlds and survives database export and reopening', async () => {
    const saved = await create(); await create();
    expect(service.list('world').length).toBe(2);
    expect(service.list('other-world')).toEqual([]);
    expect(() => service.resolve({ calendarId: saved.calendar.id, revisionId: saved.revision.id }, 'other-world')).toThrow();
    const snapshot = provider.getDb<InstanceType<typeof SQL.Database>>().export();
    provider.setDb(new SQL.Database(snapshot), async () => {});
    expect(service.resolve({ calendarId: saved.calendar.id, revisionId: saved.revision.id }).engine.daysPerYear).toBe(360);
  });
  it('preserves used structural revisions and updates labels without moving dates', async () => {
    const saved = await create(), rules = parseCalendarRules(saved.revision.rulesJson);
    provider.getCrudHelper().create('Timeline', { id: 'one', name: 'Um', description: '', calendarId: saved.calendar.id, calendarRevisionId: saved.revision.id });
    provider.getCrudHelper().create('Timeline', { id: 'two', name: 'Dois', description: '', calendarId: saved.calendar.id, calendarRevisionId: saved.revision.id });
    rules.months[0].name = 'Aurora';
    const label = await service.save(saved.calendar, rules, saved.revision.id);
    expect(label.published).toBeFalse(); expect(label.revision.id).toBe(saved.revision.id);
    rules.months[0].days = 20;
    const structural = await service.save(label.calendar, rules, label.revision.id);
    expect(structural.published).toBeTrue(); expect(structural.revision.id).not.toBe(saved.revision.id);
    expect(service.resolve({ calendarId: saved.calendar.id, revisionId: saved.revision.id }).engine.daysPerYear).toBe(360);
    expect(service.uses(saved.calendar.id, saved.revision.id).length).toBe(2);
    await expectAsync(service.delete(saved.calendar.id)).toBeRejected();
    await expectAsync(service.deleteRevision(saved.revision.id)).toBeRejected();
  });
  it('blocks deletion for nested field references and historical dates', async () => {
    const saved = await create();
    provider.getCrudHelper().create('DynamicField', { id: 'field', name: 'Nascimento', entityTable: 'Character', fieldType: 'calendar-date', options: JSON.stringify({ bindings: { world: { calendarId: saved.calendar.id, revisionId: saved.revision.id } } }) });
    expect(service.uses(saved.calendar.id).map(u => u.table)).toContain('DynamicField');
    await expectAsync(service.delete(saved.calendar.id)).toBeRejected();
    provider.getCrudHelper().delete('DynamicField', 'field', false);
    provider.getCrudHelper().create('Event', { id: 'event', name: 'Antigo', description: '', calendarStartJson: JSON.stringify({ calendarId: saved.calendar.id, revisionId: saved.revision.id }) });
    await expectAsync(service.delete(saved.calendar.id)).toBeRejected();
  });
  it('does not report success when disk persistence fails and can retry flushing', async () => {
    let fail = true;
    const db = provider.getDb<InstanceType<typeof SQL.Database>>().export();
    provider.setDb(new SQL.Database(db), async () => { if (fail) throw new Error('disk unavailable'); });
    await expectAsync(create()).toBeRejectedWithError('disk unavailable');
    fail = false;
    await create();
    expect(service.list('world').length).toBe(1);
  });
  it('retains unresolved remote references without selecting another revision', async () => {
    const saved = await create();
    expect(() => service.resolve({ calendarId: saved.calendar.id, revisionId: 'missing' })).toThrowError(/indisponível/);
    provider.getCrudHelper().create('CalendarRevision', { id: 'missing', calendarId: saved.calendar.id, revision: 2, rulesJson: saved.revision.rulesJson });
    expect(service.resolve({ calendarId: saved.calendar.id, revisionId: 'missing' }).revision.id).toBe('missing');
  });
});
