"use client";

import { useEffect } from "react";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        reg.update();
      });
    }
  }, []);

  return <UpdatePrompt />;
}
