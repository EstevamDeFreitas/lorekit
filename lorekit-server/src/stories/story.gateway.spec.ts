import { createServer, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { createStoryTestDatabase } from './story-test-database';
import { DatabaseService } from '../database/database.service';
import { users, refreshSessions } from '../database/schema';
import { EnvironmentService } from '../config/environment.service';
import { AuthService } from '../auth/auth.service';
import { AuthTokenService } from '../auth/auth-token.service';
import { PasswordService } from '../auth/password.service';
import { StoriesService } from './stories.service';
import { StorySettingsService } from './story-settings.service';
import { StoryRealtimeService } from './story-realtime.service';
import { StoryGateway, StorySocket } from './story.gateway';
import { StoryAssetsService } from './story-assets.service';
import { StoryPushService } from './story-push.service';

describe('Story WebSocket integration', () => {
  let database: Awaited<ReturnType<typeof createStoryTestDatabase>>;
  let server: HttpServer,
    socketServer: Server,
    gateway: StoryGateway,
    realtime: StoryRealtimeService,
    stories: StoriesService;
  let url: string, token: string;
  const owner = randomUUID(),
    guest = randomUUID(),
    sessionId = randomUUID(),
    clients: Socket[] = [];
  beforeAll(async () => {
    database = await createStoryTestDatabase();
    for (const id of [owner, guest])
      await database.db.insert(users).values({
        id,
        email: `${id}@test.invalid`,
        emailNormalized: `${id}@test.invalid`,
        passwordHash: 'test',
      });
    await database.db.insert(refreshSessions).values({
      id: sessionId,
      userId: guest,
      tokenHash: 'test-session',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const provider = { db: database.db } as DatabaseService;
    const settings = {
      enabled: true,
      assertEnabled: () => {},
    } as StorySettingsService;
    const environment = {
      values: {
        corsOrigins: ['http://localhost:4401'],
        auth: {
          jwtSecret: 'isolated-tests-secret-at-least-32-characters',
          jwtIssuer: 'test',
          jwtAudience: 'test-client',
          accessTokenTtlSeconds: 60,
        },
      },
    } as EnvironmentService;
    const tokens = new AuthTokenService(new JwtService(), environment);
    const auth = new AuthService(
      provider,
      {} as PasswordService,
      tokens,
      environment,
    );
    token = await tokens.sign({ userId: guest, sessionId, tokenVersion: 0 });
    stories = new StoriesService(provider, settings);
    realtime = new StoryRealtimeService(auth, tokens, settings);
    server = createServer();
    socketServer = new Server(server, {
      path: '/story-realtime',
      transports: ['websocket'],
    });
    gateway = new StoryGateway(
      provider,
      stories,
      realtime,
      { prune: async () => {} } as StoryAssetsService,
      environment,
      settings,
      {
        schedule: async () => {},
        flush: async () => {},
      } as unknown as StoryPushService,
    );
    const namespace = socketServer.of('/stories');
    gateway.afterInit(namespace);
    gateway.onModuleDestroy();
    namespace.on('connection', (socket) => {
      socket.on(
        'story.join',
        (body: unknown, ack: (value: unknown) => void) => {
          void gateway.join(socket as StorySocket, body).then(ack);
        },
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing test server');
    url = `http://127.0.0.1:${address.port}/stories`;
  }, 60_000);
  afterAll(async () => {
    clients.forEach((client) => client.disconnect());
    gateway?.onModuleDestroy();
    if (socketServer)
      await new Promise<void>((resolve) => socketServer.close(() => resolve()));
    await database?.postgres.close();
  });
  function next<T>(client: Socket, event: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Missing ${event}`)),
        5000,
      );
      client.once(event, (value: T) => {
        clearTimeout(timeout);
        resolve(value);
      });
    });
  }
  function client(ticket: string, origin = 'http://localhost:4401') {
    const socket = io(url, {
      path: '/story-realtime',
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
      auth: { ticket },
      extraHeaders: { Origin: origin },
    });
    clients.push(socket);
    return socket;
  }
  it('checks origin, consumes tickets once, delivers after commit and revokes a connected guest', async () => {
    const ticket = await realtime.ticket(`Bearer ${token}`, randomUUID());
    const invalid = client(ticket.ticket, 'https://untrusted.invalid');
    const invalidResult = next<Error>(invalid, 'connect_error');
    invalid.connect();
    expect(await invalidResult).toBeInstanceOf(Error);
    const socket = client(ticket.ticket),
      connected = next(socket, 'connect');
    socket.connect();
    await connected;
    const reused = client(ticket.ticket),
      rejected = next(reused, 'connect_error');
    reused.connect();
    await rejected;
    const current = await stories.create(
      { version: 1, operationId: randomUUID(), title: 'Socket test' },
      owner,
    );
    const invitation = await stories.invite(current.id, owner);
    await stories.acceptInvite(invitation.token, guest);
    const denied = await socket.emitWithAck('story.join', randomUUID());
    expect(denied.joined).toBe(false);
    const accepted = await socket.emitWithAck('story.join', current.id);
    expect(accepted.joined).toBe(true);
    const event = next<{ storyId: string; type: string }>(
      socket,
      'story.event',
    );
    await stories.scene(current.id, owner, {
      version: 1,
      operationId: randomUUID(),
      title: 'Abertura',
    });
    // A replacement dispatcher has no in-memory event state: committed rows survive it.
    gateway.onModuleDestroy();
    const old = gateway;
    gateway = Object.create(Object.getPrototypeOf(old)) as StoryGateway;
    Object.assign(gateway, old, { running: false, timer: null });
    await gateway.flush();
    expect(await event).toMatchObject({
      storyId: current.id,
      type: 'scene.created',
    });
    expect(
      (await stories.events(current.id, guest, '0')).items.some(
        (item) => item.type === 'scene.created',
      ),
    ).toBe(true);
    const revoked = next(socket, 'story.revoked');
    await stories.removeMember(current.id, owner, guest);
    await gateway.flush();
    await revoked;
    expect((await socket.emitWithAck('story.join', current.id)).joined).toBe(
      false,
    );
    const disconnected = next(socket, 'disconnect');
    await database.db
      .update(refreshSessions)
      .set({ revokedAt: new Date() })
      .where(eq(refreshSessions.id, sessionId));
    await gateway.flush();
    await disconnected;
  }, 30_000);
});
