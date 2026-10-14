import { inject, Injectable } from '@angular/core';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { CrudHelper, ElectronSafeAPI } from '../database/database.helper';
import { DbProvider } from '../database/db-provider.service';
import { assetIdFromReference, buildImageRecordUrl, buildImageUrl, canonicalAssetReference, clearAssetUrl, Image } from '../models/image.model';
import { isElectronRuntime } from '../utils/runtime-platform';
import { AssetResolverService } from './asset-resolver.service';
import { AuthService } from './auth.service';
import { WorkspaceRuntimeService } from './workspace-runtime.service';
import { EntityHistoryService } from './entity-history.service';
import { SYNC_ENTITIES } from '../database/sync-entity-registry';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { sha256 as portableSha256, validateRaster } from '../libs/entity-portability/entity-archive.codec';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export interface ReadableImageAsset {
  readonly bytes: ArrayBuffer;
  readonly mimeType: string;
  readonly sha256: string;
  readonly originalName: string | null;
}

export interface StagedImageAsset {
  readonly blobId: string;
  readonly reference: string;
  readonly sha256: string;
  readonly mimeType: string;
  readonly localPath: string | null;
}

@Injectable({ providedIn: 'root' })
export class ImageService {
  private readonly http = inject(HttpClient);
  private readonly dbProvider = inject(DbProvider);
  private readonly browserStorage = inject(BrowserDatabaseStorageService);
  private readonly auth = inject(AuthService);
  private readonly workspace = inject(WorkspaceRuntimeService);
  private readonly assetResolver = inject(AssetResolverService);
  private readonly history = inject(EntityHistoryService, { optional: true });

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

  async readAsset(reference: string): Promise<ReadableImageAsset> {
    const blobId = assetIdFromReference(reference);
    if (!blobId) throw new Error('A imagem do item não usa uma referência de asset válida.');
    const db = this.dbProvider.getDb();
    const image = db.exec(
      `SELECT "filePath", "originalName", "mimeType", "sha256" FROM "Image" WHERE "blobId" = ? LIMIT 1`,
      [blobId],
    )[0]?.values[0];
    const cache = db.exec(
      `SELECT "cacheKey", "mimeType", "sha256" FROM "_LocalBlobCache" WHERE "blobId" = ? LIMIT 1`,
      [blobId],
    )[0]?.values[0];
    const filePath = typeof image?.[0] === 'string' ? image[0] : typeof cache?.[0] === 'string' ? cache[0] : '';
    const mimeType = typeof image?.[2] === 'string' ? image[2] : typeof cache?.[1] === 'string' ? cache[1] : 'image/jpeg';
    const expectedSha256 = typeof image?.[3] === 'string' ? image[3] : typeof cache?.[2] === 'string' ? cache[2] : '';
    let bytes: ArrayBuffer | null = null;
    if (isElectronRuntime() && filePath) {
      const value = await ElectronSafeAPI.electron.readFile(filePath);
      bytes = value ? toArrayBuffer(value) : null;
    } else {
      const user = this.auth.user();
      const vault = this.workspace.vault();
      if (user && vault) {
        const cached = await this.browserStorage.readBlob(user.id, vault.id, blobId);
        bytes = cached?.bytes ?? null;
      }
    }
    if (!bytes) throw new Error('A imagem do item não está disponível localmente para exportação.');
    const sha256 = await sha256Hex(bytes);
    if (expectedSha256 && expectedSha256.toLowerCase() !== sha256) throw new Error('A imagem do item está corrompida ou não corresponde ao hash registrado.');
    return {
      bytes,
      mimeType,
      sha256,
      originalName: typeof image?.[1] === 'string' ? image[1] : null,
    };
  }

