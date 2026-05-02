"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert } from "lucide-react";

/**
 * Two-Factor Authentication enrollment + management.
 *
 * Each user can have at most 1 TOTP factor (matches the project setting
 * "Maximum number of per-user MFA factors = 1"). Flow:
 *   1. List factors → if user has a verified one, show "Enabled".
 *   2. Otherwise: enroll → server returns QR + secret → user scans in
 *      authenticator app → enters 6-digit code → verify → done.
 *   3. Unenroll: disables MFA for the user. Owner can do this for
 *      themselves; recovery for other users requires Supabase Dashboard.
 *
 * NOTE: per-table AAL2 enforcement (RLS RESTRICTIVE policies requiring
 * AAL2) is intentionally NOT enabled yet. Until every employee has
 * enrolled, turning on AAL2 RLS would lock people out of basic queries.
 * Once mfa_verified count == 7, we can re-enable those.
 */

type Factor = {
  id: string;
  factor_type: "totp" | "phone";
  status: "verified" | "unverified";
  friendly_name?: string;
};

type EnrollResult = {
  id: string;
  totp: { qr_code: string; secret: string; uri: string };
};

export function TwoFactorAuthSection() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollment, setEnrollment] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [disablePrompt, setDisablePrompt] = useState<{ factorId: string } | null>(null);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message);
      setFactors([]);
    } else {
      const all: Factor[] = [
        ...(data?.totp ?? []).map((f) => ({
          id: f.id,
          factor_type: "totp" as const,
          status: f.status as "verified" | "unverified",
          friendly_name: f.friendly_name ?? undefined,
        })),
      ];
      setFactors(all);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startEnroll() {
    setEnrolling(true);
    // Drop any pre-existing unverified factor first (Supabase rejects a
    // 2nd enroll while one is pending).
    const pending = factors.find((f) => f.status === "unverified");
    if (pending) {
      await supabase.auth.mfa.unenroll({ factorId: pending.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    setEnrolling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnrollment(data as unknown as EnrollResult);
  }

  async function verifyCode() {
    if (!enrollment) return;
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setVerifying(true);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: enrollment.id,
    });
    if (chErr || !challenge) {
      setVerifying(false);
      toast.error(chErr?.message ?? "Failed to start MFA challenge");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: enrollment.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setVerifying(false);
    if (vErr) {
      toast.error(vErr.message);
      return;
    }
    toast.success("Two-factor authentication enabled");
    setEnrollment(null);
    setCode("");
    void refresh();
  }

  function startDisable(factorId: string) {
    setDisableCode("");
    setDisablePrompt({ factorId });
  }

  function cancelDisable() {
    setDisablePrompt(null);
    setDisableCode("");
  }

  async function confirmDisable() {
    if (!disablePrompt) return;
    const trimmed = disableCode.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setDisabling(true);
    // Require a fresh challenge + verify before unenroll. Without this,
    // a stolen AAL1 session could disable MFA and keep persistent access.
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: disablePrompt.factorId,
    });
    if (chErr || !challenge) {
      setDisabling(false);
      toast.error(chErr?.message ?? "Failed to start verification");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: disablePrompt.factorId,
      challengeId: challenge.id,
      code: trimmed,
    });
    if (vErr) {
      setDisabling(false);
      toast.error(vErr.message);
      return;
    }
    const { error: unErr } = await supabase.auth.mfa.unenroll({
      factorId: disablePrompt.factorId,
    });
    setDisabling(false);
    if (unErr) {
      toast.error(unErr.message);
      return;
    }
    toast.success("Two-factor authentication disabled");
    setDisablePrompt(null);
    setDisableCode("");
    void refresh();
  }

  const verified = factors.find((f) => f.status === "verified");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {verified ? (
            <ShieldCheck className="size-5 text-green-600" />
          ) : (
            <ShieldAlert className="size-5 text-amber-600" />
          )}
          Two-factor authentication (TOTP)
        </CardTitle>
        <CardDescription>
          Adds a 6-digit code from an authenticator app on top of your password.
          Strongly recommended for owner and assistant accounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : verified ? (
          <div className="space-y-3">
            <div className="rounded-md border border-green-500/30 bg-green-50 p-3 text-sm dark:bg-green-950">
              ✓ Two-factor authentication is <span className="font-semibold">enabled</span>.
            </div>
            {disablePrompt ? (
              <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-50 p-3 dark:bg-amber-950">
                <p className="text-sm">
                  Enter your current 6-digit code to disable two-factor auth. After this you&apos;ll
                  only need a password to log in until you re-enable it.
                </p>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                  className="max-w-[140px] tracking-widest text-center text-lg"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={confirmDisable}
                    disabled={disabling || disableCode.length !== 6}
                  >
                    {disabling ? "Disabling…" : "Confirm disable"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelDisable} disabled={disabling}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => startDisable(verified.id)}
              >
                Disable two-factor auth
              </Button>
            )}
          </div>
        ) : enrollment ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Step 1. Scan this QR code in your authenticator app</p>
              <p className="text-xs text-muted-foreground mb-3">
                Recommended apps: 1Password, Authy, Google Authenticator, Microsoft Authenticator.
              </p>
              {/* Supabase returns QR as inline SVG data URL */}
              <img
                src={enrollment.totp.qr_code}
                alt="MFA QR code"
                width={180}
                height={180}
                className="rounded-md border bg-white p-2"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Can&apos;t scan? Enter this code manually:
                <span className="ml-1 font-mono">{enrollment.totp.secret}</span>
              </p>
            </div>
            <div>
              <Label htmlFor="mfa-code">Step 2. Enter the 6-digit code your app shows</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1 max-w-[140px] tracking-widest text-center text-lg"
                autoComplete="one-time-code"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyCode} disabled={verifying || code.length !== 6}>
                {verifying ? "Verifying…" : "Verify and enable"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEnrollment(null);
                  setCode("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={startEnroll} disabled={enrolling}>
            {enrolling ? "Generating…" : "Enable two-factor authentication"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
