export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type BackoffOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

const DEFAULT_BACKOFF: BackoffOptions = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 32_000,
};

/**
 * Runs `fn` until it returns a successful result or attempts are exhausted.
 * Delay before attempt `i` (i >= 1) is min(maxDelayMs, baseDelayMs * 2^(i-1)).
 */
export async function withExponentialBackoff<T>(
  fn: (attemptIndex: number) => Promise<{ ok: true; value: T } | { ok: false; retryable: boolean }>,
  options: Partial<BackoffOptions> = {}
): Promise<{ ok: true; value: T; attempts: number } | { ok: false; attempts: number }> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = { ...DEFAULT_BACKOFF, ...options };
  for (let i = 0; i < maxAttempts; i++) {
    const out = await fn(i);
    if (out.ok) return { ok: true, value: out.value, attempts: i + 1 };
    if (!out.retryable || i === maxAttempts - 1) {
      return { ok: false, attempts: i + 1 };
    }
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** i);
    await sleep(delay);
  }
  return { ok: false, attempts: maxAttempts };
}
