import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { tokenInterceptor } from './interceptors/token.interceptor';
import { AuthService } from './services/auth.service';
import { DbProvider } from './database/db-provider.service';
import { WorkspaceRuntimeService } from './services/workspace-runtime.service';
import { StoryNotificationsService } from './services/story-notifications.service';

export { DbProvider } from './database/db-provider.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([tokenInterceptor])),
    DbProvider,
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const workspace = inject(WorkspaceRuntimeService);
      inject(StoryNotificationsService);
      await auth.initialize();
      await workspace.initializeDesktop();
    }),
  ]
};

