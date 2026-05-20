"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import {
  ClipboardList,
  Car,
  Wrench,
  AlertTriangle,
  Calendar,
  Phone,
  ChevronRight,
  RefreshCw,
  FileCheck,
  BarChart3,
  FileText,
  DollarSign,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_LABELS } from "@/lib/constants/jobs";
import { REQUEST_CATEGORIES } from "@/lib/constants/requests";
import { ExportButton } from "@/components/ExportButton";
import { KpiCard } from "@/components/ui/kpi-card";
import { cn } from "@/lib/utils";
import { getProfileFullName } from "@/lib/supabase-profile";
import { formatError } from "@/lib/error-messages";

const REFRESH_INTERVAL_MS = 60000;

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

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function formatVinShort(vin: string | null | undefined): string {
  const v = (vin ?? "").trim();
  if (!v) return "—";
  if (v.length <= 12) return v;
  return `…${v.slice(-8)}`;
}

interface JobWithCar {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  started_at: string | null;
  assigned_to: string | null;
  assigned_profile?: { id: string; full_name: string | null } | null;
  created_at: string;
  cars?: { vin: string; brand: string; model: string } | null;
}

interface RequestRow {
  id: string;
  subject: string;
  category: string | null;
  submitted_by: string;
  submitter_name?: string;
  created_at: string;
}

interface RepairProposalDashRow {
  id: string;
  job_id: string;
  status: string;
  updated_at: string;
  garage_jobs?: {
    title: string;
    cars?: { vin: string } | null;
  } | null;
}

