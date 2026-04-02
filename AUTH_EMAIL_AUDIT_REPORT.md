# Auth & Supabase Email Pipeline — Audit Report

**Scope:** MONZA CRM `web` app (Next.js 16, Supabase Auth), Vercel deployment.  
**Date:** 2026-04-01  
**Method:** Static codebase review + configuration alignment with approved audit plan.  
**Note:** SMTP deliverability for Auth emails is configured in **Supabase Dashboard**, not in this repository.

---

## 1. Executive summary

### Findings by severity

| Severity | ID | Area | Finding |
|----------|-----|------|---------|
| **High** | H1 | Product copy / ops | `POST /api/team/add-employee` success message claimed users “will receive a password reset email”; **`auth.admin.createUser` with `email_confirm: true` does not send password-reset or welcome mail** from Supabase by default. |
| **High** | H2 | Supabase (dashboard) | **Site URL** must be canonical production (`https://monzacrm.vercel.app`); using a **preview URL** as Site URL breaks `{{ .SiteURL }}` in templates and default redirects. (Observed in prior config; verify in dashboard.) |
| **High** | H3 | Supabase (dashboard) | **Redirect URL** allow list must include every origin/path the app sends as `redirectTo` — especially **`{origin}/reset-password`** (see code) and preview wildcards (`https://*.vercel.app/**`). |
| **Medium** | M1 | Observability | PKCE/token exchange runs in **client components**; failures are mostly **browser console** + **Supabase Auth logs**, not Vercel Node function logs for `/auth/callback`. |
| **Medium** | M2 | Error UX | Forgot-password on `/` used raw `resetError.message`; **`formatAuthApiErrorMessage`** (rate limits, codes) was not applied consistently with `/login`. |
| **Medium** | M3 | `getAuthSiteUrl()` | Hardcoded fallback `https://monzacrm.vercel.app` if `NEXT_PUBLIC_SITE_URL` unset in production build — wrong if production domain changes. |
| **Low** | L1 | Monitoring | No **Sentry** (or similar) in `web/src` for client auth failures. |
| **Low** | L2 | Edge session (`proxy` + lib) | `getUser()` errors only `console.warn` in **development**; production failures are silent on the server edge (`web/src/proxy.ts` → `web/src/lib/supabase/middleware.ts`). |

### What this app does **not** own

- No **Nodemailer / in-app SMTP** for Auth mail.
- No public **`signUp`** route; employee creation is **`/api/team/add-employee`** (service role).

---

## 2. Detailed analysis

### 2.1 Supabase email diagnostics (dashboard + provider)

**Deliverability stack (verify manually in Supabase):**

- **Project Settings → Auth → SMTP:** default Supabase sender vs custom (SendGrid, SES, etc.).
- **Custom SMTP:** check provider dashboards (bounces, spam complaints, suppressions).
- **Custom domain:** validate **SPF, DKIM, DMARC** for the sending domain.

**Supabase Auth logs:**

- Filter for the recipient email and time of “Send reset link”; look for rate limits, provider rejection, invalid redirect.

**Email templates:**

- **Reset password:** App passes `redirectTo: getPasswordResetRedirectUrl()` → **`{getAuthSiteUrl()}/reset-password`** (`web/src/lib/auth-app-url.ts`). Allow-list must include that URL pattern per environment.
- **Cross-device reset (phone vs PC):** Default **`{{ .ConfirmationURL }}`** in the Reset password template uses **PKCE**; the code verifier is stored only on the device that clicked “Forgot password”. For links that work on **any** device, replace that link with the token URL documented as **`SUPABASE_RESET_PASSWORD_EMAIL_BODY_EXAMPLE`** in `web/src/lib/auth-app-url.ts` (`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`). `/reset-password` already runs **`verifyOtp`** for that shape before trying **`exchangeCodeForSession`** for `?code=`.
- **Magic link / OTP with `token_hash`:** Use **`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`** (or `magiclink` / `recovery` as appropriate) — handled by `web/src/app/auth/confirm/page.tsx`.
- **`{{ .ConfirmationURL }}`:** Valid for same-device PKCE flows; completes via **`/auth/callback`** or **`/reset-password`** (`exchangeCodeForSession`).
- Avoid broken `href` values (whitespace, line breaks inside URLs).

### 2.2 Redirect URL audit (code truth)

| Item | Implementation |
|------|------------------|
| **Password reset `redirectTo`** | `getPasswordResetRedirectUrl()` → `` `${getAuthSiteUrl()}/reset-password` `` |
| **`NEXT_PUBLIC_SITE_URL`** | Trimmed; trailing `/` stripped. Browser: `fromEnv \|\| window.location.origin`. SSR production: `fromEnv \|\| "https://monzacrm.vercel.app"`. |
| **Preview** | If env unset in browser, origin is the preview host — must match Supabase **Redirect URLs** (e.g. `https://*.vercel.app/**`). |
| **Call sites** | `resetPasswordForEmail` in `web/src/app/page.tsx`, `web/src/app/login/page.tsx` |

**Redirect URL checklist (for Supabase dashboard):**

- [ ] **Site URL** = production canonical origin (no wildcards).
- [ ] `https://<production>/reset-password` or `https://<production>/**`
- [ ] `https://<production>/auth/callback` or covered by `/**`
- [ ] `https://<production>/auth/confirm` or covered by `/**` if using token_hash templates
- [ ] `https://*.vercel.app/**` for previews (or explicit preview URLs)
- [ ] `http://localhost:3000/**` for local dev
- [ ] After deploy, trigger reset from **preview**, copy link from email, confirm it matches allow list

### 2.3 Cookie & session (Next.js proxy + Supabase helper)

