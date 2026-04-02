/**
 * Absolute site origin for Supabase auth redirects.
 * Must match entries under Supabase → Authentication → URL Configuration → Redirect URLs.
 *
 * - Production: set NEXT_PUBLIC_SITE_URL=https://monzacrm.vercel.app on Vercel (production only).
 * - Preview: leave unset so each deployment uses its own window.location.origin; add
 *   https://*.vercel.app/** (or your team pattern) in Supabase Redirect URLs.
 * - Local: leave unset; uses http://localhost:3000 — allow http://localhost:3000/** in Supabase.
 *
 * Password reset cross-device: the app triggers recovery via **`POST /api/auth/request-password-reset`**
 * (GoTrue `/recover` with no `code_challenge`). `@supabase/ssr` `createBrowserClient` still uses PKCE for
 * other auth calls — do not call `resetPasswordForEmail` from that client. Legacy:
 * `createClientForPasswordResetEmail` in `./supabase/password-reset-mail-client`. Use the token link example
 * below in Supabase → Email Templates → Reset password. Magic-link / sign-in OTP templates can use /auth/confirm
 * (app/auth/confirm/page.tsx), e.g. {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 *
 * In the browser, if NEXT_PUBLIC_SITE_URL points at a different host than the page the user is on
 * (e.g. production URL in env but they opened a Vercel preview), we use window.location.origin for
 * redirectTo so Supabase allow-listed URLs match.
 *
 * **Emails still show `?code=` (PKCE)** if the Supabase “Reset password” template uses `{{ .ConfirmationURL }}`.
 * Use the token link with `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery` (see
 * `SUPABASE_RESET_PASSWORD_EMAIL_BODY_EXAMPLE`). If you need a programmatic link without sending
 * Supabase’s built-in mail, Auth Admin `generateLink({ type: "recovery", email, options: { redirectTo } })`
 * returns `properties.action_link` — pair with a [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) or your own provider.
 */
function normalizeSiteOrigin(raw: string): string {
  return raw.trim().replace(/\/$/, "");
}

function browserAuthOrigin(): string | null {
  if (typeof window === "undefined") return null;
  let o = window.location.origin;
  if (process.env.NODE_ENV === "production" && o.includes("localhost")) {
    console.warn(
      "[Auth] Detected localhost origin in production; falling back to https://monzacrm.vercel.app"
    );
    return "https://monzacrm.vercel.app";
  }
  return o;
}

function sameSiteHost(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

export function getAuthSiteUrl(): string {
  const fromEnv = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? "");

  if (typeof window !== "undefined") {
    const browser = browserAuthOrigin();
    if (browser) {
      if (!fromEnv) return browser;
      if (!sameSiteHost(fromEnv, browser)) return browser;
      return fromEnv;
    }
    return fromEnv || "http://localhost:3000";
  }

  if (process.env.NODE_ENV === "production") {
    return fromEnv || "https://monzacrm.vercel.app";
  }
  return fromEnv || "http://localhost:3000";
}

/**
 * Full URL passed as `redirectTo` to `resetPasswordForEmail`. Supabase stores it as `RedirectTo` in the
 * reset email template. The reset page (`/reset-password`) handles:
 * - `?token_hash=...&type=recovery` → verifyOtp (works on any device; use this in the email template)
 * - `?code=...` → exchangeCodeForSession / PKCE (same device only if using default ConfirmationURL)
 */
export function getPasswordResetRedirectUrl(): string {
  const base = getAuthSiteUrl().replace(/\/$/, "");
  return `${base}/reset-password`;
}

/**
 * Server / API routes: same destination as `getPasswordResetRedirectUrl()` but without `window`.
 * Order: `NEXT_PUBLIC_SITE_URL` → `requestOrigin` (usually the browser `Origin` header) → prod default / localhost.
 */
export function getPasswordResetRedirectUrlFromServer(requestOrigin?: string | null): string {
  const fromEnv = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (fromEnv) {
    return `${fromEnv.replace(/\/$/, "")}/reset-password`;
  }
  const o = requestOrigin?.trim();
  if (o) {
    try {
      const u = new URL(o);
      if (u.protocol === "http:" || u.protocol === "https:") {
        return `${u.origin}/reset-password`;
      }
    } catch {
      /* ignore */
    }
  }
  if (process.env.NODE_ENV === "production") {
    return "https://monzacrm.vercel.app/reset-password";
  }
  return "http://localhost:3000/reset-password";
}

