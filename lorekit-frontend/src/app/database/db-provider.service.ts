import { Injectable, signal } from '@angular/core';
import type { Database } from 'sql.js';
import {
  CrudHelper,
  DatabasePersistenceCoordinator,
  persistDbToDisk,
} from './database.helper';

type PersistWriter = (db: Database) => Promise<void>;

@Injectable()
export class DbProvider {
  private db: Database | null = null;
  private persistence: DatabasePersistenceCoordinator | null = null;
  private writer: PersistWriter | null = null;
  private readonly mutationListeners = new Set<() => void>();
  private transactionDepth = 0;
  private mutationsDuringTransaction = false;

  readonly ready = signal(false);
  readonly readOnly = signal(false);

  setDb(db: Database, writer: PersistWriter = persistDbToDisk, readOnly = false): void {
    this.close();
    this.db = db;
    this.writer = writer;
    this.readOnly.set(readOnly);
    this.persistence = readOnly ? null : new DatabasePersistenceCoordinator(db, writer);
    this.ready.set(true);
  }

  replaceDb(db: Database): void {
    const writer = this.writer;
    const readOnly = this.readOnly();
    if (!writer) throw new Error('DB not initialized');
    this.setDb(db, writer, readOnly);
  }

  getDb<T = Database>(): T {
    if (!this.db) throw new Error('DB not initialized');
    return this.db as T;
  }

  getCrudHelper(): CrudHelper {
    return new CrudHelper(
      this.getDb(),
      () => this.requestPersist(),
      () => this.assertWritable(),
    );
  }

  requestPersist(): void {
    this.assertWritable();
    if (!this.persistence) throw new Error('DB not initialized');
    this.persistence.requestPersist();
    if (this.transactionDepth > 0) {
      this.mutationsDuringTransaction = true;
      return;
    }
    this.notifyMutations();
  }

  async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    this.assertWritable();
    const db = this.db;
    const persistence = this.persistence;
    if (!db || !persistence) throw new Error('DB not initialized');

    persistence.pause();
    this.transactionDepth++;
    let transactionActive = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      transactionActive = true;
      const result = await operation();
      db.exec('COMMIT');
      transactionActive = false;
      this.transactionDepth--;
      if (this.transactionDepth === 0 && this.mutationsDuringTransaction) {
        this.mutationsDuringTransaction = false;
        this.notifyMutations();
      }
      return result;
    } catch (error) {
      if (transactionActive) {
        try {
          db.exec('ROLLBACK');
        } catch (rollbackError) {
          console.error('Failed to rollback SQLite transaction', rollbackError);
        }
      }
      this.transactionDepth = Math.max(0, this.transactionDepth - 1);
      if (this.transactionDepth === 0) this.mutationsDuringTransaction = false;
      throw error;
    } finally {
      persistence.resume();
    }
  }

  async flushPendingWrites(): Promise<void> {
    await this.persistence?.flush();
  }

  subscribeToMutations(listener: () => void): () => void {
    this.mutationListeners.add(listener);
    return () => {
      this.mutationListeners.delete(listener);
    };
  }

  close(): void {
    window.dispatchEvent(new Event('lorekit:history-reset'));
    this.persistence = null;
    this.writer = null;
    this.db?.close();
    this.db = null;
    this.transactionDepth = 0;
    this.mutationsDuringTransaction = false;
    this.ready.set(false);
    this.readOnly.set(false);
  }

  private assertWritable(): void {
    if (this.readOnly()) {
      throw new Error('Este vault já está aberto para edição em outra aba.');
    }
  }

  private notifyMutations(): void {
    this.mutationListeners.forEach(listener => {
      try { listener(); } catch (error) { console.error('Mutation listener failed', error); }
    });
  }
}
