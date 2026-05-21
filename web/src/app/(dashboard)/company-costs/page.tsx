"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldHint } from "@/components/ui/field-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock,
  Megaphone,
  Plus,
  Receipt,
  Wallet,
  XCircle,
} from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type CostCategory =
  | "marketing"
  | "car"
  | "parts"
  | "garage"
  | "operating"
  | "other";
type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "other";
type ApprovalStatus = "pending" | "approved" | "rejected";

interface CompanyCost {
  id: string;
  type: string; // always 'expense' — column kept for DB compatibility
  category: CostCategory;
  subcategory: string | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod | null;
  description: string | null;
  cost_date: string;
  related_car_id: string | null;
  related_customer_id: string | null;
  related_supplier_id: string | null;
  related_employee_id: string | null;
  related_garage_job_id: string | null;
  related_sales_order_id: string | null;
  related_purchase_order_id: string | null;
  related_marketing_campaign_id: string | null;
  receipt_url: string | null;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
}

interface MarketingCampaign {
  id: string;
  name: string;
  platform: string | null;
  status: "planned" | "active" | "completed" | "cancelled";
  start_date: string | null;
  end_date: string | null;
  budget_amount: number | null;
  budget_currency: string;
  related_car_id: string | null;
  notes: string | null;
}

