/**
 * Dealership timezone helpers.
 *
 * The audit found that all `today` / `this week` / `this month` buckets in
 * garage time-tracking reports used the browser's local timezone (via
 * `setHours(0, 0, 0, 0)` and friends). For an employee in Beirut viewing the
 * app, that worked fine. For anyone outside Beirut — or for cron/server jobs
 * that should bucket by the dealership's clock regardless of viewer — the
 * buckets silently shifted.
 *
 * This module pins everything to the dealership's timezone and exposes
 * helpers that work without adding a date library.
 *
 * Strategy: bucket by the local calendar-date key ("YYYY-MM-DD" in `tz`)
 * instead of computing UTC instants. Because YYYY-MM-DD strings sort
 * correctly, range checks like `key >= "2026-05-05" && key <= "2026-05-11"`
 * are both correct and DST-safe.
 */

export const DEALERSHIP_TZ = "Asia/Beirut";

/** "YYYY-MM-DD" for the local calendar date of `at` in `tz`. */
export function dateKeyInTz(at: Date, tz: string = DEALERSHIP_TZ): string {
  // en-CA produces YYYY-MM-DD in its short-date format, which sorts
  // lexicographically.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** "YYYY-MM" for the local calendar month of `at` in `tz`. */
export function monthKeyInTz(at: Date, tz: string = DEALERSHIP_TZ): string {
  return dateKeyInTz(at, tz).slice(0, 7);
}

/**
 * Earliest date key (inclusive) of the local week containing `at`.
 * Week starts on Monday. Returns "YYYY-MM-DD" in `tz`.
 */
export function weekStartKeyInTz(at: Date, tz: string = DEALERSHIP_TZ): string {
  // Find the local day-of-week (0=Sun..6=Sat) by looking at the weekday name.
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(at);
  // Monday-first index: Mon=0, Tue=1, ..., Sun=6
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const offset = map[wd] ?? 0;
  // Subtract `offset` days from the local date.
  const k = dateKeyInTz(at, tz);
  return shiftDateKey(k, -offset);
}

/** Add `days` to a "YYYY-MM-DD" key. Handles month/year boundaries. */
export function shiftDateKey(key: string, days: number): string {
  // Parse as UTC to avoid local-tz weirdness — we're treating the key as
  // a pure calendar date.
  const [y, m, d] = key.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Format a Date for human display in the dealership timezone. */
export function formatInTz(
  at: Date | string | null | undefined,
  tz: string = DEALERSHIP_TZ,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  if (!at) return "—";
  const d = typeof at === "string" ? new Date(at) : at;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...options }).format(d);
}
