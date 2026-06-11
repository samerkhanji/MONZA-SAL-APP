"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarStatus } from "@/types/database";
import { CAR_STATUS_LABELS } from "@/types/database";
import { PART_STATUS_LABELS } from "@/lib/constants/parts";
import { JOB_STATUS_LABELS } from "@/lib/constants/jobs";
import {
  Car,
  Wrench,
  Users,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
interface LowStockPart {
  id: string;
  part_name: string;
  oe_number: string | null;
  quantity: number;
  status: string;
}

interface GarageJobCar {
  id: string;
  vin: string;
  brand: string;
  model: string;
}

interface GarageJobRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  cars?: GarageJobCar | GarageJobCar[] | null;
}

interface RequestSummaryRow {
  id: string;
  status: string;
  submitted_by: string;
  assigned_to: string | null;
  send_to: string | null;
  send_to_user_id: string | null;
}

const CAR_STATUS_ORDER: CarStatus[] = ["inventory", "available", "reserved", "sold"];

const JOB_STATUS_ORDER = ["pending", "in_progress", "waiting_parts", "done", "cancelled"] as const;

const JOB_STATUS_DOT_COLORS: Record<string, string> = {
  pending: "bg-gray-400",
  in_progress: "bg-blue-500",
  waiting_parts: "bg-amber-500",
  done: "bg-green-500",
  cancelled: "bg-red-400",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  inventory: "bg-slate-500",
  available: "bg-emerald-500",
  reserved: "bg-sky-500",
  sold: "bg-violet-500",
};

