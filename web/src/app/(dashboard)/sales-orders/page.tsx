"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
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
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";
import { RefreshCw } from "lucide-react";

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
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_primary: string | null;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  reserved: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

function customerName(so: SalesOrderFull): string {
  if (!so.customers) return "—";
  const full = so.customers.full_name
    ?? `${so.customers.first_name ?? ""} ${so.customers.last_name ?? ""}`.trim();
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
         customers:customer_id (id, full_name, first_name, last_name, phone_primary)`
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
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
      if (!matchesSearch(so, search)) return false;
      if (statusFilter !== "all" && so.status !== statusFilter) return false;
      return true;
    });
  }, [orders, search, statusFilter]);

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
              summary: `Total: ${filtered.length} orders | Revenue: ${totalRevenue.toLocaleString()} USD`,
            }}
            disabled={loading}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchOrders()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Total orders</p>
            <p className="text-2xl font-semibold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Active / completed</p>
            <p className="text-2xl font-semibold">
              {filtered.filter((s) => s.status === "active" || s.status === "completed").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-sm">Revenue (filtered)</p>
            <p className="text-2xl font-semibold tabular-nums">
              {totalRevenue.toLocaleString()} USD
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
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
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-muted-foreground py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8">No sales orders match your filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/50">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((so) => {
                    const car = so.cars;
                    const name = customerName(so);
                    return (
                      <TableRow
                        key={so.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => {
                          if (car?.vin) router.push(`/cars/${encodeURIComponent(car.vin)}`);
                        }}
                      >
                        <TableCell className="font-medium">
                          {car
                            ? `${car.brand} ${car.model}${car.model_year ? ` (${car.model_year})` : ""}`
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
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
                        <TableCell className="text-sm text-muted-foreground">
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
