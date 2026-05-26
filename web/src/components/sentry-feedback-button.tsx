"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Mounts the Sentry user feedback widget — a small "Report a problem"
 * button that opens a form. Submissions automatically include:
 *
 *  - The current Sentry user (set in `LogRocketInit.tsx` after sign-in)
 *  - The buffered session replay leading up to the report
 *  - The last few seconds of breadcrumbs (clicks, route changes, console)
 *  - The user-typed email + name + free-text description
 *
 * This component only does anything when:
 *
 *  1. The Sentry SDK successfully initialized — which requires
 *     `NEXT_PUBLIC_SENTRY_DSN` to be set. In local dev without a DSN
 *     the integration is registered but inert; `getFeedback()` returns
 *     `undefined`, so no DOM element is ever appended.
 *
 *  2. It's rendered. We intentionally do NOT mount this in the root
 *     layout — only in `(dashboard)/layout.tsx`, so anonymous visitors
 *     on `/login` never see a bug-report button.
 *
 * The widget's button is repositioned to the BOTTOM-LEFT corner. The
 * bottom-right is crowded already: FloatingScanButton, AIChatWidget,
 * and TourLauncher all live there.
 */
export function SentryFeedbackButton(): null {
  useEffect(() => {
    const feedback = Sentry.getFeedback();
    // No client / no DSN / integration not registered → don't render.
    if (!feedback) return;

    const widget = feedback.createWidget();

    // Reposition the actor button to the BOTTOM-LEFT corner.
    //
    // The widget renders inside a shadow DOM whose default
    // `--inset` CSS variable is `auto 0 0 auto` (bottom-right). The
    // actor button (`widget.el`) reads `inset: var(--actor-inset)` →
    // `var(--inset)`. Because custom properties are resolved at use
    // time against the cascade, setting `--inset` directly on the
    // actor button takes precedence over the `:host` default.
    //
    // We set it on `widget.el` (not via a document query) so we don't
    // accidentally style some stale host left behind by an earlier
    // mount/unmount cycle.
    try {
      widget.el.style.setProperty("--inset", "auto auto 0 0");
    } catch {
      // If a CSP nonce or browser quirk blocks the inline style, fall
      // back gracefully — the widget still works in its default spot.
    }

    return () => {
      widget.removeFromDom();
    };
  }, []);

  return null;
}
