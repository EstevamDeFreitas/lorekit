import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

export interface StoryNavigationTarget {
  id: string | null;
  token: string | null;
  assetId: string | null;
  sceneId: string | null;
}

/** Direct links select the RP tab inside the shared application shell. */
@Injectable({ providedIn: 'root' })
export class StoryNavigationService {
  private readonly router = inject(Router);
  readonly target = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => this.parse(event.urlAfterRedirects)),
    ),
    { initialValue: this.parse(this.router.url) },
  );

  private parse(url: string): StoryNavigationTarget | null {
    const segments =
      this.router
        .parseUrl(url)
        .root.children['primary']?.segments.map((segment) => segment.path) ??
      [];
    if (segments[0] !== 'stories') return null;
    if (segments[1] === 'invite')
      return { id: null, token: segments[2] ?? null, assetId: null, sceneId: null };
    const parsed = this.router.parseUrl(url);
    return {
      id: segments[1] ?? null,
      token: null,
      assetId: segments[2] === 'assets' ? (segments[3] ?? null) : null,
      sceneId: typeof parsed.queryParams['scene'] === 'string' ? parsed.queryParams['scene'] : null,
    };
  }
}
