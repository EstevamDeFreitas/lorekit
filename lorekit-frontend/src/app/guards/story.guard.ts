import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StoryCacheService } from '../services/story-cache.service';

export const storyGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService),
    cache = inject(StoryCacheService);
  if (
    auth.isAuthenticated() ||
    (!route.paramMap.get('token') && cache.knownAccount())
  )
    return true;
  return inject(Router).createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
