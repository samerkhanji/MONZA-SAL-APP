"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  isPkceVerifierOrCrossDeviceError,
  PASSWORD_RESET_CROSS_DEVICE_USER_MESSAGE,
} from "@/lib/auth-app-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { parseAuthErrorParams } from "@/lib/auth-utils";

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
}

function friendlyExchangeError(err: { message?: string }): string {
  if (isPkceVerifierOrCrossDeviceError(err)) {
    return PASSWORD_RESET_CROSS_DEVICE_USER_MESSAGE;
  }
  const m = (err.message ?? "").toLowerCase();
  if (
    m.includes("expired") ||
    m.includes("invalid") ||
    m.includes("already been used") ||
    m.includes("already used") ||
    m.includes("bad code") ||
    m.includes("invalid request")
  ) {
    return "This reset link has expired, is invalid, or was already used. Please request a new password reset email from the login page.";
  }
  return err.message?.trim()
    ? `Could not verify your reset link: ${err.message} Try requesting a new reset email.`
    : "Could not verify your reset link. Please request a new password reset email from the login page.";
}

function friendlyUpdateError(err: { message?: string }): string {
  const m = (err.message ?? "").toLowerCase();
  if (
    m.includes("session") ||
    m.includes("not valid") ||
    m.includes("jwt") ||
    m.includes("auth session")
  ) {
    return "Your recovery session is no longer valid. Please request a new password reset email and open the latest link.";
  }
  return err.message ?? "Could not update password.";
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepareRecoverySession() {
      setInitializing(true);
      setError(null);
      setRecoveryReady(false);

      const supabase = createClient();

      const parsed = parseAuthErrorParams();
      const urlError = parsed.error ?? searchParams.get("error");
      const urlErrorDesc = parsed.error_description ?? searchParams.get("error_description");
      const urlErrorCode = parsed.error_code ?? searchParams.get("error_code");

      const search = new URLSearchParams(window.location.search);
      const hash = window.location.hash?.replace(/^#/, "") ?? "";
      const hashParams = hash ? new URLSearchParams(hash) : new URLSearchParams();
      const getAuthParam = (key: string) => search.get(key) ?? hashParams.get(key);

      const code = getAuthParam("code");
      const type = getAuthParam("type")?.toLowerCase();
      const tokenHash = getAuthParam("token_hash");

      if (urlError) {
        const decoded =
          urlErrorDesc != null
            ? decodeURIComponent(urlErrorDesc.replace(/\+/g, " "))
            : null;
        if (!cancelled) {
          if (urlErrorCode === "otp_expired") {
            setError(
              "This reset link expired or was already used (sometimes email apps open links before you do). Request a new password reset from the login page, then open the new link right away in the same browser."
            );
          } else {
            setError(
              decoded?.trim() ||
                "Password reset could not be completed. Please request a new reset email."
            );
          }
          setInitializing(false);
        }
        return;
      }

      if (tokenHash && type === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (cancelled) return;
        if (verifyError) {
          console.error("Supabase verifyOtp recovery error:", verifyError);
          setError(friendlyExchangeError(verifyError));
          setInitializing(false);
          return;
        }
        // Strip URL params silently — using router.replace would trigger a
        // useEffect re-run that races with the MFA check below.
        window.history.replaceState({}, "", "/reset-password");
        await maybePromptMfaThenReady(supabase);
        return;
      }

      if (code) {
        const {
          data: { session: existingAfterCode },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!existingAfterCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (exchangeError) {
            console.error("Supabase exchangeCodeForSession error:", exchangeError);
            setError(friendlyExchangeError(exchangeError));
            setInitializing(false);
            return;
          }
        }

        window.history.replaceState({}, "", "/reset-password");
        await maybePromptMfaThenReady(supabase);
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessionError) {
        console.error("Supabase getSession error:", sessionError);
        setError(friendlyExchangeError(sessionError));
        setInitializing(false);
        return;
      }

      if (!session?.user) {
        setError(
          "No valid recovery session. Open the link from your password reset email, or request a new reset email from the login page."
        );
        setInitializing(false);
        return;
      }

      await maybePromptMfaThenReady(supabase);
    }

    // Supabase requires AAL2 to update the password when MFA is enabled.
    // Prompt for the TOTP code after the recovery session is established
    // and elevate; otherwise updateUser fails with
    // "AAL2 session is required to update email or password when MFA is enabled".
    async function maybePromptMfaThenReady(supabase: ReturnType<typeof createClient>) {
      const { data: factorList } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      // listFactors().totp only contains verified factors.
      const verifiedFactor = factorList?.totp?.[0];
      if (verifiedFactor) {
        setMfaFactorId(verifiedFactor.id);
        setInitializing(false);
        return;
      }
      setRecoveryReady(true);
      setInitializing(false);
    }

    void prepareRecoverySession();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setError(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!mfaFactorId) return;
    const trimmed = mfaCode.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setMfaVerifying(true);
    const supabase = createClient();
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    });
    if (chErr || !challenge) {
      setMfaVerifying(false);
      setError(chErr?.message ?? "Could not start two-factor verification.");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: trimmed,
    });
    setMfaVerifying(false);
    if (vErr) {
      setError(vErr.message);
      return;
    }
    setMfaFactorId(null);
    setMfaCode("");
    setRecoveryReady(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!recoveryReady) {
      setError("Your reset session is not ready yet. Wait a moment or open the link from your email again.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      setError(
        "Your recovery session is missing or expired. Please request a new password reset email."
      );
      setRecoveryReady(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      console.error("Supabase updateUser error:", updateError);
      setError(friendlyUpdateError(updateError));
      return;
    }

    // Clear must_change_password — they just SET a new password through the
    // recovery email flow, so the first-login prompt would be confusing.
    // Best-effort: if this fails (RLS, network), don't block the success
    // path — the user's password is already updated. FirstLoginGuard will
    // bounce them to /change-password on next dashboard load which they
    // can complete legitimately.
    const userId = session.user.id;
    try {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", userId);
    } catch (clearErr) {
      console.warn(
        "[reset-password] could not clear must_change_password flag:",
        clearErr
      );
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/login?resetSuccess=1");
      router.refresh();
    }, 2000);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm border-border shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initializing ? (
            <p className="text-muted-foreground text-sm">Verifying reset link…</p>
          ) : success ? (
            <p className="rounded-md bg-primary/10 p-3 text-sm text-foreground">
              Password updated. Redirecting to login…
            </p>
          ) : mfaFactorId ? (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              {error && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="mfa-recovery-code">Two-factor code</Label>
                <Input
                  id="mfa-recovery-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                  autoFocus
                  disabled={mfaVerifying}
                  className="tracking-widest text-center text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Two-factor auth is on for this account. Enter the 6-digit code
                  from your authenticator app to continue.
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={mfaVerifying || mfaCode.length !== 6}
              >
                {mfaVerifying ? "Verifying…" : "Verify and continue"}
              </Button>
            </form>
          ) : error && !recoveryReady ? (
            <div className="space-y-4">
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/login">Back to login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="reset-password"
                  name="reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={loading || !recoveryReady}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters, must contain at least one letter and one number.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="reset-confirm-password"
                  name="reset-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={loading || !recoveryReady}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !recoveryReady}>
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
