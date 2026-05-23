import { NextRequest, NextResponse } from "next/server";
import {
  getPasswordResetRedirectUrlFromServer,
  validatePasswordResetRedirectUrl,
} from "@/lib/auth-app-url";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

/**
 * Env (Vercel / server):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY — admin.generateLink only on server
 * - RESEND_API_KEY — https://resend.com/api-keys
 * - RESEND_FROM_EMAIL — verified sender, e.g. "Monza CRM <onboarding@resend.dev>" or your domain
 *
 * Optional: NEXT_PUBLIC_SITE_URL — used with Origin to compute redirectTo (allow-list in Supabase).
 * Production fallback matches https://monzasal.vercel.app/reset-password when unset.
 */
const RESEND_SEND_URL = "https://api.resend.com/emails";

function escapeHtmlAttr(url: string): string {
  return url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const raw = typeof body.email === "string" ? body.email.trim() : "";
  const email = raw.toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  const admin = tryCreateAdminClient();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!admin || !resendKey || !fromEmail) {
    console.error(
      "[api/auth/reset-password] Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, and/or RESEND_FROM_EMAIL"
    );
    return NextResponse.json(
      { error: "Password reset email is not configured on the server." },
      { status: 503 }
    );
  }

  const origin = request.headers.get("origin");
  const redirectTo = getPasswordResetRedirectUrlFromServer(origin);
  const redirectInvalid = validatePasswordResetRedirectUrl(redirectTo);
  if (redirectInvalid) {
    console.error("[api/auth/reset-password] Invalid redirectTo:", redirectTo, redirectInvalid);
    return NextResponse.json(
      { error: "Password reset redirect is misconfigured." },
      { status: 503 }
    );
  }

  const { data, error: genError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  const actionLink = data?.properties?.action_link;
  if (genError || !actionLink || typeof actionLink !== "string") {
    if (process.env.NODE_ENV === "development") {
      console.warn("[api/auth/reset-password] generateLink:", genError?.message ?? "no action_link");
    }
    return NextResponse.json({ ok: true });
  }

  const href = escapeHtmlAttr(actionLink);
  const html = `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5;">
  <h2>Reset your password</h2>
  <p>You asked to reset your password for Monza CRM. Open the link below on any device:</p>
  <p><a href="${href}">Reset your password</a></p>
  <p style="color:#666;font-size:14px;">If you did not request this, you can ignore this email.</p>
</body>
</html>`;

  const resendRes = await fetch(RESEND_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: "Reset your Monza CRM password",
      html,
    }),
  });

  if (!resendRes.ok) {
    const detail = await resendRes.text().catch(() => "");
    console.error("[api/auth/reset-password] Resend failed:", resendRes.status, detail.slice(0, 500));
    return NextResponse.json(
      { error: "Could not send the reset email. Try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
