"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { GarageBay, GarageBayType, GarageJob, JobTimeEntry } from "@/types/database";
import {
  BAY_TYPE_BORDER,
  BAY_TYPE_GROUP_LABEL,
  BAY_TYPE_GROUP_ORDER,
  formatLiveDuration,
} from "@/lib/garage-bays";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssignJobToBayDialog } from "@/components/garage/AssignJobToBayDialog";
import { ManageBaysDialog } from "@/components/garage/ManageBaysDialog";
import { ReleaseBayMenu } from "@/components/garage/ReleaseBayMenu";
import { useUser } from "@/lib/contexts/UserContext";
import { Settings2, ScanLine } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { formatError } from "@/lib/error-messages";

interface JobInBay extends GarageJob {
  cars?: {
    vin: string;
    brand: string;
    model: string;
    model_year: number | null;
    exterior_color: string | null;
  } | null;
  profiles?: { full_name: string | null } | null;
}

interface OpenEntry extends JobTimeEntry {
  profiles?: { full_name: string | null } | null;
}

function StatusDot({ kind }: { kind: "green" | "yellow" | "red" }) {
  const cls =
    kind === "green"
      ? "bg-green-500"
      : kind === "yellow"
        ? "bg-yellow-500"
        : "bg-red-500";
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", cls)} aria-hidden />;
}

