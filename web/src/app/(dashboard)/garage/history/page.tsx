"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import {
  requestPageAccess,
  getPageAccessStatus,
  type PageAccessStatus,
} from "@/lib/page-access";
import type { GarageJob } from "@/types/database";
import {
  JOB_STATUS_COLORS,
  JOB_STATUS_LABELS,
  JOB_PRIORITY_LABELS,
  PRIORITY_BORDERS,
} from "@/lib/constants/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Lock } from "lucide-react";

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
}

interface JobWithParts extends JobWithCar {
  parts_count?: number;
}

function vinShort(vin: string) {
  return vin.length >= 8 ? `...${vin.slice(-8)}` : vin;
}

export default function GarageHistoryPage() {
  const router = useRouter();
  const { profile, canSeeGarageHistory } = useUser();
  const [jobs, setJobs] = useState<JobWithParts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [accessStatus, setAccessStatus] = useState<PageAccessStatus | null>(null);
  const [accessCheckLoading, setAccessCheckLoading] = useState(true);
  const [requestingAccess, setRequestingAccess] = useState(false);

  const supabase = createClient();

  const hasAccess = canSeeGarageHistory || accessStatus === "approved";

  useEffect(() => {
    if (canSeeGarageHistory) {
      setAccessStatus("approved");
      setAccessCheckLoading(false);
      return;
    }
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAccessCheckLoading(false);
        return;
      }
      const status = await getPageAccessStatus(user.id, "garage_history");
      setAccessStatus(status);
      setAccessCheckLoading(false);
    };
    run();
  }, [canSeeGarageHistory]);

  async function handleRequestAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profile) return;
    setRequestingAccess(true);
    const { success } = await requestPageAccess(
      user.id,
      "garage_history",
      profile.full_name ?? "An employee"
    );
    setRequestingAccess(false);
    if (success) {
      setAccessStatus("pending");
      toast.success("Access request sent. You will be notified when approved.");
    } else {
      toast.error("Failed to send access request.");
    }
  }

  async function fetchJobs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("garage_jobs")
      .select("*, cars:car_id(id, vin, brand, model, model_year, exterior_color, status)")
      .is("deleted_at", null)
      .in("status", ["done", "cancelled"])
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setJobs([]);
    } else {
      const jobsData = (data as JobWithCar[]) ?? [];
      const jobIds = jobsData.map((j) => j.id);
      if (jobIds.length > 0) {
        const { data: partsData } = await supabase
          .from("job_parts")
          .select("job_id")
          .in("job_id", jobIds);
        const countByJob: Record<string, number> = {};
        for (const p of partsData ?? []) {
          countByJob[(p as { job_id: string }).job_id] =
            (countByJob[(p as { job_id: string }).job_id] ?? 0) + 1;
        }
        setJobs(
          jobsData.map((j) => ({
            ...j,
            parts_count: countByJob[j.id] ?? 0,
          }))
        );
      } else {
        setJobs(jobsData);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (q) {
        const car = j.cars;
        const vin = (car?.vin ?? "").toLowerCase();
        const brand = (car?.brand ?? "").toLowerCase();
        const model = (car?.model ?? "").toLowerCase();
        const title = (j.title ?? "").toLowerCase();
        const assigned = (j.assigned_to ?? "").toLowerCase();
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
  }, [jobs, search, statusFilter]);

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const aCompleted = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bCompleted = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      if (aCompleted !== bCompleted) return bCompleted - aCompleted;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredJobs]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      done: jobs.filter((j) => j.status === "done").length,
      cancelled: jobs.filter((j) => j.status === "cancelled").length,
      doneToday: jobs.filter(
        (j) =>
          j.status === "done" &&
          j.completed_at &&
          j.completed_at.startsWith(today)
      ).length,
    };
  }, [jobs]);

  if (accessCheckLoading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="py-12 text-center text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Lock className="mb-4 size-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">You don&apos;t have access to Garage History</h2>
          <p className="mt-2 text-muted-foreground">
            Request access from management to view completed and cancelled garage jobs.
          </p>
          <Button
            className="mt-6"
            onClick={handleRequestAccess}
            disabled={requestingAccess || accessStatus === "pending"}
          >
            {accessStatus === "pending"
              ? "Access Requested — Waiting for Approval"
              : requestingAccess
                ? "Sending..."
                : "Request Access"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <History className="size-6" />
              Garage History
            </h1>
            <p className="text-muted-foreground text-sm">
              All completed and cancelled jobs
            </p>
          </div>
        </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">✅ Completed</p>
          <p className="text-2xl font-bold">{stats.done}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">❌ Cancelled</p>
          <p className="text-2xl font-bold">{stats.cancelled}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">✅ Done Today</p>
          <p className="text-2xl font-bold">{stats.doneToday}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-2">
          {["all", "done", "cancelled"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {s === "all" ? "All" : JOB_STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
        <Input
          id="garage-history-search"
          name="garage-history-search"
          placeholder="Search VIN, title, assigned to..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-64"
        />
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted-foreground">Loading...</p>
      ) : sortedJobs.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">No history yet.</p>
          <Button className="mt-4" asChild>
            <Link href="/garage">View active jobs</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedJobs.map((job) => {
            const car = job.cars;
            const borderClass =
              PRIORITY_BORDERS[job.priority] ?? "border-l-4 border-l-gray-300";
            return (
              <Card key={job.id} className={borderClass}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{job.title}</CardTitle>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge className={JOB_STATUS_COLORS[job.status]}>
                          {JOB_STATUS_LABELS[job.status]}
                        </Badge>
                        <Badge variant="outline">
                          {JOB_PRIORITY_LABELS[job.priority]}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => router.push(`/garage/jobs/${job.id}`)}
                    >
                      View Job
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {car && (
                    <p>
                      <Link
                        href={`/cars/${encodeURIComponent(car.vin ?? car.id)}`}
                        className="text-primary hover:underline"
                      >
                        {car.brand} {car.model} · VIN: {vinShort(car.vin)}
                      </Link>
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">Assigned:</span>{" "}
                      {job.assigned_to ?? "—"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Est/Act:</span>{" "}
                      {job.estimated_hours ?? "—"}h / {job.actual_hours ?? "—"}h
                    </div>
                    <div>
                      <span className="text-muted-foreground">Parts:</span>{" "}
                      {(job as JobWithParts).parts_count ?? 0}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>{" "}
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                    {job.completed_at && (
                      <div>
                        <span className="text-muted-foreground">Completed:</span>{" "}
                        {new Date(job.completed_at).toLocaleString()}
                      </div>
                    )}
                    {job.due_date && (
                      <div>
                        <span className="text-muted-foreground">Due was:</span>{" "}
                        {new Date(job.due_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  {job.description && (
                    <p className="text-muted-foreground line-clamp-2">
                      {job.description}
                    </p>
                  )}
                  {job.work_done && (
                    <p className="text-muted-foreground line-clamp-2">
                      <span className="font-medium">Work done:</span>{" "}
                      {job.work_done}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