interface CarLite {
  id: string;
  vin: string;
  brand: string;
  model: string;
  model_year: number | null;
}
interface CustomerLite {
  id: string;
  first_name: string;
  last_name: string | null;
}
interface SupplierLite {
  id: string;
  name: string;
}
interface ProfileLite {
  id: string;
  full_name: string | null;
}
interface GarageJobLite {
  id: string;
  title: string;
}
interface SalesOrderLite {
  id: string;
  car_id: string;
}
interface PurchaseOrderLite {
  id: string;
  po_number: string;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABEL: Record<CostCategory, string> = {
  marketing: "Marketing",
  car: "Car",
  parts: "Parts",
  garage: "Garage",
  operating: "Operating",
  other: "Other",
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
};

const APPROVAL_COLOR: Record<ApprovalStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const CAMPAIGN_STATUS_COLOR: Record<string, string> = {
  planned: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  active:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const RECEIPT_BUCKET = "cost-receipts";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB

const fmt = (n: number | null | undefined, currency = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n);

const NONE = "__none__";

// ============================================================================
// Access gate
// ============================================================================

export default function CompanyCostsPage() {
  const { isOwner, hasCapability } = useUser();
  const canRead =
    isOwner ||
    hasCapability("view_reports") ||
    hasCapability("cashier") ||
    hasCapability("garage") ||
    hasCapability("manage_team");

  if (!canRead) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <AlertTriangle className="mx-auto mb-3 size-6" />
        <p>You don&apos;t have access to company costs.</p>
        <Button variant="link" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }
  return <Body />;
}

// ============================================================================
// Body
// ============================================================================

function Body() {
  const supabase = createClient();
  const { isOwner, hasCapability } = useUser();
  const canWrite =
    isOwner ||
    hasCapability("cashier") ||
    hasCapability("manage_team") ||
    hasCapability("garage");

  const [costs, setCosts] = useState<CompanyCost[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [cars, setCars] = useState<CarLite[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [employees, setEmployees] = useState<ProfileLite[]>([]);
  const [garageJobs, setGarageJobs] = useState<GarageJobLite[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderLite[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderLite[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [campaignsOpen, setCampaignsOpen] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [cc, mc, cr, cu, su, pr, gj, so, po] = await Promise.all([
      supabase
        .from("company_costs")
        .select("*")
        .is("deleted_at", null)
        .order("cost_date", { ascending: false })
        .limit(2000),
      supabase
        .from("marketing_campaigns")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("cars")
        .select("id, vin, brand, model, model_year")
        .order("brand"),
      supabase
        .from("customers")
        .select("id, first_name, last_name")
        .is("deleted_at", null)
        .order("first_name"),
      supabase
        .from("suppliers")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name"),
      supabase
        .from("garage_jobs")
        .select("id, title")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("sales_orders")
        .select("id, car_id")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("purchase_orders")
        .select("id, po_number")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (cc.error) toast.error(formatError(cc.error));
    else setCosts((cc.data as CompanyCost[]) ?? []);
    if (!mc.error) setCampaigns((mc.data as MarketingCampaign[]) ?? []);
    if (!cr.error) setCars((cr.data as CarLite[]) ?? []);
    if (!cu.error) setCustomers((cu.data as CustomerLite[]) ?? []);
    if (!su.error) setSuppliers((su.data as SupplierLite[]) ?? []);
    if (!pr.error) setEmployees((pr.data as ProfileLite[]) ?? []);
    if (!gj.error) setGarageJobs((gj.data as GarageJobLite[]) ?? []);
    if (!so.error) setSalesOrders((so.data as SalesOrderLite[]) ?? []);
    if (!po.error) setPurchaseOrders((po.data as PurchaseOrderLite[]) ?? []);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // ----- Lookup maps -----
  const carById = useMemo(() => {
    const m = new Map<string, CarLite>();
    cars.forEach((c) => m.set(c.id, c));
    return m;
  }, [cars]);
  const customerById = useMemo(() => {
    const m = new Map<string, CustomerLite>();
    customers.forEach((c) => m.set(c.id, c));
    return m;
  }, [customers]);
  const supplierById = useMemo(() => {
    const m = new Map<string, SupplierLite>();
    suppliers.forEach((s) => m.set(s.id, s));
    return m;
  }, [suppliers]);
  const campaignById = useMemo(() => {
    const m = new Map<string, MarketingCampaign>();
    campaigns.forEach((c) => m.set(c.id, c));
    return m;
  }, [campaigns]);

  const carLabel = (c: CarLite) =>
    `${c.brand} ${c.model}${c.model_year ? ` ${c.model_year}` : ""} · ${c.vin}`;

  // ----- KPI summary (costs only) -----
  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    let monthCost = 0;
    let yearCost = 0;
    let pendingCount = 0;
    for (const c of costs) {
      const d = new Date(c.cost_date);
      const amt = Number(c.amount) || 0;
      if (d >= yearStart) yearCost += amt;
      if (d >= monthStart) monthCost += amt;
      if (c.approval_status === "pending") pendingCount += 1;
    }
    return { monthCost, yearCost, pendingCount };
  }, [costs]);

  // ----- Filtered entries -----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return costs.filter((c) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter)
        return false;
      if (
        paymentFilter !== "all" &&
        (c.payment_method ?? "") !== paymentFilter
      )
        return false;
      if (fromDate && c.cost_date < fromDate) return false;
      if (toDate && c.cost_date > toDate) return false;
      if (q) {
        const hay = [
          c.description ?? "",
          c.subcategory ?? "",
          CATEGORY_LABEL[c.category] ?? "",
          c.related_car_id ? carById.get(c.related_car_id)?.vin ?? "" : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [costs, categoryFilter, paymentFilter, fromDate, toDate, search, carById]);

  const filteredTotal = useMemo(
    () => filtered.reduce((s, c) => s + (Number(c.amount) || 0), 0),
    [filtered]
  );

  async function handleApprove(id: string, status: ApprovalStatus) {
    const { error } = await supabase
      .from("company_costs")
      .update({
        approval_status: status,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success(status === "approved" ? "Cost approved" : "Cost rejected");
    void load();
  }

  return (
    <div className="container space-y-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Wallet className="size-6" /> Company Costs
          </h1>
          <p className="text-muted-foreground text-sm">
            Record every cost the company pays — marketing, parts, garage,
            shipping, customs, salaries, rent and more — so owners can see the
            true cost of each car and the whole business.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCampaignsOpen(true)}
            data-tour-id="company-costs-campaigns-button"
          >
            <Megaphone className="mr-1.5 size-4" /> Campaigns
          </Button>
          {canWrite && (
            <Button
              onClick={() => setAddOpen(true)}
              data-tour-id="company-costs-add-expense"
            >
              <Plus className="mr-1.5 size-4" /> Add Cost
            </Button>
          )}
        </div>
      </div>

      {/* KPI summary — costs only */}
      <div
        className="grid gap-3 sm:grid-cols-3"
        data-tour-id="company-costs-summary-cards"
      >
        {loading ? (
          <>
            <Skeleton className="h-[100px] w-full" />
            <Skeleton className="h-[100px] w-full" />
            <Skeleton className="h-[100px] w-full" />
          </>
        ) : (
          <>
            <KpiCard
              label="Costs this month"
              value={fmt(summary.monthCost)}
              icon={Receipt}
              color="red"
            />
            <KpiCard
              label="Costs this year"
              value={fmt(summary.yearCost)}
              icon={CalendarRange}
              color="amber"
            />
            <KpiCard
              label="Awaiting approval"
              value={summary.pendingCount}
              icon={Clock}
              color="amber"
            />
          </>
        )}
      </div>

      <Tabs defaultValue="entries" className="w-full">
        <TabsList>
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="reports" data-tour-id="company-costs-reports">
            Reports
          </TabsTrigger>
        </TabsList>

        {/* ---- Entries tab ---- */}
        <TabsContent value="entries" className="space-y-4">
          {/* Filters */}
          <Card data-tour-id="company-costs-filters">
            <CardContent className="grid gap-3 py-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {(
                      Object.keys(CATEGORY_LABEL) as CostCategory[]
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment method</Label>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All methods</SelectItem>
                    {(
                      Object.keys(PAYMENT_LABEL) as PaymentMethod[]
                    ).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PAYMENT_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Search</Label>
                <Input
                  placeholder="Description, VIN…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost entries</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading…"
                  : `${filtered.length} entr${
                      filtered.length === 1 ? "y" : "ies"
                    } · ${fmt(filteredTotal)} total`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : filtered.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No cost entries match your filters.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5">Date</th>
                        <th className="px-2 py-1.5">Category</th>
                        <th className="px-2 py-1.5">Description</th>
                        <th className="px-2 py-1.5">Linked to</th>
                        <th className="px-2 py-1.5">Method</th>
                        <th className="px-2 py-1.5">Status</th>
                        <th className="px-2 py-1.5 text-right">Amount</th>
                        {isOwner && (
                          <th className="px-2 py-1.5 text-right">Approve</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {filtered.map((c) => {
                        const linked: string[] = [];
                        if (c.related_car_id) {
                          const car = carById.get(c.related_car_id);
                          if (car)
                            linked.push(`${car.brand} ${car.model}`);
                        }
                        if (c.related_supplier_id) {
                          const s = supplierById.get(c.related_supplier_id);
                          if (s) linked.push(s.name);
                        }
                        if (c.related_customer_id) {
                          const cu = customerById.get(c.related_customer_id);
                          if (cu)
                            linked.push(
                              `${cu.first_name} ${cu.last_name ?? ""}`.trim()
                            );
                        }
                        if (c.related_marketing_campaign_id) {
                          const ca = campaignById.get(
                            c.related_marketing_campaign_id
                          );
                          if (ca) linked.push(ca.name);
                        }
                        return (
                          <tr key={c.id}>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {c.cost_date}
                            </td>
                            <td className="px-2 py-1.5">
                              <Badge variant="outline" className="h-5 px-1.5">
                                {CATEGORY_LABEL[c.category]}
                              </Badge>
                            </td>
                            <td className="px-2 py-1.5">
                              {c.description ?? "—"}
                              {c.subcategory && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  ({c.subcategory})
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {linked.length > 0 ? linked.join(", ") : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {c.payment_method
                                ? PAYMENT_LABEL[c.payment_method]
                                : "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 px-1.5 text-[10px] uppercase",
                                  APPROVAL_COLOR[c.approval_status]
                                )}
                              >
                                {c.approval_status}
                              </Badge>
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {fmt(Number(c.amount), c.currency)}
                            </td>
                            {isOwner && (
                              <td className="px-2 py-1.5 text-right">
                                {c.approval_status === "pending" ? (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-7"
                                      onClick={() =>
                                        void handleApprove(c.id, "approved")
                                      }
                                      title="Approve"
                                    >
                                      <CheckCircle2 className="size-4 text-emerald-600" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-7"
                                      onClick={() =>
                                        void handleApprove(c.id, "rejected")
                                      }
                                      title="Reject"
                                    >
                                      <XCircle className="size-4 text-red-600" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Reports tab ---- */}
        <TabsContent value="reports">
          <ReportsTab
            costs={costs}
            loading={loading}
            carById={carById}
            supplierById={supplierById}
            campaignById={campaignById}
          />
        </TabsContent>
      </Tabs>

      <AddCostDialog
        open={addOpen}
        cars={cars}
        carLabel={carLabel}
        customers={customers}
        suppliers={suppliers}
        employees={employees}
        garageJobs={garageJobs}
        salesOrders={salesOrders}
        purchaseOrders={purchaseOrders}
        campaigns={campaigns}
        onClose={() => setAddOpen(false)}
        onDone={() => {
          setAddOpen(false);
          void load();
        }}
      />
      <CampaignsDialog
        open={campaignsOpen}
        campaigns={campaigns}
        cars={cars}
        carLabel={carLabel}
        canWrite={canWrite}
        onClose={() => setCampaignsOpen(false)}
        onChanged={() => void load()}
      />
    </div>
  );
}

// ============================================================================
// Reports tab — costs only, no income / net / profit
// ============================================================================

function ReportsTab({
  costs,
  loading,
  carById,
  supplierById,
  campaignById,
}: {
  costs: CompanyCost[];
  loading: boolean;
  carById: Map<string, CarLite>;
  supplierById: Map<string, SupplierLite>;
  campaignById: Map<string, MarketingCampaign>;
}) {
  const byCar = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of costs) {
      if (!c.related_car_id) continue;
      m.set(
        c.related_car_id,
        (m.get(c.related_car_id) ?? 0) + (Number(c.amount) || 0)
      );
    }
    return [...m.entries()]
      .map(([carId, total]) => ({ car: carById.get(carId), carId, total }))
      .sort((a, b) => b.total - a.total);
  }, [costs, carById]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of costs) {
      const key = (c.cost_date ?? "").slice(0, 7); // YYYY-MM
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + (Number(c.amount) || 0));
    }
    return [...m.entries()]
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [costs]);

  const byCategory = useMemo(() => {
    const m = new Map<CostCategory, number>();
    for (const c of costs) {
      m.set(c.category, (m.get(c.category) ?? 0) + (Number(c.amount) || 0));
    }
    return [...m.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [costs]);

  const bySupplier = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of costs) {
      if (!c.related_supplier_id) continue;
      m.set(
        c.related_supplier_id,
        (m.get(c.related_supplier_id) ?? 0) + (Number(c.amount) || 0)
      );
    }
    return [...m.entries()]
      .map(([supplierId, total]) => ({
        supplier: supplierById.get(supplierId),
        supplierId,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [costs, supplierById]);

  const byCampaign = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of costs) {
      if (!c.related_marketing_campaign_id) continue;
      m.set(
        c.related_marketing_campaign_id,
        (m.get(c.related_marketing_campaign_id) ?? 0) +
          (Number(c.amount) || 0)
      );
    }
    return [...m.entries()]
      .map(([campaignId, total]) => ({
        campaign: campaignById.get(campaignId),
        campaignId,
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [costs, campaignById]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* By car — total cost per car only */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total cost by car</CardTitle>
          <CardDescription>
            All recorded costs attached to each vehicle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {byCar.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No costs linked to a car yet.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Car</th>
                  <th className="px-2 py-1.5">VIN</th>
                  <th className="px-2 py-1.5 text-right">Total cost</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {byCar.map((r) => (
                  <tr key={r.carId}>
                    <td className="px-2 py-1.5">
                      {r.car
                        ? `${r.car.brand} ${r.car.model}${
                            r.car.model_year ? ` ${r.car.model_year}` : ""
                          }`
                        : "Unknown car"}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {r.car?.vin ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* By month — costs only */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Costs by month</CardTitle>
          <CardDescription>Total costs recorded each month.</CardDescription>
        </CardHeader>
        <CardContent>
          {byMonth.length === 0 ? (
            <p className="text-muted-foreground text-sm">No costs yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Month</th>
                  <th className="px-2 py-1.5 text-right">Total cost</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {byMonth.map((r) => (
                  <tr key={r.month}>
                    <td className="px-2 py-1.5">{r.month}</td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* By category */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Costs by category</CardTitle>
          <CardDescription>Where the money goes.</CardDescription>
        </CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm">No costs yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Category</th>
                  <th className="px-2 py-1.5 text-right">Total cost</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {byCategory.map((r) => (
                  <tr key={r.category}>
                    <td className="px-2 py-1.5">
                      {CATEGORY_LABEL[r.category]}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* By supplier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Costs by supplier</CardTitle>
          <CardDescription>Total spend per supplier.</CardDescription>
        </CardHeader>
        <CardContent>
          {bySupplier.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No costs linked to a supplier yet.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Supplier</th>
                  <th className="px-2 py-1.5 text-right">Total cost</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {bySupplier.map((r) => (
                  <tr key={r.supplierId}>
                    <td className="px-2 py-1.5">
                      {r.supplier?.name ?? "Unknown supplier"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* By campaign */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            Marketing cost by campaign
          </CardTitle>
          <CardDescription>
            Total marketing spend per campaign.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {byCampaign.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No costs linked to a campaign yet.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Campaign</th>
                  <th className="px-2 py-1.5">Platform</th>
                  <th className="px-2 py-1.5 text-right">Total cost</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {byCampaign.map((r) => (
                  <tr key={r.campaignId}>
                    <td className="px-2 py-1.5">
                      {r.campaign?.name ?? "Unknown campaign"}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {r.campaign?.platform ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Add Cost dialog
// ============================================================================

function AddCostDialog({
  open,
  cars,
  carLabel,
  customers,
  suppliers,
  employees,
  garageJobs,
  salesOrders,
  purchaseOrders,
  campaigns,
  onClose,
  onDone,
}: {
  open: boolean;
  cars: CarLite[];
  carLabel: (c: CarLite) => string;
  customers: CustomerLite[];
  suppliers: SupplierLite[];
  employees: ProfileLite[];
  garageJobs: GarageJobLite[];
  salesOrders: SalesOrderLite[];
  purchaseOrders: PurchaseOrderLite[];
  campaigns: MarketingCampaign[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<CostCategory>("operating");
  const [subcategory, setSubcategory] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentMethod, setPaymentMethod] = useState<string>(NONE);
  const [description, setDescription] = useState("");
  const [costDate, setCostDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [carId, setCarId] = useState<string>(NONE);
  const [customerId, setCustomerId] = useState<string>(NONE);
  const [supplierId, setSupplierId] = useState<string>(NONE);
  const [employeeId, setEmployeeId] = useState<string>(NONE);
  const [garageJobId, setGarageJobId] = useState<string>(NONE);
  const [salesOrderId, setSalesOrderId] = useState<string>(NONE);
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>(NONE);
  const [campaignId, setCampaignId] = useState<string>(NONE);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory("operating");
      setSubcategory("");
      setAmount("");
      setCurrency("USD");
      setPaymentMethod(NONE);
      setDescription("");
      setCostDate(new Date().toISOString().slice(0, 10));
      setCarId(NONE);
      setCustomerId(NONE);
      setSupplierId(NONE);
      setEmployeeId(NONE);
      setGarageJobId(NONE);
      setSalesOrderId(NONE);
      setPurchaseOrderId(NONE);
      setCampaignId(NONE);
      setReceiptFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  const idOrNull = (v: string) => (v === NONE ? null : v);

  async function submit() {
    const amt = Number(amount);
    if (isNaN(amt) || amt < 0) {
      toast.error("Amount must be 0 or greater");
      return;
    }
    if (!costDate) {
      toast.error("Pick a cost date");
      return;
    }
    if (receiptFile && receiptFile.size > MAX_RECEIPT_BYTES) {
      toast.error("Receipt must be 10 MB or smaller");
      return;
    }

    setSubmitting(true);

    // Every entry is a cost — type is always 'expense'.
    const { data: inserted, error } = await supabase
      .from("company_costs")
      .insert({
        type: "expense",
        category,
        subcategory: subcategory.trim() || null,
        amount: amt,
        currency: currency.trim() || "USD",
        payment_method: idOrNull(paymentMethod),
        description: description.trim() || null,
        cost_date: costDate,
        related_car_id: idOrNull(carId),
        related_customer_id: idOrNull(customerId),
        related_supplier_id: idOrNull(supplierId),
        related_employee_id: idOrNull(employeeId),
        related_garage_job_id: idOrNull(garageJobId),
        related_sales_order_id: idOrNull(salesOrderId),
        related_purchase_order_id: idOrNull(purchaseOrderId),
        related_marketing_campaign_id: idOrNull(campaignId),
      })
      .select("id")
      .single();

    if (error || !inserted) {
      setSubmitting(false);
      toast.error(formatError(error));
      return;
    }

    const costId = (inserted as { id: string }).id;

    // Upload receipt (optional) and attach its path.
    if (receiptFile) {
      const path = `${costId}/${Date.now()}_${receiptFile.name}`;
      const { error: upErr } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .upload(path, receiptFile, {
          contentType: receiptFile.type,
          upsert: false,
        });
      if (upErr) {
        setSubmitting(false);
        toast.error(`Cost saved but receipt upload failed: ${formatError(upErr)}`);
        onDone();
        return;
      }
      const { error: updErr } = await supabase
        .from("company_costs")
        .update({ receipt_url: path })
        .eq("id", costId);
      if (updErr) {
        toast.error("Receipt uploaded but could not be linked to the cost");
      }
    }

    setSubmitting(false);
    toast.success("Cost recorded");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        data-tour-id="company-costs-add-dialog"
      >
        <DialogHeader>
          <DialogTitle>Add Cost</DialogTitle>
          <DialogDescription>
            Record a cost the company paid. Pick a category, enter the real
            amount from the receipt, and link it to a car, supplier, job or
            campaign so the reports stay accurate.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>
              Category *
              <FieldHint text="What kind of cost this is — used to group spending in reports." />
            </Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as CostCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABEL) as CostCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>
              Subcategory
              <FieldHint text="Optional finer label, e.g. 'customs', 'shipping', 'salary'." />
            </Label>
            <Input
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="e.g. shipping"
            />
          </div>

          <div className="space-y-1">
            <Label>Amount *</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              data-tour-id="company-costs-add-amount"
            />
          </div>
          <div className="space-y-1">
            <Label>Currency</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="USD"
              maxLength={3}
            />
          </div>

          <div className="space-y-1">
            <Label>Cost date *</Label>
            <Input
              type="date"
              value={costDate}
              onChange={(e) => setCostDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>
              Payment method
              <FieldHint text="How the company paid for this cost." />
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PAYMENT_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What was this cost for?"
            />
          </div>

          {/* Related entities */}
          <div className="space-y-1">
            <Label>
              Related car
              <FieldHint text="Use when the cost belongs to a specific vehicle." />
            </Label>
            <Select value={carId} onValueChange={setCarId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {cars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {carLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Related supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Related customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {`${c.first_name} ${c.last_name ?? ""}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Related employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name ?? "Unnamed"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Related garage job</Label>
            <Select value={garageJobId} onValueChange={setGarageJobId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {garageJobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Related sales order</Label>
            <Select value={salesOrderId} onValueChange={setSalesOrderId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {salesOrders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {`Order ${o.id.slice(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Related purchase order</Label>
            <Select
              value={purchaseOrderId}
              onValueChange={setPurchaseOrderId}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {purchaseOrders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.po_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Related campaign</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Receipt upload */}
          <div className="space-y-1 sm:col-span-2">
            <Label>
              Receipt / invoice
              <FieldHint text="Attach a photo or PDF of the receipt as proof of payment (max 10 MB)." />
            </Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) =>
                setReceiptFile(e.target.files?.[0] ?? null)
              }
              data-tour-id="company-costs-add-receipt"
            />
            {receiptFile && (
              <p className="text-muted-foreground text-xs">
                {receiptFile.name} (
                {(receiptFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting || !amount}
            data-tour-id="company-costs-add-submit"
          >
            {submitting ? "Saving…" : "Save cost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Campaigns dialog
// ============================================================================

function CampaignsDialog({
  open,
  campaigns,
  cars,
  carLabel,
  canWrite,
  onClose,
  onChanged,
}: {
  open: boolean;
  campaigns: MarketingCampaign[];
  cars: CarLite[];
  carLabel: (c: CarLite) => string;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState<MarketingCampaign["status"]>("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [carId, setCarId] = useState<string>(NONE);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setPlatform("");
      setStatus("active");
      setStartDate("");
      setEndDate("");
      setBudget("");
      setCarId(NONE);
      setNotes("");
    }
  }, [open]);

  async function createCampaign() {
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    const budgetNum = budget.trim() === "" ? null : Number(budget);
    if (budgetNum != null && (isNaN(budgetNum) || budgetNum < 0)) {
      toast.error("Budget must be 0 or greater");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("marketing_campaigns").insert({
      name: name.trim(),
      platform: platform.trim() || null,
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      budget_amount: budgetNum,
      budget_currency: "USD",
      related_car_id: carId === NONE ? null : carId,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Campaign created");
    setName("");
    setPlatform("");
    setBudget("");
    setNotes("");
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        data-tour-id="company-costs-campaigns-dialog"
      >
        <DialogHeader>
          <DialogTitle>Marketing campaigns</DialogTitle>
          <DialogDescription>
            Group marketing costs by campaign so owners can see the cost of
            each ad push.
          </DialogDescription>
        </DialogHeader>

        {canWrite && (
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Campaign name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spring EV push"
              />
            </div>
            <div className="space-y-1">
              <Label>Platform</Label>
              <Input
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="e.g. Instagram"
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setStatus(v as MarketingCampaign["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>End date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>
                Budget
                <FieldHint text="Planned spend for this campaign. Actual cost comes from linked cost entries." />
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Related car</Label>
              <Select value={carId} onValueChange={setCarId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {cars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {carLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                onClick={() => void createCampaign()}
                disabled={submitting || !name.trim()}
              >
                {submitting ? "Creating…" : "Create campaign"}
              </Button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">
            Existing campaigns ({campaigns.length})
          </p>
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">Name</th>
                    <th className="px-2 py-1.5">Platform</th>
                    <th className="px-2 py-1.5">Status</th>
                    <th className="px-2 py-1.5 text-right">Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td className="px-2 py-1.5">{c.name}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {c.platform ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 px-1.5 text-[10px] uppercase",
                            CAMPAIGN_STATUS_COLOR[c.status]
                          )}
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {fmt(c.budget_amount, c.budget_currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