  async stagePortableAsset(asset: { bytes: ArrayBuffer; mimeType: string; sha256: string; originalName?: string | null }, operationId: string): Promise<StagedImageAsset> {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType)) throw new Error('Formato de imagem não permitido.');
    const blobId = crypto.randomUUID();
    const extension = extensionForMime(asset.mimeType);
    const file = new File([asset.bytes], asset.originalName || `${blobId}.${extension}`, { type: asset.mimeType });
    const localPath = await this.storeLocalBlob(blobId, file, asset.bytes, `ironpaw-import/${operationId}`, asset.sha256);
    const now = new Date().toISOString();
    const db = this.dbProvider.getDb();
    db.run(
      `INSERT INTO "_BlobOutbox" ("blobId", "localPath", "mimeType", "originalName", "sha256", "state", "createdAt", "lastError")
       VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)`,
      [blobId, isElectronRuntime() ? localPath : null, asset.mimeType, file.name, asset.sha256, now],
    );
    db.run(
      `INSERT INTO "_LocalBlobCache" ("blobId", "cacheKey", "mimeType", "sha256", "updatedAt")
       VALUES (?, ?, ?, ?, ?)`,
      [blobId, isElectronRuntime() ? localPath : blobId, asset.mimeType, asset.sha256, now],
    );
    return { blobId, reference: canonicalAssetReference(blobId), sha256: asset.sha256, mimeType: asset.mimeType, localPath: isElectronRuntime() ? localPath : null };
  }

  /** Entity packages read canonical blobs or legacy files inside the managed image root only. */
  async readEntityAsset(reference: string): Promise<ReadableImageAsset> {
    const embedded = reference.match(/^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/]*={0,2})$/);
    if (embedded) {
      if (embedded[2].length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) throw new Error('Imagem incorporada acima de 25 MiB.');
      const bytes = Uint8Array.from(atob(embedded[2]), char => char.charCodeAt(0)); validateRaster(bytes, embedded[1]);
      return { bytes: bytes.buffer, mimeType: embedded[1], sha256: await portableSha256(bytes), originalName: null };
    }
    if (/^lorekit-asset:\/\/[0-9a-f-]{36}$/i.test(reference)) {
      try { return await this.readAsset(reference); } catch (error) {
        if (!navigator.onLine || !this.auth.isAuthenticated() || !this.workspace.vault()) throw error;
        const id = reference.slice('lorekit-asset://'.length);
        const blob = await firstValueFrom(this.http.get(`${environment.apiUrl}/vaults/${this.workspace.vault()!.id}/blobs/${id}`, { responseType: 'blob', withCredentials: true }));
        if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('Imagem remota acima do limite.');
        const bytes = await blob.arrayBuffer(); const mimeType = detectRasterMime(new Uint8Array(bytes));
        return { bytes, mimeType, sha256: await portableSha256(new Uint8Array(bytes)), originalName: null };
      }
    }
    if (!isElectronRuntime()) throw new Error('Imagem legada indisponível na web. Migre os assets no desktop antes de exportar.');
    const root = String(await ElectronSafeAPI.electron.getImagePath()).replaceAll('\\', '/').replace(/\/$/, '');
    let path = reference.replaceAll('\\', '/');
    if (path.startsWith('lorekit-local://image')) path = new URL(path).searchParams.get('path') || '';
    if (path.startsWith('file:')) {
      const file = new URL(path); if (file.hostname && file.hostname !== 'localhost') throw new Error('Imagem em servidor externo não permitida.');
      path = decodeURIComponent(file.pathname); if (/^\/[a-z]:\//i.test(path)) path = path.slice(1);
    }
    path = path.replaceAll('\\', '/');
    if (!path.toLowerCase().startsWith(`${root.toLowerCase()}/`) || path.split('/').some(segment => segment === '..' || segment === '.')) throw new Error('Caminho de imagem fora do armazenamento gerenciado.');
    const raw = await ElectronSafeAPI.electron.readFile(path); if (!raw) throw new Error('Imagem legada ausente.');
    const bytes = toArrayBuffer(raw); if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Imagem acima do limite.');
    const mimeType = detectRasterMime(new Uint8Array(bytes)); return { bytes, mimeType, sha256: await portableSha256(new Uint8Array(bytes)), originalName: null };
  }

  /** Write-ahead cache/outbox entries make even a crash during file IO recoverable. */
  async stageEntityAsset(asset: { bytes: Uint8Array; mimeType: string; sha256: string }, blobId: string, operationId: string): Promise<StagedImageAsset> {
    if (!/^[0-9a-f-]{36}$/i.test(blobId) || !/^[0-9a-f-]{36}$/i.test(operationId)) throw new Error('Identidade do asset inválida.');
    if (!asset.bytes.length || asset.bytes.length > MAX_IMAGE_BYTES) throw new Error('Imagem acima do limite.'); validateRaster(asset.bytes, asset.mimeType);
    if (await portableSha256(asset.bytes) !== asset.sha256) throw new Error('Hash do asset inválido.');
    const db = this.dbProvider.getDb(); const user = this.auth.user(); const vault = this.workspace.vault();
    const desktop = isElectronRuntime();
    const localPath = desktop ? `${await ElectronSafeAPI.electron.getImagePath()}/entity-import/${operationId}/${blobId}.${extensionForMime(asset.mimeType)}` : null;
    if (this.dbProvider.getDb() !== db || this.dbProvider.readOnly()) throw new Error('O workspace mudou durante a importação.');
    if (db.exec('SELECT 1 FROM "_BlobOutbox" WHERE "blobId" = ? UNION ALL SELECT 1 FROM "_LocalBlobCache" WHERE "blobId" = ?', [blobId, blobId])[0]?.values.length) throw new Error('Identidade de blob já existente.');
    const now = new Date().toISOString();
    db.run('INSERT INTO "_BlobOutbox" ("blobId", "localPath", "mimeType", "originalName", "sha256", "state", "createdAt", "lastError") VALUES (?, ?, ?, ?, ?, ?, ?, NULL)', [blobId, localPath, asset.mimeType, `${blobId}.${extensionForMime(asset.mimeType)}`, asset.sha256, 'pending', now]);
    db.run('INSERT INTO "_LocalBlobCache" ("blobId", "cacheKey", "mimeType", "sha256", "updatedAt") VALUES (?, ?, ?, ?, ?)', [blobId, localPath || blobId, asset.mimeType, asset.sha256, now]);
    this.dbProvider.requestPersist(); await this.dbProvider.flushPendingWrites();
    if (desktop) { await ElectronSafeAPI.electron.writeFile(localPath!, asset.bytes); this.assetResolver.registerLocal(blobId, localPath!); }
    else {
      if (!user || !vault) throw new Error('Workspace web indisponível.');
      const bytes = new Uint8Array(asset.bytes).buffer;
      await this.browserStorage.writeBlob({ userId: user.id, vaultId: vault.id, blobId, bytes, mimeType: asset.mimeType, sha256: asset.sha256, updatedAt: now, evictable: false });
      this.assetResolver.registerBrowserBytes(blobId, bytes, asset.mimeType);
    }
    return { blobId, reference: canonicalAssetReference(blobId), mimeType: asset.mimeType, sha256: asset.sha256, localPath };
  }

  async cleanupStagedAsset(asset: Pick<StagedImageAsset, 'blobId' | 'localPath'>): Promise<void> {
    if (isElectronRuntime() && asset.localPath) await ElectronSafeAPI.electron.deleteFile(asset.localPath);
    const user = this.auth.user();
    const vault = this.workspace.vault();
    if (!isElectronRuntime() && user && vault) await this.browserStorage.deleteBlob(user.id, vault.id, asset.blobId);
    clearAssetUrl(asset.blobId);
    const db = this.dbProvider.getDb();
    db.run(`DELETE FROM "_BlobOutbox" WHERE "blobId" = ?`, [asset.blobId]);
    db.run(`DELETE FROM "_LocalBlobCache" WHERE "blobId" = ?`, [asset.blobId]);
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
    if (imageReferenceCount > 0 || this.hasCanonicalReference(db, canonicalAssetReference(blobId)) || this.history?.hasAssetReference(canonicalAssetReference(blobId))) return;

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

  private hasCanonicalReference(db: any, reference: string): boolean {
    for (const definition of SYNC_ENTITIES) {
      const result = db.exec(`SELECT * FROM "${definition.entityType.replaceAll('"', '""')}"`);
      if (!result.length) continue;
      if (result[0].values.some((values: unknown[]) => values.some(value => typeof value === 'string' && value.includes(reference)))) return true;
    }
    return false;
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

function toArrayBuffer(value: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
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

function detectRasterMime(bytes: Uint8Array): string {
  for (const mime of ALLOWED_IMAGE_TYPES) { try { validateRaster(bytes, mime); return mime; } catch { /* Try the next supported signature. */ } }
  throw new Error('Formato de imagem não reconhecido.');
}
