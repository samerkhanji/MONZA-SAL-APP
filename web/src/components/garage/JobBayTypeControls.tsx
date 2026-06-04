"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { Json } from "@/lib/supabase/database.types";
import type {
  GarageBayType,
  GarageJobBayContextData,
} from "@/types/database";
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
import { formatLiveDuration } from "@/lib/garage-bays";
import { formatError } from "@/lib/error-messages";

// Per-bay-type working data lives in the `context` jsonb column of
// garage_job_bay_context — there are no flat paint_*/oven_*/etc. columns.
type Ctx = GarageJobBayContextData;

function paintActive(ctx: Ctx) {
  return !!(ctx.paint_started_at && !ctx.paint_ended_at);
}
function ovenActive(ctx: Ctx) {
  return !!(ctx.oven_started_at && !ctx.oven_ended_at);
}
function washActive(ctx: Ctx) {
  return !!(ctx.wash_started_at && !ctx.wash_ended_at);
}
function polishActive(ctx: Ctx) {
  return !!(ctx.polish_started_at && !ctx.polish_ended_at);
}

export function JobBayTypeControls({
  jobId,
  bayType,
  canEdit,
}: {
  jobId: string;
  bayType: GarageBayType | null;
  canEdit: boolean;
}) {
  const supabase = createClient();
  // `ctx` holds the parsed jsonb context; `rowExists` tracks whether a
  // garage_job_bay_context row has already been created for this job.
  const [ctx, setCtx] = useState<Ctx>({});
  const [rowExists, setRowExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("garage_job_bay_context")
      .select("context")
      .eq("job_id", jobId)
      .maybeSingle();
    if (error) {
      toast.error(formatError(error));
      setCtx({});
      setRowExists(false);
    } else if (data) {
      setCtx(((data as { context: Ctx | null }).context as Ctx) ?? {});
      setRowExists(true);
    } else {
      setCtx({});
      setRowExists(false);
    }
    setLoading(false);
  }, [jobId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      !bayType ||
      !["paint", "oven", "car_wash", "polish", "battery_lab"].includes(bayType)
    ) {
      return;
    }
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [bayType]);

  useEffect(() => {
    if (loading || !canEdit || rowExists || !bayType) return;
    if (!["paint", "oven", "car_wash", "polish", "battery_lab"].includes(bayType)) return;
    let cancelled = false;
    (async () => {
      const { error } = await supabase
        .from("garage_job_bay_context")
        .insert({ job_id: jobId, bay_type: bayType, context: {} });
      if (cancelled) return;
      if (error) {
        void load();
        return;
      }
      setRowExists(true);
      setCtx({});
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, canEdit, rowExists, bayType, jobId, supabase, load]);

  // Merge `partial` into the jsonb context and persist. Upserts the row if it
  // does not yet exist (bay_type is NOT NULL, so it must always be supplied).
  async function patch(partial: Ctx) {
    if (!bayType) return;
    setBusy(true);
    const next: Ctx = { ...ctx, ...partial };
    const { error } = await supabase
      .from("garage_job_bay_context")
      .upsert(
        {
          job_id: jobId,
          bay_type: bayType,
          context: next as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "job_id,bay_type" }
      );
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setRowExists(true);
    await load();
  }

  if (!bayType || ["normal", "pit", "ev", "body_work"].includes(bayType)) {
    return null;
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm">Loading bay tools…</p>
    );
  }

  const disabled = !canEdit || busy;

  if (bayType === "paint") {
    return (
      <div className="space-y-3 rounded-lg border border-violet-500/40 bg-card/50 p-4">
        <p className="text-sm font-medium text-violet-300">Paint bay</p>
        <div>
          <Label>Paint color</Label>
          <Input
            value={ctx.paint_color ?? ""}
            onChange={(e) =>
              setCtx((c) => ({ ...c, paint_color: e.target.value }))
            }
            onBlur={() => {
              void patch({ paint_color: ctx.paint_color || null });
            }}
            placeholder="Color code / name"
            disabled={!canEdit}
            className="mt-1"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {!paintActive(ctx) ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() =>
                void patch({ paint_started_at: new Date().toISOString(), paint_ended_at: null })
              }
            >
              Start painting
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                void patch({ paint_ended_at: new Date().toISOString() })
              }
            >
              Stop painting
            </Button>
          )}
        </div>
        {paintActive(ctx) && ctx.paint_started_at && (
          <p className="font-mono text-xs text-primary">
            Duration: {formatLiveDuration(ctx.paint_started_at)}
          </p>
        )}
      </div>
    );
  }

  if (bayType === "oven") {
    return (
      <div className="space-y-3 rounded-lg border border-orange-500/40 bg-card/50 p-4">
        <p className="text-sm font-medium text-orange-300">Oven</p>
        <div>
          <Label>Temperature (°C)</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={ctx.oven_temp_c ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setCtx((c) => ({
                ...c,
                oven_temp_c: v === "" ? null : parseFloat(v),
              }));
            }}
            onBlur={() => {
              void patch({ oven_temp_c: ctx.oven_temp_c ?? null });
            }}
            disabled={!canEdit}
            className="mt-1"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {!ovenActive(ctx) ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() =>
                void patch({ oven_started_at: new Date().toISOString(), oven_ended_at: null })
              }
            >
              Start oven
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => void patch({ oven_ended_at: new Date().toISOString() })}
            >
              Stop oven
            </Button>
          )}
        </div>
        {ovenActive(ctx) && ctx.oven_started_at && (
          <p className="font-mono text-xs text-primary">
            Run time: {formatLiveDuration(ctx.oven_started_at)}
          </p>
        )}
      </div>
    );
  }

  if (bayType === "car_wash") {
    return (
      <div className="space-y-3 rounded-lg border border-blue-500/40 bg-card/50 p-4">
        <p className="text-sm font-medium text-blue-300">Car wash</p>
        <div>
          <Label>Wash type</Label>
          <Select
            value={ctx.wash_type ?? "__unset__"}
            onValueChange={(v) => {
              const wt =
                v === "__unset__" ? null : (v as NonNullable<Ctx["wash_type"]>);
              setCtx((c) => ({ ...c, wash_type: wt }));
              void patch({ wash_type: wt });
            }}
            disabled={!canEdit || busy}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unset__">—</SelectItem>
              <SelectItem value="exterior">Exterior</SelectItem>
              <SelectItem value="interior">Interior</SelectItem>
              <SelectItem value="full">Full</SelectItem>
              <SelectItem value="detail">Detail</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {!washActive(ctx) ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() =>
                void patch({ wash_started_at: new Date().toISOString(), wash_ended_at: null })
              }
            >
              Start wash
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => void patch({ wash_ended_at: new Date().toISOString() })}
            >
              Stop wash
            </Button>
          )}
        </div>
        {washActive(ctx) && ctx.wash_started_at && (
          <p className="font-mono text-xs text-primary">
            Duration: {formatLiveDuration(ctx.wash_started_at)}
          </p>
        )}
      </div>
    );
  }

  if (bayType === "polish") {
    return (
      <div className="space-y-3 rounded-lg border border-teal-500/40 bg-card/50 p-4">
        <p className="text-sm font-medium text-teal-300">Polish bay</p>
        <div>
          <Label>Polish type</Label>
          <Input
            value={ctx.polish_type ?? ""}
            onChange={(e) =>
              setCtx((c) => ({ ...c, polish_type: e.target.value }))
            }
            onBlur={() => {
              void patch({ polish_type: ctx.polish_type || null });
            }}
            placeholder="e.g. Cut & compound"
            disabled={!canEdit}
            className="mt-1"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {!polishActive(ctx) ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() =>
                void patch({
                  polish_started_at: new Date().toISOString(),
                  polish_ended_at: null,
                })
              }
            >
              Start polish
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                void patch({ polish_ended_at: new Date().toISOString() })
              }
            >
              Stop polish
            </Button>
          )}
        </div>
        {polishActive(ctx) && ctx.polish_started_at && (
          <p className="font-mono text-xs text-primary">
            Duration: {formatLiveDuration(ctx.polish_started_at)}
          </p>
        )}
      </div>
    );
  }

  if (bayType === "battery_lab") {
    return (
      <div className="space-y-3 rounded-lg border border-yellow-500/50 bg-card/50 p-4">
        <p className="text-sm font-medium text-yellow-400">
          Battery lab — battery unit only (no car)
        </p>
        <div>
          <Label>Battery health (%)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={ctx.battery_health_pct ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setCtx((c) => ({
                ...c,
                battery_health_pct: v === "" ? null : parseFloat(v),
              }));
            }}
            onBlur={() => {
              void patch({ battery_health_pct: ctx.battery_health_pct ?? null });
            }}
            disabled={!canEdit}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Test notes</Label>
          <Input
            value={ctx.battery_test_notes ?? ""}
            onChange={(e) =>
              setCtx((c) => ({ ...c, battery_test_notes: e.target.value }))
            }
            onBlur={() => {
              void patch({ battery_test_notes: ctx.battery_test_notes || null });
            }}
            disabled={!canEdit}
            className="mt-1"
          />
        </div>
      </div>
    );
  }

  return null;
}
