"use client";

import { useState, useEffect } from "react";
import { Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallButton } from "./InstallButton";
import { useInstall } from "@/lib/contexts/InstallContext";
import { setInstallDismissed } from "./InstallButton";

export function InstallBanner() {
  const { showInstallOption } = useInstall();
  const [dismissed, setDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("monza-install-dismissed") === "true";
    setDismissed(stored);
    setMounted(true);
  }, []);

  function handleDismiss() {
    setInstallDismissed();
    setDismissed(true);
  }

  const show = mounted && showInstallOption && !dismissed;

  if (!show) return null;

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Smartphone className="size-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">Install Monza S.A.L.</h3>
          <p className="text-sm text-muted-foreground">
            Get quick access from your home screen.
          </p>
          <InstallButton variant="default" size="sm" className="mt-2" />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
