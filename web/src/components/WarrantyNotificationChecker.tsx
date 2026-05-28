"use client";

/**
 * Deprecated — kept as a no-op render so any leftover imports keep
 * compiling. Warranty-expiry notifications are now produced exclusively
 * server-side via the `detect_warranty_expiry` pg_cron job (runs daily
 * at 06:00 UTC, see supabase/migrations/092_test_drive_and_warranty_crons.sql)
 * and the `notify_expiring_warranties(int)` cron-callable function
 * (vehicle + battery warranties, see migration 067).
 *
 * The previous client-side implementation ran in every signed-in user's
 * browser on dashboard load. With N users it produced N concurrent races
 * fanning out duplicate notifications: each tab fetched the dedupe ledger,
 * computed a `sentSet` in memory, then INSERTed — the in-memory set was
 * stale relative to other tabs/users, so the UNIQUE constraint on
 * `warranty_notifications_sent(car_id, warranty_type, threshold_days)`
 * would block dupes only at the row level, AFTER notifications had
 * already been broadcast.
 *
 * Server-side cron is the canonical path going forward — single writer,
 * one schedule, no race window.
 */
export function WarrantyNotificationChecker() {
  return null;
}
