import { TestBed } from '@angular/core/testing';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { DbProvider } from '../database/db-provider.service';
import { ensureSchema } from '../database/database.helper';
import { IrpwNpcCatalogService } from './irpw-npc-catalog.service';

describe('Ironpaw NPC catalog persistence', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  let provider: DbProvider;
  let catalog: IrpwNpcCatalogService;
  beforeAll(async () => { SQL = await initSqlJs({ locateFile: file => 'assets/' + file }); });
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbProvider, IrpwNpcCatalogService] });
    provider = TestBed.inject(DbProvider);
    const db = new SQL.Database(); ensureSchema(db); provider.setDb(db, async () => {});
    catalog = TestBed.inject(IrpwNpcCatalogService);
  });
  afterEach(async () => { await provider.flushPendingWrites(); provider.close(); TestBed.resetTestingModule(); });
  it('reopens definitions and makes independent duplicates without worldbuilding characters', async () => {
    const saved = catalog.save({ ...catalog.createDraft(), name: 'Guarda', definition: { ...catalog.createDraft().definition, threatLevel: 2 } });
    const copy = catalog.duplicate(saved);
    expect(copy.id).not.toBe(saved.id);
    const snapshot = structuredClone(saved);
    catalog.save({ ...saved, name: 'Guarda veterano' });
    expect(snapshot.name).toBe('Guarda');
    catalog.archive(copy.id);
    expect(catalog.list().length).toBe(1);
    expect(catalog.list(true).length).toBe(2);
    expect(provider.getCrudHelper().findAll('Character').length).toBe(0);
    await provider.flushPendingWrites();
    const bytes = provider.getDb<InstanceType<typeof SQL.Database>>().export();
    provider.setDb(new SQL.Database(bytes), async () => {});
    expect(catalog.get(saved.id)?.name).toBe('Guarda veterano');
    expect(catalog.get(saved.id)?.definition.threatLevel).toBe(2);
  });
  it('rejects stale edits and invalid definitions without overwriting prior data', () => {
    const saved = catalog.save({ ...catalog.createDraft(), name: 'Guarda' });
    catalog.save({ ...saved, name: 'Revisado' });
    expect(() => catalog.save(saved)).toThrowError(/outra tela/);
    const current = catalog.get(saved.id)!;
    expect(() => catalog.save({ ...current, definition: { ...current.definition, threatLevel: 9 } })).toThrow();
    expect(catalog.get(saved.id)?.name).toBe('Revisado');
  });
});
