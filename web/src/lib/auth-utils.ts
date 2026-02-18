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
