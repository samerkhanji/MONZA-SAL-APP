"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import { useUser } from "@/lib/contexts/UserContext";
import { canPerform } from "@/lib/permissions";
import type { GarageBay, GarageBayType, GarageJob, JobPart } from "@/types/database";

type GarageJobUpdate = Database["public"]["Tables"]["garage_jobs"]["Update"];
import {
  JOB_STATUS_COLORS,
  JOB_STATUS_LABELS,
  JOB_PRIORITY_COLORS,
  JOB_PRIORITY_LABELS,
  formatHours,
} from "@/lib/constants/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ArrowLeft, Plus, Check, Trash2, ScanLine } from "lucide-react";
import { JobDocuments } from "@/components/garage/JobDocuments";
import { FinishJobDialog } from "@/components/garage/FinishJobDialog";
import { SetJobCategoryDialog } from "@/components/garage/SetJobCategoryDialog";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { JobTimeEntryControls } from "@/components/garage/JobTimeEntryControls";
import { JobBayTypeControls } from "@/components/garage/JobBayTypeControls";
import { RepairProposalPanel } from "@/components/garage/RepairProposalPanel";
import { formatError } from "@/lib/error-messages";
import { BAY_TYPE_GROUP_LABEL } from "@/lib/garage-bays";

interface JobWithCar extends GarageJob {
  cars?: {
    id: string;
    vin: string;
    brand: string;
    model: string;
    model_year: number | null;
    exterior_color: string | null;
    status: string;
  } | null;
  garage_bays?: {
    id: string;
    name: string;
    bay_type: string;
  } | null;
}