/**
 * Temporary: set `NEXT_PUBLIC_DEBUG_PASSWORD_RESET=1` in `.env.local` (or use dev) to log `redirectTo` / origin details in the browser console. Remove when finished debugging.
 */
export function logPasswordResetClientDebug(
  redirectTo: string,
  extra?: Record<string, unknown>
): void {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.NEXT_PUBLIC_DEBUG_PASSWORD_RESET !== "1"
  ) {
    return;
  }
  let parsed: Record<string, unknown> = {};
  try {
    const u = new URL(redirectTo);
    parsed = {
      href: u.href,
      origin: u.origin,
      host: u.host,
      pathname: u.pathname,
      protocol: u.protocol,
    };
  } catch (e) {
    parsed = { parseError: String(e) };
  }
  console.info("[PasswordResetDebug client]", {
    redirectTo,
    isAbsoluteHttpsProduction:
      redirectTo === "https://monzacrm.vercel.app/reset-password",
    authSiteUrl: getAuthSiteUrl(),
    nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "(unset)",
    windowOrigin: typeof window !== "undefined" ? window.location.origin : null,
    flow: "POST /api/auth/request-password-reset (GoTrue /recover, no code_challenge)",
    ...parsed,
    ...extra,
  });
}

/**
 * Paste into Supabase → Authentication → Email templates → **Reset password** (replace the default
 * `{{ .ConfirmationURL }}` link). `RedirectTo` matches `getPasswordResetRedirectUrl()` / `redirectTo` from the app.
 */
export const SUPABASE_RESET_PASSWORD_EMAIL_BODY_EXAMPLE = `<h2>Reset password</h2>
<p>Follow the link below to choose a new password. You can open this link on any device.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a></p>`;

/** Shown when PKCE recovery fails because the link was opened on a different device than forgot-password. */
export const PASSWORD_RESET_CROSS_DEVICE_USER_MESSAGE =
  "This link uses a sign-in code that only works in the same browser where you requested the reset (for example, you asked for the email on a PC but opened the link on your phone). Request a new reset email and open it on the same device, or ask your admin to change the Supabase “Reset password” email template to a token link so it works on any device — copy from SUPABASE_RESET_PASSWORD_EMAIL_BODY_EXAMPLE in web/src/lib/auth-app-url.ts.";

export function isPkceVerifierOrCrossDeviceError(err: { message?: string } | null | undefined): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return (
    m.includes("code verifier") ||
    m.includes("pkce") ||
    m.includes("different browser") ||
    m.includes("different device") ||
    m.includes("storage was cleared")
  );
}

/**
 * Supabase rejects resetPasswordForEmail if redirectTo is not a valid absolute URL or is disallowed.
 * Returns an English error message, or null if the URL looks valid.
 */
export function validatePasswordResetRedirectUrl(redirectTo: string): string | null {
  const raw = redirectTo?.trim();
  if (!raw) return "Password reset redirect URL is empty.";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Password reset redirect must be a full URL (e.g. https://your-domain.com/reset-password).";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return "Password reset redirect must use http or https.";
  }
  const host = u.hostname.toLowerCase();
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  if (u.protocol === "http:" && !isLocal) {
    return "Password reset redirect should use https except for localhost.";
  }
  const path = u.pathname.replace(/\/$/, "") || "/";
  if (path !== "/reset-password") {
    return "Password reset redirect path must be /reset-password.";
  }
  if (u.hash) return "Password reset redirect URL must not include a #fragment.";
  return null;
}

/** Use for signInWithOtp / OAuth emailRedirectTo so magic links hit an allow-listed callback. */
export function getAuthCallbackRedirectUrl(): string {
  return `${getAuthSiteUrl()}/auth/callback`;
}

/**
 * Only allow same-origin relative paths (no open redirects).
 */
export function safeAuthNextPath(next: string | null, fallback = "/dashboard"): string {
  if (!next || typeof next !== "string") return fallback;
  let t: string;
  try {
    t = decodeURIComponent(next.trim());
  } catch {
    return fallback;
  }
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("://")) return fallback;
  const pathOnly = t.split("?")[0]?.split("#")[0] ?? "";
  if (!pathOnly.startsWith("/")) return fallback;
  return pathOnly || fallback;
}
