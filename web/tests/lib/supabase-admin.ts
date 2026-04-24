// Service-role Supabase client — used ONLY from Playwright tests to verify DB
// state and clean up test-generated rows. Never import this from app code.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = (
  process.env.PLAYWRIGHT_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
)?.trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!URL || !KEY) {
  // Don't throw at import time — lets `playwright test --list` work without creds.
  console.warn(
    "[tests/supabase-admin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. " +
      "DB-verification tests will skip."
  );
}

export const hasAdmin = !!URL && !!KEY;

export const supabaseAdmin: SupabaseClient = hasAdmin
  ? createClient(URL!, KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : // Stub that throws if any test actually tries to use it
    (new Proxy(
      {},
      {
        get() {
          throw new Error(
            "supabaseAdmin called but env vars are missing — set SUPABASE_SERVICE_ROLE_KEY."
          );
        },
      }
    ) as unknown as SupabaseClient);

/** Used to prefix test rows so we can find and delete them later. */
export const QA_PREFIX = "QA_TEST_";
export function qaLabel(suffix = ""): string {
  return `${QA_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}${suffix}`;
}
