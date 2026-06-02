# Backup & restoration log

Supabase runs automated daily backups at the project level. **Automated backups are not enough.** This file is the verified-restoration record.

## Owner

**Samer Khanji** (skhanji55@gmail.com)

Personally verifies a backup restoration **once per month**. If Samer is unavailable for more than 60 days, secondary owner is **Sam** (sam@monzasal.com).

## Monthly verification procedure

1. **Take a fresh snapshot.** Supabase Dashboard → Project (`okxpsvukzjjubinhamek`) → Database → Backups → "Restore to new branch"
2. **Create a staging branch** named `verify-restore-YYYY-MM-DD`. Wait for branch provisioning to complete (~5 min).
3. **Smoke test the branch:**
   - Sign in via the branch's API URL with a known test account
   - Open `/cars` — should list inventory rows
   - Open `/customers` — should list customer rows
   - Open `/sales-orders` — should list sales orders
   - Open `/garage` — should list garage jobs
   - Open `/cash` — should show cash sessions
   - Open `/reports` — should render Owner Overview
   - Verify RLS denies access for a non-owner test user
4. **Record the result** in this file under "Restore log" below.
5. **Delete the branch** after verification (Branches list → delete).

## What to check fails the verification

- Login broken (auth schema corruption)
- Empty tables that should have data (RLS or restore corruption)
- New employees can't be added (capability triggers broken)
- Reports show zero rows for known-non-empty data (view definitions lost)

## Restore log

| Date | Branch name | Smoke test | RLS check | Verified by | Notes |
|---|---|---|---|---|---|
| _yyyy-mm-dd_ | _verify-restore-..._ | _pass / fail_ | _pass / fail_ | _name_ | _any anomalies_ |

(Add a new row at the top each month.)

## Emergency restore — production

If production data is corrupted or lost:

1. **Do not panic.** Stop writes by setting Vercel project to maintenance mode.
2. **Identify the last good backup** — Supabase Dashboard → Database → Backups → list daily snapshots.
3. **Restore to a new branch first** (never restore in-place; you lose the broken state for forensics).
4. **Spot-check the branch** against the procedure above.
5. **Promote the branch** to primary (Supabase docs: branch promotion).
6. **Update Vercel** to point at the new project ref if needed.
7. **Document the incident** in `outputs/incident-log.md`.

## Disaster recovery RTO/RPO

- **RPO (Recovery Point Objective):** 24 hours. Daily backups; up to 1 day of data could be lost in catastrophic corruption.
- **RTO (Recovery Time Objective):** 4 hours. Branch restore + smoke + DNS swap.

If RPO needs to drop below 24h, enable Supabase **Point-in-Time Recovery** (paid add-on, allows restore to any point within last 7 days).

## What is NOT backed up by Supabase automated backups

- Vercel environment variables — back these up to a password manager separately
- Storage bucket contents (customer documents, car photos) — verify in Supabase docs whether Storage is included; if not, set up object-storage replication
- Sentry, Plausible, LogRocket data — these are third-party services, separate retention

## Storage bucket inventory

(For Storage objects that, if lost, cannot be reconstructed from the database.)

- `customer-documents` — KYC, ID copies — **critical**
- `car-documents` — registration, customs papers — **critical**
- `job-documents` — repair photos, work cards — **important**
- `accessory-receipts` — receipts for accessories — **important**

Storage is backed up by Supabase's underlying infrastructure but not via the same restore-to-branch mechanism. If a bucket is deleted in error, restoration requires support contact.
