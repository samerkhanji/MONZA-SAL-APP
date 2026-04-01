# Deployment

## Desktop and Phone (PWA) Branches

- **main** – Primary branch for desktop and all users
- **phone** – Synced from main for PWA/mobile deployments

When you update `main`, always sync to `phone` so the phone build stays current.

### Option 1: GitHub Actions (automatic)

Pushes to `main` automatically sync to `phone` via `.github/workflows/sync-phone-on-push.yml`.

### Option 2: Manual sync

Run after merging to main:

```powershell
.\scripts\sync-phone-branch.ps1
```

This merges `main` into `phone` and pushes both branches.
