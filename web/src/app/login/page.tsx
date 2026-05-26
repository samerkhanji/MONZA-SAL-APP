"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { createClientForPasswordResetEmail } from "@/lib/supabase/password-reset-mail-client";
import { getPasswordResetRedirectUrl } from "@/lib/auth-app-url";
import { isConnectionError, safeRedirectTo } from "@/lib/auth-utils";
import {
  clearAuthSessionMarkers,
  idleLogoutMinutesForDisplay,
  markAuthSessionUnlocked,
} from "@/lib/auth-session";
import { getAppRoleFromProfile } from "@/lib/permissions";
import type { UserProfile } from "@/lib/contexts/UserContext";
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

const HERO_LIGHT_SRC = "/images/login-hero-light.png";
const HERO_DARK_SRC = "/images/login-hero-dark.png";
// Intrinsic size of the PNGs — providing both dimensions prevents the
// browser from reserving the wrong layout box before the image decodes
// (no CLS) and matches the natural 300x95 aspect ratio.
const HERO_WIDTH = 300;
const HERO_HEIGHT = 95;

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirectTo");
  // safeRedirectTo blocks `//evil.com`, `/\evil.com`, `/%2Fevil.com` etc.
  // that would otherwise pass the old `startsWith("/")` check and let
  // window.location.href escape the origin (open-redirect / phishing).
  const redirectTo = safeRedirectTo(redirectParam, "/dashboard");
  const reason = searchParams.get("reason");
  const resetSuccess = searchParams.get("resetSuccess") === "1";

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

    // MFA gate: if the user has a verified TOTP factor, the session is at
    // AAL1 and we redirect to /mfa to escalate to AAL2 before sending them
    // anywhere sensitive. listFactors() works at AAL1.
    // `redirectTo` is already safeRedirectTo'd at the top of the component.
    const nextTarget: string | null = redirectParam ? redirectTo : null;

    {
      const { data: factorsRes } = await supabase.auth.mfa.listFactors();
      const hasVerifiedTotp = (factorsRes?.totp ?? []).some(
        (f) => f.status === "verified"
      );
      if (hasVerifiedTotp) {
        const finalTarget = nextTarget ?? ""; // computed below if not provided
        const url = `/mfa${finalTarget ? `?redirectTo=${encodeURIComponent(finalTarget)}` : ""}`;
        window.location.href = url;
        return;
      }
    }

    // If an explicit redirectTo was provided, honor it.
    if (nextTarget) {
      window.location.href = nextTarget;
      return;
    }

    // Otherwise, redirect based on user_role.
    const { data: userResult } = await supabase.auth.getUser();
    const authUser = userResult?.user ?? signInData?.user ?? null;

    let target = "/requests";
    if (authUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, user_role")
        .eq("id", authUser.id)
        .maybeSingle();
      const appRole = getAppRoleFromProfile((profile ?? null) as unknown as UserProfile | null);
      const ROLE_HOME_ROUTES: Record<string, string> = {
        owner: "/dashboard",
        assistant: "/assistant-dashboard",
        hybrid: "/requests",
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

    const supabase = createClientForPasswordResetEmail();
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

  // Hero src is theme-aware but the previous `theme === "dark" ? ... : ...`
  // resolved only post-hydration, causing the wrong image to fetch first
  // and swap (extra request, late LCP). The inline head script in
  // app/layout.tsx already sets the `.dark` class on <html> before React
  // mounts, so we render both images server-side and let CSS pick the
  // visible one — the browser decodes only the visible one for paint.
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      {/* Hoisted into <head> by Next so the LCP image starts downloading
          alongside the HTML rather than after script-tag discovery. Both
          themes preload — they're 11-19KB PNGs each, smaller than a single
          font woff2, and only one is rendered. */}
      <link
        rel="preload"
        as="image"
        href={HERO_LIGHT_SRC}
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href={HERO_DARK_SRC}
        fetchPriority="high"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <picture className="mb-6 block">
        <img
          src={HERO_LIGHT_SRC}
          alt="Monza S.A.L."
          width={HERO_WIDTH}
          height={HERO_HEIGHT}
          fetchPriority="high"
          decoding="async"
          loading="eager"
          className="block dark:hidden max-w-[300px] w-auto h-auto"
        />
        <img
          src={HERO_DARK_SRC}
          alt=""
          aria-hidden="true"
          width={HERO_WIDTH}
          height={HERO_HEIGHT}
          fetchPriority="high"
          decoding="async"
          loading="eager"
          className="hidden dark:block max-w-[300px] w-auto h-auto"
        />
      </picture>
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
              <Label htmlFor="login-email">Email</Label>
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
              <Label htmlFor="login-password">Password</Label>
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
