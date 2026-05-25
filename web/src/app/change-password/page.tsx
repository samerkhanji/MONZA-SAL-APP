"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?redirectTo=change-password");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile || profile.must_change_password === false) {
        // Already changed password — bail out of this page.
        // Hard navigation guarantees UserContext re-fetches clean state.
        window.location.href = "/requests";
        return;
      }
      setLoading(false);
    })();
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pwError = validatePassword(newPassword);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      // 1) Confirm session before mutating.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("You must be signed in to change your password.");
      }

      // 2) Update auth password. Supabase rotates the JWT internally.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      // 3) Force session refresh so subsequent queries use the rotated token.
      await supabase.auth.refreshSession();

      // 4) Clear the flag *and verify the row actually updated*.
      //    Without .select() we wouldn't notice an RLS silent-reject.
      const { data: updatedRows, error: profileError } = await supabase
        .from("profiles")
        .update({
          must_change_password: false,
          onboarding_completed: false,
          onboarding_completed_at: null,
        })
        .eq("id", user.id)
        .select("id, must_change_password");

      if (profileError) throw profileError;

      if (!updatedRows || updatedRows.length === 0 || updatedRows[0].must_change_password !== false) {
        throw new Error(
          "Password was saved but we couldn't clear the reset flag. Please sign out and sign in again — if this keeps happening, contact an owner."
        );
      }

      // 5) Hard navigation (not router.replace) so the entire React tree remounts
      //    and no stale UserContext cache can loop us back here.
      window.location.replace("/requests");
      return; // stop execution so we don't re-enable the button
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Failed to set password.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background px-4 py-8">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader>
          <CardTitle>Welcome to Monza App</CardTitle>
          <CardDescription>
            Please set a new password to secure your account. You must complete this step
            before using the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters, must contain at least one letter and one number.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Setting password..." : "Set Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
