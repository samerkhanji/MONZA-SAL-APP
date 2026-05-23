import { NextRequest, NextResponse } from "next/server";
import {
  getPasswordResetRedirectUrlFromServer,
  validatePasswordResetRedirectUrl,
} from "@/lib/auth-app-url";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/public-env";

const GOTRUE_API_VERSION = "2024-01-01";

function redactEmail(e: string): string {
  const [local, domain] = e.split("@");
  if (!domain) return "***";
  return `${local.length <= 2 ? "*" : local.slice(0, 2)}***@${domain}`;
}

function passwordResetServerDebug(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.DEBUG_PASSWORD_RESET === "1" ||
    process.env.NEXT_PUBLIC_DEBUG_PASSWORD_RESET === "1"
  );
}

/**
 * Triggers Supabase GoTrue recovery email using a **minimal** `/recover` body (`{ email }` only) and
 * `redirect_to` as a query param — no `code_challenge`, so the project’s email template can use
 * `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery` without PKCE `?code=` links.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  const origin = request.headers.get("origin");
  const redirectTo = getPasswordResetRedirectUrlFromServer(origin);
  const invalid = validatePasswordResetRedirectUrl(redirectTo);
  if (invalid) {
    console.error("[PasswordResetDebug server] invalid redirectTo:", redirectTo, invalid);
    return NextResponse.json(
      { error: "Password reset redirect is misconfigured on the server." },
      { status: 503 }
    );
  }

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabasePublicKey();
  if (!supabaseUrl || !anonKey) {
    console.error("[PasswordResetDebug server] missing NEXT_PUBLIC_SUPABASE_URL or anon/publishable key");
    return NextResponse.json(
      { error: "Password reset is temporarily unavailable." },
      { status: 503 }
    );
  }

  if (passwordResetServerDebug()) {
    console.info("[PasswordResetDebug server]", {
      redirectTo,
      originHeader: origin,
      nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "(unset)",
      matchesProductionCanonical: redirectTo === "https://monzasal.vercel.app/reset-password",
      email: redactEmail(email),
    });
  }

  const base = supabaseUrl.replace(/\/$/, "");
  const recoverUrl = `${base}/auth/v1/recover?${new URLSearchParams({ redirect_to: redirectTo })}`;

  try {
    const res = await fetch(recoverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "X-Supabase-Api-Version": GOTRUE_API_VERSION,
      },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (passwordResetServerDebug()) {
        console.warn("[PasswordResetDebug server] GoTrue /recover non-OK:", res.status, text.slice(0, 800));
      }
    }
  } catch (e) {
    if (passwordResetServerDebug()) {
      console.warn("[PasswordResetDebug server] fetch error:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
