import { TestBed } from '@angular/core/testing';
import { DbProvider } from '../database/db-provider.service';
import { openSqliteDatabase } from '../database/database.helper';
import { DynamicField } from '../models/dynamicfields.model';
import { HistoryAddress } from '../models/entity-history.model';
import { DynamicFieldService } from './dynamic-field.service';
import { EntityHistoryService } from './entity-history.service';
import { EntityHistoryStore } from './entity-history-store.service';

describe('Entity history field persistence', () => {
  let db: DbProvider;
  let store: EntityHistoryStore;
  let history: EntityHistoryService;
  const entity = { table: 'Character', id: 'history-owner' };

  beforeEach(async () => {
    spyOn(console, 'log');
    TestBed.configureTestingModule({ providers: [DbProvider] });
    db = TestBed.inject(DbProvider);
    db.setDb(await openSqliteDatabase(), async () => undefined);
    db.getCrudHelper().create(entity.table, { id: entity.id, name: 'Original', description: '', concept: 'Untouched' });
    store = TestBed.inject(EntityHistoryStore);
    history = TestBed.inject(EntityHistoryService);
    history.activate(entity);
  });

  afterEach(async () => { await db.flushPendingWrites(); db.close(); });

  it('isolates dynamic templates and entities, including initially absent values', async () => {
    const dynamic = TestBed.inject(DynamicFieldService);
    const first = dynamic.saveDynamicField(new DynamicField('', 'First', entity.table));
    const second = dynamic.saveDynamicField(new DynamicField('', 'Second', entity.table));
    const one: HistoryAddress = { entity, field: { column: 'value', dynamicId: first.id } };
    const two: HistoryAddress = { entity, field: { column: 'value', dynamicId: second.id } };
    await history.capture(one, '', 'One');
    await history.capture(two, '', 'Two');
    await history.undo();
    expect(store.read(one)).toBe('One');
    expect(store.read(two)).toBe('');
    await history.redo();
    expect(store.read(two)).toBe('Two');
    expect(dynamic.getEntityDynamicFieldsValues(entity.table, entity.id).length).toBe(2);
    expect(db.getCrudHelper().findById(entity.table, entity.id).concept).toBe('Untouched');
    dynamic.deleteDynamicField(first);
    history.validateExternal();
    expect(history.canUndo()).toBeFalse();
  });

  it('restores a hidden JSON text field without rolling back numeric siblings or other columns', async () => {
    const owner = { table: 'IRPWCharacterSheet', id: 'sheet' };
    db.getCrudHelper().create(owner.table, { id: owner.id, marks: JSON.stringify([{ name: 'Old', level: 1 }]), mana: '1' });
    const address: HistoryAddress = { entity: owner, field: { column: 'marks', path: [0, 'name'] } };
    history.activate(owner);
    await history.capture(address, 'Old', 'New');
    db.getCrudHelper().update(owner.table, owner.id, { marks: JSON.stringify([{ name: 'New', level: 9 }]), mana: '42' });
    await history.undo();
    const row = db.getCrudHelper().findById(owner.table, owner.id);
    expect(JSON.parse(row.marks)).toEqual([{ name: 'Old', level: 9 }]);
    expect(row.mana).toBe('42');
  });
});