interface JobPartWithPart extends JobPart {
  parts?: {
    part_name: string;
    oe_number: string | null;
    unit_cost: number | null;
    currency: string | null;
  } | null;
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { canManageGarage, canDelete, appRole, profile, isOwner } = useUser();
  const [job, setJob] = useState<JobWithCar | null>(null);
  const [parts, setParts] = useState<JobPartWithPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [partSearching, setPartSearching] = useState(false);
  const [partsList, setPartsList] = useState<{ id: string; part_name: string; oe_number: string | null }[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [partQuantity, setPartQuantity] = useState("1");
  const [partNote, setPartNote] = useState("");
  const [partSubmitting, setPartSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [scanPartOpen, setScanPartOpen] = useState(false);
  const [bays, setBays] = useState<GarageBay[]>([]);
  const [returnPartTarget, setReturnPartTarget] = useState<{ id: string; name: string } | null>(null);
  const [setCategoryOpen, setSetCategoryOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const handler = (e: CustomEvent<{ id: string; part_name: string; oe_number: string | null; quantity: number }>) => {
      const part = e.detail;
      if (!part || part.quantity <= 0) {
        toast.error(`${part?.part_name ?? "Part"} is out of stock!`);
        return;
      }
      setPartsList([{ id: part.id, part_name: part.part_name, oe_number: part.oe_number }]);
      setSelectedPartId(part.id);
      setPartQuantity("1");
      setPartNote("");
      setAddPartOpen(true);
      toast.success(`Found: ${part.part_name} · Stock: ${part.quantity}`);
    };
    window.addEventListener("scan-part", handler as EventListener);
    return () => window.removeEventListener("scan-part", handler as EventListener);
  }, []);

  async function fetchJob() {
    const { data, error } = await supabase
      .from("garage_jobs")
      .select(
        "*, cars:car_id(id, vin, brand, model, model_year, exterior_color, status), garage_bays:garage_bay_id(id, name, bay_type), assigned_profile:assigned_to(id, full_name)"
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      toast.error("Job not found");
      router.push("/garage");
      return;
    }
    // TODO(typed-supabase): JobWithCar narrows enum fields (e.g. priority: JobPriority)
    // while the generated row keeps them as the wider DB enum union; aligning them
    // requires touching every consumer of GarageJob/JobWithCar.
    const row = data as unknown as JobWithCar;
    const bayJoin = row.garage_bays;
    row.garage_bays = Array.isArray(bayJoin) ? bayJoin[0] ?? null : bayJoin ?? null;
    setJob(row);
  }

  async function fetchBays() {
    const { data } = await supabase
      .from("garage_bays")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    // TODO(typed-supabase): generated row has bay_number: number while GarageBay/JobBay
    // helpers vary; align in a dedicated UI-types pass.
    setBays((data as unknown as GarageBay[]) ?? []);
  }

  async function fetchParts() {
    const { data } = await supabase
      .from("job_parts")
      .select(
        "id, job_id, part_id, quantity, note, created_by, created_at, unit_cost_snapshot, currency_snapshot, parts:part_id(part_name, oe_number, unit_cost, currency)"
      )
      .eq("job_id", id)
      .order("created_at", { ascending: false });
    setParts((data as unknown as JobPartWithPart[]) ?? []);
  }

  async function handleReturnPart(jobPartId: string, partName: string) {
    try {
      const { error } = await supabase.rpc("return_part_from_job", {
        p_job_part_id: jobPartId,
      });
      if (error) {
        toast.error(formatError(error));
        return;
      }
      toast.success(`${partName} returned to stock`);
    } finally {
      // Always refetch — even on error the RPC may have partially applied.
      await fetchParts();
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchJob().finally(() => setLoading(false));
    void fetchBays();
  }, [id]);

  useEffect(() => {
    if (job?.id) fetchParts();
  }, [job?.id]);

  useEffect(() => {
    if (!addPartOpen || !partSearch.trim() || partSearch.length < 2) {
      setPartsList([]);
      setPartSearching(false);
      return;
    }
    const q = partSearch.trim();
    let cancelled = false;
    setPartSearching(true);
    supabase
      .from("parts")
      .select("id, part_name, oe_number")
      .is("deleted_at", null)
      .or(`part_name.ilike.%${q}%,oe_number.ilike.%${q}%`)
      .limit(10)
      .then(({ data }) => {
        if (cancelled) return;
        setPartsList(
          (data as { id: string; part_name: string; oe_number: string | null }[]) ?? []
        );
        setPartSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addPartOpen, partSearch]);

  async function handleAddPart() {
    if (!selectedPartId || !job) return;
    const qty = Number(partQuantity);
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error("Enter a whole number quantity of 1 or more");
      return;
    }
    setPartSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const trimmedPartNote = partNote.trim();
      const { error } = await supabase.rpc("apply_part_to_job", {
        p_job_id: job.id,
        p_part_id: selectedPartId,
        p_quantity: qty,
        ...(trimmedPartNote ? { p_note: trimmedPartNote } : {}),
        ...(user?.id ? { p_user_id: user.id } : {}),
      });
      if (error) {
        toast.error(formatError(error));
        return;
      }
      const partName = partsList.find((p) => p.id === selectedPartId)?.part_name ?? "Part";
      const c = job?.cars;
      const vinShort = c?.vin ? (c.vin.length >= 8 ? `...${c.vin.slice(-8)}` : c.vin) : "";
      const { data: partAfter } = await supabase
        .from("parts")
        .select("quantity")
        .eq("id", selectedPartId)
        .single();
      const remaining = (partAfter as { quantity?: number } | null)?.quantity ?? "?";
      toast.success(
        `${partName} ×${qty} added${vinShort ? ` · Used on VIN ${vinShort}` : ""} · Stock: ${remaining} remaining`
      );
      setAddPartOpen(false);
      setSelectedPartId(null);
      setPartQuantity("1");
      setPartNote("");
    } finally {
      // Always refetch — even on error the RPC may have partially applied
      // (e.g. decremented stock but failed to insert the job_parts row).
      setPartSubmitting(false);
      await Promise.all([fetchParts(), fetchJob()]);
    }
  }

  async function handlePartScan(oeNumber: string) {
    const { data: part } = await supabase
      .from("parts")
      .select("id, part_name, oe_number, quantity")
      .eq("oe_number", oeNumber.trim().toUpperCase())
      .is("deleted_at", null)
      .single();

    if (!part) {
      toast.error(`Part not found: ${oeNumber}`);
      return;
    }
    const p = part as { id: string; part_name: string; oe_number: string | null; quantity: number };
    if (p.quantity <= 0) {
      toast.error(`${p.part_name} is out of stock!`);
      return;
    }
    setPartsList([{ id: p.id, part_name: p.part_name, oe_number: p.oe_number }]);
    setSelectedPartId(p.id);
    setPartQuantity("1");
    setPartNote("");
    setAddPartOpen(true);
    setScanPartOpen(false);
    toast.success(`Found: ${p.part_name} · Stock: ${p.quantity}`);
  }

  async function handleUpdateField(
    field: keyof GarageJobUpdate,
    value: string | number | null
  ) {
    if (!job) return;
    const update: GarageJobUpdate = { [field]: value } as GarageJobUpdate;
    const { error } = await supabase
      .from("garage_jobs")
      .update(update)
      .eq("id", job.id);
    if (error) {
      toast.error(formatError(error));
    } else {
      // These two fields auto-save on blur — without a confirmation the user
      // has no signal the change persisted. Keep it light (no toast spam for
      // programmatic updates from elsewhere).
      if (field === "diagnosis" || field === "work_done") {
        toast.success("Saved");
      }
      fetchJob();
    }
  }

  async function handleDelete() {
    if (!job) return;
    if (!canPerform("garage_jobs", "delete", appRole ?? null)) {
      toast.error("You don't have permission to delete this job.");
      return;
    }
    try {
      const res = await fetch(`/api/garage/jobs/${job.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof j?.error === "string" ? j.error : "Delete failed");
        // Refetch — the soft-delete may have partially applied.
        await fetchJob();
        return;
      }
      toast.success("Job removed");
      setDeleteOpen(false);
      router.push("/garage");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      await fetchJob();
    }
  }

  const totalPartsCost = parts.reduce((sum, p) => {
    const cost = p.unit_cost_snapshot ?? p.parts?.unit_cost ?? 0;
    return sum + cost * p.quantity;
  }, 0);

  if (loading || !job) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const canEditJob = canPerform("garage_jobs", "edit", appRole ?? null);
  const canDeleteJob = canPerform("garage_jobs", "delete", appRole ?? null);
  const isGarageStaff = appRole === "garage_staff";
  const isAssignedToMe =
    job.assigned_to && profile?.id && job.assigned_to === profile.id;
  const canGarageStaffEditLimited = isGarageStaff && !!isAssignedToMe;
  const isGarageManagerRole = appRole === "garage_manager";
  const isAssistantRole = appRole === "assistant";

  const car = job.cars;
  const isOverdue =
    job.due_date &&
    new Date(job.due_date) < new Date(new Date().toDateString());

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button data-tour-id="job-detail-back" variant="ghost" size="sm" asChild>
          <Link href="/garage">
            <ArrowLeft className="mr-2 size-4" />
            Garage Jobs
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{job.title}</h1>
        <Badge className={JOB_PRIORITY_COLORS[job.priority]}>
          {JOB_PRIORITY_LABELS[job.priority]}
        </Badge>
        <Badge className={JOB_STATUS_COLORS[job.status]}>
          {JOB_STATUS_LABELS[job.status]}
        </Badge>
      </div>
      {canManageGarage && !job.task_category_id && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-50/50 px-4 py-3 dark:bg-amber-950/20">
          <div className="flex-1">
            <p className="text-sm font-medium">This job needs an intake category.</p>
            <p className="text-muted-foreground text-xs">
              Pick a reason for visit — tasks will be created for the right people automatically.
            </p>
          </div>
          <Button size="sm" onClick={() => setSetCategoryOpen(true)}>
            Set category
          </Button>
        </div>
      )}

      {job.is_battery_only && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          Battery unit only — no vehicle on this job.
        </p>
      )}
      {car && (
        <p>
          <Link
            href={`/cars/${encodeURIComponent(car.vin ?? car.id)}`}
            className="text-primary hover:underline"
          >
            {car.brand} {car.model} · VIN: {car.vin}
          </Link>
        </p>
      )}

      {/* Sticky timer + actions bar so a mechanic can always see clock state */}
      <div data-tour-id="job-detail-toolbar" className="sticky top-0 z-30 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div data-tour-id="job-detail-timer" className="flex-1 min-w-[260px]">
            <JobTimeEntryControls
              jobId={job.id}
              jobStatus={job.status}
              actualHours={job.actual_hours ?? null}
              canControl={canEditJob || canGarageStaffEditLimited}
              carVinShort={
                car?.vin
                  ? car.vin.length >= 8
                    ? `…${car.vin.slice(-8)}`
                    : car.vin
                  : job.is_battery_only
                    ? "battery unit"
                    : ""
              }
              onChanged={() => void fetchJob()}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(canEditJob || canGarageStaffEditLimited) && (
              <>
                {job.status !== "done" && job.status !== "cancelled" && (
                  <Button data-tour-id="job-detail-complete" size="sm" onClick={() => setFinishOpen(true)}>
                    <Check className="mr-2 size-4" />
                    Complete
                  </Button>
                )}
              </>
            )}
            {canDeleteJob && (
              <Button
                data-tour-id="job-detail-delete"
                size="sm"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {canManageGarage && (
        <Card>
          <CardHeader>
            <CardTitle>Workshop bay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label>Assign bay</Label>
            <Select
              value={job.garage_bay_id != null ? String(job.garage_bay_id) : "__none__"}
              onValueChange={async (v) => {
                const bayId = v === "__none__" ? null : Number(v);
                const { error } = await supabase
                  .from("garage_jobs")
                  .update({
                    garage_bay_id: bayId,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", job.id);
                if (error) toast.error(formatError(error));
                else {
                  toast.success(bayId ? "Bay updated" : "Bay cleared");
                  void fetchJob();
                }
              }}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="No bay" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No bay</SelectItem>
                {bays
                  .filter((b) =>
                    job.is_battery_only ? b.bay_type === "battery_lab" : b.bay_type !== "battery_lab"
                  )
                  .map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name} ({BAY_TYPE_GROUP_LABEL[b.bay_type as GarageBayType] ?? b.bay_type})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {job.garage_bays && (
              <p className="text-muted-foreground text-sm">
                Current: {job.garage_bays.name} ·{" "}
                {BAY_TYPE_GROUP_LABEL[job.garage_bays.bay_type as GarageBayType] ??
                  job.garage_bays.bay_type}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <JobBayTypeControls
        jobId={job.id}
        bayType={(job.garage_bays?.bay_type as GarageBayType | undefined) ?? null}
        canEdit={canEditJob || canGarageStaffEditLimited}
      />

      <RepairProposalPanel
        jobId={job.id}
        isGarageManager={isGarageManagerRole}
        isAssistant={isAssistantRole}
        isOwner={!!isOwner}
        onJobUpdated={() => void fetchJob()}
      />

      {Array.isArray(job.work_checklist) && job.work_checklist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Work checklist (approved items)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {job.work_checklist.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-2 rounded border border-border p-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={!(canEditJob || canGarageStaffEditLimited)}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    let next = job.work_checklist ?? [];
                    setJob((prev) => {
                      if (!prev) return prev;
                      next = (prev.work_checklist ?? []).map((x) =>
                        x.id === item.id ? { ...x, done: checked } : x
                      );
                      return { ...prev, work_checklist: next };
                    });
                    const { error } = await supabase
                      .from("garage_jobs")
                      .update({ work_checklist: next })
                      .eq("id", job.id);
                    if (error) {
                      toast.error(formatError(error));
                      void fetchJob();
                    }
                  }}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Section 1: Job Info */}
      <Card>
        <CardHeader>
          <CardTitle>Job Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Assigned To</Label>
              <p>
                {(() => {
                  const ap = job.assigned_profile as { full_name?: string | null } | null | undefined;
                  return ap?.full_name ?? job.external_assignee_name ?? "—";
                })()}
              </p>
            </div>
            <div>
              <Label>Day to be Serviced</Label>
              <p className={isOverdue ? "text-red-600" : ""}>
                {job.due_date
                  ? new Date(job.due_date).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div>
              <Label>Estimated / Actual Hours</Label>
              <p>
                {formatHours(job.estimated_hours)}h / {formatHours(job.actual_hours)}h
              </p>
            </div>
            <div>
              <Label>Created</Label>
              <p>{new Date(job.created_at).toLocaleString()}</p>
            </div>
          </div>
          {job.status === "in_progress" && job.started_at && (
            <p className="text-muted-foreground text-sm">
              Job clock started: {new Date(job.started_at).toLocaleString()} (use work time above for
              sessions)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Diagnosis & Work */}
      <Card data-tour-id="job-detail-diagnosis">
        <CardHeader>
          <CardTitle>Diagnosis & Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="job-diagnosis">Diagnosis</Label>
            <Textarea
              id="job-diagnosis"
              name="job-diagnosis"
              value={job.diagnosis ?? ""}
              onChange={(e) => setJob({ ...job, diagnosis: e.target.value })}
              onBlur={(e) =>
                handleUpdateField("diagnosis", e.target.value || null)
              }
              placeholder="Enter diagnosis..."
              rows={4}
              disabled={!(canEditJob || canGarageStaffEditLimited)}
            />
          </div>
          <div>
            <Label htmlFor="job-work-done">Work Done</Label>
            <Textarea
              id="job-work-done"
              name="job-work-done"
              value={job.work_done ?? ""}
              onChange={(e) => setJob({ ...job, work_done: e.target.value })}
              onBlur={(e) =>
                handleUpdateField("work_done", e.target.value || null)
              }
              placeholder="Describe work performed..."
              rows={4}
              disabled={!(canEditJob || canGarageStaffEditLimited)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Parts Used */}
      <Card data-tour-id="job-detail-parts">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Parts Used</CardTitle>
            {canManageGarage && (
              <div className="flex gap-2">
                <Button data-tour-id="job-detail-add-part" size="sm" onClick={() => setAddPartOpen(true)}>
                  <Plus className="mr-2 size-4" />
                  Add Part
                </Button>
                <Button
                  data-tour-id="job-detail-scan-part"
                  size="sm"
                  variant="outline"
                  onClick={() => setScanPartOpen(true)}
                >
                  <ScanLine className="mr-2 size-4" />
                  Scan Part
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {parts.length === 0 ? (
            <p className="text-muted-foreground">No parts used yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-2 text-sm font-medium text-muted-foreground">
                <span>Part Name</span>
                <span>OE Number</span>
                <span>Qty</span>
                <span>Unit cost</span>
                <span>Note</span>
                <span className="text-right">Action</span>
              </div>
              {parts.map((p) => {
                const cost = p.unit_cost_snapshot ?? p.parts?.unit_cost ?? null;
                const ccy = p.currency_snapshot ?? p.parts?.currency ?? "";
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-6 gap-2 rounded border p-2 text-sm"
                  >
                    <span>{p.parts?.part_name ?? "—"}</span>
                    <span className="font-mono">{p.parts?.oe_number ?? "—"}</span>
                    <span>{p.quantity}</span>
                    <span>
                      {cost != null ? `${cost.toFixed(2)} ${ccy}` : "—"}
                    </span>
                    <span>{p.note ?? "—"}</span>
                    <span className="flex justify-end">
                      {canManageGarage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setReturnPartTarget({
                              id: p.id,
                              name: p.parts?.part_name ?? "Part",
                            })
                          }
                        >
                          Return
                        </Button>
                      )}
                    </span>
                  </div>
                );
              })}
              {totalPartsCost > 0 && (
                <p className="mt-2 font-medium">
                  Total parts cost: {totalPartsCost.toFixed(2)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Documents */}
      <Card data-tour-id="job-detail-documents">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <JobDocuments jobId={job.id} />
        </CardContent>
      </Card>

      {/* Section 5: Time - inline in Job Info */}

      {/* Add Part Dialog */}
      <Dialog
        open={addPartOpen}
        onOpenChange={(open) => {
          setAddPartOpen(open);
          if (!open) setSelectedPartId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Part to Job</DialogTitle>
            <DialogDescription>
              Search for a part by name or OE number, then choose how many to use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="add-part-search">Search Part</Label>
              <Input
                id="add-part-search"
                name="add-part-search"
                placeholder="Part name or OE number..."
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            {partsList.length > 0 && (
              <div className="space-y-1">
                {partsList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPartId(p.id)}
                    className={`flex w-full justify-between rounded border p-2 text-left text-sm ${
                      selectedPartId === p.id ? "border-primary" : ""
                    }`}
                  >
                    {p.part_name}
                    <span className="font-mono text-muted-foreground">
                      {p.oe_number}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {partSearch.trim().length >= 2 &&
              partSearching &&
              partsList.length === 0 && (
                <p className="text-muted-foreground text-sm">Searching…</p>
              )}
            {partSearch.trim().length >= 2 &&
              !partSearching &&
              partsList.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No parts found for &ldquo;{partSearch.trim()}&rdquo;.
                </p>
              )}
            {selectedPartId && (
              <>
                <div>
                  <Label htmlFor="add-part-quantity">Quantity</Label>
                  <Input
                    id="add-part-quantity"
                    name="add-part-quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={partQuantity}
                    onChange={(e) => setPartQuantity(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="add-part-note">Note</Label>
                  <Input
                    id="add-part-note"
                    name="add-part-note"
                    value={partNote}
                    onChange={(e) => setPartNote(e.target.value)}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAddPartOpen(false);
                setSelectedPartId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPart}
              disabled={!selectedPartId || partSubmitting}
            >
              {partSubmitting ? "Adding..." : "Add Part"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FinishJobDialog
        job={job}
        open={finishOpen}
        onOpenChange={setFinishOpen}
        onSuccess={() => {
          setFinishOpen(false);
          fetchJob();
        }}
      />

      <SetJobCategoryDialog
        open={setCategoryOpen}
        onOpenChange={setSetCategoryOpen}
        jobId={job?.id ?? null}
        currentKm={job?.current_km ?? null}
        onCategorized={() => {
          setSetCategoryOpen(false);
          fetchJob();
        }}
      />

      <ScannerDialog
        open={scanPartOpen}
        onClose={() => setScanPartOpen(false)}
        onScan={handlePartScan}
        title="Scan Part OE Number"
        placeholder="OE number..."
        scanType="part"
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the job. This action can be undone by an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={returnPartTarget !== null}
        onOpenChange={(open) => !open && setReturnPartTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Return &ldquo;{returnPartTarget?.name ?? ""}&rdquo; to stock?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The part will be removed from this job and its quantity returned to the
              parts inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (returnPartTarget) {
                  void handleReturnPart(returnPartTarget.id, returnPartTarget.name);
                  setReturnPartTarget(null);
                }
              }}
            >
              Return to stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
