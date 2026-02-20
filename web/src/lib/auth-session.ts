"use client";

export const AUTH_UNLOCKED_KEY = "monza_auth_unlocked";
export const LAST_ACTIVITY_KEY = "monza_last_activity";
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

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
