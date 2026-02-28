"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfileFullName } from "@/lib/supabase-profile";

function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return then.toLocaleDateString();
}

interface CarEventRow {
  id: string;
  car_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
  cars?: { vin: string; brand: string; model: string } | null;
}

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

const CAR_STATUS_ORDER: CarStatus[] = [
  "inbound",
  "in_stock",
  "showroom",
  "reserved",
  "sold",
  "delivered",
  "service",
  "sent_to_sub_dealer",
  "demo",
];

const JOB_STATUS_ORDER = ["pending", "in_progress", "waiting_parts", "done", "cancelled"] as const;

const JOB_STATUS_DOT_COLORS: Record<string, string> = {
  pending: "bg-gray-400",
  in_progress: "bg-blue-500",
  waiting_parts: "bg-amber-500",
  done: "bg-green-500",
  cancelled: "bg-red-400",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  inbound: "bg-gray-400",
  in_stock: "bg-blue-500",
  showroom: "bg-green-500",
  reserved: "bg-amber-500",
  sold: "bg-purple-500",
  delivered: "bg-emerald-500",
  service: "bg-red-500",
  sent_to_sub_dealer: "bg-orange-500",
  demo: "bg-cyan-500",
};

function formatActivityMessage(ev: CarEventRow): string {
  const name = getProfileFullName(ev.profiles);
  const user = name !== "Unknown" ? name : "System";
  const car = ev.cars as
    | { vin?: string; brand?: string; model?: string }
    | undefined;
  const brand = car?.brand ?? "";
  const model = car?.model ?? "";
  const vinShort = car?.vin ? `...${String(car.vin).slice(-4)}` : "";
  const carLabel = [brand, model].filter(Boolean).join(" ") || "car";

  switch (ev.event_type) {
    case "created":
      return `${user} added ${carLabel}${vinShort ? ` (VIN ${vinShort})` : ""}`;
    case "moved":
      return `${user} moved ${carLabel} to ${ev.to_value ?? "new location"}`;
    case "status_changed":
      return `${user} changed ${carLabel} status to ${ev.to_value ?? ""}`;
    case "battery_updated":
      return `${user} updated battery on ${carLabel}`;
    case "pdi_updated":
      return `${user} updated PDI on ${carLabel}`;
    case "details_updated":
      return `${user} edited ${carLabel} details`;
    case "note_added":
      return `${user} added a note on ${carLabel}`;
    default:
      return `${user}: ${ev.event_type}`;
  }
}

function getActivityIcon(eventType: string): string {
  switch (eventType) {
    case "created":
      return "🚗";
    case "moved":
      return "🔄";
    case "status_changed":
      return "📊";
    case "battery_updated":
      return "🔋";
    case "pdi_updated":
      return "📋";
    case "details_updated":
      return "✏️";
    case "note_added":
      return "📝";
    default:
      return "📌";
  }
}

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
  const [activities, setActivities] = useState<CarEventRow[]>([]);

  const fetchData = useCallback(async () => {
    if (shouldRedirect) return;
    const supabase = createClient();
    setLoading(true);

    const [
      carsAllRes,
      carsServiceRes,
      customersRes,
      jobsRes,
      jobsDetailRes,
      jobsStatusRes,
      carsStatusRes,
      partsRes,
      requestsRes,
      eventsRes,
    ] = await Promise.all([
      supabase
        .from("cars_display")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("cars_display")
        .select("*", { count: "exact", head: true })
        .eq("status", "service"),
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
      supabase
        .from("garage_jobs")
        .select("status")
        .is("deleted_at", null),
      supabase.from("cars_display").select("status"),
      supabase
        .from("parts")
        .select("id, part_name, oe_number, quantity, status")
        .is("deleted_at", null)
        .in("status", ["low_stock", "out_of_stock"])
        .order("quantity", { ascending: true })
        .limit(5),
      supabase
        .from("requests")
        .select("id, status, submitted_by, assigned_to, send_to, send_to_user_id"),
      supabase
        .from("car_events")
        .select("*, profiles:created_by(full_name), cars:car_id(vin, brand, model)")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (carsAllRes.error) {
      toast.error(carsAllRes.error.message ?? "Failed to load dashboard");
    } else {
      setTotalCars(carsAllRes.count ?? 0);
    }

    if (carsServiceRes.error) {
      toast.error(carsServiceRes.error.message ?? "Failed to load garage count");
    } else {
      setInGarageCount(carsServiceRes.count ?? 0);
    }

    if (customersRes.error) {
      toast.error(customersRes.error.message ?? "Failed to load customers");
    } else {
      setCustomersCount(customersRes.count ?? 0);
    }

    if (jobsRes.error) {
      toast.error(jobsRes.error.message ?? "Failed to load jobs");
    } else {
      setActiveJobsCount(jobsRes.count ?? 0);
    }

    if (jobsDetailRes.error) {
      toast.error(jobsDetailRes.error.message ?? "Failed to load garage jobs");
    } else {
      setRecentJobs((jobsDetailRes.data as unknown as GarageJobRow[]) ?? []);
    }

    if (jobsStatusRes.error) {
      toast.error(jobsStatusRes.error.message ?? "Failed to load job statuses");
    } else {
      const counts: Record<string, number> = {
        pending: 0,
        in_progress: 0,
        waiting_parts: 0,
        done: 0,
        cancelled: 0,
      };
      (jobsStatusRes.data ?? []).forEach((row: { status: string }) => {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
      });
      setJobStatusCounts(counts);
    }

    if (carsStatusRes.error) {
      toast.error(carsStatusRes.error.message ?? "Failed to load car statuses");
    } else {
      const counts: Record<string, number> = {};
      CAR_STATUS_ORDER.forEach((s) => (counts[s] = 0));
      (carsStatusRes.data ?? []).forEach((row: { status: string }) => {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
      });
      setStatusCounts(counts);
    }

    if (partsRes.error) {
      toast.error(partsRes.error.message ?? "Failed to load parts");
    } else {
      setLowStockParts((partsRes.data as LowStockPart[]) ?? []);
    }

    if (requestsRes.error) {
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

    if (eventsRes.error) {
      toast.error(eventsRes.error.message ?? "Failed to load activity");
    } else {
      setActivities((eventsRes.data as CarEventRow[]) ?? []);
    }

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

  const showPendingRequestsCard =
    isRequestAssistant ||
    isRequestManagement ||
    isSamer ||
    isKareem ||
    isHoussam ||
    isOwner;

  const kpiCards = [
    {
      label: "Total Cars",
      value: totalCars,
      icon: Car,
      href: "/cars",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "In Garage",
      value: inGarageCount,
      icon: Wrench,
      href: "/cars?status=service",
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
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <InstallBanner />
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
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${showPendingRequestsCard ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
      >
        {kpiCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-4 p-6">
                <div
                  className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${card.bgColor} ${card.color}`}
                >
                  <card.icon className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-bold">{loading ? "—" : card.value}</p>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Middle Row: Cars by Status + Low Stock + Garage Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cars by Status */}
        <Card>
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
        <Card>
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
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{p.part_name}</span>
                    <div className="flex items-center gap-2">
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
        <Card>
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

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No recent activity
            </p>
          ) : (
            <ul className="space-y-3">
              {activities.map((ev) => (
                <li key={ev.id}>
                  <Link
                    href={`/cars/${ev.car_id}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <span className="text-lg" aria-hidden>
                      {getActivityIcon(ev.event_type)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {formatActivityMessage(ev)}
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {timeAgo(ev.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
