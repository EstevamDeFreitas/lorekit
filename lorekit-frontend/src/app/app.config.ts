import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { CrudHelper, openDbAndEnsureSchema } from './database/database.helper';

export class DbProvider {
  private db: any | null = null;
  setDb(db: any) { this.db = db; }
  getDb<T = any>(): T {
    if (!this.db) throw new Error('DB not initialized');
    return this.db as T;
  }
  getCrudHelper() {
    return new CrudHelper(this.getDb());
  }
}

function initializeDatabase(dbProvider: DbProvider) {
  return async () => {
    const db = await openDbAndEnsureSchema();
    dbProvider.setDb(db);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideAnimationsAsync(),
    provideHttpClient(),
    DbProvider,
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initializeDatabase,
      deps: [DbProvider],
    },
  ]
};
