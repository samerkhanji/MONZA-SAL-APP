import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for shared secrets / bearer tokens.
 *
 * Always hashes both inputs to a fixed-width buffer first, so the per-byte
 * comparison runs in time independent of either input's length or content.
 * Without this, the early-exit semantics of `===` and the length-dependent
 * cost of `Buffer.compare` would leak information about how much of the
 * secret the caller guessed correctly.
 *
 * Returns `false` if either argument is missing/empty or if hashing throws,
 * so callers can use this as a drop-in replacement for `a === b` without
 * an additional truthy check.
 */
export function constantTimeEqualSecret(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const ha = createHash("sha256").update(a, "utf8").digest();
    const hb = createHash("sha256").update(b, "utf8").digest();
    return timingSafeEqual(ha, hb);
  } catch {
    return false;
  }
}