export default function AssistantDashboardPage() {
  const router = useRouter();
  const { profile, isRequestAssistant, isOwner, isHybrid, loading: profileLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [carsReadyCount, setCarsReadyCount] = useState(0);
  const [carsInWorkshopCount, setCarsInWorkshopCount] = useState(0);
  const [overduePickupsCount, setOverduePickupsCount] = useState(0);
  const [pendingDeletionsCount, setPendingDeletionsCount] = useState(0);
  const [todaysServiceCount, setTodaysServiceCount] = useState(0);
  // Tracks which sections failed to load so we can show a persistent
  // "Couldn't load X" banner instead of silently rendering 0s.
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [cashCollected7d, setCashCollected7d] = useState<{ total: number; currency: string }>({
    total: 0,
    currency: "USD",
  });
  const [staleJobsCount, setStaleJobsCount] = useState<number>(0);
  const [overdueInstallments, setOverdueInstallments] = useState<{ count: number; total: number }>({
    count: 0,
    total: 0,
  });

  const [pendingRequests, setPendingRequests] = useState<RequestRow[]>([]);
  const [workshopJobs, setWorkshopJobs] = useState<JobWithCar[]>([]);
  const [completedAwaitingPickup, setCompletedAwaitingPickup] = useState<JobWithCar[]>([]);
  const [warrantyAlerts, setWarrantyAlerts] = useState<
    Array<{ vin: string; brand: string; model: string; warranty_type: string; expiry: string; days_left: number }>
  >([]);

  const pendingRequestsRef = useRef<HTMLDivElement>(null);
  const carsReadyRef = useRef<HTMLDivElement>(null);
  const workshopRef = useRef<HTMLDivElement>(null);
  const repairProposalsRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>("Review Requests");
  const [markingDelivered, setMarkingDelivered] = useState<string | null>(null);
  const [repairProposals, setRepairProposals] = useState<RepairProposalDashRow[]>([]);

  const supabase = createClient();

  async function handleMarkDelivered(job: JobWithCar) {
    setMarkingDelivered(job.id);
    const { error } = await supabase
      .from("garage_jobs")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", job.id);
    setMarkingDelivered(null);
    if (error) {
      toast.error(formatError(error));
    } else {
      toast.success("Marked as delivered");
      fetchData();
    }
  }

  const canAccess = isRequestAssistant || isOwner || isHybrid;

  useEffect(() => {
    if (!profileLoading && !canAccess) {
      router.replace("/dashboard");
    }
  }, [profileLoading, canAccess, router]);

  const fetchData = useCallback(async () => {
    if (!canAccess) return;

    setLoading(true);
    const errors: string[] = [];

    const today = new Date().toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const sevenDaysAgoDate = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .slice(0, 10);

    const [
      jobsRes,
      deleteRes,
      carsRes,
      requestsWithProfiles,
      proposalsRes,
      paidInstallmentsRes,
      paidDepositsRes,
      staleJobsRes,
      overdueInstallmentsRes,
    ] = await Promise.all([
      supabase
        .from("garage_jobs")
        .select("*, cars:car_id(id, vin, brand, model), assigned_profile:assigned_to(id, full_name)")
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress", "waiting_parts", "done", "delivered"])
        .order("created_at", { ascending: false }),
      supabase
        .from("delete_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("cars")
        .select(
          "id, vin, brand, model, warranty_per_dms, warranty_vehicle_expiry, warranty_battery_expiry, warranty_expiry, warranty_monza_start_date"
        )
        .is("deleted_at", null),
      supabase
        .from("requests")
        .select("id, subject, category, submitted_by, created_at, profiles:submitted_by(full_name)")
        .eq("status", "submitted")
        .order("created_at", { ascending: false }),
      supabase
        .from("repair_proposals")
        .select(
          "id, job_id, status, updated_at, garage_jobs:job_id(title, cars:car_id(vin))"
        )
        .neq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(30),
      supabase
        .from("installment_payments")
        .select("paid_amount")
        .eq("status", "paid")
        .gte("paid_at", sevenDaysAgo),
      supabase
        .from("sales_orders")
        .select("deposit_amount")
        .gte("deposit_paid_at", sevenDaysAgo),
      supabase
        .from("garage_jobs")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("status", ["pending", "waiting_parts"])
        .lt("created_at", sevenDaysAgoDate),
      supabase
        .from("installment_payments")
        .select("amount_due, paid_amount")
        .neq("status", "paid")
        .neq("status", "waived")
        .lt("due_date", today),
    ]);

    if (jobsRes.error) errors.push("Workshop Jobs");
    if (carsRes.error) errors.push("Warranty Alerts");
    if (deleteRes.error) errors.push("Pending Approvals");
    if (requestsWithProfiles.error) errors.push("Pending Requests");
    if (proposalsRes.error) errors.push("Repair Proposals");

    const jobs = (jobsRes.data ?? []) as JobWithCar[];
    const cars = carsRes.data ?? [];

    setPendingDeletionsCount(deleteRes.count ?? 0);

    const doneJobs = jobs.filter((j) => j.status === "done");
    const inProgressJobs = jobs.filter((j) =>
      ["pending", "in_progress", "waiting_parts"].includes(j.status)
    );
    const overdue = doneJobs.filter((j) => {
      const completed = j.completed_at ?? j.created_at;
      return completed && new Date(completed) < new Date(threeDaysAgo) && !j.delivered_at;
    });
    const dueToday = jobs.filter((j) => j.due_date && j.due_date.slice(0, 10) === today);

    setCarsReadyCount(doneJobs.length);
    setCarsInWorkshopCount(inProgressJobs.length);
    setOverduePickupsCount(overdue.length);
    setTodaysServiceCount(dueToday.length);

    setWorkshopJobs(jobs.filter((j) => ["pending", "in_progress", "waiting_parts", "done"].includes(j.status)));
    setCompletedAwaitingPickup(
      doneJobs.sort((a, b) => {
        const aDate = a.completed_at ?? a.created_at ?? "";
        const bDate = b.completed_at ?? b.created_at ?? "";
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      })
    );

    const warrantyItems: typeof warrantyAlerts = [];
    const now = new Date();
    for (const car of cars) {
      const c = car as {
        vin: string;
        brand: string;
        model: string;
        warranty_per_dms: string | null;
        warranty_vehicle_expiry: string | null;
        warranty_battery_expiry: string | null;
        warranty_expiry: string | null;
        warranty_monza_start_date: string | null;
      };
      const dates: Array<{ type: string; date: string }> = [];
      if (c.warranty_per_dms) dates.push({ type: "DMS", date: c.warranty_per_dms });
      const vehicleExpiry =
        c.warranty_vehicle_expiry ??
        c.warranty_expiry ??
        c.warranty_monza_start_date;
      if (vehicleExpiry) dates.push({ type: "Vehicle", date: vehicleExpiry });
      if (c.warranty_battery_expiry) dates.push({ type: "Battery", date: c.warranty_battery_expiry });
      for (const d of dates) {
        const expiry = new Date(d.date);
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
        if (daysLeft <= 30 && daysLeft >= 0) {
          warrantyItems.push({
            vin: c.vin,
            brand: c.brand,
            model: c.model,
            warranty_type: d.type,
            expiry: d.date,
            days_left: daysLeft,
          });
        }
      }
    }
    warrantyItems.sort((a, b) => a.days_left - b.days_left);
    setWarrantyAlerts(warrantyItems.slice(0, 10));

    const reqList = (requestsWithProfiles.data ?? []).map((r: any) => ({
      id: r.id,
      subject: r.subject,
      category: r.category,
      submitted_by: r.submitted_by,
      created_at: r.created_at,
      profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
    }));

    // Use the same result set for both the list and the counter
    setPendingRequestsCount(reqList.length);
    setPendingRequests(
      reqList.map((r): RequestRow => ({
        id: r.id,
        subject: r.subject,
        category: r.category,
        submitted_by: r.submitted_by,
        created_at: r.created_at,
        submitter_name: getProfileFullName(r.profiles),
      }))
    );

    const rawProps = (proposalsRes.data ?? []) as unknown[];
    setRepairProposals(
      rawProps.map((row: unknown) => {
        const p = row as {
          id: string;
          job_id: string;
          status: string;
          updated_at: string;
          garage_jobs?: unknown;
        };
        const gj = p.garage_jobs;
        const jobRaw = Array.isArray(gj) ? gj[0] : gj;
        const job =
          jobRaw && typeof jobRaw === "object"
            ? (() => {
                const j = jobRaw as {
                  title?: string;
                  cars?: { vin: string } | { vin: string }[] | null;
                };
                const c = j.cars;
                const car = Array.isArray(c) ? c[0] : c;
                return { title: j.title ?? "", cars: car ?? null };
              })()
            : null;
        return {
          id: p.id,
          job_id: p.job_id,
          status: p.status,
          updated_at: p.updated_at,
          garage_jobs: job,
        };
      })
    );

    if (paidInstallmentsRes.error || paidDepositsRes.error) {
      errors.push("Cash collected (7d)");
    } else {
      const installments = (paidInstallmentsRes.data ?? []) as { paid_amount: number | null }[];
      const deposits = (paidDepositsRes.data ?? []) as { deposit_amount: number | null }[];
      const total =
        installments.reduce((s, r) => s + (Number(r.paid_amount) || 0), 0) +
        deposits.reduce((s, r) => s + (Number(r.deposit_amount) || 0), 0);
      setCashCollected7d({ total, currency: "USD" });
    }

    if (staleJobsRes.error) {
      errors.push("Stale jobs (>7d)");
    } else {
      setStaleJobsCount(staleJobsRes.count ?? 0);
    }

    if (overdueInstallmentsRes.error) {
      errors.push("Overdue installments");
    } else {
      const rows = (overdueInstallmentsRes.data ?? []) as {
        amount_due: number | null;
        paid_amount: number | null;
      }[];
      setOverdueInstallments({
        count: rows.length,
        total: rows.reduce(
          (s, r) => s + (Number(r.amount_due) || 0) - (Number(r.paid_amount) || 0),
          0
        ),
      });
    }

    setLoadErrors(errors);
    setLastUpdated(new Date());
    setLoading(false);
  }, [canAccess]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!profileLoading && !canAccess) return null;

  const cards = [
    { label: "Team Requests", value: pendingRequestsCount, color: "amber" as const, icon: ClipboardList, ref: pendingRequestsRef },
    { label: "Cars Ready for Pickup", value: carsReadyCount, color: "green" as const, icon: Car, ref: carsReadyRef },
    { label: "Cars in Workshop", value: carsInWorkshopCount, color: "amber" as const, icon: Wrench, ref: workshopRef },
    { label: "Overdue Pickups", value: overduePickupsCount, color: "red" as const, icon: AlertTriangle, ref: carsReadyRef },
    { label: "Pending Approvals", value: pendingDeletionsCount, color: "amber" as const, icon: FileCheck, href: "/requests/pending" },
    { label: "Today's Service", value: todaysServiceCount, color: "amber" as const, icon: Calendar, ref: workshopRef },
    {
      label: "Cash collected (7d)",
      value: `${Math.round(cashCollected7d.total).toLocaleString()} ${cashCollected7d.currency}`,
      color: "green" as const,
      icon: DollarSign,
      href: "/installments",
    },
    {
      label: "Stale jobs (>7d)",
      value: staleJobsCount,
      color: "amber" as const,
      icon: Clock,
      href: "/garage",
    },
    {
      label: "Overdue installments",
      value:
        overdueInstallments.count === 0
          ? "0"
          : `${overdueInstallments.count} · ${Math.round(overdueInstallments.total).toLocaleString()} USD`,
      color: "red" as const,
      icon: AlertTriangle,
      href: "/installments",
    },
  ];

  return (
    <div className="container mx-auto space-y-6 overflow-x-hidden px-4 py-6 pb-20 sm:px-6 sm:pb-6 lg:px-8">
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Assistant Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {profile?.full_name ?? "there"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {lastUpdated && (
            <span>Auto-refresh · Last: {lastUpdated.toLocaleTimeString()}</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          </Button>
        </div>
      </div>

      {/* Tab bar — scroll on narrow screens */}
      <div className="-mx-4 mb-6 flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-border px-4 pb-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {[
          { label: "Review Requests", icon: FileCheck, action: () => { setActiveTab("Review Requests"); scrollTo(pendingRequestsRef); } },
          { label: "Cars Ready", icon: Car, action: () => { setActiveTab("Cars Ready"); scrollTo(carsReadyRef); } },
          { label: "Workshop Overview", icon: BarChart3, action: () => { setActiveTab("Workshop Overview"); scrollTo(workshopRef); } },
          {
            label: "Repair proposals",
            icon: FileText,
            action: () => {
              setActiveTab("Repair proposals");
              scrollTo(repairProposalsRef);
            },
          },
          { label: "Request Center", icon: ClipboardList, href: "/requests" },
        ].map((tab) =>
          tab.href ? (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </Link>
          ) : (
            <button
              key={tab.label}
              type="button"
              onClick={tab.action}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab.label
                  ? "border-amber-500 bg-amber-500/10 text-amber-500"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          )
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card, i) => (
          <KpiCard
            key={card.href ?? `card-${i}`}
            label={card.label}
            value={loading ? "—" : card.value}
            icon={card.icon}
            color={card.color}
            onClick={() =>
              card.href ? (window.location.href = card.href) : card.ref && scrollTo(card.ref)
            }
          />
        ))}
      </div>

      {/* Repair proposals (Customer Service) */}
      <div ref={repairProposalsRef}>
        <Card data-tour-id="assistant-dashboard-repair-proposals-panel">
          <CardHeader>
            <CardTitle>Repair proposals</CardTitle>
            <CardDescription>
              Quotes from the garage awaiting CS / customer steps (not drafts)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : repairProposals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active repair proposals.</p>
            ) : (
              <ul className="space-y-2">
                {repairProposals.map((p) => {
                  const j = p.garage_jobs;
                  const vin = j?.cars?.vin ? formatVinShort(j.cars.vin) : "—";
                  const label = j?.title ?? "Job";
                  const statusLabel =
                    p.status === "sent_to_customer_service"
                      ? "Sent to CS"
                      : p.status === "sent_to_customer"
                        ? "With customer"
                        : p.status === "partially_approved"
                          ? "Partially approved"
                          : p.status === "fully_approved"
                            ? "Approved"
                            : p.status === "rejected"
                              ? "Rejected"
                              : p.status;
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{label}</p>
                        <p className="text-muted-foreground text-sm">
                          VIN {vin} · {statusLabel}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Updated {new Date(p.updated_at).toLocaleString()}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/garage/jobs/${p.job_id}`}>Open job</Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Pending Requests */}
      <div ref={pendingRequestsRef}>
        <Card data-tour-id="assistant-dashboard-pending-requests-panel">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>
                Requests sent to Houssam/Kareem awaiting review
              </CardDescription>
            </div>
            <ExportButton
              data={pendingRequests.map((r) => ({ subject: r.subject, submitted_by: r.submitter_name, created_at: r.created_at, category: r.category }))}
              allData={pendingRequests.map((r) => ({ subject: r.subject, submitted_by: r.submitter_name, created_at: r.created_at, category: r.category }))}
              columns={[
                { key: "subject", header: "Subject" },
                { key: "submitted_by", header: "Submitted By" },
                { key: "created_at", header: "Date", type: "date" },
                { key: "category", header: "Category" },
              ]}
              filename="Assistant_Pending_Requests"
              options={{ pageName: "Pending Requests", summary: `Total: ${pendingRequests.length}` }}
              disabled={loading}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : pendingRequests.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No pending requests</p>
            ) : (
              <>
                <div className="space-y-3 pb-2 md:hidden">
                  {pendingRequests.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-border/50 bg-card p-4 shadow-sm"
                    >
                      <p className="font-semibold leading-snug">{r.subject}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        By {r.submitter_name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                      <p className="mt-1 text-sm">
                        {REQUEST_CATEGORIES.includes(r.category as never)
                          ? r.category
                          : r.category ?? "—"}
                      </p>
                      <Button className="mt-3 w-full touch-manipulation" size="sm" variant="outline" asChild>
                        <Link href={`/requests?detail=${r.id}`}>
                          Review <ChevronRight className="ml-1 size-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto rounded-lg border md:block">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Subject</th>
                        <th className="px-4 py-3 text-left font-medium">Submitted By</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Category</th>
                        <th className="px-4 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">{r.subject}</td>
                          <td className="px-4 py-3">{r.submitter_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(r.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {REQUEST_CATEGORIES.includes(r.category as never)
                              ? r.category
                              : r.category ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/requests?detail=${r.id}`}>
                                Review <ChevronRight className="ml-1 size-4" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Workshop Status */}
      <div ref={workshopRef}>
        <Card data-tour-id="assistant-dashboard-workshop-panel">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Workshop Status</CardTitle>
              <CardDescription>All cars currently in the garage</CardDescription>
            </div>
            <ExportButton
              data={workshopJobs.map((j) => {
                const car = Array.isArray(j.cars) ? j.cars[0] : j.cars;
                return {
                  vin: car?.vin ?? "",
                  model: car ? `${car.brand} ${car.model}` : "",
                  title: j.title,
                  status: JOB_STATUS_LABELS[j.status] ?? j.status,
                  due_date: j.due_date,
                  assigned_to: (() => {
                    const ap = (j as { assigned_profile?: { full_name?: string | null } | null }).assigned_profile;
                    return ap?.full_name ?? (j as { external_assignee_name?: string | null }).external_assignee_name ?? null;
                  })(),
                  estimated_hours: j.estimated_hours,
                };
              })}
              allData={workshopJobs.map((j) => {
                const car = Array.isArray(j.cars) ? j.cars[0] : j.cars;
                return {
                  vin: car?.vin ?? "",
                  model: car ? `${car.brand} ${car.model}` : "",
                  title: j.title,
                  status: JOB_STATUS_LABELS[j.status] ?? j.status,
                  due_date: j.due_date,
                  assigned_to: (() => {
                    const ap = (j as { assigned_profile?: { full_name?: string | null } | null }).assigned_profile;
                    return ap?.full_name ?? (j as { external_assignee_name?: string | null }).external_assignee_name ?? null;
                  })(),
                  estimated_hours: j.estimated_hours,
                };
              })}
              columns={[
                { key: "vin", header: "VIN" },
                { key: "model", header: "Model" },
                { key: "title", header: "Reason of Visit" },
                { key: "status", header: "Status" },
                { key: "due_date", header: "Service Date", type: "date" },
                { key: "assigned_to", header: "Assigned To" },
                { key: "estimated_hours", header: "Est. Hours", type: "number" },
              ]}
              filename="Assistant_Workshop_Status"
              options={{ pageName: "Workshop Status", summary: `Total: ${workshopJobs.length}` }}
              disabled={loading}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : workshopJobs.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No cars in workshop</p>
            ) : (
              <>
                <div className="space-y-3 pb-2 md:hidden">
                  {workshopJobs.map((job) => {
                    const car = Array.isArray(job.cars) ? job.cars[0] : job.cars;
                    const isOvertime =
                      job.status === "in_progress" &&
                      job.started_at &&
                      (job.estimated_hours ?? 0) > 0 &&
                      Date.now() >
                        new Date(job.started_at).getTime() +
                          (job.estimated_hours ?? 0) * 3600000;
                    return (
                      <div
                        key={job.id}
                        className="rounded-xl border border-border/50 bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{job.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {car ? `${car.brand} ${car.model}` : "—"}
                            </p>
                            <p
                              className="font-mono text-xs text-muted-foreground"
                              title={car?.vin}
                            >
                              {formatVinShort(car?.vin)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              job.status === "done"
                                ? "default"
                                : job.status === "in_progress"
                                  ? "secondary"
                                  : "outline"
                            }
                            className={
                              job.status === "done"
                                ? "shrink-0 bg-green-600"
                                : isOvertime
                                  ? "shrink-0 bg-orange-500"
                                  : "shrink-0"
                            }
                          >
                            {job.status === "done"
                              ? "Ready for Pickup"
                              : JOB_STATUS_LABELS[job.status] ?? job.status}
                            {isOvertime && " (OT)"}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1 border-t border-border/50 pt-3 text-sm text-muted-foreground">
                          <p>
                            Due:{" "}
                            {job.due_date
                              ? new Date(job.due_date).toLocaleDateString()
                              : "—"}
                          </p>
                          <p>Est. hrs: {job.estimated_hours ?? "—"}</p>
                          <p>Assigned: {job.assigned_profile?.full_name ?? "—"}</p>
                        </div>
                        <Button className="mt-3 w-full touch-manipulation" size="sm" variant="outline" asChild>
                          <Link href={`/garage/jobs/${job.id}`}>
                            View job <ChevronRight className="ml-1 size-4" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto rounded-lg border md:block">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">VIN</th>
                        <th className="px-4 py-3 text-left font-medium">Model</th>
                        <th className="px-4 py-3 text-left font-medium">Reason</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Due</th>
                        <th className="px-4 py-3 text-left font-medium">Est. Hrs</th>
                        <th className="px-4 py-3 text-left font-medium">Assigned</th>
                        <th className="px-4 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workshopJobs.map((job) => {
                        const car = Array.isArray(job.cars) ? job.cars[0] : job.cars;
                        const isOvertime =
                          job.status === "in_progress" &&
                          job.started_at &&
                          (job.estimated_hours ?? 0) > 0 &&
                          Date.now() >
                            new Date(job.started_at).getTime() +
                              (job.estimated_hours ?? 0) * 3600000;
                        return (
                          <tr key={job.id} className="border-b last:border-0">
                            <td className="px-4 py-3 font-mono text-xs">
                              {car?.vin ? `...${String(car.vin).slice(-6)}` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {car ? `${car.brand} ${car.model}` : "—"}
                            </td>
                            <td className="px-4 py-3">{job.title}</td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  job.status === "done"
                                    ? "default"
                                    : job.status === "in_progress"
                                      ? "secondary"
                                      : "outline"
                                }
                                className={
                                  job.status === "done"
                                    ? "bg-green-600"
                                    : isOvertime
                                      ? "bg-orange-500"
                                      : ""
                                }
                              >
                                {job.status === "done"
                                  ? "Ready for Pickup"
                                  : JOB_STATUS_LABELS[job.status] ?? job.status}
                                {isOvertime && " (Overtime)"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {job.due_date
                                ? new Date(job.due_date).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-4 py-3">{job.estimated_hours ?? "—"}</td>
                            <td className="px-4 py-3">{job.assigned_profile?.full_name ?? "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <Button size="sm" variant="ghost" asChild>
                                <Link href={`/garage/jobs/${job.id}`}>
                                  View <ChevronRight className="ml-1 size-4" />
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Upcoming Pickups */}
      <div ref={carsReadyRef}>
        <Card data-tour-id="assistant-dashboard-pickups-panel">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Upcoming Pickups / Delivery Schedule</CardTitle>
              <CardDescription>
                Completed cars awaiting customer pickup (oldest first)
              </CardDescription>
            </div>
            <ExportButton
              data={completedAwaitingPickup.map((j) => {
                const car = Array.isArray(j.cars) ? j.cars[0] : j.cars;
                return {
                  vin: car?.vin ?? "",
                  model: car ? `${car.brand} ${car.model}` : "",
                  customer: "",
                  phone: "",
                  completed_at: j.completed_at ?? j.created_at,
                  days_waiting: daysSince(j.completed_at ?? j.created_at),
                };
              })}
              allData={completedAwaitingPickup.map((j) => {
                const car = Array.isArray(j.cars) ? j.cars[0] : j.cars;
                return {
                  vin: car?.vin ?? "",
                  model: car ? `${car.brand} ${car.model}` : "",
                  customer: "",
                  phone: "",
                  completed_at: j.completed_at ?? j.created_at,
                  days_waiting: daysSince(j.completed_at ?? j.created_at),
                };
              })}
              columns={[
                { key: "vin", header: "VIN" },
                { key: "model", header: "Model" },
                { key: "customer", header: "Customer Name" },
                { key: "phone", header: "Phone", width: 18 },
                { key: "completed_at", header: "Completed", type: "date" },
                { key: "days_waiting", header: "Days Waiting", type: "number" },
              ]}
              filename="Assistant_Upcoming_Pickups"
              options={{ pageName: "Upcoming Pickups", summary: `Total: ${completedAwaitingPickup.length}` }}
              disabled={loading}
            />
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : completedAwaitingPickup.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No cars awaiting pickup
              </p>
            ) : (
              <div className="space-y-2">
                {completedAwaitingPickup.map((job) => {
                  const car = Array.isArray(job.cars) ? job.cars[0] : job.cars;
                  const completed = job.completed_at ?? "";
                  const daysWaiting = daysSince(completed);
                  const isOverdue = daysWaiting > 3;
                  return (
                    <div
                      key={job.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {car ? `${car.brand} ${car.model}` : "—"}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground" title={car?.vin}>
                          VIN {formatVinShort(car?.vin)}
                        </p>
                        <p className="text-sm text-muted-foreground">—</p>
                        <p className="text-xs text-muted-foreground">
                          Completed {timeAgo(completed)} · {daysWaiting} days waiting
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                        {isOverdue && (
                          <Badge variant="destructive">Overdue Pickup</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleMarkDelivered(job)}
                          disabled={markingDelivered === job.id}
                        >
                          {markingDelivered === job.id ? "..." : "Mark as Delivered"}
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/garage/jobs/${job.id}`}>View Job</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 4: Warranty Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Warranty Alerts</CardTitle>
            <CardDescription>Upcoming warranty expirations</CardDescription>
          </div>
          <ExportButton
            data={warrantyAlerts.map((w) => ({ vin: w.vin, model: `${w.brand} ${w.model}`, warranty_type: w.warranty_type, expiry: w.expiry, days_left: w.days_left }))}
            allData={warrantyAlerts.map((w) => ({ vin: w.vin, model: `${w.brand} ${w.model}`, warranty_type: w.warranty_type, expiry: w.expiry, days_left: w.days_left }))}
            columns={[
              { key: "vin", header: "VIN" },
              { key: "model", header: "Model" },
              { key: "warranty_type", header: "Warranty Type" },
              { key: "expiry", header: "Expiry Date" },
              { key: "days_left", header: "Days Left", type: "number" },
            ]}
            filename="Assistant_Warranty_Alerts"
            options={{ pageName: "Warranty Alerts", summary: `Total: ${warrantyAlerts.length}` }}
            disabled={loading}
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : warrantyAlerts.length === 0 ? (
            <p className="py-8 text-center text-green-600 dark:text-green-400">
              No upcoming warranty expirations
            </p>
          ) : (
            <div className="space-y-2">
              {warrantyAlerts.map((w, i) => (
                <Link
                  key={`${w.vin}-${w.warranty_type}-${i}`}
                  href="/cars"
                  className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 font-medium">
                    {w.brand} {w.model}
                    <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground" title={w.vin}>
                      {formatVinShort(w.vin)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm">
                    {w.warranty_type} · {w.expiry} ·{" "}
                    <span
                      className={
                        w.days_left <= 7
                          ? "font-medium text-red-600"
                          : w.days_left <= 14
                            ? "text-amber-600"
                            : "text-green-600"
                      }
                    >
                      {w.days_left} days left
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
