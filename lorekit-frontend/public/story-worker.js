import {
  claimNotification,
  notificationAccount,
} from "./story-notification-store.js";
const BUILD_ID = "__LOREKIT_SHELL_VERSION__";
const SHELL_CACHE = `lorekit-story-shell-${BUILD_ID}`;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch("/story-shell-manifest.json", {
        cache: "no-store",
      });
      if (
        response.ok &&
        response.headers.get("content-type")?.includes("json")
      ) {
        const manifest = await response.json();
        if (manifest.version !== BUILD_ID || !Array.isArray(manifest.assets))
          throw new Error("Offline shell version mismatch");
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll(manifest.assets);
      }
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("lorekit-story-shell-") && name !== SHELL_CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.open(SHELL_CACHE)).match("/index.html"),
      ),
    );
  } else if (
    /\.(js|css|woff2?|ttf|wasm|png|svg|ico)$/.test(url.pathname) &&
    !url.pathname.includes("/api/")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE),
          stored = await cache.match(request);
        if (stored) return stored;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data;
      try {
        data = event.data?.json();
      } catch {
        return;
      }
      if (
        !data ||
        ![data.eventId, data.storyId, data.accountId].every(
          (value) => typeof value === "string" && uuid.test(value),
        )
      )
        return;
      if (!(await claimNotification(data.accountId, data.eventId))) return;
      await self.registration.showNotification("Lorekit", {
        body: "Nova mensagem em uma História.",
        tag: `lorekit-story:${data.storyId}`,
        data,
        icon: "/assets/lorekit-logo.png",
        renotify: false,
        silent: data.sound !== true,
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const data = event.notification.data;
      if (
        !data ||
        (await notificationAccount()) !== data.accountId ||
        !uuid.test(data.storyId)
      )
        return;
      const url = `${self.location.origin}/#/stories/${data.storyId}`;
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = clients.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (client) {
        await client.navigate(url);
        await client.focus();
      } else await self.clients.openWindow(url);
    })(),
  );
});
