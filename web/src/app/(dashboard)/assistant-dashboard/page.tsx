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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_LABELS } from "@/lib/constants/jobs";
import { REQUEST_CATEGORIES } from "@/lib/constants/requests";
import { ExportButton } from "@/components/ExportButton";
import { KpiCard } from "@/components/ui/kpi-card";
import { cn } from "@/lib/utils";

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

export default function AssistantDashboardPage() {
  const router = useRouter();
  const { profile, isRequestAssistant, isOwner, loading: profileLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [carsReadyCount, setCarsReadyCount] = useState(0);
  const [carsInWorkshopCount, setCarsInWorkshopCount] = useState(0);
  const [overduePickupsCount, setOverduePickupsCount] = useState(0);
  const [pendingDeletionsCount, setPendingDeletionsCount] = useState(0);
  const [todaysServiceCount, setTodaysServiceCount] = useState(0);

  const [pendingRequests, setPendingRequests] = useState<RequestRow[]>([]);
  const [workshopJobs, setWorkshopJobs] = useState<JobWithCar[]>([]);
  const [completedAwaitingPickup, setCompletedAwaitingPickup] = useState<JobWithCar[]>([]);
  const [warrantyAlerts, setWarrantyAlerts] = useState<
    Array<{ vin: string; brand: string; model: string; warranty_type: string; expiry: string; days_left: number }>
  >([]);

  const pendingRequestsRef = useRef<HTMLDivElement>(null);
  const carsReadyRef = useRef<HTMLDivElement>(null);
  const workshopRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>("Review Requests");
  const [markingDelivered, setMarkingDelivered] = useState<string | null>(null);

  const supabase = createClient();

  async function handleMarkDelivered(job: JobWithCar) {
    setMarkingDelivered(job.id);
    const { error } = await supabase
      .from("garage_jobs")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", job.id);
    setMarkingDelivered(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Marked as delivered");
      fetchData();
    }
  }

  const canAccess = isRequestAssistant || isOwner;

  useEffect(() => {
    if (!profileLoading && !canAccess) {
      router.replace("/dashboard");
    }
  }, [profileLoading, canAccess, router]);

  const fetchData = useCallback(async () => {
    if (!canAccess) return;

    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

    const [
      jobsRes,
      deleteRes,
      carsRes,
      requestsWithProfiles,
    ] = await Promise.all([
      supabase
        .from("garage_jobs")
        .select("*, cars:car_id(id, vin, brand, model)")
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress", "waiting_parts", "done", "delivered"])
        .order("created_at", { ascending: false }),
      supabase
        .from("delete_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("cars")
        .select("id, vin, brand, model, warranty_per_dms, warranty_monza_start_date")
        .is("deleted_at", null),
      supabase
        .from("requests")
        .select("id, subject, category, submitted_by, created_at, profiles:submitted_by(full_name)")
        .eq("status", "submitted")
        .order("created_at", { ascending: false }),
    ]);

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
        warranty_monza_start_date: string | null;
      };
      const dates: Array<{ type: string; date: string }> = [];
      if (c.warranty_per_dms) dates.push({ type: "DMS (per)", date: c.warranty_per_dms });
      if (c.warranty_monza_start_date) {
        const start = new Date(c.warranty_monza_start_date);
        start.setFullYear(start.getFullYear() + 2);
        dates.push({ type: "Monza", date: start.toISOString().slice(0, 10) });
      }
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

    const reqList = (requestsWithProfiles.data ?? []) as Array<{
      id: string;
      subject: string;
      category: string | null;
      submitted_by: string;
      created_at: string;
      profiles?: { full_name: string | null } | null;
    }>;

    // Use the same result set for both the list and the counter
    setPendingRequestsCount(reqList.length);
    setPendingRequests(
      reqList.map((r) => ({
        ...r,
        submitter_name: r.profiles?.full_name ?? "Unknown",
      }))
    );

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
  ];

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
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

      {/* Tab bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {[
          { label: "Review Requests", icon: FileCheck, action: () => { setActiveTab("Review Requests"); scrollTo(pendingRequestsRef); } },
          { label: "Cars Ready", icon: Car, action: () => { setActiveTab("Cars Ready"); scrollTo(carsReadyRef); } },
          { label: "Workshop Overview", icon: BarChart3, action: () => { setActiveTab("Workshop Overview"); scrollTo(workshopRef); } },
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

      {/* Section 1: Pending Requests */}
      <div ref={pendingRequestsRef}>
        <Card>
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
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Workshop Status */}
      <div ref={workshopRef}>
        <Card>
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
                  assigned_to: j.assigned_to,
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
                  assigned_to: j.assigned_to,
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
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
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
                          <td className="px-4 py-3">{job.assigned_to ?? "—"}</td>
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 3: Upcoming Pickups */}
      <div ref={carsReadyRef}>
        <Card>
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
                const cust = Array.isArray(j.customers) ? j.customers[0] : j.customers;
                return {
                  vin: car?.vin ?? "",
                  model: car ? `${car.brand} ${car.model}` : "",
                  customer: cust ? `${cust.first_name} ${cust.last_name ?? ""}`.trim() : "",
                  phone: cust?.phone_primary ?? "",
                  completed_at: j.completed_at ?? j.created_at,
                  days_waiting: daysSince(j.completed_at ?? j.created_at),
                };
              })}
              allData={completedAwaitingPickup.map((j) => {
                const car = Array.isArray(j.cars) ? j.cars[0] : j.cars;
                const cust = Array.isArray(j.customers) ? j.customers[0] : j.customers;
                return {
                  vin: car?.vin ?? "",
                  model: car ? `${car.brand} ${car.model}` : "",
                  customer: cust ? `${cust.first_name} ${cust.last_name ?? ""}`.trim() : "",
                  phone: cust?.phone_primary ?? "",
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
                  const cust = Array.isArray(job.customers) ? job.customers[0] : job.customers;
                  const completed = job.completed_at ?? "";
                  const daysWaiting = daysSince(completed);
                  const isOverdue = daysWaiting > 3;
                  return (
                    <div
                      key={job.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">
                          {car ? `${car.brand} ${car.model}` : "—"} · VIN ...{car?.vin?.slice(-6) ?? "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {cust
                            ? `${cust.first_name} ${cust.last_name ?? ""} · ${cust.phone_primary}`
                            : "No customer"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Completed {timeAgo(completed)} · {daysWaiting} days waiting
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverdue && (
                          <Badge variant="destructive">Overdue Pickup</Badge>
                        )}
                        {cust?.phone_primary && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`tel:${cust.phone_primary}`}>
                              <Phone className="mr-1 size-4" />
                              Call Customer
                            </a>
                          </Button>
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
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <span>
                    {w.brand} {w.model} · VIN ...{w.vin.slice(-6)}
                  </span>
                  <span className="text-sm">
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
