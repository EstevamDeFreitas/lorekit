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
    this.mutationListeners.forEach(listener => listener());
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
    this.persistence = null;
    this.writer = null;
    this.db?.close();
    this.db = null;
    this.ready.set(false);
    this.readOnly.set(false);
  }

  private assertWritable(): void {
    if (this.readOnly()) {
      throw new Error('Este vault já está aberto para edição em outra aba.');
    }
  }
}
