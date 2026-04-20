import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/public-env";

function constantTimeEqualSecret(a: string, b: string): boolean {
  try {
    const ha = createHash("sha256").update(a, "utf8").digest();
    const hb = createHash("sha256").update(b, "utf8").digest();
    return timingSafeEqual(ha, hb);
  } catch {
    return false;
  }
}

/**
 * POST /api/admin/force-reset-password
 * Body: { email: string, newPassword: string }
 * Header: Authorization: Bearer <ADMIN_API_SECRET>
 *
 * Uses service role only on the server. Does not send email or use PKCE.
 *
 * Env: ADMIN_API_SECRET (strong random; set in Vercel Production and Preview),
 *      SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 */
export async function POST(request: NextRequest) {
  const configuredSecret = process.env.ADMIN_API_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json(
      { error: "ADMIN_API_SECRET is not configured on the server." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer || !constantTimeEqualSecret(bearer, configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase service configuration is missing." },
      { status: 503 }
    );
  }

  let body: { email?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const email = emailRaw.toLowerCase();
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const perPage = 1000;
  let page = 1;
  let userId: string | null = null;

  while (page <= 50) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage });
    if (listError) {
      return NextResponse.json(
        { error: listError.message || "Failed to list users." },
        { status: 500 }
      );
    }
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (match) {
      userId = match.id;
      break;
    }
    if (users.length < perPage) break;
    page += 1;
  }

  if (!userId) {
    return NextResponse.json({ error: "No user found with that email." }, { status: 404 });
  }

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to update password." },
      { status: 400 }
    );
  }

  // Audit log — service role bypasses RLS so this always lands.
  await admin.from("system_events").insert({
    event_type: "admin.force_reset_password",
    severity: "warning",
    message: `Password force-reset for ${email}`,
    metadata: { target_user_id: userId, target_email: email },
  });

  return NextResponse.json({
    success: true,
    userId: updated.user?.id ?? userId,
    email: updated.user?.email ?? email,
  });
}
