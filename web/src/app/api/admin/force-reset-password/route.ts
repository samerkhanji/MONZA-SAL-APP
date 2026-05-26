import { NextRequest, NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { getSessionUserAndRole } from "@/lib/server/session-app-role";
import { toPublicApiError } from "@/lib/server/api-error";
import { constantTimeEqualSecret } from "@/lib/server/constant-time-secret";

/**
 * POST /api/admin/force-reset-password
 * Body: { email: string, newPassword: string }
 * Header: Authorization: Bearer <ADMIN_API_SECRET>
 *
 * Defense in depth — ALL of the following are required:
 *   1. An authenticated session whose user_role is `owner`.
 *   2. A valid ADMIN_API_SECRET bearer token.
 * The shared secret alone is NOT sufficient: if it ever leaks, an attacker
 * still needs a live owner session. Owner accounts cannot be reset through
 * this tool (owner recovery goes through the Supabase dashboard), which
 * caps the blast radius. The acting owner is recorded in the audit event.
 *
 * Env: ADMIN_API_SECRET (strong random; per-environment, rotated),
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

  // 1. Require a signed-in owner. Checked before the secret so an attacker
  //    holding only the secret never reaches the comparison.
  const session = await getSessionUserAndRole();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.appRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Require the shared secret in addition to the owner session.
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer || !constantTimeEqualSecret(bearer, configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
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

  const perPage = 1000;
  let page = 1;
  let userId: string | null = null;

  while (page <= 50) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage });
    if (listError) {
      return NextResponse.json(
        { error: toPublicApiError(listError) },
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
    // Generic message + status so a non-existent account is indistinguishable
    // from an account this tool refuses to act on (user-enumeration defense).
    return NextResponse.json(
      { error: "Unable to reset password for that account." },
      { status: 400 }
    );
  }

  // Never reset an owner account through this tool. Owner-account recovery
  // must go through the Supabase dashboard — this caps the blast radius if
  // a privileged session is ever misused.
  const { data: targetProfile } = await admin
    .from("profiles")
    .select("user_role")
    .eq("id", userId)
    .maybeSingle();
  if ((targetProfile as { user_role?: string } | null)?.user_role === "owner") {
    // Same generic response as a non-existent account: never confirm whether
    // a given email maps to an (owner) account (user-enumeration defense).
    return NextResponse.json(
      { error: "Unable to reset password for that account." },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    return NextResponse.json(
      { error: toPublicApiError(updateError) },
      { status: 400 }
    );
  }

  // Audit log — records the target AND the acting owner so any misuse is
  // attributable. Service role bypasses RLS so this always lands.
  await admin.from("system_events").insert({
    event_type: "admin.force_reset_password",
    severity: "warning",
    message: `Password force-reset for ${email} by owner ${session.userId}`,
    metadata: {
      target_user_id: userId,
      target_email: email,
      actor_user_id: session.userId,
    },
  });

  return NextResponse.json({
    success: true,
    userId: updated.user?.id ?? userId,
    email: updated.user?.email ?? email,
  });
}
