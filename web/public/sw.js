// Monza App service worker.
//
// Strategies:
//   - Navigation (HTML): network-first; if offline, serve a cached fallback
//     so the user sees the app shell + "you're offline" instead of the
//     browser's dino page.
//   - Static assets (/_next/static, /icons, /manifest.json, fonts):
//     cache-first with network refresh in the background.
//   - Supabase / API calls: passthrough — never cached, RLS depends on
//     the live request including auth headers.
//
// Bump CACHE_VERSION any time you ship a meaningful change to this file
// or the offline fallback page so old SWs don't keep serving stale shells.

const CACHE_VERSION = "monza-v5";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";

// Resources to pre-cache on install so the app shell is reachable offline.
const PRECACHE_URLS = [OFFLINE_URL, "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Helpers
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(?:js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|gif|ico)$/i.test(url.pathname)
  );
}

function isApiOrSupabase(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.hostname.endsWith(".supabase.co") ||
    url.hostname.endsWith(".supabase.in")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache mutations
  const url = new URL(req.url);

  // Same-origin requirement for caching to keep things simple/safe.
  const sameOrigin = url.origin === self.location.origin;

  // Pass through API + Supabase (need fresh auth + RLS).
  if (isApiOrSupabase(url)) return;

  // Navigation: network-first, fall back to offline shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // Stash the latest navigation response in runtime cache so a
          // repeat visit still works for that exact route offline.
          if (fresh && fresh.ok && sameOrigin) {
            const copy = fresh.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return fresh;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match(OFFLINE_URL);
          return (
            fallback ||
            new Response("Offline", { status: 503, statusText: "Offline" })
          );
        }
      })()
    );
    return;
  }

  // Static assets: cache-first, refresh in background.
  if (sameOrigin && isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        const networkPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => null);
        return cached || (await networkPromise) || new Response("", { status: 504 });
      })()
    );
    return;
  }

  // Everything else: default network behavior (no caching).
});

// Background Sync — drain the IndexedDB outbox when the browser fires
// our sync tag. Mirrors web/src/lib/pwa/outbox.ts (drainOutbox); kept in
// vanilla JS here because the SW can't import the TS module.
const OUTBOX_DB = "monza-outbox";
const OUTBOX_STORE = "requests";
const OUTBOX_SYNC_TAG = "monza-outbox-sync";

function openOutboxDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllOutbox(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(OUTBOX_STORE, "readonly");
    const req = tx.objectStore(OUTBOX_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

function deleteOutboxItem(db, id) {
  return new Promise((resolve) => {
    const tx = db.transaction(OUTBOX_STORE, "readwrite");
    tx.objectStore(OUTBOX_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function drainOutboxInSw() {
  let db;
  try {
    db = await openOutboxDb();
  } catch {
    return;
  }
  const items = await getAllOutbox(db);
  for (const item of items) {
    if (item.id == null) continue;
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers || {},
        body: item.body,
        credentials: "include",
      });
      if (res.ok) {
        await deleteOutboxItem(db, item.id);
      } else if (res.status >= 400 && res.status < 500) {
        await deleteOutboxItem(db, item.id);
      }
    } catch {
      // Network error — leave for next round.
    }
  }
}

self.addEventListener("sync", function (event) {
  if (event.tag === OUTBOX_SYNC_TAG) {
    event.waitUntil(drainOutboxInSw());
  }
});

self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Monza App";
  const options = {
    body: data.message || "You have a new notification",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url: data.link || "/",
    },
    vibrate: [200, 100, 200],
    tag: data.tag || "default",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
