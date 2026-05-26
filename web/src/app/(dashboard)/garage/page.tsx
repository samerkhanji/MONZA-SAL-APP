"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { canPerform } from "@/lib/permissions";
import type { GarageJob } from "@/types/database";
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_TRANSITIONS,
  JOB_PRIORITY_LABELS,
  PRIORITY_BORDERS,
} from "@/lib/constants/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ScanLine } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";
import { NewJobDialog } from "@/components/garage/NewJobDialog";
import { FinishJobDialog } from "@/components/garage/FinishJobDialog";
import { GarageBaySection } from "@/components/garage/GarageBaySection";
import { SetJobCategoryDialog } from "@/components/garage/SetJobCategoryDialog";
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
import { formatError } from "@/lib/error-messages";

const ScannerDialog = dynamic(
  () => import("@/components/scanner/ScannerDialog").then((m) => ({ default: m.ScannerDialog })),
  { ssr: false }
);

interface JobWithCar extends GarageJob {
  cars?: {
    id: string;
    vin: string;
    brand: string;
    model: string;
    model_year: number | null;
    exterior_color: string | null;
    car_status: string;
  } | null;
}

function vinShort(vin: string) {
  return vin.length >= 8 ? `...${vin.slice(-8)}` : vin;
}

function formatTimeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffM / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}

const VALID_JOB_STATUSES = ["pending", "in_progress", "waiting_parts", "done", "delivered", "cancelled"];

