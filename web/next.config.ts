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

function plausibleOrigin(): string {
  const override = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim();
  if (!override) return "https://plausible.io";
  try {
    return new URL(override).origin;
  } catch {
    return "https://plausible.io";
  }
}

function supabaseOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "https://*.supabase.co";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

function buildContentSecurityPolicy(): string {
  const plausible = plausibleOrigin();
  const supabase = supabaseOrigin();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-inline' is allowed for script-src so the bootstrap inline
    // script in layout.tsx (theme init + AbortError swallow) keeps working.
    // Tightening to nonces/hashes is a follow-up; ship the baseline first.
    "script-src": [
      "'self'",
      "'unsafe-inline'",
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
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...extraAllowedDevOrigins(),
  ],
  outputFileTracingRoot: webRoot,
  turbopack: {
    root: webRoot,
  },
  productionBrowserSourceMaps: true,
  env: {
    NEXT_PUBLIC_RELEASE:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_RELEASE ?? "",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
