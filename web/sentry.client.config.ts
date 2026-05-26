// Sentry client-side initialization.
//
// Runs in the browser. If `NEXT_PUBLIC_SENTRY_DSN` is empty (e.g. local dev
// without a DSN configured) the Sentry SDK no-ops, so importing this file
// is always safe — the app still builds and runs without telemetry.
//
// Replay is enabled in error-only mode for privacy + free-tier quota
// reasons: we don't record session video continuously, only the buffer
// leading up to an error gets captured.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sample 10% of transactions for performance tracing — generous enough
  // to spot regressions, conservative enough to stay inside the free tier.
  tracesSampleRate: 0.1,
  // Don't record proactive replays. Only buffer + flush on error.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  // Noise filters — these are not actionable errors:
  // - ResizeObserver loop is a benign browser warning.
  // - "Non-Error promise rejection captured" usually means a string was
  //   thrown; we can't symbolicate or act on it.
  // - Extension context / chrome-extension errors come from user-installed
  //   browser extensions and are not our bug.
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection captured",
    /Extension context/,
    /chrome-extension/,
  ],
  // URL-level filtering for the same class of issue — drop anything that
  // originates from a browser extension before it counts against quota.
  denyUrls: [/extensions\//, /^chrome:\/\//, /^moz-extension:\/\//],
});
