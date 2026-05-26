import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

// Always anchor Turbopack to this app folder (not C:\Users\User or repo parent).
const webRoot = path.dirname(fileURLToPath(import.meta.url));

/** Extra dev origins (comma-separated), e.g. WSL/LAN URL — avoids hardcoding IPs that change. */
function extraAllowedDevOrigins(): string[] {
  const raw = process.env.NEXT_DEV_ALLOWED_ORIGINS;
  if (!raw?.trim()) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Derive the Plausible script origin from the override URL (self-hosted) or
 * fall back to plausible.io cloud. Used in CSP allowlists so the analytics
 * script can load + report when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set.
 */
function plausibleOrigin(): string {
  const override = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim();
  if (!override) return "https://plausible.io";
  try {
    return new URL(override).origin;
  } catch {
    return "https://plausible.io";
  }
}

/**
 * Pull the Supabase project origin from `NEXT_PUBLIC_SUPABASE_URL` so the CSP
 * connect-src allowlist matches whichever project this deploy points at.
 * Falls back to a wildcard supabase.co host so previews without the env var
 * set still work (no-op CSP rather than blocking the whole app).
 */
function supabaseOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "https://*.supabase.co";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

/**
 * Content-Security-Policy directive list. Built at config-load time (module
 * scope) so the same string can be reused for every route via `headers()`.
 *
 * Notes on each non-obvious entry:
 * - script-src: 'unsafe-inline' is intentionally NOT allowed. The bootstrap
 *   inline script in layout.tsx (theme + AbortError handler) is tiny and
 *   would require either a hash or nonce; for now we keep the file under
 *   layout's existing `dangerouslySetInnerHTML` and accept that a future
 *   tightening pass will move it to an external file or add a nonce.
 * - style-src: 'unsafe-inline' IS allowed — shadcn/Tailwind inject inline
 *   styles at runtime and there is no production-safe way to hash them.
 * - connect-src: includes Sentry envelope tunnel (/monitoring is same-origin
 *   so it's covered by 'self'), Plausible, Supabase, LogRocket, and Vercel
 *   Speed Insights.
 * - frame-ancestors 'self' — superset of legacy X-Frame-Options SAMEORIGIN.
 */
function buildContentSecurityPolicy(): string {
  const plausible = plausibleOrigin();
  const supabase = supabaseOrigin();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-inline' deliberately omitted per the spec for this baseline.
    // The bootstrap inline script in layout.tsx will need to be moved to an
    // external file or wrapped with a CSP nonce in a follow-up; tracking
    // that in the docs/OBSERVABILITY_SETUP guide.
    "script-src": [
      "'self'",
      plausible,
      "https://cdn.lr-ingest.com",
      "https://cdn.logrocket.io",
      "https://cdn.lr-in.com",
      "https://va.vercel-scripts.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabase, "https:"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      plausible,
      supabase,
      // Supabase realtime uses wss:// on the same origin.
      supabase.replace(/^https:/, "wss:"),
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://*.ingest.de.sentry.io",
      "https://*.lr-ingest.com",
      "https://*.lr-in.com",
      "https://*.logrocket.io",
      "https://vitals.vercel-insights.com",
      "https://vitals.vercel-analytics.com",
    ],
    "frame-ancestors": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

const CSP = buildContentSecurityPolicy();

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // VIN scanner uses the rear camera; mic + geo are not needed anywhere.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  // Legacy belt-and-suspenders alongside frame-ancestors in the CSP. Modern
  // browsers honor frame-ancestors; older ones (and some embedded webviews)
  // still rely on this header.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  // Cross-origin dev requests (e.g. phone on LAN). Prefer http://localhost:3000 for HMR stability.
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...extraAllowedDevOrigins(),
  ],
  // Must match turbopack.root or Next warns (and tracing can mis-resolve in monorepos).
  outputFileTracingRoot: webRoot,
  turbopack: {
    root: webRoot,
  },
  // Generate source maps for the production browser bundle so LogRocket
  // can map session-replay stack traces back to readable lines. The
  // postbuild script (scripts/upload-logrocket-sourcemaps.mjs) uploads
  // the .map files to LogRocket and then strips them from .next/ so
  // they aren't served publicly via the CDN.
  productionBrowserSourceMaps: true,
  // Expose the Vercel commit SHA + ref to the client bundle as
  // NEXT_PUBLIC_RELEASE so LogRocket / Speed Insights can tag sessions
  // with the exact build that produced them.
  env: {
    NEXT_PUBLIC_RELEASE:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_RELEASE ?? "",
  },
  async headers() {
    return [
      {
        // Apply the same security headers to every route — there's no public
        // sub-tree that needs a relaxed policy.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

// Wrap with Sentry config. When SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT
// are unset (e.g. local dev) the Sentry webpack plugin skips source-map upload
// and the build still succeeds — combined with an empty DSN this makes the
// whole integration a no-op until ops sets the env vars on Vercel.
export default withSentryConfig(nextConfig, {
  // Suppress noisy Sentry CLI logs in CI output.
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Upload source maps for client routes that import from outside `app/`.
  widenClientFileUpload: true,
  // Proxy Sentry envelope requests through this app's origin so ad-blockers
  // that hard-block `sentry.io` don't drop error reports from real users.
  tunnelRoute: "/monitoring",
});
