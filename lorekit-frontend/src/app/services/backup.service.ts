import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { Database, QueryExecResult, SqlValue } from 'sql.js';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { ElectronSafeAPI, openSqliteDatabase } from '../database/database.helper';
import { DbProvider } from '../database/db-provider.service';
import { SYNC_ENTITIES } from '../database/sync-entity-registry';
import { isElectronRuntime } from '../utils/runtime-platform';
import { AssetResolverService } from './asset-resolver.service';
import { AuthService } from './auth.service';
import { CloudSyncApiService } from './cloud-sync-api.service';
import { SyncEngineService } from './sync-engine.service';
import { WorkspaceRuntimeService } from './workspace-runtime.service';

declare const window: any;

const CLOUD_BACKUP_MAGIC = new TextEncoder().encode('LOREKIT-CLOUD-BACKUP-1\0');

export type BackupStatus =
  | { state: 'idle' }
  | { state: 'processing' }
  | { state: 'success'; message: string }
  | { state: 'error'; message: string };

interface BackupImageEntryV1 {
  id: string;
  relativePath: string;
  dataBase64: string;
}

interface BackupBlobEntryV2 {
  blobId: string;
  mimeType: string;
  sha256: string;
  originalName: string;
  dataBase64: string;
}

interface LorekitFullBackup {
  format: 'lorekit-full-backup';
  version: 1 | 2;
  exportedAt: string;
  appVersion: string;
  database: string;
  imageRootUsed?: string;
  images?: BackupImageEntryV1[];
  blobs?: BackupBlobEntryV2[];
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  readonly status$ = new BehaviorSubject<BackupStatus>({ state: 'idle' });

  constructor(
    private readonly dbProvider: DbProvider,
    private readonly browserStorage: BrowserDatabaseStorageService,
    private readonly auth: AuthService,
    private readonly workspace: WorkspaceRuntimeService,
    private readonly assetResolver: AssetResolverService,
    private readonly syncEngine: SyncEngineService,
    private readonly cloudApi: CloudSyncApiService,
  ) {}

  async exportBackup(): Promise<void> {
    this.status$.next({ state: 'processing' });
    try {
      if (this.usesCloudBackup()) {
        await this.exportCloudBackup();
        return;
      }
      await this.dbProvider.flushPendingWrites();
      const db = this.dbProvider.getDb<Database>();
      const blobs = await this.collectBlobs(db);
      const appVersion = isElectronRuntime()
        ? (await ElectronSafeAPI.electron.getAppVersion?.()) ?? 'unknown'
        : 'web';
      const bundle: LorekitFullBackup = {
        format: 'lorekit-full-backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        appVersion,
        database: await this.uint8ToBase64(db.export()),
        blobs,
      };
      const filename = `lorekit-backup-${new Date().toISOString().slice(0, 10)}.lorekit`;
      const encoded = new TextEncoder().encode(JSON.stringify(bundle));

      if (isElectronRuntime()) {
        const chosenPath: string | null = await (window?.electronAPI?.showSaveDialog?.(filename) ?? null);
        if (!chosenPath) {
          this.status$.next({ state: 'idle' });
          return;
        }
        await ElectronSafeAPI.electron.writeFile(chosenPath, encoded);
      } else {
        this.download(filename, encoded);
      }
      this.status$.next({ state: 'success', message: 'Backup v2 exportado com sucesso!' });
    } catch (error) {
      this.status$.next({ state: 'error', message: errorMessage(error, 'Erro ao exportar backup.') });
    }
  }

