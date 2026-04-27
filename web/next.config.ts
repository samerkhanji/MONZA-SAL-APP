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
  // Expose the Vercel commit SHA + ref to the client bundle as
  // NEXT_PUBLIC_RELEASE so LogRocket / Speed Insights can tag sessions
  // with the exact build that produced them.
  env: {
    NEXT_PUBLIC_RELEASE:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_RELEASE ?? "",
  },
};

export default nextConfig;
