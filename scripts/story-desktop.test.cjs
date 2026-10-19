const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function harness() {
  const handlers = new Map(), notifications = [], calls = [];
  const account = randomUUID();
  class Notification {
    static isSupported() { return true; }
    constructor(options) { this.options = options; notifications.push(this); }
    on(name, callback) { this[name] = callback; }
    show() { calls.push('notification'); }
  }
  const electron = { app: { isPackaged: false, getPath: () => path.resolve('test-user-data'), whenReady: () => new Promise(() => {}), on() {} },
    ipcMain: { handle: (name, callback) => handlers.set(name, callback), on() {} }, protocol: { registerSchemesAsPrivileged() {} }, Notification,
    safeStorage: { isEncryptionAvailable: () => true, decryptString: () => JSON.stringify({ user: { id: account } }) } };
  const promises = { readFile: async (file) => { calls.push(file); return Buffer.from('cache'); }, rm: async (file) => { calls.push(file); } };
  const context = vm.createContext({ require: (name) => name === 'electron' ? electron : name === 'electron-updater' ? { autoUpdater: {} } : name === 'fs' ? { promises } : require(name), __dirname: path.resolve(__dirname, '..'), process, Buffer, Uint8Array, URL, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8') + '\nregisterIpc();', context);
  context.testWindow = { isDestroyed: () => false, isMinimized: () => true, restore: () => calls.push('restore'), show: () => calls.push('show'), focus: () => calls.push('focus'), webContents: { send: (...args) => calls.push(args) } };
  vm.runInContext('mainWindow = testWindow;', context);
  return { handlers, notifications, calls, account, trusted: { senderFrame: { url: 'http://localhost:4401' } } };
}
test('desktop story notifications reject invalid payloads and restore a minimized window', async () => {
  const h = harness(), notify = h.handlers.get('story:notify'), storyId = randomUUID(), eventId = randomUUID();
  await assert.rejects(notify(h.trusted, { storyId: '../private', eventId, sound: true }));
  await assert.rejects(notify({ senderFrame: { url: 'https://foreign.invalid' } }, { storyId, eventId, sound: true }));
  assert.equal(await notify(h.trusted, { storyId, eventId, sound: false }), true);
  assert.equal(await notify(h.trusted, { storyId, eventId, sound: false }), false);
  assert.equal(h.notifications[0].options.silent, true);
  h.notifications[0].click();
  assert.deepEqual(h.calls.slice(-4), ['restore', 'show', 'focus', ['story:open', storyId]]);
});
test('desktop story cache scopes reads to the signed-in account and rejects path traversal', async () => {
  const h = harness(), read = h.handlers.get('story-cache:read'), remove = h.handlers.get('story-cache:delete');
  await assert.rejects(read(h.trusted, '../private', null));
  await assert.rejects(read(h.trusted, randomUUID(), null), /another account/);
  await read(h.trusted, h.account, null);
  assert.equal(h.calls.at(-1), path.resolve('test-user-data', 'stories', h.account, 'history.db'));
  await assert.rejects(remove(h.trusted, h.account, '../../private'));
  await remove(h.trusted, h.account, null);
  assert.equal(h.calls.at(-1), path.resolve('test-user-data', 'stories', h.account));
});
