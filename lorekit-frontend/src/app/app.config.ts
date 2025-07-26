import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset:Aura
      }
    })
  ]
};
