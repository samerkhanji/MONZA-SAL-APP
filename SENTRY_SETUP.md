# Sentry Setup

This repo is wired to report client / server / edge errors to [Sentry](https://sentry.io)
using the free tier. The SDK is integrated via `@sentry/nextjs` in `web/` and **no-ops
silently when the env vars below are unset** — so dev and preview builds still work
fine without a Sentry account.

To turn it on in production:

## 1. Create a free Sentry account

Sign up at <https://sentry.io/signup/> and create:

- An **organization** (the URL slug — e.g. `monza-sal`).
- A **project** of type **Next.js** (the URL slug — e.g. `monza-web`).
- An **internal integration auth token** with the `project:releases` and
  `org:read` scopes — used at build time to upload source maps.

Sentry will hand you a **DSN** that looks like
`https://<key>@o<orgId>.ingest.sentry.io/<projectId>`.

## 2. Set 4 environment variables on Vercel

Add these to the Vercel project (Settings -> Environment Variables, all environments):

| Variable                  | Where it comes from                 | Sensitive? |
| ------------------------- | ----------------------------------- | ---------- |
| `NEXT_PUBLIC_SENTRY_DSN`  | The DSN from step 1                 | No (public) |
| `SENTRY_AUTH_TOKEN`       | Internal integration token (step 1) | Yes        |
| `SENTRY_ORG`              | Your org slug                       | No         |
| `SENTRY_PROJECT`          | Your project slug                   | No         |

`SENTRY_AUTH_TOKEN` is only needed at build time so the webpack plugin can
upload source maps; it is never bundled into the client.

## 3. Verify it works

1. Deploy. The build log should show source-map upload from the Sentry CLI
   (silenced by default; you can flip `silent: false` in `web/next.config.ts`
   temporarily if you need to debug it).
2. Log in as any user, then in DevTools console run:

   ```js
   throw new Error("sentry-smoke-test");
   ```

3. Within ~60 seconds the error should appear in the Sentry project's
   **Issues** tab, tagged with the deployed commit SHA (release) and the
   logged-in user's id + role.

If nothing shows up, check:

- Browser network tab — envelope requests go to `/monitoring` (the tunnel
  route) which then forwards to Sentry. If `/monitoring` 404s, the
  `withSentryConfig` wrapping in `web/next.config.ts` didn't take effect.
- Vercel environment — `NEXT_PUBLIC_SENTRY_DSN` must be set on the
  environment the build was deployed to (Production / Preview).

## Privacy notes

- Replay is **error-only** (`replaysSessionSampleRate: 0`,
  `replaysOnErrorSampleRate: 1.0`) — we don't continuously record sessions.
- Trace sample rate is 10% (`tracesSampleRate: 0.1`) — conservative for the
  free tier quota.
- User tagging includes id + role + email. Email is included because all
  app users are employees on real corporate emails which the app already
  surfaces in-product. No phone, no full name.
- Common noise (`ResizeObserver loop`, browser-extension errors, etc.) is
  filtered client-side before it counts against quota — see `ignoreErrors`
  / `denyUrls` in `web/sentry.client.config.ts`.
