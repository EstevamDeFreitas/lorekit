import { TestBed } from '@angular/core/testing';
import {
  BrowserDatabaseStorageService,
  hasStorageCapacity,
  isStorageQuotaError,
} from './browser-database-storage.service';

describe('BrowserDatabaseStorageService', () => {
  let storage: BrowserDatabaseStorageService;
  let userA: string;
  let userB: string;
  let vault: string;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    storage = TestBed.inject(BrowserDatabaseStorageService);
    userA = `user-a-${crypto.randomUUID()}`;
    userB = `user-b-${crypto.randomUUID()}`;
    vault = `vault-${crypto.randomUUID()}`;
  });

  afterEach(async () => {
    await Promise.all([storage.deleteUser(userA), storage.deleteUser(userB)]);
  });

  it('isolates SQLite bytes by user and vault', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await storage.write(userA, vault, bytes);

    expect(Array.from(await storage.read(userA, vault) ?? [])).toEqual([1, 2, 3, 4]);
    expect(await storage.read(userB, vault)).toBeNull();
    expect(await storage.read(userA, `${vault}-other`)).toBeNull();
  });

  it('deletes only the explicit user cache on logout', async () => {
    await storage.write(userA, vault, new Uint8Array([10]));
    await storage.write(userB, vault, new Uint8Array([20]));

    await storage.deleteUser(userA);

    expect(await storage.read(userA, vault)).toBeNull();
    expect(Array.from(await storage.read(userB, vault) ?? [])).toEqual([20]);
  });

  it('isolates blob cache entries using the same account and vault boundary', async () => {
    const bytes = new Uint8Array([7, 8, 9]).buffer;
    await storage.writeBlob({
      userId: userA,
      vaultId: vault,
      blobId: 'blob-1',
      bytes,
      mimeType: 'image/png',
      sha256: 'hash',
      updatedAt: new Date().toISOString(),
      evictable: true,
    });

    expect((await storage.readBlob(userA, vault, 'blob-1'))?.mimeType).toBe('image/png');
    expect(await storage.readBlob(userB, vault, 'blob-1')).toBeNull();
  });

  it('evicts downloaded blobs but protects pending uploads when the SQLite write reaches quota', async () => {
    const now = new Date().toISOString();
    await storage.writeBlob({
      userId: userA,
      vaultId: vault,
      blobId: 'downloaded',
      bytes: new Uint8Array([1]).buffer,
      mimeType: 'image/png',
      sha256: 'downloaded-hash',
      updatedAt: now,
      evictable: true,
    });
    await storage.writeBlob({
      userId: userA,
      vaultId: vault,
      blobId: 'pending',
      bytes: new Uint8Array([2]).buffer,
      mimeType: 'image/png',
      sha256: 'pending-hash',
      updatedAt: now,
      evictable: false,
    });

    const testableStorage = storage as unknown as {
      putDatabase(userId: string, vaultId: string, bytes: ArrayBuffer): Promise<void>;
    };
    const originalPut = testableStorage.putDatabase.bind(testableStorage);
    let attempts = 0;
    spyOn(testableStorage, 'putDatabase').and.callFake(
      (userId: string, vaultId: string, bytes: ArrayBuffer) => {
        attempts++;
        if (attempts === 1) {
          return Promise.reject(new DOMException('quota', 'QuotaExceededError'));
        }
        return originalPut(userId, vaultId, bytes);
      },
    );

    await storage.write(userA, vault, new Uint8Array([9]), {
      protectedBlobIds: new Set(['pending']),
    });

    expect(await storage.readBlob(userA, vault, 'downloaded')).toBeNull();
    expect(await storage.readBlob(userA, vault, 'pending')).not.toBeNull();
    expect(Array.from(await storage.read(userA, vault) ?? [])).toEqual([9]);
  });

  it('identifies browser quota errors without treating other failures as quota', () => {
    expect(isStorageQuotaError(new DOMException('quota', 'QuotaExceededError'))).toBeTrue();
    expect(isStorageQuotaError(new Error('network'))).toBeFalse();
  });
});

  it('reserves storage for SQLite instead of filling the origin with image cache', () => {
    const mebibyte = 1024 * 1024;
    expect(hasStorageCapacity(60 * mebibyte, 100 * mebibyte, 20 * mebibyte)).toBeTrue();
    expect(hasStorageCapacity(70 * mebibyte, 100 * mebibyte, 20 * mebibyte)).toBeFalse();
  });

  it('uses a minimum reserve for small browser quotas', () => {
    const mebibyte = 1024 * 1024;
    expect(hasStorageCapacity(3 * mebibyte, 10 * mebibyte, 2 * mebibyte)).toBeTrue();
    expect(hasStorageCapacity(4 * mebibyte, 10 * mebibyte, 2 * mebibyte)).toBeFalse();
  });
