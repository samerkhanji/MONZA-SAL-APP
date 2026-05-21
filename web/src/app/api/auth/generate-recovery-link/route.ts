import { NextRequest, NextResponse } from "next/server";
import {
  getPasswordResetRedirectUrlFromServer,
  validatePasswordResetRedirectUrl,
} from "@/lib/auth-app-url";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { toPublicApiError } from "@/lib/server/api-error";

/**
 * **Does not send email.** Returns GoTrue’s `action_link` for debugging or for a custom mailer /
 * [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).
 *
 * Enable only when `PASSWORD_RESET_GENERATE_LINK_SECRET` is set. Call with header:
 * `x-recovery-link-secret: <same value>`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PASSWORD_RESET_GENERATE_LINK_SECRET?.trim();
  if (!secret || request.headers.get("x-recovery-link-secret") !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const origin = request.headers.get("origin");
  const redirectTo = getPasswordResetRedirectUrlFromServer(origin);
  const invalid = validatePasswordResetRedirectUrl(redirectTo);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error) {
    return NextResponse.json(
      { error: toPublicApiError(error), code: (error as { code?: string }).code },
      { status: 400 }
    );
  }

  return NextResponse.json({
    redirectTo,
    properties: data?.properties ?? null,
    user: data?.user ?? null,
  });
}
