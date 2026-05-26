"use client";

import { useState } from "react";
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
import { useUser } from "@/lib/contexts/UserContext";

export default function AdminForceResetPage() {
  // Defense in depth: the underlying API enforces `owner + ADMIN_API_SECRET`,
  // but the page itself was reachable by any signed-in user (or by anyone if
  // they could bypass auth) — letting them sit in front of the secret prompt.
  // Block render unless the viewer's app role is `owner`; show a neutral
  // "Access Denied" so we don't leak whether the route exists for non-owners
  // who don't already know it.
  const { loading, profile, isOwner } = useUser();
  if (loading) return null;
  if (!profile || !isOwner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md border-border shadow-md">
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              You don&apos;t have permission to view this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  return <ForceResetForm />;
}

function ForceResetForm() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setIsError(false);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/force-reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminSecret.trim()}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          newPassword,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        userId?: string;
      };

      if (!res.ok) {
        setIsError(true);
        setMessage(data.error ?? `Request failed (${res.status})`);
        return;
      }

      setMessage(
        data.success
          ? `Password updated for ${email.trim()} (user id: ${data.userId ?? "—"}).`
          : "Done."
      );
      setNewPassword("");
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-border shadow-md">
        <CardHeader>
          <CardTitle>Force password reset</CardTitle>
          <CardDescription>
            Sets a new password directly in Supabase Auth (no email, no PKCE). Requires{" "}
            <code className="text-xs">ADMIN_API_SECRET</code> on the server and the same value
            below. Use only from a trusted environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <p
                className={
                  isError
                    ? "rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                    : "rounded-md bg-primary/10 p-3 text-sm text-foreground"
                }
                role="alert"
              >
                {message}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="admin-secret">Admin API secret</Label>
              <Input
                id="admin-secret"
                name="admin-secret"
                type="password"
                autoComplete="off"
                placeholder="Same as ADMIN_API_SECRET on Vercel"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">User email</Label>
              <Input
                id="user-email"
                name="user-email"
                type="email"
                placeholder="user@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                name="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                disabled={submitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
