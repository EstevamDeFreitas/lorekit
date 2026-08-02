import { TestBed } from '@angular/core/testing';
import { BrowserDatabaseStorageService } from './browser-database-storage.service';

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
    });

    expect((await storage.readBlob(userA, vault, 'blob-1'))?.mimeType).toBe('image/png');
    expect(await storage.readBlob(userB, vault, 'blob-1')).toBeNull();
  });
});
