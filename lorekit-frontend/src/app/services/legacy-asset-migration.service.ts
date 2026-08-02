import { inject, Injectable } from '@angular/core';
import type { Database, QueryExecResult, SqlValue } from 'sql.js';
import { ElectronSafeAPI } from '../database/database.helper';
import { DbProvider } from '../database/db-provider.service';
import { SYNC_ENTITIES } from '../database/sync-entity-registry';
import { canonicalAssetReference } from '../models/image.model';
import { isElectronRuntime } from '../utils/runtime-platform';
import { AssetResolverService } from './asset-resolver.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|webp|gif|avif)$/i;

export interface LegacyAssetMigrationReport {
  readonly migratedImages: number;
  readonly migratedReferences: number;
  readonly missingFiles: number;
}

interface PreparedAsset {
  readonly blobId: string;
  readonly localPath: string;
  readonly mimeType: string;
  readonly originalName: string;
  readonly sha256: string;
}

interface ImageUpdate extends PreparedAsset {
  readonly imageId: SqlValue;
}

interface FieldUpdate {
  readonly table: string;
  readonly primaryKey: string;
  readonly entityId: SqlValue;
  readonly field: string;
  readonly value: string;
}

@Injectable({ providedIn: 'root' })
export class LegacyAssetMigrationService {
  private readonly dbProvider = inject(DbProvider);
  private readonly assetResolver = inject(AssetResolverService);

  async migrateForSync(): Promise<LegacyAssetMigrationReport> {
    if (!isElectronRuntime() || !this.dbProvider.ready() || this.dbProvider.readOnly()) {
      return emptyReport();
    }

    const imagesRoot = normalizePath(await ElectronSafeAPI.electron.getImagePath());
    const db = this.dbProvider.getDb<Database>();
    const assetsByPath = new Map<string, PreparedAsset>();
    const imageUpdates: ImageUpdate[] = [];
    let missingFiles = 0;

    for (const row of resultRows(db.exec(`
      SELECT "id", "filePath"
      FROM "Image"
      WHERE ("blobId" IS NULL OR "blobId" = '') AND "filePath" <> ''
    `))) {
      const localPath = normalizeLegacyImagePath(String(row['filePath']), imagesRoot);
      if (!localPath) continue;
      const key = pathKey(localPath);
      let asset = assetsByPath.get(key);
      if (!asset) {
        asset = await this.prepareAsset(
          localPath,
          imagesRoot,
          UUID_PATTERN.test(String(row['id'])) ? String(row['id']) : crypto.randomUUID(),
        ) ?? undefined;
        if (!asset) {
          missingFiles++;
          continue;
        }
        assetsByPath.set(key, asset);
      }
      imageUpdates.push({ ...asset, imageId: row['id'] });
    }

    const fieldCandidates: Array<{
      table: string;
      primaryKey: string;
      entityId: SqlValue;
      field: string;
      value: string;
      paths: string[];
    }> = [];
    const embeddedPaths = new Set<string>();

    for (const definition of SYNC_ENTITIES) {
      if (definition.entityType === 'Image') continue;
      for (const row of resultRows(db.exec(`SELECT * FROM ${quoteIdentifier(definition.entityType)}`))) {
        for (const [field, rawValue] of Object.entries(row)) {
          if (typeof rawValue !== 'string') continue;
          const paths = findLegacyImagePaths(rawValue, imagesRoot);
          if (!paths.length) continue;
          paths.forEach(path => embeddedPaths.add(path));
          fieldCandidates.push({
            table: definition.entityType,
            primaryKey: definition.primaryKey,
            entityId: row[definition.primaryKey],
            field,
            value: rawValue,
            paths,
          });
        }
      }
    }

    for (const localPath of embeddedPaths) {
      const key = pathKey(localPath);
      if (assetsByPath.has(key)) continue;
      const asset = await this.prepareAsset(localPath, imagesRoot, crypto.randomUUID());
      if (!asset) {
        missingFiles++;
        continue;
      }
      assetsByPath.set(key, asset);
    }

    const replacements = new Map<string, string>();
    for (const [key, asset] of assetsByPath) {
      replacements.set(key, canonicalAssetReference(asset.blobId));
    }

    const fieldUpdates: FieldUpdate[] = [];
    for (const candidate of fieldCandidates) {
      if (!candidate.paths.some(path => replacements.has(pathKey(path)))) continue;
      const value = replaceLegacyImagePaths(candidate.value, imagesRoot, replacements);
      if (value === candidate.value) continue;
      fieldUpdates.push({
        table: candidate.table,
        primaryKey: candidate.primaryKey,
        entityId: candidate.entityId,
        field: candidate.field,
        value,
      });
    }

    if (!imageUpdates.length && !fieldUpdates.length) {
      return { migratedImages: 0, migratedReferences: 0, missingFiles };
    }

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const asset of assetsByPath.values()) this.queueAsset(db, asset);
      for (const update of imageUpdates) {
        db.run(
          `UPDATE "Image"
           SET "blobId" = ?, "originalName" = ?, "mimeType" = ?, "sha256" = ?
           WHERE "id" = ?`,
          [update.blobId, update.originalName, update.mimeType, update.sha256, update.imageId],
        );
      }
      for (const update of fieldUpdates) {
        db.run(
          `UPDATE ${quoteIdentifier(update.table)}
           SET ${quoteIdentifier(update.field)} = ?
           WHERE ${quoteIdentifier(update.primaryKey)} = ?`,
          [update.value, update.entityId],
        );
      }
      db.run(
        `INSERT INTO "_SyncState" ("key", "value") VALUES ('legacyAssetsMigratedAt', ?)
         ON CONFLICT("key") DO UPDATE SET "value" = excluded."value"`,
        [new Date().toISOString()],
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    for (const asset of assetsByPath.values()) {
      this.assetResolver.registerLocal(asset.blobId, asset.localPath);
    }
    this.dbProvider.requestPersist();

    return {
      migratedImages: imageUpdates.length,
      migratedReferences: fieldUpdates.length,
      missingFiles,
    };
  }

