import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { signal } from '@angular/core';
import { storyGuard } from './story.guard';
import { AuthService } from '../services/auth.service';
import { StoryCacheService } from '../services/story-cache.service';

describe('Independent story entry', () => {
  it('permits a signed-in guest and cached reading without a workspace dependency', () => {
    const signedIn = signal(true),
      knownAccount = signal<string | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: signedIn } },
        { provide: StoryCacheService, useValue: { knownAccount } },
      ],
    });
    let route = { paramMap: convertToParamMap({}) } as ActivatedRouteSnapshot;
    const state = { url: '/stories/example' } as RouterStateSnapshot;
    const check = () =>
      TestBed.runInInjectionContext(() => storyGuard(route, state));
    expect(check()).toBeTrue();
    signedIn.set(false);
    knownAccount.set(crypto.randomUUID());
    expect(check()).toBeTrue();
    route = { paramMap: convertToParamMap({ token: 'invite' }) } as ActivatedRouteSnapshot;
    expect(check()).not.toBeTrue();
    knownAccount.set(null);
    route = { paramMap: convertToParamMap({}) } as ActivatedRouteSnapshot;
    expect(check()).not.toBeTrue();
  });
});