  async importBackup(file: File): Promise<void> {
    const isCloudBackup = await this.isCloudBackupFile(file);
    if (isCloudBackup) {
      if (!this.usesCloudBackup()) {
        this.status$.next({
          state: 'error',
          message: 'Este backup foi gerado pela nuvem. Conecte a conta e habilite a sincronização para restaurá-lo.',
        });
        return;
      }
      await this.restoreCloudBackup(file);
      return;
    }
    const legacyMessage = this.usesCloudBackup()
      ? 'Este backup legado será restaurado localmente. Ao reiniciar, confirme o envio para a nuvem se desejar vinculá-lo à conta atual. Esta ação não pode ser desfeita. Deseja continuar?'
      : 'Restaurar este backup substituirá os dados locais atuais. Esta ação não pode ser desfeita. Deseja continuar?';
    if (!window.confirm(legacyMessage)) return;
    this.status$.next({ state: 'processing' });
    try {
      const bundle = this.parseBundle(await file.text());
      const restoredDb = await openSqliteDatabase(this.base64ToUint8(bundle.database));
      this.syncEngine.stop();
      this.assetResolver.revokeAll();
      this.resetDeviceSyncMetadata(restoredDb);
      await this.restoreBlobs(restoredDb, bundle);
      this.markAllRecordsDirty(restoredDb);

      this.dbProvider.replaceDb(restoredDb);
      this.dbProvider.requestPersist();
      await this.dbProvider.flushPendingWrites();
      this.status$.next({ state: 'success', message: 'Backup restaurado! Reiniciando...' });
      setTimeout(() => {
        if (isElectronRuntime()) window?.electronAPI?.reloadApp?.();
        else window.location.reload();
      }, 800);
    } catch (error) {
      this.status$.next({ state: 'error', message: errorMessage(error, 'Erro ao restaurar backup.') });
    }
  }

  private async isCloudBackupFile(file: File): Promise<boolean> {
    const prefix = new Uint8Array(await file.slice(0, CLOUD_BACKUP_MAGIC.length).arrayBuffer());
    return prefix.length === CLOUD_BACKUP_MAGIC.length
      && prefix.every((value, index) => value === CLOUD_BACKUP_MAGIC[index]);
  }

  private usesCloudBackup(): boolean {
    return Boolean(
      this.auth.isAuthenticated()
      && this.auth.syncEnabled()
      && this.workspace.vault()
      && navigator.onLine,
    );
  }

  private async exportCloudBackup(): Promise<void> {
    const vault = this.workspace.vault();
    if (!vault) throw new Error('Nenhum vault sincronizado está disponível para exportação.');

    this.auth.clearError();
    await this.dbProvider.flushPendingWrites();
    await this.syncEngine.syncNow();
    if (this.auth.lastError()) {
      throw new Error(`A sincronização precisa terminar antes do backup: ${this.auth.lastError()}`);
    }

    const backup = await this.cloudApi.downloadBackup(vault.id);
    const filename = `lorekit-backup-${new Date().toISOString().slice(0, 10)}.lorekit`;
    if (isElectronRuntime()) {
      const chosenPath: string | null = await (window?.electronAPI?.showSaveDialog?.(filename) ?? null);
      if (!chosenPath) {
        this.status$.next({ state: 'idle' });
        return;
      }
      await ElectronSafeAPI.electron.writeFile(chosenPath, new Uint8Array(await backup.arrayBuffer()));
    } else {
      this.downloadBlob(filename, backup);
    }
    this.status$.next({ state: 'success', message: 'Backup da nuvem exportado com sucesso!' });
  }

  private async restoreCloudBackup(file: File): Promise<void> {
    const vault = this.workspace.vault();
    if (!vault) throw new Error('Nenhum vault sincronizado está disponível para restauração.');
    const accepted = window.confirm(
      'A restauração substituirá definitivamente o vault na nuvem para todos os dispositivos vinculados. Esta ação não pode ser desfeita. Deseja continuar?',
    );
    if (!accepted) return;

    this.status$.next({ state: 'processing' });
    try {
      await this.cloudApi.restoreBackup(vault.id, file);
      this.syncEngine.stop();
      this.assetResolver.revokeAll();
      if (isElectronRuntime()) {
        await ElectronSafeAPI.electron.clearWorkspaceForCloudRestore?.();
      } else {
        const user = this.auth.user();
        this.dbProvider.close();
        if (user) await this.browserStorage.deleteUser(user.id);
      }
      this.status$.next({ state: 'success', message: 'Backup restaurado na nuvem! Reiniciando...' });
      setTimeout(() => {
        if (isElectronRuntime()) void ElectronSafeAPI.electron.restartApp?.();
        else window.location.reload();
      }, 800);
    } catch (error) {
      this.status$.next({ state: 'error', message: errorMessage(error, 'Erro ao restaurar backup na nuvem.') });
    }
  }

