import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { isElectronRuntime } from '../utils/runtime-platform';

export const webAuthGuard: CanActivateFn = (_route, state) => {
  if (isElectronRuntime()) return true;

  const auth = inject(AuthService);
  if (auth.isAuthenticated()) return true;

  return inject(Router).createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
