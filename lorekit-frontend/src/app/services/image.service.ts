import { inject, Injectable } from '@angular/core';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { CrudHelper, ElectronSafeAPI } from '../database/database.helper';
import { DbProvider } from '../database/db-provider.service';
import { assetIdFromReference, buildImageRecordUrl, buildImageUrl, canonicalAssetReference, clearAssetUrl, Image } from '../models/image.model';
import { isElectronRuntime } from '../utils/runtime-platform';
import { AssetResolverService } from './asset-resolver.service';
import { AuthService } from './auth.service';
import { WorkspaceRuntimeService } from './workspace-runtime.service';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

@Injectable({ providedIn: 'root' })
export class ImageService {
  private readonly dbProvider = inject(DbProvider);
  private readonly browserStorage = inject(BrowserDatabaseStorageService);
  private readonly auth = inject(AuthService);
  private readonly workspace = inject(WorkspaceRuntimeService);
  private readonly assetResolver = inject(AssetResolverService);

  async uploadImage(file: File, entityTable: string, entityId: string, usageKey: string): Promise<Image> {
    this.validateFile(file);
    const imageGuid = crypto.randomUUID();
    const arrayBuffer = await file.arrayBuffer();
    const sha256 = await sha256Hex(arrayBuffer);
    const localPath = await this.storeLocalBlob(imageGuid, file, arrayBuffer, entityTable, sha256);
    const image = new Image(imageGuid, usageKey, localPath, imageGuid, file.name, file.type, sha256);

    this.dbProvider.getDb().run(
      `INSERT INTO "_BlobOutbox" (
        "blobId", "localPath", "mimeType", "originalName", "sha256", "state", "createdAt", "lastError"
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)
      ON CONFLICT("blobId") DO UPDATE SET
        "localPath" = excluded."localPath",
        "mimeType" = excluded."mimeType",
        "originalName" = excluded."originalName",
        "sha256" = excluded."sha256",
        "state" = 'pending',
        "lastError" = NULL`,
      [imageGuid, isElectronRuntime() ? localPath : null, file.type, file.name, sha256, new Date().toISOString()],
    );

    this.crud.create('Image', image);
    this.crud.create('Relationship', {
      parentTable: entityTable,
      parentId: entityId,
      entityTable: 'Image',
      entityId: image.id,
    });
    this.dbProvider.requestPersist();
    return image;
  }

  getImages(entityTable: string, entityId: string, usageKey: string): Image[] {
    const entity = this.crud.findById(entityTable, entityId, [{ table: 'Image', firstOnly: false }]);
    let images: Image[] = entity.Images || [];
    if (usageKey) images = images.filter(image => image.usageKey === usageKey);
    return images;
  }

  getImage(entityTable: string, entityId: string, usageKey: string): Image | null {
    return this.getImages(entityTable, entityId, usageKey)[0] ?? null;
  }

  referenceFor(image: Pick<Image, 'blobId' | 'filePath'>): string {
    return image.blobId ? canonicalAssetReference(image.blobId) : image.filePath;
  }

  renderUrl(value: string | Pick<Image, 'blobId' | 'filePath'> | null | undefined): string {
    return typeof value === 'string' ? buildImageUrl(value) : buildImageRecordUrl(value);
  }

  async uploadStandaloneImage(blob: Blob, directory = 'dynamic'): Promise<string> {
    const extension = extensionForMime(blob.type);
    const blobId = crypto.randomUUID();
    const file = new File([blob], `${blobId}.${extension}`, { type: blob.type });
    this.validateFile(file);
    const bytes = await file.arrayBuffer();
    const sha256 = await sha256Hex(bytes);
    const localPath = await this.storeLocalBlob(blobId, file, bytes, directory, sha256);
    const now = new Date().toISOString();

    this.dbProvider.getDb().run(
      `INSERT INTO "_BlobOutbox" (
        "blobId", "localPath", "mimeType", "originalName", "sha256", "state", "createdAt", "lastError"
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)
      ON CONFLICT("blobId") DO UPDATE SET
        "localPath" = excluded."localPath", "mimeType" = excluded."mimeType",
        "originalName" = excluded."originalName", "sha256" = excluded."sha256",
        "state" = 'pending', "lastError" = NULL`,
      [blobId, isElectronRuntime() ? localPath : null, file.type, file.name, sha256, now],
    );
    this.dbProvider.getDb().run(
      `INSERT INTO "_LocalBlobCache" ("blobId", "cacheKey", "mimeType", "sha256", "updatedAt")
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT("blobId") DO UPDATE SET
         "cacheKey" = excluded."cacheKey", "mimeType" = excluded."mimeType",
         "sha256" = excluded."sha256", "updatedAt" = excluded."updatedAt"`,
      [blobId, isElectronRuntime() ? localPath : blobId, file.type, sha256, now],
    );
    this.dbProvider.requestPersist();
    return canonicalAssetReference(blobId);
  }

