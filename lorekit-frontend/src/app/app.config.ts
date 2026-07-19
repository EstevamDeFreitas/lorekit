import { APP_INITIALIZER, ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { tokenInterceptor } from './interceptors/token.interceptor';
import { TW500C, TW700C, TWZINC } from './theme/tailwind-classes';
import { CrudHelper, DatabasePersistenceCoordinator, openDbAndEnsureSchema } from './database/database.helper';

export class DbProvider {
  private db: any | null = null;
  private persistence: DatabasePersistenceCoordinator | null = null;

  setDb(db: any): void {
    this.db = db;
    this.persistence = new DatabasePersistenceCoordinator(db);
  }

  getDb<T = any>(): T {
    if (!this.db) throw new Error('DB not initialized');
    return this.db as T;
  }

  getCrudHelper(): CrudHelper {
    return new CrudHelper(this.getDb(), () => this.requestPersist());
  }

  requestPersist(): void {
    if (!this.persistence) throw new Error('DB not initialized');
    this.persistence.requestPersist();
  }

  async flushPendingWrites(): Promise<void> {
    await this.persistence?.flush();
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideAnimationsAsync(),
    provideHttpClient(),
    DbProvider,
    provideAppInitializer(async () => {
      const dbProvider = inject(DbProvider);
      const db = await openDbAndEnsureSchema();
      dbProvider.setDb(db);
    }),
  ]
};

let classes = [TW500C, TWZINC, TW700C];



