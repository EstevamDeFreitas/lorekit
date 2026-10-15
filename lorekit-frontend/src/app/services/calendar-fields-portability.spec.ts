import { TestBed } from '@angular/core/testing';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { DbProvider } from '../database/db-provider.service';
import { ensureSchema } from '../database/database.helper';
import { runLocalMigrations } from '../database/local-migrations';
import { CalendarService } from './calendar.service';
import { CalendarFieldService } from './calendar-field.service';
import { DynamicFieldService } from './dynamic-field.service';
import { UiFieldConfigService, getSystemDefaultConfig } from './ui-field-config.service';
import { UiFieldLayoutPortabilityService } from './ui-field-layout-portability.service';
import { createFieldLayoutItem } from '../models/ui-field-config.model';
import { DynamicField } from '../models/dynamicfields.model';
import { CalendarBinding } from '../models/calendar.model';
import { defaultCalendarRules } from '../utils/calendar-engine';

describe('calendar fields and portable references', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>, provider: DbProvider, calendars: CalendarService, fields: DynamicFieldService, impacts: CalendarFieldService, portability: UiFieldLayoutPortabilityService, binding: CalendarBinding, field: DynamicField;
  beforeAll(async () => { SQL = await initSqlJs({ locateFile: file => 'assets/' + file }); });
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [DbProvider, CalendarService, CalendarFieldService, DynamicFieldService, UiFieldConfigService, UiFieldLayoutPortabilityService] });
    provider = TestBed.inject(DbProvider); const db = new SQL.Database(); ensureSchema(db); runLocalMigrations(db); provider.setDb(db, async () => {});
    const crud = provider.getCrudHelper(); crud.create('World', { id: 'world-secret', name: 'Mundo', description: '' });
    crud.create('Character', { id: 'person', name: 'Pessoa', description: '' }); crud.create('Relationship', { parentTable: 'World', parentId: 'world-secret', entityTable: 'Character', entityId: 'person' });
    calendars = TestBed.inject(CalendarService); fields = TestBed.inject(DynamicFieldService); impacts = TestBed.inject(CalendarFieldService); portability = TestBed.inject(UiFieldLayoutPortabilityService);
    const rules = defaultCalendarRules(); rules.counts[0].sourceAgeId = 'age-secret';
    const saved = await calendars.save({ id: '', worldId: 'world-secret', name: 'Imperial', description: '', latestRevisionId: '' }, rules);
    binding = { calendarId: saved.calendar.id, revisionId: saved.revision.id, countId: 'origin', formatId: 'short' };
    field = fields.saveDynamicField({ id: '', name: 'Nascimento', entityTable: 'Character', fieldType: 'calendar-date', isEditorField: false, options: JSON.stringify({ version: 1, kind: 'calendar-date', mode: 'fixed', allowTime: true, bindings: { 'world-secret': binding } }) });
  });
  afterEach(async () => { await provider.flushPendingWrites(); provider.close(); });
  function exportDocument() { const layout = getSystemDefaultConfig('Character'); layout.tabs[0].items = [createFieldLayoutItem('dynamic:' + field.id, 1, 1, 12, 6)]; return portability.exportLayout('Character', layout); }

  it('exports complete references without local identifiers or entity values', () => {
    const document = exportDocument(), json = JSON.stringify(document);
    expect(document.version).toBe(3); expect(document.calendarReferences!.length).toBe(1);
    for (const local of [field.id, binding.calendarId, binding.revisionId, 'world-secret', 'age-secret']) expect(json).not.toContain(local);
    expect(JSON.parse(document.dynamicFields[0].options!).bindings).toEqual({});
    expect(document.calendarReferences![0].rules.counts[0].id).toBe('count-1');
  });
  it('requires association before comparing fields and applying layouts', () => {
    const document = exportDocument(), json = JSON.stringify(document);
    const unresolved = portability.prepareLayoutImport(json);
    expect(unresolved.unresolvedCalendarReferences!.length).toBe(1); expect(unresolved.fieldsToCreate).toEqual([]);
    expect(() => portability.applyLayoutImport(unresolved, 'replace-global')).toThrowError(/Associe/);
    const key = document.calendarReferences![0].key;
    const resolved = portability.prepareLayoutImport(json, { [key]: { worldId: 'world-secret', binding, acceptDifferences: false } });
    expect(resolved.reusedFields.length).toBe(1); expect(resolved.fieldsToCreate.length).toBe(0);
    portability.applyLayoutImport(resolved, 'replace-global');
    expect(calendars.list('world-secret').length).toBe(1);
  });
  it('requires explicit acceptance of different rules and rejects definition conflicts without mutations', async () => {
    const document = exportDocument(), json = JSON.stringify(document), key = document.calendarReferences![0].key;
    const rules = defaultCalendarRules(); rules.months[0].days = 40;
    const saved = await calendars.save({ id: '', worldId: 'world-secret', name: 'Outro', description: '', latestRevisionId: '' }, rules);
    const next = { calendarId: saved.calendar.id, revisionId: saved.revision.id, countId: 'origin', formatId: 'short' };
    expect(() => portability.prepareLayoutImport(json, { [key]: { worldId: 'world-secret', binding: next, acceptDifferences: false } })).toThrowError(/diferenças/);
    expect(() => portability.prepareLayoutImport(json, { [key]: { worldId: 'world-secret', binding: next, acceptDifferences: true } })).toThrowError(/diferente/);
    expect(fields.getDynamicFields('Character').length).toBe(1);
  });
  it('keeps version 1 and 2 layouts readable and rejects unsupported future versions', () => {
    const document = exportDocument(); document.dynamicFields = []; document.calendarReferences = []; document.layout.tabs[0].items = [];
    for (const version of [1, 2]) expect(portability.prepareLayoutImport(JSON.stringify({ ...document, version })).unresolvedCalendarReferences).toBeUndefined();
    expect(() => portability.prepareLayoutImport(JSON.stringify({ ...document, version: 99 }))).toThrow();
  });
  it('reviews changed configuration transactionally while preserving unresolved original values', async () => {
    const value = { id: 'date-value', value: JSON.stringify({ version: 1, ...binding, precision: 'day', year: 0, monthId: 'month-1', day: 1, time: { hour: 0, minute: 0, second: 0 } }), ParentDynamicField: field };
    fields.saveEntityDynamicFieldsValues('Character', 'person', [{ ...value, id: '' }]);
    const changed = { ...field, options: JSON.stringify({ ...JSON.parse(field.options!), allowTime: false }) };
    expect(() => fields.saveDynamicField(changed)).toThrowError(/Revise/);
    const plan = impacts.plan(changed); expect(plan.items[0].error).toContain('horário');
    await expectAsync(impacts.commit(plan)).toBeRejected();
    const item = plan.items[0]; delete item.date!.time; impacts.validate(item, changed); await impacts.commit(plan);
    expect(JSON.parse(fields.getEntityDynamicFieldsValues('Character', 'person')[0].value).time).toBeUndefined();
    provider.getCrudHelper().update('DynamicFieldValue', item.id, { value: 'unparseable original' });
    const invalidPlan = impacts.plan({ ...changed, options: field.options });
    await expectAsync(impacts.commit(invalidPlan)).toBeRejected();
    expect(provider.getCrudHelper().findById('DynamicFieldValue', item.id).value).toBe('unparseable original');
  });
  it('round-trips ordered conditional parts without nested local identities', async () => {
    const rules = defaultCalendarRules();
    rules.formats[0].day = [{ conditional: { mode: 'all', conditions: [{ field: 'day', operator: 'lt', value: 13 }], whenTrue: 'Luz', whenFalse: 'Noite', whenUnknown: 'Incerto' } }, { literal: ' · ' }, { token: 'day' }];
    await calendars.save(calendars.get(binding.calendarId)!, rules, binding.revisionId);
    const document = exportDocument(), key = document.calendarReferences![0].key;
    expect(document.calendarReferences![0].rules.formats[0].day).toEqual(rules.formats[0].day);
    const resolved = portability.prepareLayoutImport(JSON.stringify(document), { [key]: { worldId: 'world-secret', binding, acceptDifferences: false } });
    expect(resolved.reusedFields.length).toBe(1); expect(resolved.fieldsToCreate.length).toBe(0);
  });

});