export default function DashboardPage() {
  const router = useRouter();
  const {
    profile,
    loading: profileLoading,
    isRequestAssistant,
    isRequestManagement,
    isSamer,
    isKareem,
    isHoussam,
    isOwner,
  } = useUser();

  useEffect(() => {
    if (profileLoading) return;
    if (isRequestAssistant && !isOwner) {
      router.replace("/assistant-dashboard");
    }
  }, [profileLoading, isRequestAssistant, isOwner, router]);

  const shouldRedirect = !profileLoading && isRequestAssistant && !isOwner;
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalCars, setTotalCars] = useState<number>(0);
  const [inGarageCount, setInGarageCount] = useState<number>(0);
  const [customersCount, setCustomersCount] = useState<number>(0);
  const [activeJobsCount, setActiveJobsCount] = useState<number>(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [jobStatusCounts, setJobStatusCounts] = useState<Record<string, number>>({});
  const [recentJobs, setRecentJobs] = useState<GarageJobRow[]>([]);
  const [lowStockParts, setLowStockParts] = useState<LowStockPart[]>([]);
  // Tracks which sections failed to load so we can show a persistent
  // "Couldn't load X" banner instead of silently rendering 0s.
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [approvals, setApprovals] = useState({
    refunds: 0,
    pos: 0,
    estimates: 0,
    tradeins: 0,
  });
  const canSeeApprovals = isOwner || isRequestManagement;

  const fetchData = useCallback(async () => {
    if (shouldRedirect) return;
    const supabase = createClient();
    setLoading(true);
    const errors: string[] = [];

    const [
      carsAllRes,
      carsServiceRes,
      customersRes,
      jobsRes,
      jobsDetailRes,
      jobsStatusResults,
      carsStatusRes,
      partsRes,
      requestsRes,
    ] = await Promise.all([
      supabase
        .from("cars_display")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("cars_display")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("location_type", "garage"),
      supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("garage_jobs")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress", "waiting_parts"]),
      supabase
        .from("garage_jobs")
        .select("id, title, status, priority, due_date, created_at, cars:car_id(id, vin, brand, model)")
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(10),
      // Count each job status server-side instead of transferring every row.
      Promise.all(
        JOB_STATUS_ORDER.map((status) =>
          supabase
            .from("garage_jobs")
            .select("*", { count: "exact", head: true })
            .is("deleted_at", null)
            .eq("status", status)
        )
      ),
      supabase.from("cars_display").select("status").is("deleted_at", null),
      supabase
        .from("parts")
        .select("id, part_name, oe_number, quantity, status")
        .is("deleted_at", null)
        .in("status", ["low_stock", "out_of_stock"])
        .order("quantity", { ascending: true })
        .limit(5),
      supabase
        .from("requests")
        .select("id, status, submitted_by, assigned_to, send_to, send_to_user_id")
        .in("status", ["submitted", "awaiting_approval", "needs_more_info"]),
    ]);

    if (carsAllRes.error) {
      errors.push("Total Cars");
    } else {
      setTotalCars(carsAllRes.count ?? 0);
    }

    if (carsServiceRes.error) {
      errors.push("In Garage");
    } else {
      setInGarageCount(carsServiceRes.count ?? 0);
    }

    if (customersRes.error) {
      errors.push("Leads & Clients");
    } else {
      setCustomersCount(customersRes.count ?? 0);
    }

    if (jobsRes.error) {
      errors.push("Active Jobs");
    } else {
      setActiveJobsCount(jobsRes.count ?? 0);
    }

    if (jobsDetailRes.error) {
      errors.push("Recent Jobs");
    } else {
      setRecentJobs((jobsDetailRes.data as unknown as GarageJobRow[]) ?? []);
    }

    if (jobsStatusResults.some((r) => r.error)) {
      errors.push("Job Statuses");
    } else {
      const counts: Record<string, number> = {};
      JOB_STATUS_ORDER.forEach((status, i) => {
        counts[status] = jobsStatusResults[i].count ?? 0;
      });
      setJobStatusCounts(counts);
    }

    if (carsStatusRes.error) {
      errors.push("Car Statuses");
    } else {
      const counts: Record<string, number> = {};
      CAR_STATUS_ORDER.forEach((s) => (counts[s] = 0));
      (carsStatusRes.data ?? []).forEach((row) => {
        const status = row.status;
        if (status) counts[status] = (counts[status] ?? 0) + 1;
      });
      setStatusCounts(counts);
    }

    if (partsRes.error) {
      errors.push("Low Stock Parts");
    } else {
      setLowStockParts((partsRes.data as LowStockPart[]) ?? []);
    }

    if (requestsRes.error) {
      errors.push("Pending Requests");
      setPendingRequestsCount(0);
    } else {
      const myId = profile?.id ?? null;
      const canTrackRequests =
        isRequestAssistant ||
        isRequestManagement ||
        isSamer ||
        isKareem ||
        isHoussam ||
        isOwner;

      if (!myId || !canTrackRequests) {
        setPendingRequestsCount(0);
      } else {
        const rows = (requestsRes.data as RequestSummaryRow[]) ?? [];
        const myPersonal = rows.filter(
          (r) =>
            r.submitted_by === myId ||
            r.send_to_user_id === myId ||
            r.assigned_to === myId
        );

        const mergeUnique = (
          base: RequestSummaryRow[],
          extra: RequestSummaryRow[]
        ): RequestSummaryRow[] => {
          const seen = new Set(base.map((r) => r.id));
          const merged = [...base];
          for (const row of extra) {
            if (!seen.has(row.id)) {
              merged.push(row);
              seen.add(row.id);
            }
          }
          return merged;
        };

        let visible = myPersonal;
        if (isRequestAssistant) {
          const forReview = rows.filter(
            (r) => r.send_to === "houssam" || r.send_to === "kareem"
          );
          visible = mergeUnique(forReview, myPersonal);
        } else if (
          isRequestManagement ||
          isSamer ||
          isKareem ||
          isHoussam
        ) {
          const forOwners = rows.filter(
            (r) =>
              r.send_to === "samer" ||
              r.send_to === "kareem" ||
              (r.send_to === "houssam" && r.status === "awaiting_approval")
          );
          visible = mergeUnique(forOwners, myPersonal);
        }

        const pendingCount = visible.filter(
          (r) =>
            r.status === "submitted" ||
            r.status === "awaiting_approval" ||
            r.status === "needs_more_info"
        ).length;

        setPendingRequestsCount(pendingCount);
      }
    }

    setLoadErrors(errors);
    setLastUpdated(new Date());
    setLoading(false);
  }, [
    shouldRedirect,
    profile?.id,
    isRequestAssistant,
    isRequestManagement,
    isSamer,
    isKareem,
    isHoussam,
    isOwner,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Approvals-waiting queue — one place for the owner/managers to see what's
  // blocked on them, instead of visiting four separate pages.
  useEffect(() => {
    if (!canSeeApprovals) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const head = { count: "exact" as const, head: true };
      const [r, p, e, t] = await Promise.all([
        supabase.from("refunds").select("id", head).eq("status", "pending").is("deleted_at", null),
        supabase.from("purchase_orders").select("id", head).eq("status", "pending_approval").is("deleted_at", null),
        supabase.from("repair_proposals").select("id", head).eq("status", "pending_owner_approval"),
        supabase.from("trade_ins").select("id", head).eq("status", "inspected").is("deleted_at", null),
      ]);
      if (cancelled) return;
      setApprovals({
        refunds: r.count ?? 0,
        pos: p.count ?? 0,
        estimates: e.count ?? 0,
        tradeins: t.count ?? 0,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [canSeeApprovals]);

  const showPendingRequestsCard =
    isRequestAssistant ||
    isRequestManagement ||
    isSamer ||
    isKareem ||
    isHoussam ||
    isOwner;

  // "In stock" = anything not yet sold/delivered. Derived from the same
  // cars_display status query that feeds the "Cars by Status" widget, so
  // we don't pay for an extra round-trip. Matches Reports' "Cars in Stock"
  // figure (report_inventory_aging view excludes sold + delivered too).
  const inStockCount = Object.entries(statusCounts)
    .filter(([s]) => s !== "sold" && s !== "delivered")
    .reduce((sum, [, n]) => sum + n, 0);

  const kpiCards = [
    {
      label: "Total Cars",
      value: totalCars,
      hint: `${inStockCount} in stock`,
      icon: Car,
      href: "/cars",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "In Garage",
      value: inGarageCount,
      icon: Wrench,
      href: "/cars?location=garage",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      label: "Leads & Clients",
      value: customersCount,
      icon: Users,
      href: "/customers",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      label: "Active Jobs",
      value: activeJobsCount,
      icon: AlertCircle,
      href: "/garage",
      color:
        activeJobsCount > 0
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground",
      bgColor:
        activeJobsCount > 0
          ? "bg-red-100 dark:bg-red-900/30"
          : "bg-muted/50",
    },
    ...(showPendingRequestsCard
      ? [
          {
            label: "Pending Requests",
            value: pendingRequestsCount,
            icon: ClipboardList,
            href: "/requests",
            color:
              pendingRequestsCount > 0
                ? "text-violet-600 dark:text-violet-400"
                : "text-muted-foreground",
            bgColor:
              pendingRequestsCount > 0
                ? "bg-violet-100 dark:bg-violet-900/30"
                : "bg-muted/50",
          },
        ]
      : []),
  ];

  if (shouldRedirect) return null;

  return (
    <div className="container mx-auto space-y-6 overflow-x-hidden px-4 py-6 pb-20 sm:px-6 sm:pb-6 lg:px-8">
      <InstallBanner />
      {loadErrors.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Some numbers couldn&apos;t load.</p>
              <p className="text-amber-700 dark:text-amber-400">
                Affected: {loadErrors.join(", ")}.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData()}
            disabled={loading}
            className="self-start sm:self-center"
          >
            <RefreshCw
              className={`mr-1 size-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden
            />
            Retry
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Dashboard</h1>
          {profileLoading ? (
            <Skeleton className="mt-1 h-5 w-48" />
          ) : (
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name ?? "there"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {lastUpdated && (
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData()}
            disabled={loading}
          >
            <RefreshCw
              className={`size-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden
            />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        className={`grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 ${showPendingRequestsCard ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
        data-tour-id="dashboard-kpi-cards"
      >
        {kpiCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-6">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-12 ${card.bgColor} ${card.color}`}
                >
                  <card.icon className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold sm:text-2xl">{loading ? "—" : card.value}</p>
                  <p className="text-xs text-muted-foreground sm:text-sm">{card.label}</p>
                  {!loading && "hint" in card && card.hint ? (
                    <p className="text-[10px] text-muted-foreground sm:text-xs">{card.hint}</p>
                  ) : null}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground max-sm:hidden" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Approvals waiting — visible to owner/managers who can approve. */}
      {canSeeApprovals && (
        <Card data-tour-id="dashboard-approvals-panel">
          <CardHeader>
            <CardTitle>Approvals waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Refunds", value: approvals.refunds, href: "/garage/refunds" },
                { label: "Purchase orders", value: approvals.pos, href: "/garage/purchase-orders" },
                { label: "Repair estimates", value: approvals.estimates, href: "/garage" },
                { label: "Trade-ins", value: approvals.tradeins, href: "/trade-ins" },
              ].map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <p className={`text-2xl font-bold ${a.value > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {a.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{a.label}</p>
                </Link>
              ))}
            </div>
            {approvals.refunds + approvals.pos + approvals.estimates + approvals.tradeins === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">Nothing waiting on you. ✅</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Middle Row: Cars by Status + Low Stock + Garage Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cars by Status */}
        <Card data-tour-id="dashboard-cars-by-status-panel">
          <CardHeader>
            <CardTitle>Cars by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {CAR_STATUS_ORDER.slice(0, 5).map((s) => (
                  <Skeleton key={s} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {CAR_STATUS_ORDER.map((status) => {
                  const count = statusCounts[status] ?? 0;
                  return (
                    <Link
                      key={status}
                      href={`/cars?status=${status}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-block size-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[status] ?? "bg-gray-400"}`}
                        />
                        <span>{CAR_STATUS_LABELS[status] ?? status}</span>
                      </span>
                      <span className="font-mono text-sm text-muted-foreground">
                        {count}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card data-tour-id="dashboard-low-stock-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : lowStockParts.length === 0 ? (
              <p className="py-4 text-center text-green-600 dark:text-green-400">
                ✅ All parts in stock
              </p>
            ) : (
              <div className="space-y-2">
                {lowStockParts.map((p) => (
                  <Link
                    key={p.id}
                    href="/garage/inventory"
                    className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0 font-medium">{p.part_name}</span>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">
                        {p.quantity} left
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          p.status === "out_of_stock"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {PART_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                  </Link>
                ))}
                <Button variant="link" className="mt-2 w-full" asChild>
                  <Link href="/garage/inventory">
                    View All Parts <ChevronRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Garage Overview */}
        <Card data-tour-id="dashboard-garage-overview-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-5" />
              Garage Overview
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/garage">
                View All <ChevronRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <>
                <div className="mb-4 space-y-1">
                  {JOB_STATUS_ORDER.map((status) => {
                    const count = jobStatusCounts[status] ?? 0;
                    return (
                      <Link
                        key={status}
                        href={`/garage?status=${status}`}
                        className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`inline-block size-2 shrink-0 rounded-full ${JOB_STATUS_DOT_COLORS[status] ?? "bg-gray-400"}`}
                          />
                          <span>{JOB_STATUS_LABELS[status] ?? status}</span>
                        </span>
                        <span className="font-mono text-sm text-muted-foreground">
                          {count}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <div className="border-t pt-3">
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    Recent jobs
                  </p>
                  {recentJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No jobs yet
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {recentJobs.slice(0, 5).map((job) => {
                        const car = Array.isArray(job.cars)
                          ? job.cars[0]
                          : job.cars;
                        const carLabel = car
                          ? `${car.brand} ${car.model}`
                          : "—";
                        return (
                          <li key={job.id}>
                            <Link
                              href={`/garage/jobs/${job.id}`}
                              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                            >
                              <span className="min-w-0 truncate">
                                {job.priority === "urgent" && (
                                  <span className="mr-1 text-red-500">●</span>
                                )}
                                {job.title}
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {carLabel}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
