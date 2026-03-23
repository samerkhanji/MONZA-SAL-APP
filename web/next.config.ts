import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Always anchor Turbopack to this app folder (not C:\Users\User or repo parent).
const webRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // LAN / phone access in dev (suppresses cross-origin warnings when not using localhost)
  allowedDevOrigins: [
    "http://172.20.64.1:3000",
    "http://172.20.64.1:3001",
  ],
  turbopack: {
    root: webRoot,
  },
};

export default nextConfig;
