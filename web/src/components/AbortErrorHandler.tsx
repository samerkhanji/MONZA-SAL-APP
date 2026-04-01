"use client";

import { useEffect } from "react";

function isAbortError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object") {
    const name = (err as { name?: string }).name;
    const message = (err as { message?: string }).message;
    if (name === "AbortError") return true;
    if (message && String(message).toLowerCase().includes("aborted")) return true;
  }
  return false;
}

/**
 * Silently catch AbortError from cancelled fetches, Supabase auth locks (navigator.locks),
 * navigation, unmount, and prefetch. Prevents "signal is aborted without reason" from
 * surfacing as a runtime error.
 */
export function AbortErrorHandler() {
  useEffect(() => {
    function handleRejection(event: PromiseRejectionEvent) {
      if (isAbortError(event.reason)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener("unhandledrejection", handleRejection, true);
    return () => window.removeEventListener("unhandledrejection", handleRejection, true);
  }, []);
  return null;
}
