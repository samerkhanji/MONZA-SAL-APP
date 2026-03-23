"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  clearAuthSessionMarkers,
  hasAuthSessionUnlocked,
  IDLE_TIMEOUT_MS,
  markAuthSessionUnlocked,
  readLastActivity,
  updateLastActivity,
} from "@/lib/auth-session";

export function SessionEnforcer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const logoutInProgress = useRef(false);
  const lastActiveRef = useRef<number>(0);
  const hiddenAtRef = useRef<number | null>(null);

  const forceLogout = async (reason: "reauth" | "inactive") => {
    if (logoutInProgress.current) return;
    logoutInProgress.current = true;
    clearAuthSessionMarkers();
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore sign-out errors and still force redirect.
    }
    window.location.href = `/?reason=${reason}`;
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      let unlocked = hasAuthSessionUnlocked();
      let lastActivity = readLastActivity();

      // sessionStorage is per-tab: a new tab can have Supabase cookies/session but no
      // "unlocked" marker. Sync marker from an existing session instead of signing out.
      if (!unlocked || !lastActivity) {
        const supabase = createClient();
        let session = null as Awaited<
          ReturnType<typeof supabase.auth.getSession>
        >["data"]["session"];
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data } = await supabase.auth.getSession();
          session = data.session;
          if (session) break;
          await new Promise((r) => setTimeout(r, 120));
        }
        if (session) {
          markAuthSessionUnlocked();
          unlocked = true;
          lastActivity = readLastActivity();
        }
      }

      if (!unlocked || !lastActivity) {
        await forceLogout("reauth");
        return;
      }

      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
        await forceLogout("inactive");
        return;
      }

      const now = Date.now();
      lastActiveRef.current = now;
      updateLastActivity(now);

      if (!cancelled) {
        setReady(true);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const markActivity = () => {
      const now = Date.now();
      lastActiveRef.current = now;
      updateLastActivity(now);
    };

    const checkIdleTimeout = () => {
      if (Date.now() - lastActiveRef.current > IDLE_TIMEOUT_MS) {
        void forceLogout("inactive");
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }

      if (
        hiddenAtRef.current &&
        Date.now() - hiddenAtRef.current > IDLE_TIMEOUT_MS
      ) {
        void forceLogout("inactive");
        return;
      }

      hiddenAtRef.current = null;
      markActivity();
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
      "focus",
    ];

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, markActivity)
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(checkIdleTimeout, 30000);

    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, markActivity)
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Checking session...</div>
      </div>
    );
  }

  return <>{children}</>;
}
