"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcuts for the whole app.
 *
 * - **⌘K / Ctrl+K** focuses the first visible search input on the current
 *   page. Looks for inputs with `name="search"`, `placeholder` containing
 *   "Search" (case-insensitive), or `aria-label="search"`. Falls back to the
 *   first text input if nothing matches.
 * - **Alt+T** opens the full notifications view (`/notifications`). The
 *   listener calls `preventDefault()` *before* any browser default fires —
 *   without that intercept, Alt+T was triggering an `accessKey` collision
 *   somewhere in the third-party widgets (Sentry feedback's actor button is
 *   the prime suspect; it registers `accessKey="t"` on hosts that mount
 *   it). The collision detached a portal node and React next render saw a
 *   torn DOM, leaving the route blank until full reload. Owning the
 *   shortcut here forecloses that path.
 *
 * Mounted once in the app layout. No state, no UI.
 */
export function GlobalKeyboardShortcuts() {
  const router = useRouter();

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
      // Alt+T → open notifications. Checked first so the Cmd/Ctrl+K branch
      // can't short-circuit it. We don't gate this on the focused element:
      // accessKey defaults fire even inside inputs, so we must too if we
      // want to actually intercept them.
      const isAltT =
        e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "t";
      if (isAltT) {
        e.preventDefault();
        e.stopPropagation();
        router.push("/notifications");
        return;
      }

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

    // Capture phase so we run before any element-level accessKey handler in
    // the bubble phase. preventDefault() at this point stops the browser's
    // default access-key activation from firing at all.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [router]);

  return null;
}
