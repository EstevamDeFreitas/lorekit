import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import webPush from 'web-push';
import { DatabaseService } from '../database/database.service';
import {
  refreshSessions,
  storyEvents,
  storyNotificationDeliveries,
  storyPushSubscriptions,
  users,
} from '../database/schema';
import { createStoryTestDatabase } from './story-test-database';
import { StoriesService } from './stories.service';
import { StoryPushService } from './story-push.service';
import { StorySettingsService } from './story-settings.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { StoryEvent } from '../shared/ironpaw';

describe('Story push delivery policy', () => {
  let database: Awaited<ReturnType<typeof createStoryTestDatabase>>;
  let stories: StoriesService, push: StoryPushService;
  const owner = randomUUID(),
    guest = randomUUID(),
    sessionId = randomUUID(),
    installationId = randomUUID();
  const auth = { userId: guest, sessionId } as AuthenticatedRequest;
  const send = jest.spyOn(webPush, 'sendNotification');
  const operation = () => ({ version: 1, operationId: randomUUID() });
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
      tokenHash: 'push-session',
      expiresAt: new Date(Date.now() + 600_000),
    });
    const provider = { db: database.db } as DatabaseService;
    const settings = {
      assertEnabled() {},
      vapidPrivateKey: 'private',
      vapidPublicKey: 'public',
      vapidSubject: 'https://app.test.invalid',
    } as unknown as StorySettingsService;
    stories = new StoriesService(provider, settings);
    push = new StoryPushService(provider, stories, settings);
    const key = Buffer.alloc(65);
    key[0] = 4;
    await push.register(auth, {
      installationId,
      endpoint: 'https://fcm.googleapis.com/test',
      p256dh: key.toString('base64url'),
      auth: Buffer.alloc(16).toString('base64url'),
    });
  }, 60_000);
  afterAll(async () => {
    send.mockRestore();
    await database?.postgres.close();
  });
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  });
  async function pending() {
    const story = await stories.create(
      { ...operation(), title: 'Private title' },
      owner,
    );
    const invite = await stories.invite(story.id, owner);
    await stories.acceptInvite(invite.token, guest);
    await stories.preferences(story.id, guest, { sound: true, external: true });
    const scene = await stories.scene(story.id, owner, {
      ...operation(),
      title: 'Private scene',
    });
    const speaker = await stories.speaker(story.id, owner, {
      ...operation(),
      sceneId: scene.id,
      kind: 'incidental',
      name: 'Private name',
      color: '#ffffff',
      portraitAssetId: null,
      mechanics: null,
    });
    const message = await stories.send(story.id, owner, {
      ...operation(),
      sceneId: scene.id,
      speakerId: speaker.id,
      revisionId: speaker.revision.id,
      text: 'PRIVATE MESSAGE',
      assetIds: [],
    });
    const [row] = await database.db
      .select()
      .from(storyEvents)
      .where(eq(storyEvents.entityId, message.id));
    const event = {
      ...row!,
      version: 1,
      sequence: String(row!.sequence),
      createdAt: row!.createdAt.toISOString(),
    } as StoryEvent;
    await push.schedule(event, []);
    await push.schedule(event, []);
    await database.db
      .update(storyNotificationDeliveries)
      .set({ updatedAt: new Date(Date.now() - 5000) });
    return { story, event };
  }
  it('deduplicates scheduling and sends identifiers without private content', async () => {
    const { event } = await pending();
    await push.flush();
    expect(send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(send.mock.calls[0]![1] as string) as Record<
      string,
      unknown
    >;
    expect(payload).toEqual({
      eventId: event.id,
      storyId: event.storyId,
      accountId: guest,
      sequence: event.sequence,
      sound: true,
    });
    expect(
      await database.db
        .select()
        .from(storyNotificationDeliveries)
        .where(eq(storyNotificationDeliveries.eventId, event.id)),
    ).toHaveLength(1);
  });
  it('rechecks mute and removal before pending delivery', async () => {
    const muted = await pending();
    await stories.preferences(muted.story.id, guest, {
      sound: false,
      external: false,
    });
    const removed = await pending();
    await stories.removeMember(removed.story.id, owner, guest);
    await push.flush();
    expect(send).not.toHaveBeenCalled();
  });
  it('disables an expired endpoint instead of retrying it', async () => {
    await pending();
    send.mockRejectedValue({ statusCode: 410 });
    await push.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(
      (await database.db.select().from(storyPushSubscriptions))[0]?.active,
    ).toBe(false);
  });
  it('rejects local endpoints even with a valid subscription shape', async () => {
    await expect(
      push.register(auth, {
        installationId,
        endpoint: 'https://127.0.0.1/private',
        p256dh: 'bad',
        auth: 'bad',
      }),
    ).rejects.toThrow();
  });
});
