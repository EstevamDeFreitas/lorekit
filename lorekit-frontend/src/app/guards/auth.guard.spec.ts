import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { webAuthGuard } from './auth.guard';

describe('webAuthGuard', () => {
  let originalElectronApi: Window['electronAPI'];
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    originalElectronApi = window.electronAPI;
    delete window.electronAPI;
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  afterEach(() => {
    if (originalElectronApi) {
      window.electronAPI = originalElectronApi;
    } else {
      delete window.electronAPI;
    }
  });

  it('redirects the web client without an account to login', () => {
    auth.isAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => webAuthGuard(
      {} as ActivatedRouteSnapshot,
      { url: '/app/world' } as RouterStateSnapshot,
    ));

    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree))
      .toBe('/login?returnUrl=%2Fapp%2Fworld');
  });

  it('allows the Electron client without an account to stay offline', () => {
    window.electronAPI = {};
    auth.isAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => webAuthGuard(
      {} as ActivatedRouteSnapshot,
      { url: '/app/world' } as RouterStateSnapshot,
    ));

    expect(result).toBeTrue();
    expect(auth.isAuthenticated).not.toHaveBeenCalled();
  });
});
