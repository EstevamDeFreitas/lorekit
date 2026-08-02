import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Database, QueryExecResult, SqlValue } from 'sql.js';
import { environment } from '../../enviroments/environment';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { ElectronSafeAPI } from '../database/database.helper';
import { DbProvider } from '../database/db-provider.service';
import { SYNC_ENTITIES } from '../database/sync-entity-registry';
import { buildImageUrl, clearAssetUrl, registerAssetUrl } from '../models/image.model';
import { isElectronRuntime } from '../utils/runtime-platform';
import { AuthService } from './auth.service';

const ASSET_REFERENCE_PATTERN = /lorekit-asset:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;

@Injectable({ providedIn: 'root' })
export class AssetResolverService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly dbProvider = inject(DbProvider);
  private readonly browserStorage = inject(BrowserDatabaseStorageService);
  private readonly objectUrls = new Map<string, string>();

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
    for (const row of resultRows(db.exec(
      `SELECT "id", "blobId", "filePath", "mimeType", "sha256" FROM "Image" WHERE "blobId" IS NOT NULL`,
    ))) {
      updates.push({
        id: row['id'],
        path: await this.resolve(
          user.id,
          vaultId,
          String(row['blobId']),
          typeof row['filePath'] === 'string' ? row['filePath'] : '',
          typeof row['mimeType'] === 'string' ? row['mimeType'] : 'image/jpeg',
          typeof row['sha256'] === 'string' ? row['sha256'] : '',
        ),
      });
    }
    if (!updates.length) return;

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
    for (const [blobId, url] of this.objectUrls) {
      URL.revokeObjectURL(url);
      clearAssetUrl(blobId);
    }
    this.objectUrls.clear();
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
      const cached = await this.browserStorage.readBlob(userId, vaultId, blobId);
      if (cached) return this.createObjectUrl(blobId, cached.bytes, cached.mimeType);
    }

    const blob = await firstValueFrom(this.http.get(
      `${environment.apiUrl}/vaults/${vaultId}/blobs/${blobId}`,
      { responseType: 'blob' },
    ));
    const bytes = await blob.arrayBuffer();
    const resolvedMimeType = blob.type || mimeType;

    if (!isElectronRuntime()) {
      await this.browserStorage.writeBlob({
        userId,
        vaultId,
        blobId,
        bytes,
        mimeType: resolvedMimeType,
        sha256,
        updatedAt: new Date().toISOString(),
      });
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
