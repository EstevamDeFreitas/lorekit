import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DbProvider } from '../database/db-provider.service';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { WorkspaceLockService } from '../database/workspace-lock.service';
import { AssetResolverService } from './asset-resolver.service';
import { AuthService } from './auth.service';
import { SyncEngineService } from './sync-engine.service';
import { WorkspaceRuntimeService } from './workspace-runtime.service';

describe('WorkspaceRuntimeService desktop recovery', () => {
  let originalElectronApi: Window['electronAPI'];
  let dbProvider: DbProvider;
  let httpTesting: HttpTestingController;
  let service: WorkspaceRuntimeService;
  let syncStart: jasmine.Spy;
  let writeFile: jasmine.Spy;
  let writeFileAtomic: jasmine.Spy;
  const lastError = signal<string | null>(null);
  const syncEnabled = signal(true);

  beforeEach(() => {
    originalElectronApi = window.electronAPI;
    dbProvider = new DbProvider();
    syncStart = jasmine.createSpy('start').and.resolveTo();
    writeFile = jasmine.createSpy('writeFile').and.resolveTo(null);
    writeFileAtomic = jasmine.createSpy('writeFileAtomic').and.resolveTo(null);

    const malformed = new Uint8Array(4096);
    malformed.set(new TextEncoder().encode('SQLite format 3\0'));
    malformed[16] = 0x10;
    malformed[17] = 0x00;

    window.electronAPI = {
      getDbPath: async () => 'C:/Lorekit/lorekit.db',
      readFile: async () => malformed,
      writeFile,
      writeFileAtomic,
    };

    TestBed.configureTestingModule({
      providers: [
        WorkspaceRuntimeService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DbProvider, useValue: dbProvider },
        {
          provide: AuthService,
          useValue: {
            user: signal({ id: 'user-1', email: 'author@example.com', displayName: 'Author' }),
            lastError,
            syncEnabled,
            isAuthenticated: () => true,
            setSyncEnabled: (enabled: boolean) => syncEnabled.set(enabled),
            clearError: () => lastError.set(null),
            markSyncError: (message: string) => lastError.set(message),
          },
        },
        {
          provide: SyncEngineService,
          useValue: { start: syncStart, stop: jasmine.createSpy('stop') },
        },
        {
          provide: AssetResolverService,
          useValue: {
            hydrateLocalAssets: jasmine.createSpy('hydrateLocalAssets'),
            revokeAll: jasmine.createSpy('revokeAll'),
          },
        },
        {
          provide: BrowserDatabaseStorageService,
          useValue: { deleteUser: jasmine.createSpy('deleteUser') },
        },
        {
          provide: WorkspaceLockService,
          useValue: { release: jasmine.createSpy('release') },
        },
      ],
    });

    service = TestBed.inject(WorkspaceRuntimeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    dbProvider.close();
    TestBed.resetTestingModule();
    lastError.set(null);
    syncEnabled.set(true);
    if (originalElectronApi) window.electronAPI = originalElectronApi;
    else delete window.electronAPI;
  });

  it('keeps the shell alive and can replace a malformed DB from cloud history', async () => {
    await service.initializeDesktop();

    expect(service.desktopRecoveryRequired()).toBeTrue();
    expect(service.error()).toContain('banco local');
    expect(dbProvider.ready()).toBeFalse();
    expect(writeFileAtomic).not.toHaveBeenCalled();

    const recovery = service.recoverDesktopFromCloud();
    const vaultRequest = httpTesting.expectOne(request => request.url.endsWith('/vaults'));
    vaultRequest.flush([{
      id: 'vault-1',
      name: 'Lorekit',
      role: 'owner',
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
    }]);
    await recovery;

    expect(writeFile).toHaveBeenCalledWith(
      jasmine.stringMatching(/lorekit\.db\.corrupt-.+\.bak$/),
      jasmine.any(Uint8Array),
    );
    expect(writeFileAtomic).toHaveBeenCalledWith(
      'C:/Lorekit/lorekit.db',
      jasmine.any(Uint8Array),
    );
    expect(syncStart).toHaveBeenCalledWith('vault-1');
    expect(dbProvider.ready()).toBeTrue();
    expect(service.desktopRecoveryRequired()).toBeFalse();
    expect(service.recoveryBackupPath()).toMatch(/\.bak$/);
  });
});
