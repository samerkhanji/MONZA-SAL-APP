"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay, PdiStatus } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatError } from "@/lib/error-messages";

const PDI_OPTIONS: { value: PdiStatus; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending", label: "Incomplete" },
];

interface PdiStatusDialogProps {
  car: CarDisplay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PdiStatusDialog({
  car,
  open,
  onOpenChange,
  onSuccess,
}: PdiStatusDialogProps) {
  const { canEditPdiStatusOnCar } = useUser();
  const supabase = createClient();
  const [status, setStatus] = useState<PdiStatus>("pending");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !car) return;
    setStatus(car.pdi_status ?? "pending");
  }, [open, car]);

  async function handleSave() {
    if (!car || !canEditPdiStatusOnCar) return;

    setSubmitting(true);
    const { error } = await supabase
      .from("cars")
      .update({ pdi_status: status })
      .eq("id", car.id);

    setSubmitting(false);
    if (error) {
      toast.error(`Failed to update: ${formatError(error)}`);
      return;
    }
    toast.success("PDI status updated");
    onSuccess();
    onOpenChange(false);
  }

  if (!car) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>PDI Status</DialogTitle>
          <DialogDescription>
            {car.brand} {car.model} — VIN:{" "}
            <span className="font-mono">{car.vin_short ?? car.vin?.slice(-8)}</span>
            {!canEditPdiStatusOnCar && (
              <span className="mt-2 block text-amber-600/90 dark:text-amber-400">
                View only — owners, assistants, and garage managers can change PDI.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-8">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PdiStatus)}
              disabled={!canEditPdiStatusOnCar}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PDI_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {canEditPdiStatusOnCar && (
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
