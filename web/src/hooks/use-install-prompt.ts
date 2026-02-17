"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "chrome" | "safari" | "ios" | "other";

function detectPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream) {
    return "ios";
  }
  if (/Chrome|Chromium|Edg/.test(ua) && !/Safari/.test(ua)) return "chrome";
  if (/Safari/.test(ua) && !/Chrome|Chromium/.test(ua)) return "safari";
  return "other";
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("other");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already installed (standalone PWA)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Also check for iOS standalone
    if ((navigator as { standalone?: boolean }).standalone) {
      setIsInstalled(true);
      return;
    }

    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && !(window as unknown as { MSStream?: boolean }).MSStream) {
      setIsIOS(true);
    }
    setPlatform(detectPlatform());

    // Listen for install prompt (Chrome/Android/Edge/Samsung - only fires on HTTPS)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const canInstallNative = !isInstalled && !!deferredPrompt;
  const showInstallOption = !isInstalled;

  return {
    deferredPrompt,
    isInstalled,
    isIOS,
    platform,
    install,
    canInstallNative,
    showInstallOption,
  };
}
