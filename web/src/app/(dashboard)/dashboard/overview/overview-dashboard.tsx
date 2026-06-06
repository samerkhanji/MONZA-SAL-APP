"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { refreshOwnerOverview } from "./actions";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(199 89% 48%)",
  "hsl(142 71% 45%)",
  "hsl(47 96% 53%)",
  "hsl(280 65% 60%)",
  "hsl(24 95% 53%)",
  "hsl(340 75% 55%)",
  "hsl(200 18% 46%)",
  "hsl(262 83% 58%)",
  "hsl(173 58% 39%)",
  "hsl(30 80% 55%)",
  "hsl(210 40% 50%)",
  "hsl(330 70% 50%)",
  "hsl(160 60% 40%)",
  "hsl(250 50% 55%)",
];

/** Sold → primary, Inventory → cyan, Available → green; other statuses get a distinct fallback. */
function carStatusFill(statusLabel: string): string {
  const n = statusLabel.trim().toLowerCase();
  if (n === "sold") return "hsl(var(--primary))";
  if (n === "inventory") return "hsl(199 89% 48%)";
  if (n === "available") return "hsl(142 71% 45%)";
  if (n === "reserved") return "hsl(47 96% 53%)";
  return CHART_COLORS[4];
}

const CAR_STATUS_CHART_TYPES = ["bar", "pie", "donut", "horizontal", "line"] as const;
type CarStatusChartType = (typeof CAR_STATUS_CHART_TYPES)[number];

const CHART_TYPE_LABELS: Record<CarStatusChartType, string> = {
  bar: "Bar",
  pie: "Pie",
  donut: "Donut",
  horizontal: "Horizontal",
  line: "Line",
};

export type OwnerOverviewData = {
  summary: {
    totalCars: number;
    /** Subset of totalCars excluding sold + delivered. Matches Reports. */
    inStockCars: number;
    totalCustomers: number;
    activeSalesOrders: number;
    pendingRequests: number;
    warrantiesExpiringSoon: number;
    activeGarageJobs: number;
    openWarrantyCases: number;
  };
  carStatusChart: { name: string; count: number }[];
  carsAddedPerMonth: { month: string; count: number }[];
  activeGarageTasks: number;
  requestPriorityChart: { name: string; count: number }[];
  installmentsDueSoon: {
    id: string;
    due_date: string;
    amount_due: number;
    installment_no: number;
    summary: string;
  }[];
  lowStockParts: {
    id: string;
    part_name: string;
    oe_number: string | null;
    quantity: number;
  }[];
  salesMTD: {
    units: number;
    unitsLastMonth: number;
  };
  salesByStage: { stage: string; label: string; count: number }[];
  topSalesRep: {
    name: string;
    dealsDelivered: number;
    dealsInPipeline: number;
  } | null;
  inventoryAging: { bucket: string; count: number }[];
  reservationsExpiring: {
    id: string;
    vin: string;
    brand: string;
    model: string;
    reservation_date: string | null;
    reserved_by: string | null;
  }[];
  newArrivals: {
    id: string;
    vin: string;
    brand: string;
    model: string;
    date_arrived: string | null;
  }[];
  cashState: {
    isOpen: boolean;
    openingBalance: number;
    openedAt: string | null;
    openedBy: string | null;
    todayCashIn: Record<string, number>;
    todayCashOut: Record<string, number>;
  };
  pendingRefunds: {
    count: number;
    amountByCurrency: Record<string, number>;
  };
  agedReceivables: {
    count: number;
    totalOutstanding: number;
    oldestDays: number;
  };
  errors: string[];
};

const tooltipContentStyle = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
} as const;

const USD_FORMATTER = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Currencies render priority: USD first, then EUR, then anything else alphabetically. */
function orderedCurrencies(map: Record<string, number>): string[] {
  const keys = Object.keys(map);
  return keys.sort((a, b) => {
    if (a === b) return 0;
    if (a === "USD") return -1;
    if (b === "USD") return 1;
    if (a === "EUR") return -1;
    if (b === "EUR") return 1;
    return a.localeCompare(b);
  });
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Fallback for non-ISO currency codes
    return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
}

