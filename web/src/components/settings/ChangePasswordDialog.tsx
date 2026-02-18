"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function validatePassword(pwd: string): {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  valid: boolean;
} {
  return {
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
    valid:
      pwd.length >= 8 &&
      /[A-Z]/.test(pwd) &&
      /[a-z]/.test(pwd) &&
      /\d/.test(pwd),
  };
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validation = validatePassword(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    validation.valid && passwordsMatch && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);

    if (error) {
      toast.error(`Failed to update password: ${error.message}`);
      return;
    }
    toast.success("Password updated successfully");
    setNewPassword("");
    setConfirmPassword("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="mt-2"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="mt-2"
              autoComplete="new-password"
            />
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="mb-2 font-medium">Requirements:</p>
            <ul className="space-y-1">
              <li
                className={`flex items-center gap-2 ${validation.minLength ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
              >
                {validation.minLength ? (
                  <Check className="size-4" />
                ) : (
                  <span className="size-4" />
                )}
                At least 8 characters
              </li>
              <li
                className={`flex items-center gap-2 ${validation.hasUpper ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
              >
                {validation.hasUpper ? (
                  <Check className="size-4" />
                ) : (
                  <span className="size-4" />
                )}
                Uppercase letter
              </li>
              <li
                className={`flex items-center gap-2 ${validation.hasLower ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
              >
                {validation.hasLower ? (
                  <Check className="size-4" />
                ) : (
                  <span className="size-4" />
                )}
                Lowercase letter
              </li>
              <li
                className={`flex items-center gap-2 ${validation.hasNumber ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
              >
                {validation.hasNumber ? (
                  <Check className="size-4" />
                ) : (
                  <span className="size-4" />
                )}
                Number
              </li>
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
