// Sentry Node.js (server) initialization.
//
// Runs inside Next.js server-side request handlers, route handlers, server
// actions, and middleware running on the Node runtime. The DSN being empty
// makes the SDK a no-op, so dev/preview without Sentry env vars still works.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  // Same noise filters as the client config — these messages do show up
  // server-side occasionally when SSR mirrors a client error.
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection captured",
    /Extension context/,
    /chrome-extension/,
  ],
});
