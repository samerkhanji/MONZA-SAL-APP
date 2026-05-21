import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/public-env";

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