/** Render a `{USD: 5000, EUR: 1200}` map as a stacked list, USD first. */
function MoneyStack({
  map,
  emptyLabel = "—",
  className,
}: {
  map: Record<string, number>;
  emptyLabel?: string;
  className?: string;
}) {
  const keys = orderedCurrencies(map).filter((k) => map[k] !== 0);
  if (keys.length === 0) {
    return <span className={cn("text-muted-foreground", className)}>{emptyLabel}</span>;
  }
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {keys.map((c, i) => (
        <span
          key={c}
          className={cn(
            "tabular-nums",
            i === 0 ? "font-semibold" : "text-muted-foreground text-xs"
          )}
        >
          {formatMoney(map[c], c)}
        </span>
      ))}
    </div>
  );
}

function CarsByStatusChartCard({
  rows,
  totalVehicles,
  carsAddedPerMonth,
}: {
  rows: { name: string; count: number }[];
  totalVehicles: number;
  carsAddedPerMonth: { month: string; count: number }[];
}) {
  const [chartType, setChartType] = useState<CarStatusChartType>("bar");
  const carsByStatusData = useMemo(() => rows.filter((d) => d.count > 0), [rows]);
  const pieData = carsByStatusData;
  const chartKey = `${chartType}-${rows.map((r) => `${r.name}:${r.count}`).join("|")}-${totalVehicles}`;

  return (
    <Card className="lg:col-span-2" data-tour-id="overview-cars-by-status-panel">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="text-lg">Cars by status</CardTitle>
            <CardDescription>
              {chartType === "line" ? (
                <>
                  Cars added per month over the last 6 months, bucketed by{" "}
                  <code className="text-xs">date_bought</code> (or arrival date when not set).
                </>
              ) : (
                <>
                  Same scope as the inventory list: all rows from{" "}
                  <code className="text-xs">cars_display</code>.
                </>
              )}
            </CardDescription>
          </div>
          <div
            className="flex shrink-0 flex-wrap gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
            role="tablist"
            aria-label="Chart type"
          >
            {CAR_STATUS_CHART_TYPES.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={chartType === t ? "secondary" : "ghost"}
                className={cn(
                  "h-8 rounded-md px-2.5 text-xs font-medium",
                  chartType === t && "shadow-sm"
                )}
                onClick={() => setChartType(t)}
              >
                {CHART_TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {totalVehicles === 0 ? (
          <p className="text-muted-foreground text-sm">No cars to show.</p>
        ) : chartType === "line" ? (
          <div className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart key={chartKey} data={carsAddedPerMonth} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Cars added"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                  animationDuration={400}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : carsByStatusData.length === 0 ? (
          <div className="text-muted-foreground flex min-h-[320px] items-center justify-center px-4 text-center text-sm">
            No vehicles in the four standard statuses to chart (fleet total {totalVehicles} may use legacy
            status values).
          </div>
        ) : (
          <div className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={320}>
              {chartType === "bar" ? (
                <BarChart
                  key={chartKey}
                  data={carsByStatusData}
                  margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip contentStyle={tooltipContentStyle} />
                  <Bar dataKey="count" name="Cars" radius={[4, 4, 0, 0]} animationDuration={400}>
                    {carsByStatusData.map((entry, i) => (
                      <Cell key={`${entry.name}-${i}`} fill={carStatusFill(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === "horizontal" ? (
                <BarChart
                  key={chartKey}
                  data={carsByStatusData}
                  layout="vertical"
                  margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} className="text-xs" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip contentStyle={tooltipContentStyle} />
                  <Bar dataKey="count" name="Cars" radius={[0, 4, 4, 0]} animationDuration={400}>
                    {carsByStatusData.map((entry, i) => (
                      <Cell key={`${entry.name}-${i}`} fill={carStatusFill(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === "pie" ? (
                <PieChart key={chartKey}>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={({ name, value }) => `${name}: ${value}`}
                    animationDuration={400}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={`${entry.name}-${i}`} fill={carStatusFill(entry.name)} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipContentStyle} />
                  <Legend />
                </PieChart>
              ) : chartType === "donut" ? (
                <PieChart key={chartKey}>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={110}
                    label={({ name, value }) => `${name}: ${value}`}
                    animationDuration={400}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={`${entry.name}-${i}`} fill={carStatusFill(entry.name)} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipContentStyle} />
                  <Legend />
                </PieChart>
              ) : null}
            </ResponsiveContainer>
          </div>
        )}
        <Button variant="link" className="mt-2 h-auto px-0" asChild>
          <Link href="/cars">Open inventory</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SalesRevenueCard({ data }: { data: OwnerOverviewData }) {
  const unitsDelta = data.salesMTD.units - data.salesMTD.unitsLastMonth;
  const deltaLabel =
    data.salesMTD.unitsLastMonth === 0
      ? data.salesMTD.units > 0
        ? "new vs last month"
        : "same as last month"
      : `${unitsDelta >= 0 ? "+" : ""}${unitsDelta} vs ${data.salesMTD.unitsLastMonth} last month`;

  return (
    <Card className="lg:col-span-2" data-tour-id="overview-sales-revenue-panel">
      <CardHeader>
        <CardTitle className="text-lg">Sales (month-to-date)</CardTitle>
        <CardDescription>Delivered sales orders this month, with comparisons.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-xs">Units delivered MTD</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{data.salesMTD.units}</p>
            <p
              className={cn(
                "mt-1 text-xs",
                unitsDelta >= 0 ? "text-green-600" : "text-amber-600"
              )}
            >
              {deltaLabel}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Top sales rep</p>
            {data.topSalesRep ? (
              <>
                <p className="mt-1 text-lg font-semibold truncate">{data.topSalesRep.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {data.topSalesRep.dealsDelivered} delivered ·{" "}
                  {data.topSalesRep.dealsInPipeline} in pipeline
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No data yet</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
            Sales pipeline by stage (non-cancelled)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {data.salesByStage.map((s) => (
              <div
                key={s.stage}
                className="rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums">{s.count}</p>
              </div>
            ))}
          </div>
        </div>

        <Button variant="link" className="h-auto px-0" asChild>
          <Link href="/sales-orders">Open sales orders</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function FleetLogisticsCard({ data }: { data: OwnerOverviewData }) {
  return (
    <Card className="lg:col-span-2" data-tour-id="overview-fleet-logistics-panel">
      <CardHeader>
        <CardTitle className="text-lg">Fleet logistics</CardTitle>
        <CardDescription>Inventory aging, expiring reservations, and recent arrivals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
            Days in stock (active inventory)
          </p>
          <div className="grid grid-cols-4 gap-2">
            {data.inventoryAging.map((b) => {
              // ">180" days = the long-aged bucket emitted by
              // report_inventory_aging. Highlight in amber.
              const isAged = b.bucket === ">180";
              return (
                <div
                  key={b.bucket}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    isAged ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-muted/30"
                  )}
                >
                  <p className="text-xs text-muted-foreground">{b.bucket} days</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xl font-semibold tabular-nums",
                      isAged && b.count > 0 ? "text-amber-600" : ""
                    )}
                  >
                    {b.count}
                  </p>
                </div>
              );
            })}
          </div>
          {(() => {
            const over90 = data.inventoryAging
              .filter((b) => b.bucket === "90-180" || b.bucket === ">180")
              .reduce((s, b) => s + b.count, 0);
            return over90 > 0 ? (
              <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-50/60 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                {over90} {over90 === 1 ? "car has" : "cars have"} been in stock over
                90 days — review pricing and push these.{" "}
                <Link href="/reports" className="font-medium underline">
                  See aging report
                </Link>
                .
              </p>
            ) : null;
          })()}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
              Reservations (next out)
            </p>
            {data.reservationsExpiring.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active reservations.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border text-sm">
                {data.reservationsExpiring.map((r) => (
                  <li key={r.id} className="flex flex-col gap-0.5 px-3 py-2">
                    <span className="font-medium">
                      {[r.brand, r.model].filter(Boolean).join(" ") || r.vin || "Car"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.reservation_date
                        ? format(new Date(r.reservation_date + "T12:00:00"), "MMM d, yyyy")
                        : "—"}
                      {r.reserved_by ? ` · ${r.reserved_by}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">
              New arrivals (last 7 days)
            </p>
            {data.newArrivals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No new arrivals.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border text-sm">
                {data.newArrivals.map((c) => (
                  <li key={c.id} className="flex flex-col gap-0.5 px-3 py-2">
                    <span className="font-medium">
                      {[c.brand, c.model].filter(Boolean).join(" ") || c.vin || "Car"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.date_arrived
                        ? format(new Date(c.date_arrived + "T12:00:00"), "MMM d, yyyy")
                        : "—"}
                      {c.vin ? ` · VIN ${c.vin}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CashReceivablesCard({ data }: { data: OwnerOverviewData }) {
  const { cashState, pendingRefunds, agedReceivables } = data;
  return (
    <Card className="lg:col-span-2" data-tour-id="overview-cash-receivables-panel">
      <CardHeader>
        <CardTitle className="text-lg">Cash &amp; receivables</CardTitle>
        <CardDescription>Drawer state, refunds awaiting approval, and overdue installments.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Cash drawer</p>
            {cashState.isOpen ? (
              <>
                <p className="text-2xl font-semibold tabular-nums">
                  {USD_FORMATTER.format(cashState.openingBalance)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Open
                  {cashState.openedAt
                    ? ` · ${formatDistanceToNow(new Date(cashState.openedAt), { addSuffix: true })}`
                    : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold text-muted-foreground">Closed</p>
                <p className="text-xs text-muted-foreground">No session open</p>
              </>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Today — cash in</p>
            <MoneyStack map={cashState.todayCashIn} emptyLabel="No inflow today" className="text-base" />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Today — cash out</p>
            <MoneyStack map={cashState.todayCashOut} emptyLabel="No outflow today" className="text-base" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Refunds pending approval</p>
              <span className="text-2xl font-semibold tabular-nums">{pendingRefunds.count}</span>
            </div>
            <div className="mt-2">
              <MoneyStack
                map={pendingRefunds.amountByCurrency}
                emptyLabel="No amount data"
                className="text-sm"
              />
            </div>
            <Button variant="link" className="mt-1 h-auto px-0 text-xs" asChild>
              <Link href="/garage/refunds">Open refunds</Link>
            </Button>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Aged receivables</p>
              <span className="text-2xl font-semibold tabular-nums">{agedReceivables.count}</span>
            </div>
            <p className="mt-1 text-sm tabular-nums">
              {agedReceivables.totalOutstanding > 0
                ? USD_FORMATTER.format(agedReceivables.totalOutstanding)
                : "—"}{" "}
              outstanding
            </p>
            {agedReceivables.oldestDays > 0 ? (
              <p className="text-xs text-amber-600">
                Oldest is {agedReceivables.oldestDays} days overdue
              </p>
            ) : null}
            <Button variant="link" className="mt-1 h-auto px-0 text-xs" asChild>
              <Link href="/installments">Open installments</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OverviewDashboard({ data }: { data: OwnerOverviewData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const totalVehicles = data.summary.totalCars;

  function handleRefresh() {
    startTransition(async () => {
      await refreshOwnerOverview();
      router.refresh();
    });
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Owner overview</h1>
          <p className="text-muted-foreground text-sm">
            Live operating snapshot: sales, fleet, cash, garage, customers, and the queue.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          disabled={pending}
          onClick={handleRefresh}
          data-tour-id="overview-refresh-button"
        >
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {data.errors.length > 0 ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive text-base">Partial load</CardTitle>
            <CardDescription>Some queries failed; other sections may be empty.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-muted-foreground text-sm">
              {data.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* High-level KPI strip (5 tiles) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-tour-id="overview-kpi-strip">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vehicles</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{totalVehicles}</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {data.summary.inStockCars} in stock
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="link" className="h-auto px-0 text-xs" asChild>
              <Link href="/cars">Inventory</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Customers</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.summary.totalCustomers}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="link" className="h-auto px-0 text-xs" asChild>
              <Link href="/customers">Directory</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sales orders</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.summary.activeSalesOrders}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-muted-foreground text-xs">Non-cancelled orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending queue</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.summary.pendingRequests}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-muted-foreground text-xs">
              Deletions, Houssam/Kareem requests, document &amp; page access
            </p>
            <Button variant="link" className="h-auto px-0 text-xs" asChild>
              <Link href="/requests/pending">Open queue</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>Warranties (90 days)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.summary.warrantiesExpiringSoon}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-muted-foreground text-xs">Vehicle or battery end date in window</p>
          </CardContent>
        </Card>
      </div>

      {/* Operational KPI strip (4 tiles) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sold MTD</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{data.salesMTD.units}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-muted-foreground text-xs">
              vs {data.salesMTD.unitsLastMonth} last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open garage jobs</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.summary.activeGarageJobs}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="link" className="h-auto px-0 text-xs" asChild>
              <Link href="/garage">Jobs board</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open warranty cases</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.summary.openWarrantyCases}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="link" className="h-auto px-0 text-xs" asChild>
              <Link href="/garage/warranty">Warranty queue</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SalesRevenueCard data={data} />
        <CashReceivablesCard data={data} />
        <FleetLogisticsCard data={data} />

        <CarsByStatusChartCard
          rows={data.carStatusChart}
          totalVehicles={totalVehicles}
          carsAddedPerMonth={data.carsAddedPerMonth}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active garage tasks</CardTitle>
            <CardDescription>
              Tasks in <strong>pending</strong> or <strong>in progress</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-semibold tabular-nums">{data.activeGarageTasks}</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/garage/tasks">Task board</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending requests by priority</CardTitle>
            <CardDescription>
              Open statuses: submitted, awaiting approval, needs more info.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.requestPriorityChart.every((d) => d.count === 0) ? (
              <p className="text-muted-foreground text-sm">No pending requests.</p>
            ) : (
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.requestPriorityChart.filter((d) => d.count > 0)}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {data.requestPriorityChart
                        .filter((d) => d.count > 0)
                        .map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipContentStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link href="/requests/pending">Pending requests</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Installments due in the next 7 days</CardTitle>
            <CardDescription>Rows with status upcoming or due, within the window.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.installmentsDueSoon.length === 0 ? (
              <p className="text-muted-foreground text-sm">None in this window.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border text-sm">
                {data.installmentsDueSoon.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <span className="font-medium">
                        {format(new Date(row.due_date + "T12:00:00"), "MMM d, yyyy")}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        #{row.installment_no} — {row.summary}
                      </span>
                    </div>
                    <span className="tabular-nums">{USD_FORMATTER.format(Number(row.amount_due))}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link href="/installments">Installments</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Low stock parts</CardTitle>
            <CardDescription>Quantity under 5 (excluding deleted rows).</CardDescription>
          </CardHeader>
          <CardContent>
            {data.lowStockParts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No parts below 5 units.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border text-sm">
                {data.lowStockParts.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">{p.part_name}</span>
                    <span className="text-muted-foreground">
                      {p.oe_number ? `OE ${p.oe_number} · ` : null}
                      <span className="text-foreground tabular-nums">Qty {p.quantity}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link href="/garage/inventory">Parts inventory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
