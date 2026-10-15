import { TestBed } from '@angular/core/testing';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { DbProvider } from '../database/db-provider.service';
import { ensureSchema } from '../database/database.helper';
import { runLocalMigrations } from '../database/local-migrations';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { SyncEngineService } from './sync-engine.service';
import { AuthService } from './auth.service';
import { AssetResolverService } from './asset-resolver.service';
import { CloudTransferPacerService } from './cloud-transfer-pacer.service';
import { ComponentRefreshService } from './component-refresh.service';
import { LegacyAssetMigrationService } from './legacy-asset-migration.service';
import { CloudSyncApiService, RemoteSyncChange, SyncPushOperation } from './cloud-sync-api.service';
import { CalendarService } from './calendar.service';
import { defaultCalendarRules } from '../utils/calendar-engine';

describe('calendar synchronization integration', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>, provider: DbProvider, engine: SyncEngineService, calendars: CalendarService;
  let enabled: boolean, incoming: RemoteSyncChange[], pushed: SyncPushOperation[], calls: number;
  beforeAll(async () => { SQL = await initSqlJs({ locateFile: file => 'assets/' + file }); });
  beforeEach(() => {
    enabled = true; incoming = []; pushed = []; calls = 0;
    const api = {
      status: async () => ({ serverTime: String(Date.now()), contractVersion: 1, recordCount: 0 }),
      changes: async () => { calls++; const changes = incoming; incoming = []; return { changes, cursor: String(calls), hasMore: false, serverTime: String(Date.now()) }; },
      push: async (_vault: string, operations: SyncPushOperation[]) => { pushed.push(...operations); return { serverTime: String(Date.now()), results: operations.map(o => ({ operationId: o.operationId, entityType: o.entityType, entityId: o.entityId, status: 'accepted', version: '1', modifiedAt: o.modifiedAt, changeId: o.changeId })) }; },
    };
    TestBed.configureTestingModule({ providers: [DbProvider, CalendarService, SyncEngineService,
      { provide: AuthService, useValue: { deviceId: () => 'local', user: () => ({ id: 'user' }), isAuthenticated: () => true, syncEnabled: () => enabled, clearError: () => {}, markSyncError: (message: string) => { throw new Error(message); } } },
      { provide: CloudSyncApiService, useValue: api }, { provide: BrowserDatabaseStorageService, useValue: {} }, { provide: AssetResolverService, useValue: { prepareAssets: () => {} } },
      { provide: CloudTransferPacerService, useValue: { waitForTurn: async () => {} } }, { provide: ComponentRefreshService, useValue: { refreshFromRemote: () => {} } }, { provide: LegacyAssetMigrationService, useValue: { migrateForSync: async () => {} } },
    ] });
    provider = TestBed.inject(DbProvider); const db = new SQL.Database(); ensureSchema(db); runLocalMigrations(db); provider.setDb(db, async () => {});
    engine = TestBed.inject(SyncEngineService); calendars = TestBed.inject(CalendarService);
  });
  afterEach(async () => { engine.stop(); await provider.flushPendingWrites(); provider.close(); });
  const remote = (entityType: string, entityId: string, payload: Record<string, unknown>): RemoteSyncChange => ({ entityType, entityId, payload, sequence: '1', operation: 'upsert', version: '1', modifiedAt: String(Date.now()), changeId: crypto.randomUUID().replaceAll('-', ''), createdAt: new Date().toISOString(), actorDeviceId: 'remote' });
  it('retains an early date, recovers after concurrent revisions arrive and sends offline edits when enabled', async () => {
    const binding = { calendarId: 'calendar', revisionId: 'revision-a' };
    const date = { version: 1, ...binding, precision: 'year', year: -4 };
    incoming = [remote('Event', 'event', { id: 'event', name: 'Remoto', description: '', startDate: -4, endDate: -4, calendarStartJson: JSON.stringify(date), calendarEndJson: JSON.stringify(date) })];
    await engine.start('test-vault', { requireInitialSuccess: true });
    expect(provider.getCrudHelper().findById('Event', 'event').calendarStartJson).toBe(JSON.stringify(date));
    expect(() => calendars.resolve(binding)).toThrowError(/indisponível/);
    const rules = defaultCalendarRules(), different = defaultCalendarRules(); different.months[0].days = 40;
    incoming = [remote('CalendarRevision', 'revision-a', { id: 'revision-a', calendarId: 'calendar', revision: 2, rulesJson: JSON.stringify(rules) }), remote('CalendarRevision', 'revision-b', { id: 'revision-b', calendarId: 'calendar', revision: 2, rulesJson: JSON.stringify(different) }), remote('Calendar', 'calendar', { id: 'calendar', worldId: 'world', name: 'Imperial', description: '', latestRevisionId: 'revision-b' }), remote('World', 'world', { id: 'world', name: 'Mundo', description: '' })];
    await engine.syncNow(); expect(calendars.resolve(binding).engine.daysPerYear).toBe(360); expect(calendars.revisions('calendar').length).toBe(2);
    expect(calendars.resolve({ ...binding, revisionId: 'revision-b' }).engine.daysPerYear).toBe(370);
    enabled = false; const previousCalls = calls;
    const saved = await calendars.save({ id: '', worldId: 'world', name: 'Local', description: '', latestRevisionId: '' }, rules);
    await engine.syncNow(); expect(calls).toBe(previousCalls); expect(pushed.some(p => p.entityId === saved.calendar.id)).toBeFalse();
    enabled = true; await engine.syncNow();
    expect(pushed.some(p => p.entityType === 'Calendar' && p.entityId === saved.calendar.id)).toBeTrue();
    expect(pushed.some(p => p.entityType === 'CalendarRevision' && p.entityId === saved.revision.id && p.payload?.['rulesJson'] === saved.revision.rulesJson)).toBeTrue();
  });
});
