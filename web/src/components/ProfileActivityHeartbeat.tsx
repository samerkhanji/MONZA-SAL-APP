"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/lib/contexts/UserContext";

const INTERVAL_MS = 60_000;

/** Throttled POST to /api/profile/heartbeat while the user is in the dashboard. */
export function ProfileActivityHeartbeat() {
  const { profile, loading } = useUser();
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (loading || !profile) return;

    const ping = () => {
      const now = Date.now();
      if (now - lastSentRef.current < INTERVAL_MS) return;
      lastSentRef.current = now;
      void fetch("/api/profile/heartbeat", { method: "POST" }).catch(() => {});
    };

    ping();
    const id = window.setInterval(ping, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [loading, profile?.id]);

  return null;
}
