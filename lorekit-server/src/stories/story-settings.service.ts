import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { resolve } from 'node:path';
import { readSecret } from '../config/environment';

@Injectable()
export class StorySettingsService {
  readonly enabled =
    process.env['STORIES_ENABLED'] === 'true' ||
    (process.env['NODE_ENV'] !== 'production' &&
      process.env['STORIES_ENABLED'] !== 'false');
  readonly assetRoot = resolve(
    process.env['STORY_ASSET_PATH'] || './data/story-assets',
  );
  readonly webOrigin =
    process.env['STORY_WEB_ORIGIN'] || 'https://app.lorekit.online';
  readonly vapidPublicKey = readSecret(
    'STORY_VAPID_PUBLIC_KEY',
    process.env,
    false,
  );
  readonly vapidPrivateKey = readSecret(
    'STORY_VAPID_PRIVATE_KEY',
    process.env,
    false,
  );
  readonly vapidSubject = process.env['STORY_VAPID_SUBJECT'] || this.webOrigin;
  assertEnabled(): void {
    if (!this.enabled)
      throw new ServiceUnavailableException(
        'Histórias ainda não estão habilitadas neste servidor.',
      );
  }
}
