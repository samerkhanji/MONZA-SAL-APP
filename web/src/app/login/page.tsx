"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getPasswordResetRedirectUrl } from "@/lib/auth-app-url";
import { isConnectionError } from "@/lib/auth-utils";
import {
  clearAuthSessionMarkers,
  idleLogoutMinutesForDisplay,
  markAuthSessionUnlocked,
} from "@/lib/auth-session";
import { getAppRoleFromProfile } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/lib/contexts/ThemeContext";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirectTo");
  const redirectTo = redirectParam ?? "/dashboard";
  const reason = searchParams.get("reason");
  const resetSuccess = searchParams.get("resetSuccess") === "1";
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    clearAuthSessionMarkers();
    void supabase.auth.signOut();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(
        isConnectionError(signInError)
          ? "Connection failed. Please check your internet and try again."
          : signInError.message
      );
      return;
    }

    markAuthSessionUnlocked();

    // If an explicit redirectTo was provided, honor it.
    if (redirectParam) {
      const target = redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
      window.location.href = target;
      return;
    }

    // Otherwise, redirect based on user_role.
    const { data: userResult } = await supabase.auth.getUser();
    const authUser = userResult?.user ?? signInData?.user ?? null;

    let target = "/requests";
    if (authUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role, user_role")
        .eq("id", authUser.id)
        .maybeSingle();
      const appRole = getAppRoleFromProfile(profile as any);
      const ROLE_HOME_ROUTES: Record<string, string> = {
        owner: "/dashboard",
        assistant: "/assistant-dashboard",
        khalil_hybrid: "/requests",
        it: "/requests",
        garage_manager: "/garage",
        garage_staff: "/garage",
        sales_ops: "/customers",
      };
      if (appRole && ROLE_HOME_ROUTES[appRole]) {
        target = ROLE_HOME_ROUTES[appRole];
      }
    }

    window.location.href = target;
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim(),
      { redirectTo: getPasswordResetRedirectUrl() }
    );
    if (resetError) {
      setForgotError(resetError.message);
    } else {
      setForgotSuccess(true);
    }
    setForgotLoading(false);
  }

  function openForgotDialog() {
    setForgotOpen(true);
    setForgotEmail(email);
    setForgotError(null);
    setForgotSuccess(false);
  }

  const idleMin = idleLogoutMinutesForDisplay();
  const reasonMessage =
    reason === "inactive"
      ? idleMin != null
        ? `You were signed out after ${idleMin} minutes of inactivity.`
        : "You were signed out due to inactivity."
      : reason === "reauth"
        ? "Please sign in again to continue."
        : null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <img
        src={theme === "dark" ? "/images/login-hero-dark.png" : "/images/login-hero-light.png"}
        alt="Monza S.A.L."
        className="mb-6 max-w-[300px] w-auto"
      />
      <Card className="w-full max-w-sm border-border shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Monza S.A.L.</CardTitle>
          <CardDescription>
            Sign in to access the car inventory system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {reasonMessage && !error && (
              <p className="rounded-md bg-primary/10 p-3 text-sm text-foreground">
                {reasonMessage}
              </p>
            )}
            {resetSuccess && !error && (
              <p className="rounded-md bg-primary/10 p-3 text-sm text-foreground">
                Password updated successfully. Please sign in with your new password.
              </p>
            )}
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="login-email"
                name="login-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="login-password"
                name="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <button
            type="button"
            onClick={openForgotDialog}
            className="mt-4 w-full text-center text-muted-foreground text-sm hover:text-foreground hover:underline"
          >
            Forgot password?
          </button>
        </CardContent>
      </Card>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Enter your email and we&apos;ll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          {forgotSuccess ? (
            <div className="space-y-2 rounded-md bg-primary/10 p-3 text-sm text-foreground">
              <p>Check your inbox and spam for the reset link.</p>
              <p className="text-muted-foreground">
                Supabase only sends if this email is already registered. If nothing arrives, confirm
                the address matches your login, wait out rate limits, and in the Supabase dashboard
                check Authentication → URL Configuration (add{" "}
                <code className="rounded bg-background/80 px-1 py-0.5 text-xs">
                  http://localhost:3000/**
                </code>{" "}
                for local dev) and Project Settings → Auth for SMTP or email logs.
              </p>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {forgotError && (
                <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                  {forgotError}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  name="forgot-email"
                  type="email"
                  placeholder="you@company.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={forgotLoading}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? "Sending..." : "Send reset link"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
