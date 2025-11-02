const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let updateWindow; // ADDED
let hasOpenedMain = false; // ADDED: evita abrir múltiplas janelas

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
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
    return true;
  });
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
    return true;
  });

  // Permite "Abrir assim mesmo" na tela de update
  ipcMain.on('updater:open-main', () => openMainOnce()); // ADDED
}

function openMainOnce() { // ADDED
  if (hasOpenedMain) return;
  hasOpenedMain = true;
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.close();
    updateWindow = null;
  }
  createWindow();
}

function sendUpdateStatus(payload) {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.webContents.send('updater:status', payload);
  }
}

function createUpdateWindow() {
  updateWindow = new BrowserWindow({
    width: 460,
    height: 220,
    resizable: false,
    maximizable: false,
    minimizable: false,
    frame: false,
    transparent: false,
    show: false,
    alwaysOnTop: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const splashHtml = `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:;">
<title>Atualizando...</title>
<style>
  :root { color-scheme: dark; }
  body{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#0b0b0f; color:#e5e7eb; }
  .bar{ height:36px; display:flex; align-items:center; padding:0 10px; background:#0f1115; -webkit-app-region: drag; }
  .wrap{ padding:18px 18px 16px; }
  .title{ font-size:14px; opacity:.8; display:flex; align-items:center; gap:8px; }
  .logo{ width:18px; height:18px; }
  .status{ margin-top:10px; font-size:13px; opacity:.9; min-height:18px; }
  .progress{ margin-top:12px; height:8px; background:#1f2937; border-radius:999px; overflow:hidden; }
  .progress-inner{ height:100%; width:0%; background:linear-gradient(90deg,#60a5fa,#22d3ee); transition:width .15s linear; }
  .meta{ margin-top:8px; font-size:12px; color:#9ca3af; min-height:16px; }
  .footer{ margin-top:12px; display:flex; justify-content:flex-end; gap:8px; }
  button{ -webkit-app-region: no-drag; height:28px; padding:0 10px; border:none; border-radius:6px; background:#374151; color:#e5e7eb; cursor:pointer; }
  button:hover{ background:#4b5563; }
  .hidden{ display:none; }
</style>
</head>
<body>
  <div class="bar">
    <div class="title"><img class="logo" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='%23e5e7eb'><path d='M12 2l3 7h7l-5.5 4.1L18 20l-6-4-6 4 1.5-6.9L2 9h7z'/></svg>"> Lorekit — Atualizações</div>
  </div>
  <div class="wrap">
    <div id="status" class="status">Verificando atualizações...</div>
    <div id="progress" class="progress hidden"><div id="bar" class="progress-inner"></div></div>
    <div id="meta" class="meta"></div>
    <div class="footer">
      <button id="closeBtn" class="hidden">Abrir assim mesmo</button>
      <button id="retryBtn" class="hidden">Tentar novamente</button>
    </div>
  </div>

<script>
  const statusEl = document.getElementById('status');
  const progressEl = document.getElementById('progress');
  const barEl = document.getElementById('bar');
  const metaEl = document.getElementById('meta');
  const retryBtn = document.getElementById('retryBtn');
  const closeBtn = document.getElementById('closeBtn');

  retryBtn.addEventListener('click', () => window.updater?.check?.());
  closeBtn.addEventListener('click', () => window.updater?.openMain?.());

  function fmtBytes(n){
    if(!n && n!==0) return '';
    const u=['B','KB','MB','GB']; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++} return n.toFixed(1)+' '+u[i];
  }

  window.updater?.onStatus?.((p)=>{
    if(!p) return;
    if(p.state==='checking'){
      statusEl.textContent='Verificando atualizações...';
      progressEl.classList.add('hidden');
      retryBtn.classList.add('hidden');
      closeBtn.classList.add('hidden');
      metaEl.textContent='';
    }
    if(p.state==='downloading'){
      statusEl.textContent='Baixando atualização...';
      progressEl.classList.remove('hidden');
      metaEl.textContent='';
    }
    if(p.state==='progress'){
      statusEl.textContent='Baixando atualização...';
      progressEl.classList.remove('hidden');
      const pct = Math.max(0, Math.min(100, p.percent||0));
      barEl.style.width = pct + '%';
      metaEl.textContent = (p.bytesPerSecond? (fmtBytes(p.bytesPerSecond) + '/s • ') : '') +
                           (p.transferred!=null && p.total!=null ? (fmtBytes(p.transferred)+' de '+fmtBytes(p.total)) : '');
    }
    if(p.state==='installing'){
      statusEl.textContent='Aplicando atualização...';
      metaEl.textContent='O aplicativo será reiniciado em instantes.';
      progressEl.classList.add('hidden');
      retryBtn.classList.add('hidden');
      closeBtn.classList.add('hidden');
    }
    if(p.state==='no-update'){
      statusEl.textContent='Aplicativo já está atualizado.';
      metaEl.textContent='';
    }
    if(p.state==='error'){
      statusEl.textContent='Não foi possível atualizar agora.';
      metaEl.textContent = p.message || '';
      progressEl.classList.add('hidden');
      retryBtn.classList.remove('hidden');
      closeBtn.classList.remove('hidden');
    }
  });
</script>
</body>
</html>
  `;

  updateWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml));
  updateWindow.once('ready-to-show', () => updateWindow.show());
  updateWindow.on('closed', () => { updateWindow = null; });
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
    frame: false,
  });

  if (isDev) {
    mainWindow.loadURL(devUrl);
    //mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  else {
    mainWindow.loadFile('lorekit-frontend/dist/lorekit-frontend/browser/index.html');
  }

  // REMOVIDO: não checar updates aqui para evitar loop
  // if (app.isPackaged) { ... }
}

function startUpdateFlow() {
  // Em dev, pule o processo e abra o app direto
  if (!app.isPackaged) {
    openMainOnce(); // garante flag
    return;
  }

  // Evita listeners duplicados se isso rodar novamente por algum motivo
  autoUpdater.removeAllListeners(); // ADDED

  createUpdateWindow();

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ state: 'checking' });
  });

  autoUpdater.on('update-available', () => {
    sendUpdateStatus({ state: 'downloading' });
    autoUpdater.downloadUpdate().catch((err) => {
      sendUpdateStatus({ state: 'error', message: err?.message || String(err) });
      openMainOnce(); // ADDED
    });
  });

  autoUpdater.on('download-progress', (p) => {
    sendUpdateStatus({
      state: 'progress',
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendUpdateStatus({ state: 'no-update' });
    setTimeout(() => openMainOnce(), 300); // ADDED
  });

  autoUpdater.on('update-downloaded', () => {
    sendUpdateStatus({ state: 'installing' });
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 400);
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus({ state: 'error', message: err?.message || String(err) });
    setTimeout(() => openMainOnce(), 600); // ADDED
  });

  autoUpdater.checkForUpdates().catch((err) => {
    sendUpdateStatus({ state: 'error', message: err?.message || String(err) });
    openMainOnce(); // ADDED
  });
}

app.whenReady().then(() => {
  registerIpc();
  startUpdateFlow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});