import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import webPush from 'web-push';
import { DatabaseService } from '../database/database.service';
import {
  refreshSessions,
  storyEvents,
  storyMembers,
  storyMessages,
  storyNotificationDeliveries,
  storyPushSubscriptions,
  users,
} from '../database/schema';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  contractId,
  contractRecord,
  contractString,
  type StoryEvent,
} from '../shared/ironpaw';
import { StoriesService, storyContract } from './stories.service';
import { StorySettingsService } from './story-settings.service';
import type { StorySocket } from './story.gateway';

const SUPPORTED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
];
@Injectable()
export class StoryPushService {
  private running = false;
  constructor(
    private readonly database: DatabaseService,
    private readonly access: StoriesService,
    private readonly settings: StorySettingsService,
  ) {}

  async register(auth: AuthenticatedRequest, value: unknown) {
    this.settings.assertEnabled();
    if (!this.settings.vapidPrivateKey || !this.settings.vapidPublicKey)
      throw new BadRequestException(
        'Web Push não está configurado neste servidor.',
      );
    const input = storyContract(() => {
      const record = contractRecord(value, [
        'installationId',
        'endpoint',
        'p256dh',
        'auth',
      ]);
      const endpoint = contractString(record['endpoint'], 'Endpoint', 4096);
      const url = new URL(endpoint);
      if (
        url.protocol !== 'https:' ||
        !SUPPORTED_PUSH_HOSTS.includes(url.hostname) ||
        url.port ||
        url.username ||
        url.password
      )
        throw new Error('Serviço de push não suportado.');
      const p256dh = contractString(record['p256dh'], 'Chave pública', 100),
        secret = contractString(record['auth'], 'Chave de autenticação', 30);
      if (
        !/^[a-zA-Z0-9_-]+={0,2}$/.test(p256dh) ||
        !/^[a-zA-Z0-9_-]+={0,2}$/.test(secret) ||
        Buffer.from(p256dh, 'base64url').length !== 65 ||
        Buffer.from(p256dh, 'base64url')[0] !== 4 ||
        Buffer.from(secret, 'base64url').length !== 16
      )
        throw new Error('Assinatura push inválida.');
      return {
        installationId: contractId(record['installationId']),
        endpoint,
        p256dh,
        auth: secret,
      };
    });
    await this.database.db
      .insert(storyPushSubscriptions)
      .values({ ...input, userId: auth.userId, sessionId: auth.sessionId })
      .onConflictDoUpdate({
        target: storyPushSubscriptions.endpoint,
        set: {
          ...input,
          userId: auth.userId,
          sessionId: auth.sessionId,
          active: true,
          updatedAt: new Date(),
        },
      });
    return { registered: true };
  }

