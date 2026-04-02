import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicKey, getSupabaseUrl } from "./public-env";

/**
 * In-memory no-op storage so this client never reads/writes session state.
 */
const noopStorage = {
  getItem: (_key: string) => null as string | null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
};

/**
 * Legacy: non-PKCE client if you ever call the Supabase JS client’s password-recovery method from the browser.
 * **Prefer** `POST /api/auth/reset-password` with `fetch` (or `submitPasswordResetRequest`) so recovery mail
 * uses `admin.generateLink` + Resend and avoids `?code=` PKCE links.
 *
 * `@supabase/ssr` `createBrowserClient` uses PKCE; that client’s recovery call sends `code_challenge` and
 * tends to produce **`?code=`** links. This helper uses `flowType: "implicit"` for GoTrue `/recover` without PKCE.
 */
export function createClientForPasswordResetEmail(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: noopStorage as unknown as Storage,
    },
  });
}
