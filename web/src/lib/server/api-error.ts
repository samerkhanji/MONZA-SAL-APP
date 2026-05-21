/**
 * Server-side error sanitiser for API route handlers.
 *
 * Raw Supabase / Postgres error messages leak schema and internals
 * (table names, RLS policy text, constraint names) to the client. API
 * route handlers must never put a raw `error.message` into a JSON
 * response — pass the error through `toPublicApiError` instead.
 *
 * The full raw error is logged server-side; the caller receives a short
 * generic message, with a few common Postgres codes mapped to friendlier
 * text. This is for machine-surfaced DB/auth-provider errors only —
 * handcrafted user-facing messages ("Name is required") should be
 * returned directly, not run through here.
 */

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

const PG_CODE_MESSAGES: Record<string, string> = {
  "23505": "That record already exists.",
  "23503": "That action references a record that doesn't exist.",
  "23514": "That value isn't allowed.",
};

function extractPgCode(error: unknown): string {
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code.trim();
  }
  return "";
}

/**
 * Logs the raw error server-side and returns a SAFE generic message for
 * the client. Never echoes the raw Postgres / Supabase message.
 */
export function toPublicApiError(error: unknown): string {
  console.error("[api-error]", error);
  const code = extractPgCode(error);
  return PG_CODE_MESSAGES[code] ?? GENERIC_MESSAGE;
}
