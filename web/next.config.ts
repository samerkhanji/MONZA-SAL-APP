import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  // Next.js 16 expects bare hostnames here, not full URLs — otherwise HMR WebSocket gets
  // blocked and floods the console with `ws://.../webpack-hmr handshake failed` errors.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
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

export default nextConfig;
