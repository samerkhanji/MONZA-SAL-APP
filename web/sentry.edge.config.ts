// Sentry Edge runtime initialization.
//
// Runs in route handlers / middleware deployed to the Vercel Edge runtime
// (V8 isolates, not Node). API surface is narrower than the Node SDK —
// notably no `denyUrls` since there is no browser URL context here.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection captured",
    /Extension context/,
    /chrome-extension/,
  ],
});