export default function GarageJobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFromUrl = searchParams.get("status");
  const { canManageGarage, appRole } = useUser();
  const [jobs, setJobs] = useState<JobWithCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pendingJobIds, setPendingJobIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (statusFromUrl && VALID_JOB_STATUSES.includes(statusFromUrl)) {
      setStatusFilter(statusFromUrl);
    }
  }, [statusFromUrl]);
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [scanVinOpen, setScanVinOpen] = useState(false);
  const [finishJobOpen, setFinishJobOpen] = useState<JobWithCar | null>(null);
  const [cancelJobConfirm, setCancelJobConfirm] = useState<JobWithCar | null>(null);
  const [setCategoryFor, setSetCategoryFor] = useState<JobWithCar | null>(null);
  const dueTodayNotifiedRef = useRef(false);
  const overtimeNotifiedRef = useRef<Set<string>>(new Set());
  const [preselectedCar, setPreselectedCar] = useState<{
    id: string;
    vin: string;
    brand: string;
    model: string;
    model_year: number | null;
    exterior_color: string | null;
    status: string;
  } | null>(null);

  const supabase = createClient();

  async function handleVinScan(vin: string) {
    const { data: car } = await supabase
      .from("cars")
      .select("id, vin, brand, model, model_year, exterior_color, status")
      .eq("vin", vin.trim().toUpperCase())
      .is("deleted_at", null)
      .single();

    if (!car) {
      toast.error(`No car found with VIN: ${vin}`);
      return;
    }
    setPreselectedCar(car as {
      id: string;
      vin: string;
      brand: string;
      model: string;
      model_year: number | null;
      exterior_color: string | null;
      status: string;
    });
    setNewJobOpen(true);
    setScanVinOpen(false);
    toast.success(`Found: ${(car as { brand: string }).brand} ${(car as { model: string }).model}`);
  }

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("garage_jobs")
      .select("*, cars:car_id(id, vin, brand, model, model_year, exterior_color, car_status:status), assigned_profile:assigned_to(id, full_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(formatError(error));
      setJobs([]);
    } else {
      setJobs((data as JobWithCar[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (jobs.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const dueTodayPending = jobs.filter(
      (j) =>
        j.due_date &&
        j.due_date.slice(0, 10) === today &&
        j.status === "pending"
    );
    if (dueTodayPending.length > 0) {
      (async () => {
        for (const j of dueTodayPending) {
          const { data: existing } = await supabase
            .from("service_day_notifications_sent")
            .select("id")
            .eq("job_id", j.id)
            .eq("sent_date", today)
            .limit(1);
          if (existing && existing.length > 0) continue;
          const garageIds = await import("@/lib/user-lookup").then((m) =>
            m.getProfileIdsByCapability("garage")
          );
          if (garageIds.length > 0) {
            await import("@/lib/notifications").then((m) =>
              m.createNotificationsForUsers(
                garageIds,
                "Service reminder",
                `Reminder: VIN ${j.cars?.vin ?? "—"} is scheduled for service today — ${j.title}`,
                "/garage"
              )
            );
            await supabase.from("service_day_notifications_sent").insert({
              job_id: j.id,
              sent_date: today,
            });
          }
        }
      })();
    }
  }, [jobs]);

  useEffect(() => {
    if (jobs.length === 0) return;
    // Compare actual cumulative hours worked (job_time_entries → garage_jobs.actual_hours)
    // against the estimate, NOT wall-clock since started_at — the latter would
    // fire on jobs that were paused most of the day.
    const overtimeJobs = jobs.filter(
      (j) =>
        j.status === "in_progress" &&
        (j.estimated_hours ?? 0) > 0 &&
        (j.actual_hours ?? 0) > (j.estimated_hours ?? 0) &&
        !j.overtime_notified &&
        !overtimeNotifiedRef.current.has(j.id)
    );
    for (const j of overtimeJobs) {
      // Mark synchronously so a rapid re-run of this effect (before the
      // DB `overtime_notified` write lands) won't fire a duplicate alert.
      overtimeNotifiedRef.current.add(j.id);
      (async () => {
          const garageIds = await import("@/lib/user-lookup").then((m) =>
            m.getProfileIdsByCapability("garage")
          );
          if (garageIds.length > 0) {
            await import("@/lib/notifications").then((m) =>
              m.createNotificationsForUsers(
                garageIds,
                "Overtime alert",
                `Overtime alert: Job ${j.title} for VIN ${j.cars?.vin ?? "—"} has exceeded the estimated ${j.estimated_hours} hours`,
                "/garage"
              )
            );
            await supabase
              .from("garage_jobs")
              .update({ overtime_notified: true })
              .eq("id", j.id);
          }
        })();
    }
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (priorityFilter !== "all" && j.priority !== priorityFilter) return false;
      if (q) {
        const car = j.cars;
        const vin = (car?.vin ?? "").toLowerCase();
        const brand = (car?.brand ?? "").toLowerCase();
        const model = (car?.model ?? "").toLowerCase();
        const title = (j.title ?? "").toLowerCase();
        const assignedProfile = j.assigned_profile as { full_name?: string | null } | null | undefined;
        const assigned = (assignedProfile?.full_name ?? j.external_assignee_name ?? "").toLowerCase();
        if (
          !vin.includes(q) &&
          !brand.includes(q) &&
          !model.includes(q) &&
          !title.includes(q) &&
          !assigned.includes(q)
        )
          return false;
      }
      return true;
    });
  }, [jobs, debouncedSearch, statusFilter, priorityFilter]);

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const pOrder = { urgent: 0, normal: 1, low: 2 };
      const pa = pOrder[a.priority] ?? 1;
      const pb = pOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (da !== db) return da - db;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredJobs]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      urgent: jobs.filter((j) => j.priority === "urgent" && j.status !== "done" && j.status !== "delivered" && j.status !== "cancelled").length,
      inProgress: jobs.filter((j) => j.status === "in_progress").length,
      waitingParts: jobs.filter((j) => j.status === "waiting_parts").length,
      doneToday: jobs.filter(
        (j) =>
          j.status === "done" &&
          j.completed_at &&
          j.completed_at.startsWith(today)
      ).length,
    };
  }, [jobs]);

  async function handleStatusChange(job: JobWithCar, newStatus: string) {
    if (pendingJobIds.has(job.id)) return;
    setPendingJobIds((prev) => new Set(prev).add(job.id));
    try {
      await runStatusChange(job, newStatus);
    } finally {
      setPendingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  }

  async function runStatusChange(job: JobWithCar, newStatus: string) {
    if (
      newStatus !== job.status &&
      !(JOB_STATUS_TRANSITIONS[job.status] ?? []).includes(newStatus)
    ) {
      toast.error(
        `Cannot move a ${JOB_STATUS_LABELS[job.status] ?? job.status} job to ${JOB_STATUS_LABELS[newStatus] ?? newStatus}.`
      );
      return;
    }
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "in_progress" && !job.started_at) {
      updates.started_at = new Date().toISOString();
    }
    if (newStatus === "done") {
      updates.completed_at = new Date().toISOString();
      updates.garage_bay_id = null;
      updates.started_at = null;
    }
    if (newStatus === "cancelled") {
      updates.garage_bay_id = null;
      updates.started_at = null;
    }
    if (newStatus === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }

    if (newStatus === "done" || newStatus === "cancelled") {
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
    }

    const { error } = await supabase
      .from("garage_jobs")
      .update(updates)
      .eq("id", job.id);

    if (error) {
      toast.error(formatError(error));
      return;
    }

    if (newStatus === "done" && job.cars?.id && job.cars.car_status === "service") {
      // Only return the car to `available` if it is actually in a service
      // status — never overwrite reserved / sold / recalled etc.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("cars").update({ status: "available" }).eq("id", job.cars.id);
      if (user) {
        await supabase.from("car_events").insert({
          car_id: job.cars.id,
          event_type: "status_changed",
          from_value: job.cars.car_status,
          to_value: "available",
          note: `Job marked done from list: ${job.title}`,
          created_by: user.id,
        });
      }
    }

    if (newStatus === "delivered") {
      const carVin = job.cars?.vin ?? "—";
      const { getProfileIdsByRole } = await import("@/lib/user-lookup");
      const assistantIds = await getProfileIdsByRole("assistant");
      if (assistantIds.length > 0) {
        await import("@/lib/notifications").then((m) =>
          m.createNotificationsForUsers(
            assistantIds,
            "Car delivered",
            `Car delivered: VIN ${carVin} has been picked up by the customer. Job: ${job.title}`,
            "/garage"
          )
        );
      }
    }

    toast.success("Status updated");
    fetchJobs();
  }

  const isOverdue = (due: string | null) => {
    if (!due) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(due);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isDueToday = (due: string | null) => {
    if (!due) return false;
    const today = new Date().toISOString().slice(0, 10);
    return due.slice(0, 10) === today;
  };

  const isOvertime = (job: JobWithCar) => {
    if (job.status !== "in_progress" || !job.started_at) return false;
    const estimatedHours = job.estimated_hours ?? 0;
    if (estimatedHours <= 0) return false;
    const startMs = new Date(job.started_at).getTime();
    const expectedEndMs = startMs + estimatedHours * 60 * 60 * 1000;
    return Date.now() > expectedEndMs;
  };

  const jobExportColumns: ExportColumn[] = [
    { key: "car_vin", header: "VIN" },
    { key: "car_model", header: "Model" },
    { key: "title", header: "Reason of Visit" },
    { key: "status_display", header: "Status" },
    { key: "priority_display", header: "Priority", type: "priority" },
    { key: "due_date", header: "Service Date", type: "date" },
    { key: "assigned_to", header: "Assigned To" },
    { key: "estimated_hours", header: "Est. Hours", type: "number" },
    { key: "started_at", header: "Started", type: "date" },
    { key: "completed_at", header: "Completed", type: "date" },
    { key: "delivered_at", header: "Delivered", type: "date" },
    { key: "work_done", header: "Work Description" },
    { key: "notes", header: "Notes" },
  ];

  const jobExportData = (list: JobWithCar[]) =>
    list.map((j) => {
      const car = Array.isArray(j.cars) ? j.cars[0] : j.cars;
      const priorityLabel =
        j.priority === "low" ? "Low" : j.priority === "urgent" ? "Urgent" : "Medium";
      return {
        ...j,
        car_vin: car?.vin ?? "",
        car_model: car ? `${car.brand} ${car.model}` : "",
        status_display: JOB_STATUS_LABELS[j.status] ?? j.status,
        priority_display: priorityLabel,
      };
    });

  const doneCount = sortedJobs.filter((j) => j.status === "done").length;
  const inProgressCount = sortedJobs.filter((j) => j.status === "in_progress").length;

  const canCreateJob = canPerform("garage_jobs", "create", appRole ?? null);
  const canEditJob = canPerform("garage_jobs", "edit", appRole ?? null);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold sm:text-2xl">Garage Jobs</h1>
        <div className="flex flex-wrap gap-2">
          <span data-tour-id="garage-export">
            <ExportButton
              data={jobExportData(sortedJobs)}
              allData={jobExportData(jobs)}
              columns={jobExportColumns}
              filename="Garage_Jobs"
              options={{
                pageName: "Garage Jobs",
                summary: `Total Jobs: ${sortedJobs.length} | Completed: ${doneCount} | In Progress: ${inProgressCount}`,
              }}
              disabled={loading}
            />
          </span>
          {canManageGarage && (
            <Button
              data-tour-id="garage-time-reports-link"
              size="lg"
              variant="outline"
              className="h-12 px-6 text-base"
              asChild
            >
              <Link href="/garage/time-reports">Time reports</Link>
            </Button>
          )}
          {canCreateJob && (
            <>
              <Button
                data-tour-id="garage-scan-vin"
                data-tour="scan-vin-button"
                size="lg"
                variant="outline"
                className="h-12 px-6 text-base"
                onClick={() => setScanVinOpen(true)}
              >
                <ScanLine className="mr-2 size-5" />
                Scan VIN
              </Button>
              <Button
                data-tour-id="garage-new-job"
                data-tour="new-job-button"
                size="lg"
                className="h-12 px-6 text-base"
                onClick={() => {
                  setPreselectedCar(null);
                  setNewJobOpen(true);
                }}
              >
                <Plus className="mr-2 size-5" />
                New Job
              </Button>
            </>
          )}
        </div>
      </div>

      <div data-tour-id="garage-bays-section">
        <GarageBaySection onRefreshJobs={fetchJobs} />
      </div>

      <div data-tour-id="garage-stats" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">Urgent</p>
          <p className="text-2xl font-bold">{stats.urgent}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">In Progress</p>
          <p className="text-2xl font-bold">{stats.inProgress}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">Waiting Parts</p>
          <p className="text-2xl font-bold">{stats.waitingParts}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">Done Today</p>
          <p className="text-2xl font-bold">{stats.doneToday}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 max-md:overflow-x-auto max-md:pb-2 max-md:-mx-4 max-md:px-4 max-md:scrollbar-none">
        <div data-tour-id="garage-status-filter" className="flex flex-wrap gap-2 min-w-max">
          {["all", "pending", "in_progress", "waiting_parts", "done", "delivered", "cancelled"].map(
            (s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`min-h-11 min-w-11 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:min-w-0 ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {s === "all" ? "All" : JOB_STATUS_LABELS[s] ?? s}
              </button>
            )
          )}
        </div>
        <div data-tour-id="garage-priority-filter" className="flex flex-wrap gap-2">
          {["all", "urgent", "normal", "low"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityFilter(p)}
              className={`min-h-11 min-w-11 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:min-w-0 ${
                priorityFilter === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {p === "all" ? "All" : JOB_PRIORITY_LABELS[p] ?? p}
            </button>
          ))}
        </div>
        <Input
          data-tour-id="garage-search"
          id="garage-job-search"
          name="garage-job-search"
          placeholder="Search VIN, reason of visit, assigned to..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-11 w-full sm:h-10 sm:w-64"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : sortedJobs.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No jobs found.</p>
          {canCreateJob && (
            <Button
              className="mt-4"
              onClick={() => setNewJobOpen(true)}
            >
              Create your first job
            </Button>
          )}
        </div>
      ) : (
        <div data-tour-id="garage-jobs-list" className="space-y-4">
          {sortedJobs.map((job) => {
            const car = job.cars;
            const borderClass =
              PRIORITY_BORDERS[job.priority] ?? "border-l-4 border-l-gray-300";
            const dueToday = isDueToday(job.due_date);
            const overtime = isOvertime(job);
            const jobBusy = pendingJobIds.has(job.id);
            return (
              <div
                key={job.id}
                className={`rounded-lg border bg-card ${borderClass} p-5 shadow-sm ${
                  dueToday ? "ring-2 ring-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20" : ""
                } ${overtime ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {job.priority === "urgent" && (
                        <span className="text-red-600 font-medium">Urgent</span>
                      )}
                      {dueToday && (
                        <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                          Due Today
                        </span>
                      )}
                      <span className="text-muted-foreground text-sm">
                        {formatTimeAgo(job.created_at)}
                      </span>
                    </div>
                    <h2 className="mt-1 text-lg font-semibold">{job.title}</h2>
                    {car && (
                      <Link
                        href={`/cars/${encodeURIComponent(car.vin ?? car.id)}`}
                        className="mt-1 block text-muted-foreground hover:underline"
                      >
                        {car.brand} {car.model} · VIN: {vinShort(car.vin)}
                      </Link>
                    )}
                    {canEditJob && !job.task_category_id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-50/50 px-3 py-2 text-sm dark:bg-amber-950/20">
                        <span>Needs intake — pick a reason to fan out tasks.</span>
                        <Button
                          size="sm"
                          className="h-7"
                          onClick={() => setSetCategoryFor(job)}
                        >
                          Set category
                        </Button>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {(() => {
                        const assignedProfile = job.assigned_profile as { full_name?: string | null } | null | undefined;
                        const assigneeName = assignedProfile?.full_name ?? job.external_assignee_name ?? null;
                        return assigneeName ? (
                          <span className="text-muted-foreground">{assigneeName}</span>
                        ) : null;
                      })()}
                      <span className="text-muted-foreground">
                        Est: {job.estimated_hours ?? "—"}h / Act:{" "}
                        {job.actual_hours ?? "—"}h
                      </span>
                      {job.due_date && (
                        <span
                          className={
                            isOverdue(job.due_date)
                              ? "text-red-600"
                              : "text-muted-foreground"
                          }
                        >
                          Day to be Serviced: {new Date(job.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {canEditJob && job.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(job, "in_progress")}
                          className="h-9"
                          disabled={jobBusy}
                        >
                          Start
                        </Button>
                      )}
                      {canEditJob && job.status === "in_progress" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setFinishJobOpen(job)}
                          className="h-9"
                          disabled={jobBusy}
                        >
                          Finish
                        </Button>
                      )}
                      {job.status === "done" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusChange(job, "delivered")}
                          className="h-9"
                          disabled={jobBusy}
                        >
                          {jobBusy ? "Delivering…" : "Delivered"}
                        </Button>
                      )}
                      {job.status === "delivered" && (
                        <Badge variant="secondary" className="h-9">
                          Delivered
                        </Badge>
                      )}
                      <Select
                        value={job.status}
                        onValueChange={(v) => {
                          if (v === job.status) return;
                          if (
                            !(JOB_STATUS_TRANSITIONS[job.status] ?? []).includes(v)
                          ) {
                            toast.error(
                              `Cannot move a ${JOB_STATUS_LABELS[job.status] ?? job.status} job to ${JOB_STATUS_LABELS[v] ?? v}.`
                            );
                            return;
                          }
                          if (v === "cancelled") {
                            setCancelJobConfirm(job);
                            return;
                          }
                          if (v === "done") {
                            // Completing a job must capture work-done/photos —
                            // route through FinishJobDialog, never a bare update.
                            setFinishJobOpen(job);
                            return;
                          }
                          void handleStatusChange(job, v);
                        }}
                        disabled={!canManageGarage || jobBusy}
                      >
                        <SelectTrigger className="h-9 w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            job.status,
                            ...(JOB_STATUS_TRANSITIONS[job.status] ?? []),
                          ].map((s) => (
                            <SelectItem key={s} value={s}>
                              {JOB_STATUS_LABELS[s] ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/garage/jobs/${job.id}`)}
                        className="h-9"
                        disabled={jobBusy}
                      >
                        Open Job
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ScannerDialog
        open={scanVinOpen}
        onClose={() => setScanVinOpen(false)}
        onScan={handleVinScan}
        title="Scan VIN for New Job"
        placeholder="17-character VIN..."
        scanType="vin"
      />

      <NewJobDialog
        open={newJobOpen}
        onOpenChange={(o) => {
          setNewJobOpen(o);
          if (!o) setPreselectedCar(null);
        }}
        onSuccess={fetchJobs}
        preselectedCar={preselectedCar}
      />

      <FinishJobDialog
        job={finishJobOpen}
        open={!!finishJobOpen}
        onOpenChange={(o) => !o && setFinishJobOpen(null)}
        onSuccess={fetchJobs}
      />

      <SetJobCategoryDialog
        open={setCategoryFor !== null}
        onOpenChange={(o) => !o && setSetCategoryFor(null)}
        jobId={setCategoryFor?.id ?? null}
        currentKm={setCategoryFor?.current_km ?? null}
        onCategorized={() => {
          setSetCategoryFor(null);
          void fetchJobs();
        }}
      />

      <AlertDialog
        open={cancelJobConfirm !== null}
        onOpenChange={(open) => !open && setCancelJobConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelJobConfirm
                ? `"${cancelJobConfirm.title}" will be marked as cancelled. Any in-progress timer is stopped, the bay is released, and the job is removed from the active list. The job and its checklist remain in history.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep job</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelJobConfirm) {
                  void handleStatusChange(cancelJobConfirm, "cancelled");
                  setCancelJobConfirm(null);
                }
              }}
            >
              Cancel job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
