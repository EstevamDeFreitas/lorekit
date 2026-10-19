import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, lt, lte, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import {
  stories,
  storyMembers,
  storyInvites,
  storyScenes,
  storySpeakers,
  storySpeakerRevisions,
  storyMessages,
  storyMessageAssets,
  storyAssets,
  storyOperations,
  storyEvents,
  users,
} from '../database/schema';
import { StorySettingsService } from './story-settings.service';
import { contractRecord, mergeReadRanges } from '../shared/ironpaw';
import { npcRollActions } from '../shared/ironpaw';
import {
  buildNpcRoll,
  buildRollFormula,
  buildRollPreview,
  executeRoll,
  IRONPAW_RULES_VERSION,
  parseCreateStoryInput,
  parseStoryMessageInput,
  parseStoryRollInput,
  parseStorySceneInput,
  parseStorySpeakerInput,
  contractId,
  contractSequence,
  contractString,
  StoryContractError,
  STORY_LIMITS,
  type Story,
  type StoryEvent,
  type StoryEventType,
  type StoryMessage,
  type StorySpeakerRevision,
  type StoryRollRecord,
} from '../shared/ironpaw';

type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];
type Executor = Transaction | DatabaseService['db'];
type StoryRow = typeof stories.$inferSelect;
type RevisionRow = typeof storySpeakerRevisions.$inferSelect;

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function json(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
export function storyContract<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof StoryContractError || error instanceof Error)
      throw new BadRequestException(error.message);
    throw error;
  }
}
function asStory(row: StoryRow): Story {
  return {
    version: 1,
    id: row.id,
    title: row.title,
    ownerUserId: row.ownerUserId,
    sequence: String(row.sequence),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function asRevision(row: RevisionRow): StorySpeakerRevision {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

@Injectable()
export class StoriesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: StorySettingsService,
  ) {}

  async member(
    storyId: string,
    userId: string,
    executor: Executor = this.database.db,
  ) {
    this.settings.assertEnabled();
    storyContract(() => contractId(storyId));
    const [member] = await executor
      .select()
      .from(storyMembers)
      .where(
        and(eq(storyMembers.storyId, storyId), eq(storyMembers.userId, userId)),
      )
      .limit(1);
    if (!member)
      throw new NotFoundException(
        'História não encontrada ou acesso removido.',
      );
    return member;
  }

  async list(userId: string) {
    this.settings.assertEnabled();
    const rows = await this.database.db
      .select({
        story: stories,
        member: storyMembers,
        unread: sql<number>`(
      select count(*) from app.story_messages message where message.story_id = ${storyMembers.storyId}
      and message.author_user_id <> ${userId} and message.sequence > ${storyMembers.readCursor}
      and not exists (select 1 from jsonb_array_elements(${storyMembers.seen}) ranges
        where message.sequence between (ranges->>0)::bigint and (ranges->>1)::bigint)
    )`.mapWith(Number),
      })
      .from(storyMembers)
      .innerJoin(stories, eq(stories.id, storyMembers.storyId))
      .where(eq(storyMembers.userId, userId))
      .orderBy(asc(stories.createdAt));
    return rows.map(({ story, member, unread }) => ({
      ...asStory(story),
      role: member.role,
      readCursor: String(member.readCursor),
      seen: member.seen,
      unread,
      preferences: { sound: member.sound, external: member.external },
    }));
  }

  async create(value: unknown, userId: string) {
    this.settings.assertEnabled();
    const input = storyContract(() => parseCreateStoryInput(value));
    return this.database.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(stories)
        .values({
          ownerUserId: userId,
          creationOperationId: input.operationId,
          title: input.title,
        })
        .onConflictDoNothing({
          target: [stories.ownerUserId, stories.creationOperationId],
        })
        .returning();
      const row =
        created ??
        (
          await tx
            .select()
            .from(stories)
            .where(
              and(
                eq(stories.ownerUserId, userId),
                eq(stories.creationOperationId, input.operationId),
              ),
            )
            .limit(1)
        )[0];
      if (!row || row.title !== input.title)
        throw new ConflictException('Operação já usada com outro conteúdo.');
      await tx
        .insert(storyMembers)
        .values({ storyId: row.id, userId, role: 'owner' })
        .onConflictDoNothing();
      return asStory(row);
    });
  }

  async detail(storyId: string, userId: string) {
    const member = await this.member(storyId, userId);
    const [story] = await this.database.db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));
    if (!story) throw new NotFoundException();
    const scenes = await this.database.db
      .select()
      .from(storyScenes)
      .where(eq(storyScenes.storyId, storyId))
      .orderBy(asc(storyScenes.position));
    const speakers = await this.database.db
      .select({ speaker: storySpeakers, revision: storySpeakerRevisions })
      .from(storySpeakers)
      .innerJoin(
        storySpeakerRevisions,
        and(
          eq(storySpeakerRevisions.speakerId, storySpeakers.id),
          eq(storySpeakerRevisions.number, storySpeakers.revision),
        ),
      )
      .where(eq(storySpeakers.storyId, storyId));
    return {
      story: asStory(story),
      member: {
        ...member,
        readCursor: String(member.readCursor),
        createdAt: member.createdAt.toISOString(),
      },
      scenes: scenes.map((scene) => ({
        ...scene,
        position: String(scene.position),
        createdAt: scene.createdAt.toISOString(),
      })),
      speakers: speakers.map(({ speaker, revision }) => ({
        id: speaker.id,
        storyId,
        sceneId: speaker.sceneId,
        kind: speaker.kind,
        publisherUserId: speaker.publisherUserId,
        revision: asRevision(revision),
      })),
    };
  }

  private async locked<T>(
    storyId: string,
    userId: string,
    action: (
      tx: Transaction,
      story: StoryRow,
      role: 'owner' | 'participant',
    ) => Promise<T>,
  ): Promise<T> {
    this.settings.assertEnabled();
    storyContract(() => contractId(storyId));
    return this.database.db.transaction(async (tx) => {
      const [story] = await tx
        .select()
        .from(stories)
        .where(eq(stories.id, storyId))
        .for('update');
      if (!story) throw new NotFoundException('História não encontrada.');
      const member = await this.member(storyId, userId, tx);
      return action(tx, story, member.role);
    });
  }

  private async event(
    tx: Transaction,
    storyId: string,
    type: StoryEventType,
    entityId: string,
  ): Promise<bigint> {
    const [row] = await tx
      .update(stories)
      .set({ sequence: sql`${stories.sequence} + 1`, updatedAt: new Date() })
      .where(eq(stories.id, storyId))
      .returning({ sequence: stories.sequence });
    if (!row) throw new NotFoundException();
    await tx
      .insert(storyEvents)
      .values({ storyId, sequence: row.sequence, type, entityId });
    return row.sequence;
  }

  private async operation<T extends object>(
    storyId: string,
    userId: string,
    operationId: string,
    request: unknown,
    action: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    const requestHash = hash(request);
    return this.locked(storyId, userId, async (tx) => {
      const [prior] = await tx
        .select()
        .from(storyOperations)
        .where(
          and(
            eq(storyOperations.storyId, storyId),
            eq(storyOperations.userId, userId),
            eq(storyOperations.operationId, operationId),
          ),
        );
      if (prior) {
        if (prior.requestHash !== requestHash)
          throw new ConflictException('Operação já usada com outro conteúdo.');
        return prior.result as T;
      }
      const result = await action(tx);
      await tx.insert(storyOperations).values({
        storyId,
        userId,
        operationId,
        requestHash,
        result: json(result),
      });
      return result;
    });
  }

  async operationResult(storyId: string, userId: string, operationId: string) {
    await this.member(storyId, userId);
    storyContract(() => contractId(operationId));
    const [result] = await this.database.db
      .select()
      .from(storyOperations)
      .where(
        and(
          eq(storyOperations.storyId, storyId),
          eq(storyOperations.userId, userId),
          eq(storyOperations.operationId, operationId),
        ),
      );
    if (!result)
      throw new NotFoundException('A operação ainda não foi confirmada.');
    return { operationId, storyId, result: result.result };
  }

  async scene(
    storyId: string,
    userId: string,
    value: unknown,
    sceneId?: string,
  ) {
    const input = storyContract(() => parseStorySceneInput(value));
    if (sceneId) storyContract(() => contractId(sceneId));
    return this.operation(
      storyId,
      userId,
      input.operationId,
      { type: 'scene', sceneId, ...input },
      async (tx) => {
        const id = sceneId ?? randomUUID();
        const position = await this.event(
          tx,
          storyId,
          sceneId ? 'scene.updated' : 'scene.created',
          id,
        );
        const [row] = sceneId
          ? await tx
              .update(storyScenes)
              .set({ title: input.title })
              .where(
                and(
                  eq(storyScenes.storyId, storyId),
                  eq(storyScenes.id, sceneId),
                ),
              )
              .returning()
          : await tx
              .insert(storyScenes)
              .values({ id, storyId, title: input.title, position })
              .returning();
        if (!row) throw new NotFoundException('Cena não encontrada.');
        return {
          ...row,
          position: String(row.position),
          createdAt: row.createdAt.toISOString(),
        };
      },
    );
  }

  async speaker(
    storyId: string,
    userId: string,
    value: unknown,
    speakerId?: string,
  ) {
    const input = storyContract(() => parseStorySpeakerInput(value));
    if (speakerId) storyContract(() => contractId(speakerId));
    return this.operation(
      storyId,
      userId,
      input.operationId,
      { type: 'speaker', speakerId, ...input },
      async (tx) => {
        if (input.sceneId) await this.requireScene(tx, storyId, input.sceneId);
        if (input.portraitAssetId)
          await this.readyAssets(tx, storyId, [input.portraitAssetId]);
        const id = speakerId ?? randomUUID();
        let number = 1;
        if (speakerId) {
          const [existing] = await tx
            .select()
            .from(storySpeakers)
            .where(
              and(
                eq(storySpeakers.storyId, storyId),
                eq(storySpeakers.id, speakerId),
              ),
            );
          if (!existing) throw new NotFoundException('Locutor não encontrado.');
          if (
            existing.kind !== input.kind ||
            existing.sceneId !== input.sceneId
          )
            throw new ConflictException(
              'O tipo e o escopo do locutor não podem mudar.',
            );
          if (
            existing.kind !== 'incidental' &&
            existing.publisherUserId !== userId
          )
            throw new ForbiddenException(
              'Somente quem disponibilizou a ficha pode publicar uma nova revisão.',
            );
          number = existing.revision + 1;
          await tx
            .update(storySpeakers)
            .set({ revision: number })
            .where(eq(storySpeakers.id, id));
        } else {
          await tx.insert(storySpeakers).values({
            id,
            storyId,
            sceneId: input.sceneId,
            kind: input.kind,
            publisherUserId: userId,
          });
        }
        const [revision] = await tx
          .insert(storySpeakerRevisions)
          .values({
            storyId,
            speakerId: id,
            number,
            name: input.name,
            color: input.color,
            portraitAssetId: input.portraitAssetId,
            mechanics: input.mechanics,
          })
          .returning();
        await this.event(tx, storyId, 'speaker.updated', id);
        return {
          id,
          storyId,
          sceneId: input.sceneId,
          kind: input.kind,
          publisherUserId: speakerId
            ? (
                await tx
                  .select()
                  .from(storySpeakers)
                  .where(eq(storySpeakers.id, id))
              )[0]!.publisherUserId
            : userId,
          revision: asRevision(revision!),
        };
      },
    );
  }

  private async requireScene(tx: Executor, storyId: string, sceneId: string) {
    const [scene] = await tx
      .select()
      .from(storyScenes)
      .where(
        and(eq(storyScenes.storyId, storyId), eq(storyScenes.id, sceneId)),
      );
    if (!scene)
      throw new NotFoundException('Cena não encontrada nesta História.');
    return scene;
  }

  private async revision(
    tx: Transaction,
    storyId: string,
    sceneId: string,
    speakerId: string,
    revisionId: string,
  ) {
    await this.requireScene(tx, storyId, sceneId);
    const [speaker] = await tx
      .select()
      .from(storySpeakers)
      .where(
        and(
          eq(storySpeakers.storyId, storyId),
          eq(storySpeakers.id, speakerId),
        ),
      );
    if (!speaker || (speaker.sceneId && speaker.sceneId !== sceneId))
      throw new NotFoundException('Locutor indisponível nesta cena.');
    const [revision] = await tx
      .select()
      .from(storySpeakerRevisions)
      .where(
        and(
          eq(storySpeakerRevisions.storyId, storyId),
          eq(storySpeakerRevisions.speakerId, speakerId),
          eq(storySpeakerRevisions.id, revisionId),
        ),
      );
    if (!revision || revision.number !== speaker.revision)
      throw new ConflictException(
        'A ficha compartilhada mudou. Confira a nova prévia antes de enviar.',
      );
    return revision;
  }

  private async readyAssets(
    tx: Executor,
    storyId: string,
    assetIds: string[],
    uploader?: string,
  ) {
    if (!assetIds.length) return [];
    const assets = await tx
      .select()
      .from(storyAssets)
      .where(
        and(
          eq(storyAssets.storyId, storyId),
          inArray(storyAssets.id, assetIds),
          eq(storyAssets.state, 'ready'),
        ),
      );
    if (
      assets.length !== assetIds.length ||
      (uploader && assets.some((asset) => asset.uploaderUserId !== uploader))
    )
      throw new BadRequestException(
        'Imagem não disponível ou upload incompleto.',
      );
    return assets;
  }

  async send(storyId: string, userId: string, value: unknown) {
    const input = storyContract(() => parseStoryMessageInput(value));
    return this.operation(
      storyId,
      userId,
      input.operationId,
      { type: 'message', ...input },
      async (tx) => {
        await this.revision(
          tx,
          storyId,
          input.sceneId,
          input.speakerId,
          input.revisionId,
        );
        await this.readyAssets(tx, storyId, input.assetIds, userId);
        return this.insertMessage(tx, storyId, userId, input, null);
      },
    );
  }

  async roll(storyId: string, userId: string, value: unknown) {
    const input = storyContract(() => parseStoryRollInput(value));
    return this.operation(
      storyId,
      userId,
      input.operationId,
      { type: 'roll', ...input },
      async (tx) => {
        const revision = await this.revision(
          tx,
          storyId,
          input.sceneId,
          input.speakerId,
          input.revisionId,
        );
        if (input.targetSpeakerId) {
          const [target] = await tx
            .select()
            .from(storySpeakers)
            .where(
              and(
                eq(storySpeakers.storyId, storyId),
                eq(storySpeakers.id, input.targetSpeakerId),
              ),
            );
          if (!target || (target.sceneId && target.sceneId !== input.sceneId))
            throw new NotFoundException('Alvo não disponível nesta cena.');
        }
        if (input.relatedRollMessageId) {
          const [related] = await tx
            .select()
            .from(storyMessages)
            .where(
              and(
                eq(storyMessages.storyId, storyId),
                eq(storyMessages.id, input.relatedRollMessageId),
              ),
            );
          if (!related?.roll)
            throw new NotFoundException('Rolagem relacionada não encontrada.');
        }
        const mechanics = revision.mechanics;
        if (!mechanics)
          throw new BadRequestException(
            'O locutor não tem ficha Ironpaw disponibilizada.',
          );
        const action =
          mechanics.kind === 'character'
            ? mechanics.actions.find((entry) => entry.id === input.actionId)
            : npcRollActions(mechanics.definition).find(
                (entry) => entry.id === input.actionId,
              );
        if (!action)
          throw new BadRequestException(
            'Ação não disponível na revisão compartilhada.',
          );
        const preview = storyContract(() => {
          if (mechanics.kind === 'npc')
            return buildNpcRoll(
              mechanics.definition,
              input.actionId,
              input.competenceId,
              input.conditionImpacts,
              input.manualModifier,
            );
          if (input.competenceId)
            throw new Error(
              'Personagens não usam Tags de Competência de PNJs.',
            );
          const selected = mechanics.actions.find(
            (entry) => entry.id === input.actionId,
          )!;
          return buildRollPreview(
            Math.max(1, selected.skillLevel),
            [
              {
                key: 'skill',
                label: 'Treino da perícia',
                value: selected.skillLevel >= 1 ? 1 : 0,
                category: 'skill',
              },
              {
                key: 'source',
                label: selected.sourceLabel,
                value: selected.sourceValue,
                category: 'source',
              },
              {
                key: 'manual',
                label: 'Ajuste manual',
                value: input.manualModifier,
                category: 'manual',
              },
            ],
            [...selected.impacts, ...input.conditionImpacts],
          );
        });
        const record: StoryRollRecord = {
          version: 1,
          rulesVersion: IRONPAW_RULES_VERSION,
          kind: input.kind,
          actionId: action.id,
          actionName: action.name,
          formula: buildRollFormula(preview),
          preview,
          results: executeRoll(
            preview,
            (sides) => randomInt(1, sides + 1),
            input.target,
          ),
          target: input.target,
          targetSpeakerId: input.targetSpeakerId,
          relatedRollMessageId: input.relatedRollMessageId,
        };
        return this.insertMessage(
          tx,
          storyId,
          userId,
          { ...input, text: '', assetIds: [] },
          record,
        );
      },
    );
  }

  private async insertMessage(
    tx: Transaction,
    storyId: string,
    userId: string,
    input: {
      operationId: string;
      sceneId: string;
      speakerId: string;
      revisionId: string;
      text: string;
      assetIds: string[];
    },
    roll: StoryRollRecord | null,
  ) {
    const id = randomUUID();
    const sequence = await this.event(tx, storyId, 'message.created', id);
    const [author] = await tx
      .select({ name: users.displayName })
      .from(users)
      .where(eq(users.id, userId));
    await tx.insert(storyMessages).values({
      id,
      storyId,
      sceneId: input.sceneId,
      speakerId: input.speakerId,
      revisionId: input.revisionId,
      sequence,
      operationId: input.operationId,
      authorUserId: userId,
      authorName: author?.name || 'Participante',
      text: input.text,
      roll,
    });
    if (input.assetIds.length)
      await tx.insert(storyMessageAssets).values(
        input.assetIds.map((assetId, position) => ({
          storyId,
          messageId: id,
          assetId,
          position,
        })),
      );
    return (await this.messagesFrom(tx, storyId, [id]))[0]!;
  }

  async messagesFrom(
    executor: Executor,
    storyId: string,
    ids: string[],
  ): Promise<StoryMessage[]> {
    if (!ids.length) return [];
    const rows = await executor
      .select({ message: storyMessages, revision: storySpeakerRevisions })
      .from(storyMessages)
      .innerJoin(
        storySpeakerRevisions,
        eq(storySpeakerRevisions.id, storyMessages.revisionId),
      )
      .where(
        and(eq(storyMessages.storyId, storyId), inArray(storyMessages.id, ids)),
      )
      .orderBy(asc(storyMessages.sequence));
    const attachments = await executor
      .select({ messageId: storyMessageAssets.messageId, asset: storyAssets })
      .from(storyMessageAssets)
      .innerJoin(storyAssets, eq(storyAssets.id, storyMessageAssets.assetId))
      .where(
        and(
          eq(storyMessageAssets.storyId, storyId),
          inArray(storyMessageAssets.messageId, ids),
        ),
      )
      .orderBy(asc(storyMessageAssets.position));
    return rows.map(({ message, revision }) => ({
      version: 1,
      ...message,
      sequence: String(message.sequence),
      createdAt: message.createdAt.toISOString(),
      speaker: asRevision(revision),
      assets: attachments
        .filter((entry) => entry.messageId === message.id)
        .map(({ asset }) => ({
          id: asset.id,
          storyId,
          name: asset.name,
          mimeType: asset.mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
          sizeBytes: asset.sizeBytes,
          sha256: asset.sha256,
          state: asset.state,
          createdAt: asset.createdAt.toISOString(),
        })),
    }));
  }

  async messages(
    storyId: string,
    userId: string,
    afterValue: unknown = '0',
    throughValue?: unknown,
  ) {
    await this.member(storyId, userId);
    const after = BigInt(storyContract(() => contractSequence(afterValue)));
    const [story] = await this.database.db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));
    const through =
      throughValue === undefined
        ? story!.sequence
        : BigInt(storyContract(() => contractSequence(throughValue)));
    if (through > story!.sequence)
      throw new BadRequestException('Recorte de histórico inválido.');
    const rows = await this.database.db
      .select({ id: storyMessages.id, sequence: storyMessages.sequence })
      .from(storyMessages)
      .where(
        and(
          eq(storyMessages.storyId, storyId),
          gt(storyMessages.sequence, after),
          lte(storyMessages.sequence, through),
        ),
      )
      .orderBy(asc(storyMessages.sequence))
      .limit(STORY_LIMITS.page + 1);
    const complete = rows.length <= STORY_LIMITS.page;
    const page = rows.slice(0, STORY_LIMITS.page);
    return {
      version: 1 as const,
      items: await this.messagesFrom(
        this.database.db,
        storyId,
        page.map((row) => row.id),
      ),
      highWater: String(through),
      cursor: complete ? String(through) : String(page.at(-1)!.sequence),
      complete,
    };
  }

  async events(storyId: string, userId: string, afterValue: unknown = '0') {
    await this.member(storyId, userId);
    const after = BigInt(storyContract(() => contractSequence(afterValue)));
    const [story] = await this.database.db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));
    const rows = await this.database.db
      .select()
      .from(storyEvents)
      .where(
        and(eq(storyEvents.storyId, storyId), gt(storyEvents.sequence, after)),
      )
      .orderBy(asc(storyEvents.sequence))
      .limit(STORY_LIMITS.page + 1);
    const complete = rows.length <= STORY_LIMITS.page;
    const page = rows.slice(0, STORY_LIMITS.page);
    return {
      version: 1 as const,
      items: page.map((event): StoryEvent => ({
        version: 1,
        ...event,
        sequence: String(event.sequence),
        createdAt: event.createdAt.toISOString(),
      })),
      highWater: String(story!.sequence),
      cursor: complete
        ? String(story!.sequence)
        : String(page.at(-1)!.sequence),
      complete,
    };
  }

  async window(
    storyId: string,
    userId: string,
    beforeValue?: unknown,
    throughValue?: unknown,
    sceneId?: string,
  ) {
    await this.member(storyId, userId);
    if (sceneId) {
      storyContract(() => contractId(sceneId));
      await this.requireScene(this.database.db, storyId, sceneId);
    }
    const [story] = await this.database.db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));
    const highWater =
      throughValue === undefined
        ? story!.sequence
        : BigInt(storyContract(() => contractSequence(throughValue)));
    if (highWater > story!.sequence)
      throw new BadRequestException('Recorte de histórico inválido.');
    const before =
      beforeValue === undefined
        ? highWater + 1n
        : BigInt(storyContract(() => contractSequence(beforeValue)));
    const through = before - 1n < highWater ? before - 1n : highWater;
    if (through < 0n)
      return {
        version: 1 as const,
        items: [],
        from: '0',
        through: '0',
        hasOlder: false,
      };
    const rows = await this.database.db
      .select({ id: storyMessages.id, sequence: storyMessages.sequence })
      .from(storyMessages)
      .where(
        and(
          eq(storyMessages.storyId, storyId),
          lte(storyMessages.sequence, through),
          sceneId ? eq(storyMessages.sceneId, sceneId) : undefined,
        ),
      )
      .orderBy(desc(storyMessages.sequence))
      .limit(STORY_LIMITS.page + 1);
    const hasOlder = rows.length > STORY_LIMITS.page;
    const page = rows.slice(0, STORY_LIMITS.page);
    return {
      version: 1 as const,
      items: await this.messagesFrom(
        this.database.db,
        storyId,
        page.map((row) => row.id),
      ),
      from: hasOlder ? String(page.at(-1)!.sequence) : '0',
      through: String(through),
      hasOlder,
    };
  }

  async members(storyId: string, userId: string) {
    await this.member(storyId, userId);
    return this.database.db
      .select({
        userId: storyMembers.userId,
        role: storyMembers.role,
        name: users.displayName,
      })
      .from(storyMembers)
      .innerJoin(users, eq(users.id, storyMembers.userId))
      .where(eq(storyMembers.storyId, storyId));
  }

  async markRead(storyId: string, userId: string, value: unknown) {
    const sequences = storyContract(() => {
      const input = contractRecord(value, ['sequences']);
      if (!Array.isArray(input['sequences']) || input['sequences'].length > 500)
        throw new Error('Recibo de leitura inválido.');
      return [...new Set(input['sequences'].map(contractSequence))];
    });
    return this.locked(storyId, userId, async (tx) => {
      const member = await this.member(storyId, userId, tx);
      if (!sequences.length)
        return { readCursor: String(member.readCursor), seen: member.seen };
      const confirmed = await tx
        .select({ sequence: storyMessages.sequence })
        .from(storyMessages)
        .where(
          and(
            eq(storyMessages.storyId, storyId),
            inArray(storyMessages.sequence, sequences.map(BigInt)),
          ),
        );
      if (confirmed.length !== sequences.length)
        throw new BadRequestException('Recibo contém mensagens indisponíveis.');
      const ranges = mergeReadRanges([
        ...member.seen,
        ...sequences
          .filter((sequence) => BigInt(sequence) > member.readCursor)
          .map((sequence) => [sequence, sequence] as [string, string]),
      ]);
      const maximum = ranges.length
        ? BigInt(ranges.at(-1)![1])
        : member.readCursor;
      const [missing] = await tx
        .select({ sequence: storyMessages.sequence })
        .from(storyMessages)
        .where(
          and(
            eq(storyMessages.storyId, storyId),
            gt(storyMessages.sequence, member.readCursor),
            lte(storyMessages.sequence, maximum),
            sql`${storyMessages.authorUserId} <> ${userId}`,
            sql`not exists (select 1 from jsonb_array_elements(${JSON.stringify(ranges)}::jsonb) ranges where ${storyMessages.sequence} between (ranges->>0)::bigint and (ranges->>1)::bigint)`,
          ),
        )
        .orderBy(asc(storyMessages.sequence))
        .limit(1);
      const cursor = missing ? missing.sequence - 1n : maximum;
      const seen = ranges.filter(([_start, end]) => BigInt(end) > cursor);
      await tx
        .update(storyMembers)
        .set({
          readCursor: cursor > member.readCursor ? cursor : member.readCursor,
          seen,
        })
        .where(
          and(
            eq(storyMembers.storyId, storyId),
            eq(storyMembers.userId, userId),
          ),
        );
      return {
        readCursor: String(
          cursor > member.readCursor ? cursor : member.readCursor,
        ),
        seen,
      };
    });
  }

  async preferences(storyId: string, userId: string, value: unknown) {
    const input = storyContract(() => {
      const record = contractRecord(value, ['sound', 'external']);
      if (
        typeof record['sound'] !== 'boolean' ||
        typeof record['external'] !== 'boolean'
      )
        throw new Error('Preferências inválidas.');
      return { sound: record['sound'], external: record['external'] };
    });
    return this.locked(storyId, userId, async (tx) => {
      await tx
        .update(storyMembers)
        .set(input)
        .where(
          and(
            eq(storyMembers.storyId, storyId),
            eq(storyMembers.userId, userId),
          ),
        );
      return input;
    });
  }

  async invite(storyId: string, userId: string) {
    return this.locked(storyId, userId, async (tx, _story, role) => {
      if (role !== 'owner')
        throw new ForbiddenException('Somente o proprietário pode convidar.');
      const token = randomBytes(32).toString('base64url');
      const [invite] = await tx
        .insert(storyInvites)
        .values({
          storyId,
          issuerUserId: userId,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
        })
        .returning();
      return {
        id: invite!.id,
        storyId,
        token,
        expiresAt: invite!.expiresAt.toISOString(),
      };
    });
  }

  async invites(storyId: string, userId: string) {
    const member = await this.member(storyId, userId);
    if (member.role !== 'owner') throw new ForbiddenException();
    const rows = await this.database.db
      .select({
        id: storyInvites.id,
        storyId: storyInvites.storyId,
        expiresAt: storyInvites.expiresAt,
        consumedAt: storyInvites.consumedAt,
        cancelledAt: storyInvites.cancelledAt,
      })
      .from(storyInvites)
      .where(eq(storyInvites.storyId, storyId));
    return rows.map((row) => ({
      ...row,
      expiresAt: row.expiresAt.toISOString(),
      consumedAt: row.consumedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    }));
  }

  async cancelInvite(storyId: string, userId: string, inviteId: string) {
    storyContract(() => contractId(inviteId));
    return this.locked(storyId, userId, async (tx, _story, role) => {
      if (role !== 'owner') throw new ForbiddenException();
      await tx
        .update(storyInvites)
        .set({ cancelledAt: new Date() })
        .where(
          and(eq(storyInvites.storyId, storyId), eq(storyInvites.id, inviteId)),
        );
      return { cancelled: true };
    });
  }

  async acceptInvite(value: unknown, userId: string) {
    this.settings.assertEnabled();
    const token = storyContract(() => contractString(value, 'Convite', 100));
    if (!/^[a-zA-Z0-9_-]{43}$/.test(token))
      throw new BadRequestException('Convite inválido.');
    return this.database.db.transaction(async (tx) => {
      const [reference] = await tx
        .select({ storyId: storyInvites.storyId })
        .from(storyInvites)
        .where(eq(storyInvites.tokenHash, hash(token)));
      if (!reference) throw new NotFoundException('Convite inválido.');
      await tx
        .select()
        .from(stories)
        .where(eq(stories.id, reference.storyId))
        .for('update');
      const [invite] = await tx
        .select()
        .from(storyInvites)
        .where(eq(storyInvites.tokenHash, hash(token)))
        .for('update');
      if (
        !invite ||
        invite.cancelledAt ||
        invite.consumedAt ||
        invite.expiresAt.getTime() <= Date.now()
      )
        throw new NotFoundException('Convite inválido, expirado ou já usado.');
      // Same story-then-invite lock order as cancellation and membership revocation.
      await tx
        .insert(storyMembers)
        .values({ storyId: invite.storyId, userId, role: 'participant' })
        .onConflictDoNothing();
      await tx
        .update(storyInvites)
        .set({ consumedAt: new Date() })
        .where(eq(storyInvites.id, invite.id));
      return { storyId: invite.storyId };
    });
  }

  async removeMember(storyId: string, userId: string, targetUserId: string) {
    storyContract(() => contractId(targetUserId));
    return this.locked(storyId, userId, async (tx, _story, role) => {
      if (role !== 'owner' && userId !== targetUserId)
        throw new ForbiddenException();
      const [target] = await tx
        .select()
        .from(storyMembers)
        .where(
          and(
            eq(storyMembers.storyId, storyId),
            eq(storyMembers.userId, targetUserId),
          ),
        );
      if (target?.role === 'owner')
        throw new ConflictException(
          'O proprietário não pode sair da História.',
        );
      await tx
        .delete(storyMembers)
        .where(
          and(
            eq(storyMembers.storyId, storyId),
            eq(storyMembers.userId, targetUserId),
          ),
        );
      await this.event(tx, storyId, 'member.removed', targetUserId);
      return { removed: true };
    });
  }
}
