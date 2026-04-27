"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

/**
 * MFA challenge page — shown after password sign-in if the user has a
 * verified TOTP factor. Escalates the session from AAL1 to AAL2 by
 * verifying the 6-digit code from their authenticator app.
 */
export default function MfaChallengePage() {
  // useSearchParams must be inside Suspense for Next.js static prerender;
  // wrap the inner component so the page itself can still prerender.
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center px-4">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <MfaChallengeInner />
    </Suspense>
  );
}

function MfaChallengeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") ?? "/";

  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // No session yet → can't challenge. Send them to login.
        router.replace("/login");
        return;
      }

      const { data: factors, error: lfErr } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (lfErr) {
        setError(lfErr.message);
        setBootstrapping(false);
        return;
      }
      const verified = (factors?.totp ?? []).find((f) => f.status === "verified");
      if (!verified) {
        // No factor enrolled → straight through.
        window.location.href = redirectTo.startsWith("/") ? redirectTo : "/";
        return;
      }

      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: verified.id,
      });
      if (cancelled) return;
      if (chErr || !challenge) {
        setError(chErr?.message ?? "Failed to start MFA challenge");
        setBootstrapping(false);
        return;
      }
      setFactorId(verified.id);
      setChallengeId(challenge.id);
      setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, redirectTo]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setVerifying(true);
    setError(null);
    const supabase = createClient();
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    setVerifying(false);
    if (vErr) {
      setError(vErr.message);
      return;
    }
    toast.success("Verified");
    window.location.href = redirectTo.startsWith("/") ? redirectTo : "/";
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bootstrapping ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="mfa-code">Code</Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 text-center text-2xl tracking-widest"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={verifying || code.length !== 6}>
                {verifying ? "Verifying…" : "Verify"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={async () => {
                  await createClient().auth.signOut();
                  router.replace("/login");
                }}
              >
                Sign out
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
