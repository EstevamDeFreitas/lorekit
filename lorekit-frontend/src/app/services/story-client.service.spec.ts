import {
  TestBed,
  fakeAsync,
  flushMicrotasks,
  tick,
} from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type {
  StoryDetail,
  StoryMessage,
  StoryMessageInput,
} from '@lorekit/ironpaw';
import { StoryClientService } from './story-client.service';
import { StoryApiService } from './story-api.service';
import { StoryCacheService } from './story-cache.service';
import { AuthService } from './auth.service';

describe('Online-only story client', () => {
  const account = '3a8ea667-ed8d-4a71-9957-42e0a0bc797f',
    storyId = crypto.randomUUID(),
    sceneId = crypto.randomUUID(),
    speakerId = crypto.randomUUID(),
    revisionId = crypto.randomUUID();
  let client: StoryClientService,
    api: jasmine.SpyObj<StoryApiService>,
    cache: jasmine.SpyObj<StoryCacheService>,
    online: jasmine.Spy,
    pending: string[];
  const detail: StoryDetail = {
    story: {
      version: 1,
      id: storyId,
      ownerUserId: account,
      title: 'RP',
      sequence: '0',
      createdAt: '',
      updatedAt: '',
    },
    member: {
      storyId,
      userId: account,
      role: 'owner',
      readCursor: '0',
      seen: [],
      sound: true,
      external: true,
    },
    scenes: [],
    speakers: [],
  };
  const input: StoryMessageInput = {
    version: 1,
    operationId: crypto.randomUUID(),
    sceneId,
    speakerId,
    revisionId,
    text: 'Resposta',
    assetIds: [],
  };
  const message: StoryMessage = {
    version: 1,
    id: crypto.randomUUID(),
    storyId,
    sceneId,
    sequence: '1',
    operationId: input.operationId,
    authorUserId: account,
    authorName: 'Autor',
    text: input.text,
    assets: [],
    roll: null,
    createdAt: '',
    speaker: {
      id: revisionId,
      storyId,
      speakerId,
      number: 1,
      name: 'Locutor',
      color: '#ffffff',
      portraitAssetId: null,
      mechanics: null,
      createdAt: '',
    },
  };
  beforeEach(async () => {
    pending = [];
    online = spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
    api = jasmine.createSpyObj('api', [
      'send',
      'roll',
      'operation',
      'capabilities',
      'list',
      'post',
      'detail',
    ]);
    cache = jasmine.createSpyObj('cache', [
      'open',
      'summaries',
      'rememberPending',
      'forgetPending',
      'pending',
      'saveMessage',
      'transition',
      'asset',
      'complete',
      'allMessages',
      'saveSummaries',
      'removeStory',
    ]);
    Object.assign(cache, { knownAccount: signal(account) });
    cache.open.and.resolveTo();
    cache.summaries.and.returnValue([]);
    cache.rememberPending.and.callFake(async (_story, id) => {
      pending.push(id);
    });
    cache.forgetPending.and.callFake(async (_story, id) => {
      pending = pending.filter((value) => value !== id);
    });
    cache.pending.and.callFake(() => pending);
    cache.saveMessage.and.resolveTo();
    cache.transition.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        StoryClientService,
        { provide: StoryApiService, useValue: api },
        { provide: StoryCacheService, useValue: cache },
        {
          provide: AuthService,
          useValue: {
            user: signal({ id: account }),
            onSessionCleanup: () => () => {},
          },
        },
      ],
    });
    client = TestBed.inject(StoryClientService);
    await client.initialize();
    client.current.set(detail);
  });
  it('continues by HTTP when the realtime ticket fails and never sends a draft on retry', fakeAsync(() => {
    online.and.returnValue(true);
    client.current.set(null);
    api.capabilities.and.resolveTo({
      version: 1,
      enabled: true,
      push: false,
      vapidPublicKey: null,
    });
    api.list.and.resolveTo([]);
    cache.saveSummaries.and.resolveTo();
    api.post.and.rejectWith(new HttpErrorResponse({ status: 503 }));
    void client.connect();
    flushMicrotasks();
    expect(client.status()).toBe('degraded');
    expect(client.canWrite()).toBeTrue();
    tick(15_000);
    flushMicrotasks();
    expect(api.list.calls.count()).toBeGreaterThan(1);
    expect(api.send).not.toHaveBeenCalled();
    expect(cache.rememberPending).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
  }));
  it('refuses offline messages without creating a pending send', async () => {
    await expectAsync(client.send(input)).toBeRejected();
    expect(api.send).not.toHaveBeenCalled();
    expect(cache.rememberPending).not.toHaveBeenCalled();
  });
  it('reconciles a lost acknowledgement by query without replaying the command', async () => {
    online.and.returnValue(true);
    client.status.set('online');
    api.send.and.rejectWith(new HttpErrorResponse({ status: 0 }));
    await expectAsync(client.send(input)).toBeRejected();
    expect(pending).toEqual([input.operationId]);
    api.operation.and.resolveTo({ result: message });
    await client.reconcile();
    expect(api.send).toHaveBeenCalledTimes(1);
    expect(client.messages()).toEqual([message]);
    expect(pending).toEqual([]);
  });
  it('does not keep definitively rejected input as an uncertain send', async () => {
    online.and.returnValue(true);
    client.status.set('online');
    api.send.and.rejectWith(new HttpErrorResponse({ status: 400 }));
    await expectAsync(client.send(input)).toBeRejected();
    expect(pending).toEqual([]);
    expect(client.uncertain()).toEqual([]);
  });
  it('exports offline only with proven complete coverage', async () => {
    cache.complete.and.returnValue(false);
    await expectAsync(client.export()).toBeRejectedWithError(
      /histórico completo/,
    );
    cache.complete.and.returnValue(true);
    cache.allMessages.and.returnValue([message]);
    client.current.set({
      ...detail,
      scenes: [
        { id: sceneId, storyId, title: 'Cena', position: '1', createdAt: '' },
      ],
    });
    const markdown = await (await client.export()).text();
    expect(markdown).toContain('Resposta');
    expect(markdown).toContain('Cena');
  });
  it('clears the open history and its images after a known access revocation', async () => {
    const assetId = crypto.randomUUID();
    cache.asset.and.resolveTo(new Blob(['image']));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:revoked');
    const revoke = spyOn(URL, 'revokeObjectURL');
    const release = client.retainImage(storyId, assetId);
    await client.imageUrl(storyId, assetId);
    client.messages.set([message]);
    api.detail.and.rejectWith(new HttpErrorResponse({ status: 403 }));
    cache.removeStory.and.resolveTo();
    await client.refreshCurrent();
    expect(client.current()).toBeNull();
    expect(client.messages()).toEqual([]);
    expect(cache.removeStory).toHaveBeenCalledWith(storyId);
    expect(revoke).toHaveBeenCalledWith('blob:revoked');
    expect(await client.imageUrl(storyId, assetId)).toBeNull();
    release();
  });
  it('shares image URLs between readers and releases them after the final reader', async () => {
    cache.asset.and.resolveTo(new Blob(['image']));
    const create = spyOn(URL, 'createObjectURL').and.returnValue('blob:test'),
      revoke = spyOn(URL, 'revokeObjectURL');
    const assetId = crypto.randomUUID(),
      first = client.retainImage(storyId, assetId),
      second = client.retainImage(storyId, assetId);
    expect(await client.imageUrl(storyId, assetId)).toBe('blob:test');
    expect(await client.imageUrl(storyId, assetId)).toBe('blob:test');
    expect(create).toHaveBeenCalledTimes(1);
    first();
    expect(revoke).not.toHaveBeenCalled();
    second();
    expect(revoke).toHaveBeenCalledOnceWith('blob:test');
    expect(await client.imageUrl(storyId, assetId)).toBeNull();
  });
});
