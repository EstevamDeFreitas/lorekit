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
import { IrpwNpcCatalogService } from './irpw-npc-catalog.service';

describe('NPC catalog sync capability negotiation', () => {
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;
  let supported: boolean;
  let incoming: RemoteSyncChange[];
  let pushed: SyncPushOperation[];
  let provider: DbProvider;
  let engine: SyncEngineService;
  beforeAll(async () => { SQL = await initSqlJs({ locateFile: file => 'assets/' + file }); });
  function client() {
    TestBed.configureTestingModule({ providers: [DbProvider, IrpwNpcCatalogService, SyncEngineService,
      { provide: AuthService, useValue: { deviceId: () => 'local', user: () => ({ id: 'user' }), isAuthenticated: () => true, syncEnabled: () => true, clearError: () => {}, markSyncError: (message: string) => { throw new Error(message); } } },
      { provide: CloudSyncApiService, useValue: {
        capabilities: async () => ({ entityTypes: supported ? ['World', 'IRPWNpc'] : ['World'] }),
        status: async () => ({ serverTime: String(Date.now()), contractVersion: 1, recordCount: 0 }),
        changes: async () => ({ changes: incoming.splice(0), cursor: '1', hasMore: false, serverTime: String(Date.now()) }),
        push: async (_vault: string, operations: SyncPushOperation[]) => {
          pushed.push(...operations);
          return { serverTime: String(Date.now()), results: operations.map(operation => ({ ...operation, status: 'applied', version: '1' })) };
        },
      } },
      { provide: BrowserDatabaseStorageService, useValue: {} }, { provide: AssetResolverService, useValue: { prepareAssets: () => {} } },
      { provide: CloudTransferPacerService, useValue: { waitForTurn: async () => {} } },
      { provide: ComponentRefreshService, useValue: { refreshFromRemote: () => {} } }, { provide: LegacyAssetMigrationService, useValue: { migrateForSync: async () => {} } },
    ] });
    provider = TestBed.inject(DbProvider);
    const db = new SQL.Database(); ensureSchema(db); runLocalMigrations(db); provider.setDb(db, async () => {});
    engine = TestBed.inject(SyncEngineService);
    return TestBed.inject(IrpwNpcCatalogService);
  }
  async function close() { engine.stop(); await provider.flushPendingWrites(); provider.close(); TestBed.resetTestingModule(); }
  beforeEach(() => { supported = false; incoming = []; pushed = []; });
  afterEach(close);
  it('keeps unsupported NPC edits pending while syncing known entities, then round-trips to another client', async () => {
    const first = client();
    const npc = first.save({ ...first.createDraft(), name: 'Guarda', definition: { ...first.createDraft().definition, threatLevel: 3 } });
    provider.getCrudHelper().create('World', { id: 'world', name: 'Mundo', description: '' });
    await engine.start('vault', { requireInitialSuccess: true });
    expect(pushed.some(operation => operation.entityType === 'World')).toBeTrue();
    expect(pushed.some(operation => operation.entityType === 'IRPWNpc')).toBeFalse();
    supported = true;
    await engine.syncNow();
    const operation = pushed.find(entry => entry.entityType === 'IRPWNpc')!;
    expect(operation.entityId).toBe(npc.id);
    await close();
    incoming = [{ sequence: '1', entityType: 'IRPWNpc', entityId: operation.entityId, operation: 'upsert', version: '1', payload: operation.payload!, modifiedAt: operation.modifiedAt, changeId: operation.changeId, actorDeviceId: 'other', createdAt: new Date().toISOString() }];
    const second = client();
    await engine.start('vault', { requireInitialSuccess: true });
    expect(second.get(npc.id)?.name).toBe('Guarda');
    expect(second.get(npc.id)?.definition.threatLevel).toBe(3);
  });
});
