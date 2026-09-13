// Isolated renderer smoke test. Run with Electron while ng serve runs on port 4401.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const webMode = process.argv.includes('--web');
const engine = process.argv.includes('--tiptap') ? 'tiptap' : 'editorjs';
const large = process.argv.includes('--large');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lorekit-history-qa-'));
app.setPath('userData', temporary);
const confined = value => {
  const resolved = path.resolve(value);
  if (!resolved.startsWith(temporary + path.sep)) throw new Error('QA path outside temporary workspace');
  return resolved;
};
ipcMain.handle('get-db-path', () => path.join(temporary, 'lorekit.db'));
ipcMain.handle('get-image-path', () => path.join(temporary, 'images'));
ipcMain.handle('read-file', (_, file) => { const target = confined(file); return fs.existsSync(target) ? fs.readFileSync(target) : null; });
for (const channel of ['write-file', 'write-file-atomic']) {
  ipcMain.handle(channel, (_, file, bytes) => { fs.writeFileSync(confined(file), Buffer.from(bytes)); });
}
for (const channel of ['cloud-session:read', 'app:renderer-ready']) ipcMain.handle(channel, () => null);
ipcMain.handle('get-app-version', () => 'QA');

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: /^https?:/.test(details.url) && !details.url.startsWith('http://127.0.0.1:4401/') });
  });
  const window = new BrowserWindow({ width: 1200, height: 800, show: false, webPreferences: { ...(webMode ? {} : { preload: path.join(root, 'preload.js') }), contextIsolation: true } });
  window.webContents.on('console-message', (_, level, message) => { if (level >= 3) console.error(message); });
  const run = source => window.webContents.executeJavaScript(source);
  const waitFor = async source => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await run(source)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out: ' + source);
  };
  try {
    await window.loadURL('http://127.0.0.1:4401/');
    await waitFor("!!window.ng && !!document.querySelector('app-root') && !!ng.getComponent(document.querySelector('app-root'))");
    if (webMode) {
      await run(`(async()=>{
        const app=ng.getComponent(document.querySelector('app-root'));
        app.auth.session.set({user:{id:'qa-user',email:'qa@example.invalid',displayName:'QA'},deviceId:'qa-device',accessToken:'local-test-only',accessTokenExpiresAt:Date.now()+3600000});
        app.auth.syncEnabled.set(false);
        const http=app.workspace.http, original=http.get.bind(http);
        http.get=(url,...args)=>url.endsWith('/vaults')?{subscribe(observer){observer.next([{id:'qa-vault',name:'QA',role:'owner'}]);observer.complete();return {unsubscribe(){}};}}:original(url,...args);
        await app.workspace.initializeAuthenticatedWeb();
        location.hash='#/app';
      })()`);
    }
    await waitFor("!!ng.getComponent(document.querySelector('app-root'))?.dbProvider.ready() && !!document.querySelector('app-main-ui')");
    console.log(await run(`(async () => {
      window.qaApp = ng.getComponent(document.querySelector('app-root'));
      window.qaDb = qaApp.dbProvider;
      qaDb.getCrudHelper().create('Character', {id:'qa-character', name:'Original', description:'', background:''});
      qaDb.getCrudHelper().create('GlobalParameter', {key:'textEditorEngine',value:${JSON.stringify(engine)}});
      await qaDb.flushPendingWrites();
      window.qaTabs = ng.getComponent(document.querySelector('app-main-ui')).tabManager;
      qaTabs.openTab('Character', 'qa-character', 'Original', 'fa-solid fa-user');
      return 'Temporary database ready';
    })()`));
    await waitFor("!!document.querySelector('app-character-edit input[data-history-field]')");
    console.log(await run(`(() => {
      window.qaHistory = ng.getComponent(document.querySelector('app-entity-history-buttons')).history;
      window.qaPage = ng.getComponent(document.querySelector('app-character-edit'));
      return {page: qaPage.character.name};
    })()`));
    await run(`(() => {
      const input = document.querySelector('app-character-edit input[data-history-field]');
      input.focus(); input.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,inputType:'insertText'}));
      input.value='Alice'; input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
      qaPage.selectTab('backstory'); ng.applyChanges(qaPage);
    })()`);
    await waitFor("!!document.querySelector('app-editor') && !!(ng.getComponent(document.querySelector('app-editor')).editor || ng.getComponent(document.querySelector('app-editor')).tiptap)");
    console.log(await run(`(async () => {
      const editor = ng.getComponent(document.querySelector('app-editor'));
      const content='Explorer' + (${large} ? ' Long document text.'.repeat(6000) : '');
      window.qaExpectedText=content;
      if(editor.tiptap) editor.tiptap.commands.insertContent(content);
      else {await editor.editor.isReady; editor.editor.blocks.insert('paragraph', {text:content});}
      await new Promise(resolve=>setTimeout(resolve,500));
      await qaHistory.settle();
      const command=async(direction,keyboard)=>{
        if(keyboard) document.querySelector('app-character-edit input[data-history-field]').dispatchEvent(new KeyboardEvent('keydown',{key:direction==='undo'?'z':'y',ctrlKey:true,bubbles:true,cancelable:true}));
        else document.querySelectorAll('app-entity-history-buttons button')[direction==='undo'?0:1].click();
        while(qaHistory.busy()) await new Promise(resolve=>setTimeout(resolve,10));
        ng.applyChanges(ng.getComponent(document.querySelector('app-entity-history-buttons')));
      };
      ng.applyChanges(ng.getComponent(document.querySelector('app-entity-history-buttons')));
      await command('undo',true); await command('undo',false);
      if(qaPage.character.name!=='Original') throw new Error('Name undo failed');
      await command('redo',false); await command('redo',true);
      const row=qaDb.getCrudHelper().findById('Character','qa-character');
      if(row.name!=='Alice'||!row.background.includes('Explorer')) throw new Error('Persistence mismatch');
      return {editorFlow:'PASS',name:row.name,contentBytes:row.background.length};
    })()`));
    await run('qaApp.refreshComponents()');
    await waitFor("!!document.querySelector('app-character-edit input[data-history-field]')");
    console.log(await run(`(async()=>{await qaHistory.undo(); if(!qaHistory.canRedo())throw new Error('F5 lost history'); await qaHistory.redo(); return 'Internal F5: PASS';})()`));
    for (let iteration=0; iteration<3; iteration++) {
      await run(`(async()=>{
        const pane=qaTabs.snapshot.panes.find(p=>p.tabs.some(t=>t.entityId==='qa-character'));
        qaTabs.closeTab(pane.tabs.find(t=>t.entityId==='qa-character').id,pane.id);
      })()`);
      await waitFor("!document.querySelector('app-character-edit')");
      await run("qaHistory.settle()");
      if(await run("qaHistory.controls.size")) throw new Error('Unmounted controls retained');
      await run("qaTabs.openTab('Character','qa-character','Alice','fa-solid fa-user')");
      await waitFor("!!document.querySelector('app-character-edit input[data-history-field]')");
    }
    console.log(await run(`(async()=>{await qaHistory.undo(); await qaHistory.redo(); const content=JSON.parse(qaDb.getCrudHelper().findById('Character','qa-character').background); if(content.blocks[0].content.map(i=>i.text||'').join('')!==qaExpectedText)throw new Error('Reopen lost content');return 'Repeated close/reopen: PASS';})()`));
    console.log(await run(`(async()=>{
      qaDb.getCrudHelper().create('DynamicField',{id:'qa-field',name:'Hidden text',entityTable:'Character',fieldType:'text'});
      const address={entity:{table:'Character',id:'qa-character'},field:{column:'value',dynamicId:'qa-field'}};
      qaHistory.activate(address.entity);
      await qaHistory.capture(address,'','Custom text');
      await qaHistory.undo(); await qaHistory.redo();
      if(qaHistory.store.read(address)!=='Custom text') throw new Error('Hidden dynamic persistence failed');
      return 'Hidden custom field: PASS';
    })()`));
    if(webMode) console.log(await run(`(async()=>{await qaDb.flushPendingWrites();const bytes=await qaApp.workspace.browserStorage.read('qa-user','qa-vault');if(!bytes?.length)throw new Error('Missing IndexedDB persistence');return {indexedDbBytes:bytes.length};})()`));
    await run(`(()=>{
      qaDb.getCrudHelper().create('Character',{id:'qa-other',name:'Bob',description:''});
      qaTabs.splitPane(qaTabs.snapshot.focusedPaneId);
      qaTabs.openTab('Character','qa-other','Bob','fa-solid fa-user');
    })()`);
    await waitFor("document.querySelectorAll('app-character-edit').length===2");
    console.log(await run(`(async()=>{
      const input=document.querySelector('[data-history-entity="qa-other"] input[data-history-field]');
      input.focus();input.value='Bobby';input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
      await qaHistory.settle();
      if(qaHistory.active().id!=='qa-other') throw new Error('Wrong focused pane');
      await qaHistory.undo();
      if(qaDb.getCrudHelper().findById('Character','qa-other').name!=='Bob'||qaDb.getCrudHelper().findById('Character','qa-character').name!=='Alice') throw new Error('Cross-pane history leak');
      const first=document.querySelector('[data-history-entity="qa-character"] input[data-history-field]');
      first.focus();
      // Hidden Electron windows change activeElement without emitting native focusin.
      first.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));
      if(qaHistory.active().id!=='qa-character') throw new Error('Keyboard focus mismatch: '+JSON.stringify({history:qaHistory.active(),dom:document.activeElement?.closest('[data-history-entity]')?.dataset,focused:qaTabs.snapshot.focusedPaneId,panes:qaTabs.snapshot.panes.map(p=>({id:p.id,active:p.activeTabId,tabs:p.tabs.map(t=>({id:t.id,entity:t.entityId}))}))}));
      return 'Two focused panes: PASS';
    })()`));
    for(const width of [1200, 500]) {
      window.setContentSize(width,800);
      await new Promise(resolve=>setTimeout(resolve,200));
      fs.writeFileSync(path.join(temporary,'header-'+width+'.png'),(await window.webContents.capturePage()).toPNG());
      console.log(await run(`(()=>{const a=document.querySelector('app-entity-history-buttons').getBoundingClientRect(), b=document.querySelector('app-search').getBoundingClientRect();return {width:innerWidth,buttons:{x:a.x,right:a.right},search:{x:b.x,right:b.right},noOverlap:a.right<=b.x};})()`));
    }
    console.log('QA artifacts: '+temporary);
    app.exit(0);
  } catch(error) { console.error(error); console.log(await run('({url:location.href,text:document.body.innerText.slice(0,1500)})')); console.log('QA artifacts: '+temporary); app.exit(1); }
});
