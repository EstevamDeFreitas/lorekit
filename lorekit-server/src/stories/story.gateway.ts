import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Namespace, Socket } from 'socket.io';
import { DatabaseService } from '../database/database.service';
import { storyEvents } from '../database/schema';
import { EnvironmentService } from '../config/environment.service';
import { contractId, type StoryEvent } from '../shared/ironpaw';
import { StoriesService } from './stories.service';
import { StoryAssetsService } from './story-assets.service';
import {
  StoryRealtimeService,
  type StoryConnection,
} from './story-realtime.service';
import { StorySettingsService } from './story-settings.service';
import { StoryPushService } from './story-push.service';

export type StorySocket = Socket & {
  storyConnection?: StoryConnection;
  visibleStoryId?: string | null;
  visibleUntil?: number;
};
@WebSocketGateway({
  namespace: '/stories',
  path: '/story-realtime',
  transports: ['websocket'],
  cors: { origin: false },
})
export class StoryGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Namespace;
  private readonly logger = new Logger(StoryGateway.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastPrune = 0;

  constructor(
    private readonly database: DatabaseService,
    private readonly access: StoriesService,
    private readonly realtime: StoryRealtimeService,
    private readonly assets: StoryAssetsService,
    private readonly environment: EnvironmentService,
    private readonly settings: StorySettingsService,
    private readonly push: StoryPushService,
  ) {}

  afterInit(server: Namespace): void {
    this.server = server;
    server.use(async (socket: StorySocket, next) => {
      try {
        const origin = socket.handshake.headers.origin;
        if (
          typeof origin !== 'string' ||
          !this.environment.values.corsOrigins.includes(origin)
        )
          throw new Error('Origem não autorizada.');
        socket.storyConnection = await this.realtime.consume(
          socket.handshake.auth['ticket'],
        );
        next();
      } catch {
        next(
          new Error(
            'Conexão não autorizada. Renove a sessão e tente novamente.',
          ),
        );
      }
    });
    if (this.settings.enabled) {
      this.timer = setInterval(() => {
        void this.flush();
      }, 750);
      this.timer.unref();
    }
  }

  @SubscribeMessage('story.join')
  async join(
    @ConnectedSocket() socket: StorySocket,
    @MessageBody() body: unknown,
  ) {
    try {
      const storyId = contractId(body);
      const connection = socket.storyConnection;
      if (!connection) throw new Error('Sem sessão.');
      await this.realtime.validate(connection);
      await this.access.member(storyId, connection.auth.userId);
      await socket.join(`story:${storyId}`);
      return { joined: true, storyId };
    } catch {
      return { joined: false };
    }
  }

  @SubscribeMessage('story.visible')
  async visible(
    @ConnectedSocket() socket: StorySocket,
    @MessageBody() body: unknown,
  ) {
    try {
      if (body === null) {
        socket.visibleStoryId = null;
        socket.visibleUntil = 0;
        return { accepted: true };
      }
      const storyId = contractId(body);
      if (!socket.storyConnection) return { accepted: false };
      await this.access.member(storyId, socket.storyConnection.auth.userId);
      socket.visibleStoryId = storyId;
      socket.visibleUntil = Date.now() + 15_000;
      return { accepted: true };
    } catch {
      return { accepted: false };
    }
  }

  async flush(): Promise<void> {
    if (this.running || !this.server || !this.settings.enabled) return;
    this.running = true;
    try {
      // Session revocation is checked even when there are no new story events.
      for (const socket of this.server.sockets.values() as Iterable<StorySocket>) {
        if (!socket.storyConnection) continue;
        try {
          await this.realtime.validate(socket.storyConnection);
        } catch {
          socket.disconnect(true);
        }
      }
      const events = await this.database.db
        .select()
        .from(storyEvents)
        .where(isNull(storyEvents.dispatchedAt))
        .orderBy(asc(storyEvents.createdAt), asc(storyEvents.sequence))
        .limit(100);
      for (const event of events) {
        const payload: StoryEvent = {
          version: 1,
          id: event.id,
          storyId: event.storyId,
          sequence: String(event.sequence),
          type: event.type,
          entityId: event.entityId,
          createdAt: event.createdAt.toISOString(),
        };
        for (const socket of this.server.sockets.values() as Iterable<StorySocket>) {
          const connection = socket.storyConnection;
          if (!connection || !socket.rooms.has(`story:${event.storyId}`))
            continue;
          try {
            await this.realtime.validate(connection);
            await this.access.member(event.storyId, connection.auth.userId);
            socket.emit('story.event', payload);
          } catch {
            socket.emit('story.revoked', { storyId: event.storyId });
            await socket.leave(`story:${event.storyId}`);
          }
        }
        await this.push.schedule(payload, [
          ...this.server.sockets.values(),
        ] as StorySocket[]);
        await this.database.db
          .update(storyEvents)
          .set({ dispatchedAt: new Date() })
          .where(
            and(eq(storyEvents.id, event.id), isNull(storyEvents.dispatchedAt)),
          );
      }
      void this.push
        .flush()
        .catch(() =>
          this.logger.error('Falha ao processar notificações de História.'),
        );
      if (Date.now() - this.lastPrune > 300_000) {
        await this.assets.prune();
        this.lastPrune = Date.now();
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : 'Falha ao despachar eventos de História.',
      );
    } finally {
      this.running = false;
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
