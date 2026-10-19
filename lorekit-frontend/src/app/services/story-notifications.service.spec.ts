import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  claimNotification,
  notificationAccount,
  setNotificationAccount,
} from '../../../public/story-notification-store.js';
import { StoryNotificationsService } from './story-notifications.service';
import { StoryClientService } from './story-client.service';
import { AuthService } from './auth.service';

describe('Story notification coordination', () => {
  afterEach(async () => {
    await setNotificationAccount(null);
  });
  it('atomically claims a repeated live/push event once and rejects an old account after logout', async () => {
    const account = crypto.randomUUID(),
      event = crypto.randomUUID();
    await setNotificationAccount(account);
    expect(
      (
        await Promise.all([
          claimNotification(account, event),
          claimNotification(account, event),
        ])
      ).filter(Boolean),
    ).toHaveSize(1);
    expect(await claimNotification(account, event)).toBeFalse();
    await setNotificationAccount(null);
    expect(await notificationAccount()).toBeNull();
    expect(await claimNotification(account, crypto.randomUUID())).toBeFalse();
    const next = crypto.randomUUID();
    await setNotificationAccount(next);
    expect(await claimNotification(account, event)).toBeFalse();
    expect(await claimNotification(next, event)).toBeTrue();
  });
  it('leaves sound locked until a gesture and explains unavailable push support', async () => {
    const original = window.electronAPI;
    window.electronAPI = {};
    try {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          StoryNotificationsService,
          {
            provide: StoryClientService,
            useValue: {
              summaries: signal([]),
              cache: { knownAccount: signal(null) },
              requireOnline() {},
            },
          },
          {
            provide: AuthService,
            useValue: { user: signal(null), onSessionCleanup: () => () => {} },
          },
        ],
      });
      const service = TestBed.inject(StoryNotificationsService);
      expect(service.soundReady()).toBeFalse();
      await service.enablePush();
      expect(service.pushState()).toContain('não oferece Web Push');
    } finally {
      if (original) window.electronAPI = original;
      else delete window.electronAPI;
    }
  });
});
