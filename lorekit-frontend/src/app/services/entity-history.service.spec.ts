import { TestBed } from '@angular/core/testing';
import { HistoryAddress, HistoryEntity, historyEntityKey, historyFieldKey } from '../models/entity-history.model';
import { EntityHistoryService } from './entity-history.service';
import { EntityHistoryStore } from './entity-history-store.service';

describe('EntityHistoryService', () => {
  const a: HistoryEntity = { table: 'Character', id: 'a' };
  const b: HistoryEntity = { table: 'Character', id: 'b' };
  let history: EntityHistoryService;
  let values: Map<string, string>;
  let store: { read: jasmine.Spy; write: jasmine.Spy; flush: jasmine.Spy };
  const address = (column: string, entity = a): HistoryAddress => ({ entity, field: { column, label: column } });
  const key = (field: HistoryAddress) => historyEntityKey(field.entity) + historyFieldKey(field.field);

  beforeEach(() => {
    values = new Map();
    store = {
      read: jasmine.createSpy('read').and.callFake((field: HistoryAddress) => values.get(key(field)) ?? ''),
      write: jasmine.createSpy('write').and.callFake((field: HistoryAddress, value: string) => { values.set(key(field), value); }),
      flush: jasmine.createSpy('flush').and.resolveTo(),
    };
    TestBed.configureTestingModule({ providers: [{ provide: EntityHistoryStore, useValue: store }] });
    history = TestBed.inject(EntityHistoryService);
    history.activate(a);
  });

  it('undoes description then name and redoes name then description, persisting each result', async () => {
    await history.capture(address('name'), '', 'Alice');
    await history.capture(address('description'), '', 'Explorer');
    await history.undo();
    expect(values.get(key(address('description')))).toBe('');
    expect(values.get(key(address('name')))).toBe('Alice');
    await history.undo();
    expect(values.get(key(address('name')))).toBe('');
    await history.redo();
    await history.redo();
    expect(values.get(key(address('name')))).toBe('Alice');
    expect(values.get(key(address('description')))).toBe('Explorer');
    expect(history.canRedo()).toBeFalse();
  });

  it('isolates entities and clears only the edited entity redo branch', async () => {
    await history.capture(address('name'), '', 'Alice');
    await history.capture(address('name', b), '', 'Bob');
    await history.undo();
    history.activate(b);
    await history.undo();
    await history.capture(address('name', b), '', 'Bobby');
    expect(history.canRedo()).toBeFalse();
    history.activate(a);
    expect(history.canRedo()).toBeTrue();
    await history.redo();
    expect(values.get(key(address('name')))).toBe('Alice');
  });

  it('groups typing but keeps paste and formatting as separate steps', async () => {
    await history.capture(address('name'), '', 'A');
    await history.capture(address('name'), 'A', 'Al');
    await history.capture(address('name'), 'Al', 'Alice', 'paste');
    await history.undo();
    expect(values.get(key(address('name')))).toBe('Al');
    await history.undo();
    expect(values.get(key(address('name')))).toBe('');
  });

  it('closes a typing group after inactivity and ignores equal content', async () => {
    const now = spyOn(Date, 'now').and.returnValue(1000);
    await history.capture(address('name'), '', 'A');
    now.and.returnValue(1700);
    await history.capture(address('name'), 'A', 'Al');
    await history.capture(address('name'), 'Al', 'Al');
    await history.undo();
    expect(values.get(key(address('name')))).toBe('A');
  });

  it('reserves capture order before asynchronous editor serialization finishes', async () => {
    let resolve!: (value: string) => void;
    const content = new Promise<string>(done => { resolve = done; });
    void history.capture(address('description'), '', content);
    const second = history.capture(address('name'), '', 'Alice');
    resolve('Explorer');
    await second;
    await history.undo();
    expect(values.get(key(address('name')))).toBe('');
    expect(values.get(key(address('description')))).toBe('Explorer');
  });

  it('preserves steps when controls unmount and restores hidden fields', async () => {
    const apply = jasmine.createSpy('apply');
    const unregister = history.register({ address: address('description'), apply });
    await history.capture(address('description'), '', 'Explorer');
    unregister();
    await history.undo();
    expect(apply).not.toHaveBeenCalled();
    expect(values.get(key(address('description')))).toBe('');
    expect(history.canRedo()).toBeTrue();
  });

  it('invalidates incompatible external content without overwriting it', async () => {
    await history.capture(address('name'), '', 'Alice');
    values.set(key(address('name')), 'Remote');
    await history.undo();
    expect(values.get(key(address('name')))).toBe('Remote');
    expect(history.canUndo()).toBeFalse();
    expect(history.message()).toContain('reiniciado');
  });

  it('retains history for an identical synchronization echo and clears on a new session', async () => {
    await history.capture(address('name'), '', 'Alice');
    values.set(key(address('name')), 'Alice');
    history.validateExternal();
    expect(history.canUndo()).toBeTrue();
    history.clear();
    history.activate(a);
    expect(history.canUndo()).toBeFalse();
    expect(history.canRedo()).toBeFalse();
  });

  it('does not advance the cursor on persistence failure and permits retry', async () => {
    spyOn(console, 'error');
    await history.capture(address('name'), '', 'Alice');
    values.set(key(address('name')), 'Alice');
    store.flush.and.returnValues(Promise.resolve(), Promise.reject(new Error('disk')), Promise.resolve());
    await history.undo();
    expect(history.canUndo()).toBeTrue();
    expect(history.canRedo()).toBeFalse();
    expect(values.get(key(address('name')))).toBe('Alice');
    store.flush.and.resolveTo();
    await history.undo();
    expect(history.canRedo()).toBeTrue();
  });

  it('executes only one command while restoration is pending', async () => {
    await history.capture(address('name'), '', 'Alice');
    await history.capture(address('description'), '', 'Explorer');
    const first = history.undo();
    await history.undo();
    await first;
    expect(history.undoStep()?.field.column).toBe('name');
  });

  it('discards a pending capture after invalidation even when the field is registered again', async () => {
    let resolve!: (value: string) => void;
    const capture = history.capture(address('name'), '', new Promise<string>(done => { resolve = done; }));
    history.invalidate(a, false);
    values.set(key(address('name')), 'Remote');
    history.observe(address('name'), 'Remote');
    resolve('Stale');
    await capture;
    expect(history.canUndo()).toBeFalse();
    expect(values.get(key(address('name')))).toBe('Remote');
  });
});
