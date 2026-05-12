"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatError } from "@/lib/error-messages";

interface TaskCategory {
  id: string;
  label_en: string;
  description: string | null;
  sla_hours: number;
  default_severity: "info" | "warning" | "urgent" | "critical";
  sort_order: number;
}

const SEVERITY_DOT: Record<TaskCategory["default_severity"], string> = {
  info: "bg-sky-500",
  warning: "bg-amber-500",
  urgent: "bg-orange-500",
  critical: "bg-red-600",
};

export function SetJobCategoryDialog({
  open,
  onOpenChange,
  jobId,
  currentKm,
  onCategorized,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string | null;
  currentKm?: number | null;
  onCategorized?: () => void;
}) {
  const supabase = createClient();
  const [cats, setCats] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kmInput, setKmInput] = useState<string>(
    currentKm != null ? String(currentKm) : ""
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setKmInput(currentKm != null ? String(currentKm) : "");
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from("task_categories")
        .select("id, label_en, description, sla_hours, default_severity, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        toast.error(formatError(error));
        setCats([]);
      } else {
        setCats((data as TaskCategory[]) ?? []);
      }
      setLoading(false);
    })();
  }, [open, supabase, currentKm]);

  async function submit() {
    if (!jobId || !selectedId) return;
    const kmNum = kmInput.trim() === "" ? null : Number(kmInput);
    if (kmNum != null && (isNaN(kmNum) || kmNum < 0)) {
      toast.error("Kilometers must be a non-negative number");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("set_garage_job_category", {
      p_job_id: jobId,
      p_category_id: selectedId,
      p_current_km: kmNum,
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    const result = (data ?? {}) as {
      tasks_created?: number;
      notifications_emitted?: number;
      sla_due_at?: string;
    };
    const tasks = result.tasks_created ?? 0;
    toast.success(
      tasks > 0
        ? `Category set · ${tasks} task${tasks === 1 ? "" : "s"} created`
        : "Category set"
    );
    onCategorized?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set intake category</DialogTitle>
          <DialogDescription>
            Pick the reason for visit. Tasks are created automatically and the
            right people are notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="km">Kilometers on the clock</Label>
          <Input
            id="km"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="e.g. 45120"
            value={kmInput}
            onChange={(e) => setKmInput(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Reason for visit</Label>
          {loading ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {cats.map((c) => {
                const sel = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
                      sel
                        ? "border-primary bg-primary/5 ring-primary/30 ring-2"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-medium">{c.label_en}</span>
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          SEVERITY_DOT[c.default_severity]
                        )}
                        title={c.default_severity}
                      />
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {c.description}
                    </p>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      SLA {c.sla_hours}h
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!selectedId || submitting}
          >
            {submitting ? "Setting…" : "Set category & create tasks"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
