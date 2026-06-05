"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";
import { ChevronRight, RefreshCw } from "lucide-react";
import { formatError } from "@/lib/error-messages";

interface SalesOrderFull {
  id: string;
  car_id: string;
  customer_id: string | null;
  status: string;
  selling_price: number | null;
  currency: string | null;
  sale_date: string | null;
  date_bought: string | null;
  delivery_date: string | null;
  reservation_date: string | null;
  reserved_by: string | null;
  created_at: string;
  cars: {
    id: string;
    vin: string;
    brand: string;
    model: string;
    model_year: number | null;
    exterior_color: string | null;
    status: string;
  } | null;
  customers: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone_primary: string | null;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  reserved:  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  paid:      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function customerName(so: SalesOrderFull): string {
  if (!so.customers) return "—";
  const full =
    `${so.customers.first_name ?? ""} ${so.customers.last_name ?? ""}`.trim();
  return full || "—";
}

function matchesSearch(so: SalesOrderFull, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    (so.cars?.vin ?? "").toLowerCase().includes(s) ||
    (so.cars?.brand ?? "").toLowerCase().includes(s) ||
    (so.cars?.model ?? "").toLowerCase().includes(s) ||
    customerName(so).toLowerCase().includes(s) ||
    (so.customers?.phone_primary ?? "").includes(s)
  );
}

