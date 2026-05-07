/**
 * Phone number normalization. Mirrors the public.normalize_phone() SQL
 * function used by the unique partial index on customers.phone_primary
 * (migration 077).
 *
 * Strips whitespace, dashes, parens, dots, etc. Keeps a leading + if
 * present (international prefix). Empty / whitespace-only -> null.
 *
 * Examples:
 *   normalizePhone("+961 1 234 5678") -> "+96112345678"
 *   normalizePhone("961-1-234-5678")  -> "96112345678"
 *   normalizePhone("(961) 1 234567")  -> "9611234567"
 *   normalizePhone("")                -> null
 *   normalizePhone(null)              -> null
 */
export function normalizePhone(p: string | null | undefined): string | null {
  if (p == null) return null;
  const trimmed = p.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/[^\d]/g, "");
  }
  return trimmed.replace(/[^\d]/g, "");
}
