# MONZA APP — Grafana Cloud observability

Supabase exposes a Prometheus metrics endpoint per project:

```
https://<project-ref>.supabase.co/customer/v1/privileged/metrics
```

Basic-Auth credentials:
- **Username**: `service_role`
- **Password**: a Supabase "Secret" API key (`sb_secret_...`, visible in
  Dashboard → **Project Settings → API Keys**).

Grafana Cloud doesn't scrape customer endpoints for you, so we run a tiny
**Grafana Alloy** agent as a $0 Fly.io Hobby service that scrapes Supabase
every 60 s and remote-writes the results to Grafana Cloud's hosted
Prometheus.

## 1) Create a Grafana Cloud stack (5 min)

1. Sign up → <https://grafana.com/auth/sign-up/create-user> (free forever tier).
2. Create a stack (any region). Open it.
3. Left sidebar → **Connections → Add new connection → Hosted Prometheus metrics**.
4. Copy three values from that page into a local scratchpad (don't paste in chat):
   - `GRAFANA_PROM_URL`  (looks like `https://prometheus-prod-NN-region.grafana.net/api/prom/push`)
   - `GRAFANA_PROM_USER` (a numeric instance ID, e.g. `1234567`)
   - `GRAFANA_PROM_PASSWORD` — click **"Generate now"** to mint a "MetricsPublisher" API token.

## 2) Deploy Grafana Alloy to Fly.io free tier (10 min)

```bash
# one-time, if you've never used Fly
brew install flyctl     # macOS
# or: iwr -useb https://fly.io/install.ps1 | iex   # Windows PowerShell
fly auth signup         # or fly auth login

cd docs/observability

# Launch (will read fly.toml). Accept defaults.
fly launch --now --copy-config --name monza-supabase-alloy

# Push the four secrets Alloy needs. Paste when prompted — never hardcode.
fly secrets set SUPABASE_METRICS_URL="https://okxpsvukzjjubinhamek.supabase.co/customer/v1/privileged/metrics" \
                SUPABASE_METRICS_PASSWORD="sb_secret_..." \
                GRAFANA_PROM_URL="https://prometheus-prod-NN-region.grafana.net/api/prom/push" \
                GRAFANA_PROM_USER="123456" \
                GRAFANA_PROM_PASSWORD="glc_xxxxxxxxxxxxxxxx"

# Re-deploy so Alloy picks up the new secrets
fly deploy
fly logs            # should show "scraped target" lines every 60 s
```

Fly's free Hobby plan covers one shared-cpu-1x 256 MB VM in a single
region — perfect for Alloy.

## 3) Import the dashboard

1. Grafana Cloud → left sidebar → **Dashboards → New → Import**.
2. Upload `monza-crm-dashboard.json` from this folder (or paste its JSON).
3. Pick your hosted-Prometheus data source when prompted.
4. The dashboard has 8 panels: DB load, memory, disk, IO, Postgres connections,
   pgbouncer wait time, auth user count, and API latency (p95).

## 4) Alert routes (optional)

- Grafana Cloud → **Alerts & IRM → Alert rules → New rule**.
- Copy a starter expression:
  - High DB load: `node_load5 > 2`
  - Disk filling up: `node_filesystem_free_bytes{mountpoint="/data"} / node_filesystem_size_bytes{mountpoint="/data"} < 0.2`
  - Too many open DB connections: `sum(db_sql_connection_open) > 300`
- Route to the same `OPS_ALERT_EMAIL` you already wired into the compute panel.

## Troubleshooting

**Alloy logs `401 Unauthorized`** when scraping Supabase:
  Your `sb_secret_...` is wrong or you used the Publishable key. Go to
  Dashboard → API Keys and copy the *Secret* one.

**Alloy logs `remote_write: 401`**:
  Your `GRAFANA_PROM_PASSWORD` is wrong — regenerate and `fly secrets set` again.

**Grafana shows "No data"**:
  Open **Explore** in Grafana Cloud and run `up{job="supabase"}` — if it's `1`,
  the scraper is working and the dashboard panel just has a wrong label.

## Rotating the Supabase Secret API key

1. Dashboard → Project Settings → API Keys → **Regenerate** for `monzacrm2`.
2. `fly secrets set SUPABASE_METRICS_PASSWORD="new_value"`
3. `fly deploy` (Alloy restarts with the new secret automatically).
