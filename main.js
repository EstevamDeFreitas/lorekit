const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function registerIpc() {
  ipcMain.handle('get-db-path', () => {
    return path.join(app.getPath('userData'), 'lorekit.db');
  });
  ipcMain.handle('get-image-path', () => {
    return path.join(app.getPath('userData'), 'images');
  });
  ipcMain.handle('read-file', async (_e, filePath) => {
    try {
      if (!fs.existsSync(filePath)) return null;
      const buf = await fs.promises.readFile(filePath);
      return new Uint8Array(buf);
    } catch {
      return null;
    }
  });
  ipcMain.handle('write-file', async (_e, filePath, data) => {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, Buffer.from(data));
    return true;
  });
  ipcMain.handle('delete-file', async (_e, filePath) => {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    return true;
  });
  }

function createWindow() {
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:4401';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      webSecurity: isDev ? false : true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if(isDev) {
    mainWindow.loadURL(devUrl);
    //mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  else{
    mainWindow.loadFile('lorekit-frontend/dist/lorekit-frontend/browser/index.html');
  }

  if(app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', info => {
    });

    autoUpdater.on('update-downloaded', () => {
      autoUpdater.quitAndInstall();
    });
  }
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});