import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { DatabaseService } from '../database/database.service';
import { stories, storyAssets } from '../database/schema';
import {
  contractId,
  contractInteger,
  contractRecord,
  contractString,
  contractVersion,
  STORY_LIMITS,
} from '../shared/ironpaw';
import { StoriesService, storyContract } from './stories.service';
import { StorySettingsService } from './story-settings.service';

@Injectable()
export class StoryAssetsService {
  private activeDecodes = 0;
  constructor(
    private readonly database: DatabaseService,
    private readonly access: StoriesService,
    private readonly settings: StorySettingsService,
  ) {}

  async reserve(storyId: string, userId: string, value: unknown) {
    await this.access.member(storyId, userId);
    const input = storyContract(() => {
      const source = contractRecord(value, [
        'version',
        'id',
        'name',
        'mimeType',
        'sizeBytes',
        'sha256',
      ]);
      contractVersion(source['version']);
      const mimeType = contractString(source['mimeType'], 'Formato', 50);
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType))
        throw new Error('Use PNG, JPEG ou WebP.');
      const sha256 = contractString(source['sha256'], 'Hash', 64);
      if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Hash inválido.');
      return {
        id: contractId(source['id']),
        name: contractString(source['name'], 'Nome do arquivo', 200),
        mimeType,
        sizeBytes: contractInteger(
          source['sizeBytes'],
          'Tamanho',
          1,
          STORY_LIMITS.imageBytes,
        ),
        sha256,
      };
    });
    return this.database.db.transaction(async (tx) => {
      await tx
        .select()
        .from(stories)
        .where(eq(stories.id, storyId))
        .for('update');
      await this.access.member(storyId, userId, tx);
      const [existing] = await tx
        .select()
        .from(storyAssets)
        .where(eq(storyAssets.id, input.id));
      if (existing) {
        if (
          existing.storyId !== storyId ||
          existing.uploaderUserId !== userId ||
          existing.sha256 !== input.sha256 ||
          existing.sizeBytes !== input.sizeBytes ||
          existing.mimeType !== input.mimeType ||
          existing.name !== input.name
        )
          throw new ConflictException('Identidade de upload já usada.');
        return this.serialize(existing);
      }
      const [created] = await tx
        .insert(storyAssets)
        .values({
          ...input,
          storyId,
          uploaderUserId: userId,
          expiresAt: new Date(Date.now() + 86_400_000),
        })
        .returning();
      return this.serialize(created!);
    });
  }

  async upload(
    storyId: string,
    userId: string,
    assetId: string,
    bytes: unknown,
    mimeType: string,
  ) {
    await this.access.member(storyId, userId);
    storyContract(() => contractId(assetId));
    if (!Buffer.isBuffer(bytes))
      throw new BadRequestException('Envie a imagem como conteúdo binário.');
    if (bytes.length > STORY_LIMITS.imageBytes)
      throw new PayloadTooLargeException('A imagem deve ter até 10 MiB.');
    const [asset] = await this.database.db
      .select()
      .from(storyAssets)
      .where(
        and(
          eq(storyAssets.storyId, storyId),
          eq(storyAssets.id, assetId),
          eq(storyAssets.uploaderUserId, userId),
        ),
      );
    if (!asset) throw new NotFoundException('Upload não encontrado.');
    if (
      bytes.length !== asset.sizeBytes ||
      mimeType !== asset.mimeType ||
      createHash('sha256').update(bytes).digest('hex') !== asset.sha256
    )
      throw new BadRequestException(
        'A imagem não corresponde ao upload reservado.',
      );
    if (asset.state === 'ready') return this.serialize(asset);
    if (this.activeDecodes >= 2)
      throw new ServiceUnavailableException(
        'Há imagens sendo processadas. Tente novamente.',
      );
    this.activeDecodes++;
    try {
      const image = sharp(bytes, {
        limitInputPixels: 16_777_216,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      const expected = {
        'image/png': 'png',
        'image/jpeg': 'jpeg',
        'image/webp': 'webp',
      }[mimeType];
      if (
        !expected ||
        metadata.format !== expected ||
        !metadata.width ||
        !metadata.height ||
        (metadata.pages ?? 1) > 1
      )
        throw new Error('Formato real da imagem inválido.');
      await image.stats(); // Decode fully, not only the attacker-controlled header.
    } catch {
      throw new BadRequestException(
        'Imagem inválida, animada ou acima do limite de 16 megapixels.',
      );
    } finally {
      this.activeDecodes--;
    }
    return this.database.db.transaction(async (tx) => {
      await tx
        .select()
        .from(stories)
        .where(eq(stories.id, storyId))
        .for('update');
      await this.access.member(storyId, userId, tx);
      const [current] = await tx
        .select()
        .from(storyAssets)
        .where(
          and(eq(storyAssets.storyId, storyId), eq(storyAssets.id, assetId)),
        );
      if (!current)
        throw new NotFoundException(
          'Upload expirado. Reserve a imagem novamente.',
        );
      const directory = join(this.settings.assetRoot, storyId);
      await mkdir(directory, { recursive: true });
      const temporary = join(directory, `${assetId}.${randomUUID()}.pending`);
      try {
        await writeFile(temporary, bytes, { flag: 'wx' });
        await rename(temporary, join(directory, assetId));
      } finally {
        await rm(temporary, { force: true });
      }
      const [ready] = await tx
        .update(storyAssets)
        .set({ state: 'ready' })
        .where(eq(storyAssets.id, assetId))
        .returning();
      return this.serialize(ready!);
    });
  }

  async get(storyId: string, userId: string, assetId: string) {
    await this.access.member(storyId, userId);
    storyContract(() => contractId(assetId));
    const [asset] = await this.database.db
      .select()
      .from(storyAssets)
      .where(
        and(
          eq(storyAssets.storyId, storyId),
          eq(storyAssets.id, assetId),
          eq(storyAssets.state, 'ready'),
        ),
      );
    if (!asset) throw new NotFoundException('Imagem não encontrada.');
    const bytes = await readFile(
      join(this.settings.assetRoot, storyId, assetId),
    ).catch(() => {
      throw new NotFoundException('Arquivo da imagem indisponível.');
    });
    await this.access.member(storyId, userId); // Recheck after IO, including revocation during the read.
    return { metadata: this.serialize(asset), bytes };
  }

  async prune(): Promise<void> {
    const candidates = await this.database.db
      .select()
      .from(storyAssets)
      .where(lt(storyAssets.expiresAt, new Date()))
      .limit(100);
    for (const candidate of candidates) {
      await this.database.db.transaction(async (tx) => {
        await tx
          .select()
          .from(stories)
          .where(eq(stories.id, candidate.storyId))
          .for('update');
        const deleted = await tx
          .delete(storyAssets)
          .where(
            and(
              eq(storyAssets.id, candidate.id),
              sql`not exists (select 1 from app.story_message_assets where asset_id = ${candidate.id})`,
              sql`not exists (select 1 from app.story_speaker_revisions where portrait_asset_id = ${candidate.id})`,
            ),
          )
          .returning({ id: storyAssets.id });
        if (deleted.length)
          await rm(
            join(this.settings.assetRoot, candidate.storyId, candidate.id),
            { force: true },
          );
      });
    }
  }

  private serialize(asset: typeof storyAssets.$inferSelect) {
    return {
      id: asset.id,
      storyId: asset.storyId,
      name: asset.name,
      mimeType: asset.mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
      sizeBytes: asset.sizeBytes,
      sha256: asset.sha256,
      state: asset.state,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
