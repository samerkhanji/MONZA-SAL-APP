"use client";

import dynamic from "next/dynamic";

// Sonner ships its CSS + JS together; lazy-loading it through this thin
// client boundary keeps the toast bundle off the LCP critical path while
// still letting Server Component layouts render <ThemeToasterLazy /> the
// same way they would the original. The toaster mounts after first paint;
// any toast fired in that window is queued and shown once it's ready.
export const ThemeToasterLazy = dynamic(
  () => import("./theme-toaster").then((m) => m.ThemeToaster),
  { ssr: false }
);
