"use client";

import { useEffect } from "react";

/**
 * Global keyboard shortcuts for the whole app.
 *
 * - **⌘K / Ctrl+K** focuses the first visible search input on the current
 *   page. Looks for inputs with `name="search"`, `placeholder` containing
 *   "Search" (case-insensitive), or `aria-label="search"`. Falls back to the
 *   first text input if nothing matches.
 *
 * Mounted once in the app layout. No state, no UI.
 */
export function GlobalKeyboardShortcuts() {
  useEffect(() => {
    function isVisible(el: HTMLElement): boolean {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const style = window.getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none";
    }

    function findSearchInput(): HTMLInputElement | null {
      const candidates = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')
      );
      const named = candidates.find(
        (i) =>
          isVisible(i) &&
          (i.name === "search" ||
            i.getAttribute("aria-label")?.toLowerCase() === "search" ||
            (i.placeholder ?? "").toLowerCase().includes("search"))
      );
      if (named) return named;
      return candidates.find((i) => isVisible(i)) ?? null;
    }

    function onKey(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isModK) return;

      // Don't hijack inside an input/textarea/contenteditable.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      const input = findSearchInput();
      if (input) {
        e.preventDefault();
        input.focus();
        input.select?.();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
