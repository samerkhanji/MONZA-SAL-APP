import { redirect } from "next/navigation";
import {
  addDays,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getSessionUserAndRole } from "@/lib/server/session-app-role";
import { CAR_STATUS_EDITABLE, CAR_STATUS_LABELS } from "@/types/database";
import {
  OverviewDashboard,
  type OwnerOverviewData,
} from "./overview-dashboard";

export const dynamic = "force-dynamic";

const PENDING_REQUEST_STATUSES = [
  "submitted",
  "awaiting_approval",
  "needs_more_info",
] as const;

const PRIORITY_ORDER = ["urgent", "normal", "low"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  normal: "Normal",
  low: "Low",
};

const SALE_STAGE_ORDER = [
  "draft",
  "reserved",
  "confirmed",
  "paid",
  "delivered",
] as const;
const SALE_STAGE_LABELS: Record<string, string> = {
  draft: "Draft",
  reserved: "Reserved",
  confirmed: "Confirmed",
  paid: "Paid",
  delivered: "Delivered",
};

// Bucket strings must match the `age_bucket` values emitted by the
// public.report_inventory_aging view: '<60' | '60-90' | '90-180' | '>180' |
// 'unknown'. Mismatched labels here = every bucket renders 0.
const INVENTORY_AGE_ORDER = ["<60", "60-90", "90-180", ">180"] as const;

/** Number of trailing months (including the current one) shown in the cars-added series. */
const CARS_OVER_TIME_MONTHS = 6;

type DashboardSupabase = Awaited<ReturnType<typeof createClient>>;

const POSTGREST_PAGE = 1000;

type CarOverviewRow = {
  status: string;
  warranty_vehicle_expiry?: string | null;
  warranty_battery_expiry?: string | null;
};

/** Paginate past PostgREST max_rows so status / warranty aggregates match the full fleet. */
async function fetchAllCarsDisplayForOverview(
  supabase: DashboardSupabase
): Promise<{ rows: CarOverviewRow[]; error: { message: string } | null }> {
  // Hard cap so a runaway view can never spin this loop forever (H4).
  // 50 * POSTGREST_PAGE rows is well above the realistic fleet size; if we
  // ever hit it, surface an error rather than silently truncating.
  const MAX_PAGES = 50;
  const rows: CarOverviewRow[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("cars_display")
      .select("status, warranty_vehicle_expiry, warranty_battery_expiry")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + POSTGREST_PAGE - 1);
    if (error) return { rows: [], error };
    const batch = (data ?? []) as CarOverviewRow[];
    rows.push(...batch);
    if (batch.length < POSTGREST_PAGE) return { rows, error: null };
    from += POSTGREST_PAGE;
  }
  return {
    rows,
    error: {
      message: `cars_display exceeded ${MAX_PAGES * POSTGREST_PAGE} rows; aborting paginated fetch.`,
    },
  };
}

