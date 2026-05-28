"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { GarageBay, GarageJob } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatError } from "@/lib/error-messages";

interface JobRow extends GarageJob {
  cars?: {
    vin: string;
    brand: string;
    model: string;
    model_year: number | null;
    exterior_color: string | null;
  } | null;
}

export function AssignJobToBayDialog({
  open,
  onOpenChange,
  bay,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bay: GarageBay | null;
  onAssigned: () => void;
}) {
  const supabase = createClient();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !bay) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("garage_jobs")
        .select("*, cars:car_id(vin, brand, model, model_year, exterior_color)")
        .is("deleted_at", null)
        .is("garage_bay_id", null)
        .in("status", ["pending", "in_progress", "waiting_parts"]);

      if (error) {
        toast.error(formatError(error));
        setJobs([]);
      } else {
        // TODO(typed-supabase): JobRow narrows enum + adds is_battery_only:boolean,
        // while generated row has it as boolean|null. Aligning requires touching
        // all JobRow consumers.
        let list = (data as unknown as JobRow[]) ?? [];
        if (bay.bay_type === "battery_lab") {
          list = list.filter((j) => j.is_battery_only);
        } else {
          list = list.filter((j) => !j.is_battery_only);
        }
        setJobs(list);
      }
      setLoading(false);
    })();
  }, [open, bay, supabase]);

  async function assign(jobId: string) {
    if (!bay) return;
    setAssigning(jobId);
    // Atomic: updates the job, flips bay.status='occupied',
    // sets bay.current_job_id, sets bay_entered_at, and logs to
    // bay_assignment_history. Server enforces battery-lab routing.
    const { error } = await supabase.rpc("attach_job_to_bay", {
      p_job_id: jobId,
      p_bay_id: Number(bay.id),
    });
    setAssigning(null);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Job assigned to bay");
    onOpenChange(false);
    onAssigned();
  }

  if (!bay) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,92dvh)] flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign job to {bay.name}</DialogTitle>
        </DialogHeader>
        {bay.bay_type === "battery_lab" && (
          <p className="text-sm text-muted-foreground border-l-4 border-yellow-500 pl-3">
            Battery Lab: battery-unit jobs only. No full vehicle assignment.
          </p>
        )}
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No unassigned jobs in this category.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto pr-1">
            <ul className="space-y-2">
              {jobs.map((j) => {
                const c = j.cars;
                const label = c
                  ? `${c.brand} ${c.model} · ${c.vin.length > 10 ? `…${c.vin.slice(-8)}` : c.vin}`
                  : j.title;
                return (
                  <li
                    key={j.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium truncate">{j.title}</p>
                      <p className="text-muted-foreground truncate">{label}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={assigning === j.id}
                      onClick={() => void assign(j.id)}
                    >
                      {assigning === j.id ? "Assigning…" : "Assign"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
