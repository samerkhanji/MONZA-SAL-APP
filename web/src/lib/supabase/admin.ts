/**
 * Centralized service-role Supabase client factory.
 *
 * NEVER import this file from a "use client" component. The bundler will
 * happily inline `process.env.SUPABASE_SERVICE_ROLE_KEY` into the client
 * payload if you do. This module is server-only.
 *
 * Use cases that legitimately need the service role:
 *   - Auth admin (createUser, deleteUser, generateLink, updateUserById)
 *   - Cross-row writes that intentionally bypass RLS (e.g. backfill)
 *   - Operations on auth.* schema
 *
 * If you only need the user's own privileges, use `lib/supabase/server.ts`
 * (cookie-bound) instead.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a service-role Supabase client, or null if env is missing.
 * Caller is responsible for returning a 500 when null is returned.
 */
export function tryCreateAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Same as tryCreateAdminClient but throws when env is missing. Use this
 * only when the caller cannot meaningfully proceed without the client.
 */
export function createAdminClient(): SupabaseClient {
  const client = tryCreateAdminClient();
  if (!client) {
    throw new Error(
      "Service-role Supabase client unavailable: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing"
    );
  }
  return client;
}
