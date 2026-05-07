"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { UserCapability } from "@/lib/contexts/UserContext";
import type { AppRole } from "@/lib/permissions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatError } from "@/lib/error-messages";

const CAPABILITY_LABELS: Record<UserCapability, string> = {
  garage: "Garage",
  vehicle_software: "Software",
  cashier: "Cashier",
  events_ops: "Events",
  sales: "Sales",
  inventory: "Inventory",
  manage_team: "Manage Team",
  edit_users: "Edit Users",
  deactivate_users: "Deactivate Users",
  view_reports: "View Reports",
  data_health: "Data Health",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  assistant: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  hybrid:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  it: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  garage_manager:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  garage_staff:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  sales_ops: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
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
  email: string | null;
  phone: string | null;
  job_title?: string | null;
  department?: string | null;
  user_role: AppRole | null;
  capabilities: UserCapability[];
  is_active: boolean;
  employment_status?: string | null;
  terminated_at?: string | null;
  termination_reason?: string | null;
  created_at?: string;
}

interface EditTeamMemberDialogProps {
  profile: ProfileRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currentUserId?: string | null;
  onRefreshSelf?: () => Promise<void>;
}

export function EditTeamMemberDialog({
  profile,
  open,
  onOpenChange,
  onSuccess,
  currentUserId,
  onRefreshSelf,
}: EditTeamMemberDialogProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<AppRole>("assistant");
  const [capabilities, setCapabilities] = useState<UserCapability[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [terminationReason, setTerminationReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  useEffect(() => {
    if (profile && open) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setJobTitle(profile.job_title ?? "");
      setDepartment(profile.department ?? "");
      setRole(profile.user_role ?? "assistant");
      setCapabilities(profile.capabilities ?? []);
      setIsActive(profile.is_active ?? true);
      setTerminationReason(profile.termination_reason ?? "");
      setDeactivateOpen(false);
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
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
        user_role: role,
        capabilities,
        is_active: isActive,
        employment_status: isActive ? "active" : "inactive",
        terminated_at: isActive ? null : new Date().toISOString(),
        termination_reason: isActive ? null : terminationReason.trim() || null,
      })
      .eq("id", profile.id);

    setSubmitting(false);

    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Team member updated");
    onOpenChange(false);
    onSuccess();
    if (profile.id === currentUserId && onRefreshSelf) {
      await onRefreshSelf();
    }
  }

  async function handleDeactivate() {
    if (!profile) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        is_active: false,
        employment_status: "inactive",
        terminated_at: new Date().toISOString(),
        termination_reason: terminationReason.trim() || null,
      })
      .eq("id", profile.id);

    setSubmitting(false);
    setDeactivateOpen(false);

    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Employee deactivated");
    onOpenChange(false);
    onSuccess();
    if (profile.id === currentUserId && onRefreshSelf) {
      await onRefreshSelf();
    }
  }

  async function handleReactivate() {
    if (!profile) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        is_active: true,
        employment_status: "active",
        terminated_at: null,
        termination_reason: null,
      })
      .eq("id", profile.id);

    setSubmitting(false);

    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Employee reactivated");
    onOpenChange(false);
    onSuccess();
    if (profile.id === currentUserId && onRefreshSelf) {
      await onRefreshSelf();
    }
  }

  function toggleCapability(cap: UserCapability) {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {profile?.email && (
            <div>
              <Label className="text-muted-foreground">Login email (read-only)</Label>
              <p className="mt-1 text-sm font-medium">{profile.email}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="team-member-full-name">Full Name *</Label>
              <Input
                id="team-member-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="team-member-phone">Phone</Label>
              <Input
                id="team-member-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2"
                placeholder="+961 ..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="job-title">Job Title</Label>
              <Input
                id="job-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mt-2"
                placeholder="e.g. Sales Manager"
              />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-2"
                placeholder="e.g. Sales, Garage"
              />
            </div>
          </div>
          <div>
            <Label>Role *</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(USER_ROLE_LABELS) as AppRole[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Capabilities</Label>
            <div className="mt-2 flex flex-wrap gap-4">
              {CAPABILITIES.map((cap) => (
                <label
                  key={cap}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <Checkbox
                    checked={capabilities.includes(cap)}
                    onCheckedChange={() => toggleCapability(cap)}
                  />
                  <span className="text-sm">{CAPABILITY_LABELS[cap] ?? cap}</span>
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
          {!isActive && (
            <div>
              <Label htmlFor="termination_reason">Termination reason (optional)</Label>
              <Input
                id="termination_reason"
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                className="mt-2"
                placeholder="e.g. Resigned, End of contract"
              />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {profile?.is_active && (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeactivateOpen(true)}
                  disabled={submitting}
                >
                  Deactivate Employee
                </Button>
                <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deactivate this employee?</AlertDialogTitle>
                      <AlertDialogDescription>
                        They will be marked inactive and cannot log in. Historical records (sales, garage, requests) will remain linked.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                      <Label htmlFor="deactivate-reason">Reason (optional)</Label>
                      <Input
                        id="deactivate-reason"
                        placeholder="e.g. Resigned, End of contract"
                        value={terminationReason}
                        onChange={(e) => setTerminationReason(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <Button
                        variant="destructive"
                        disabled={submitting}
                        onClick={handleDeactivate}
                      >
                        Deactivate
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {!profile?.is_active && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReactivate}
                disabled={submitting}
              >
                Reactivate Employee
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
