"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SEEN_KEY = "monza:ios-install-tooltip-seen";

function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((navigator as { standalone?: boolean }).standalone) return true;
  return false;
}

export function IOSInstallTooltip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOSSafari()) return;
    if (isStandalone()) return;
    if (localStorage.getItem(SEEN_KEY) === "1") return;
    // Small delay so it doesn't pop in during initial paint.
    const t = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-lg border border-border bg-popover text-popover-foreground shadow-lg md:bottom-6 md:right-6 md:left-auto md:inset-x-auto md:w-80"
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Share className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install Monza on your iPhone</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tap <Share className="inline size-3" /> Share, then &quot;Add to
            Home Screen&quot;.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-1 -mt-1 size-7 shrink-0"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