export function GarageBaySection({ onRefreshJobs }: { onRefreshJobs: () => void }) {
  const supabase = createClient();
  const { appRole, isOwner } = useUser();
  const canManageBays =
    isOwner || appRole === "garage_manager" || appRole === "hybrid";
  const canSeeActiveTimers =
    isOwner || appRole === "garage_manager" || appRole === "assistant" || appRole === "hybrid";

  const [bays, setBays] = useState<GarageBay[]>([]);
  const [jobsByBay, setJobsByBay] = useState<Record<string, JobInBay>>({});
  const [openEntriesByJob, setOpenEntriesByJob] = useState<Record<string, OpenEntry>>({});
  const [, setTick] = useState(0);

  const [assignBay, setAssignBay] = useState<GarageBay | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [scanBay, setScanBay] = useState<GarageBay | null>(null);

  const handleScanIntoBay = useCallback(
    async (vin: string) => {
      if (!scanBay) return;
      const trimmed = vin.trim().toUpperCase();
      if (!trimmed) return;
      const { error } = await supabase.rpc("scan_vin_to_bay", {
        p_vin: trimmed,
        p_bay_id: scanBay.id,
      });
      if (error) {
        toast.error(formatError(error));
        return;
      }
      toast.success(`VIN …${trimmed.slice(-8)} parked in ${scanBay.name}`);
      setScanBay(null);
      void load();
      onRefreshJobs();
    },
    // load is created below - safe to omit; we capture supabase + scanBay
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scanBay, supabase, onRefreshJobs]
  );

  const load = useCallback(async () => {
    const { data: bayRows, error: bayErr } = await supabase
      .from("garage_bays")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (bayErr) {
      toast.error(formatError(bayErr));
      setBays([]);
      return;
    }
    const list = (bayRows as GarageBay[]) ?? [];
    setBays(list);

    const { data: jobRows, error: jobErr } = await supabase
      .from("garage_jobs")
      .select(
        "*, cars:car_id(vin, brand, model, model_year, exterior_color), profiles:assigned_to(full_name)"
      )
      .is("deleted_at", null)
      .not("garage_bay_id", "is", null);

    if (jobErr) {
      toast.error(formatError(jobErr));
      setJobsByBay({});
      return;
    }
    const terminal = new Set(["done", "delivered", "cancelled"]);
    const byBay: Record<string, JobInBay> = {};
    for (const j of (jobRows as JobInBay[]) ?? []) {
      if (terminal.has(j.status)) continue;
      if (j.garage_bay_id) byBay[j.garage_bay_id] = j;
    }
    setJobsByBay(byBay);

    const jobIds = Object.values(byBay).map((j) => j.id);
    if (jobIds.length === 0) {
      setOpenEntriesByJob({});
      return;
    }
    const { data: entRows, error: entErr } = await supabase
      .from("job_time_entries")
      .select("*, profiles:user_id(full_name)")
      .in("job_id", jobIds)
      .is("ended_at", null);
    if (entErr) {
      setOpenEntriesByJob({});
      return;
    }
    const byJob: Record<string, OpenEntry> = {};
    for (const e of (entRows as OpenEntry[]) ?? []) {
      byJob[e.job_id] = e;
    }
    setOpenEntriesByJob(byJob);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<GarageBayType, GarageBay[]>();
    for (const t of BAY_TYPE_GROUP_ORDER) m.set(t, []);
    for (const b of bays) {
      const arr = m.get(b.bay_type) ?? [];
      arr.push(b);
      m.set(b.bay_type, arr);
    }
    return m;
  }, [bays]);

  const activeLines = useMemo(() => {
    if (!canSeeActiveTimers) return [];
    const lines: { label: string; jobId: string; bayName: string }[] = [];
    for (const b of bays) {
      const j = jobsByBay[b.id];
      if (!j) continue;
      const ent = openEntriesByJob[j.id];
      if (!ent) continue;
      const prof = Array.isArray(ent.profiles) ? ent.profiles[0] : ent.profiles;
      const name = prof?.full_name ?? "Mechanic";
      const car = j.cars;
      const carLabel = car ? `${car.brand} ${car.model}` : "Battery unit";
      const elapsed = formatLiveDuration(ent.started_at);
      lines.push({
        label: `${name} — ${b.name} — ${carLabel} — ${j.title} — ${elapsed}`,
        jobId: j.id,
        bayName: b.name,
      });
    }
    return lines;
  }, [bays, jobsByBay, openEntriesByJob, canSeeActiveTimers]);

  function dotForBay(bay: GarageBay): "green" | "yellow" | "red" {
    const j = jobsByBay[bay.id];
    if (!j) return "yellow";
    const ent = openEntriesByJob[j.id];
    if (ent) return "green";
    if (
      j.status === "in_progress" &&
      j.estimated_hours &&
      j.started_at &&
      Date.now() - new Date(j.started_at).getTime() > j.estimated_hours * 3600000
    ) {
      return "red";
    }
    return "yellow";
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Workshop bays</h2>
        <div className="flex flex-wrap gap-2">
          {canManageBays && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setManageOpen(true)}>
                <Settings2 className="mr-2 size-4" />
                Manage bays
              </Button>
              <ManageBaysDialog
                open={manageOpen}
                onOpenChange={setManageOpen}
                onChanged={() => {
                  void load();
                  onRefreshJobs();
                }}
              />
            </>
          )}
        </div>
      </div>

      {canSeeActiveTimers && activeLines.length > 0 && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Active work
          </p>
          <ul className="space-y-1 text-sm">
            {activeLines.map((l) => (
              <li key={l.jobId}>
                <Link href={`/garage/jobs/${l.jobId}`} className="text-primary hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-8">
        {BAY_TYPE_GROUP_ORDER.map((type) => {
          const group = grouped.get(type) ?? [];
          if (group.length === 0) return null;
          const label = BAY_TYPE_GROUP_LABEL[type];
          return (
            <div key={type}>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                {label} ({group.length})
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.map((bay) => {
                  const job = jobsByBay[bay.id];
                  const border = BAY_TYPE_BORDER[bay.bay_type];
                  const ent = job ? openEntriesByJob[job.id] : undefined;
                  const isBattery = bay.bay_type === "battery_lab";

                  return (
                    <div
                      key={bay.id}
                      className={cn(
                        "flex flex-col rounded-lg border bg-background p-3 text-sm shadow-sm",
                        "border-l-4",
                        border,
                        job ? "border-border" : "border-dashed border-muted-foreground/30 opacity-90"
                      )}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="font-medium leading-tight">{bay.name}</span>
                        {job ? <StatusDot kind={dotForBay(bay)} /> : null}
                      </div>

                      {!job ? (
                        <>
                          <p className="text-muted-foreground mb-3">Status: Empty</p>
                          {isBattery && (
                            <p className="mb-2 text-xs text-yellow-600 dark:text-yellow-400">
                              Battery only — no car assignment
                            </p>
                          )}
                          {canManageBays && (
                            <div className="mt-auto flex flex-col gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => setAssignBay(bay)}
                              >
                                Assign car
                              </Button>
                              {!isBattery && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setScanBay(bay)}
                                >
                                  <ScanLine className="mr-2 size-4" />
                                  Scan VIN
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {isBattery ? (
                            <p className="mb-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                              Battery unit only — no car
                            </p>
                          ) : job.cars ? (
                            <p className="font-mono text-xs text-muted-foreground">
                              VIN: …{job.cars.vin.slice(-9)}
                            </p>
                          ) : null}
                          {!isBattery && job.cars && (
                            <p className="text-foreground">
                              {job.cars.brand} {job.cars.model}
                              {job.cars.model_year ? ` ${job.cars.model_year}` : ""}
                              {job.cars.exterior_color ? ` — ${job.cars.exterior_color}` : ""}
                            </p>
                          )}
                          <p className="text-muted-foreground mt-1 line-clamp-2">
                            Job: {job.title}
                          </p>
                          <p className="text-muted-foreground mt-1">
                            {(() => {
                              const p = job.profiles;
                              const prof = Array.isArray(p) ? p[0] : p;
                              const mechanic = isBattery ? "Technician" : "Mechanic";
                              return (
                                <>
                                  {mechanic}: {prof?.full_name ?? "—"}
                                </>
                              );
                            })()}
                          </p>
                          {ent && (
                            <p className="mt-2 font-mono text-xs text-primary">
                              Timer: {formatLiveDuration(ent.started_at)} (live)
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="default" asChild>
                              <Link href={`/garage/jobs/${job.id}`}>View job</Link>
                            </Button>
                            {canManageBays && (
                              <ReleaseBayMenu
                                bayId={bay.id}
                                onReleased={() => {
                                  void load();
                                  onRefreshJobs();
                                }}
                              />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AssignJobToBayDialog
        open={!!assignBay}
        onOpenChange={(o) => !o && setAssignBay(null)}
        bay={assignBay}
        onAssigned={() => {
          void load();
          onRefreshJobs();
        }}
      />

      <ScannerDialog
        open={!!scanBay}
        onClose={() => setScanBay(null)}
        onScan={handleScanIntoBay}
        scanType="vin"
        title={scanBay ? `Scan VIN into ${scanBay.name}` : "Scan VIN"}
        placeholder="Scan or type VIN..."
      />
    </section>
  );
}