  async unregister(auth: AuthenticatedRequest, installationId: string) {
    storyContract(() => contractId(installationId));
    await this.database.db
      .update(storyPushSubscriptions)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(storyPushSubscriptions.userId, auth.userId),
          eq(storyPushSubscriptions.installationId, installationId),
        ),
      );
    return { removed: true };
  }

  async presented(
    auth: AuthenticatedRequest,
    eventId: string,
    installationValue: unknown,
  ) {
    storyContract(() => contractId(eventId));
    const installationId = storyContract(() => contractId(installationValue));
    const [event] = await this.database.db
      .select()
      .from(storyEvents)
      .where(eq(storyEvents.id, eventId));
    if (!event) throw new BadRequestException('Evento não encontrado.');
    await this.access.member(event.storyId, auth.userId);
    await this.database.db
      .insert(storyNotificationDeliveries)
      .values({
        eventId,
        userId: auth.userId,
        installationId,
        channel: 'live',
        state: 'presented',
      })
      .onConflictDoUpdate({
        target: [
          storyNotificationDeliveries.eventId,
          storyNotificationDeliveries.userId,
          storyNotificationDeliveries.installationId,
        ],
        set: { state: 'presented', updatedAt: new Date() },
      });
    return { accepted: true };
  }

  async schedule(
    event: StoryEvent,
    sockets: readonly StorySocket[],
  ): Promise<void> {
    if (
      event.type !== 'message.created' ||
      Date.now() - Date.parse(event.createdAt) > 300_000
    )
      return;
    const [message] = await this.database.db
      .select()
      .from(storyMessages)
      .where(eq(storyMessages.id, event.entityId));
    if (!message) return;
    const members = await this.database.db
      .select()
      .from(storyMembers)
      .where(eq(storyMembers.storyId, event.storyId));
    for (const member of members) {
      if (
        member.userId === message.authorUserId ||
        this.wasRead(member, event.sequence)
      )
        continue;
      const connected = sockets.filter(
        (socket) =>
          socket.storyConnection?.auth.userId === member.userId &&
          socket.rooms.has(`story:${event.storyId}`),
      );
      if (member.sound)
        for (const socket of connected) {
          if (
            socket.visibleStoryId !== event.storyId ||
            (socket.visibleUntil ?? 0) <= Date.now()
          )
            socket.emit('story.sound', {
              eventId: event.id,
              storyId: event.storyId,
              accountId: member.userId,
              createdAt: event.createdAt,
            });
        }
      if (!member.external) continue;
      const subscriptions = await this.database.db
        .select()
        .from(storyPushSubscriptions)
        .where(
          and(
            eq(storyPushSubscriptions.userId, member.userId),
            eq(storyPushSubscriptions.active, true),
          ),
        );
      const installations = new Set([
        ...connected.map((socket) => socket.storyConnection!.installationId),
        ...subscriptions.map((subscription) => subscription.installationId),
      ]);
      for (const installationId of installations) {
        const local = connected.filter(
          (socket) => socket.storyConnection!.installationId === installationId,
        );
        const visible = local.some(
          (socket) =>
            socket.visibleStoryId === event.storyId &&
            (socket.visibleUntil ?? 0) > Date.now(),
        );
        const [created] = await this.database.db
          .insert(storyNotificationDeliveries)
          .values({
            eventId: event.id,
            userId: member.userId,
            installationId,
            channel: local.length ? 'live' : 'push',
            state: visible ? 'skipped' : 'pending',
          })
          .onConflictDoNothing()
          .returning();
        if (!created || visible) continue;
        for (const socket of local)
          socket.emit('story.alert', {
            eventId: event.id,
            storyId: event.storyId,
            accountId: member.userId,
            sequence: event.sequence,
          });
      }
    }
  }

  async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.flushPending();
    } finally {
      this.running = false;
    }
  }

  private async flushPending(): Promise<void> {
    const pending = await this.database.db
      .select({ delivery: storyNotificationDeliveries, event: storyEvents })
      .from(storyNotificationDeliveries)
      .innerJoin(
        storyEvents,
        eq(storyEvents.id, storyNotificationDeliveries.eventId),
      )
      .where(
        and(
          eq(storyNotificationDeliveries.state, 'pending'),
          lt(
            storyNotificationDeliveries.updatedAt,
            new Date(Date.now() - 2500),
          ),
        ),
      )
      .limit(100);
    for (const { delivery, event } of pending) {
      const setState = async (
        state: 'sent' | 'skipped' | 'pending',
        attempts = delivery.attempts,
      ) => {
        await this.database.db
          .update(storyNotificationDeliveries)
          .set({ state, attempts, updatedAt: new Date() })
          .where(
            and(
              eq(storyNotificationDeliveries.eventId, delivery.eventId),
              eq(storyNotificationDeliveries.userId, delivery.userId),
              eq(
                storyNotificationDeliveries.installationId,
                delivery.installationId,
              ),
              eq(storyNotificationDeliveries.state, 'pending'),
            ),
          );
      };
      const [member] = await this.database.db
        .select()
        .from(storyMembers)
        .where(
          and(
            eq(storyMembers.storyId, event.storyId),
            eq(storyMembers.userId, delivery.userId),
          ),
        );
      if (
        !member ||
        !member.external ||
        this.wasRead(member, String(event.sequence)) ||
        Date.now() - event.createdAt.getTime() > 300_000 ||
        delivery.attempts >= 3
      ) {
        await setState('skipped');
        continue;
      }
      if (!this.settings.vapidPublicKey || !this.settings.vapidPrivateKey) {
        await setState('skipped');
        continue;
      }
      const subscriptions = await this.database.db
        .select({ subscription: storyPushSubscriptions })
        .from(storyPushSubscriptions)
        .innerJoin(
          refreshSessions,
          eq(refreshSessions.id, storyPushSubscriptions.sessionId),
        )
        .innerJoin(users, eq(users.id, storyPushSubscriptions.userId))
        .where(
          and(
            eq(storyPushSubscriptions.userId, delivery.userId),
            eq(storyPushSubscriptions.installationId, delivery.installationId),
            eq(storyPushSubscriptions.active, true),
            isNull(refreshSessions.revokedAt),
            gt(refreshSessions.expiresAt, new Date()),
            eq(users.isActive, true),
          ),
        );
      if (!subscriptions.length) {
        await setState('skipped');
        continue;
      }
      try {
        // One endpoint per installation receives the event; the worker deduplicates delivery retries.
        const subscription = subscriptions[0]!.subscription;
        await this.access.member(event.storyId, delivery.userId);
        const payload = JSON.stringify({
          eventId: event.id,
          storyId: event.storyId,
          accountId: delivery.userId,
          sequence: String(event.sequence),
          sound: member.sound,
        });
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          {
            TTL: 300,
            timeout: 10_000,
            vapidDetails: {
              subject: this.settings.vapidSubject,
              publicKey: this.settings.vapidPublicKey,
              privateKey: this.settings.vapidPrivateKey,
            },
          },
        );
        await setState('sent', delivery.attempts + 1);
      } catch (error) {
        const status =
          error && typeof error === 'object' && 'statusCode' in error
            ? Number(error.statusCode)
            : 0;
        if (status === 404 || status === 410) {
          await this.database.db
            .update(storyPushSubscriptions)
            .set({ active: false, updatedAt: new Date() })
            .where(
              and(
                eq(storyPushSubscriptions.userId, delivery.userId),
                eq(
                  storyPushSubscriptions.installationId,
                  delivery.installationId,
                ),
              ),
            );
          await setState('skipped', delivery.attempts + 1);
        } else {
          await setState('pending', delivery.attempts + 1);
        }
      }
    }
  }

  private wasRead(
    member: typeof storyMembers.$inferSelect,
    sequence: string,
  ): boolean {
    const value = BigInt(sequence);
    return (
      value <= member.readCursor ||
      member.seen.some(
        ([start, end]) => value >= BigInt(start) && value <= BigInt(end),
      )
    );
  }
}
