import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Database, QueryExecResult, SqlValue } from 'sql.js';
import { environment } from '../../enviroments/environment';
import { BrowserDatabaseStorageService, isStorageQuotaError } from '../database/browser-database-storage.service';
import { ElectronSafeAPI } from '../database/database.helper';
import { DbProvider } from '../database/db-provider.service';
import { SYNC_ENTITIES } from '../database/sync-entity-registry';
import { buildImageUrl, clearAssetUrl, registerAssetUrl, setAssetUrlRequestHandler } from '../models/image.model';
import { isElectronRuntime } from '../utils/runtime-platform';
import { AuthService } from './auth.service';
import { CloudTransferPacerService } from './cloud-transfer-pacer.service';

const ASSET_REFERENCE_PATTERN = /lorekit-asset:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

@Injectable({ providedIn: 'root' })
export class AssetResolverService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly dbProvider = inject(DbProvider);
  private readonly browserStorage = inject(BrowserDatabaseStorageService);
  private readonly transferPacer = inject(CloudTransferPacerService);
  private readonly objectUrls = new Map<string, string>();
  private backgroundHydration: Promise<void> | null = null;
  private readonly pendingResolutions = new Map<string, Promise<void>>();
  private currentVaultId: string | null = null;

  constructor() {
    setAssetUrlRequestHandler(blobId => this.resolveOnDemand(blobId));
  }

  prepareAssets(vaultId: string): void {
    this.currentVaultId = vaultId;
    if (isElectronRuntime()) this.hydrateInBackground(vaultId);
  }

  private hydrateInBackground(vaultId: string): void {
    if (this.backgroundHydration) return;

    const hydration = new Promise<void>(resolve => window.setTimeout(resolve, 0))
      .then(async () => {
        await this.hydrateImages(vaultId);
        await this.hydrateCanonicalReferences(vaultId);
      })
      .catch(error => {
        console.warn('Falha ao hidratar imagens em segundo plano.', error);
      })
      .finally(() => {
        if (this.backgroundHydration === hydration) this.backgroundHydration = null;
      });
    this.backgroundHydration = hydration;
  }

  hydrateLocalAssets(): void {
    if (!this.dbProvider.ready() || !isElectronRuntime()) return;
    const db = this.dbProvider.getDb<Database>();
    for (const row of resultRows(db.exec(
      `SELECT "blobId", "filePath" FROM "Image" WHERE "blobId" IS NOT NULL AND "filePath" <> ''`,
    ))) {
      this.registerLocal(String(row['blobId']), String(row['filePath']));
    }
    for (const row of resultRows(db.exec(
      `SELECT "blobId", "cacheKey" FROM "_LocalBlobCache" WHERE "cacheKey" <> ''`,
    ))) {
      this.registerLocal(String(row['blobId']), String(row['cacheKey']));
    }
  }

  async hydrateImages(vaultId: string): Promise<void> {
    const user = this.auth.user();
    if (!user || !this.dbProvider.ready()) return;
    const db = this.dbProvider.getDb<Database>();
    const updates: Array<{ id: SqlValue; path: string }> = [];
    const persistLocalPaths = isElectronRuntime();
    for (const row of resultRows(db.exec(
      `SELECT "id", "blobId", "filePath", "mimeType", "sha256" FROM "Image" WHERE "blobId" IS NOT NULL`,
    ))) {
      const update = {
        id: row['id'],
        path: await this.resolve(
          user.id,
          vaultId,
          String(row['blobId']),
          typeof row['filePath'] === 'string' ? row['filePath'] : '',
          typeof row['mimeType'] === 'string' ? row['mimeType'] : 'image/jpeg',
          typeof row['sha256'] === 'string' ? row['sha256'] : '',
        ),
      };
      if (persistLocalPaths) updates.push(update);
    }
    if (!persistLocalPaths || !updates.length) return;

    db.exec('BEGIN IMMEDIATE');
    try {
      db.run(`UPDATE "_SyncControl" SET "suppressCapture" = 1 WHERE "id" = 1`);
      for (const update of updates) {
        db.run(`UPDATE "Image" SET "filePath" = ? WHERE "id" = ?`, [update.path, update.id]);
      }
      db.run(`UPDATE "_SyncControl" SET "suppressCapture" = 0 WHERE "id" = 1`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    if (!this.dbProvider.readOnly()) this.dbProvider.requestPersist();
  }

  async hydrateCanonicalReferences(vaultId: string): Promise<void> {
    const user = this.auth.user();
    if (!user || !this.dbProvider.ready()) return;
    const db = this.dbProvider.getDb<Database>();
    const blobIds = new Set<string>();
    for (const definition of SYNC_ENTITIES) {
      for (const row of resultRows(db.exec(`SELECT * FROM ${quoteIdentifier(definition.entityType)}`))) {
        for (const value of Object.values(row)) {
          if (typeof value !== 'string') continue;
          ASSET_REFERENCE_PATTERN.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = ASSET_REFERENCE_PATTERN.exec(value)) !== null) blobIds.add(match[1]);
        }
      }
    }

    for (const blobId of blobIds) {
      const cached = resultRows(db.exec(
        `SELECT "cacheKey", "mimeType", "sha256" FROM "_LocalBlobCache" WHERE "blobId" = ?`,
        [blobId],
      ))[0];
      await this.resolve(
        user.id,
        vaultId,
        blobId,
        isElectronRuntime() && typeof cached?.['cacheKey'] === 'string' ? cached['cacheKey'] : '',
        typeof cached?.['mimeType'] === 'string' ? cached['mimeType'] : 'image/jpeg',
        typeof cached?.['sha256'] === 'string' ? cached['sha256'] : '',
      );
    }
  }

  registerBrowserBytes(blobId: string, bytes: ArrayBuffer, mimeType: string): string {
    return this.createObjectUrl(blobId, bytes, mimeType);
  }

  registerLocal(blobId: string, renderableUrl: string): void {
    registerAssetUrl(blobId, buildImageUrl(renderableUrl));
  }

  revokeAll(): void {
    this.currentVaultId = null;
    for (const [blobId, url] of this.objectUrls) {
      URL.revokeObjectURL(url);
      clearAssetUrl(blobId);
    }
    this.objectUrls.clear();
  }

  private resolveOnDemand(blobId: string): void {
    if (this.pendingResolutions.has(blobId) || !this.dbProvider.ready()) return;
    const user = this.auth.user();
    const vaultId = this.currentVaultId;
    if (!user || !vaultId) return;

    const db = this.dbProvider.getDb<Database>();
    const image = resultRows(db.exec(
      `SELECT "filePath", "mimeType", "sha256" FROM "Image" WHERE "blobId" = ? LIMIT 1`,
      [blobId],
    ))[0];
    const cached = resultRows(db.exec(
      `SELECT "cacheKey", "mimeType", "sha256" FROM "_LocalBlobCache" WHERE "blobId" = ? LIMIT 1`,
      [blobId],
    ))[0];
    const localPath = isElectronRuntime()
      ? String(image?.['filePath'] || cached?.['cacheKey'] || '')
      : '';
    const mimeType = String(image?.['mimeType'] || cached?.['mimeType'] || 'image/jpeg');
    const sha256 = String(image?.['sha256'] || cached?.['sha256'] || '');

    const resolution = this.resolve(
      user.id,
      vaultId,
      blobId,
      localPath,
      mimeType,
      sha256,
    )
      .then(() => undefined)
      .catch(error => {
        console.warn(`Falha ao carregar a imagem ${blobId}.`, error);
      })
      .finally(() => {
        if (this.pendingResolutions.get(blobId) === resolution) {
          this.pendingResolutions.delete(blobId);
        }
      });
    this.pendingResolutions.set(blobId, resolution);
  }

  private async resolve(
    userId: string,
    vaultId: string,
    blobId: string,
    localPath: string,
    mimeType: string,
    sha256: string,
  ): Promise<string> {
    if (localPath && isElectronRuntime()) {
      this.registerLocal(blobId, localPath);
      return localPath;
    }

    if (!isElectronRuntime()) {
      const activeUrl = this.objectUrls.get(blobId);
      if (activeUrl) return activeUrl;
    }

    if (!isElectronRuntime()) {
      const cached = await this.browserStorage.readBlob(userId, vaultId, blobId);
      if (cached) return this.createObjectUrl(blobId, cached.bytes, cached.mimeType);
    }

    await this.transferPacer.waitForTurn();
    const blob = await firstValueFrom(this.http.get(
      `${environment.apiUrl}/vaults/${vaultId}/blobs/${blobId}`,
      { responseType: 'blob' },
    ));
    const bytes = await blob.arrayBuffer();
    const resolvedMimeType = blob.type || mimeType;

    if (!isElectronRuntime()) {
      const hasCacheCapacity = await this.browserStorage.canCache(bytes.byteLength);
      try {
        if (!hasCacheCapacity) return this.createObjectUrl(blobId, bytes, resolvedMimeType);
        await this.browserStorage.writeBlob({
          userId,
          vaultId,
          blobId,
          bytes,
          mimeType: resolvedMimeType,
          sha256,
          updatedAt: new Date().toISOString(),
          evictable: true,
        });
      } catch (error) {
        if (!isStorageQuotaError(error)) throw error;
        console.warn(`Blob ${blobId} exibido sem cache local por falta de espaço.`);
      }
      return this.createObjectUrl(blobId, bytes, resolvedMimeType);
    }

    const imagesDirectory = await ElectronSafeAPI.electron.getImagePath();
    const path = `${imagesDirectory}/cloud/${vaultId}/${blobId}.${extensionForMime(resolvedMimeType)}`;
    await ElectronSafeAPI.electron.writeFile(path, new Uint8Array(bytes));
    this.dbProvider.getDb<Database>().run(
      `INSERT INTO "_LocalBlobCache" ("blobId", "cacheKey", "mimeType", "sha256", "updatedAt")
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT("blobId") DO UPDATE SET
         "cacheKey" = excluded."cacheKey", "mimeType" = excluded."mimeType",
         "sha256" = excluded."sha256", "updatedAt" = excluded."updatedAt"`,
      [blobId, path, resolvedMimeType, sha256, new Date().toISOString()],
    );
    this.registerLocal(blobId, path);
    return path;
  }

  private createObjectUrl(blobId: string, bytes: ArrayBuffer, mimeType: string): string {
    const previousUrl = this.objectUrls.get(blobId);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    this.objectUrls.set(blobId, url);
    registerAssetUrl(blobId, url);
    return url;
  }
}

function resultRows(result: QueryExecResult[]): Record<string, SqlValue>[] {
  if (!result.length) return [];
  const [query] = result;
  return query.values.map(values => Object.fromEntries(
    query.columns.map((column, index) => [column, values[index]]),
  ));
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/avif') return 'avif';
  return 'jpg';
}
