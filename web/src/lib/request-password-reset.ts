import {
  getPasswordResetRedirectUrl,
  logPasswordResetClientDebug,
  validatePasswordResetRedirectUrl,
} from "@/lib/auth-app-url";
import { formatAuthApiErrorMessage, isConnectionError } from "@/lib/auth-utils";

/**
 * Sends recovery email via `POST /api/auth/reset-password`: `admin.generateLink` (recovery) +
 * Resend. The link uses token-based recovery (not PKCE `?code=`). Requires server env: Resend + service role.
 */
export async function submitPasswordResetRequest(email: string): Promise<{
  error: string | null;
}> {
  const trimmed = email.trim();
  const redirectTo = getPasswordResetRedirectUrl();
  const redirectInvalid = validatePasswordResetRedirectUrl(redirectTo);
  if (redirectInvalid) {
    console.error("[PasswordReset] Bad redirectTo:", redirectTo, redirectInvalid);
    return { error: redirectInvalid };
  }

  logPasswordResetClientDebug(redirectTo);

  try {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });

    const j = (await res.json().catch(() => ({}))) as { error?: string };

    if (res.status === 503) {
      return {
        error:
          typeof j.error === "string"
            ? j.error
            : "Password reset is temporarily unavailable. Try again later.",
      };
    }

    if (res.status === 502 || !res.ok) {
      return {
        error:
          typeof j.error === "string"
            ? j.error
            : "Something went wrong while sending the reset email. Please try again.",
      };
    }

    return { error: null };
  } catch (unexpected) {
    console.error("[PasswordReset] fetch failed:", unexpected);
    return {
      error: isConnectionError(unexpected)
        ? "Connection failed. Please check your internet and try again."
        : formatAuthApiErrorMessage(unexpected as Error, { redirectTo }),
    };
  }
}
