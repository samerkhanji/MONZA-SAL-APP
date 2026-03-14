"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { UserCapability } from "@/lib/contexts/UserContext";
import type { AppRole } from "@/lib/permissions";
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

const CAPABILITY_LABELS: Record<UserCapability, string> = {
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

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddEmployeeDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<AppRole>("assistant");
  const [capabilities, setCapabilities] = useState<UserCapability[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setJobTitle("");
    setDepartment("");
    setRole("assistant");
    setCapabilities([]);
    setIsActive(true);
    setTempPassword(null);
  }

  function toggleCapability(cap: UserCapability) {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Full name and email are required");
      return;
    }

    setSubmitting(true);
    setTempPassword(null);

    try {
      const res = await fetch("/api/team/add-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          job_title: jobTitle.trim() || null,
          department: department.trim() || null,
          user_role: role,
          capabilities,
          is_active: isActive,
          employment_status: isActive ? "active" : "inactive",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to add employee");
        setSubmitting(false);
        return;
      }

      setTempPassword(data.temp_password ?? null);
      toast.success("Employee added successfully");

      if (data.temp_password) {
        setTimeout(() => {
          onOpenChange(false);
          reset();
          onSuccess();
        }, 3000);
      } else {
        onOpenChange(false);
        reset();
        onSuccess();
      }
    } catch {
      toast.error("Failed to add employee");
    }
    setSubmitting(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="add-full-name">Full Name *</Label>
              <Input
                id="add-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="add-phone">Phone</Label>
            <Input
              id="add-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-2"
              placeholder="+961 ..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="add-job-title">Job Title</Label>
              <Input
                id="add-job-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mt-2"
                placeholder="e.g. Sales Manager"
              />
            </div>
            <div>
              <Label htmlFor="add-department">Department</Label>
              <Input
                id="add-department"
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
                  <span className="text-sm">{CAPABILITY_LABELS[cap]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="add-is-active"
              checked={isActive}
              onCheckedChange={(c) => setIsActive(c === true)}
            />
            <Label htmlFor="add-is-active" className="cursor-pointer">
              Active
            </Label>
          </div>
          {tempPassword && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
              <p className="font-medium">Temporary password (share with employee):</p>
              <code className="mt-1 block break-all font-mono text-xs">{tempPassword}</code>
              <p className="mt-2 text-muted-foreground">They should change it on first login.</p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
