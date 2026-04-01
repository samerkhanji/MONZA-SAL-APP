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
  turbopack: {
    root: webRoot,
  },
};

export default nextConfig;
