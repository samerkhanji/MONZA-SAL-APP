// Daily health briefing for MONZA-SAL-APP.
// Gathers GitHub activity, Vercel deployment health, and Supabase status/advisors
// for the last 24h and opens a "Daily Briefing" issue with the summary.
//
// Required env: GITHUB_TOKEN, GITHUB_REPOSITORY (provided by Actions).
// Optional env (sections degrade gracefully when missing):
//   VERCEL_TOKEN              — Vercel API token
//   SUPABASE_ACCESS_TOKEN     — Supabase management API token (sbp_...)
//   VERCEL_PROJECT_ID, VERCEL_TEAM_ID, SUPABASE_PROJECT_REF — override defaults below.

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || "prj_1N8O8oetkqRuJwLyxjhTCbm5YOXe";
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || "team_or1BAFALX19O5vgAkq2CBmak";
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "okxpsvukzjjubinhamek";

const [owner, repo] = (process.env.GITHUB_REPOSITORY || "samerkhanji/MONZA-SAL-APP").split("/");
const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
const sinceIso = new Date(sinceMs).toISOString();
const today = new Date().toISOString().slice(0, 10);

async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

const gh = (path) =>
  getJson(`https://api.github.com${path}`, {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
  });

async function githubSection() {
  const lines = [];
  const commits = await gh(`/repos/${owner}/${repo}/commits?since=${sinceIso}&per_page=100`);
  lines.push(`- **Commits to main (24h):** ${commits.length}`);
  for (const c of commits.slice(0, 15)) {
    const title = c.commit.message.split("\n")[0];
    const author = c.author?.login || c.commit.author?.name || "unknown";
    lines.push(`  - [\`${c.sha.slice(0, 7)}\`](${c.html_url}) ${title} — _${author}_`);
  }
  if (commits.length > 15) lines.push(`  - …and ${commits.length - 15} more`);

  const externalAuthors = [...new Set(
    commits.map((c) => c.author?.login || c.commit.author?.name).filter((a) => a && !["samerkhanji", "claude", "web-flow"].includes(a.toLowerCase()))
  )];
  lines.push(
    externalAuthors.length
      ? `- ⚠️ **Commits from unexpected authors:** ${externalAuthors.join(", ")} — review these!`
      : `- ✅ No commits from unexpected authors.`
  );

  const prs = await gh(`/repos/${owner}/${repo}/pulls?state=open&per_page=50`);
  lines.push(`- **Open PRs:** ${prs.length}`);
  for (const p of prs.slice(0, 10)) lines.push(`  - [#${p.number}](${p.html_url}) ${p.title} — _${p.user.login}_`);

  const issues = await gh(`/repos/${owner}/${repo}/issues?state=open&since=${sinceIso}&per_page=50`);
  const fresh = issues.filter((i) => !i.pull_request && !i.title.startsWith("Daily Briefing") && new Date(i.updated_at) >= new Date(sinceIso));
  lines.push(`- **Issues updated in last 24h:** ${fresh.length}`);
  for (const i of fresh.slice(0, 10)) lines.push(`  - [#${i.number}](${i.html_url}) ${i.title}`);
  return lines.join("\n");
}

async function vercelSection() {
  if (!process.env.VERCEL_TOKEN) return "_Skipped — add a `VERCEL_TOKEN` repo secret to enable deployment checks._";
  const headers = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
  const lines = [];
  const d = await getJson(
    `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&since=${sinceMs}&limit=100`,
    headers
  );
  const deployments = d.deployments || [];
  const failed = deployments.filter((x) => ["ERROR", "CANCELED"].includes(x.state));
  const prod = deployments.filter((x) => x.target === "production");
  lines.push(`- **Deployments (24h):** ${deployments.length} total, ${prod.length} to production.`);
  lines.push(
    failed.length
      ? `- 🔴 **Failed/canceled builds:** ${failed.map((f) => `[${f.state}](https://${f.url}) (${f.meta?.githubCommitMessage?.split("\n")[0] || f.uid})`).join("; ")}`
      : `- ✅ All builds succeeded.`
  );
  if (prod[0]) lines.push(`- **Current production deploy:** ${prod[0].meta?.githubCommitMessage?.split("\n")[0] || prod[0].url} (${prod[0].state})`);
  try {
    const logsRes = await fetch(
      `https://api.vercel.com/v1/projects/${VERCEL_PROJECT_ID}/runtime-logs?teamId=${VERCEL_TEAM_ID}&level=error&since=${sinceIso}`,
      { headers }
    );
    if (logsRes.ok) {
      const text = await logsRes.text();
      const errorLines = text.split("\n").filter(Boolean);
      lines.push(
        errorLines.length
          ? `- 🔴 **Runtime errors (24h):** ${errorLines.length} — check the Vercel dashboard.`
          : `- ✅ No production runtime errors.`
      );
    } else {
      lines.push(`- ℹ️ Runtime-log check unavailable (${logsRes.status}); review logs in the Vercel dashboard.`);
    }
  } catch (e) {
    lines.push(`- ℹ️ Runtime-log check failed: ${e.message}`);
  }
  return lines.join("\n");
}

async function supabaseSection() {
  if (!process.env.SUPABASE_ACCESS_TOKEN) return "_Skipped — add a `SUPABASE_ACCESS_TOKEN` repo secret to enable database checks._";
  const headers = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` };
  const lines = [];
  try {
    const health = await getJson(
      `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/health?services=auth,db,rest,storage,realtime`,
      headers
    );
    const unhealthy = health.filter((s) => s.status !== "ACTIVE_HEALTHY");
    lines.push(
      unhealthy.length
        ? `- 🔴 **Unhealthy services:** ${unhealthy.map((s) => `${s.name} (${s.status})`).join(", ")}`
        : `- ✅ All services healthy (auth, db, rest, storage, realtime).`
    );
  } catch (e) {
    lines.push(`- ℹ️ Health check failed: ${e.message}`);
  }
  try {
    const lints = await getJson(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/advisors/security`, headers);
    const items = lints.lints || lints || [];
    const errors = items.filter((l) => l.level === "ERROR");
    const warns = items.filter((l) => l.level === "WARN");
    lines.push(
      errors.length
        ? `- 🔴 **Security advisor ERRORS:** ${errors.map((l) => l.name).join(", ")}`
        : `- ✅ No security advisor errors (${warns.length} known warnings).`
    );
  } catch (e) {
    lines.push(`- ℹ️ Security advisor check failed: ${e.message}`);
  }
  return lines.join("\n");
}

async function section(name, fn) {
  try {
    return await fn();
  } catch (e) {
    return `_Section failed: ${e.message}_`;
  }
}

const body = [
  `Automated daily health briefing for **${owner}/${repo}** — ${today} 07:00 UTC (10:00 Beirut).`,
  ``,
  `## 🐙 GitHub activity (last 24h)`,
  await section("github", githubSection),
  ``,
  `## ▲ Vercel (monzasal)`,
  await section("vercel", vercelSection),
  ``,
  `## ⚡ Supabase (Monza SAL APP)`,
  await section("supabase", supabaseSection),
  ``,
  `---`,
  `_If anything above is 🔴, open a Claude session and ask it to investigate this briefing._`,
].join("\n");

const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: `Daily Briefing — ${today}`,
    body,
    labels: ["daily-briefing"],
  }),
});
if (!res.ok) {
  console.error(`Failed to create briefing issue: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const issue = await res.json();
console.log(`Briefing posted: ${issue.html_url}`);