export default function SalesOrdersPage() {
  const router = useRouter();
  const { appRole } = useUser();
  const canSeePage =
    appRole === "owner" || appRole === "assistant" || appRole === "sales_ops";

  const [orders, setOrders] = useState<SalesOrderFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [statusFilter, setStatusFilter] = useState("all");

  const supabase = createClient();

  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales_orders")
      .select(
        `id, car_id, customer_id, status, selling_price, currency,
         sale_date, date_bought, delivery_date, reservation_date, reserved_by, created_at,
         cars:car_id (id, vin, brand, model, model_year, exterior_color, status),
         customers:customer_id (id, first_name, last_name, phone_primary)`
      )
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      toast.error(formatError(error));
      setOrders([]);
    } else {
      // Supabase types FK embeds as arrays by default; cast via unknown.
      setOrders((data as unknown as SalesOrderFull[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (canSeePage) fetchOrders();
  }, [canSeePage]);

  const filtered = useMemo(() => {
    return orders.filter((so) => {
      if (!matchesSearch(so, debouncedSearch)) return false;
      if (statusFilter !== "all" && so.status !== statusFilter) return false;
      return true;
    });
  }, [orders, debouncedSearch, statusFilter]);

  const totalRevenue = useMemo(
    () =>
      filtered
        .filter((so) => so.status !== "cancelled" && so.selling_price)
        .reduce((s, so) => s + (so.selling_price ?? 0), 0),
    [filtered]
  );

  const exportColumns: ExportColumn[] = [
    { key: "vin", header: "VIN" },
    { key: "car", header: "Car" },
    { key: "customer", header: "Customer" },
    { key: "phone", header: "Phone" },
    { key: "status", header: "Status" },
    { key: "selling_price", header: "Selling Price", type: "number" },
    { key: "currency", header: "Currency" },
    { key: "sale_date", header: "Sale Date" },
    { key: "delivery_date", header: "Delivery Date" },
  ];

  const exportData = (list: SalesOrderFull[]) =>
    list.map((so) => ({
      vin: so.cars?.vin ?? "",
      car: so.cars ? `${so.cars.brand} ${so.cars.model}${so.cars.model_year ? ` (${so.cars.model_year})` : ""}` : "—",
      customer: customerName(so),
      phone: so.customers?.phone_primary ?? "",
      status: so.status,
      selling_price: so.selling_price ?? "",
      currency: so.currency ?? "USD",
      sale_date: so.sale_date ? new Date(so.sale_date).toLocaleDateString() : "",
      delivery_date: so.delivery_date ? new Date(so.delivery_date).toLocaleDateString() : "",
    }));

  if (!canSeePage) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        Sales orders are restricted to owners, assistants, and sales staff.
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Sales Orders</h1>
          <p className="text-muted-foreground text-sm">
            All car sales — linked to customers and payment plans
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            data={exportData(filtered)}
            allData={exportData(orders)}
            columns={exportColumns}
            filename="Sales_Orders"
            options={{
              pageName: "Sales Orders",
              summary: `Total: ${filtered.length} orders | Revenue (all currencies, not converted): ${totalRevenue.toLocaleString()}`,
            }}
            disabled={loading}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchOrders()}
            disabled={loading}
            data-tour-id="sales-orders-list-refresh-button"
          >
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid gap-4 sm:grid-cols-3" data-tour-id="sales-orders-list-kpi-bar">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Total orders</p>
            <p className="text-2xl font-semibold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">In progress</p>
            <p className="text-2xl font-semibold">
              {filtered.filter((s) =>
                s.status === "draft" ||
                s.status === "reserved" ||
                s.status === "confirmed" ||
                s.status === "paid"
              ).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Revenue (USD)</p>
            <p className="text-2xl font-semibold tabular-nums">
              ${totalRevenue.toLocaleString()}
            </p>
            <p className="text-muted-foreground text-xs">
              {(() => {
                const priced = filtered.filter(
                  (so) => so.status !== "cancelled" && (so.selling_price ?? 0) > 0
                ).length;
                const active = filtered.filter((so) => so.status !== "cancelled").length;
                return active === 0
                  ? "No active orders in view."
                  : priced === active
                  ? `Sum across ${priced} active orders`
                  : `${priced} of ${active} active orders have a price set`;
              })()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-tour-id="sales-orders-list-table-panel">
        <CardHeader>
          <CardTitle>All orders</CardTitle>
          <CardDescription>
            {filtered.length} of {orders.length} orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search VIN, car, customer, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 max-w-xs text-base sm:text-sm"
              data-tour-id="sales-orders-list-search-input"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-tour-id="sales-orders-list-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="overflow-hidden rounded-lg border border-border/50">
              <div className="space-y-2 p-4">
                <Skeleton className="h-8 w-full" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            orders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <p className="text-muted-foreground">No sales orders yet.</p>
                <p className="text-muted-foreground text-xs">
                  Orders are created when a customer reserves or buys a car.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground">No sales orders match your filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )
          ) : (
            <>
              {/* Mobile: card list (≤640px) */}
              <ul className="flex flex-col gap-2 sm:hidden">
                {filtered.map((so) => {
                  const car = so.cars;
                  const name = customerName(so);
                  return (
                    <li
                      key={so.id}
                      className="cursor-pointer rounded-lg border border-border/50 bg-card p-3 active:bg-muted/40"
                      onClick={() => router.push(`/sales-orders/${so.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {car
                              ? `${car.brand} ${car.model}${car.model_year ? ` (${car.model_year})` : ""}`
                              : "—"}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground select-text">
                            {car?.vin ?? "—"}
                          </p>
                        </div>
                        <Badge className={STATUS_COLORS[so.status] ?? "bg-muted text-muted-foreground"}>
                          {so.status}
                        </Badge>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">Customer</dt>
                          <dd className="truncate">
                            {so.customer_id ? (
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/customers/${so.customer_id}`);
                                }}
                              >
                                {name}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">{name}</span>
                            )}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">Phone</dt>
                          <dd className="truncate text-muted-foreground select-text">
                            {so.customers?.phone_primary ?? "—"}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">Price</dt>
                          <dd className="truncate tabular-nums">
                            {so.selling_price != null
                              ? `${Number(so.selling_price).toLocaleString()} ${so.currency ?? "USD"}`
                              : "—"}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-muted-foreground">Sale date</dt>
                          <dd className="truncate text-muted-foreground">
                            {so.sale_date
                              ? new Date(so.sale_date).toLocaleDateString()
                              : so.date_bought
                              ? new Date(so.date_bought).toLocaleDateString()
                              : "—"}
                          </dd>
                        </div>
                        <div className="col-span-2 min-w-0">
                          <dt className="text-muted-foreground">Delivery</dt>
                          <dd className="truncate text-muted-foreground">
                            {so.delivery_date
                              ? new Date(so.delivery_date).toLocaleDateString()
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop / tablet: table (>640px) */}
              <div className="hidden overflow-x-auto rounded-lg border border-border/50 sm:block">
                <Table className="min-w-[900px] w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Car</TableHead>
                      <TableHead>VIN</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Sale Date</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead className="w-[1%] text-right">
                        <span className="sr-only">Open</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((so) => {
                      const car = so.cars;
                      const name = customerName(so);
                      return (
                        <TableRow
                          key={so.id}
                          className="group cursor-pointer hover:bg-muted/40"
                          title="Open order details"
                          onClick={() => router.push(`/sales-orders/${so.id}`)}
                        >
                          <TableCell className="font-medium">
                            {car
                              ? `${car.brand} ${car.model}${car.model_year ? ` (${car.model_year})` : ""}`
                              : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground select-text">
                            {car?.vin ?? "—"}
                          </TableCell>
                          <TableCell>
                            {so.customer_id ? (
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/customers/${so.customer_id}`);
                                }}
                              >
                                {name}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">{name}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground select-text">
                            {so.customers?.phone_primary ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[so.status] ?? "bg-muted text-muted-foreground"}>
                              {so.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {so.selling_price != null
                              ? `${Number(so.selling_price).toLocaleString()} ${so.currency ?? "USD"}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {so.sale_date
                              ? new Date(so.sale_date).toLocaleDateString()
                              : so.date_bought
                              ? new Date(so.date_bought).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {so.delivery_date
                              ? new Date(so.delivery_date).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground group-hover:text-foreground">
                              Open
                              <ChevronRight className="size-3.5" />
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