| File | Role |
|------|------|
| `web/src/proxy.ts` | Next 16 entry; runs `updateSession` for matched routes |
| `web/src/lib/supabase/middleware.ts` | `createServerClient` + `getUser()`; sets cookies via `setAll` |

**Behavior verified:**

- **`/` or `/login` with `code` or OAuth `error*`** → **redirect to `/auth/callback`** preserving query (`clone()`).
- **Public without session:** `/`, `/login`, `/auth/callback`, `/auth/confirm`, `/reset-password`.
- **Protected:** others → redirect to `/` with `redirectTo`.

**Gap:** `getUser()` catch only warns in **development** (M3/L2).

### 2.4 Auth completion pages (client-side)

| Route | Mechanism |
|-------|-----------|
| `/auth/callback` | `exchangeCodeForSession(code)`; recovery → `/reset-password` via `redirectType` / `type` / `safeAuthNextPath` |
| `/auth/confirm` | `verifyOtp({ token_hash, type })` |
| `/reset-password` | `exchangeCodeForSession` or `verifyOtp` recovery or existing session |

**Observability:** Exchange/verify errors are user-visible; **serverless “function logs”** do not capture client-side failures unless RUM/logging is added.

### 2.5 Error handling & observability (code)

- **Forgot password:** Errors shown in UI; **improved** to use `formatAuthApiErrorMessage` + `isConnectionError` (see implementation).
- **add-employee:** Returns JSON errors; **improved** with `console.error` for `createUser` / profile failures; **success copy corrected** (H1).

### 2.6 Security notes

- **Service role** only on server (`SUPABASE_SERVICE_ROLE_KEY`); not exposed to client.
- **Anon key** is public by design.
- **Rate limiting:** Supabase Auth limits + optional app-level limits on APIs.
- **Reset enumeration:** Supabase may return success when email is unknown — document for support.

---

## 3. Actionable solutions

### Dashboard / Vercel (operators)

1. Set **Site URL** to production `https://monzacrm.vercel.app` (or your real prod domain).
2. Maintain **Redirect URLs** as in §2.2 checklist.
3. Configure **SMTP** in Supabase if default mail is insufficient; monitor provider + DNS.
4. **Vercel Production:** set `NEXT_PUBLIC_SITE_URL` to canonical prod URL; **Preview:** often leave unset for per-preview origin.

### Code (applied in this pass — committed in repo)

- **Forgot password:** `web/src/app/page.tsx` and `web/src/app/login/page.tsx` — `isConnectionError` + `formatAuthApiErrorMessage` for reset failures.
- **Client logging:** `web/src/app/auth/callback/page.tsx` — `console.error` on `exchangeCodeForSession` failure; `web/src/app/auth/confirm/page.tsx` — on `verifyOtp` failure.
- **add-employee:** `web/src/app/api/team/add-employee/route.ts` — `console.error` for `createUser` (with code/status) and profile upsert; success `message` no longer implies an automatic password-reset email.

### Optional follow-ups

- Add **Sentry** (or similar) for client + edge.
- **Invite / welcome email:** `inviteUserByEmail`, magic link, or transactional API (Resend/SendGrid) from a Route Handler.
- Production **edge/proxy** logging for `getUser` failures (careful with volume).

---

## 4. Testing plan

| Environment | Steps |
|-------------|--------|
| **Local** | `http://localhost:3000/**` in Supabase; reset with real inbox; check spam; Network tab → `supabase.co` auth request. |
| **Vercel Preview** | Confirm wildcards; trigger reset; **paste email URL** into allow-list checker mentally; complete flow to `/reset-password`. |
| **Staging** | Same as prod domain checklist if dedicated host. |
| **Production** | Smoke test reset + add-employee; verify Supabase logs clean. |

---

## 5. Additional recommendations

- **Transactional email API** for product emails (welcome, notifications) separate from Supabase Auth.
- **Queue** (e.g. Inngest, QStash) if sending high-volume mail from your own backend.
- **Documentation** for support: “No email” triage = Supabase logs → spam → redirect URL → provider.

---

## 6. Appendix — “Can’t reproduce” diagnostic checklist

1. Supabase **Logs** / Auth events for that email + timestamp.  
2. If custom SMTP: provider dashboard (delivery, bounce, suppression).  
3. **DNS** SPF/DKIM/DMARC for sending domain.  
4. Vercel **function logs** for `/api/team/add-employee` only (not for client PKCE).  
5. Browser **Network** for `resetPasswordForEmail` response.  
6. **Spam / Promotions / All Mail.**  
7. Copy **full link** from email → compare to **Redirect URLs** and to `getPasswordResetRedirectUrl()` output for that environment.

---

## 7. File reference index

| Path | Relevance |
|------|-----------|
| `web/src/lib/auth-app-url.ts` | `getAuthSiteUrl`, `getPasswordResetRedirectUrl` |
| `web/src/lib/supabase/middleware.ts` | Session refresh, public routes, `/`→`/auth/callback` forward |
| `web/src/proxy.ts` | Next.js 16 entry; calls `updateSession` from `lib/supabase/middleware.ts` |
| `web/src/app/page.tsx`, `web/src/app/login/page.tsx` | Sign-in, forgot password |
| `web/src/app/auth/callback/page.tsx` | PKCE exchange |
| `web/src/app/auth/confirm/page.tsx` | `token_hash` OTP |
| `web/src/app/reset-password/page.tsx` | Recovery session + password update |
| `web/src/lib/auth-utils.ts` | `formatAuthApiErrorMessage`, parsers |
| `web/src/app/api/team/add-employee/route.ts` | Admin user creation |

---

*End of report.*
