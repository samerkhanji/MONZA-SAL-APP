import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicKey, getSupabaseUrl } from "./public-env";

/** For `resetPasswordForEmail` use `createClientForPasswordResetEmail` from `./password-reset-mail-client` — this client always uses PKCE, which forces `?code=` recovery links. */

export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase config. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to web/.env.local"
    );
  }
  return createBrowserClient(url, key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
    },
  });
}
