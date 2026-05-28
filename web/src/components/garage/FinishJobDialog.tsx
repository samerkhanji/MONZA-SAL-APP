"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatError } from "@/lib/error-messages";

interface JobWithCar {
  id: string;
  title: string;
  cars?: {
    id: string;
    vin: string;
    brand: string;
    model: string;
  } | null;
}

interface FinishJobDialogProps {
  job: JobWithCar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FinishJobDialog({
  job,
  open,
  onOpenChange,
  onSuccess,
}: FinishJobDialogProps) {
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const canSubmit = description.trim().length > 0 || photoFile !== null;

  async function handleSubmit() {
    if (!job || !canSubmit) return;

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSubmitting(false);
      return;
    }

    const workDone = description.trim() || null;

    if (photoFile) {
      const timestamp = Date.now();
      const filePath = `${job.id}/job_card/${timestamp}_${photoFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from("job-documents")
        .upload(filePath, photoFile, {
          contentType: photoFile.type,
          upsert: false,
        });

      if (uploadError) {
        toast.error(`Upload failed: ${formatError(uploadError)}`);
        setSubmitting(false);
        return;
      }

      const { error: metaError } = await supabase.from("job_documents").insert({
        job_id: job.id,
        document_type: "job_card",
        file_name: photoFile.name,
        file_path: filePath,
        file_size: photoFile.size,
        mime_type: photoFile.type,
        notes: null,
        uploaded_by: user.id,
      });

      if (metaError) {
        toast.error("Failed to save document metadata");
        await supabase.storage.from("job-documents").remove([filePath]);
        setSubmitting(false);
        return;
      }
    }

    const { data: openEntries } = await supabase
      .from("job_time_entries")
      .select("id, started_at")
      .eq("job_id", job.id)
      .is("ended_at", null);
    const nowIso = new Date().toISOString();
    for (const row of openEntries ?? []) {
      const r = row as { id: string; started_at: string };
      const mins = Math.max(
        1,
        Math.round((Date.now() - new Date(r.started_at).getTime()) / 60000)
      );
      await supabase
        .from("job_time_entries")
        .update({ ended_at: nowIso, duration_minutes: mins })
        .eq("id", r.id);
    }

    const { error } = await supabase
      .from("garage_jobs")
      // started_at is NOT NULL in the generated schema; the prior code passed
      // null to clear it (silently rejected by Postgres). Local cast widens
      // the field so the existing intent compiles.
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        work_done: workDone,
        garage_bay_id: null,
        started_at: null,
      } as unknown as Database["public"]["Tables"]["garage_jobs"]["Update"])
      .eq("id", job.id);

    if (error) {
      toast.error(formatError(error));
      setSubmitting(false);
      return;
    }

    if (job.cars) {
      // Only return the car to `available` if it is actually in a service
      // status — never overwrite reserved / sold / recalled etc.
      const { data: carRow } = await supabase
        .from("cars")
        .select("status")
        .eq("id", job.cars.id)
        .single();
      const currentStatus = (carRow as { status?: string } | null)?.status ?? null;
      if (currentStatus === "service") {
        await supabase
          .from("cars")
          .update({ status: "available" })
          .eq("id", job.cars.id);
        await supabase.from("car_events").insert({
          car_id: job.cars.id,
          event_type: "status_changed",
          from_value: currentStatus,
          to_value: "available",
          note: `Job completed: ${job.title}`,
          created_by: user.id,
        });
      }
    }

    const { data: partsData } = await supabase
      .from("job_parts")
      .select("quantity, parts:part_id(part_name)")
      .eq("job_id", job.id);
    type PartRow = { quantity?: number; parts?: { part_name?: string }[] | { part_name?: string } | null };
    const partsList =
      ((partsData ?? []) as unknown as PartRow[])
        .map((p) => {
          const part = Array.isArray(p.parts) ? p.parts[0] : p.parts;
          const name = part?.part_name ?? "";
          return name ? `${(p.quantity ?? 1)}× ${name}` : "";
        })
        .filter(Boolean)
        .join(", ") || "None";

    const carVin = job.cars?.vin ?? "—";
    const workSummary = workDone ? (workDone.length > 80 ? `${workDone.slice(0, 80)}...` : workDone) : "See details";

    const { getProfileIdsByRole } = await import("@/lib/user-lookup");
    const assistantIds = await getProfileIdsByRole("assistant");
    if (assistantIds.length > 0) {
      await import("@/lib/notifications").then((m) =>
        m.createNotificationsForUsers(
          assistantIds,
          "Garage job completed",
          `Garage job completed: ${job.title} for VIN ${carVin}. Work done: ${workSummary}. Parts used: ${partsList}`,
          `/garage/jobs/${job.id}`
        )
      );
    }

    toast.success("Job completed");
    setDescription("");
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
    onSuccess();
    setSubmitting(false);
  }

  function handleClose(open: boolean) {
    if (!open) {
      setDescription("");
      setPhotoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    onOpenChange(open);
  }

  const car = job?.cars;
  const carLabel = car
    ? `${car.brand} ${car.model}${car.vin ? ` (${car.vin})` : ""}`
    : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-tour-id="finish-job-dialog">
        <DialogHeader>
          <DialogTitle>Complete Job</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Provide a description of work done or upload a photo of the job card.
        </p>
        {carLabel && (
          <p className="text-muted-foreground text-sm">Car: {carLabel}</p>
        )}
        <div className="space-y-4">
          <div>
            <Label>Description of work done</Label>
            <Textarea
              id="finish-job-description"
              name="finish-job-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of work performed..."
              rows={4}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Or upload photo of job card</Label>
            <div
              className="mt-2 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 transition-colors hover:border-muted-foreground/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                id="finish-job-photo"
                name="finish-job-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
              {photoFile ? (
                <p className="text-sm font-medium">{photoFile.name}</p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Tap to choose photo
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                JPEG, PNG, WebP
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Completing..." : "Complete Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
