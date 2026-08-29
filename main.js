const { app, BrowserWindow, ipcMain, dialog, safeStorage, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { fileURLToPath, pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lorekit',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true },
  },
  {
    scheme: 'lorekit-local',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

let mainWindow;
let updateWindow; // ADDED
let hasOpenedMain = false; // ADDED: evita abrir múltiplas janelas
let rendererReady = false;
let pendingRendererTransition = null;

function isTrustedRenderer(event) {
  try {
    const rendererUrl = new URL(event.senderFrame?.url ?? '');
    if (rendererUrl.protocol === 'lorekit:' && rendererUrl.host === 'app') return true;
    if (!app.isPackaged) {
      return rendererUrl.origin === 'http://localhost:4401'
        || rendererUrl.origin === 'http://127.0.0.1:4401';
    }
    return false;
  } catch {
    return false;
  }
}

function registerAppProtocol() {
  const rendererRoot = path.resolve(__dirname, 'lorekit-frontend/dist/lorekit-frontend/browser');
  protocol.handle('lorekit', request => {
    let requestUrl;
    try {
      requestUrl = new URL(request.url);
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (requestUrl.host !== 'app') {
      return new Response('Not found', { status: 404 });
    }

    let relativePath;
    try {
      relativePath = decodeURIComponent(requestUrl.pathname).replace(/^[/\\]+/, '');
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (!relativePath) relativePath = 'index.html';
    const filePath = path.resolve(rendererRoot, relativePath);
    const rendererPrefix = `${rendererRoot}${path.sep}`;
    if (filePath !== rendererRoot && !filePath.startsWith(rendererPrefix)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function registerLocalImageProtocol() {
  protocol.handle('lorekit-local', async request => {
    let requestUrl;
    try {
      requestUrl = new URL(request.url);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    if (requestUrl.host !== 'image') {
      return new Response('Not found', { status: 404 });
    }

    const rawPath = requestUrl.searchParams.get('path');
    if (!rawPath) {
      return new Response('Bad request', { status: 400 });
    }

    let requestedPath;
    try {
      requestedPath = rawPath.startsWith('file:') ? fileURLToPath(rawPath) : rawPath;
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    try {
      const imagesRoot = await fs.promises.realpath(path.join(app.getPath('userData'), 'images'));
      const imagePath = await fs.promises.realpath(path.resolve(requestedPath));
      const relativePath = path.relative(imagesRoot, imagePath);
      if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
        return new Response('Forbidden', { status: 403 });
      }

      const stats = await fs.promises.stat(imagePath);
      if (!stats.isFile()) {
        return new Response('Not found', { status: 404 });
      }

      return net.fetch(pathToFileURL(imagePath).toString());
    } catch (error) {
      if (error?.code === 'ENOENT') return new Response('Not found', { status: 404 });
      return new Response('Unable to read image', { status: 500 });
    }
  });
}

function requestRendererTransition(onSuccess, onFailure = () => {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !rendererReady) {
    onSuccess();
    return;
  }

  if (pendingRendererTransition) {
    return;
  }

  pendingRendererTransition = { onSuccess, onFailure };
  mainWindow.webContents.send('app:prepare-to-close');
}


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
    const parentDirectory = path.dirname(filePath);
    const driveRoot = path.parse(parentDirectory).root;

    // On Windows, mkdir on an existing drive root (for example, B:\) can fail
    // with EPERM. The root already exists, so only create directories below it.
    if (parentDirectory !== driveRoot) {
      await fs.promises.mkdir(parentDirectory, { recursive: true });
    }

    await fs.promises.writeFile(filePath, Buffer.from(data));
    return true;
  });
  ipcMain.handle('write-file-atomic', async (_e, filePath, data) => {
    const parentDirectory = path.dirname(filePath);
    const driveRoot = path.parse(parentDirectory).root;
    if (parentDirectory !== driveRoot) {
      await fs.promises.mkdir(parentDirectory, { recursive: true });
    }

    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    let temporaryHandle;
    try {
      temporaryHandle = await fs.promises.open(temporaryPath, 'w');
      await temporaryHandle.writeFile(Buffer.from(data));
      await temporaryHandle.sync();
      await temporaryHandle.close();
      temporaryHandle = undefined;
      await fs.promises.rename(temporaryPath, filePath);
      return true;
    } catch (error) {
      if (temporaryHandle) {
        try {
          await temporaryHandle.close();
        } catch {
          // Preserve the original error.
        }
      }
      try {
        await fs.promises.rm(temporaryPath, { force: true });
      } catch {
        // A stale temporary file is harmless and can be replaced on the next write.
      }
      throw error;
    }
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
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
  ipcMain.handle('cloud-session:read', async (event) => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted renderer.');

    const sessionPath = path.join(app.getPath('userData'), 'cloud-session.bin');
    try {
      const encrypted = await fs.promises.readFile(sessionPath);
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Secure storage is unavailable.');
      }
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      console.error('Failed to read the encrypted cloud session.');
      throw error;
    }
  });
  ipcMain.handle('cloud-session:write', async (_event, value) => {
    if (!isTrustedRenderer(_event)) {
      throw new Error('Untrusted renderer.');
    }

    if (typeof value !== 'string' || value.length > 65_536) {
      throw new Error('Invalid cloud session payload.');
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage is unavailable.');
    }

    const sessionPath = path.join(app.getPath('userData'), 'cloud-session.bin');
    const encrypted = safeStorage.encryptString(value);
    await fs.promises.writeFile(sessionPath, encrypted, { mode: 0o600 });
    return true;
  });
  ipcMain.handle('cloud-session:clear', async (event) => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted renderer.');

    const sessionPath = path.join(app.getPath('userData'), 'cloud-session.bin');
    try {
      await fs.promises.unlink(sessionPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    return true;
  });
  ipcMain.handle('backup:save-dialog', async (_e, defaultName) => {
    const win = mainWindow || BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win, {
      title: 'Salvar backup',
      defaultPath: defaultName,
      filters: [{ name: 'Lorekit Backup', extensions: ['lorekit'] }],
    });
    return result.canceled ? null : result.filePath;
  });
  ipcMain.handle('workspace:clear-for-cloud-restore', async (event) => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted renderer.');
    const userData = app.getPath('userData');
    await Promise.all([
      fs.promises.rm(path.join(userData, 'lorekit.db'), { force: true }),
      fs.promises.rm(path.join(userData, 'images'), { recursive: true, force: true }),
    ]);
    return true;
  });
  ipcMain.handle('app:restart', (event) => {
    if (!isTrustedRenderer(event)) throw new Error('Untrusted renderer.');
    app.relaunch();
    app.exit(0);
    return true;
  });
  ipcMain.handle('app:reload', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;

    return new Promise(resolve => {
      requestRendererTransition(() => {
        rendererReady = false;
        const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
        if (isDev) {
          mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:4401');
        } else {
          mainWindow.loadURL('lorekit://app/index.html');
        }
        resolve(true);
      }, () => resolve(false));
    });
  });
  ipcMain.handle('app:renderer-ready', () => {
    rendererReady = true;
    return true;
  });
  ipcMain.on('app:prepare-to-close-finished', (_event, success) => {
    const transition = pendingRendererTransition;
    pendingRendererTransition = null;
    if (!transition) return;

    if (success) {
      transition.onSuccess();
    } else {
      transition.onFailure();
    }
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
    mainWindow.loadURL('lorekit://app/index.html');
  }


  let canClose = false;
  mainWindow.on('close', event => {
    if (canClose || !rendererReady) {
      return;
    }

    event.preventDefault();
    requestRendererTransition(() => {
      canClose = true;
      rendererReady = false;
      mainWindow?.close();
    });
  });
  mainWindow.webContents.on('did-start-loading', () => {
    rendererReady = false;
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    pendingRendererTransition = null;
    rendererReady = false;
  });
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
  registerAppProtocol();
  registerLocalImageProtocol();
  registerIpc();
  startUpdateFlow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});