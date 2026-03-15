const { contextBridge, ipcRenderer } = require('electron');

const pluginDownloadListeners = new Set();

ipcRenderer.on('plugins:download-progress', (_event, payload) => {
  for (const listener of pluginDownloadListeners) {
    listener(payload);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  getImagePath: () => ipcRenderer.invoke('get-image-path'),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, data) => ipcRenderer.invoke('write-file', p, data),
  deleteFile: (p) => ipcRenderer.invoke('delete-file', p),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close:    () => ipcRenderer.invoke('window:close'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  downloadPlugin: (payload) => ipcRenderer.invoke('plugins:download', payload),
  onPluginDownloadProgress: (listener) => {
    pluginDownloadListeners.add(listener);
    return () => pluginDownloadListeners.delete(listener);
  },
});
