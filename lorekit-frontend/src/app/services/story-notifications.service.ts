import { Injectable, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  claimNotification,
  setNotificationAccount,
} from '../../../public/story-notification-store.js';
import { contractId } from '@lorekit/ironpaw';
import { StoryClientService } from './story-client.service';
import { AuthService } from './auth.service';
import { isElectronRuntime } from '../utils/runtime-platform';

@Injectable({ providedIn: 'root' })
export class StoryNotificationsService {
  private readonly client = inject(StoryClientService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private audio: AudioContext | null = null;
  private readonly baseTitle = document.title;
  readonly pushState = signal('Notificações móveis desativadas.');
  readonly soundReady = signal(false);
  private readonly lastSound = new Map<string, number>();

  constructor() {
    this.client.onAlert = (value) => {
      void this.alert(value);
    };
    this.client.onSound = (value) => {
      if (
        value.accountId !== this.auth.user()?.id ||
        Date.now() - Date.parse(value.createdAt) > 15_000 ||
        Date.now() - (this.lastSound.get(value.storyId) ?? 0) < 3000
      )
        return;
      this.lastSound.set(value.storyId, Date.now());
      void claimNotification(value.accountId, `${value.eventId}:sound`)
        .then((accepted) => {
          if (accepted) this.beep();
        })
        .catch(() => undefined);
    };
    effect(() => {
      const count = this.client
        .summaries()
        .reduce((sum, story) => sum + story.unread, 0);
      document.title = count ? `(${count}) ${this.baseTitle}` : this.baseTitle;
    });
    effect(() => {
      const account = this.auth.user()?.id ?? this.client.cache.knownAccount();
      void setNotificationAccount(account).catch(() =>
        this.pushState.set(
          'O armazenamento de notificações está indisponível.',
        ),
      );
    });
    this.auth.onSessionCleanup(async (_previous, next) => {
      await setNotificationAccount(next ?? null);
      if (!isElectronRuntime() && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker
          .getRegistration()
          .catch(() => undefined);
        const subscription = await registration?.pushManager
          ?.getSubscription()
          .catch(() => null);
        await subscription?.unsubscribe().catch(() => false);
      }
    });
    if (isElectronRuntime())
      window.electronAPI?.onOpenStory?.((id) => {
        try {
          contractId(id);
          void this.router.navigate(['/stories', id]);
        } catch {
          /* Invalid IPC payload. */
        }
      });
    else if ('serviceWorker' in navigator && window.isSecureContext) {
      void navigator.serviceWorker
        .register('/story-worker.js', { type: 'module' })
        .catch(() =>
          this.pushState.set(
            'Não foi possível ativar o serviço de notificações.',
          ),
        );
    }
  }

  async enableSound(): Promise<void> {
    try {
      this.audio ??= new AudioContext();
      await this.audio.resume();
      this.soundReady.set(this.audio.state === 'running');
    } catch {
      this.soundReady.set(false);
    }
  }
  private beep(): void {
    if (!this.audio || this.audio.state !== 'running') return;
    const oscillator = this.audio.createOscillator(),
      gain = this.audio.createGain();
    oscillator.frequency.value = 640;
    gain.gain.setValueAtTime(0.06, this.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.audio.currentTime + 0.16,
    );
    oscillator.connect(gain);
    gain.connect(this.audio.destination);
    oscillator.start();
    oscillator.stop(this.audio.currentTime + 0.17);
  }

  async enablePush(): Promise<void> {
    try {
      this.client.requireOnline();
      const accountId = this.auth.user()?.id;
      if (
        isElectronRuntime() ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !window.isSecureContext
      )
        throw new Error('Este ambiente não oferece Web Push.');
      const capabilities = await this.client.api.capabilities();
      if (!capabilities.push || !capabilities.vapidPublicKey)
        throw new Error('Web Push ainda não foi configurado no servidor.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted')
        throw new Error(
          'Permissão não concedida. Você pode alterá-la nas configurações do navegador.',
        );
      const worker = await navigator.serviceWorker.ready;
      let subscription = await worker.pushManager.getSubscription();
      if (!subscription)
        subscription = await worker.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.key(capabilities.vapidPublicKey),
        });
      const data = subscription.toJSON();
      if (this.auth.user()?.id !== accountId) {
        await subscription.unsubscribe();
        throw new Error('A conta mudou. Ative as notificações novamente.');
      }
      await this.client.api.post('story-push-subscriptions', {
        installationId: this.client.installationId,
        endpoint: data.endpoint,
        p256dh: data.keys?.['p256dh'],
        auth: data.keys?.['auth'],
      });
      this.pushState.set('Notificações móveis ativadas neste navegador.');
    } catch (error) {
      this.pushState.set(
        error instanceof Error
          ? error.message
          : 'Não foi possível ativar Web Push.',
      );
    }
  }

  private async alert(value: {
    eventId: string;
    storyId: string;
    accountId: string;
    sequence: string;
  }): Promise<void> {
    try {
      contractId(value.eventId);
      contractId(value.storyId);
      if (value.accountId !== this.auth.user()?.id) return;
      const summary = this.client
        .summaries()
        .find((story) => story.id === value.storyId);
      if (!summary?.preferences.external) return;
      if (!(await claimNotification(value.accountId, value.eventId))) return;
      let presented = false;
      if (isElectronRuntime()) {
        presented =
          (await window.electronAPI?.showStoryNotification?.({
            storyId: value.storyId,
            eventId: value.eventId,
            sound: summary.preferences.sound && this.audio?.state !== 'running',
          })) === true;
      } else if (
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        const worker = await navigator.serviceWorker.ready;
        await worker.showNotification('Lorekit', {
          body: 'Nova mensagem em uma História.',
          tag: `lorekit-story:${value.storyId}`,
          data: value,
          silent: !summary.preferences.sound || this.audio?.state === 'running',
        });
        presented = true;
      }
      if (presented)
        await this.client.api.post(`story-alerts/${value.eventId}/presented`, {
          installationId: this.client.installationId,
        });
    } catch {
      /* Chat and unread markers remain available if the platform refuses notifications. */
    }
  }
  private key(value: string): Uint8Array<ArrayBuffer> {
    const decoded = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index++)
      bytes[index] = decoded.charCodeAt(index);
    return bytes;
  }
}
