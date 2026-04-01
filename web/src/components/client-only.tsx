"use client";

import { useState, useEffect } from "react";

/**
 * Renders children only after mount. Fixes Radix UI hydration mismatches
 * (aria-controls, id) between server and client.
 */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  return <>{children}</>;
}
