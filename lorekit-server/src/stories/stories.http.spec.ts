import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { DatabaseService } from '../database/database.service';
import { refreshSessions, users } from '../database/schema';
import { EnvironmentService } from '../config/environment.service';
import { AuthService } from '../auth/auth.service';
import { AuthTokenService } from '../auth/auth-token.service';
import { PasswordService } from '../auth/password.service';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { createNpcDefinition } from '../shared/ironpaw';
import { createStoryTestDatabase } from './story-test-database';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { StoryAssetsService } from './story-assets.service';
import { StoryExportService } from './story-export.service';
import { StorySettingsService } from './story-settings.service';
import { StoryRealtimeService } from './story-realtime.service';
import { StoryPushService } from './story-push.service';

describe('Story authenticated HTTP flow', () => {
  let database: Awaited<ReturnType<typeof createStoryTestDatabase>>,
    app: NestFastifyApplication,
    assetRoot: string;
  const owner = randomUUID(),
    guest = randomUUID(),
    outsider = randomUUID(),
    tokens = new Map<string, string>();
  const operation = () => ({ version: 1, operationId: randomUUID() });
  beforeAll(async () => {
    database = await createStoryTestDatabase();
    assetRoot = await mkdtemp(join(tmpdir(), 'lorekit-story-http-'));
    const provider = { db: database.db } as DatabaseService;
    const environment = {
      values: {
        auth: {
          jwtSecret: 'http-integration-test-secret-32-characters',
          jwtIssuer: 'test',
          jwtAudience: 'test-client',
          accessTokenTtlSeconds: 900,
        },
      },
    } as EnvironmentService;
    const tokenService = new AuthTokenService(new JwtService(), environment);
    for (const id of [owner, guest, outsider]) {
      await database.db.insert(users).values({
        id,
        email: `${id}@test.invalid`,
        emailNormalized: `${id}@test.invalid`,
        passwordHash: 'test',
      });
      const sessionId = randomUUID();
      await database.db.insert(refreshSessions).values({
        id: sessionId,
        userId: id,
        tokenHash: sessionId,
        expiresAt: new Date(Date.now() + 60_000),
      });
      tokens.set(
        id,
        await tokenService.sign({ userId: id, sessionId, tokenVersion: 0 }),
      );
    }
    class TestModule {}
    Module({
      controllers: [StoriesController],
      providers: [
        AccessTokenGuard,
        StoriesService,
        StoryAssetsService,
        StoryExportService,
        StoryRealtimeService,
        StoryPushService,
        { provide: DatabaseService, useValue: provider },
        {
          provide: StorySettingsService,
          useValue: {
            enabled: true,
            assertEnabled() {},
            assetRoot,
            webOrigin: 'https://app.test.invalid',
          },
        },
        { provide: AuthTokenService, useValue: tokenService },
        {
          provide: AuthService,
          useValue: new AuthService(
            provider,
            {} as PasswordService,
            tokenService,
            environment,
          ),
        },
      ],
    })(TestModule);
    app = await NestFactory.create<NestFastifyApplication>(
      TestModule,
      new FastifyAdapter(),
      { logger: false },
    );
    app
      .getHttpAdapter()
      .getInstance()
      .addContentTypeParser(
        /^image\/(png|jpeg|webp)$/,
        { parseAs: 'buffer', bodyLimit: 10 * 1024 * 1024 },
        (_request, body, done) => done(null, body),
      );
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 60_000);
  afterAll(async () => {
    await app?.close();
    await database?.postgres.close();
    if (assetRoot?.startsWith(join(tmpdir(), 'lorekit-story-http-')))
      await rm(assetRoot, { recursive: true, force: true });
  });
  async function request(
    userId: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload?: object | Buffer,
    mime?: string,
  ) {
    return app.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${tokens.get(userId)}`,
        ...(mime ? { 'content-type': mime } : {}),
      },
      payload,
    });
  }
  it('runs two accounts through scene, image, NPC, roll and Markdown without vault access', async () => {
    const created = await request(owner, 'POST', '/stories', {
      ...operation(),
      title: 'RP HTTP',
    });
    expect(created.statusCode).toBe(201);
    const storyId = created.json<{ id: string }>().id;
    const invite = (
      await request(owner, 'POST', `/stories/${storyId}/invites`)
    ).json<{ token: string }>();
    expect(
      (
        await request(guest, 'POST', '/story-invites/accept', {
          token: invite.token,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (await request(outsider, 'GET', `/stories/${storyId}`)).statusCode,
    ).toBe(404);
    const scene = (
      await request(guest, 'POST', `/stories/${storyId}/scenes`, {
        ...operation(),
        title: 'Abertura',
      })
    ).json<{ id: string }>();
    const definition = createNpcDefinition();
    definition.threatLevel = 2;
    const speakerResponse = await request(
      owner,
      'POST',
      `/stories/${storyId}/speakers`,
      {
        ...operation(),
        sceneId: scene.id,
        kind: 'npc',
        name: 'Guarda',
        color: '#ffffff',
        portraitAssetId: null,
        mechanics: { kind: 'npc', definition },
      },
    );
    expect(speakerResponse.statusCode).toBe(201);
    const speaker = speakerResponse.json<{
      id: string;
      revision: { id: string };
    }>();
    const bytes = await sharp({
        create: { width: 2, height: 2, channels: 3, background: 'blue' },
      })
        .png()
        .toBuffer(),
      assetId = randomUUID();
    expect(
      (
        await request(guest, 'POST', `/stories/${storyId}/assets`, {
          version: 1,
          id: assetId,
          name: 'Cena.png',
          mimeType: 'image/png',
          sizeBytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await request(
          guest,
          'PUT',
          `/stories/${storyId}/assets/${assetId}`,
          bytes,
          'image/png',
        )
      ).statusCode,
    ).toBe(200);
    const base = {
      sceneId: scene.id,
      speakerId: speaker.id,
      revisionId: speaker.revision.id,
    };
    const input = {
      ...operation(),
      ...base,
      text: '**Olá**',
      assetIds: [assetId],
    };
    const message = await request(
      guest,
      'POST',
      `/stories/${storyId}/messages`,
      input,
    );
    expect(message.statusCode).toBe(201);
    expect(
      (
        await request(guest, 'POST', `/stories/${storyId}/messages`, input)
      ).json(),
    ).toEqual(message.json());
    const roll = await request(guest, 'POST', `/stories/${storyId}/rolls`, {
      ...operation(),
      ...base,
      kind: 'defense',
      actionId: 'attribute:BODY',
      manualModifier: 0,
      competenceId: null,
      target: null,
      targetSpeakerId: null,
      relatedRollMessageId: null,
    });
    expect(roll.statusCode).toBe(201);
    expect(roll.json<{ roll: { formula: string } }>().roll.formula).toBe(
      '1d10+2',
    );
    expect(
      (await request(guest, 'GET', `/stories/${storyId}/assets/${assetId}`))
        .rawPayload,
    ).toEqual(bytes);
    expect(
      (await request(outsider, 'GET', `/stories/${storyId}/assets/${assetId}`))
        .statusCode,
    ).toBe(404);
    const markdown = await request(
      guest,
      'GET',
      `/stories/${storyId}/export.md`,
    );
    expect(markdown.statusCode).toBe(200);
    expect(markdown.body).toContain('**Olá**');
    expect(markdown.body).toContain('1d10\\+2');
    expect(markdown.body).toContain(`/#/stories/${storyId}/assets/${assetId}`);
    expect(
      (await request(owner, 'DELETE', `/stories/${storyId}/members/${guest}`))
        .statusCode,
    ).toBe(200);
    expect(
      (await request(guest, 'GET', `/stories/${storyId}/messages`)).statusCode,
    ).toBe(404);
  }, 30_000);
});
