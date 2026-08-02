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

@Injectable({ providedIn: 'root' })
export class CloudSessionStorageService {
  async read(): Promise<string | null> {
    if (isElectronRuntime()) {
      return await window.electronAPI?.readCloudSession?.() ?? null;
    }

    return null;
  }

  async write(value: string): Promise<void> {
    if (isElectronRuntime()) {
      if (!window.electronAPI?.writeCloudSession) {
        throw new Error('Armazenamento seguro do Electron indisponível.');
      }
      await window.electronAPI.writeCloudSession(value);
      return;
    }

    // Web mantém apenas o access token em memória; o refresh fica em cookie HttpOnly.
  }

  async clear(): Promise<void> {
    if (isElectronRuntime()) {
      await window.electronAPI?.clearCloudSession?.();
      return;
    }

    // Não há credencial acessível ao JavaScript para remover no navegador.
  }
}
