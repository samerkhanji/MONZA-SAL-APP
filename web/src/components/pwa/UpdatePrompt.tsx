"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    function onControllerChange() {
      setUpdateAvailable(true);
    }

    function onUpdateFound() {
      const worker = registration?.waiting;
      if (worker) worker.postMessage({ type: "SKIP_WAITING" });
    }

    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;
      reg.addEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });

    const checkInterval = setInterval(() => {
      registration?.update?.();
    }, 60 * 60 * 1000);

    return () => {
      clearInterval(checkInterval);
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  function handleRefresh() {
    window.location.reload();
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border bg-card p-4 shadow-lg sm:left-auto sm:right-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Update available</p>
          <p className="text-sm text-muted-foreground">
            A new version is ready. Refresh to get the latest.
          </p>
        </div>
        <Button size="sm" onClick={handleRefresh}>
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
