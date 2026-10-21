import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  storyInvites,
  storyMembers,
  storyMessages,
  users,
  vaultMembers,
} from '../database/schema';
import { createStoryTestDatabase } from './story-test-database';
import { StoriesService } from './stories.service';
import { StoryAssetsService } from './story-assets.service';
import { StorySettingsService } from './story-settings.service';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { StoryExportService } from './story-export.service';
import { messageMarkdown } from '../shared/ironpaw';

describe('Stories PostgreSQL integration', () => {
  let database: Awaited<ReturnType<typeof createStoryTestDatabase>>;
  let service: StoriesService, assets: StoryAssetsService, assetRoot: string;
  const owner = randomUUID(),
    guest = randomUUID(),
    stranger = randomUUID();
  beforeAll(async () => {
    assetRoot = await mkdtemp(join(tmpdir(), 'lorekit-story-test-'));
    database = await createStoryTestDatabase(async (pg) => {
      await pg.query(
        'insert into app.users (id, email, email_normalized, password_hash) values ($1, $2, $2, $3)',
        [owner, 'owner@test.invalid', 'not-a-real-password'],
      );
    });
    for (const [id, email] of [
      [guest, 'guest@test.invalid'],
      [stranger, 'stranger@test.invalid'],
    ]) {
      await database.db.insert(users).values({
        id: id!,
        email: email!,
        emailNormalized: email!,
        passwordHash: 'not-a-real-password',
      });
    }
    const provider = { db: database.db } as DatabaseService;
    const settings = {
      enabled: true,
      assertEnabled: () => {},
      assetRoot,
    } as StorySettingsService;
    service = new StoriesService(provider, settings);
    assets = new StoryAssetsService(provider, service, settings);
  }, 60_000);
  afterAll(async () => {
    await database?.postgres.close();
    if (
      assetRoot &&
      assetRoot.startsWith(join(tmpdir(), 'lorekit-story-test-'))
    )
      await rm(assetRoot, { recursive: true, force: true });
  });
  const operation = () => ({ version: 1, operationId: randomUUID() });
  const story = () =>
    service.create({ ...operation(), title: 'História de teste' }, owner);
  async function setup() {
    const current = await story();
    const scene = await service.scene(current.id, owner, {
      ...operation(),
      title: 'Cena inicial',
    });
    const speaker = await service.speaker(current.id, owner, {
      ...operation(),
      sceneId: scene.id,
      kind: 'incidental',
      name: 'Guarda',
      color: '#ffffff',
      portraitAssetId: null,
      mechanics: null,
    });
    return { current, scene, speaker };
  }
  it('migrates an existing database without replacing users and accepts history-only invitations', async () => {
    expect(
      (await database.db.select().from(users).where(eq(users.id, owner)))[0]
        ?.email,
    ).toBe('owner@test.invalid');
    const current = await story();
    const invite = await service.invite(current.id, owner);
    await service.acceptInvite(invite.token, guest);
    expect(
      (await service.list(guest)).some((entry) => entry.id === current.id),
    ).toBe(true);
    expect(
      await database.db
        .select()
        .from(vaultMembers)
        .where(eq(vaultMembers.userId, guest)),
    ).toHaveLength(0);
    await expect(service.detail(current.id, stranger)).rejects.toThrow();
    await expect(service.invite(current.id, guest)).rejects.toThrow();
    await expect(
      service.acceptInvite(invite.token, stranger),
    ).rejects.toThrow();
  });
  it('applies the migrations to an empty database as well', async () => {
    const empty = await createStoryTestDatabase();
    try {
      expect(await empty.db.select().from(storyMessages)).toHaveLength(0);
    } finally {
      await empty.postgres.close();
    }
  }, 30_000);
  it('rejects expired/cancelled invitations and prevents owner departure', async () => {
    const current = await story();
    const cancelled = await service.invite(current.id, owner);
    await service.cancelInvite(current.id, owner, cancelled.id);
    await expect(
      service.acceptInvite(cancelled.token, guest),
    ).rejects.toThrow();
    const expired = await service.invite(current.id, owner);
    await database.db
      .update(storyInvites)
      .set({ expiresAt: new Date(0) })
      .where(eq(storyInvites.id, expired.id));
    await expect(service.acceptInvite(expired.token, guest)).rejects.toThrow();
    await expect(
      service.removeMember(current.id, owner, owner),
    ).rejects.toThrow();
  });
  it('persists once across concurrent retries and refuses cross-history references', async () => {
    const { current, scene, speaker } = await setup();
    const input = {
      ...operation(),
      sceneId: scene.id,
      speakerId: speaker.id,
      revisionId: speaker.revision.id,
      text: 'Uma resposta.',
      assetIds: [],
    };
    const [first, repeated] = await Promise.all([
      service.send(current.id, owner, input),
      service.send(current.id, owner, input),
    ]);
    expect(first.id).toBe(repeated.id);
    expect(
      await database.db
        .select()
        .from(storyMessages)
        .where(eq(storyMessages.storyId, current.id)),
    ).toHaveLength(1);
    await expect(
      service.send(current.id, owner, { ...input, text: 'Outra resposta.' }),
    ).rejects.toThrow();
    const other = await setup();
    await expect(
      service.send(current.id, owner, {
        ...input,
        ...operation(),
        sceneId: other.scene.id,
      }),
    ).rejects.toThrow();
    expect((await service.messages(current.id, owner)).items[0]?.text).toBe(
      input.text,
    );
  });
  it('lets authors and story owners edit text while preserving an edited marker', async () => {
    const { current, scene, speaker } = await setup();
    for (const userId of [guest, stranger]) {
      const invite = await service.invite(current.id, owner);
      await service.acceptInvite(invite.token, userId);
    }
    const authored = await service.send(current.id, guest, {
      ...operation(),
      sceneId: scene.id,
      speakerId: speaker.id,
      revisionId: speaker.revision.id,
      text: 'Texto inicial.',
      assetIds: [],
    });
    await expect(
      service.editMessage(current.id, authored.id, stranger, {
        ...operation(),
        text: 'Alteração de outro participante.',
      }),
    ).rejects.toThrow();
    const editInput = { ...operation(), text: 'Texto revisado.' };
    const [edited, repeated] = await Promise.all([
      service.editMessage(current.id, authored.id, guest, editInput),
      service.editMessage(current.id, authored.id, guest, editInput),
    ]);
    expect(edited.id).toBe(authored.id);
    expect(edited.text).toBe('Texto revisado.');
    expect(edited.editedAt).toEqual(expect.any(String));
    expect(repeated.editedAt).toBe(edited.editedAt);
    const ownerEdit = await service.editMessage(
      current.id,
      authored.id,
      owner,
      { ...operation(), text: 'Revisão do dono.' },
    );
    expect(ownerEdit.text).toBe('Revisão do dono.');
    expect(messageMarkdown(ownerEdit, (assetId) => assetId)).toContain('editada');
    expect(
      (await service.events(current.id, stranger)).items.some(
        (event) => event.type === 'message.updated',
      ),
    ).toBe(true);
  });
  it('consumes a shared invitation once under concurrent acceptance', async () => {
    const current = await story(),
      invite = await service.invite(current.id, owner);
    const outcomes = await Promise.allSettled([
      service.acceptInvite(invite.token, guest),
      service.acceptInvite(invite.token, stranger),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
  });
  it('preserves unread gaps between scenes, merges receipts and paginates exports consistently', async () => {
    const { current, scene, speaker } = await setup();
    const invite = await service.invite(current.id, owner);
    await service.acceptInvite(invite.token, guest);
    const request = {
      sceneId: scene.id,
      speakerId: speaker.id,
      revisionId: speaker.revision.id,
      assetIds: [],
    };
    const messages = [];
    for (let index = 0; index < 102; index++)
      messages.push(
        await service.send(current.id, owner, {
          ...operation(),
          ...request,
          text: `Resposta ${index}`,
        }),
      );
    const first = await service.messages(current.id, guest);
    expect(first.items).toHaveLength(100);
    expect(first.complete).toBe(false);
    const second = await service.messages(
      current.id,
      guest,
      first.cursor,
      first.highWater,
    );
    expect(second.items).toHaveLength(2);
    expect(second.complete).toBe(true);
    await service.markRead(current.id, guest, {
      sequences: [messages[101]!.sequence],
    });
    expect(
      (await service.list(guest)).find((entry) => entry.id === current.id)
        ?.unread,
    ).toBe(101);
    await service.markRead(current.id, guest, {
      sequences: messages.slice(0, 101).map((message) => message.sequence),
    });
    expect(
      (await service.list(guest)).find((entry) => entry.id === current.id)
        ?.unread,
    ).toBe(0);
    const exporter = new StoryExportService(
      { db: database.db } as DatabaseService,
      service,
      { webOrigin: 'https://app.test.invalid' } as StorySettingsService,
    );
    const generator = exporter.generate(current.id, guest);
    let markdown = (await generator.next()).value!;
    await service.send(current.id, owner, {
      ...operation(),
      ...request,
      text: 'Fora do recorte',
    });
    for await (const part of generator) markdown += part;
    expect(markdown).toContain('Resposta 0');
    expect(markdown).toContain('Resposta 101');
    expect(markdown).not.toContain('Fora do recorte');
  }, 60_000);
  it('records a server roll once without mutating the published mechanics', async () => {
    const { current, scene } = await setup();
    const mechanics = {
      kind: 'character',
      actions: [
        {
          id: 'attack',
          name: 'Ataque',
          attribute: 'BODY',
          description: '',
          skillLevel: 2,
          sourceLabel: 'Corpo',
          sourceValue: 2,
          impacts: [],
        },
      ],
    };
    const speaker = await service.speaker(current.id, owner, {
      ...operation(),
      sceneId: null,
      kind: 'character',
      name: 'Heroína',
      color: '#ffffff',
      portraitAssetId: null,
      mechanics,
    });
    const input = {
      ...operation(),
      sceneId: scene.id,
      speakerId: speaker.id,
      revisionId: speaker.revision.id,
      kind: 'attack',
      actionId: 'attack',
      manualModifier: 0,
      competenceId: null,
      target: null,
      targetSpeakerId: null,
      relatedRollMessageId: null,
    };
    const first = await service.roll(current.id, owner, input),
      second = await service.roll(current.id, owner, input);
    expect(first).toEqual(second);
    expect(first.roll?.formula).toBe('2d10+3');
    expect(
      (await service.detail(current.id, owner)).speakers.find(
        (entry) => entry.id === speaker.id,
      )?.revision.mechanics,
    ).toEqual(mechanics);
    await expect(
      service.roll(current.id, owner, {
        ...input,
        ...operation(),
        results: [10],
      }),
    ).rejects.toThrow();
  });
  it('keeps scene order and immutable speaker revisions while all members narrate', async () => {
    const { current, scene, speaker } = await setup();
    const invite = await service.invite(current.id, owner);
    await service.acceptInvite(invite.token, guest);
    const second = await service.scene(current.id, guest, {
      ...operation(),
      title: 'Segunda',
    });
    await service.scene(
      current.id,
      guest,
      { ...operation(), title: 'Renomeada' },
      scene.id,
    );
    const input = {
      sceneId: scene.id,
      speakerId: speaker.id,
      revisionId: speaker.revision.id,
      text: 'Voz compartilhada',
      assetIds: [],
    };
    const historical = await service.send(current.id, guest, {
      ...operation(),
      ...input,
    });
    const revised = await service.speaker(
      current.id,
      guest,
      {
        ...operation(),
        sceneId: scene.id,
        kind: 'incidental',
        name: 'Outro nome',
        color: '#ff0000',
        portraitAssetId: null,
        mechanics: null,
      },
      speaker.id,
    );
    expect(revised.revision.number).toBe(2);
    expect(historical.speaker.name).toBe('Guarda');
    expect(historical.authorUserId).toBe(guest);
    expect(
      (await service.messages(current.id, owner)).items[0]?.speaker.name,
    ).toBe('Guarda');
    expect(
      (await service.detail(current.id, guest)).scenes.map((row) => row.id),
    ).toEqual([scene.id, second.id]);
    await expect(
      service.send(current.id, guest, {
        ...operation(),
        ...input,
        sceneId: second.id,
      }),
    ).rejects.toThrow();
    const projection = {
      ...operation(),
      sceneId: null,
      kind: 'character',
      name: 'Hero',
      color: '#ffffff',
      portraitAssetId: null,
      mechanics: null,
    };
    const shared = await service.speaker(current.id, owner, projection);
    await expect(
      service.speaker(
        current.id,
        guest,
        { ...projection, ...operation() },
        shared.id,
      ),
    ).rejects.toThrow();
    await expect(
      service.speaker(current.id, owner, {
        ...projection,
        ...operation(),
        privateNotes: 'never publish',
      }),
    ).rejects.toThrow();
  });
  it('rejects fake image content and prunes abandoned uploads', async () => {
    const { current } = await setup();
    const bytes = Buffer.from('not an image'),
      id = randomUUID();
    await assets.reserve(current.id, owner, {
      version: 1,
      id,
      name: 'Fake.png',
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    await expect(
      assets.upload(current.id, owner, id, bytes, 'image/png'),
    ).rejects.toThrow('Imagem inválida');
    await database.db.execute(
      sql`update app.story_assets set expires_at = now() - interval '1 day' where id = ${id}`,
    );
    await assets.prune();
    await expect(
      assets.upload(current.id, owner, id, bytes, 'image/png'),
    ).rejects.toThrow('Upload não encontrado');
  });
  it('uploads a validated image owned by the story and publishes only completed attachments', async () => {
    const { current, scene, speaker } = await setup();
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const id = randomUUID();
    await assets.reserve(current.id, owner, {
      version: 1,
      id,
      name: 'Cena.png',
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    const input = {
      ...operation(),
      sceneId: scene.id,
      speakerId: speaker.id,
      revisionId: speaker.revision.id,
      text: 'Uma imagem.',
      assetIds: [id],
    };
    await expect(service.send(current.id, owner, input)).rejects.toThrow();
    await assets.upload(current.id, owner, id, bytes, 'image/png');
    expect((await service.send(current.id, owner, input)).assets[0]?.id).toBe(
      id,
    );
    const invite = await service.invite(current.id, owner);
    await service.acceptInvite(invite.token, guest);
    expect((await assets.get(current.id, guest, id)).bytes).toEqual(bytes);
    const portrait = await service.speaker(current.id, owner, {
      ...operation(),
      sceneId: scene.id,
      kind: 'incidental',
      name: 'Retrato antigo',
      color: '#ffffff',
      portraitAssetId: id,
      mechanics: null,
    });
    const before = await service.send(current.id, guest, {
      ...operation(),
      sceneId: scene.id,
      speakerId: portrait.id,
      revisionId: portrait.revision.id,
      text: 'Memória',
      assetIds: [],
    });
    await service.speaker(
      current.id,
      owner,
      {
        ...operation(),
        sceneId: scene.id,
        kind: 'incidental',
        name: 'Retrato novo',
        color: '#ffffff',
        portraitAssetId: null,
        mechanics: null,
      },
      portrait.id,
    );
    expect(before.speaker.portraitAssetId).toBe(id);
    expect((await assets.get(current.id, guest, id)).bytes).toEqual(bytes);
    const exporter = new StoryExportService(
      { db: database.db } as DatabaseService,
      service,
      { webOrigin: 'https://app.test.invalid' } as StorySettingsService,
    );
    let markdown = '';
    for await (const part of exporter.generate(current.id, guest))
      markdown += part;
    expect(markdown).toContain(
      `https://app.test.invalid/#/stories/${current.id}/assets/${id}`,
    );
    expect(markdown).not.toContain(assetRoot);
    expect(markdown).not.toMatch(/Bearer|access_token|refresh_token/);
    await expect(assets.get(current.id, stranger, id)).rejects.toThrow();
    await service.removeMember(current.id, owner, guest);
    await expect(assets.get(current.id, guest, id)).rejects.toThrow();
    expect(
      await database.db
        .select()
        .from(storyMembers)
        .where(eq(storyMembers.userId, guest)),
    ).toBeDefined();
  });
});
