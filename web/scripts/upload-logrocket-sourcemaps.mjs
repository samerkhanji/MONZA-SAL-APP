#!/usr/bin/env node
// Upload Next.js client source maps to LogRocket so production stack
// traces in session-replay map back to readable lines.
//
// Why a wrapper script: the LogRocket CLI takes its API key as a flag
// or env var. We want to:
//   1. Skip silently if LOGROCKET_API_KEY isn't set (e.g. local builds,
//      previews on PRs without the env wired). Failing the build for
//      missing source-map upload would block normal day-to-day work.
//   2. Skip if .next/static/chunks doesn't exist (something earlier
//      broke; the build has bigger problems than missing source maps).
//   3. Pin the release to VERCEL_GIT_COMMIT_SHA so the upload tags
//      match what the SDK reports as the release.
//
// Run automatically as part of `npm run build` after `next build`.

import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const apiKey = process.env.LOGROCKET_API_KEY?.trim();
const release =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_RELEASE ||
  "";

if (!apiKey) {
  console.log(
    "[logrocket] LOGROCKET_API_KEY not set — skipping source-map upload."
  );
  process.exit(0);
}

if (!release) {
  console.log(
    "[logrocket] No VERCEL_GIT_COMMIT_SHA — skipping source-map upload (local build?)."
  );
  process.exit(0);
}

const chunksDir = path.resolve(process.cwd(), ".next/static/chunks");
if (!existsSync(chunksDir)) {
  console.warn(
    "[logrocket] .next/static/chunks not found — skipping source-map upload."
  );
  process.exit(0);
}

console.log(`[logrocket] Uploading source maps for release ${release.slice(0, 8)}...`);

// Use npx to avoid hard-pinning the binary location across npm versions.
const result = spawnSync(
  "npx",
  [
    "--no-install",
    "logrocket-cli",
    "upload",
    chunksDir,
    "--apikey",
    apiKey,
    "--release",
    release,
    "--urlPrefix",
    "/_next/static/chunks/",
  ],
  { stdio: "inherit", shell: true }
);

if (result.status !== 0) {
  console.warn(
    `[logrocket] Source-map upload exited with status ${result.status}; build continues.`
  );
  // Don't fail the build over a source-map upload error — debugging is
  // a nice-to-have, shipping is the primary goal.
  process.exit(0);
}

console.log("[logrocket] Source-map upload complete.");

// Delete the .map files so they aren't publicly served from the
// production deployment. LogRocket already has its copy; keeping them
// in /_next/static/chunks would expose readable client source via the
// CDN to anyone who guesses the chunk URLs.
let removed = 0;
function purgeMaps(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      purgeMaps(full);
    } else if (entry.endsWith(".map")) {
      try {
        unlinkSync(full);
        removed++;
      } catch {
        // best-effort cleanup
      }
    }
  }
}
purgeMaps(chunksDir);
console.log(`[logrocket] Stripped ${removed} .map file(s) from build output.`);
