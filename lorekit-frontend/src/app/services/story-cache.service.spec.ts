import { TestBed } from '@angular/core/testing';
import type { StoryDetail, StoryMessage } from '@lorekit/ironpaw';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { StoryCacheService } from './story-cache.service';

describe('Per-account story cache', () => {
  const account = '3a8ea667-ed8d-4a71-9957-42e0a0bc797f',
    other = '4a8ea667-ed8d-4a71-9957-42e0a0bc797f';
  const storyId = '5a8ea667-ed8d-4a71-9957-42e0a0bc797f';
  let cache: StoryCacheService,
    storage: jasmine.SpyObj<BrowserDatabaseStorageService>;
  let bytes: Uint8Array | null;
  let original: Window['electronAPI'];
  const message: StoryMessage = {
    version: 1,
    id: crypto.randomUUID(),
    storyId,
    sceneId: crypto.randomUUID(),
    sequence: '3',
    operationId: crypto.randomUUID(),
    authorUserId: account,
    authorName: 'Autor',
    speaker: {
      id: crypto.randomUUID(),
      storyId,
      speakerId: crypto.randomUUID(),
      number: 1,
      name: 'Guarda',
      color: '#ffffff',
      portraitAssetId: null,
      mechanics: null,
      createdAt: new Date().toISOString(),
    },
    text: 'Uma resposta.',
    assets: [],
    roll: null,
    createdAt: new Date().toISOString(),
  };
  beforeEach(() => {
    original = window.electronAPI;
    delete window.electronAPI;
    localStorage.clear();
    bytes = null;
    storage = jasmine.createSpyObj('storage', [
      'read',
      'write',
      'deleteWorkspace',
      'writeBlob',
      'readBlob',
      'deleteBlob',
    ]);
    storage.read.and.callFake(async () => bytes);
    storage.write.and.callFake(async (_user, _vault, value) => {
      bytes = value.slice();
    });
    storage.deleteWorkspace.and.callFake(async () => {
      bytes = null;
    });
    storage.writeBlob.and.resolveTo();
    storage.readBlob.and.resolveTo(null);
    TestBed.configureTestingModule({
      providers: [
        StoryCacheService,
        { provide: BrowserDatabaseStorageService, useValue: storage },
      ],
    });
    cache = TestBed.inject(StoryCacheService);
  });
  afterEach(async () => {
    await cache.transition(account);
    if (original) window.electronAPI = original;
    else delete window.electronAPI;
    localStorage.clear();
  });
  it('persists confirmed pages and keeps partial coverage distinct from full history', async () => {
    await cache.open(account);
    await cache.savePage(
      storyId,
      '2',
      {
        version: 1,
        items: [message],
        cursor: '8',
        highWater: '8',
        complete: false,
      },
      '8',
    );
    expect(cache.messages(storyId)).toEqual([message]);
    expect(cache.complete(storyId, '8')).toBeFalse();
    await cache.savePage(storyId, '0', {
      version: 1,
      items: [],
      cursor: '1',
      highWater: '8',
      complete: false,
    });
    expect(cache.complete(storyId, '8')).toBeTrue();
    expect(cache.cursor(storyId)).toBe('8');
    const reopened = TestBed.runInInjectionContext(
      () => new StoryCacheService(),
    );
    await reopened.open(account);
    expect(reopened.messages(storyId)).toEqual([message]);
    await reopened.transition(account);
  });
  it('rolls back in-memory messages, coverage and cursor when persistence fails', async () => {
    await cache.open(account);
    storage.write.and.rejectWith(
      new DOMException('Full', 'QuotaExceededError'),
    );
    await expectAsync(
      cache.savePage(
        storyId,
        '0',
        {
          version: 1,
          items: [message],
          cursor: '3',
          highWater: '3',
          complete: true,
        },
        '3',
      ),
    ).toBeRejected();
    expect(cache.cursor(storyId)).toBe('0');
    expect(cache.messages(storyId)).toEqual([]);
    expect(cache.complete(storyId, '3')).toBeFalse();
    expect(cache.warning()).not.toBe('');
  });
  it('uses scoped desktop IPC and removes account data on logout', async () => {
    const read = jasmine
        .createSpy('readStoryCache')
        .and.callFake(async () => bytes),
      write = jasmine
        .createSpy('writeStoryCache')
        .and.callFake(
          async (_user: string, _asset: string | null, value: Uint8Array) => {
            bytes = value.slice();
            return true;
          },
        ),
      remove = jasmine.createSpy('deleteStoryCache').and.resolveTo(true);
    window.electronAPI = {
      readStoryCache: read,
      writeStoryCache: write,
      deleteStoryCache: remove,
    };
    await cache.open(account);
    await cache.saveMessage(message);
    expect(write).toHaveBeenCalledWith(account, null, jasmine.any(Uint8Array));
    await cache.transition(account);
    expect(remove).toHaveBeenCalledWith(account, null);
    expect(cache.knownAccount()).toBeNull();
  });
  it('does not store an old download under a newly selected account', async () => {
    await cache.open(account);
    await cache.transition(account);
    await cache.open(other);
    await expectAsync(
      cache.saveAsset(
        storyId,
        crypto.randomUUID(),
        new Blob(['image']),
        '',
        account,
      ),
    ).toBeRejected();
    expect(storage.writeBlob).not.toHaveBeenCalled();
  });
});