  private async collectBlobs(db: Database): Promise<BackupBlobEntryV2[]> {
    const candidates = new Map<string, { path: string; mimeType: string; sha256: string; originalName: string }>();
    for (const row of rows(db.exec(
      `SELECT "blobId", "filePath", "mimeType", "sha256", "originalName" FROM "Image" WHERE "blobId" IS NOT NULL`,
    ))) {
      candidates.set(String(row['blobId']), {
        path: typeof row['filePath'] === 'string' ? row['filePath'] : '',
        mimeType: typeof row['mimeType'] === 'string' ? row['mimeType'] : 'image/jpeg',
        sha256: typeof row['sha256'] === 'string' ? row['sha256'] : '',
        originalName: typeof row['originalName'] === 'string' ? row['originalName'] : String(row['blobId']),
      });
    }
    for (const row of rows(db.exec(`SELECT * FROM "_LocalBlobCache"`))) {
      const blobId = String(row['blobId']);
      const current = candidates.get(blobId);
      candidates.set(blobId, {
        path: typeof row['cacheKey'] === 'string' ? row['cacheKey'] : current?.path ?? '',
        mimeType: typeof row['mimeType'] === 'string' ? row['mimeType'] : current?.mimeType ?? 'image/jpeg',
        sha256: typeof row['sha256'] === 'string' ? row['sha256'] : current?.sha256 ?? '',
        originalName: current?.originalName ?? blobId,
      });
    }

    const result: BackupBlobEntryV2[] = [];
    const user = this.auth.user();
    const vault = this.workspace.vault();
    for (const [blobId, metadata] of candidates) {
      let binary: Uint8Array | null = null;
      if (isElectronRuntime() && metadata.path) {
        const read = await ElectronSafeAPI.electron.readFile(metadata.path);
        if (read) binary = read instanceof Uint8Array ? read : new Uint8Array(read);
      } else if (user && vault) {
        const cached = await this.browserStorage.readBlob(user.id, vault.id, blobId);
        if (cached) binary = new Uint8Array(cached.bytes);
      }
      if (!binary) continue;
      result.push({
        blobId,
        mimeType: metadata.mimeType,
        sha256: metadata.sha256 || await sha256Hex(binary),
        originalName: metadata.originalName,
        dataBase64: await this.uint8ToBase64(binary),
      });
    }
    return result;
  }

  private async restoreBlobs(db: Database, bundle: LorekitFullBackup): Promise<void> {
    db.run(`UPDATE "_SyncControl" SET "suppressCapture" = 1 WHERE "id" = 1`);
    db.run(`UPDATE "Image" SET "filePath" = ''`);
    db.run(`DELETE FROM "_LocalBlobCache"`);
    const entries = bundle.version === 2
      ? bundle.blobs ?? []
      : await this.convertV1Images(db, bundle.images ?? []);

    for (const entry of entries) {
      const bytes = this.base64ToUint8(entry.dataBase64);
      const localPath = await this.storeRestoredBlob(entry, bytes);
      db.run(
        `UPDATE "Image" SET "filePath" = ?, "blobId" = ?, "originalName" = ?, "mimeType" = ?, "sha256" = ?
         WHERE "blobId" = ? OR ("blobId" IS NULL AND "id" = ?)`,
        [localPath, entry.blobId, entry.originalName, entry.mimeType, entry.sha256, entry.blobId, entry.blobId],
      );
      db.run(
        `INSERT INTO "_LocalBlobCache" ("blobId", "cacheKey", "mimeType", "sha256", "updatedAt") VALUES (?, ?, ?, ?, ?)`,
        [entry.blobId, localPath || entry.blobId, entry.mimeType, entry.sha256, new Date().toISOString()],
      );
      db.run(
        `INSERT INTO "_BlobOutbox" (
          "blobId", "localPath", "mimeType", "originalName", "sha256", "state", "createdAt", "lastError"
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)`,
        [entry.blobId, isElectronRuntime() ? localPath : null, entry.mimeType, entry.originalName, entry.sha256, new Date().toISOString()],
      );
    }
    db.run(`UPDATE "_SyncControl" SET "suppressCapture" = 0 WHERE "id" = 1`);
  }

