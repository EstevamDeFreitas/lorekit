import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { tokenInterceptor } from './interceptors/token.interceptor';
import { CrudHelper, DatabasePersistenceCoordinator, openDbAndEnsureSchema } from './database/database.helper';
import { AuthService } from './services/auth.service';

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
    provideHttpClient(withInterceptors([tokenInterceptor])),
    DbProvider,
    provideAppInitializer(async () => {
      const dbProvider = inject(DbProvider);
      const auth = inject(AuthService);
      const [db] = await Promise.all([
        openDbAndEnsureSchema(),
        auth.initialize(),
      ]);
      dbProvider.setDb(db);
    }),
  ]
};

