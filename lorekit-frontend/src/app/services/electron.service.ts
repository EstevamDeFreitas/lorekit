import { Injectable } from '@angular/core';

declare global {
  interface Window {
    electron?: {
      getAppVersion: () => Promise<string>;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  async getAppVersion(): Promise<string> {
    if (window.electron?.getAppVersion) {
      return await window.electron.getAppVersion();
    }
    return 'dev';
  }
}
