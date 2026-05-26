"use client";

import { useEffect } from "react";

// Reflects an unread count onto the installed PWA's app icon using the
// Badging API (Chrome / Edge / installed desktop PWAs; Safari ignores).
// Feature-detected — quietly no-ops where unsupported.
//
// Pass 0 (or a falsy number) to clear the badge.
export function useAppBadge(count: number | null | undefined): void {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!("setAppBadge" in nav)) return;
    const n = typeof count === "number" && count > 0 ? count : 0;
    try {
      if (n > 0) {
        void nav.setAppBadge?.(n);
      } else {
        void nav.clearAppBadge?.();
      }
    } catch {
      // Permission or platform errors — nothing to do.
    }
  }, [count]);
}
