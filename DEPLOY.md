# Monza CRM — Deploy & Operate

Single source of truth for the things only a human can do (Supabase Dashboard
toggles, Vercel env, secret rotation). Code-side instructions live next to
the code.

---

## Production URLs

| Surface | URL |
|---|---|
| App (custom alias) | https://monzacrm.vercel.app |
| App (Vercel default) | https://web-dun-beta-59.vercel.app |
| Supabase project | https://supabase.com/dashboard/project/okxpsvukzjjubinhamek |
| Vercel project | https://vercel.com/samers-projects-222dab7d/web |
| Grafana Cloud | https://samerkhanji.grafana.net |
| Fly.io Alloy scraper | https://fly.io/apps/monza-supabase-alloy |

---

## Things only you can do

### 1. Enable TOTP MFA (5 minutes — do this before anyone else gets the app)

Supabase advisor flags `auth_insufficient_mfa_options`. With owner-tier
write access on every table, MFA is the cheapest hard wall.

1. Open Supabase Dashboard → **Authentication → Providers**.
2. Enable **TOTP (Time-based One-time Password)**.
3. Save.
4. On next login, your account will be prompted to enroll. Use the QR code
   in any TOTP app (1Password, Authy, Google Authenticator, etc.).

### 2. Rotate any secrets that have been pasted into chat

If a secret was ever pasted into a non-private chat (Claude, Cursor, etc.),
treat it as compromised even if "no one has access". Rotate:

- **Supabase Service Role key** — Dashboard → Settings → API → Reset.
  Then in Vercel: Settings → Environment Variables → update
  `SUPABASE_SERVICE_ROLE_KEY` for Production AND Preview AND Development →
  redeploy production.
- **Supabase Management PAT** — https://supabase.com/dashboard/account/tokens
  → revoke old, generate new. Update wherever it's used (the Fly.io Alloy
  scraper Dockerfile build env if any).
- **Grafana Cloud token** — https://grafana.com/orgs/.../api-keys → revoke
  + recreate. Update the secret on the Fly.io app:
  `flyctl secrets set GRAFANA_CLOUD_TOKEN=<new>` then `flyctl deploy`.
- **Resend API key** — https://resend.com/api-keys → revoke + create.
  Update Vercel `RESEND_API_KEY`.

### 3. Check `force-reset-password` admin endpoint

`POST /api/admin/force-reset-password` requires `Authorization: Bearer
<ADMIN_API_SECRET>`. Confirm `ADMIN_API_SECRET` is set in Vercel
Production env. Without it the endpoint returns 503.

### 4. Approve open PRs

```
PR #2 — Vercel Speed Insights (already shipped inline; close as superseded)
PR #3 — AGENTS.md for Cursor Cloud (close, we use Claude Code; or merge as inert doc)
```

Close at https://github.com/samerkhanji/MONZA-CRM/pulls.

### 5. Configure the AI assistant (Monza Assistant)

The in-app assistant (`POST /api/chat`) needs an Anthropic API key.
Without it the chat returns "AI assistant is not configured.
ANTHROPIC_API_KEY environment variable is missing." It is **not** a code
bug — the assistant already works for every signed-in user (owner and
staff) the moment the key is set. No redeploy of code, just the env var.

1. **Get a key** — https://console.anthropic.com → **Settings → API keys**
   → **Create Key**. The Anthropic account must have billing / credits
   set up (Plans & Billing) or calls fail with a credit error.
2. **Add it to Vercel** — https://vercel.com/samers-projects-222dab7d/web
   → **Settings → Environment Variables → Add New**:
   - Key (name): `ANTHROPIC_API_KEY` — exact, case-sensitive.
   - Value: the key (starts `sk-ant-`).
   - Environments: **Production** (and Preview). Tick **Sensitive**.
3. **Redeploy** — env-var changes only take effect on a new build:
   `cd web && vercel deploy --prod --yes`
4. **Verify** — open the app, click the chat bubble (bottom-right),
   ask a question. It should stream a reply.

Rotate this key like any other secret (revoke in the Anthropic console,
create a new one, update Vercel, redeploy).

---

## Deploy flow

The app is **NOT** wired to GitHub auto-deploy — Vercel projects show only
local-CLI deploys in the deployment list. Until that's reconnected:

```
# from the worktree root (anywhere with web/ as a child)
cd web
vercel deploy --prod --yes
```

This pushes the local working tree to Vercel as the new production build.
Push to GitHub `main` separately for source-of-truth, but the build comes
from your local CLI.

To re-enable GitHub auto-deploy: Vercel project settings → Git → Connect
to GitHub → choose `samerkhanji/MONZA-CRM` → branch `main`.

---

## Migration apply order

Migrations live under `supabase/migrations/<NNN>_<name>.sql`. They are
applied via the Supabase MCP tool from this assistant or manually via
the SQL editor in the dashboard.

Currently applied (cross-checked against `pg_proc`/`pg_views`/`pg_policies`):

```
053_garage_workflow_buildout       — bays, parts, time-tracking RPCs + 3 views
054_rls_perf                       — auth.uid() initplan fix + multi-permissive splits
055_index_cleanup                  — drops 34 unused indexes, adds 2 missing FK indexes
```

If you ever rebuild the DB from scratch, apply migrations in numeric
order. The `*_phone` shadow migrations on the deleted `phone` branch
(`052_phase1_schema_fixes`, `053_warranty_field_rename`,
`054_garage_tasks_notes`, `054_warranty_legacy_drop`) **were never
applied to production** and should be discarded.

---

## Observability

- **Grafana dashboard** for Supabase metrics is in
  `docs/observability/monza-crm-dashboard.json` — import into Grafana
  Cloud → Dashboards → New → Import → upload JSON.
- **Vercel Speed Insights** is wired in `web/src/app/layout.tsx`.
  Live data appears at the Vercel project → Speed Insights tab within
  ~10 minutes of first traffic.

---

## Smoke tests

After every prod deploy, the minimum manual check:

1. Sign in at https://monzacrm.vercel.app
2. Click **Cars** — list loads with at least 100 rows
3. Click **Customers** — list loads with at least 150 rows
4. Open one car detail — fields populate without console errors
5. Open **Garage → Workshop bays** — bays render
6. Open **Garage → Efficiency** — three tables render

Or run the Playwright smoke pack against prod:

```
cd web
npm run test:e2e:prod
```
