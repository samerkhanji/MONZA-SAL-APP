/**
 * User-friendly translations for Supabase/Postgres errors.
 *
 * The audit found 131 places where the app passes a raw `error.message`
 * straight into a toast. That surfaces strings like
 *   "new row violates row-level security policy for table sales_orders"
 * to non-technical employees, which is both scary and unactionable.
 *
 * This module returns a friendlier message based on the Postgres error
 * code (preferred) or a substring of the message. Custom CHECK and
 * trigger errors are passed through as-is because we deliberately
 * write those to be human-readable.
 *
 * Usage:
 *   toast.error(formatError(err));
 */

interface ErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  name?: string | null;
}

const PASS_THROUGH_PREFIXES = [
  // Custom CHECK / trigger messages we wrote ourselves — already friendly.
  "Cannot delete customer",
  "Cannot delete",
  "Quote must be sent",
  "Deposit must be recorded",
  "Signed contract must be recorded",
  "Already delivered",
  "forbidden",
  "unauthenticated",
];

/**
 * Returns a short, action-oriented message safe to show to non-technical users.
 */
export function formatError(err: unknown): string {
  if (!err) return "Something went wrong. Please try again.";

  // Plain string — assume the caller already shaped it.
  if (typeof err === "string") return err;

  const e = err as ErrorLike;
  const rawMsg = (e.message ?? "").trim();
  const code = (e.code ?? "").trim();

  // 1. Custom human-readable messages we wrote in DB triggers / RPCs.
  for (const prefix of PASS_THROUGH_PREFIXES) {
    if (rawMsg.toLowerCase().startsWith(prefix.toLowerCase())) {
      return rawMsg;
    }
  }

  // 2. Postgres / PostgREST error codes — translate to plain English.
  switch (code) {
    case "23505":
      // unique_violation
      return "That record already exists. It may have been added by someone else.";
    case "23503":
      // foreign_key_violation — our triggers raise this with a nice message.
      return rawMsg || "This action conflicts with related data.";
    case "23502":
      // not_null_violation
      return "A required field is missing. Please fill it in and try again.";
    case "23514":
      // check_violation — custom CHECKs we wrote have nice messages already.
      return rawMsg || "The values you entered don't pass our validation rules.";
    case "42501":
      // insufficient_privilege
      return "You don't have permission to do this. Ask an owner or admin.";
    case "PGRST301":
    case "PGRST302":
      // PostgREST: JWT expired / invalid
      return "Your session has expired. Please sign in again.";
    case "PGRST116":
      // No rows returned where one was expected
      return "We couldn't find that record. It may have been deleted.";
  }

  // 3. Substring matches on raw error text from Supabase / fetch.
  const m = rawMsg.toLowerCase();
  if (m.includes("row-level security") || m.includes("row level security")) {
    return "You don't have permission to do this. Ask an owner or admin.";
  }
  if (m.includes("duplicate key") || m.includes("already exists")) {
    return "That record already exists.";
  }
  if (m.includes("violates foreign key")) {
    return "This action conflicts with related data. Check linked records first.";
  }
  if (m.includes("violates check constraint")) {
    return "The values you entered don't pass our validation rules.";
  }
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("networkerror")) {
    return "Connection problem. Check your internet and try again.";
  }
  if (m.includes("jwt") || m.includes("invalid token") || m.includes("expired")) {
    return "Your session has expired. Please sign in again.";
  }
  if (m.includes("timeout")) {
    return "The server took too long to respond. Try again in a moment.";
  }

  // 4. Last resort — return whatever we have, but never empty.
  return rawMsg || "Something went wrong. Please try again.";
}
