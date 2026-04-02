import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicKey, getSupabaseUrl } from "./public-env";

/** For forgot-password email use `submitPasswordResetRequest` from `@/lib/request-password-reset` (server calls GoTrue `/recover` without PKCE). This client uses PKCE and must not be used for `resetPasswordForEmail`. */

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
