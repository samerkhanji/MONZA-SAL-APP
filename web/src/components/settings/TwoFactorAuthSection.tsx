"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatError } from "@/lib/error-messages";

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
  const [disableTarget, setDisableTarget] = useState<string | null>(null);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(formatError(error));
      setFactors([]);
    } else {
      // Read data.all, not data.totp — listFactors()'s `totp` array only
      // includes VERIFIED factors, so a dangling unverified factor would be
      // invisible here and silently block re-enrollment.
      const all: Factor[] = (data?.all ?? [])
        .filter((f) => f.factor_type === "totp")
        .map((f) => ({
          id: f.id,
          factor_type: "totp" as const,
          status: f.status as "verified" | "unverified",
          friendly_name: f.friendly_name ?? undefined,
        }));
      setFactors(all);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startEnroll() {
    setEnrolling(true);
    // Drop any pre-existing unverified factor first — Supabase rejects a
    // 2nd enroll with the same friendly_name ("That record already exists").
    // Re-list live instead of trusting React state (which may be stale), and
    // read data.all since data.totp hides unverified factors.
    const { data: live } = await supabase.auth.mfa.listFactors();
    const stale = (live?.all ?? []).filter(
      (f) => f.factor_type === "totp" && f.status === "unverified"
    );
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator app",
    });
    setEnrolling(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    // The mfa.enroll TOTP response includes `id` + `totp` — the SDK union
    // type also includes phone-factor variants we don't use here.
    if (data && "totp" in data && data.totp) {
      setEnrollment({
        id: data.id,
        totp: {
          qr_code: data.totp.qr_code,
          secret: data.totp.secret,
          uri: data.totp.uri,
        },
      });
    }
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
      toast.error(chErr ? formatError(chErr) : "Failed to start MFA challenge");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: enrollment.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setVerifying(false);
    if (vErr) {
      toast.error(formatError(vErr));
      return;
    }
    toast.success("Two-factor authentication enabled");
    setEnrollment(null);
    setCode("");
    void refresh();
  }

  async function confirmDisable() {
    if (!disableTarget) return;
    const trimmed = disableCode.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setDisabling(true);
    // Fresh challenge + verify before unenroll: without this a stolen AAL1
    // session could disable MFA and keep persistent access.
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: disableTarget,
    });
    if (chErr || !challenge) {
      setDisabling(false);
      toast.error(chErr ? formatError(chErr) : "Failed to start verification");
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: disableTarget,
      challengeId: challenge.id,
      code: trimmed,
    });
    if (vErr) {
      setDisabling(false);
      toast.error(formatError(vErr));
      return;
    }
    const { error: unErr } = await supabase.auth.mfa.unenroll({
      factorId: disableTarget,
    });
    setDisabling(false);
    if (unErr) {
      toast.error(formatError(unErr));
      return;
    }
    toast.success("Two-factor authentication disabled");
    setDisableTarget(null);
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisableTarget(verified.id)}
            >
              Disable two-factor auth
            </Button>
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
                  // Clean up the pending unverified factor so it doesn't
                  // block the next enroll attempt.
                  if (enrollment) {
                    void supabase.auth.mfa.unenroll({ factorId: enrollment.id });
                  }
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

      <AlertDialog
        open={disableTarget !== null}
        onOpenChange={(open) => {
          if (!open && !disabling) {
            setDisableTarget(null);
            setDisableCode("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove two-factor authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your current 6-digit code to disable two-factor auth. After this
              you&apos;ll only need a password to log in until you re-enable it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
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
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disabling}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirmDisable}
              disabled={disabling || disableCode.length !== 6}
            >
              {disabling ? "Disabling…" : "Disable 2FA"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
