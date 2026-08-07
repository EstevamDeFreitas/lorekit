const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  getImagePath: () => ipcRenderer.invoke('get-image-path'),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, data) => ipcRenderer.invoke('write-file', p, data),
  writeFileAtomic: (p, data) => ipcRenderer.invoke('write-file-atomic', p, data),
  deleteFile: (p) => ipcRenderer.invoke('delete-file', p),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close:    () => ipcRenderer.invoke('window:close'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  readCloudSession: () => ipcRenderer.invoke('cloud-session:read'),
  writeCloudSession: (value) => ipcRenderer.invoke('cloud-session:write', value),
  clearCloudSession: () => ipcRenderer.invoke('cloud-session:clear'),
  showSaveDialog: (defaultName) => ipcRenderer.invoke('backup:save-dialog', defaultName),
  reloadApp: () => ipcRenderer.invoke('app:reload'),
  rendererReady: () => ipcRenderer.invoke('app:renderer-ready'),
  onPrepareToClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:prepare-to-close', listener);
    return () => ipcRenderer.removeListener('app:prepare-to-close', listener);
  },
  finishPrepareToClose: (success) => ipcRenderer.send('app:prepare-to-close-finished', success),
});