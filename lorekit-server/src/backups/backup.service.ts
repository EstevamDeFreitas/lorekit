import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import {
  auditEvents,
  blobs,
  syncChanges,
  syncRecords,
  vaultMembers,
  vaults,
} from '../database/schema';
import { SYNC_ENTITY_TYPES } from '../sync/sync-contract';

const MAGIC = Buffer.from('LOREKIT-CLOUD-BACKUP-1\0', 'utf8');
const MAX_HEADER_BYTES = 32 * 1024 * 1024;
const MAX_BACKUP_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_BLOB_BYTES = 25 * 1024 * 1024;

type BackupRecord = {
  entityType: string;
  entityId: string;
  operation: 'upsert' | 'delete';
  version: string;
  schemaVersion: number;
  payload: Record<string, unknown> | null;
  modifiedAt: string;
  changeId: string;
};

type BackupBlob = {
  blobId: string;
  sha256: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
};

type BackupManifest = {
  format: 'lorekit-cloud-backup';
  version: 1;
  exportedAt: string;
  vaultName: string;
  records: BackupRecord[];
  blobs: BackupBlob[];
};

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly dataRoot = process.env['BLOB_DATA_DIR'] ?? '/data/blobs';

  constructor(private readonly database: DatabaseService) {}

  async download(vaultId: string, auth: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
    const vault = await this.requireOwner(vaultId, auth.userId);
    const records = await this.database.db
      .select()
      .from(syncRecords)
      .where(eq(syncRecords.vaultId, vaultId));
    const blobRows = await this.database.db
      .select()
      .from(blobs)
      .where(and(eq(blobs.vaultId, vaultId), eq(blobs.state, 'ready')));

    const exportableBlobs: Array<{ metadata: BackupBlob; path: string }> = [];
    for (const blob of blobRows) {
      if (blob.deletedAt) continue;
      const path = join(this.dataRoot, blob.storageKey);
      try {
        const details = await stat(path);
        if (!details.isFile() || details.size !== Number(blob.sizeBytes)) continue;
      } catch {
        continue;
      }
      exportableBlobs.push({
        metadata: {
          blobId: blob.id,
          sha256: blob.sha256,
          originalName: blob.originalName,
          mimeType: blob.mimeType,
          sizeBytes: blob.sizeBytes.toString(),
        },
        path,
      });
    }

    const manifest: BackupManifest = {
      format: 'lorekit-cloud-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      vaultName: vault.name,
      records: records.map(record => ({
        entityType: record.entityType,
        entityId: record.entityId,
        operation: record.deletedAt ? 'delete' : 'upsert',
        version: record.version.toString(),
        schemaVersion: record.schemaVersion,
        payload: record.payload,
        modifiedAt: record.modifiedAt.toString(),
        changeId: record.changeId,
      })),
      blobs: exportableBlobs.map(item => item.metadata),
    };
    const header = Buffer.from(JSON.stringify(manifest), 'utf8');
    if (header.length > MAX_HEADER_BYTES) {
      throw new PayloadTooLargeException('Backup metadata exceeds the supported size');
    }

    const headerLength = Buffer.allocUnsafe(4);
    headerLength.writeUInt32BE(header.length, 0);
    const output = Readable.from(this.streamBackup(MAGIC, headerLength, header, exportableBlobs));
    reply
      .header('content-type', 'application/x-lorekit-cloud-backup')
      .header('content-disposition', `attachment; filename="lorekit-backup-${datePart()}.lorekit"`)
      .header('cache-control', 'no-store')
      .send(output);
    this.logger.log(JSON.stringify({ event: 'backup.download', vaultId, records: records.length, blobs: exportableBlobs.length }));
  }

  private async *streamBackup(
    magic: Buffer,
    headerLength: Buffer,
    header: Buffer,
    blobsToStream: Array<{ metadata: BackupBlob; path: string }>,
  ): AsyncGenerator<Buffer> {
    yield magic;
    yield headerLength;
    yield header;
    for (const blob of blobsToStream) {
      for await (const chunk of createReadStream(blob.path)) {
        yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      }
    }
  }

  async restore(vaultId: string, body: Readable, auth: AuthenticatedRequest): Promise<{ vaultId: string }> {
    if (!body || typeof body[Symbol.asyncIterator] !== 'function') {
      throw new BadRequestException('A restauração exige um arquivo de backup binário válido.');
    }
    const sourceVault = await this.requireOwner(vaultId, auth.userId);
    const reader = new BackupReader(body);
    const magic = await reader.read(MAGIC.length);
    if (!magic.equals(MAGIC)) throw new BadRequestException('Unsupported cloud backup format');
    const headerLength = (await reader.read(4)).readUInt32BE(0);
    if (!headerLength || headerLength > MAX_HEADER_BYTES) {
      throw new PayloadTooLargeException('Backup metadata exceeds the supported size');
    }
    const manifest = this.validateManifest(JSON.parse((await reader.read(headerLength)).toString('utf8')));
    const newVaultId = randomUUID();
    const temporaryDirectory = join(this.dataRoot, `.restore-${newVaultId}`);
    const finalDirectory = join(this.dataRoot, newVaultId);
    await mkdir(temporaryDirectory, { recursive: true });
    let totalSize = 0;
    try {
      for (const blob of manifest.blobs) {
        const size = Number(blob.sizeBytes);
        totalSize += size;
        if (totalSize > MAX_BACKUP_BYTES) throw new PayloadTooLargeException('Backup exceeds the supported size');
        const content = await reader.read(size);
        const digest = createHash('sha256').update(content).digest('hex');
        if (digest !== blob.sha256) throw new BadRequestException(`Blob ${blob.blobId} is corrupted`);
        await writeFile(join(temporaryDirectory, blob.blobId), content, { flag: 'wx' });
      }
      await reader.assertFinished();
      await rename(temporaryDirectory, finalDirectory);
      try {
        await this.replaceVault(sourceVault, newVaultId, manifest, auth);
      } catch (error) {
        await rm(finalDirectory, { recursive: true, force: true });
        throw error;
      }
      await rm(join(this.dataRoot, vaultId), { recursive: true, force: true });
      this.logger.log(JSON.stringify({ event: 'backup.restore', sourceVaultId: vaultId, vaultId: newVaultId, records: manifest.records.length, blobs: manifest.blobs.length }));
      return { vaultId: newVaultId };
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  }

  private async replaceVault(
    sourceVault: { id: string; name: string; ownerUserId: string },
    newVaultId: string,
    manifest: BackupManifest,
    auth: AuthenticatedRequest,
  ): Promise<void> {
    const members = await this.database.db
      .select()
      .from(vaultMembers)
      .where(eq(vaultMembers.vaultId, sourceVault.id));
    const now = new Date();
    await this.database.db.transaction(async transaction => {
      await transaction.insert(vaults).values({
        id: newVaultId,
        ownerUserId: sourceVault.ownerUserId,
        name: manifest.vaultName.slice(0, 255) || sourceVault.name,
      });
      if (members.length) {
        await transaction.insert(vaultMembers).values(members.map(member => ({
          vaultId: newVaultId,
          userId: member.userId,
          role: member.role,
        })));
      }
      if (manifest.records.length) {
        await transaction.insert(syncRecords).values(manifest.records.map(record => ({
          vaultId: newVaultId,
          entityType: record.entityType,
          entityId: record.entityId,
          payload: record.payload,
          version: BigInt(record.version),
          schemaVersion: record.schemaVersion,
          modifiedAt: BigInt(record.modifiedAt),
          changeId: record.changeId,
          deletedAt: record.operation === 'delete' ? now : null,
          updatedAt: now,
        })));
        await transaction.insert(syncChanges).values(manifest.records.map(record => ({
          vaultId: newVaultId,
          entityType: record.entityType,
          entityId: record.entityId,
          operation: record.operation,
          recordVersion: BigInt(record.version),
          payload: record.payload,
          modifiedAt: BigInt(record.modifiedAt),
          changeId: record.changeId,
          actorUserId: auth.userId,
          actorDeviceId: auth.deviceId,
          createdAt: now,
        })));
      }

      await transaction.insert(auditEvents).values({
        actorUserId: auth.userId,
        action: 'vault.backup_restored',
        targetType: 'vault',
        targetId: newVaultId,
        metadata: { restoredVaultId: sourceVault.id, recordCount: manifest.records.length, blobCount: manifest.blobs.length },
      });
      // Blob IDs are global. Delete the source vault first (inside this transaction)
      // so its cascading blob rows release the IDs being restored.
      await transaction.delete(vaults).where(eq(vaults.id, sourceVault.id));      if (manifest.blobs.length) {
        await transaction.insert(blobs).values(manifest.blobs.map(blob => ({
          id: blob.blobId,
          vaultId: newVaultId,
          storageKey: join(newVaultId, blob.blobId),
          sha256: blob.sha256,
          originalName: blob.originalName,
          mimeType: blob.mimeType,
          sizeBytes: BigInt(blob.sizeBytes),
          state: 'ready',
        })));
      }
    });
  }

  private validateManifest(value: unknown): BackupManifest {
    if (!value || typeof value !== 'object') throw new BadRequestException('Backup metadata is invalid');
    const manifest = value as Partial<BackupManifest>;
    if (manifest.format !== 'lorekit-cloud-backup' || manifest.version !== 1 || !Array.isArray(manifest.records) || !Array.isArray(manifest.blobs)) {
      throw new BadRequestException('Unsupported cloud backup format');
    }
    const entityTypes = new Set<string>(SYNC_ENTITY_TYPES);
    const recordKeys = new Set<string>();
    for (const record of manifest.records) {
      if (!record || !entityTypes.has(record.entityType) || typeof record.entityId !== 'string' || !record.entityId || !['upsert', 'delete'].includes(record.operation) || !isNonNegativeInteger(record.version) || !isNonNegativeInteger(record.modifiedAt) || !isChangeId(record.changeId) || !Number.isInteger(record.schemaVersion) || record.schemaVersion < 1) {
        throw new BadRequestException('Backup contains an invalid synchronized record');
      }
      const key = `${record.entityType}:${record.entityId}`;
      if (recordKeys.has(key)) throw new BadRequestException('Backup contains duplicate synchronized records');
      recordKeys.add(key);
    }
    const blobIds = new Set<string>();
    for (const blob of manifest.blobs) {
      if (!blob || !isUuid(blob.blobId) || blobIds.has(blob.blobId) || !/^[a-f0-9]{64}$/i.test(blob.sha256) || !isNonNegativeInteger(blob.sizeBytes) || Number(blob.sizeBytes) > MAX_BLOB_BYTES || typeof blob.mimeType !== 'string' || !blob.mimeType.startsWith('image/') || typeof blob.originalName !== 'string') {
        throw new BadRequestException('Backup contains an invalid image blob');
      }
      blobIds.add(blob.blobId);
    }
    return manifest as BackupManifest;
  }

  private async requireOwner(vaultId: string, userId: string) {
    const [membership] = await this.database.db
      .select({ role: vaultMembers.role })
      .from(vaultMembers)
      .where(and(eq(vaultMembers.vaultId, vaultId), eq(vaultMembers.userId, userId)))
      .limit(1);
    if (!membership) throw new NotFoundException('Vault not found');
    if (membership.role !== 'owner') throw new ForbiddenException('Only the vault owner can restore or export backups');
    const [vault] = await this.database.db.select().from(vaults).where(eq(vaults.id, vaultId)).limit(1);
    if (!vault) throw new NotFoundException('Vault not found');
    return vault;
  }
}

