/**
 * Small in-memory token-bucket rate limiter for email-sending auth flows
 * (password reset, recovery, etc.).
 *
 * Limits enforced per call to `checkEmailFlowLimit`:
 *   - `email:<lowercase-email>` — 3 requests / hour
 *   - `ip:<requester-ip>`       — 10 requests / hour
 *
 * Limitation: this is per-process state. It works for single-instance Vercel
 * deployments (the default for hobby/edge functions) but does not coordinate
 * across instances. If the deployment scales horizontally, swap the backing
 * store for Upstash Redis (or similar) without changing the call sites.
 */
export type LimitCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "email" | "ip"; retryAfterSeconds: number };

type Bucket = { tokens: number; refillAt: number };

const HOUR_MS = 60 * 60 * 1000;

export const EMAIL_BUCKET_SIZE = 3;
export const IP_BUCKET_SIZE = 10;
export const REFILL_WINDOW_MS = HOUR_MS;

const store = new Map<string, Bucket>();

function takeToken(
  key: string,
  capacity: number,
  now: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const existing = store.get(key);
  if (!existing || existing.refillAt <= now) {
    // Fresh window — refill to capacity, consume one token.
    store.set(key, { tokens: capacity - 1, refillAt: now + windowMs });
    return { ok: true };
  }
  if (existing.tokens <= 0) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.refillAt - now) / 1000)
    );
    return { ok: false, retryAfterSeconds };
  }
  existing.tokens -= 1;
  return { ok: true };
}

export interface CheckEmailFlowInput {
  email: string;
  ip: string;
  now?: number;
}

export function checkEmailFlowLimit(input: CheckEmailFlowInput): LimitCheckResult {
  const now = input.now ?? Date.now();
  const emailKey = `email:${input.email.toLowerCase()}`;
  const ipKey = `ip:${input.ip}`;

  const emailResult = takeToken(emailKey, EMAIL_BUCKET_SIZE, now, REFILL_WINDOW_MS);
  if (!emailResult.ok) {
    return {
      allowed: false,
      reason: "email",
      retryAfterSeconds: emailResult.retryAfterSeconds,
    };
  }

  const ipResult = takeToken(ipKey, IP_BUCKET_SIZE, now, REFILL_WINDOW_MS);
  if (!ipResult.ok) {
    return {
      allowed: false,
      reason: "ip",
      retryAfterSeconds: ipResult.retryAfterSeconds,
    };
  }

  return { allowed: true };
}

/** Resolve a stable-ish caller IP from a Next.js request's headers. */
export function getRequestIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** Test-only helper. Not exported via barrel. */
export function __resetEmailFlowLimiter(): void {
  store.clear();
}
