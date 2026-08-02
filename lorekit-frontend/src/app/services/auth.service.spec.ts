import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fakeAsync, tick } from '@angular/core/testing';
import { environment } from '../../enviroments/environment';
import { AuthService } from './auth.service';
import { CloudSessionStorageService } from './cloud-session-storage.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let storage: jasmine.SpyObj<CloudSessionStorageService>;

  const authResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer' as const,
    expiresIn: 900,
    user: {
      id: 'f45d63a4-2e89-4104-9142-c665c74a563e',
      email: 'autor@example.com',
      displayName: 'Autor',
    },
    deviceId: 'f5bc4e19-17c3-48da-b84c-73860993f06d',
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    storage = jasmine.createSpyObj<CloudSessionStorageService>(
      'CloudSessionStorageService',
      ['read', 'write', 'clear'],
    );
    storage.read.and.resolveTo(null);
    storage.write.and.resolveTo();
    storage.clear.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CloudSessionStorageService, useValue: storage },
      ],
    });

    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('starts yellow and without requiring an account', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.indicatorColor()).toBe('yellow');
  });

  it('stores a successful session and enables sync', fakeAsync(() => {
    let completed = false;
    void service.login(' autor@example.com ', 'secret').then(() => completed = true);
    tick();
    const request = http.expectOne(`${environment.apiUrl}/auth/login`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body.email).toBe('autor@example.com');
    expect(request.request.body.platform).toBe('web');
    request.flush(authResponse);
    tick();
    expect(completed).toBeTrue();

    expect(storage.write).toHaveBeenCalled();
    expect(service.user()?.email).toBe('autor@example.com');
    expect(service.syncEnabled()).toBeTrue();
    expect(service.indicatorColor()).toBe('green');
  }));

  it('turns red when authentication fails', fakeAsync(() => {
    let rejected = false;
    void service.login('autor@example.com', 'wrong-password').catch(() => rejected = true);
    tick();
    const request = http.expectOne(`${environment.apiUrl}/auth/login`);
    request.flush(
      { message: 'Invalid email or password' },
      { status: 401, statusText: 'Unauthorized' },
    );
    tick();
    expect(rejected).toBeTrue();

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.indicatorColor()).toBe('red');
    expect(service.lastError()).toBe('E-mail ou senha inválidos.');
  }));
});
