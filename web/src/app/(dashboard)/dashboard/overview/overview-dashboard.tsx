"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, subMonths } from "date-fns";
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
import { CAR_STATUS_LABELS } from "@/types/database";
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

/**
 * Illustrative last-6-month curve; latest month equals totalVehicles from the same load as KPIs.
 * Replace with real time-series when available.
 */
function buildCarsOverTimeFromFleetTotal(totalVehicles: number): { month: string; total: number }[] {
  const now = new Date();
  return [5, 4, 3, 2, 1, 0].map((back) => {
    const d = subMonths(now, back);
    const t = (5 - back) / 5;
    const total = Math.max(0, Math.round(totalVehicles * (0.72 + 0.28 * t)));
    return { month: format(d, "MMM yyyy"), total };
  });
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
    totalCustomers: number;
    activeSalesOrders: number;
    pendingRequests: number;
    warrantiesExpiringSoon: number;
  };
  carStatusChart: { name: string; count: number }[];
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
  errors: string[];
};

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const tooltipContentStyle = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
} as const;

function CarsByStatusChartCard({
  rows,
  totalVehicles,
  soldCarsCount,
}: {
  rows: { name: string; count: number }[];
  /** Same as Vehicles KPI — from one server fetch, not a second query. */
  totalVehicles: number;
  /** Derived from `rows` (Sold label); kept explicit for chart copy / future series. */
  soldCarsCount: number;
}) {
  const [chartType, setChartType] = useState<CarStatusChartType>("bar");

  const carsByStatusData = useMemo(() => rows.filter((d) => d.count > 0), [rows]);

  const pieData = carsByStatusData;

  const carsOverTime = useMemo(
    () => buildCarsOverTimeFromFleetTotal(totalVehicles),
    [totalVehicles]
  );

  const chartKey = `${chartType}-${rows.map((r) => `${r.name}:${r.count}`).join("|")}-${totalVehicles}`;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="text-lg">Cars by status</CardTitle>
            <CardDescription>
              Same scope as the inventory list: all rows from{" "}
              <code className="text-xs">cars_display</code>.
              {chartType === "line" ? (
                <span className="mt-1 block text-xs">
                  Line shows an illustrative 6‑month curve ending at the current fleet total (
                  {totalVehicles} vehicles, {soldCarsCount} sold). Replace with real history when
                  available.
                </span>
              ) : null}
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
              <LineChart key={chartKey} data={carsOverTime} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total vehicles"
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
                  <XAxis type="number" inputMode="decimal" allowDecimals={false} className="text-xs" />
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

export function OverviewDashboard({ data }: { data: OwnerOverviewData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const totalVehicles = data.summary.totalCars;
  const soldCarsCount =
    data.carStatusChart.find((r) => r.name === CAR_STATUS_LABELS.sold)?.count ?? 0;

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
            Central snapshot: inventory, customers, sales pipeline, warranties, garage, requests,
            installments, and parts.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          disabled={pending}
          onClick={handleRefresh}
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vehicles</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{totalVehicles}</CardTitle>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <CarsByStatusChartCard
          rows={data.carStatusChart}
          totalVehicles={totalVehicles}
          soldCarsCount={soldCarsCount}
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
                    <span className="tabular-nums">{currency.format(Number(row.amount_due))}</span>
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
