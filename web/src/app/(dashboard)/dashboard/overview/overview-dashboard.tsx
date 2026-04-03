"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

export type OwnerOverviewData = {
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

export function OverviewDashboard({ data }: { data: OwnerOverviewData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
            Aggregated snapshot from inventory, garage tasks, requests, installments, and parts.
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Cars by status</CardTitle>
            <CardDescription>
              Active inventory rows from{" "}
              <code className="text-xs">cars_display</code> (excluding deleted).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.carStatusChart.length === 0 ? (
              <p className="text-muted-foreground text-sm">No cars to show.</p>
            ) : (
              <div className="h-[320px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.carStatusChart}
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
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
                    <Bar dataKey="count" name="Cars" radius={[0, 4, 4, 0]}>
                      {data.carStatusChart.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link href="/cars">Open inventory</Link>
            </Button>
          </CardContent>
        </Card>

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
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
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
