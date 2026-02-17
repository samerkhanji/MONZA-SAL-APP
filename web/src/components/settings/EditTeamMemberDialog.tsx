"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { UserRole, UserCapability } from "@/lib/contexts/UserContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USER_ROLE_LABELS } from "@/lib/constants/user";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  sales: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  garage_manager:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  assistant: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const CAPABILITY_LABELS: Record<string, string> = {
  garage: "Garage",
  vehicle_software: "Software",
  cashier: "Cashier",
  events_ops: "Events",
};

const CAPABILITIES: UserCapability[] = [
  "garage",
  "vehicle_software",
  "cashier",
  "events_ops",
];

interface ProfileRow {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  capabilities: UserCapability[];
  is_active: boolean;
  created_at?: string;
}

interface EditTeamMemberDialogProps {
  profile: ProfileRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditTeamMemberDialog({
  profile,
  open,
  onOpenChange,
  onSuccess,
}: EditTeamMemberDialogProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("assistant");
  const [capabilities, setCapabilities] = useState<UserCapability[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile && open) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setRole(profile.role ?? "assistant");
      setCapabilities(profile.capabilities ?? []);
      setIsActive(profile.is_active ?? true);
    }
  }, [profile, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        role,
        capabilities,
        is_active: isActive,
      })
      .eq("id", profile.id);

    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Team member updated");
    onOpenChange(false);
    onSuccess();
  }

  function toggleCapability(cap: UserCapability) {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-2"
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-2"
              placeholder="+961 ..."
            />
          </div>
          <div>
            <Label>Role *</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Capabilities</Label>
            <div className="mt-2 space-y-2">
              {CAPABILITIES.map((cap) => (
                <label
                  key={cap}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Checkbox
                    checked={capabilities.includes(cap)}
                    onCheckedChange={() => toggleCapability(cap)}
                  />
                  <span>{CAPABILITY_LABELS[cap] ?? cap}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={isActive}
              onCheckedChange={(c) => setIsActive(c === true)}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
