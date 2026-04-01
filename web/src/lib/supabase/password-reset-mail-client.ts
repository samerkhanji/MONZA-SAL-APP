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
 * Use **only** for `auth.resetPasswordForEmail`.
 *
 * `@supabase/ssr` `createBrowserClient` always sets `auth.flowType` to `"pkce"` after merging
 * options, which overrides `implicit`. With PKCE, `resetPasswordForEmail` sends `code_challenge`
 * to GoTrue `/recover`, and the server emails a **`?code=`** recovery link tied to that verifier.
 * Your custom template with `{{ .RedirectTo }}?token_hash=...` is then ignored/superseded for the
 * actual link behavior users see.
 *
 * This client uses `flowType: "implicit"` so `/recover` is called **without** a code challenge,
 * allowing token-based recovery emails to match your dashboard template.
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
