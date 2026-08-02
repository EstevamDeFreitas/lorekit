import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { DbProvider } from '../database/db-provider.service';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { openDbAndEnsureSchema, openSqliteDatabase } from '../database/database.helper';
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

  readonly vault = signal<CloudVault | null>(null);
  readonly error = signal<string | null>(null);

  async initializeDesktop(): Promise<void> {
    if (!isElectronRuntime()) return;
    if (this.dbProvider.ready()) return;
    const database = await openDbAndEnsureSchema();
    this.dbProvider.setDb(database);
    this.assetResolver.hydrateLocalAssets();
    if (this.auth.isAuthenticated() && this.auth.syncEnabled()) {
      await this.connectAuthenticatedAccount();
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

  async connectAuthenticatedAccount(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    if (!isElectronRuntime()) {
      await this.initializeAuthenticatedWeb();
      return;
    }

    const vaults = await firstValueFrom(
      this.http.get<CloudVault[]>(`${environment.apiUrl}/vaults`, { withCredentials: true }),
    );
    const vault = vaults[0];
    if (!vault) throw new Error('Nenhum vault foi atribuído a esta conta.');
    this.vault.set(vault);
    if (this.auth.syncEnabled()) {
      await this.syncEngine.start(vault.id);
    }
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
        if (this.auth.syncEnabled()) await this.syncEngine.start(vault.id);
        this.dbProvider.requestPersist();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível abrir o workspace web.';
      this.error.set(message);
      throw error;
    }
  }
}
