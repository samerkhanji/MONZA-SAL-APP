"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import type { CarStatus, LocationType } from "@/types/database";
import { CAR_STATUS_LABELS, LOCATION_LABELS } from "@/types/database";
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

interface MoveCarDialogProps {
  carId: string;
  currentLocationType: LocationType;
  currentStatus: CarStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MoveCarDialog({
  carId,
  currentLocationType,
  currentStatus,
  open,
  onOpenChange,
  onSuccess,
}: MoveCarDialogProps) {
  const [locationType, setLocationType] = useState<LocationType>(currentLocationType);
  const [status, setStatus] = useState<CarStatus | "">(currentStatus);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    const trimmedNote = note.trim();
    const { error: rpcError } = await supabase.rpc("move_car", {
      p_car_id: carId,
      p_new_location_type: locationType,
      p_new_location_slot: "",
      ...(status ? { p_new_status: status } : {}),
      ...(trimmedNote ? { p_note: trimmedNote } : {}),
      ...(user?.id ? { p_user_id: user.id } : {}),
    });

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    onSuccess();
    onOpenChange(false);
    setNote("");
    setStatus(currentStatus);
    setLocationType(currentLocationType);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setLocationType(currentLocationType);
      setStatus(currentStatus);
      setNote("");
      setError(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-tour-id="move-car-dialog">
        <DialogHeader>
          <DialogTitle>Move car</DialogTitle>
          <DialogDescription>
            Change location and optionally status. An event will be logged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label>New location</Label>
            <Select
              value={locationType}
              onValueChange={(v) => setLocationType(v as LocationType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LOCATION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status (optional)</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as CarStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Keep current" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CAR_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Input
              id="move-car-note"
              name="move-car-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for event"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
