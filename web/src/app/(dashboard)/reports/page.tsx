"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";
import {
  AlertTriangle,
  ArrowLeft,
  ChartLine,
  Clock,
  DollarSign,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SalesMargin = {
  sales_order_id: string;
  delivered_at: string | null;
  sale_date: string | null;
  revenue: number | null;
  revenue_currency: string | null;
  cost: number | null;
  cost_currency: string | null;
  margin: number | null;
  margin_pct: number | null;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  vin: string | null;
  customer_id: string | null;
};

type SalesRep = {
  sales_rep_id: string;
  sales_rep_name: string | null;
  deals_in_pipeline: number;
  deals_delivered: number;
  deals_voided: number;
  revenue_total: number | null;
  margin_total: number | null;
  avg_days_to_close: number | null;
};

type InventoryAging = {
  car_id: string;
  vin: string | null;
  brand: string | null;
  model: string | null;
  model_year: number | null;
  status: string;
  price: number | null;
  price_currency: string | null;
  entry_date: string | null;
  days_in_stock: number;
  age_bucket: "<60" | "60-90" | "90-180" | ">180" | "unknown";
};

type AgedReceivable = {
  installment_id: string;
  plan_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  installment_no: number;
  due_date: string;
  amount_due: number;
  paid_amount: number;
  amount_outstanding: number;
  status: string;
  days_overdue: number;
  age_bucket: "current" | "1-30" | "31-60" | "61-90" | ">90";
};

type TimeInState = {
  job_id: string;
  title: string;
  category_label: string | null;
  queued_hours: number | null;
  active_hours: number | null;
  handover_hours: number | null;
  total_hours: number | null;
  brand: string | null;
  model: string | null;
  vin: string | null;
};

const fmt = (n: number | null | undefined, currency = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);

const fmtPct = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(1)}%`;

const fmtH = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(1)}h`;

