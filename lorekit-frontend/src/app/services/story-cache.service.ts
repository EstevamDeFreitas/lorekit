import { Injectable, inject, signal } from '@angular/core';
import initSqlJs, { type Database } from 'sql.js';
import {
  contractId,
  mergeReadRanges,
  type StoryDetail,
  type StoryMessage,
  type StoryPage,
  type StorySummary,
} from '@lorekit/ironpaw';
import { BrowserDatabaseStorageService } from '../database/browser-database-storage.service';
import { isElectronRuntime } from '../utils/runtime-platform';

const CACHE_KEY = 'stories-v1';
const ACCOUNT_KEY = 'lorekit.stories.last-account';
@Injectable({ providedIn: 'root' })
export class StoryCacheService {
  private readonly storage = inject(BrowserDatabaseStorageService);
  private db: Database | null = null;
  private accountId: string | null = null;
  private epoch = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly sql = initSqlJs({ locateFile: (file) => `assets/${file}` });
  readonly warning = signal('');
  readonly knownAccount = signal(this.readAccount());

  async open(userId: string): Promise<void> {
    contractId(userId);
    if (this.accountId === userId && this.db) return;
    const epoch = ++this.epoch;
    await this.queue.catch(() => undefined);
    let bytes: Uint8Array | null = null;
    let warning = '';
    try {
      bytes = isElectronRuntime()
        ? await window.electronAPI!.readStoryCache!(userId, null)
        : await this.storage.read(userId, CACHE_KEY);
    } catch {
      warning =
        'O armazenamento local está indisponível. Você pode usar o chat online, mas este conteúdo não ficará disponível offline.';
    }
    const SQL = await this.sql;
    if (epoch !== this.epoch) return;
    this.db?.close();
    try {
      this.db = bytes
        ? new SQL.Database(new Uint8Array(bytes))
        : new SQL.Database();
    } catch {
      this.db = new SQL.Database();
      warning =
        'Não foi possível ler o cache desta conta. Conecte para baixar o histórico novamente.';
    }
    this.accountId = userId;
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS details (storyId TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, storyId TEXT NOT NULL, sequence TEXT NOT NULL, payload TEXT NOT NULL, sceneId TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS story_cache_messages_idx ON messages (storyId, CAST(sequence AS INTEGER));
      CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, storyId TEXT NOT NULL, mimeType TEXT NOT NULL, sha256 TEXT NOT NULL);`);
    this.knownAccount.set(userId);
    try {
      localStorage.setItem(ACCOUNT_KEY, userId);
    } catch {
      /* Reading remains available without a remembered identity. */
    }
    this.warning.set(warning);
  }

  summaries(): StorySummary[] {
    return this.meta<StorySummary[]>('summaries') ?? [];
  }
  detail(storyId: string): StoryDetail | null {
    return (
      this.payload<StoryDetail>(
        'SELECT payload FROM details WHERE storyId = ?',
        [storyId],
      )[0] ?? null
    );
  }
  messages(
    storyId: string,
    limit = 200,
    before?: string,
    sceneId?: string,
  ): StoryMessage[] {
    const query = `SELECT payload FROM messages WHERE storyId = ? ${before ? 'AND CAST(sequence AS INTEGER) < CAST(? AS INTEGER)' : ''} ${sceneId ? 'AND sceneId = ?' : ''} ORDER BY CAST(sequence AS INTEGER) DESC LIMIT ?`;
    const values = [
      storyId,
      ...(before ? [before] : []),
      ...(sceneId ? [sceneId] : []),
      String(limit),
    ];
    return this.payload<StoryMessage>(query, values).reverse();
  }
  allMessages(storyId: string): StoryMessage[] {
    return this.payload<StoryMessage>(
      'SELECT payload FROM messages WHERE storyId = ? ORDER BY CAST(sequence AS INTEGER)',
      [storyId],
    );
  }
  cursor(storyId: string): string {
    return this.meta<string>(`cursor:${storyId}`) ?? '0';
  }
  pending(storyId: string): string[] {
    return this.meta<string[]>(`pending:${storyId}`) ?? [];
  }
  rememberPending(storyId: string, operationId: string): Promise<void> {
    return this.mutate((db) =>
      this.setMeta(db, `pending:${storyId}`, [
        ...new Set([...this.pending(storyId), operationId]),
      ]),
    );
  }
  forgetPending(storyId: string, operationId: string): Promise<void> {
    return this.mutate((db) =>
      this.setMeta(
        db,
        `pending:${storyId}`,
        this.pending(storyId).filter((id) => id !== operationId),
      ),
    );
  }
  complete(storyId: string, highWater: string): boolean {
    return (
      this.meta<Array<[string, string]>>(`coverage:${storyId}`) ?? []
    ).some(([start, end]) => start === '0' && BigInt(end) >= BigInt(highWater));
  }
  saveSummaries(summaries: StorySummary[]): Promise<void> {
    return this.mutate((db) => this.setMeta(db, 'summaries', summaries));
  }
  saveDetail(detail: StoryDetail): Promise<void> {
    return this.mutate((db) =>
      db.run('INSERT OR REPLACE INTO details VALUES (?, ?)', [
        detail.story.id,
        JSON.stringify(detail),
      ]),
    );
  }
  savePage(
    storyId: string,
    after: string,
    page: StoryPage<StoryMessage>,
    eventCursor?: string,
  ): Promise<void> {
    return this.mutate((db) => {
      for (const message of page.items) {
        if (message.storyId !== storyId)
          throw new Error('Mensagem de outra História.');
        db.run('INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?)', [
          message.id,
          storyId,
          message.sequence,
          JSON.stringify(message),
          message.sceneId,
        ]);
      }
      const coverage =
        this.meta<Array<[string, string]>>(`coverage:${storyId}`) ?? [];
      this.setMeta(
        db,
        `coverage:${storyId}`,
        mergeReadRanges([...coverage, [after, page.cursor]]),
      );
      if (eventCursor) this.setMeta(db, `cursor:${storyId}`, eventCursor);
    });
  }
  saveMessage(message: StoryMessage): Promise<void> {
    // A single live message does not prove that intervening history pages were downloaded.
    return this.saveItems([message]);
  }
  saveItems(messages: StoryMessage[]): Promise<void> {
    return this.mutate((db) => {
      for (const message of messages)
        db.run('INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?)', [
          message.id,
          message.storyId,
          message.sequence,
          JSON.stringify(message),
          message.sceneId,
        ]);
    });
  }
  saveCursor(storyId: string, cursor: string): Promise<void> {
    return this.mutate((db) => this.setMeta(db, `cursor:${storyId}`, cursor));
  }

  async asset(id: string, storyId?: string): Promise<Blob | null> {
    const row = this.db?.exec(
      `SELECT mimeType FROM assets WHERE id = ? ${storyId ? 'AND storyId = ?' : ''}`,
      storyId ? [id, storyId] : [id],
    )[0]?.values[0];
    if (!row || !this.accountId) return null;
    const bytes = isElectronRuntime()
      ? await window.electronAPI!.readStoryCache!(this.accountId, id)
      : (await this.storage.readBlob(this.accountId, CACHE_KEY, id))?.bytes;
    return bytes
      ? new Blob([new Uint8Array(bytes)], { type: String(row[0]) })
      : null;
  }
  async saveAsset(
    storyId: string,
    id: string,
    blob: Blob,
    sha256: string,
    expectedAccount = this.accountId,
  ): Promise<void> {
    const bytes = await blob.arrayBuffer();
    if (expectedAccount !== this.accountId)
      throw new Error('Conta alterada durante o download.');
    await this.mutate(async (db) => {
      if (expectedAccount !== this.accountId)
        throw new Error('Conta alterada durante o download.');
      const userId = this.accountId!;
      if (isElectronRuntime())
        await window.electronAPI!.writeStoryCache!(
          userId,
          id,
          new Uint8Array(bytes),
        );
      else
        await this.storage.writeBlob({
          userId,
          vaultId: CACHE_KEY,
          blobId: id,
          bytes,
          mimeType: blob.type,
          sha256,
          updatedAt: new Date().toISOString(),
          evictable: true,
        });
      db.run('INSERT OR REPLACE INTO assets VALUES (?, ?, ?, ?)', [
        id,
        storyId,
        blob.type,
        sha256,
      ]);
    });
  }

  async removeStory(storyId: string): Promise<void> {
    const userId = this.accountId;
    const ids =
      this.db
        ?.exec('SELECT id FROM assets WHERE storyId = ?', [storyId])[0]
        ?.values.map((row) => String(row[0])) ?? [];
    await this.mutate((db) => {
      db.run('DELETE FROM details WHERE storyId = ?', [storyId]);
      db.run('DELETE FROM messages WHERE storyId = ?', [storyId]);
      db.run('DELETE FROM assets WHERE storyId = ?', [storyId]);
      db.run('DELETE FROM meta WHERE key IN (?, ?, ?)', [
        `cursor:${storyId}`,
        `coverage:${storyId}`,
        `pending:${storyId}`,
      ]);
      this.setMeta(
        db,
        'summaries',
        this.summaries().filter((story) => story.id !== storyId),
      );
    });
    if (userId)
      for (const id of ids) {
        if (isElectronRuntime())
          await window.electronAPI!.deleteStoryCache!(userId, id);
        else await this.storage.deleteBlob(userId, CACHE_KEY, id);
      }
  }

  async transition(_previous: string | null, next?: string): Promise<void> {
    const account = this.accountId ?? this.knownAccount();
    if (next && account === next) return;
    ++this.epoch;
    await this.queue.catch(() => undefined);
    this.db?.close();
    this.db = null;
    this.accountId = null;
    this.knownAccount.set(null);
    try {
      localStorage.removeItem(ACCOUNT_KEY);
    } catch {
      /* Memory identity is already cleared. */
    }
    if (account) {
      if (isElectronRuntime())
        await window.electronAPI!.deleteStoryCache!(account, null);
      else await this.storage.deleteWorkspace(account, CACHE_KEY);
    }
  }

  private async mutate(action: (db: Database) => unknown): Promise<void> {
    const epoch = this.epoch;
    const result = this.queue
      .catch(() => undefined)
      .then(async () => {
        const db = this.db,
          account = this.accountId;
        if (!db || !account || epoch !== this.epoch)
          throw new Error('Cache da conta indisponível.');
        const before = db.export();
        try {
          db.run('BEGIN');
          await action(db);
          db.run('COMMIT');
          const bytes = db.export();
          if (isElectronRuntime())
            await window.electronAPI!.writeStoryCache!(account, null, bytes);
          else await this.storage.write(account, CACHE_KEY, bytes);
        } catch (error) {
          try {
            db.run('ROLLBACK');
          } catch {
            /* COMMIT may already have completed. */
          }
          db.close();
          const SQL = await this.sql;
          this.db = new SQL.Database(before);
          this.warning.set(
            'O conteúdo novo não pôde ser guardado para consulta offline. Libere espaço e conecte novamente.',
          );
          throw error;
        }
      });
    this.queue = result;
    return result;
  }
  private payload<T>(query: string, values: string[]): T[] {
    return (this.db?.exec(query, values)[0]?.values ?? []).map(
      (row) => JSON.parse(String(row[0])) as T,
    );
  }
  private meta<T>(key: string): T | null {
    const value = this.db?.exec('SELECT value FROM meta WHERE key = ?', [
      key,
    ])[0]?.values[0]?.[0];
    return value ? (JSON.parse(String(value)) as T) : null;
  }
  private setMeta(db: Database, key: string, value: unknown): void {
    db.run('INSERT OR REPLACE INTO meta VALUES (?, ?)', [
      key,
      JSON.stringify(value),
    ]);
  }
  private readAccount(): string | null {
    try {
      const id = localStorage.getItem(ACCOUNT_KEY);
      return id ? contractId(id) : null;
    } catch {
      return null;
    }
  }
}
