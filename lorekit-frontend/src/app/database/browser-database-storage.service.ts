import { Injectable } from '@angular/core';

const DATABASE_NAME = 'lorekit-workspaces';
const DATABASE_VERSION = 1;
const DATABASE_STORE = 'databases';
const STORAGE_RESERVE_RATIO = 0.15;
const MINIMUM_STORAGE_RESERVE_BYTES = 5 * 1024 * 1024;

const BLOB_STORE = 'blobs';

export interface BrowserBlobCacheEntry {
  readonly key: string;
  readonly userId: string;
  readonly vaultId: string;
  readonly blobId: string;
  readonly bytes: ArrayBuffer;
  readonly mimeType: string;
  readonly sha256: string;
  readonly updatedAt: string;
  readonly evictable: boolean;
}

export interface BrowserDatabaseWriteOptions {
  readonly protectedBlobIds?: ReadonlySet<string>;
}

@Injectable({ providedIn: 'root' })
export class BrowserDatabaseStorageService {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async read(userId: string, vaultId: string): Promise<Uint8Array | null> {
    const database = await this.open();
    const value = await requestAsPromise<ArrayBuffer | undefined>(
      database.transaction(DATABASE_STORE, 'readonly')
        .objectStore(DATABASE_STORE)
        .get(this.workspaceKey(userId, vaultId)),
    );
    return value ? new Uint8Array(value) : null;
  }

  async write(
    userId: string,
    vaultId: string,
    bytes: Uint8Array,
    options: BrowserDatabaseWriteOptions = {},
  ): Promise<void> {
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    try {
      await this.putDatabase(userId, vaultId, copy);
      return;
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }

    await this.evictWorkspaceBlobs(userId, vaultId, options.protectedBlobIds ?? new Set());
    try {
      await this.putDatabase(userId, vaultId, copy);
      return;
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }

    await this.evictEvictableBlobs();
    await this.putDatabase(userId, vaultId, copy);
  }

  async requestPersistentStorage(): Promise<boolean> {
    try {
      if (!navigator.storage?.persist) return false;
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  async canCache(byteLength: number): Promise<boolean> {
    try {
      if (!navigator.storage?.estimate) return true;
      const estimate = await navigator.storage.estimate();
      if (estimate.usage === undefined || estimate.quota === undefined) return true;
      return hasStorageCapacity(estimate.usage, estimate.quota, byteLength);
    } catch {
      return true;
    }
  }

  async deleteWorkspace(userId: string, vaultId: string): Promise<void> {
    const database = await this.open();
    const prefix = `${this.workspaceKey(userId, vaultId)}:`;
    await Promise.all([
      transactionAsPromise(
        database,
        DATABASE_STORE,
        'readwrite',
        store => store.delete(this.workspaceKey(userId, vaultId)),
      ),
      this.deleteByPrefix(database, BLOB_STORE, prefix),
    ]);
  }

  async deleteUser(userId: string): Promise<void> {
    const database = await this.open();
    const prefix = `${userId}:`;
    await Promise.all([
      this.deleteByPrefix(database, DATABASE_STORE, prefix),
      this.deleteByPrefix(database, BLOB_STORE, prefix),
    ]);
  }

  async readBlob(userId: string, vaultId: string, blobId: string): Promise<BrowserBlobCacheEntry | null> {
    const database = await this.open();
    return await requestAsPromise<BrowserBlobCacheEntry | undefined>(
      database.transaction(BLOB_STORE, 'readonly')
        .objectStore(BLOB_STORE)
        .get(this.blobKey(userId, vaultId, blobId)),
    ) ?? null;
  }

  async writeBlob(entry: Omit<BrowserBlobCacheEntry, 'key'>): Promise<void> {
    const database = await this.open();
    const storedEntry: BrowserBlobCacheEntry = {
      ...entry,
      key: this.blobKey(entry.userId, entry.vaultId, entry.blobId),
    };
    try {
      await this.putBlob(database, storedEntry);
      return;
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }

    await this.evictEvictableBlobs(storedEntry.key);
    await this.putBlob(database, storedEntry);
  }

  async deleteBlob(userId: string, vaultId: string, blobId: string): Promise<void> {
    const database = await this.open();
    await transactionAsPromise(
      database,
      BLOB_STORE,
      'readwrite',
      store => store.delete(this.blobKey(userId, vaultId, blobId)),
    );
  }

  workspaceKey(userId: string, vaultId: string): string {
    return `${userId}:${vaultId}`;
  }

  private blobKey(userId: string, vaultId: string, blobId: string): string {
    return `${this.workspaceKey(userId, vaultId)}:${blobId}`;
  }

  private async putDatabase(
    userId: string,
    vaultId: string,
    bytes: ArrayBuffer,
  ): Promise<void> {
    const database = await this.open();
    await transactionAsPromise(
      database,
      DATABASE_STORE,
      'readwrite',
      store => store.put(bytes, this.workspaceKey(userId, vaultId)),
    );
  }

  private async putBlob(database: IDBDatabase, entry: BrowserBlobCacheEntry): Promise<void> {
    await transactionAsPromise(database, BLOB_STORE, 'readwrite', store => store.put(entry));
  }

  private async evictWorkspaceBlobs(
    userId: string,
    vaultId: string,
    protectedBlobIds: ReadonlySet<string>,
  ): Promise<void> {
    const database = await this.open();
    const prefix = `${this.workspaceKey(userId, vaultId)}:`;
    await transactionAsPromise(database, BLOB_STORE, 'readwrite', store => {
      const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
      const cursorRequest = store.openCursor(range);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const entry = cursor.value as BrowserBlobCacheEntry;
        if (!protectedBlobIds.has(entry.blobId)) cursor.delete();
        cursor.continue();
      };
    });
  }

  private async evictEvictableBlobs(excludedKey?: string): Promise<void> {
    const database = await this.open();
    await transactionAsPromise(database, BLOB_STORE, 'readwrite', store => {
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        const entry = cursor.value as BrowserBlobCacheEntry;
        if (entry.evictable === true && entry.key !== excludedKey) cursor.delete();
        cursor.continue();
      };
    });
  }

  private open(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(DATABASE_STORE)) {
            database.createObjectStore(DATABASE_STORE);
          }
          if (!database.objectStoreNames.contains(BLOB_STORE)) {
            database.createObjectStore(BLOB_STORE, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o IndexedDB.'));
        request.onblocked = () => reject(new Error('O cache do Lorekit está bloqueado por outra aba.'));
      });
    }
    return this.databasePromise;
  }

  private async deleteByPrefix(
    database: IDBDatabase,
    storeName: string,
    prefix: string,
  ): Promise<void> {
    await transactionAsPromise(database, storeName, 'readwrite', store => {
      const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
      const cursorRequest = store.openKeyCursor(range);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
    });
  }
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Operação IndexedDB falhou.'));
  });
}

function transactionAsPromise(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    operation(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Transação IndexedDB falhou.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Transação IndexedDB cancelada.'));
  });
}

export function isStorageQuotaError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'QuotaExceededError'
    : typeof error === 'object' && error !== null
      && 'name' in error && error.name === 'QuotaExceededError';
}

export function hasStorageCapacity(
  usage: number,
  quota: number,
  incomingBytes: number,
): boolean {
  if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) return true;
  const reserve = Math.max(
    MINIMUM_STORAGE_RESERVE_BYTES,
    quota * STORAGE_RESERVE_RATIO,
  );
  return usage + Math.max(0, incomingBytes) <= Math.max(0, quota - reserve);
}
