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
  readStoryCache: (accountId, assetId) => ipcRenderer.invoke('story-cache:read', accountId, assetId),
  writeStoryCache: (accountId, assetId, bytes) => ipcRenderer.invoke('story-cache:write', accountId, assetId, bytes),
  deleteStoryCache: (accountId, assetId) => ipcRenderer.invoke('story-cache:delete', accountId, assetId),
  showStoryNotification: value => ipcRenderer.invoke('story:notify', value),
  onOpenStory: callback => {
    const listener = (_event, storyId) => callback(storyId);
    ipcRenderer.on('story:open', listener);
    return () => ipcRenderer.removeListener('story:open', listener);
  },
  showSaveDialog: (defaultName) => ipcRenderer.invoke('backup:save-dialog', defaultName),
  reloadApp: () => ipcRenderer.invoke('app:reload'),
  clearWorkspaceForCloudRestore: () => ipcRenderer.invoke('workspace:clear-for-cloud-restore'),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  rendererReady: () => ipcRenderer.invoke('app:renderer-ready'),
  onPrepareToClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app:prepare-to-close', listener);
    return () => ipcRenderer.removeListener('app:prepare-to-close', listener);
  },
  finishPrepareToClose: (success) => ipcRenderer.send('app:prepare-to-close-finished', success),
});
