"use client";

import { createClient } from "@/lib/supabase";

// Companion outbox for Supabase-direct mutations (where there is no REST
// endpoint to point fetchWithOutbox at). We capture enough information to
// replay an UPDATE / INSERT against the same table once the network is
// back, using the live Supabase client (so auth and RLS are correct).
//
// Scope kept narrow: UPDATE/INSERT only, single eq() filter for UPDATE.

const DB_NAME = "monza-supabase-outbox";
const STORE = "ops";
const DB_VERSION = 1;

export interface QueuedSupabaseOp {
  id?: number;
  table: string;
  op: "update" | "insert";
  payload: Record<string, unknown>;
  // For UPDATE: equality filter column/value.
  eqColumn?: string;
  eqValue?: string | number;
  kind: string;
  queuedAt: number;
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

export async function enqueueSupabaseOp(
  item: Omit<QueuedSupabaseOp, "id" | "queuedAt">
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ ...item, queuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function listOps(): Promise<QueuedSupabaseOp[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise<QueuedSupabaseOp[]>((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as QueuedSupabaseOp[]) ?? []);
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

export async function drainSupabaseOutbox(): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const items = await listOps();
  if (items.length === 0) return;
  const supabase = createClient();
  // The outbox replays arbitrary table ops captured at the time of the failed
  // write, so the table name and payload are intentionally string/Record-typed.
  // PostgREST runtime still enforces the schema; the cast here only bypasses
  // compile-time narrowing on a deliberately generic adapter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  for (const item of items) {
    if (item.id == null) continue;
    try {
      if (item.op === "update") {
        if (!item.eqColumn) {
          await deleteOne(item.id);
          continue;
        }
        const { error } = await sb
          .from(item.table)
          .update(item.payload)
          .eq(item.eqColumn, item.eqValue ?? null);
        if (!error) {
          await deleteOne(item.id);
        }
        // On error, leave it for the next round.
      } else if (item.op === "insert") {
        const { error } = await sb.from(item.table).insert(item.payload);
        if (!error) {
          await deleteOne(item.id);
        }
      }
    } catch {
      // Leave for next round.
    }
  }
}

// Treats network errors and Supabase fetch failures as offline signals
// worth queuing. Anything that comes back with a Postgres error code
// (RLS / constraint / type mismatch) is permanent, not retriable.
export function isLikelyOffline(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!err) return false;
  const e = err as { message?: string; name?: string; code?: string };
  if (e.code) return false; // Supabase / Postgres error code → permanent.
  const msg = (e.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("offline") ||
    e.name === "TypeError"
  );
}
