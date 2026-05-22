import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/public-env";

// Per-user rate limit: at most VERIFY_RATE_LIMIT attempts per
// VERIFY_RATE_WINDOW_MS rolling window. Backed by api_rate_limit_events.
// Caps password-guessing attempts against the re-confirmation endpoint.
const VERIFY_RATE_LIMIT = 10;
const VERIFY_RATE_WINDOW_MS = 60_000;

type RateLimitClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Returns true if the user is within their verify-password rate limit (and
 * records this request), false if they are over the limit.
 *
 * Fails open: if the api_rate_limit_events table is missing (migration 143
 * not yet applied) or the query errors, we log a warning and allow the
 * request so the endpoint keeps working.
 */
async function checkVerifyRateLimit(
  supabase: RateLimitClient,
  userId: string
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - VERIFY_RATE_WINDOW_MS).toISOString();
    const { count, error } = await supabase
      .from("api_rate_limit_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("endpoint", "verify-password")
      .gte("created_at", since);

    if (error) {
      console.warn("[api/auth/verify-password] rate-limit check skipped:", error.message);
      return true;
    }

    if ((count ?? 0) >= VERIFY_RATE_LIMIT) {
      return false;
    }

    const { error: insertError } = await supabase
      .from("api_rate_limit_events")
      .insert({ user_id: userId, endpoint: "verify-password" });
    if (insertError) {
      console.warn(
        "[api/auth/verify-password] rate-limit record skipped:",
        insertError.message
      );
    }

    return true;
  } catch (e) {
    console.warn("[api/auth/verify-password] rate-limit check failed open:", e);
    return true;
  }
}

/**
 * Re-confirm the current user's password before a destructive action.
 *
 * The password check uses a throwaway, non-persistent Supabase client so that
 * signInWithPassword does NOT rotate the user's refresh token or replace their
 * real session cookies — verifying must not log the user out of other tabs.
 */
export async function POST(request: NextRequest) {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const withinLimit = await checkVerifyRateLimit(supabase, user.id);
  if (!withinLimit) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts — please wait a moment." },
      { status: 429 }
    );
  }

  const url = getSupabaseUrl();
  const key = getSupabasePublicKey();
  if (!url || !key) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const verifier = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: authError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (authError) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
