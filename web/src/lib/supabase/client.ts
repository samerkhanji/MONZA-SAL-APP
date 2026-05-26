import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicKey, getSupabaseUrl } from "./public-env";

/** Forgot-password: `fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })` or `submitPasswordResetRequest` from `@/lib/request-password-reset` — not the Supabase client’s recovery method (PKCE). */

// Module-level singleton: the Supabase browser client is safe to share across
// the entire app and MUST be a single instance so realtime channels,
// useCallback identities, and connection reuse work correctly. Calling
// `createBrowserClient` per React render (the previous behavior) breaks all of
// the above — see adversarial review PR #135 for context.
let cachedClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase config. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to web/.env.local"
    );
  }
  cachedClient = createBrowserClient(url, key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

/**
 * Test-only: drop the cached singleton so tests can re-evaluate config or
 * exercise the lazy-init path. Do not call from app code.
 */
export function __resetBrowserClientForTests(): void {
  cachedClient = undefined;
}
