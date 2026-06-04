"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  isPkceVerifierOrCrossDeviceError,
  PASSWORD_RESET_CROSS_DEVICE_USER_MESSAGE,
  safeAuthNextPath,
} from "@/lib/auth-app-url";
import { parseAuthCallbackParams } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message: string | null = null;
  const [fatal, setFatal] = useState<string | null>(null);

  const code = searchParams.get("code");
  const urlError = searchParams.get("error");
  const urlErrorDesc = searchParams.get("error_description");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createClient();
      const parsed = parseAuthCallbackParams();
      const nextRaw = parsed.next ?? searchParams.get("next");
      const type = parsed.type ?? searchParams.get("type");

      if (urlError) {
        const decoded =
          urlErrorDesc != null
            ? decodeURIComponent(urlErrorDesc.replace(/\+/g, " "))
            : null;
        if (!cancelled) {
          setFatal(
            decoded?.trim() ||
              "Sign-in link is invalid or expired. Request a new email from the login page."
          );
        }
        return;
      }

      if (code) {
        const {
          data: { session: existing },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!existing) {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (exchangeError) {
            console.error("Supabase exchangeCodeForSession error:", exchangeError);
            if (isPkceVerifierOrCrossDeviceError(exchangeError)) {
              setFatal(PASSWORD_RESET_CROSS_DEVICE_USER_MESSAGE);
              return;
            }
            setFatal(
              exchangeError.message?.toLowerCase().includes("expired") ||
                exchangeError.message?.toLowerCase().includes("invalid")
                ? "This link has expired or was already used. Please sign in again or request a new link."
                : exchangeError.message
            );
            return;
          }
          // PKCE stores redirect type (e.g. PASSWORD_RECOVERY) so we still land on /reset-password
          // when `next` / `type=recovery` are missing from the URL (common with email clients).
          const redirectType = (exchangeData as { redirectType?: string | null })?.redirectType;
          const isRecovery =
            redirectType === "PASSWORD_RECOVERY" ||
            redirectType === "recovery" ||
            type === "recovery";
          const fallback = isRecovery ? "/reset-password" : "/dashboard";
          const nextPath = safeAuthNextPath(nextRaw, fallback);
          router.replace(nextPath);
          router.refresh();
          return;
        }

        const fallback =
          type === "recovery" ? "/reset-password" : "/dashboard";
        const nextPath = safeAuthNextPath(nextRaw, fallback);
        router.replace(nextPath);
        router.refresh();
        return;
      }

      const fallback =
        type === "recovery" ? "/reset-password" : "/dashboard";
      const nextPath = safeAuthNextPath(nextRaw, fallback);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session?.user) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      setFatal(
        "Missing authorization code. Open the link from your email, or sign in from the login page."
      );
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [code, urlError, urlErrorDesc, searchParams, router]);

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
      <p className="text-muted-foreground text-sm">{message ?? "Completing sign-in…"}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