class BackupReader {
  private readonly iterator: AsyncIterator<Buffer>;
  private buffered: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private consumed = 0;

  constructor(stream: Readable) {
    this.iterator = stream[Symbol.asyncIterator]();
  }

  async read(size: number): Promise<Buffer> {
    if (!Number.isSafeInteger(size) || size < 0) throw new BadRequestException('Backup frame is invalid');
    while (this.buffered.length < size) {
      const next = await this.iterator.next();
      if (next.done) throw new BadRequestException('Backup ended unexpectedly');
      const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value);
      this.consumed += chunk.length;
      if (this.consumed > MAX_BACKUP_BYTES + MAX_HEADER_BYTES + MAGIC.length + 4) {
        throw new PayloadTooLargeException('Backup exceeds the supported size');
      }
      this.buffered = this.buffered.length ? Buffer.concat([this.buffered, chunk]) : chunk;
    }
    const result = this.buffered.subarray(0, size);
    this.buffered = this.buffered.subarray(size);
    return result;
  }

  async assertFinished(): Promise<void> {
    if (this.buffered.length) throw new BadRequestException('Backup has unexpected trailing data');
    const next = await this.iterator.next();
    if (!next.done) throw new BadRequestException('Backup has unexpected trailing data');
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isChangeId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128;
}

function isNonNegativeInteger(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function datePart(): string {
  return new Date().toISOString().slice(0, 10);
}