const fmtD = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toFixed(1)}d`;

// Render a stored date (ISO "YYYY-MM-DD" or timestamp) in the app's M/D/YYYY
// locale format, consistent with the rest of the app.
const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString();
};

// Turn a raw DB enum value ("in_stock") into a human label ("In Stock").
const humanizeStatus = (s: string | null | undefined) =>
  !s ? "—" : s.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());

// Statuses that don't represent a car "sitting unsold" in the showroom, so
// they shouldn't inflate the inventory-aging report (e.g. cars in the garage).
const AGING_EXCLUDED_STATUSES = new Set(["service", "test_drive"]);

export default function ReportsPage() {
  const { isOwner, hasCapability } = useUser();
  const allowed =
    isOwner || hasCapability("view_reports") || hasCapability("manage_team");

  if (!allowed) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <AlertTriangle className="mx-auto mb-3 size-6" />
        <p>You don&apos;t have access to reports.</p>
        <Button variant="link" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <ReportsBody />;
}

const PAGE_LIMIT = 50;

function ReportsBody() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [margin, setMargin] = useState<SalesMargin[]>([]);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [aging, setAging] = useState<InventoryAging[]>([]);
  const [receivables, setReceivables] = useState<AgedReceivable[]>([]);
  const [timeState, setTimeState] = useState<TimeInState[]>([]);
  const [agingBucket, setAgingBucket] = useState<string | null>(null);
  const [receivablesBucket, setReceivablesBucket] = useState<string | null>(null);
  const [showAllMargin, setShowAllMargin] = useState(false);
  const [showAllAging, setShowAllAging] = useState(false);
  const [showAllReceivables, setShowAllReceivables] = useState(false);
  const [showAllTimeState, setShowAllTimeState] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const errs: string[] = [];
    const [m, r, a, ar, ts] = await Promise.all([
      supabase.from("report_sales_margin").select("*").order("delivered_at", { ascending: false }).limit(200),
      supabase.from("report_sales_rep_performance").select("*").order("revenue_total", { ascending: false, nullsFirst: false }),
      supabase.from("report_inventory_aging").select("*").order("days_in_stock", { ascending: false }),
      supabase.from("report_aged_receivables").select("*").order("days_overdue", { ascending: false }),
      supabase.from("report_garage_time_in_state").select("*").order("delivered_at", { ascending: false, nullsFirst: false }).limit(100),
    ]);
    if (m.error) errs.push("Profit margin");
    else setMargin((m.data as SalesMargin[]) ?? []);
    if (r.error) errs.push("Sales-rep performance");
    else setReps((r.data as SalesRep[]) ?? []);
    if (a.error) errs.push("Inventory aging");
    else
      setAging(
        ((a.data as InventoryAging[]) ?? []).filter(
          (c) => !AGING_EXCLUDED_STATUSES.has(c.status)
        )
      );
    if (ar.error) errs.push("Aged receivables");
    else setReceivables((ar.data as AgedReceivable[]) ?? []);
    if (ts.error) errs.push("Time-in-state");
    else setTimeState((ts.data as TimeInState[]) ?? []);
    if (errs.length) toast.error(`Couldn't load: ${errs.join(", ")}`);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const marginSummary = useMemo(() => {
    const validMargin = margin.filter((m) => m.margin != null);
    const totalMargin = validMargin.reduce((s, m) => s + (m.margin ?? 0), 0);
    const totalRevenue = validMargin.reduce((s, m) => s + (m.revenue ?? 0), 0);
    return {
      sales: margin.length,
      withMargin: validMargin.length,
      totalRevenue,
      totalMargin,
      avgPct:
        validMargin.length > 0
          ? validMargin.reduce((s, m) => s + (m.margin_pct ?? 0), 0) / validMargin.length
          : null,
    };
  }, [margin]);

  const agingSummary = useMemo(() => {
    const buckets: Record<string, number> = { "<60": 0, "60-90": 0, "90-180": 0, ">180": 0, unknown: 0 };
    aging.forEach((c) => (buckets[c.age_bucket] = (buckets[c.age_bucket] ?? 0) + 1));
    return buckets;
  }, [aging]);

  const receivablesSummary = useMemo(() => {
    const buckets: Record<string, { count: number; outstanding: number }> = {
      current: { count: 0, outstanding: 0 },
      "1-30": { count: 0, outstanding: 0 },
      "31-60": { count: 0, outstanding: 0 },
      "61-90": { count: 0, outstanding: 0 },
      ">90": { count: 0, outstanding: 0 },
    };
    receivables.forEach((r) => {
      const b = buckets[r.age_bucket] ?? { count: 0, outstanding: 0 };
      b.count += 1;
      b.outstanding += r.amount_outstanding;
      buckets[r.age_bucket] = b;
    });
    return buckets;
  }, [receivables]);

  const timeStateSummary = useMemo(() => {
    if (timeState.length === 0) return null;
    const valid = timeState.filter((t) => t.total_hours != null);
    if (valid.length === 0) return null;
    const sum = (key: keyof TimeInState) =>
      valid.reduce((s, t) => s + ((t[key] as number | null) ?? 0), 0) / valid.length;
    return {
      avgQueued: sum("queued_hours"),
      avgActive: sum("active_hours"),
      avgHandover: sum("handover_hours"),
      avgTotal: sum("total_hours"),
      n: valid.length,
    };
  }, [timeState]);

  // Bucket-filtered + paginated table views.
  const agingFiltered = useMemo(
    () => (agingBucket ? aging.filter((c) => c.age_bucket === agingBucket) : aging),
    [aging, agingBucket]
  );
  const agingVisible = showAllAging ? agingFiltered : agingFiltered.slice(0, PAGE_LIMIT);
  const receivablesFiltered = useMemo(
    () => (receivablesBucket ? receivables.filter((r) => r.age_bucket === receivablesBucket) : receivables),
    [receivables, receivablesBucket]
  );
  const receivablesVisible = showAllReceivables ? receivablesFiltered : receivablesFiltered.slice(0, PAGE_LIMIT);
  const marginVisible = showAllMargin ? margin : margin.slice(0, PAGE_LIMIT);
  const timeStateVisible = showAllTimeState ? timeState : timeState.slice(0, PAGE_LIMIT);

  // Export definitions (XLSX) for the data-heavy tables.
  const marginExportCols: ExportColumn[] = [
    { key: "vehicle", header: "Vehicle" },
    { key: "vin", header: "VIN" },
    { key: "delivered", header: "Delivered" },
    { key: "revenue", header: "Revenue", type: "number" },
    { key: "cost", header: "Cost", type: "number" },
    { key: "margin", header: "Margin", type: "number" },
    { key: "margin_pct", header: "Margin %" },
  ];
  const marginExport = (rows: SalesMargin[]) =>
    rows.map((m) => ({
      vehicle: `${m.brand ?? ""} ${m.model ?? ""} ${m.model_year ?? ""}`.trim(),
      vin: m.vin ?? "",
      delivered: fmtDate(m.delivered_at),
      revenue: m.revenue ?? "",
      cost: m.cost ?? "",
      margin: m.margin ?? "",
      margin_pct: m.margin_pct != null ? `${m.margin_pct.toFixed(1)}%` : "",
    }));

  const repsExportCols: ExportColumn[] = [
    { key: "rep", header: "Rep" },
    { key: "pipeline", header: "Pipeline", type: "number" },
    { key: "delivered", header: "Delivered", type: "number" },
    { key: "voided", header: "Voided", type: "number" },
    { key: "revenue", header: "Revenue", type: "number" },
    { key: "margin", header: "Margin", type: "number" },
    { key: "avg_close_days", header: "Avg close (days)" },
  ];
  const repsExport = (rows: SalesRep[]) =>
    rows.map((r) => ({
      rep: r.sales_rep_name ?? "—",
      pipeline: r.deals_in_pipeline,
      delivered: r.deals_delivered,
      voided: r.deals_voided,
      revenue: r.revenue_total ?? "",
      margin: r.margin_total ?? "",
      avg_close_days: r.avg_days_to_close != null ? r.avg_days_to_close.toFixed(1) : "",
    }));

  const agingExportCols: ExportColumn[] = [
    { key: "vehicle", header: "Vehicle" },
    { key: "vin", header: "VIN" },
    { key: "status", header: "Status" },
    { key: "entered", header: "Entered" },
    { key: "days", header: "Days in stock", type: "number" },
    { key: "bucket", header: "Bucket" },
  ];
  const agingExport = (rows: InventoryAging[]) =>
    rows.map((c) => ({
      vehicle: `${c.brand ?? ""} ${c.model ?? ""} ${c.model_year ?? ""}`.trim(),
      vin: c.vin ?? "",
      status: humanizeStatus(c.status),
      entered: fmtDate(c.entry_date),
      days: c.days_in_stock,
      bucket: c.age_bucket,
    }));

  const receivablesExportCols: ExportColumn[] = [
    { key: "customer", header: "Customer" },
    { key: "phone", header: "Phone" },
    { key: "installment", header: "Installment #", type: "number" },
    { key: "due", header: "Due" },
    { key: "outstanding", header: "Outstanding", type: "number" },
    { key: "days_late", header: "Days late", type: "number" },
    { key: "bucket", header: "Bucket" },
  ];
  const receivablesExport = (rows: AgedReceivable[]) =>
    rows.map((r) => ({
      customer: r.customer_name ?? "—",
      phone: r.customer_phone ?? "",
      installment: r.installment_no,
      due: fmtDate(r.due_date),
      outstanding: r.amount_outstanding,
      days_late: r.days_overdue,
      bucket: r.age_bucket,
    }));

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ChartLine className="size-6" /> Reports
          </h1>
          <p className="text-muted-foreground text-sm">
            Profit, sales-rep performance, inventory aging, aged receivables,
            time-in-state. Live from the database.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`mr-1 size-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {/* Top-of-page summary tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-tour-id="reports-summary-tiles">
        <SummaryTile
          icon={DollarSign}
          label="Margin (delivered)"
          loading={loading}
          value={fmt(marginSummary.totalMargin)}
          hint={`${marginSummary.withMargin} of ${marginSummary.sales} sales · avg ${fmtPct(marginSummary.avgPct)}`}
        />
        <SummaryTile
          icon={Package}
          label="Cars in stock"
          loading={loading}
          value={String(aging.length)}
          hint={`${(agingSummary["90-180"] ?? 0) + (agingSummary[">180"] ?? 0)} aged > 90d`}
          href="/cars"
        />
        <SummaryTile
          icon={AlertTriangle}
          label="Outstanding receivables"
          loading={loading}
          value={fmt(
            Object.values(receivablesSummary).reduce(
              (s, b) => s + b.outstanding,
              0
            )
          )}
          hint={`${receivables.length} unpaid installments`}
          href="/installments"
        />
        <SummaryTile
          icon={Clock}
          label="Avg job total time"
          loading={loading}
          value={timeStateSummary ? fmtH(timeStateSummary.avgTotal) : "—"}
          hint={
            timeStateSummary
              ? `${timeStateSummary.n} closed jobs`
              : "No completed jobs yet"
          }
        />
      </div>

      {/* 1. Profit margin per sale */}
      <Card data-tour-id="reports-margin-panel">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="size-4" /> Profit margin per delivered sale
            </CardTitle>
            <CardDescription>
              Cost basis comes from the car&apos;s purchase price; revenue is the
              sale&apos;s selling price. Margin only computed when both currencies
              match.
            </CardDescription>
          </div>
          {margin.length > 0 && (
            <ExportButton
              data={marginExport(margin)}
              allData={marginExport(margin)}
              columns={marginExportCols}
              filename="Profit_Margin"
              disabled={loading}
            />
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : margin.length === 0 ? (
            <p className="text-muted-foreground text-sm">No delivered sales yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Vehicle</th>
                    <th className="px-2 py-2">Delivered</th>
                    <th className="px-2 py-2 text-right">Revenue</th>
                    <th className="px-2 py-2 text-right">Cost</th>
                    <th className="px-2 py-2 text-right">Margin</th>
                    <th className="px-2 py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {marginVisible.map((m) => (
                    <tr
                      key={m.sales_order_id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/sales-orders/${m.sales_order_id}`)}
                    >
                      <td className="px-2 py-2">
                        <div className="font-medium">
                          {m.brand} {m.model} {m.model_year ?? ""}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {m.vin}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {m.delivered_at
                          ? new Date(m.delivered_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {fmt(m.revenue, m.revenue_currency ?? "USD")}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {fmt(m.cost, m.cost_currency ?? "USD")}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2 text-right",
                          m.margin == null
                            ? "text-muted-foreground"
                            : m.margin > 0
                              ? "text-green-700"
                              : m.margin < 0
                                ? "text-red-700"
                                : ""
                        )}
                      >
                        {fmt(m.margin, m.revenue_currency ?? "USD")}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {fmtPct(m.margin_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {margin.length > PAGE_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllMargin((v) => !v)}
                  className="text-primary mt-2 text-xs hover:underline"
                >
                  {showAllMargin
                    ? "Show fewer"
                    : `Show all ${margin.length} sales`}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Sales rep performance */}
      <Card data-tour-id="reports-sales-rep-panel">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Sales rep performance
            </CardTitle>
            <CardDescription>
              Revenue, margin, pipeline, and average days to close per active rep.
            </CardDescription>
          </div>
          {reps.length > 0 && (
            <ExportButton
              data={repsExport(reps)}
              allData={repsExport(reps)}
              columns={repsExportCols}
              filename="Sales_Rep_Performance"
              disabled={loading}
            />
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : reps.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active reps.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Rep</th>
                    <th className="px-2 py-2 text-right">Pipeline</th>
                    <th className="px-2 py-2 text-right">Delivered</th>
                    <th className="px-2 py-2 text-right">Voided</th>
                    <th className="px-2 py-2 text-right">Revenue</th>
                    <th className="px-2 py-2 text-right">Margin</th>
                    <th className="px-2 py-2 text-right">Avg close</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {reps.map((r) => (
                    <tr key={r.sales_rep_id}>
                      <td className="px-2 py-2 font-medium">
                        {r.sales_rep_name ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right">{r.deals_in_pipeline}</td>
                      <td className="px-2 py-2 text-right">{r.deals_delivered}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        {r.deals_voided}
                      </td>
                      <td className="px-2 py-2 text-right">{fmt(r.revenue_total)}</td>
                      <td className="px-2 py-2 text-right">{fmt(r.margin_total)}</td>
                      <td className="px-2 py-2 text-right">
                        {fmtD(r.avg_days_to_close)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Inventory aging */}
      <Card data-tour-id="reports-inventory-aging-panel">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4" /> Inventory aging
            </CardTitle>
            <CardDescription>
              Cars in stock by how long they&apos;ve been sitting unsold. Cars in
              service or out on a test drive are excluded.
            </CardDescription>
          </div>
          {aging.length > 0 && (
            <ExportButton
              data={agingExport(agingFiltered)}
              allData={agingExport(aging)}
              columns={agingExportCols}
              filename="Inventory_Aging"
              disabled={loading}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(["<60", "60-90", "90-180", ">180", "unknown"] as const).map((b) => {
              const active = agingBucket === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setAgingBucket(active ? null : b)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-md border p-3 text-center transition hover:bg-muted/50",
                    b === ">180" && "border-red-500/40 bg-red-50/40 dark:bg-red-950/20",
                    b === "90-180" && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20",
                    active && "ring-2 ring-primary"
                  )}
                >
                  <div className="text-2xl font-semibold">{agingSummary[b] ?? 0}</div>
                  <div className="text-muted-foreground text-xs">
                    {b === "unknown" ? "no entry date" : `${b} days`}
                  </div>
                </button>
              );
            })}
          </div>
          {agingBucket && (
            <p className="text-muted-foreground text-xs">
              Filtered to <span className="font-medium">{agingBucket} days</span> ·{" "}
              <button type="button" onClick={() => setAgingBucket(null)} className="text-primary hover:underline">
                clear
              </button>
            </p>
          )}
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : aging.length === 0 ? (
            <p className="text-muted-foreground text-sm">No cars in stock.</p>
          ) : agingFiltered.length === 0 ? (
            <p className="text-muted-foreground text-sm">No cars in this bucket.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Vehicle</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Entered</th>
                    <th className="px-2 py-2 text-right">Days</th>
                    <th className="px-2 py-2">Bucket</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {agingVisible.map((c) => (
                    <tr
                      key={c.car_id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/cars/${encodeURIComponent(c.vin ?? c.car_id)}`)}
                    >
                      <td className="px-2 py-2">
                        <div className="font-medium">
                          {c.brand} {c.model} {c.model_year ?? ""}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {c.vin}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {humanizeStatus(c.status)}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {fmtDate(c.entry_date)}
                      </td>
                      <td className="px-2 py-2 text-right">{c.days_in_stock}</td>
                      <td className="px-2 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 px-1.5 text-[10px]",
                            c.age_bucket === ">180" && "border-red-500/40 text-red-700",
                            c.age_bucket === "90-180" && "border-amber-500/40 text-amber-700"
                          )}
                        >
                          {c.age_bucket}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {agingFiltered.length > PAGE_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllAging((v) => !v)}
                  className="text-primary mt-2 text-xs hover:underline"
                >
                  {showAllAging ? "Show fewer" : `Show all ${agingFiltered.length} cars`}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Aged receivables */}
      <Card data-tour-id="reports-aged-receivables-panel">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" /> Aged receivables
            </CardTitle>
            <CardDescription>
              Outstanding installment payments by how late they are.
            </CardDescription>
          </div>
          {receivables.length > 0 && (
            <ExportButton
              data={receivablesExport(receivablesFiltered)}
              allData={receivablesExport(receivables)}
              columns={receivablesExportCols}
              filename="Aged_Receivables"
              disabled={loading}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(["current", "1-30", "31-60", "61-90", ">90"] as const).map((b) => {
              const cell = receivablesSummary[b] ?? { count: 0, outstanding: 0 };
              const active = receivablesBucket === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setReceivablesBucket(active ? null : b)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-md border p-3 text-center transition hover:bg-muted/50",
                    b === ">90" && "border-red-500/40 bg-red-50/40 dark:bg-red-950/20",
                    b === "61-90" && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20",
                    active && "ring-2 ring-primary"
                  )}
                >
                  <div className="text-lg font-semibold">{fmt(cell.outstanding)}</div>
                  <div className="text-muted-foreground text-xs">
                    {cell.count} · {b === "current" ? "current" : `${b} days`}
                  </div>
                </button>
              );
            })}
          </div>
          {receivablesBucket && (
            <p className="text-muted-foreground text-xs">
              Filtered to <span className="font-medium">{receivablesBucket === "current" ? "current" : `${receivablesBucket} days`}</span> ·{" "}
              <button type="button" onClick={() => setReceivablesBucket(null)} className="text-primary hover:underline">
                clear
              </button>
            </p>
          )}
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : receivables.length === 0 ? (
            <p className="text-muted-foreground text-sm">No outstanding receivables.</p>
          ) : receivablesFiltered.length === 0 ? (
            <p className="text-muted-foreground text-sm">No receivables in this bucket.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Customer</th>
                    <th className="px-2 py-2">Installment</th>
                    <th className="px-2 py-2">Due</th>
                    <th className="px-2 py-2 text-right">Outstanding</th>
                    <th className="px-2 py-2 text-right">Days late</th>
                    <th className="px-2 py-2">Bucket</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {receivablesVisible.map((r) => (
                    <tr key={r.installment_id}>
                      <td className="px-2 py-2">
                        <div className="font-medium">{r.customer_name ?? "—"}</div>
                        <div className="text-muted-foreground text-[11px]">
                          {r.customer_phone ?? ""}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        #{r.installment_no}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{fmtDate(r.due_date)}</td>
                      <td className="px-2 py-2 text-right">{fmt(r.amount_outstanding)}</td>
                      <td className="px-2 py-2 text-right">{r.days_overdue}</td>
                      <td className="px-2 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 px-1.5 text-[10px]",
                            r.age_bucket === ">90" && "border-red-500/40 text-red-700",
                            r.age_bucket === "61-90" && "border-amber-500/40 text-amber-700"
                          )}
                        >
                          {r.age_bucket}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {receivablesFiltered.length > PAGE_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllReceivables((v) => !v)}
                  className="text-primary mt-2 text-xs hover:underline"
                >
                  {showAllReceivables ? "Show fewer" : `Show all ${receivablesFiltered.length}`}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Time-in-state */}
      <Card data-tour-id="reports-time-state-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4" /> Garage time-in-state
          </CardTitle>
          <CardDescription>
            How long completed jobs spent waiting, working, and waiting handover.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {timeStateSummary && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Queued (avg)" value={fmtH(timeStateSummary.avgQueued)} />
              <Stat label="Active (avg)" value={fmtH(timeStateSummary.avgActive)} />
              <Stat label="Handover (avg)" value={fmtH(timeStateSummary.avgHandover)} />
              <Stat label="Total (avg)" value={fmtH(timeStateSummary.avgTotal)} />
            </div>
          )}
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : timeState.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No completed jobs yet — these numbers populate as jobs close.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Job</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2 text-right">Queued</th>
                    <th className="px-2 py-2 text-right">Active</th>
                    <th className="px-2 py-2 text-right">Handover</th>
                    <th className="px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {timeStateVisible.map((t) => (
                    <tr key={t.job_id}>
                      <td className="px-2 py-2">
                        <div className="font-medium">{t.title}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {t.brand} {t.model} {t.vin ?? ""}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {t.category_label ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right">{fmtH(t.queued_hours)}</td>
                      <td className="px-2 py-2 text-right">{fmtH(t.active_hours)}</td>
                      <td className="px-2 py-2 text-right">{fmtH(t.handover_hours)}</td>
                      <td className="px-2 py-2 text-right font-medium">
                        {fmtH(t.total_hours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {timeState.length > PAGE_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllTimeState((v) => !v)}
                  className="text-primary mt-2 text-xs hover:underline"
                >
                  {showAllTimeState ? "Show fewer" : `Show all ${timeState.length} jobs`}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-muted-foreground flex items-center justify-between pt-2 text-xs">
        <Button variant="link" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-1 size-3" /> Back to dashboard
          </Link>
        </Button>
        <span>Reports refresh on page load.</span>
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
  loading,
  href,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
  href?: string;
}) {
  const card = (
    <Card className={cn("h-full", href && "transition hover:border-primary/40 hover:bg-muted/30")}>
      <CardContent className="space-y-1 p-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs uppercase">
          <Icon className="size-3.5" />
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="text-2xl font-semibold">{value}</div>
        )}
        {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-md border p-3 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
