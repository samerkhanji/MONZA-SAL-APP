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
