const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  getImagePath: () => ipcRenderer.invoke('get-image-path'),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, data) => ipcRenderer.invoke('write-file', p, data),
  deleteFile: (p) => ipcRenderer.invoke('delete-file', p),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close:    () => ipcRenderer.invoke('window:close'),
});