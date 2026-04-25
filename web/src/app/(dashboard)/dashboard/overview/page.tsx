import { redirect } from "next/navigation";
import { addDays, format, isWithinInterval, parseISO, startOfDay } from "date-fns";
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
  const rows: CarOverviewRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("cars_display")
      .select("status, warranty_vehicle_expiry, warranty_battery_expiry")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, from + POSTGREST_PAGE - 1);
    if (error) return { rows: [], error };
    const batch = (data ?? []) as CarOverviewRow[];
    rows.push(...batch);
    if (batch.length < POSTGREST_PAGE) break;
    from += POSTGREST_PAGE;
  }
  return { rows, error: null };
}

async function fetchOverviewData(supabase: DashboardSupabase): Promise<OwnerOverviewData> {
  const errors: string[] = [];

  const today = format(new Date(), "yyyy-MM-dd");
  const weekEnd = format(addDays(new Date(), 7), "yyyy-MM-dd");

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

  const warrantyWindow = {
    start: startOfDay(new Date()),
    end: startOfDay(addDays(new Date(), 90)),
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

  return {
    summary: {
      totalCars,
      totalCustomers: customersCountRes.count ?? 0,
      activeSalesOrders: salesOrdersCountRes.count ?? 0,
      pendingRequests: pendingQueueTotal,
      warrantiesExpiringSoon,
    },
    carStatusChart,
    activeGarageTasks: tasksRes.count ?? 0,
    requestPriorityChart,
    installmentsDueSoon,
    lowStockParts,
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
