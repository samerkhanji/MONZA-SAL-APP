# End-to-end QA (Playwright + Supabase)

Every spec here drives a real browser, watches the network for PostgREST
4xx/5xx, and verifies mutations landed in the live DB via a service-role
client. Runs against either a local `next dev` server or production.

## One-time setup

```bash
cd web
npm install               # picks up @playwright/test + cross-env + dotenv
npx playwright install    # browser binaries

cp .env.test.example .env.test
# Fill in TEST_EMAIL, TEST_PASSWORD, SUPABASE_SERVICE_ROLE_KEY
```

## Running

```bash
# Local — boots `next dev` automatically
npm run test:e2e

# UI mode (great for building new specs)
npm run test:e2e:ui

# Production sweep
npm run test:e2e:prod

# Open the HTML report after any run
npm run test:e2e:report
```

## Layout

```
tests/
  auth.spec.ts          Pre-auth + /change-password-loop guard
  navigation.spec.ts    Every owner route + full sidebar sweep
  dashboard.spec.ts     /dashboard & /requests render cleanly
  forms.spec.ts         Create a customer → verify row in DB → cleanup
  rls.spec.ts           No 401/403 PostgREST responses on data pages

  lib/
    supabase-admin.ts   Service-role client + QA_TEST_ prefix helper
    console-errors.ts   Collect console errors + failed network requests
  global-setup.ts       Resets TEST_EMAIL profile flags, pre-authenticates
                        once, saves storage state to .auth/owner.json
  .auth/                (gitignored) storage state reused by every test
```

## What these catch

- **Password-reset loop** — `auth.spec.ts` fails fast if login bounces to
  `/change-password`.
- **Silent RLS blocks** — `rls.spec.ts` watches every PostgREST response
  and fails on a single 401/403. Would have caught the RESTRICTIVE MFA
  bug immediately.
- **Empty/spinner pages** — `dashboard.spec.ts` waits for the loading
  text to disappear and asserts it's gone.
- **Broken routes** — `navigation.spec.ts` walks every owner page and
  fails on 5xx or redirects to `/login` / `/change-password`.
- **UI-says-success-but-DB-empty** — `forms.spec.ts` writes a customer,
  waits for the POST to `/rest/v1/customers`, then verifies the row with
  a service-role lookup.

## Conventions

- Every test row's identifying field starts with `QA_TEST_`
  (`qaLabel()` helper). Makes cleanup trivial:
  ```sql
  DELETE FROM customers WHERE first_name LIKE 'QA_TEST_%';
  ```
- `global-setup.ts` mutates `profiles.must_change_password = false` on
  the test account before any test runs. This is intentional — we don't
  want the reset-loop guard firing during navigation tests.
- `storageState` is reused across all specs. If you add a test that must
  start signed out, use `test.use({ storageState: { cookies: [], origins: [] } })`
  at the top.

## Extending

Add a CRUD spec for a new table:

1. Copy `forms.spec.ts` → `forms-<entity>.spec.ts`.
2. Swap field labels / table name.
3. Add an `afterAll` cleanup that deletes by `QA_TEST_%` prefix.

Visual regression, role-based testing (non-owner), and seeded
pre-test fixtures are all straightforward additions — ask when you need
one.
