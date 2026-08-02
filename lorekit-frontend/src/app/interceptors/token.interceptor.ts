import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { AuthService } from '../services/auth.service';

export const tokenInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiUrl)) return next(request);

  const auth = inject(AuthService);
  const token = auth.getAccessToken();
  const authenticatedRequest = request.clone({
    withCredentials: true,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      const isSessionRequest = request.url.endsWith('/auth/login')
        || request.url.endsWith('/auth/refresh');

      if (!isUnauthorized || isSessionRequest || !auth.isAuthenticated()) {
        return throwError(() => error);
      }

      return from(auth.refreshAccessToken()).pipe(
        switchMap(refreshedToken => {
          if (!refreshedToken) return throwError(() => error);
          return next(request.clone({
            withCredentials: true,
            setHeaders: { Authorization: `Bearer ${refreshedToken}` },
          }));
        }),
      );
    }),
  );
};