  async deleteAssetReference(reference: string): Promise<void> {
    const blobId = assetIdFromReference(reference);
    if (!blobId) {
      if (reference && isElectronRuntime()) await ElectronSafeAPI.electron.deleteFile(reference);
      return;
    }

    const db = this.dbProvider.getDb();
    const imageReferenceCount = Number(db.exec(
      `SELECT COUNT(*) FROM "Image" WHERE "blobId" = ?`,
      [blobId],
    )[0]?.values[0]?.[0] ?? 0);
    if (imageReferenceCount > 0) return;

    const cacheResult = db.exec(
      `SELECT "mimeType", "sha256" FROM "_LocalBlobCache" WHERE "blobId" = ?`,
      [blobId],
    );
    const cacheRow = cacheResult[0]?.values[0];
    const mimeType = typeof cacheRow?.[0] === 'string' ? cacheRow[0] : 'image/jpeg';
    const sha256 = typeof cacheRow?.[1] === 'string' ? cacheRow[1] : '';

    db.run(
      `INSERT INTO "_BlobOutbox" (
        "blobId", "localPath", "mimeType", "originalName", "sha256", "state", "createdAt", "lastError"
      ) VALUES (?, NULL, ?, NULL, ?, 'delete', ?, NULL)
      ON CONFLICT("blobId") DO UPDATE SET "state" = 'delete', "lastError" = NULL`,
      [blobId, mimeType, sha256, new Date().toISOString()],
    );
    const user = this.auth.user();
    const vault = this.workspace.vault();
    if (!isElectronRuntime() && user && vault) {
      db.run(`DELETE FROM "_LocalBlobCache" WHERE "blobId" = ?`, [blobId]);
      await this.browserStorage.deleteBlob(user.id, vault.id, blobId);
      clearAssetUrl(blobId);
    }
    this.dbProvider.requestPersist();
  }

  async deleteImage(id: string, deleteRelated = false): Promise<void> {
    const img = this.crud.findById('Image', id);
    if (!img) return;

    if (isElectronRuntime() && img.filePath) await ElectronSafeAPI.electron.deleteFile(img.filePath);
    if (img.blobId) {
      this.dbProvider.getDb().run(
        `INSERT INTO "_BlobOutbox" (
          "blobId", "localPath", "mimeType", "originalName", "sha256", "state", "createdAt", "lastError"
        ) VALUES (?, NULL, ?, ?, ?, 'delete', ?, NULL)
        ON CONFLICT("blobId") DO UPDATE SET "state" = 'delete', "lastError" = NULL`,
        [img.blobId, img.mimeType || 'image/jpeg', img.originalName || null, img.sha256 || '', new Date().toISOString()],
      );
      clearAssetUrl(img.blobId);
      const user = this.auth.user();
      const vault = this.workspace.vault();
      if (!isElectronRuntime() && user && vault) {
        await this.browserStorage.deleteBlob(user.id, vault.id, img.blobId);
      }
    }
    this.crud.delete('Image', id, deleteRelated);
    this.dbProvider.requestPersist();
  }

  private get crud(): CrudHelper {
    return this.dbProvider.getCrudHelper();
  }

  private validateFile(file: File): void {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error('Formato de imagem n\u00e3o permitido. Use PNG, JPEG, WebP, GIF ou AVIF.');
    }
    if (file.size > MAX_IMAGE_BYTES) throw new Error('A imagem excede o limite de 25 MiB.');
  }

  private async storeLocalBlob(
    blobId: string,
    file: File,
    bytes: ArrayBuffer,
    entityTable: string,
    sha256: string,
  ): Promise<string> {
    if (isElectronRuntime()) {
      const imagesDir = await ElectronSafeAPI.electron.getImagePath();
      const extension = file.name.split('.').pop() || extensionForMime(file.type);
      const fullPath = `${imagesDir}/${entityTable.toLowerCase()}/${Date.now()}-${blobId}.${extension}`;
      await ElectronSafeAPI.electron.writeFile(fullPath, new Uint8Array(bytes));
      this.assetResolver.registerLocal(blobId, fullPath);
      return fullPath;
    }

    const user = this.auth.user();
    const vault = this.workspace.vault();
    if (!user || !vault) throw new Error('O workspace web ainda n\u00e3o est\u00e1 pronto.');
    await this.browserStorage.writeBlob({
      userId: user.id,
      vaultId: vault.id,
      blobId,
      bytes,
      mimeType: file.type,
      sha256,
      updatedAt: new Date().toISOString(),
      evictable: false,
    });
    return this.assetResolver.registerBrowserBytes(blobId, bytes, file.type);
  }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/avif') return 'avif';
  return 'jpg';
}
