/**
 * Reads web/.env.local and runs `vercel env add` for Production, Preview (*), and Development.
 * Preview requires a linked Git repo on the Vercel project; if you see "does not have a connected
 * Git repository", connect Git in Vercel or add Preview env vars in the dashboard.
 * Sensitive keys (SUPABASE_SERVICE_ROLE_KEY) are not added to Development (Vercel restriction).
 * Usage: node scripts/push-vercel-env.mjs   (from web/)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const envPath = path.join(webRoot, ".env.local");

if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local in web/");
  process.exit(1);
}

const raw = fs.readFileSync(envPath, "utf8");
const entries = [];
for (const line of raw.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  const key = t.slice(0, i).trim();
  let val = t.slice(i + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (key && val) entries.push({ key, val });
}

/** Preview needs a git branch; * applies to all preview deployments. */
const PREVIEW_BRANCH = "*";

function runAdd(key, env, gitBranch, val, sensitive) {
  const args = ["-y", "vercel@latest", "env", "add", key, env];
  if (gitBranch) args.push(gitBranch);
  if (sensitive) args.push("--sensitive");
  args.push("--value", val, "--force", "--yes");
  return spawnSync("npx", args, {
    cwd: webRoot,
    encoding: "utf8",
    shell: true,
  });
}

for (const { key, val } of entries) {
  const sensitive = key === "SUPABASE_SERVICE_ROLE_KEY";
  const label = (env, extra = "") => `${key} [${env}${extra}]`;

  let r = runAdd(key, "production", null, val, sensitive);
  console.log(`${label("production")}: ${r.status === 0 ? "ok" : "fail"}`);
  if (r.status !== 0) {
    if (r.stderr) console.error(r.stderr.trim());
    if (r.stdout) console.error(r.stdout.trim());
  }

  r = runAdd(key, "preview", PREVIEW_BRANCH, val, sensitive);
  console.log(`${label("preview", " *")}: ${r.status === 0 ? "ok" : "fail"}`);
  if (r.status !== 0) {
    if (r.stderr) console.error(r.stderr.trim());
    if (r.stdout) console.error(r.stdout.trim());
  }

  if (!sensitive) {
    r = runAdd(key, "development", null, val, false);
    console.log(`${label("development")}: ${r.status === 0 ? "ok" : "fail"}`);
    if (r.status !== 0) {
      if (r.stderr) console.error(r.stderr.trim());
      if (r.stdout) console.error(r.stdout.trim());
    }
  }
}

console.log("Done.");
