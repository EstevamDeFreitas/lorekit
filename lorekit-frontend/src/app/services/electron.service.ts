import { Injectable } from '@angular/core';

export interface PluginDownloadRequest {
  requestId: string;
  pluginId: string;
  version: string;
  url: string;
  expectedChecksum: string;
}

export interface PluginDownloadProgress {
  requestId: string;
  pluginId: string;
  downloadedBytes: number;
  totalBytes: number;
  progress: number;
}

export interface PluginDownloadResult {
  pluginId: string;
  destinationPath: string;
  checksum: string;
  downloadedBytes: number;
}

declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      downloadPlugin: (payload: PluginDownloadRequest) => Promise<PluginDownloadResult>;
      onPluginDownloadProgress: (listener: (payload: PluginDownloadProgress) => void) => () => void;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  async getAppVersion(): Promise<string> {
    if (window.electronAPI?.getAppVersion) {
      return await window.electronAPI.getAppVersion();
    }
    return 'dev';
  }

  async downloadPlugin(payload: PluginDownloadRequest): Promise<PluginDownloadResult> {
    if (!window.electronAPI?.downloadPlugin) {
      throw new Error('PLUGIN_DOWNLOAD_NOT_AVAILABLE');
    }

    return window.electronAPI.downloadPlugin(payload);
  }

  onPluginDownloadProgress(listener: (payload: PluginDownloadProgress) => void): () => void {
    if (!window.electronAPI?.onPluginDownloadProgress) {
      return () => undefined;
    }

    return window.electronAPI.onPluginDownloadProgress(listener);
  }
}
