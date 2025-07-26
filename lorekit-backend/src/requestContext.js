const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();

function runWithContext(userId, fn) {
  asyncLocalStorage.run({ userId }, fn);
}

function getUserId() {
  const store = asyncLocalStorage.getStore();
  return store?.userId || null;
}

module.exports = {
  runWithContext,
  getUserId,
};