import { Injectable } from '@angular/core';
import { isElectronRuntime } from '../utils/runtime-platform';

declare global {
  interface Window {
    electronAPI?: {
      getAppVersion?: () => Promise<string>;
      readCloudSession?: () => Promise<string | null>;
      writeCloudSession?: (value: string) => Promise<boolean>;
      clearCloudSession?: () => Promise<boolean>;
      [key: string]: unknown;
    };
  }
}

const WEB_SESSION_KEY = 'lorekit.cloud.session.v1';

@Injectable({ providedIn: 'root' })
export class CloudSessionStorageService {
  async read(): Promise<string | null> {
    if (isElectronRuntime()) {
      return await window.electronAPI?.readCloudSession?.() ?? null;
    }

    return sessionStorage.getItem(WEB_SESSION_KEY);
  }

  async write(value: string): Promise<void> {
    if (isElectronRuntime()) {
      if (!window.electronAPI?.writeCloudSession) {
        throw new Error('Armazenamento seguro do Electron indisponível.');
      }
      await window.electronAPI.writeCloudSession(value);
      return;
    }

    sessionStorage.setItem(WEB_SESSION_KEY, value);
  }

  async clear(): Promise<void> {
    if (isElectronRuntime()) {
      await window.electronAPI?.clearCloudSession?.();
      return;
    }

    sessionStorage.removeItem(WEB_SESSION_KEY);
  }
}
