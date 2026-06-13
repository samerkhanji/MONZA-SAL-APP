# Monday launch — magic link to every employee

Emails every **active employee** (`profiles.is_active = true` with an email) a one-tap
sign-in link wrapped in a greeting. Uses the same `generateLink` + Resend path as the
app's password-reset flow. Script: `scripts/send-magic-links.mjs`.

## Before Monday (do once)

1. **Email provider (Resend).** The built-in Supabase mailer is rate-limited to a
   handful per hour — not enough for the whole team. Confirm these are set wherever
   you'll run the script (your machine's shell, or a Vercel env you pull down):
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a *verified* sender on your domain)
2. **Supabase access:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server secret — never commit).
3. **Redirect allow-list:** in Supabase → **Auth → URL Configuration → Redirect URLs**,
   make sure `APP_URL` (default `https://monzasal.vercel.app`) is listed. Magic links
   that land on a non-allow-listed URL are rejected.

## Monday morning (3 steps)

```bash
cd web

# 1) Dry run — prints exactly who would get an email, sends nothing:
node scripts/send-magic-links.mjs

# 2) Test on yourself for real — confirm the email looks right & the link signs you in:
node scripts/send-magic-links.mjs --only you@yourdomain.com --send

# 3) Send to everyone:
node scripts/send-magic-links.mjs --send
```

## Flags
- `--send` — actually send (omitted = dry run, the default)
- `--only a@b.com,c@d.com` — restrict to specific addresses (use for the self-test)
- `--limit N` — only the first N recipients (e.g. a small pilot)
- `--delay-ms N` — pause between sends (default 700ms; raise if Resend rate-limits)

## Editing the greeting
Open the script and edit `SUBJECT` and the `greetingHtml()` function. `{{first_name}}`
is filled from `profiles.full_name` automatically (falls back to a generic greeting).

## Notes
- **Safe to re-run.** Magic links are one-time; re-running just sends fresh links.
  Anyone who failed (e.g. no auth account yet) is listed in the summary so you can fix and retry with `--only`.
- **Owners too?** The filter targets active employees. To include/exclude specific
  roles, adjust the `.eq("is_active", true)` query in the script (e.g. add a `user_role` filter).
- This sends real email to real people — there is no "unsend." Always do the dry run + self-test first.
