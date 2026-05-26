# Dependabot

This repo uses GitHub-native Dependabot to keep npm and GitHub Actions dependencies up to date.
Configuration lives in [`.github/dependabot.yml`](./dependabot.yml).

## Schedule

- **npm (`/web`)**: weekly, every **Monday 06:00 Asia/Beirut**.
- **GitHub Actions (`/`)**: monthly.
- **Security alerts**: ad-hoc, regardless of schedule — these come whenever GitHub publishes an advisory affecting our lockfile.

## Grouping strategy

To reduce review noise, minor + patch updates for the Next.js app are grouped into **two PRs per week**:

1. `production-minor-patch` — runtime dependencies (`dependencies` in `package.json`).
2. `dev-minor-patch` — tooling, types, testing, build (`devDependencies` in `package.json`).

**Major version bumps** are *not* grouped. Each major update arrives as its own PR — review carefully (changelogs, breaking changes, migration notes) before merging.

The open-PR limit for npm is **5** at any given time. If the queue fills up, merge or close existing Dependabot PRs to let the next batch through.

## Labels

Dependabot PRs are auto-labeled:

- `dependencies` + `automated` for npm
- `dependencies` + `ci` for GitHub Actions

## Review flow

1. Dependabot opens a PR with the changelog summary.
2. CI runs (`pr-build-check.yml`, etc.). If green and the change looks safe, merge.
3. For majors, read the upstream release notes before approving.
4. Do **not** auto-merge — keep a human in the loop for every dependency change.

## Security advisories

Security advisories are surfaced via the GitHub **Security** tab. Enabling Dependabot security updates is a Settings UI toggle (`Settings → Code security and analysis → Dependabot security updates`) and is not part of this config file. Turn it on once to let Dependabot open ad-hoc PRs for CVEs in your lockfile.
