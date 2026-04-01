"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { safeAuthNextPath } from "@/lib/auth-app-url";
import { markAuthSessionUnlocked } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Matches @supabase/auth-js EmailOtpType for verifyOtp({ token_hash, type }). */
const EMAIL_OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function AuthConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const tokenHash = searchParams.get("token_hash");
      const typeRaw = searchParams.get("type");
      const nextRaw = searchParams.get("next");

      if (!tokenHash?.trim() || !typeRaw?.trim()) {
        if (!cancelled) {
          setFatal(
            "This link is incomplete. Open the link from your email, or sign in from the login page."
          );
        }
        return;
      }

      const type = typeRaw.trim().toLowerCase();
      if (!EMAIL_OTP_TYPES.has(type)) {
        if (!cancelled) {
          setFatal("This sign-in link is not valid. Request a new link from the login page.");
        }
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash.trim(),
        type: type as
          | "signup"
          | "invite"
          | "magiclink"
          | "recovery"
          | "email_change"
          | "email",
      });

      if (cancelled) return;

      if (error) {
        console.error("Supabase verifyOtp error:", error);
        const msg = error.message?.toLowerCase() ?? "";
        setFatal(
          msg.includes("expired") || msg.includes("invalid") || msg.includes("already")
            ? "This link has expired or was already used. Please sign in again or request a new link."
            : error.message
        );
        return;
      }

      markAuthSessionUnlocked();
      const fallback = type === "recovery" ? "/reset-password" : "/dashboard";
      const nextPath = safeAuthNextPath(nextRaw, fallback);
      router.replace(nextPath);
      router.refresh();
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  if (fatal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Could not complete sign-in</CardTitle>
            <CardDescription>{fatal}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/login">Back to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <p className="text-muted-foreground text-sm">Completing sign-in…</p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <AuthConfirmInner />
    </Suspense>
  );
}
