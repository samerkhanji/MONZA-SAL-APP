import { createClient } from "@/lib/supabase";
import { isAuthApiError } from "@supabase/supabase-js";

const CONNECTION_ERROR_PATTERNS = [
  "failed to fetch",
  "networkerror",
  "load failed",
  "network request failed",
  "connection refused",
  "econnrefused",
  "econnreset",
  "timeout",
  "timed out",
];

const SESSION_EXPIRED_PATTERNS = [
  "session expired",
  "invalid refresh token",
  "refresh token not found",
  "refresh token revoked",
];

/**
 * Returns true if the error indicates an expired or invalid session.
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (!isAuthApiError(error)) return false;
  const message =
    (error as { message?: string }).message?.toLowerCase() ?? "";
  return SESSION_EXPIRED_PATTERNS.some((p) => message.includes(p));
}

/**
 * If the error is a session-expired error, signs out and redirects to login.
 * Returns true if the error was handled, false otherwise.
 */
export async function handleSessionExpiredError(error: unknown): Promise<boolean> {
  if (!isSessionExpiredError(error)) return false;

  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore sign-out errors
  }

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isLoginPage = path === "/login" || path === "/";
  if (!isLoginPage) {
    window.location.href = "/login?reason=session_expired";
  }
  return true;
}

/**
 * Returns true if the error indicates a connection/network failure.
 */
export function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    (error as { message?: string }).message?.toLowerCase() ?? "";
  const name = (error as { name?: string }).name?.toLowerCase() ?? "";
  return (
    CONNECTION_ERROR_PATTERNS.some((p) => message.includes(p)) ||
    name === "typeerror" ||
    name === "networkerror"
  );
}

/**
 * Supabase often returns generic messages (e.g. "Error sending recovery email").
 * Append HTTP status / error code when present so support can map to Auth logs.
 */
/**
 * Supabase may return OAuth-style errors in the query string and/or hash (#error=...&error_code=...).
 */
export function parseAuthErrorParams(): {
  error: string | null;
  error_description: string | null;
  error_code: string | null;
} {
  if (typeof window === "undefined") {
    return { error: null, error_description: null, error_code: null };
  }
  const q = new URLSearchParams(window.location.search);
  const hash = window.location.hash?.replace(/^#/, "") ?? "";
  const h = hash ? new URLSearchParams(hash) : new URLSearchParams();
  const pick = (key: string) => q.get(key) ?? h.get(key);
  return {
    error: pick("error"),
    error_description: pick("error_description"),
    error_code: pick("error_code"),
  };
}

/** PKCE callback: `next` / `type` may appear in query or hash (Supabase variants). */
export function parseAuthCallbackParams(): {
  next: string | null;
  type: string | null;
} {
  if (typeof window === "undefined") {
    return { next: null, type: null };
  }
  const q = new URLSearchParams(window.location.search);
  const hash = window.location.hash?.replace(/^#/, "") ?? "";
  const h = hash ? new URLSearchParams(hash) : new URLSearchParams();
  const pick = (key: string) => q.get(key) ?? h.get(key);
  return { next: pick("next"), type: pick("type") };
}

export function formatAuthApiErrorMessage(
  error: unknown,
  context?: { redirectTo?: string }
): string {
  if (!error || typeof error !== "object") return "Something went wrong.";
  const message =
    (error as { message?: string }).message ?? "Something went wrong.";
  if (!isAuthApiError(error)) return message;
  const status = (error as { status?: number }).status;
  const code = (error as { code?: string }).code;
  const msgLower = message.toLowerCase();
  if (code === "over_email_send_rate_limit") {
    return "Too many emails were sent from this app recently. Wait several minutes, then try again.";
  }
  if (
    code === "unexpected_failure" ||
    (status === 500 && msgLower.includes("recovery email"))
  ) {
    return "Supabase could not send the reset email (server error). In the Supabase Dashboard check: Project Settings → Auth → SMTP (or use the default mailer), Authentication → Logs for the real error, and that sign-up/recovery email is not blocked. If you use custom SMTP, verify credentials and provider logs (bounces, suppressions).";
  }
  if (
    status === 401 ||
    msgLower.includes("invalid api key") ||
    (msgLower.includes("jwt") && msgLower.includes("invalid"))
  ) {
    return "Invalid Supabase API key (HTTP 401). In Supabase → Project Settings → API, copy the anon public key into NEXT_PUBLIC_SUPABASE_ANON_KEY (or publishable into NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) and ensure NEXT_PUBLIC_SUPABASE_URL matches the same project. Do not use the service_role key in the browser. Redeploy after changing Vercel env vars.";
  }
  if (
    msgLower.includes("redirect") ||
    msgLower.includes("redirect_uri") ||
    (msgLower.includes("not allowed") &&
      (msgLower.includes("url") || msgLower.includes("site")))
  ) {
    const hint = context?.redirectTo
      ? ` Supabase must allow this exact redirect: ${context.redirectTo}`
      : " Add your deployment origin and /reset-password under Authentication → URL Configuration → Redirect URLs (e.g. https://*.vercel.app/**).";
    return `This app’s password reset link is not allowed by Supabase.${hint} Check Auth logs in the dashboard for details.`;
  }
  const parts: string[] = [];
  if (typeof status === "number") parts.push(`HTTP ${status}`);
  if (code) parts.push(String(code));
  if (parts.length === 0) return message;
  return `${message} (${parts.join(", ")})`;
}
