"use client";

import { useEffect, useState } from "react";

/**
 * When dev is opened via a raw IP (common with WSL “Network: http://172.x.x.x:3000”),
 * Next uses that host for HMR WebSockets — often fails with ERR_INVALID_HTTP_RESPONSE.
 * Prompt to use localhost on the same machine.
 */
export function DevHostBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const h = window.location.hostname;
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(h);
    if (isIPv4 && h !== "127.0.0.1") setOpen(true);
  }, []);

  if (!open) return null;

  const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
  const localhostUrl = `${window.location.protocol}//localhost:${port}${window.location.pathname}${window.location.search}${window.location.hash}`;

  return (
    <div
      role="status"
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-amber-500/80 bg-amber-950/95 px-3 py-2 text-center text-sm text-amber-100 shadow-lg"
    >
      <strong className="text-amber-50">Dev mode:</strong> You opened this app via{" "}
      <code className="rounded bg-black/30 px-1">{window.location.hostname}</code>. Hot reload
      WebSockets often fail on that address (WSL/Docker).{" "}
      <a
        href={localhostUrl}
        className="font-semibold text-amber-300 underline underline-offset-2 hover:text-white"
      >
        Open via localhost instead
      </a>
      .
    </div>
  );
}