async function fetchOverviewData(supabase: DashboardSupabase): Promise<OwnerOverviewData> {
  const errors: string[] = [];

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const weekEnd = format(addDays(now, 7), "yyyy-MM-dd");
  const weekStart = format(addDays(now, -7), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const lastMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const carsWindowStart = startOfMonth(subMonths(now, CARS_OVER_TIME_MONTHS - 1));
  const carsWindowStartDate = format(carsWindowStart, "yyyy-MM-dd");
  const carsWindowStartIso = `${carsWindowStartDate}T00:00:00Z`;
  const todayStartIso = `${today}T00:00:00Z`;
  const todayEndIso = `${today}T23:59:59Z`;

  const [
    carsCountRes,
    carsRowsResult,
    tasksRes,
    requestsRes,
    deletePendingCountRes,
    requestsMgmtPendingCountRes,
    docAccessPendingCountRes,
    pageAccessPendingCountRes,
    installmentsRes,
    partsRes,
    customersCountRes,
    salesOrdersCountRes,
    // Phase 1 additions:
    salesMTDRes,
    salesLastMonthCountRes,
    salesByStageRes,
    topSalesRepRes,
    inventoryAgingRes,
    reservationsExpiringRes,
    newArrivalsRes,
    cashSessionRes,
    todayCashRes,
    pendingRefundsRes,
    agedReceivablesRes,
    activeGarageJobsCountRes,
    openWarrantyCountRes,
    carsAddedRes,
  ] = await Promise.all([
    supabase
      .from("cars_display")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    fetchAllCarsDisplayForOverview(supabase),
    supabase
      .from("garage_tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"]),
    supabase
      .from("requests")
      .select("priority")
      .in("status", [...PENDING_REQUEST_STATUSES]),
    supabase
      .from("delete_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted")
      .in("send_to", ["houssam", "kareem"]),
    supabase
      .from("document_access_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("page_access_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("installment_payments")
      .select(
        `
        id,
        due_date,
        amount_due,
        installment_no,
        payment_plans (
          cars ( brand, model ),
          customers ( first_name, last_name )
        )
      `
      )
      .in("status", ["upcoming", "due"])
      .gte("due_date", today)
      .lte("due_date", weekEnd)
      .order("due_date", { ascending: true }),
    supabase
      .from("parts")
      .select("id, part_name, oe_number, quantity")
      .is("deleted_at", null)
      .lt("quantity", 5)
      .order("quantity", { ascending: true })
      .limit(40),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("sales_orders")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelled"),
    // ---- Phase 1 ----
    // Delivered this month: rows whose delivery_date is in the current month and not cancelled.
    supabase
      .from("sales_orders")
      .select("id")
      .gte("delivery_date", monthStart)
      .lte("delivery_date", today)
      .neq("status", "cancelled"),
    // Delivered last month — count only, for MoM comparison.
    supabase
      .from("sales_orders")
      .select("id", { count: "exact", head: true })
      .gte("delivery_date", lastMonthStart)
      .lte("delivery_date", lastMonthEnd)
      .neq("status", "cancelled"),
    // Sales pipeline by stage (non-cancelled).
    supabase
      .from("sales_orders")
      .select("status")
      .neq("status", "cancelled"),
    // Top sales rep by deliveries (view is SECURITY DEFINER so bypasses RLS).
    supabase
      .from("report_sales_rep_performance")
      .select(
        "sales_rep_id, sales_rep_name, deals_in_pipeline, deals_delivered"
      )
      .order("deals_delivered", { ascending: false, nullsFirst: false })
      .limit(1),
    // Inventory aging buckets.
    supabase.from("report_inventory_aging").select("age_bucket"),
    // Reservations expiring (next 14d, or any reserved car for context).
    supabase
      .from("cars_display")
      .select("id, vin, brand, model, reservation_date, reserved_by")
      .eq("status", "reserved")
      .is("deleted_at", null)
      .not("reservation_date", "is", null)
      .order("reservation_date", { ascending: true })
      .limit(8),
    // New arrivals (last 7d).
    supabase
      .from("cars_display")
      .select("id, vin, brand, model, date_arrived")
      .gte("date_arrived", weekStart)
      .lte("date_arrived", today)
      .is("deleted_at", null)
      .order("date_arrived", { ascending: false })
      .limit(8),
    // Open cash session (closed_at IS NULL).
    supabase
      .from("cash_sessions")
      .select("id, opening_balance, opened_at, opened_by")
      .is("closed_at", null)
      .order("opened_at", { ascending: false })
      .limit(1),
    // Today's cash movements.
    supabase
      .from("cash_movements")
      .select("direction, amount, currency")
      .gte("created_at", todayStartIso)
      .lte("created_at", todayEndIso),
    // Pending refunds (requested but not approved/rejected/paid).
    supabase
      .from("refunds")
      .select("amount, currency, status")
      .eq("status", "requested")
      .is("deleted_at", null),
    // Aged receivables (overdue installments).
    supabase
      .from("report_aged_receivables")
      .select("amount_outstanding, days_overdue")
      .gt("days_overdue", 0),
    // Open garage jobs (not finished/cancelled).
    supabase
      .from("garage_jobs")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(finished,cancelled,delivered)")
      .is("deleted_at", null),
    // Open warranty cases.
    supabase
      .from("warranty_cases")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(closed,rejected,cancelled)"),
    // Cars added over the last 6 months: bucket by date_bought, falling back to
    // created_at when date_bought is null. The .or() covers both columns so the
    // fallback rows are not excluded by a date_bought-only filter.
    supabase
      .from("cars")
      .select("date_bought, created_at")
      .is("deleted_at", null)
      .or(
        `date_bought.gte.${carsWindowStartDate},and(date_bought.is.null,created_at.gte.${carsWindowStartIso})`
      )
      .limit(10000),
  ]);

  if (carsCountRes.error) errors.push(`Cars count: ${carsCountRes.error.message}`);
  if (carsRowsResult.error) errors.push(`Cars: ${carsRowsResult.error.message}`);
  if (tasksRes.error) errors.push(`Garage tasks: ${tasksRes.error.message}`);
  if (requestsRes.error) errors.push(`Requests: ${requestsRes.error.message}`);
  if (deletePendingCountRes.error) {
    errors.push(`Delete requests count: ${deletePendingCountRes.error.message}`);
  }
  if (requestsMgmtPendingCountRes.error) {
    errors.push(`Requests (mgmt queue) count: ${requestsMgmtPendingCountRes.error.message}`);
  }
  if (docAccessPendingCountRes.error) {
    errors.push(`Document access requests count: ${docAccessPendingCountRes.error.message}`);
  }
  if (pageAccessPendingCountRes.error) {
    errors.push(`Page access requests count: ${pageAccessPendingCountRes.error.message}`);
  }
  if (installmentsRes.error) errors.push(`Installments: ${installmentsRes.error.message}`);
  if (partsRes.error) errors.push(`Parts: ${partsRes.error.message}`);
  if (customersCountRes.error) errors.push(`Customers: ${customersCountRes.error.message}`);
  if (salesOrdersCountRes.error) errors.push(`Sales orders: ${salesOrdersCountRes.error.message}`);
  if (salesMTDRes.error) errors.push(`Sales MTD: ${salesMTDRes.error.message}`);
  if (salesLastMonthCountRes.error) errors.push(`Sales LM: ${salesLastMonthCountRes.error.message}`);
  if (salesByStageRes.error) errors.push(`Sales pipeline: ${salesByStageRes.error.message}`);
  if (topSalesRepRes.error) errors.push(`Top sales rep: ${topSalesRepRes.error.message}`);
  if (inventoryAgingRes.error) errors.push(`Inventory aging: ${inventoryAgingRes.error.message}`);
  if (reservationsExpiringRes.error) errors.push(`Reservations: ${reservationsExpiringRes.error.message}`);
  if (newArrivalsRes.error) errors.push(`New arrivals: ${newArrivalsRes.error.message}`);
  if (cashSessionRes.error) errors.push(`Cash session: ${cashSessionRes.error.message}`);
  if (todayCashRes.error) errors.push(`Today cash: ${todayCashRes.error.message}`);
  if (pendingRefundsRes.error) errors.push(`Pending refunds: ${pendingRefundsRes.error.message}`);
  if (agedReceivablesRes.error) errors.push(`Aged receivables: ${agedReceivablesRes.error.message}`);
  if (activeGarageJobsCountRes.error) {
    errors.push(`Active garage jobs: ${activeGarageJobsCountRes.error.message}`);
  }
  if (openWarrantyCountRes.error) {
    errors.push(`Open warranty cases: ${openWarrantyCountRes.error.message}`);
  }
  if (carsAddedRes.error) errors.push(`Cars added: ${carsAddedRes.error.message}`);

  const warrantyWindow = {
    start: startOfDay(now),
    end: startOfDay(addDays(now, 90)),
  };

  function expiryInWindow(iso: string | null | undefined): boolean {
    if (!iso || typeof iso !== "string") return false;
    const d = parseISO(iso.slice(0, 10));
    if (Number.isNaN(d.getTime())) return false;
    return isWithinInterval(d, warrantyWindow);
  }

  const statusCounts: Record<string, number> = {};
  let warrantiesExpiringSoon = 0;
  for (const r of carsRowsResult.rows) {
    const s = r.status;
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    if (expiryInWindow(r.warranty_vehicle_expiry) || expiryInWindow(r.warranty_battery_expiry)) {
      warrantiesExpiringSoon += 1;
    }
  }

  const totalCars =
    carsCountRes.count ??
    (carsRowsResult.error ? 0 : carsRowsResult.rows.length);

  const pendingQueueTotal =
    (deletePendingCountRes.count ?? 0) +
    (requestsMgmtPendingCountRes.count ?? 0) +
    (docAccessPendingCountRes.count ?? 0) +
    (pageAccessPendingCountRes.count ?? 0);

  /** All four lifecycle statuses (including zeros) — same source as totalCars / chart. */
  const carStatusChart = CAR_STATUS_EDITABLE.map((status) => ({
      name: CAR_STATUS_LABELS[status],
      count: statusCounts[status] ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const priorityCounts: Record<string, number> = { low: 0, normal: 0, urgent: 0 };
  for (const row of requestsRes.data ?? []) {
    const p = String((row as { priority: string | null }).priority ?? "normal");
    const key = p === "urgent" || p === "low" ? p : "normal";
    priorityCounts[key] = (priorityCounts[key] ?? 0) + 1;
  }

  const requestPriorityChart = PRIORITY_ORDER.map((p) => ({
    name: PRIORITY_LABELS[p],
    count: priorityCounts[p] ?? 0,
  }));

  type PlanEmbed = {
    cars: { brand: string; model: string } | { brand: string; model: string }[] | null;
    customers:
      | { first_name: string | null; last_name: string | null }
      | { first_name: string | null; last_name: string | null }[]
      | null;
  };

  const installmentsDueSoon = (installmentsRes.data ?? []).map((raw: unknown) => {
    const row = raw as {
      id: string;
      due_date: string;
      amount_due: number;
      installment_no: number;
      payment_plans: PlanEmbed | PlanEmbed[] | null;
    };
    const plan = Array.isArray(row.payment_plans)
      ? row.payment_plans[0]
      : row.payment_plans;
    const car = plan?.cars
      ? Array.isArray(plan.cars)
        ? plan.cars[0]
        : plan.cars
      : null;
    const cust = plan?.customers
      ? Array.isArray(plan.customers)
        ? plan.customers[0]
        : plan.customers
      : null;
    const carLabel = car ? [car.brand, car.model].filter(Boolean).join(" ") : "Car";
    const customerLabel = cust
      ? [cust.first_name, cust.last_name].filter(Boolean).join(" ") || "Customer"
      : "Customer";
    return {
      id: row.id,
      due_date: row.due_date,
      amount_due: row.amount_due,
      installment_no: row.installment_no,
      summary: `${customerLabel} · ${carLabel}`,
    };
  });

  const lowStockParts =
    (partsRes.data as {
      id: string;
      part_name: string;
      oe_number: string | null;
      quantity: number;
    }[]) ?? [];

  // ---- Phase 1: aggregate the new query results ----

  // Sales MTD: total units delivered this month.
  const salesMTDRows = (salesMTDRes.data ?? []) as { id: string }[];
  const salesMTD = {
    units: salesMTDRows.length,
    unitsLastMonth: salesLastMonthCountRes.count ?? 0,
  };

  // Sales by stage.
  const stageCounts: Record<string, number> = {};
  for (const row of salesByStageRes.data ?? []) {
    const s = String((row as { status: string }).status ?? "");
    if (!s) continue;
    stageCounts[s] = (stageCounts[s] ?? 0) + 1;
  }
  const salesByStage = SALE_STAGE_ORDER.map((s) => ({
    stage: s,
    label: SALE_STAGE_LABELS[s],
    count: stageCounts[s] ?? 0,
  }));

  // Top sales rep.
  const topRepRow = (topSalesRepRes.data ?? [])[0] as
    | {
        sales_rep_name: string | null;
        deals_in_pipeline: number | null;
        deals_delivered: number | null;
      }
    | undefined;
  const topSalesRep = topRepRow
    ? {
        name: topRepRow.sales_rep_name ?? "Unknown",
        dealsDelivered: Number(topRepRow.deals_delivered ?? 0),
        dealsInPipeline: Number(topRepRow.deals_in_pipeline ?? 0),
      }
    : null;

  // Inventory aging buckets.
  const agingCounts: Record<string, number> = {};
  for (const row of inventoryAgingRes.data ?? []) {
    const b = String((row as { age_bucket: string | null }).age_bucket ?? "");
    if (!b) continue;
    agingCounts[b] = (agingCounts[b] ?? 0) + 1;
  }
  const inventoryAging = INVENTORY_AGE_ORDER.map((bucket) => ({
    bucket,
    count: agingCounts[bucket] ?? 0,
  }));

  const reservationsExpiring = (reservationsExpiringRes.data ?? []).map((raw) => {
    const r = raw as {
      id: string;
      vin: string | null;
      brand: string | null;
      model: string | null;
      reservation_date: string | null;
      reserved_by: string | null;
    };
    return {
      id: r.id,
      vin: r.vin ?? "",
      brand: r.brand ?? "",
      model: r.model ?? "",
      reservation_date: r.reservation_date,
      reserved_by: r.reserved_by,
    };
  });

  const newArrivals = (newArrivalsRes.data ?? []).map((raw) => {
    const r = raw as {
      id: string;
      vin: string | null;
      brand: string | null;
      model: string | null;
      date_arrived: string | null;
    };
    return {
      id: r.id,
      vin: r.vin ?? "",
      brand: r.brand ?? "",
      model: r.model ?? "",
      date_arrived: r.date_arrived,
    };
  });

  // Cash drawer state.
  const cashSessionRow = (cashSessionRes.data ?? [])[0] as
    | {
        id: string;
        opening_balance: number | null;
        opened_at: string | null;
        opened_by: string | null;
      }
    | undefined;

  const todayCashRows = (todayCashRes.data ?? []) as {
    direction: string | null;
    amount: number | null;
    currency: string | null;
  }[];
  const todayCashIn: Record<string, number> = {};
  const todayCashOut: Record<string, number> = {};
  for (const m of todayCashRows) {
    const c = (m.currency ?? "USD").toUpperCase();
    const amt = Number(m.amount ?? 0);
    if (m.direction === "in") todayCashIn[c] = (todayCashIn[c] ?? 0) + amt;
    else if (m.direction === "out") todayCashOut[c] = (todayCashOut[c] ?? 0) + amt;
  }

  const cashState = {
    isOpen: !!cashSessionRow,
    openingBalance: Number(cashSessionRow?.opening_balance ?? 0),
    openedAt: cashSessionRow?.opened_at ?? null,
    openedBy: cashSessionRow?.opened_by ?? null,
    todayCashIn,
    todayCashOut,
  };

  // Pending refunds.
  const refundRows = (pendingRefundsRes.data ?? []) as {
    amount: number | null;
    currency: string | null;
    status: string | null;
  }[];
  const pendingRefundsByCurrency: Record<string, number> = {};
  for (const r of refundRows) {
    const c = (r.currency ?? "USD").toUpperCase();
    pendingRefundsByCurrency[c] = (pendingRefundsByCurrency[c] ?? 0) + Number(r.amount ?? 0);
  }
  const pendingRefunds = {
    count: refundRows.length,
    amountByCurrency: pendingRefundsByCurrency,
  };

  // Aged receivables.
  const receivableRows = (agedReceivablesRes.data ?? []) as {
    amount_outstanding: number | null;
    days_overdue: number | null;
  }[];
  let agedTotal = 0;
  let oldestDays = 0;
  for (const r of receivableRows) {
    agedTotal += Number(r.amount_outstanding ?? 0);
    const d = Number(r.days_overdue ?? 0);
    if (d > oldestDays) oldestDays = d;
  }
  const agedReceivables = {
    count: receivableRows.length,
    totalOutstanding: agedTotal,
    oldestDays,
  };

  // Cars added per month: bucket each car by the month of date_bought, falling
  // back to created_at when date_bought is null. Months outside the window stay 0.
  const carsAddedRows = (carsAddedRes.data ?? []) as {
    date_bought: string | null;
    created_at: string | null;
  }[];
  const carsAddedBuckets: { key: string; month: string; count: number }[] = [];
  const carsAddedIndex: Record<string, number> = {};
  for (let i = CARS_OVER_TIME_MONTHS - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const key = format(d, "yyyy-MM");
    carsAddedIndex[key] = carsAddedBuckets.length;
    carsAddedBuckets.push({ key, month: format(d, "MMM yyyy"), count: 0 });
  }
  for (const r of carsAddedRows) {
    const entry = r.date_bought ?? r.created_at;
    if (!entry || typeof entry !== "string") continue;
    const key = entry.slice(0, 7);
    const idx = carsAddedIndex[key];
    if (idx !== undefined) carsAddedBuckets[idx].count += 1;
  }
  const carsAddedPerMonth = carsAddedBuckets.map((b) => ({
    month: b.month,
    count: b.count,
  }));

  // inStockCars = same definition as Reports / report_inventory_aging
  // (every non-deleted car except sold + delivered). The view already
  // applies that filter, so the loaded rows ARE the in-stock fleet.
  const inStockCars = inventoryAgingRes.data?.length ?? 0;

  return {
    summary: {
      totalCars,
      inStockCars,
      totalCustomers: customersCountRes.count ?? 0,
      activeSalesOrders: salesOrdersCountRes.count ?? 0,
      pendingRequests: pendingQueueTotal,
      warrantiesExpiringSoon,
      activeGarageJobs: activeGarageJobsCountRes.count ?? 0,
      openWarrantyCases: openWarrantyCountRes.count ?? 0,
    },
    carStatusChart,
    carsAddedPerMonth,
    activeGarageTasks: tasksRes.count ?? 0,
    requestPriorityChart,
    installmentsDueSoon,
    lowStockParts,
    // Phase 1
    salesMTD,
    salesByStage,
    topSalesRep,
    inventoryAging,
    reservationsExpiring,
    newArrivals,
    cashState,
    pendingRefunds,
    agedReceivables,
    errors,
  };
}

export default async function OwnerOverviewPage() {
  const session = await getSessionUserAndRole();
  if (!session || session.appRole !== "owner") {
    redirect("/requests");
  }
  const data = await fetchOverviewData(session.supabase);
  return <OverviewDashboard data={data} />;
}
