"use client";

export const AUTH_UNLOCKED_KEY = "monza_auth_unlocked";
export const LAST_ACTIVITY_KEY = "monza_last_activity";

/**
 * Client-side idle sign-out (in addition to Supabase JWT expiry).
 * 0 = disabled (default): session length follows Supabase / refresh token only.
 * Set NEXT_PUBLIC_IDLE_LOGOUT_MINUTES to a positive number (e.g. 15) to re-enable.
 */
function parseIdleLogoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_IDLE_LOGOUT_MINUTES;
  if (raw === undefined || raw === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const ms = n * 60 * 1000;
  const cap = 24 * 60 * 60 * 1000;
  return Math.min(ms, cap);
}

export const IDLE_TIMEOUT_MS = parseIdleLogoutMs();

/** Minutes for user-facing copy when idle logout is enabled (rounded). */
export function idleLogoutMinutesForDisplay(): number | null {
  if (IDLE_TIMEOUT_MS <= 0) return null;
  return Math.round(IDLE_TIMEOUT_MS / 60000);
}

export function markAuthSessionUnlocked() {
  if (typeof window === "undefined") return;
  const now = Date.now().toString();
  window.sessionStorage.setItem(AUTH_UNLOCKED_KEY, "1");
  window.sessionStorage.setItem(LAST_ACTIVITY_KEY, now);
}

export function clearAuthSessionMarkers() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_UNLOCKED_KEY);
  window.sessionStorage.removeItem(LAST_ACTIVITY_KEY);
}

/**
 * Shared sign-out routine used by every sign-out control in the app so they
 * behave identically: end the Supabase session, clear local markers, then do a
 * hard navigation to `/` to guarantee no authenticated client state survives.
 */
export async function signOut() {
  const { createClient } = await import("./supabase");
  const supabase = createClient();
  await supabase.auth.signOut();
  clearAuthSessionMarkers();
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}

export function hasAuthSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(AUTH_UNLOCKED_KEY) === "1";
}

export function readLastActivity(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(LAST_ACTIVITY_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function updateLastActivity(ts = Date.now()) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LAST_ACTIVITY_KEY, ts.toString());
}