  private async prepareAsset(
    localPath: string,
    imagesRoot: string,
    blobId: string,
  ): Promise<PreparedAsset | null> {
    if (!isPathInsideRoot(localPath, imagesRoot)) return null;
    const bytes = await ElectronSafeAPI.electron.readFile(localPath);
    if (!bytes) return null;
    const mimeType = mimeTypeForPath(localPath);
    if (!mimeType) return null;
    const copy = new Uint8Array(bytes);
    const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
    const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');

    return {
      blobId,
      localPath,
      mimeType,
      originalName: fileName(localPath),
      sha256,
    };
  }

  private queueAsset(db: Database, asset: PreparedAsset): void {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO "_BlobOutbox" (
        "blobId", "localPath", "mimeType", "originalName", "sha256", "state", "createdAt", "lastError"
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL)
      ON CONFLICT("blobId") DO UPDATE SET
        "localPath" = excluded."localPath", "mimeType" = excluded."mimeType",
        "originalName" = excluded."originalName", "sha256" = excluded."sha256",
        "state" = 'pending', "lastError" = NULL`,
      [asset.blobId, asset.localPath, asset.mimeType, asset.originalName, asset.sha256, now],
    );
    db.run(
      `INSERT INTO "_LocalBlobCache" ("blobId", "cacheKey", "mimeType", "sha256", "updatedAt")
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT("blobId") DO UPDATE SET
         "cacheKey" = excluded."cacheKey", "mimeType" = excluded."mimeType",
         "sha256" = excluded."sha256", "updatedAt" = excluded."updatedAt"`,
      [asset.blobId, asset.localPath, asset.mimeType, asset.sha256, now],
    );
  }
}

export function findLegacyImagePaths(value: string, imagesRoot: string): string[] {
  const found = new Set<string>();
  visitStrings(parseStructuredValue(value), candidate => {
    const path = normalizeLegacyImagePath(candidate, imagesRoot);
    if (path) found.add(path);
  });
  return [...found];
}

export function replaceLegacyImagePaths(
  value: string,
  imagesRoot: string,
  replacements: ReadonlyMap<string, string>,
): string {
  const parsed = parseStructuredValue(value);
  const replaced = mapStrings(parsed, candidate => {
    const path = normalizeLegacyImagePath(candidate, imagesRoot);
    return path ? replacements.get(pathKey(path)) ?? candidate : candidate;
  });
  if (parsed.structured) return JSON.stringify(replaced.value);
  return typeof replaced.value === 'string' ? replaced.value : value;
}

export function normalizeLegacyImagePath(value: string, imagesRoot: string): string | null {
  if (!value || value.startsWith('lorekit-asset://') || !IMAGE_EXTENSION_PATTERN.test(stripQuery(value))) {
    return null;
  }

  let candidate = value;
  if (/^file:/i.test(candidate)) {
    try {
      const url = new URL(candidate);
      candidate = decodeURIComponent(url.pathname);
      if (/^\/[a-zA-Z]:\//.test(candidate)) candidate = candidate.slice(1);
      if (url.host) candidate = `//${url.host}${candidate}`;
    } catch {
      return null;
    }
  }

  candidate = normalizePath(stripQuery(candidate));
  return isPathInsideRoot(candidate, normalizePath(imagesRoot)) ? candidate : null;
}

function parseStructuredValue(value: string): { structured: boolean; value: unknown } {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
    try {
      return { structured: true, value: JSON.parse(value) as unknown };
    } catch {
      // Valores antigos podem ser caminhos simples, apesar de começarem com caracteres de JSON.
    }
  }
  return { structured: false, value };
}

function visitStrings(parsed: { value: unknown }, visitor: (value: string) => void): void {
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      visitor(value);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(visit);
    }
  };
  visit(parsed.value);
}

function mapStrings(
  parsed: { structured: boolean; value: unknown },
  mapper: (value: string) => string,
): { structured: boolean; value: unknown } {
  const map = (value: unknown): unknown => {
    if (typeof value === 'string') return mapper(value);
    if (Array.isArray(value)) return value.map(map);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, map(item)]));
    }
    return value;
  };
  return { structured: parsed.structured, value: map(parsed.value) };
}

function resultRows(result: QueryExecResult[]): Record<string, SqlValue>[] {
  if (!result.length) return [];
  const [query] = result;
  return query.values.map(values => Object.fromEntries(
    query.columns.map((column, index) => [column, values[index]]),
  ));
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

function pathKey(value: string): string {
  return normalizePath(value).toLocaleLowerCase('en-US');
}

function isPathInsideRoot(value: string, root: string): boolean {
  const candidate = pathKey(value);
  const normalizedRoot = pathKey(root);
  return candidate === normalizedRoot || candidate.startsWith(`${normalizedRoot}/`);
}

function stripQuery(value: string): string {
  return value.split(/[?#]/, 1)[0];
}

function fileName(value: string): string {
  return normalizePath(value).split('/').pop() || 'image';
}

function mimeTypeForPath(value: string): string | null {
  const extension = stripQuery(value).split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'avif') return 'image/avif';
  return null;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function emptyReport(): LegacyAssetMigrationReport {
  return { migratedImages: 0, migratedReferences: 0, missingFiles: 0 };
}
