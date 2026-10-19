let databasePromise;
function database() {
  if (!databasePromise)
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("lorekit-story-notifications", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("state");
        request.result.createObjectStore("shown");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  return databasePromise;
}
export async function setNotificationAccount(accountId) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["state", "shown"], "readwrite");
    const request = tx.objectStore("state").get("account");
    request.onsuccess = () => {
      if (request.result !== accountId) tx.objectStore("shown").clear();
      tx.objectStore("state").put(accountId, "account");
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function notificationAccount() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("state", "readonly")
      .objectStore("state")
      .get("account");
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
export async function claimNotification(accountId, eventId) {
  const db = await database();
  return new Promise((resolve, reject) => {
    let accepted = false;
    const tx = db.transaction(["state", "shown"], "readwrite");
    const account = tx.objectStore("state").get("account");
    account.onsuccess = () => {
      if (account.result !== accountId) return;
      const key = `${accountId}:${eventId}`,
        shown = tx.objectStore("shown").get(key);
      shown.onsuccess = () => {
        if (!shown.result) {
          tx.objectStore("shown").put(Date.now(), key);
          accepted = true;
        }
      };
    };
    tx.oncomplete = () => resolve(accepted);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
