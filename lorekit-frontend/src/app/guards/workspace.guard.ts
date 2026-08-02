import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isElectronRuntime } from '../utils/runtime-platform';
import { WorkspaceRuntimeService } from '../services/workspace-runtime.service';

export const workspaceGuard: CanActivateFn = async () => {
  if (isElectronRuntime()) return true;

  const workspace = inject(WorkspaceRuntimeService);
  const router = inject(Router);
  try {
    await workspace.initializeAuthenticatedWeb();
    return true;
  } catch {
    return router.createUrlTree(['/login']);
  }
};
