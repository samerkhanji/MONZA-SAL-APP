"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay, CustomsStatus } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const CUSTOMS_OPTIONS: { value: CustomsStatus; label: string }[] = [
  { value: "cleared", label: "Complete" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "Incomplete" },
  { value: "exempt", label: "Exempt" },
];

interface CustomsDialogProps {
  car: CarDisplay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CustomsDialog({
  car,
  open,
  onOpenChange,
  onSuccess,
}: CustomsDialogProps) {
  const { canEditInventory } = useUser();
  const supabase = createClient();
  const [status, setStatus] = useState<CustomsStatus>("pending");
  const [amountPaid, setAmountPaid] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !car) return;
    setStatus(car.customs_status ?? "pending");
    setAmountPaid(
      car.customs_amount_paid != null ? String(car.customs_amount_paid) : ""
    );
    setCurrency(car.customs_amount_currency ?? "USD");
  }, [open, car]);

  async function handleSave() {
    if (!car || !canEditInventory) return;

    setSubmitting(true);
    const amountNum = amountPaid ? parseFloat(amountPaid) : null;
    if (amountNum !== null && (Number.isNaN(amountNum) || amountNum < 0)) {
      toast.error("Amount must be a positive number");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from("cars")
      .update({
        customs_status: status,
        customs_amount_paid: amountNum,
        customs_amount_currency: amountNum != null ? currency : null,
      })
      .eq("id", car.id);

    setSubmitting(false);
    if (error) {
      toast.error(`Failed to update: ${formatError(error)}`);
      return;
    }
    toast.success("Customs updated");
    onSuccess();
    onOpenChange(false);
  }

  if (!car) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Customs</DialogTitle>
          <DialogDescription>
            {car.brand} {car.model} — VIN:{" "}
            <span className="font-mono">{car.vin_short ?? car.vin?.slice(-8)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CustomsStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount paid</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                  <SelectItem value="LBP">LBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canEditInventory && (
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
