const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { runMigrations } = require('./lorekit-backend/src/db-setup');

app.whenReady().then(async () => {
  await runMigrations();

  // Start backend Node.js API
  backendProcess = spawn('node', ['lorekit-backend/index.js'], {
    cwd: __dirname,
    shell: true,
    stdio: 'inherit'
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load Angular app (compilado)
  mainWindow.loadFile('lorekit-frontend/dist/lorekit-frontend/browser/index.html');
}



app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});