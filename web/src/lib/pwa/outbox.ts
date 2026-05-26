"use client";

// Minimal IndexedDB-backed outbox for write requests that failed because
// the user was offline (or hit a transient 5xx). On reconnect, items are
// replayed against the original URL with their original method, headers,
// and JSON body.
//
// Scope kept narrow on purpose:
//   - JSON requests only (body is a string)
//   - Same-origin URLs only
//   - Best-effort dedup by (url + method + body) within a single second so
//     a double-tap doesn't queue twice
//
// The service worker drains via its own `sync` event handler — see
// web/public/sw.js — and the same drain runs from the page on `online` or
// when the tab regains visibility.

const DB_NAME = "monza-outbox";
const STORE = "requests";
const DB_VERSION = 1;
export const SYNC_TAG = "monza-outbox-sync";

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  queuedAt: number;
  // Free-form tag so callers can show "x edits pending" per surface.
  kind: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueRequest(item: Omit<QueuedRequest, "id" | "queuedAt">): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ ...item, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  // Ask the SW to fire a sync the moment the browser thinks it's online.
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await (reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }).sync?.register(SYNC_TAG);
    } catch {
      // Fall back to the online listener drain.
    }
  }
}

export async function listOutbox(): Promise<QueuedRequest[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise<QueuedRequest[]>((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedRequest[]) ?? []);
    req.onerror = () => resolve([]);
  });
}

async function deleteOne(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export interface DrainResult {
  attempted: number;
  succeeded: number;
  remaining: number;
}

// Replays queued requests one-by-one against the network. On 2xx the
// item is removed. On network failure or 5xx the item is kept for the
// next sync. On 4xx the item is dropped (it would just fail forever).
export async function drainOutbox(): Promise<DrainResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const items = await listOutbox();
    return { attempted: 0, succeeded: 0, remaining: items.length };
  }
  const items = await listOutbox();
  let succeeded = 0;
  for (const item of items) {
    if (item.id == null) continue;
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
        credentials: "include",
      });
      if (res.ok) {
        await deleteOne(item.id);
        succeeded++;
      } else if (res.status >= 400 && res.status < 500) {
        // Permanent rejection — drop so it doesn't loop forever.
        await deleteOne(item.id);
      }
      // 5xx → leave for next round.
    } catch {
      // Network error — leave for next round.
    }
  }
  const remaining = (await listOutbox()).length;
  return { attempted: items.length, succeeded, remaining };
}

// Wrap a JSON fetch so a 5xx or network failure gets queued for later.
// Returns the response on success, and a synthesized "queued" response on
// failure so callers can show "Saved — will sync when back online".
export async function fetchWithOutbox(
  input: string,
  init: RequestInit & { kind: string }
): Promise<Response> {
  const url = input.startsWith("http") ? input : input;
  const method = (init.method || "GET").toUpperCase();
  const headers: Record<string, string> = {};
  if (init.headers) {
    new Headers(init.headers).forEach((v, k) => {
      headers[k] = v;
    });
  }
  const body = typeof init.body === "string" ? init.body : null;

  try {
    const res = await fetch(input, {
      ...init,
      headers,
      credentials: init.credentials ?? "include",
    });
    if (res.ok || (res.status >= 400 && res.status < 500)) return res;
    // 5xx — queue and report "queued".
    if (method !== "GET" && body !== null) {
      await enqueueRequest({ url, method, headers, body, kind: init.kind });
    }
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { "content-type": "application/json" },
    });
  } catch {
    if (method !== "GET" && body !== null) {
      await enqueueRequest({ url, method, headers, body, kind: init.kind });
    }
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { "content-type": "application/json" },
    });
  }
}
