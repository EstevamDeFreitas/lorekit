import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../enviroments/environment';
import { isElectronRuntime } from '../utils/runtime-platform';
import { CloudSessionStorageService } from './cloud-session-storage.service';

export type CloudIndicatorColor = 'yellow' | 'green' | 'red';

export type CloudUser = {
  id: string;
  email: string;
  displayName: string | null;
};

type AuthResponse = {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: CloudUser;
  deviceId: string;
};

type CloudSession = AuthResponse & {
  accessTokenExpiresAt: number;
};

const DEVICE_ID_KEY = 'lorekit.cloud.device-id';
const SYNC_ENABLED_KEY = 'lorekit.cloud.sync-enabled';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(CloudSessionStorageService);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private refreshInFlight: Promise<string | null> | null = null;

  private readonly session = signal<CloudSession | null>(null);
  readonly busy = signal(false);
  readonly lastError = signal<string | null>(null);
  readonly syncEnabled = signal(this.readBoolean(SYNC_ENABLED_KEY));
  readonly user = computed(() => this.session()?.user ?? null);
  readonly authenticated = computed(() => Boolean(this.session()));
  readonly indicatorColor = computed<CloudIndicatorColor>(() => {
    if (this.lastError()) return 'red';
    if (this.authenticated() && this.syncEnabled()) return 'green';
    return 'yellow';
  });
  readonly indicatorLabel = computed(() => {
    if (this.lastError()) return `Erro na nuvem: ${this.lastError()}`;
    if (!this.authenticated()) return 'Nuvem: nenhuma conta conectada';
    if (!this.syncEnabled()) return 'Nuvem: sincronização pausada';
    return 'Nuvem: conta conectada e sincronização habilitada';
  });

  async initialize(): Promise<void> {
    if (!isElectronRuntime()) {
      try {
        await this.refreshAccessToken();
        this.syncEnabled.set(this.authenticated());
      } catch {
        await this.clearLocalSession();
        this.lastError.set(null);
      }
      return;
    }

    try {
      const rawSession = await this.storage.read();
      if (!rawSession) return;

      const storedSession = JSON.parse(rawSession) as CloudSession;
      if (!this.isValidSession(storedSession)) {
        await this.clearLocalSession();
        return;
      }

      this.session.set(storedSession);
      this.syncEnabled.set(this.readBoolean(SYNC_ENABLED_KEY, true));
      if (storedSession.accessTokenExpiresAt <= Date.now() + 30_000) {
        if (isElectronRuntime()) {
          void this.refreshAccessToken().catch(() => undefined);
        } else {
          await this.refreshAccessToken();
        }
      }
    } catch {
      await this.clearLocalSession();
      this.lastError.set('Não foi possível restaurar a sessão da nuvem.');
    }
  }

  async login(email: string, password: string): Promise<void> {
    this.busy.set(true);
    this.lastError.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.apiUrl}/login`, {
          email: email.trim(),
          password,
          deviceId: this.readValue(DEVICE_ID_KEY) ?? undefined,
          deviceName: isElectronRuntime() ? 'Lorekit desktop' : 'Lorekit web',
          platform: isElectronRuntime() ? 'desktop' : 'web',
          appVersion: await this.getAppVersion(),
        }, { withCredentials: true }),
      );
      await this.acceptSession(response);
      this.setSyncEnabled(true);
    } catch (error) {
      const message = this.describeError(error);
      this.lastError.set(message);
      throw new Error(message);
    } finally {
      this.busy.set(false);
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshInFlight) return this.refreshInFlight;

    const currentSession = this.session();
    if (isElectronRuntime() && !currentSession?.refreshToken) return null;
    const refreshBody = isElectronRuntime() ? { refreshToken: currentSession?.refreshToken } : {};

    this.refreshInFlight = firstValueFrom(
      this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, refreshBody, {
        withCredentials: true,
      }),
    )
      .then(async response => {
        await this.acceptSession(response);
        this.lastError.set(null);
        return response.accessToken;
      })
      .catch(async error => {
        await this.clearLocalSession();
        const message = this.describeError(error, 'Sua sessão expirou. Conecte a conta novamente.');
        this.lastError.set(message);
        throw error;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });

    return this.refreshInFlight;
  }

  async logout(): Promise<void> {
    const hadSession = this.authenticated();
    try {
      if (hadSession) {
        await firstValueFrom(this.http.post<void>(`${this.apiUrl}/logout`, {}, { withCredentials: true }));
      }
    } catch {
      // O logout local deve funcionar mesmo sem rede.
    } finally {
      await this.clearLocalSession();
      this.lastError.set(null);
    }
  }

  isAuthenticated(): boolean {
    return this.authenticated();
  }

  getAccessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  setSyncEnabled(enabled: boolean): void {
    const nextValue = this.authenticated() && enabled;
    this.syncEnabled.set(nextValue);
    this.writeValue(SYNC_ENABLED_KEY, String(nextValue));
    if (nextValue) this.lastError.set(null);
  }

  markSyncError(message: string): void {
    this.lastError.set(message);
  }

  clearError(): void {
    this.lastError.set(null);
  }

  private async acceptSession(response: AuthResponse): Promise<void> {
    const session: CloudSession = {
      ...response,
      accessTokenExpiresAt: Date.now() + response.expiresIn * 1000,
    };
    await this.storage.write(JSON.stringify(session));
    this.session.set(session);
    this.writeValue(DEVICE_ID_KEY, response.deviceId);
  }

  private async clearLocalSession(): Promise<void> {
    this.session.set(null);
    this.syncEnabled.set(false);
    this.writeValue(SYNC_ENABLED_KEY, 'false');
    try {
      await this.storage.clear();
    } catch {
      // A sessão em memória precisa ser encerrada mesmo se o armazenamento seguro falhar.
    }
  }

  private async getAppVersion(): Promise<string> {
    return await window.electronAPI?.getAppVersion?.() ?? 'web';
  }

  private isValidSession(value: CloudSession): boolean {
    return Boolean(
      value
      && typeof value.accessToken === 'string'
      && (!isElectronRuntime() || typeof value.refreshToken === 'string')
      && (isElectronRuntime() || value.refreshToken === undefined)
      && typeof value.accessTokenExpiresAt === 'number'
      && typeof value.deviceId === 'string'
      && value.user
      && typeof value.user.id === 'string'
      && typeof value.user.email === 'string',
    );
  }

  private describeError(error: unknown, fallback = 'Não foi possível conectar a conta.'): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return 'Não foi possível alcançar o servidor do Lorekit.';
      if (error.status === 401) return 'E-mail ou senha inválidos.';
      const apiMessage = error.error?.message;
      if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    }
    return fallback;
  }

  private readBoolean(key: string, fallback = false): boolean {
    const value = this.readValue(key);
    return value === null ? fallback : value === 'true';
  }

  private readValue(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeValue(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Preferências não sensíveis podem voltar ao padrão se o storage estiver bloqueado.
    }
  }
}
