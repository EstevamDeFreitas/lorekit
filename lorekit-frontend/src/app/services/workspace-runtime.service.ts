import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, timeout as rxTimeout } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { DbProvider } from '../database/db-provider.service';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { openDbAndEnsureSchema, openSqliteDatabase } from '../database/database.helper';
import { ElectronSafeAPI, persistDbToDisk } from '../database/database.helper';
import { WorkspaceLockService } from '../database/workspace-lock.service';
import { isElectronRuntime } from '../utils/runtime-platform';
import { AuthService } from './auth.service';
import { AssetResolverService } from './asset-resolver.service';
import { SyncEngineService } from './sync-engine.service';

export interface CloudVault {
  readonly id: string;
  readonly name: string;
  readonly role: 'owner' | 'editor' | 'viewer';
  readonly createdAt: string;
  readonly updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceRuntimeService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly dbProvider = inject(DbProvider);
  private readonly browserStorage = inject(BrowserDatabaseStorageService);
  private readonly workspaceLock = inject(WorkspaceLockService);
  private readonly syncEngine = inject(SyncEngineService);
  private initializing: Promise<void> | null = null;
  private readonly assetResolver = inject(AssetResolverService);
  private desktopConnectRetryTimer: number | null = null;
  private desktopConnectRetryAttempt = 0;

  readonly vault = signal<CloudVault | null>(null);
  readonly error = signal<string | null>(null);
  readonly desktopRecoveryRequired = signal(false);
  readonly recovering = signal(false);
  readonly recoveryBackupPath = signal<string | null>(null);

  async initializeDesktop(): Promise<void> {
    if (!isElectronRuntime()) return;
    if (this.dbProvider.ready()) return;
    let database;
    try {
      database = await openDbAndEnsureSchema();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Falha desconhecida ao abrir o SQLite.';
      this.desktopRecoveryRequired.set(true);
      this.error.set(`O banco local n\u00e3o p\u00f4de ser aberto: ${detail}`);
      return;
    }

    this.dbProvider.setDb(database);
    this.assetResolver.hydrateLocalAssets();
    if (this.auth.isAuthenticated() && this.auth.syncEnabled()) {
      try {
        await this.connectAuthenticatedAccount(true);
      } catch (error) {
        this.scheduleDesktopConnectRetry(error);
      }
    }
  }

  async initializeAuthenticatedWeb(): Promise<void> {
    if (isElectronRuntime() || this.dbProvider.ready()) return;
    if (this.initializing) return this.initializing;

    this.initializing = this.openAuthenticatedWebWorkspace().finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }

  async connectAuthenticatedAccount(initialDesktopSync = false): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    if (!isElectronRuntime()) {
      await this.initializeAuthenticatedWeb();
      return;
    }

