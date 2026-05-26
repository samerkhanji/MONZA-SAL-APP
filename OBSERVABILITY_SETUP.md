# Observability & Security Setup

This document covers three independent integrations that ship in the Monza
web app and **no-op silently when their env vars are unset** — so previews
and local dev still build/run fine without any of these accounts created.

For Sentry-specific setup see [SENTRY_SETUP.md](./SENTRY_SETUP.md). This
file covers the three integrations added alongside it:

1. Security headers (`web/next.config.ts`) — always on, no env vars.
2. Plausible analytics (privacy-friendly page analytics).
3. Resend transactional email (`web/src/lib/email/resend.ts`).

## 1. Security headers

Every route served by `web/` returns this set of HTTP response headers
(configured in `web/next.config.ts` via Next.js `headers()`):

| Header                          | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `Content-Security-Policy`       | Restrict origins for scripts, images, etc.      |
| `Strict-Transport-Security`     | Force HTTPS for 2 years (`includeSubDomains`).  |
| `X-Content-Type-Options`        | `nosniff` — block MIME type guessing.            |
| `Referrer-Policy`               | `strict-origin-when-cross-origin`.              |
| `Permissions-Policy`            | Allow rear camera (VIN scanner); deny mic/geo.  |
| `X-Frame-Options`               | `SAMEORIGIN` — legacy clickjacking defense.     |

The CSP allowlist is derived at build time from the deploy's env vars so
the same config works locally and on Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` — included in `connect-src` (HTTPS and WSS).
- `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` — origin included in `script-src` and
  `connect-src`. Defaults to `https://plausible.io`.
- Sentry envelope tunnel (`/monitoring`) is same-origin so it's covered
  by `'self'`. The `*.ingest.sentry.io` family is also allowed directly
  in `connect-src` so the SDK can still fall back without the tunnel.
- LogRocket ingest/CDN origins are allowed in `script-src` + `connect-src`.
- Vercel Speed Insights (`https://va.vercel-scripts.com`,
  `https://vitals.vercel-insights.com`) are allowed.

No env vars are required to enable security headers — they're always on.

### Known follow-up: inline scripts

The bootstrap inline script in `web/src/app/layout.tsx` (theme + AbortError
swallow) is currently incompatible with the strict `script-src` directive
(`'unsafe-inline'` is intentionally omitted). Before this CSP can ship
strictly enforcing, that script must be either:

- moved to an external `/public/*.js` file, or
- wrapped with a CSP nonce via Next's middleware, or
- removed in favor of a CSS-only initial-theme strategy.

Until then, expect the inline block to be blocked by the browser. Easiest
short-term path is the external file approach.

## 2. Plausible analytics

[Plausible](https://plausible.io) is a privacy-friendly, cookieless web
analytics product. The script loads via `next/script` with
`strategy="afterInteractive"` so it never blocks LCP, and **only renders
when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set** — no env var, no script tag,
no third-party network requests.

### Sign up

1. Create an account at <https://plausible.io/register>.
2. Add your site (e.g. `monzasal.vercel.app`) — Plausible will hand you a
   `data-domain` value identical to the site name.

### Env vars on Vercel

| Variable                          | Required | Default                                 | Sensitive? |
| --------------------------------- | -------- | --------------------------------------- | ---------- |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`    | Yes      | _none — analytics off when unset_       | No (public)|
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL`| No       | `https://plausible.io/js/script.js`     | No (public)|

Set `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` if you self-host Plausible — point
it at your own `script.js` and the CSP will adapt automatically (the
script's origin is parsed at build time and added to `script-src` +
`connect-src`).

### Verify it works

1. Deploy with `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` set.
2. Visit any page and open the Network tab — you should see a request to
   `plausible.io/js/script.js` (or your override) followed by a POST to
   `/api/event` on the same origin.
3. In the Plausible dashboard, the page view appears within ~30 seconds.

## 3. Resend transactional email

[Resend](https://resend.com) is a developer-friendly transactional email
API. We expose a single thin helper at `web/src/lib/email/resend.ts`:

```ts
import { sendTransactionalEmail } from "@/lib/email/resend";

await sendTransactionalEmail({
  to: "user@example.com",
  subject: "Welcome to Monza",
  html: "<p>Hello…</p>",
});
```

When `RESEND_API_KEY` is missing, the call **returns `{ skipped: true }`
and logs a warning instead of throwing**, so calling sites can opportunistically
send email without needing the integration to be configured.

This helper is not wired into any production code path yet — the existing
password-reset route uses a hand-rolled `fetch` call to the Resend HTTP
API and will be migrated to the SDK helper in a follow-up PR.

### Sign up

1. Create an account at <https://resend.com/signup>.
2. Verify a sending domain (e.g. `monzasal.com`) — until then you can use
   `onboarding@resend.dev` as the `from` address for testing.
3. Create an API key with `Sending access` only.

### Env vars on Vercel

| Variable             | Required | Default                            | Sensitive? |
| -------------------- | -------- | ---------------------------------- | ---------- |
| `RESEND_API_KEY`     | Yes      | _none — sends are no-ops when unset_| **Yes**   |
| `RESEND_FROM_EMAIL`  | No       | `Monza <noreply@monzasal.com>`     | No         |

Mark `RESEND_API_KEY` as **Sensitive** in the Vercel UI so it's not
exposed in build logs or readable from the dashboard after creation.

### Verify it works

1. Set `RESEND_API_KEY` and (optionally) `RESEND_FROM_EMAIL` on a preview
   deploy.
2. From any Server Action / API route, call `sendTransactionalEmail({...})`
   with a real recipient — check the Resend dashboard for the message.
3. Without an API key set, the same call returns `{ skipped: true, reason: "missing-api-key" }` and logs `[email/resend] RESEND_API_KEY is not set — skipping outbound email.` to the server console.
