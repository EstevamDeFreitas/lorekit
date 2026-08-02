import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { AuthenticatedRequest } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { blobs, syncRecords, vaultMembers } from '../database/schema';

const MAX_BLOB_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
]);

@Injectable()
export class BlobService {
  private readonly logger = new Logger(BlobService.name);
  private readonly dataRoot = process.env['BLOB_DATA_DIR'] ?? '/data/blobs';

  constructor(private readonly database: DatabaseService) {}

  async put(
    vaultId: string,
    blobId: string,
    body: Buffer,
    mimeType: string,
    expectedSha256: string,
    originalName: string,
    auth: AuthenticatedRequest,
  ) {
    await this.requireMembership(vaultId, auth.userId, true);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Unsupported image MIME type');
    }
    if (!Buffer.isBuffer(body)) throw new BadRequestException('Binary image body is required');
    if (body.byteLength > MAX_BLOB_BYTES) throw new PayloadTooLargeException('Image exceeds 25 MiB');
    if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) {
      throw new BadRequestException('x-content-sha256 must be a SHA-256 hex digest');
    }

    const sha256 = createHash('sha256').update(body).digest('hex');
    if (sha256 !== expectedSha256.toLowerCase()) {
      throw new BadRequestException('Image SHA-256 does not match the request body');
    }

    const [existing] = await this.database.db
      .select()
      .from(blobs)
      .where(and(eq(blobs.id, blobId), eq(blobs.vaultId, vaultId)))
      .limit(1);
    if (existing && existing.sha256 !== sha256) {
      throw new ConflictException('Blob id already exists with different content');
    }

    const directory = join(this.dataRoot, vaultId);
    const storageKey = join(vaultId, blobId);
    const finalPath = join(directory, blobId);
    const temporaryPath = join(directory, `.${blobId}.${process.pid}.tmp`);
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, body, { flag: 'wx' });
    try {
      await rename(temporaryPath, finalPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      if (!existing) throw error;
    }

    const now = new Date();
    if (existing) {
      await this.database.db
        .update(blobs)
        .set({ state: 'ready', deletedAt: null, updatedAt: now })
        .where(and(eq(blobs.id, blobId), eq(blobs.vaultId, vaultId)));
    } else {
      await this.database.db.insert(blobs).values({
        id: blobId,
        vaultId,
        storageKey,
        sha256,
        originalName: originalName.slice(0, 255) || blobId,
        mimeType,
        sizeBytes: BigInt(body.byteLength),
        state: 'ready',
      });
    }
    this.logger.log(JSON.stringify({ event: 'blob.put', vaultId, blobId, size: body.byteLength }));
    return { blobId, sha256, mimeType, sizeBytes: String(body.byteLength), state: 'ready' };
  }

  async get(vaultId: string, blobId: string, auth: AuthenticatedRequest) {
    await this.requireMembership(vaultId, auth.userId, false);
    const metadata = await this.metadata(vaultId, blobId);
    const path = join(this.dataRoot, metadata.storageKey);
    const body = await readFile(path).catch(() => {
      throw new NotFoundException('Blob file is missing');
    });
    this.logger.log(JSON.stringify({ event: 'blob.get', vaultId, blobId, size: body.byteLength }));
    return { metadata, body };
  }

  async head(vaultId: string, blobId: string, auth: AuthenticatedRequest) {
    await this.requireMembership(vaultId, auth.userId, false);
    const metadata = await this.metadata(vaultId, blobId);
    await stat(join(this.dataRoot, metadata.storageKey)).catch(() => {
      throw new NotFoundException('Blob file is missing');
    });
    return metadata;
  }

  async delete(vaultId: string, blobId: string, auth: AuthenticatedRequest): Promise<void> {
    await this.requireMembership(vaultId, auth.userId, true);
    const referenced = await this.database.db
      .select({ entityId: syncRecords.entityId })
      .from(syncRecords)
      .where(and(
        eq(syncRecords.vaultId, vaultId),
        isNull(syncRecords.deletedAt),
        sql`${syncRecords.payload}::text LIKE ${`%${blobId}%`}`,
      ))
      .limit(1);
    if (referenced.length) {
      throw new ConflictException('Blob is still referenced by a synchronized record');
    }
    const updated = await this.database.db
      .update(blobs)
      .set({ state: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(blobs.id, blobId), eq(blobs.vaultId, vaultId)))
      .returning({ id: blobs.id });
    if (!updated.length) throw new NotFoundException('Blob not found');
    this.logger.log(JSON.stringify({ event: 'blob.delete', vaultId, blobId }));
  }

  private async metadata(vaultId: string, blobId: string) {
    const [metadata] = await this.database.db
      .select()
      .from(blobs)
      .where(and(eq(blobs.id, blobId), eq(blobs.vaultId, vaultId)))
      .limit(1);
    if (!metadata || metadata.deletedAt || metadata.state !== 'ready') {
      throw new NotFoundException('Blob not found');
    }
    return metadata;
  }

  private async requireMembership(vaultId: string, userId: string, write: boolean): Promise<void> {
    const [membership] = await this.database.db
      .select({ role: vaultMembers.role })
      .from(vaultMembers)
      .where(and(eq(vaultMembers.vaultId, vaultId), eq(vaultMembers.userId, userId)))
      .limit(1);
    if (!membership) throw new NotFoundException('Vault not found');
    if (write && membership.role === 'viewer') throw new ForbiddenException('Vault is read-only');
  }
}
