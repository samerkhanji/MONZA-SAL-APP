"use client";

import { useEffect } from "react";
import { drainOutbox } from "@/lib/pwa/outbox";
import { drainSupabaseOutbox } from "@/lib/pwa/supabase-outbox";

// Mounts inside the authenticated dashboard layout. Watches for the tab
// coming back online or regaining visibility and replays both outboxes:
//   - REST outbox (web/src/lib/pwa/outbox.ts): fetch-based, also drained
//     by the service worker on `sync`.
//   - Supabase outbox (web/src/lib/pwa/supabase-outbox.ts): replayed
//     against the live Supabase client so RLS + auth are correct.
export function OutboxSyncInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    async function drainAll() {
      await drainOutbox();
      await drainSupabaseOutbox();
    }

    // One eager drain on mount in case there's anything left over from
    // the previous tab.
    void drainAll();

    function handleOnline() {
      void drainAll();
    }
    function handleVisible() {
      if (document.visibilityState === "visible") void drainAll();
    }
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, []);

  return null;
}