  private async storeRestoredBlob(entry: BackupBlobEntryV2, bytes: Uint8Array): Promise<string> {
    if (isElectronRuntime()) {
      const root = await ElectronSafeAPI.electron.getImagePath();
      const path = `${root}/restored/${entry.blobId}.${extensionForMime(entry.mimeType)}`;
      await ElectronSafeAPI.electron.writeFile(path, bytes);
      return path;
    }
    const user = this.auth.user();
    const vault = this.workspace.vault();
    if (!user || !vault) throw new Error('O workspace web ainda não está pronto.');
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await this.browserStorage.writeBlob({
      userId: user.id,
      vaultId: vault.id,
      blobId: entry.blobId,
      bytes: copy,
      mimeType: entry.mimeType,
      sha256: entry.sha256,
      updatedAt: new Date().toISOString(),
      evictable: false,
    });
    return this.assetResolver.registerBrowserBytes(entry.blobId, copy, entry.mimeType);
  }

  private async convertV1Images(db: Database, images: BackupImageEntryV1[]): Promise<BackupBlobEntryV2[]> {
    const converted: BackupBlobEntryV2[] = [];
    for (const image of images) {
      if (!image.id || !image.dataBase64) continue;
      const bytes = this.base64ToUint8(image.dataBase64);
      const mimeType = mimeFromPath(image.relativePath);
      converted.push({
        blobId: isUuid(image.id) ? image.id : crypto.randomUUID(),
        mimeType,
        sha256: await sha256Hex(bytes),
        originalName: image.relativePath.split('/').pop() || image.id,
        dataBase64: image.dataBase64,
      });
    }
    return converted;
  }

  private resetDeviceSyncMetadata(db: Database): void {
    db.run(`UPDATE "_SyncControl" SET "suppressCapture" = 1 WHERE "id" = 1`);
    for (const table of ['_SyncDirty', '_SyncOutbox', '_SyncVersions', '_SyncState', '_SyncConflicts', '_BlobOutbox']) {
      db.run(`DELETE FROM ${quoteIdentifier(table)}`);
    }
  }

  private markAllRecordsDirty(db: Database): void {
    for (const definition of SYNC_ENTITIES) {
      db.exec(`
        INSERT INTO "_SyncDirty" ("entityType", "entityId", "operation", "changedAt")
        SELECT ${quoteLiteral(definition.entityType)}, CAST(${quoteIdentifier(definition.primaryKey)} AS TEXT),
               'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        FROM ${quoteIdentifier(definition.entityType)} WHERE 1
        ON CONFLICT("entityType", "entityId") DO UPDATE SET
          "operation" = 'upsert', "changedAt" = excluded."changedAt"
      `);
    }
    db.run(`UPDATE "_SyncControl" SET "suppressCapture" = 0 WHERE "id" = 1`);
  }

  private parseBundle(text: string): LorekitFullBackup {
    let bundle: LorekitFullBackup;
    try {
      bundle = JSON.parse(text) as LorekitFullBackup;
    } catch {
      throw new Error('Arquivo inválido: não foi possível interpretar o JSON.');
    }
    if (bundle?.format !== 'lorekit-full-backup' || ![1, 2].includes(bundle.version)) {
      throw new Error('Formato ou versão de backup não suportado.');
    }
    if (typeof bundle.database !== 'string' || !bundle.database) {
      throw new Error('Arquivo de backup corrompido: banco de dados ausente.');
    }
    return bundle;
  }

  private download(filename: string, bytes: Uint8Array): void {
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    this.downloadBlob(filename, new Blob([copy], { type: 'application/x-lorekit-backup' }));
  }

  private downloadBlob(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }

  private async uint8ToBase64(bytes: Uint8Array): Promise<string> {
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Não foi possível codificar o arquivo do backup.'));
      reader.readAsDataURL(new Blob([copy]));
    });
    return dataUrl.slice(dataUrl.indexOf(',') + 1);
  }

  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }
}

function rows(result: QueryExecResult[]): Record<string, SqlValue>[] {
  if (!result.length) return [];
  const [query] = result;
  return query.values.map(values => Object.fromEntries(
    query.columns.map((column, index) => [column, values[index]]),
  ));
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function mimeFromPath(path: string): string {
  const normalized = path.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg';
}

function extensionForMime(mimeType: string): string {
  return mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
