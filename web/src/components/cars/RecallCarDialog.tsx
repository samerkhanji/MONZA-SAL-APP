"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { formatError } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CarRecallState {
  recalled_at: string | null;
  recall_reason: string | null;
  recall_notes: string | null;
}

interface RecallCarDialogProps {
  carId: string;
  carVin: string;
  hasCustomer: boolean;
  current: CarRecallState | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RecallCarDialog({
  carId,
  carVin,
  hasCustomer,
  current,
  open,
  onOpenChange,
  onSuccess,
}: RecallCarDialogProps) {
  const supabase = createClient();
  const isRecalled = !!current?.recalled_at;

  const [reason, setReason] = useState<string>("shipping");
  const [notes, setNotes] = useState("");
  const [unlinkCustomer, setUnlinkCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(current?.recall_reason ?? "shipping");
    setNotes(current?.recall_notes ?? "");
    setUnlinkCustomer(hasCustomer);
  }, [open, current?.recall_reason, current?.recall_notes, hasCustomer]);

  async function handleRecall() {
    setSubmitting(true);
    const updates: Record<string, unknown> = {
      recalled_at: current?.recalled_at ?? new Date().toISOString(),
      recall_reason: reason,
      recall_notes: notes.trim() || null,
    };
    if (unlinkCustomer && hasCustomer) updates.customer_id = null;

    const { error } = await supabase.from("cars").update(updates).eq("id", carId);
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success(isRecalled ? "Recall updated" : "Car recalled to Voyah");
    onSuccess();
  }

  async function handleClear() {
    setSubmitting(true);
    const { error } = await supabase
      .from("cars")
      .update({ recalled_at: null, recall_reason: null, recall_notes: null })
      .eq("id", carId);
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Recall cleared");
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isRecalled ? "Manage recall" : "Recall to Voyah"}
          </DialogTitle>
          <DialogDescription>
            {isRecalled
              ? `VIN ${carVin} is recalled to the manufacturer.`
              : `Recall VIN ${carVin} back to the manufacturer (Voyah).`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shipping">Shipping</SelectItem>
                <SelectItem value="issue">Issue with the car</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recall-notes">Notes (optional)</Label>
            <Textarea
              id="recall-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the shipping arrangement or the issue"
              rows={3}
            />
          </div>

          {hasCustomer && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="recall-unlink"
                checked={unlinkCustomer}
                onCheckedChange={(c) => setUnlinkCustomer(c === true)}
              />
              <Label htmlFor="recall-unlink" className="font-normal leading-snug">
                Also unlink this car from its current customer
              </Label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isRecalled ? (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={submitting}
              className="text-destructive hover:text-destructive"
            >
              Clear recall
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleRecall} disabled={submitting}>
              {submitting
                ? "Saving…"
                : isRecalled
                  ? "Update recall"
                  : "Recall to Voyah"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