    const deadline = initialDesktopSync ? Date.now() + 10_000 : undefined;
    const vaultRequest = this.http.get<CloudVault[]>(
      `${environment.apiUrl}/vaults`,
      { withCredentials: true },
    );
    const vaults = await firstValueFrom(deadline === undefined
      ? vaultRequest
      : vaultRequest.pipe(rxTimeout({ first: Math.max(1, deadline - Date.now()) })));
    const vault = vaults[0];
    if (!vault) throw new Error('Nenhum vault foi atribuído a esta conta.');
    this.vault.set(vault);
    if (this.desktopRecoveryRequired()) return;
    if (this.auth.syncEnabled()) {
      await this.syncEngine.start(vault.id, initialDesktopSync ? {
        initialTimeoutMs: Math.max(1, (deadline ?? Date.now() + 10_000) - Date.now()),
        metadataOnly: true,
        requireInitialSuccess: false,
      } : {});
    }
    this.desktopConnectRetryAttempt = 0;
    this.clearDesktopConnectRetry();
  }

  async closeWebWorkspace(clearCache: boolean): Promise<void> {
    if (isElectronRuntime()) return;

    this.syncEngine.stop();
    const user = this.auth.user();
    await this.dbProvider.flushPendingWrites();
    this.dbProvider.close();
    this.assetResolver.revokeAll();
    this.workspaceLock.release();
    this.vault.set(null);
    this.error.set(null);

    if (clearCache && user) {
      await this.browserStorage.deleteUser(user.id);
    }
  }

  async recoverDesktopFromCloud(): Promise<void> {
    if (!isElectronRuntime() || this.recovering()) return;
    if (!this.auth.isAuthenticated()) {
      const message = 'Conecte uma conta antes de baixar a vers\u00e3o da nuvem.';
      this.error.set(message);
      throw new Error(message);
    }

    this.recovering.set(true);
    this.error.set(null);
    try {
      const vault = this.vault() ?? await this.loadFirstVault();
      this.vault.set(vault);

      if (!this.dbProvider.ready()) {
        const backupPath = await this.preserveCorruptDesktopDatabase();
        this.recoveryBackupPath.set(backupPath);
        const database = await openSqliteDatabase();
        this.dbProvider.setDb(database);
        await persistDbToDisk(database);
      }

      this.auth.setSyncEnabled(true);
      this.auth.clearError();
      await this.syncEngine.start(vault.id);
      const syncError = this.auth.lastError();
      if (syncError) throw new Error(syncError);

      await this.dbProvider.flushPendingWrites();
      this.desktopRecoveryRequired.set(false);
      this.error.set(null);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'N\u00e3o foi poss\u00edvel baixar a vers\u00e3o da nuvem.';
      this.error.set(message);
      this.auth.markSyncError(message);
      throw error;
    } finally {
      this.recovering.set(false);
    }
  }

  private async loadFirstVault(): Promise<CloudVault> {
    const vaults = await firstValueFrom(
      this.http.get<CloudVault[]>(`${environment.apiUrl}/vaults`, { withCredentials: true }),
    );
    const vault = vaults[0];
    if (!vault) throw new Error('Nenhum vault foi atribu\u00eddo a esta conta.');
    return vault;
  }

  private async preserveCorruptDesktopDatabase(): Promise<string | null> {
    const dbPath = await ElectronSafeAPI.electron.getDbPath();
    const bytes = await ElectronSafeAPI.electron.readFile(dbPath);
    if (!bytes) return null;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${dbPath}.corrupt-${timestamp}.bak`;
    await ElectronSafeAPI.electron.writeFile(backupPath, bytes);
    return backupPath;
  }

  private async openAuthenticatedWebWorkspace(): Promise<void> {
    const user = this.auth.user();
    if (!user) {
      throw new Error('Uma conta é obrigatória para abrir o Lorekit web.');
    }

    this.error.set(null);
    try {
      const vaults = await firstValueFrom(
        this.http.get<CloudVault[]>(`${environment.apiUrl}/vaults`, { withCredentials: true }),
      );
      const vault = vaults[0];
      if (!vault) {
        throw new Error('Nenhum vault foi atribuído a esta conta.');
      }

      const workspaceKey = this.browserStorage.workspaceKey(user.id, vault.id);
      const writerLockAcquired = await this.workspaceLock.acquire(workspaceKey);
      const data = await this.browserStorage.read(user.id, vault.id);
      const database = await openSqliteDatabase(data);

      this.dbProvider.setDb(
        database,
        async db => {
          await this.browserStorage.write(user.id, vault.id, db.export());
        },
        !writerLockAcquired,
      );
      this.vault.set(vault);

      if (writerLockAcquired) {
        database.run(
          `INSERT INTO "_SyncState" ("key", "value") VALUES ('vaultId', ?)
           ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`,
          [vault.id],
        );
        if (this.auth.syncEnabled()) {
          await this.syncEngine.start(vault.id, {
            metadataOnly: false,
            requireInitialSuccess: true,
          });
        }
        this.dbProvider.requestPersist();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível abrir o workspace web.';
      this.error.set(message);
      throw error;
    }
  }

  private scheduleDesktopConnectRetry(error: unknown): void {
    const message = error instanceof Error
      ? error.message
      : 'N\u00e3o foi poss\u00edvel verificar os dados da nuvem.';
    this.auth.markSyncError(message);
    if (this.desktopConnectRetryTimer !== null) return;

    const exponential = Math.min(300_000, 2_000 * (2 ** this.desktopConnectRetryAttempt));
    const jitter = 0.75 + Math.random() * 0.5;
    const delay = Math.round(exponential * jitter);
    this.desktopConnectRetryAttempt = Math.min(this.desktopConnectRetryAttempt + 1, 8);
    this.desktopConnectRetryTimer = window.setTimeout(() => {
      this.desktopConnectRetryTimer = null;
      if (
        !isElectronRuntime()
        || !this.dbProvider.ready()
        || !this.auth.isAuthenticated()
        || !this.auth.syncEnabled()
      ) return;
      void this.connectAuthenticatedAccount(true).catch(nextError => {
        this.scheduleDesktopConnectRetry(nextError);
      });
    }, delay);
  }

  private clearDesktopConnectRetry(): void {
    if (this.desktopConnectRetryTimer !== null) {
      window.clearTimeout(this.desktopConnectRetryTimer);
      this.desktopConnectRetryTimer = null;
    }
  }
}
