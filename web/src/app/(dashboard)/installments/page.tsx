"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type {
  Customer,
  Car,
  InstallmentPayment,
  PaymentPlan,
} from "@/types/database";
import { canPerform } from "@/lib/permissions";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";
import { createNotificationsForUsers } from "@/lib/notifications";
import { installmentDueDateIso } from "@/lib/installment-due-dates";
import {
  Plus,
  DollarSign,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  Inbox,
  Users,
  UserPlus,
} from "lucide-react";
import { LEAD_SOURCE_LABELS, LANGUAGE_LABELS } from "@/lib/constants/customers";
import { VinScanButton } from "@/components/scanner/VinScanButton";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

interface PlanWithRelations extends PaymentPlan {
  customer: Customer | null;
  car: Car | null;
  installments: InstallmentPayment[];
}

interface InstallmentWithRelations extends InstallmentPayment {
  plan: PlanWithRelations | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatVinShort(vin: string | null | undefined): string {
  const v = (vin ?? "").trim();
  if (!v) return "—";
  if (v.length <= 12) return v;
  return `…${v.slice(-8)}`;
}

function carLabelShort(car: Car | null | undefined): string {
  if (!car) return "—";
  return `${car.model ?? "—"} (${formatVinShort(car.vin)})`;
}

function carTitleAttr(car: Car | null | undefined): string | undefined {
  if (!car?.vin) return undefined;
  return `${car.model ?? ""} (${car.vin})`.trim();
}

export default function InstallmentsPage() {
  const supabase = createClient();
  const { appRole, profile, hasCapability } = useUser();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<InstallmentWithRelations[]>([]);
  const [plans, setPlans] = useState<PlanWithRelations[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});

  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentWithRelations | null>(null);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [receiptUrl, setReceiptUrl] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [markingPaid, setMarkingPaid] = useState(false);
  const [detailPlan, setDetailPlan] = useState<PlanWithRelations | null>(null);

  const isOwner = appRole === "owner";
  // Page access: assistants, sales_ops, and anyone with the cashier capability
  // can see the page. Owners always can.
  const canAccess =
    isOwner ||
    appRole === "assistant" ||
    appRole === "sales_ops" ||
    hasCapability("cashier");
  // mark-paid is now capability-gated (matches the DB-side check in
  // apply_installment_payment which requires is_owner OR has_capability('cashier')).
  // We keep canPerform() for the rest of the CRUD actions on installments.
  const canMarkPaid = isOwner || hasCapability("cashier");
  const canCreatePlan = canPerform("installments", "create", appRole);

  const [recoverPlanId, setRecoverPlanId] = useState<string | null>(null);
  const [recoverReason, setRecoverReason] = useState("");
  const [recovering, setRecovering] = useState(false);

  /** Owner-only recovery for plans that auto-flipped to 'defaulted'. */
  async function handleRecoverPlan() {
    if (!recoverPlanId) return;
    if (!recoverReason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    setRecovering(true);
    const { error } = await supabase.rpc("recover_payment_plan_from_default", {
      p_plan_id: recoverPlanId,
      p_reason: recoverReason.trim(),
    });
    setRecovering(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Plan returned to active.");
    setPlans((prev) =>
      prev.map((pp) => (pp.id === recoverPlanId ? { ...pp, status: "active" } : pp))
    );
    setRecoverPlanId(null);
    setRecoverReason("");
  }

  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [newPlanCustomerId, setNewPlanCustomerId] = useState("");
  const [newPlanCarId, setNewPlanCarId] = useState("");
  const [newPlanTotal, setNewPlanTotal] = useState("");
  const [newPlanDown, setNewPlanDown] = useState("");
  const [newPlanMonths, setNewPlanMonths] = useState("");
  const [newPlanMonthly, setNewPlanMonthly] = useState("");
  // Tracks whether the user typed the monthly amount themselves. While false,
  // the monthly amount is kept in sync with total/down/months so the plan
  // total can't silently disagree with the schedule.
  const [newPlanMonthlyEdited, setNewPlanMonthlyEdited] = useState(false);
  const [newPlanStartDate, setNewPlanStartDate] = useState("");
  const [newPlanDueDay, setNewPlanDueDay] = useState("");
  const [newPlanInterestRate, setNewPlanInterestRate] = useState("");
  const [newPlanDownPaymentMethod, setNewPlanDownPaymentMethod] = useState("cash");
  const [savingNewPlan, setSavingNewPlan] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [newPlanStep, setNewPlanStep] = useState<
    "choose" | "existingCustomer" | "existingCar" | "newCustomer" | "linkCar" | "planForm"
  >("choose");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCar, setSelectedCar] = useState<{
    id: string;
    model: string;
    vin: string;
    model_year: number | null;
    exterior_color: string | null;
  } | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [carSearch, setCarSearch] = useState("");
  const [customerCarOptions, setCustomerCarOptions] = useState<
    {
      carId: string;
      model: string;
      vin: string;
      modelYear: number | null;
      status: string;
      exterior_color: string | null;
      client_name?: string | null;
    }[]
  >([]);
  const [loadingCustomerCars, setLoadingCustomerCars] = useState(false);
  const [pendingCarSelection, setPendingCarSelection] = useState<{
    carId: string;
    model: string;
    vin: string;
    modelYear: number | null;
    exterior_color: string | null;
    hasPlan: boolean;
    clientName: string | null;
  } | null>(null);
  const [newCustSubmitting, setNewCustSubmitting] = useState(false);
  const [newCustFirstName, setNewCustFirstName] = useState("");
  const [newCustLastName, setNewCustLastName] = useState("");
  const [newCustPhonePrimary, setNewCustPhonePrimary] = useState("");
  const [newCustPhoneSecondary, setNewCustPhoneSecondary] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPreferredLanguage, setNewCustPreferredLanguage] = useState("en");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustDateOfBirth, setNewCustDateOfBirth] = useState("");
  const [newCustNotes, setNewCustNotes] = useState("");
  const [newCustLeadSource, setNewCustLeadSource] = useState<string>("");
  const [linkCarSearch, setLinkCarSearch] = useState("");
  const [linkCarLoading, setLinkCarLoading] = useState(false);
  const [linkCarResults, setLinkCarResults] = useState<Car[]>([]);

  useEffect(() => {
    // Status transitions (upcoming -> due, due -> overdue, plan -> defaulted) and
    // their notifications are now handled server-side by the
    // `advance-installment-statuses` pg_cron job (see migration 074).
    // The page just reads the latest data.

    async function loadData() {
      setLoading(true);

      const [
        { data: installmentsData },
        { data: plansData },
        { data: customersData },
        { data: carsData },
        { data: profilesData },
      ] = await Promise.all([
        supabase
          .from("installment_payments")
          .select(
            `
          *,
          plan:payment_plans(
            *,
            customer:customers(*),
            car:cars(*)
          )
        `
          )
          .limit(5000),
        supabase
          .from("payment_plans")
          .select(
            `
          *,
          customer:customers(*),
          car:cars(*),
          installments:installment_payments(*)
        `
          )
          .limit(5000),
        supabase.from("customers").select("*").order("first_name").limit(5000),
        supabase.from("cars").select("*").order("model").limit(5000),
        supabase.from("profiles").select("id, full_name"),
      ]);

      setInstallments((installmentsData as InstallmentWithRelations[]) || []);
      setPlans((plansData as PlanWithRelations[]) || []);
      setCustomers((customersData as Customer[]) || []);
      setCars((carsData as Car[]) || []);
      setProfileNames(
        Object.fromEntries(
          ((profilesData as { id: string; full_name: string | null }[]) ?? []).map(
            (p) => [p.id, p.full_name ?? "Unknown"]
          )
        )
      );
      setLoading(false);
    }

    loadData();
  }, [supabase]);

  const dueInstallments = useMemo(
    () =>
      installments
        .filter(
          (i) =>
            i.status === "due" ||
            i.status === "overdue" ||
            i.status === "partial"
        )
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [installments]
  );

  const upcomingInstallments = useMemo(
    () =>
      installments
        .filter((i) => i.status === "upcoming")
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [installments]
  );

  const paidInstallments = useMemo(
    () =>
      installments
        .filter((i) => i.status === "paid")
        .sort(
          (a, b) =>
            new Date(b.paid_at || b.updated_at).getTime() -
            new Date(a.paid_at || a.updated_at).getTime()
        ),
    [installments]
  );

  useEffect(() => {
    // Keep the monthly amount in sync with total/down/months until the user
    // overrides it manually. This recomputes when any input changes so the
    // plan total stays consistent with the generated schedule.
    if (newPlanMonthlyEdited) return;
    const total = parseFloat(newPlanTotal || "0");
    const down = parseFloat(newPlanDown || "0");
    const months = parseInt(newPlanMonths || "0", 10);
    if (total > 0 && months > 0 && down >= 0 && down <= total) {
      const base = (total - down) / months;
      if (!Number.isNaN(base) && base > 0) {
        const next = base.toFixed(2);
        setNewPlanMonthly((prev) => (prev === next ? prev : next));
      }
    }
  }, [newPlanTotal, newPlanDown, newPlanMonths, newPlanMonthlyEdited]);

  const overview = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    let totalDue = 0;
    let overdueCount = 0;
    let dueThisMonth = 0;
    let collectedThisMonth = 0;
    let activePlans = 0;

    installments.forEach((i) => {
      const due = new Date(i.due_date);
      if (i.status === "due" || i.status === "overdue") {
        totalDue += i.amount_due;
      }
      if (i.status === "overdue") {
        overdueCount += 1;
      }
      if (
        (i.status === "due" || i.status === "upcoming") &&
        due.getMonth() === month &&
        due.getFullYear() === year
      ) {
        dueThisMonth += 1;
      }
      if (i.status === "paid" && i.paid_at) {
        const paidAt = new Date(i.paid_at);
        if (paidAt.getMonth() === month && paidAt.getFullYear() === year) {
          collectedThisMonth += i.paid_amount || 0;
        }
      }
    });

    plans.forEach((p) => {
      if (p.status === "active") activePlans += 1;
    });

    return {
      totalDue,
      overdueCount,
      dueThisMonth,
      collectedThisMonth,
      activePlans,
    };
  }, [installments, plans]);

  function formatName(c: Customer) {
    return c.last_name ? `${c.first_name} ${c.last_name}` : c.first_name;
  }

  function daysLate(dueDate: string) {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = now.getTime() - due.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  const activePlanCarIds = useMemo(
    () =>
      new Set(
        plans
          .filter((p) => p.status === "active" && p.car_id)
          .map((p) => p.car_id as string)
      ),
    [plans]
  );

  // Auto-load initial cars when entering the link-car step with no search term/results yet.
  useEffect(() => {
    if (newPlanStep === "linkCar" && !linkCarSearch && linkCarResults.length === 0) {
      void searchCarsForLinking("");
    }
  }, [newPlanStep, linkCarSearch, linkCarResults.length]);

  function openNewPlan() {
    if (!canCreatePlan) return;
    setNewPlanOpen(true);
    setNewPlanStep("choose");
    setSelectedCustomer(null);
    setSelectedCar(null);
    setCustomerSearch("");
    setCarSearch("");
    setCustomerCarOptions([]);
    setNewPlanCustomerId("");
    setNewPlanCarId("");
    setNewPlanTotal("");
    setNewPlanDown("");
    setNewPlanMonths("");
    setNewPlanMonthly("");
    setNewPlanMonthlyEdited(false);
    setNewPlanStartDate("");
    setNewPlanDueDay("");
  }

  async function loadCustomerCars(customerId: string) {
    setLoadingCustomerCars(true);
    setCustomerCarOptions([]);
    const { data, error } = await supabase
      .from("sales_orders")
      .select(
        `
        id,
        car_id,
        cars:car_id (
          id,
          model,
          vin,
          model_year,
          exterior_color,
          status
        )
      `
      )
      .eq("customer_id", customerId)
      .not("status", "eq", "cancelled");

    setLoadingCustomerCars(false);
    if (error || !data) {
      setCustomerCarOptions([]);
      return;
    }

    const options: {
      carId: string;
      model: string;
      vin: string;
      modelYear: number | null;
      status: string;
      exterior_color: string | null;
    }[] = [];

    type CarJoinRow = {
      cars: {
        id?: string;
        model?: string;
        vin?: string;
        model_year?: number | null;
        exterior_color?: string | null;
        status?: string;
        client_name?: string | null;
      } | null;
    };
    ((data ?? []) as unknown as CarJoinRow[]).forEach((row) => {
      const car = row.cars;
      if (!car?.id) return;
      if (
        !["sold", "inventory", "available", "reserved"].includes(
          (car.status ?? "") as string
        )
      )
        return;
      const option: {
        carId: string;
        model: string;
        vin: string;
        modelYear: number | null;
        status: string;
        exterior_color: string | null;
        client_name?: string | null;
      } = {
        carId: car.id,
        model: car.model ?? "",
        vin: car.vin ?? "",
        modelYear: car.model_year ?? null,
        status: car.status ?? "",
        exterior_color: car.exterior_color ?? null,
      };
      if (typeof car.client_name !== "undefined") {
        option.client_name = car.client_name ?? null;
      }
      options.push(option);
    });

    setCustomerCarOptions(options);
  }

  async function searchCarsForLinking(term: string) {
    setLinkCarSearch(term);
    setLinkCarLoading(true);

    const trimmed = term.trim();

    let query = supabase
      .from("cars")
      .select(
        "id, vin, brand, model, model_year, exterior_color, interior_color, status"
      )
      .in("status", ["inventory", "available", "reserved", "sold"])
      .order("model_year", { ascending: false })
      .limit(20);

    if (trimmed) {
      query = query.or(
        `vin.ilike.%${trimmed}%,model.ilike.%${trimmed}%,brand.ilike.%${trimmed}%`
      );
    }

    const { data, error } = await query;

    setLinkCarLoading(false);
    if (error || !data) {
      setLinkCarResults([]);
      return;
    }
    setLinkCarResults(data as Car[]);
  }

  const schedulePreview = useMemo(() => {
    const totalNum = parseFloat(newPlanTotal || "0");
    const downNum = parseFloat(newPlanDown || "0");
    const monthsNum = parseInt(newPlanMonths || "0", 10);
    const monthlyNum = parseFloat(newPlanMonthly || "0");
    const dueDayNum = parseInt(newPlanDueDay || "0", 10);
    if (
      !newPlanStartDate ||
      !(totalNum > 0) ||
      !(monthsNum > 0) ||
      !(monthlyNum > 0) ||
      dueDayNum < 1 ||
      dueDayNum > 31
    ) {
      return { summary: null as string | null, rows: [] as { no: number; date: string; amount: number }[] };
    }
    const remaining = totalNum - downNum;
    const summary = `Total Amount: ${currencyFormatter.format(
      totalNum
    )} | Down Payment: ${currencyFormatter.format(
      downNum
    )} | Remaining: ${currencyFormatter.format(
      remaining
    )} | Monthly: ${currencyFormatter.format(monthlyNum)} x ${monthsNum} months`;

    const rows: { no: number; date: string; amount: number }[] = [];
    const startYmd = newPlanStartDate;
    for (let i = 0; i < monthsNum; i += 1) {
      const ymd = installmentDueDateIso(startYmd, i, dueDayNum);
      rows.push({
        no: i + 1,
        date: format(new Date(`${ymd}T12:00:00`), "dd/MM/yyyy"),
        amount: monthlyNum,
      });
    }
    return { summary, rows };
  }, [newPlanTotal, newPlanDown, newPlanMonths, newPlanMonthly, newPlanStartDate, newPlanDueDay]);


  function onOpenMarkPaid(inst: InstallmentWithRelations) {
    if (!canMarkPaid) return;
    setSelectedInstallment(inst);
    setPaidAmount(inst.amount_due.toString());
    setPaymentMethod("cash");
    setReceiptUrl("");
    setNote("");
    setMarkPaidOpen(true);
  }

  async function handleMarkPaid() {
    if (!selectedInstallment) return;
    if (!canMarkPaid) {
      toast.error("You do not have permission to mark payments as paid.");
      return;
    }
    const amount = Number(paidAmount);
    if (!amount || amount <= 0) {
      toast.error("Amount paid must be greater than 0.");
      return;
    }
    if (!paymentMethod) {
      toast.error("Payment method is required.");
      return;
    }

    setMarkingPaid(true);

    // The RPC enforces overpayment → customer_credits and underpayment → 'partial'
    // status with an owner notification. It also handles plan completion server-side.
    const { data, error } = await supabase.rpc("apply_installment_payment", {
      p_installment_id: selectedInstallment.id,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_receipt_url: receiptUrl || null,
      p_note: note || null,
    });

    if (error) {
      setMarkingPaid(false);
      toast.error(formatError(error));
      return;
    }

    const result = (data ?? {}) as {
      new_status?: string;
      overage_to_credits?: number;
      shortfall?: number;
    };
    const overage = Number(result.overage_to_credits ?? 0);
    const shortfall = Number(result.shortfall ?? 0);

    if (result.new_status === "paid" && overage > 0) {
      toast.success(
        `Installment paid · ${overage.toLocaleString("en-US", { maximumFractionDigits: 2 })} credited to customer.`
      );
    } else if (result.new_status === "partial") {
      toast.warning(
        `Partial payment recorded · ${shortfall.toLocaleString("en-US", { maximumFractionDigits: 2 })} still owed. Owner notified.`
      );
    } else {
      toast.success("Installment marked as paid");
    }

    setMarkingPaid(false);
    setMarkPaidOpen(false);
    setSelectedInstallment(null);

    // Refetch installments AND plans — the payment RPC can complete a plan
    // server-side, so the Plans tab status/progress must be refreshed too.
    const [{ data: refreshed }, { data: refreshedPlans }] = await Promise.all([
      supabase
        .from("installment_payments")
        .select(
          `
        *,
        plan:payment_plans(
          *,
          customer:customers(*),
          car:cars(*)
        )
      `
        ),
      supabase
        .from("payment_plans")
        .select(
          `
        *,
        customer:customers(*),
        car:cars(*),
        installments:installment_payments(*)
      `
        ),
    ]);
    setInstallments((refreshed as InstallmentWithRelations[]) || []);
    if (refreshedPlans) {
      setPlans(refreshedPlans as PlanWithRelations[]);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading installments...</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8">
        <h1 className="text-xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground text-center">
          You do not have permission to view installments.
        </p>
      </div>
    );
  }

  const defaultTab = searchParams.get("tab") ?? "due";

  const dueColumns: ExportColumn[] = [
    { key: "customer_name", header: "Customer" },
    { key: "customer_phone", header: "Phone" },
    { key: "car_label", header: "Car" },
    { key: "installment_label", header: "Installment" },
    { key: "due_date", header: "Due Date", type: "date" },
    { key: "amount_due", header: "Amount Due", type: "currency" },
    { key: "status", header: "Status" },
    { key: "days_late", header: "Days Late" },
  ];

  const mapDueForExport = (rows: InstallmentWithRelations[]) =>
    rows.map((i) => {
      const customer = i.plan?.customer as Customer | null;
      const car = i.plan?.car as Car | null;
      return {
        customer_name: customer ? formatName(customer) : "Customer",
        customer_phone: customer?.phone_primary ?? "",
        car_label: car ? `${car.model} (${car.vin})` : "—",
        installment_label: `#${i.installment_no} of ${i.plan?.months ?? ""}`,
        due_date: i.due_date,
        amount_due: i.amount_due,
        status: i.status,
        days_late: i.status === "overdue" ? daysLate(i.due_date) : 0,
      };
    });

  const upcomingColumns: ExportColumn[] = [
    { key: "customer_name", header: "Customer" },
    { key: "customer_phone", header: "Phone" },
    { key: "car_label", header: "Car" },
    { key: "installment_label", header: "Installment" },
    { key: "due_date", header: "Due Date", type: "date" },
    { key: "amount_due", header: "Amount", type: "currency" },
  ];

  const mapUpcomingForExport = (rows: InstallmentWithRelations[]) =>
    rows.map((i) => {
      const customer = i.plan?.customer as Customer | null;
      const car = i.plan?.car as Car | null;
      return {
        customer_name: customer ? formatName(customer) : "Customer",
        customer_phone: customer?.phone_primary ?? "",
        car_label: car ? `${car.model} (${car.vin})` : "—",
        installment_label: `#${i.installment_no} of ${i.plan?.months ?? ""}`,
        due_date: i.due_date,
        amount_due: i.amount_due,
      };
    });

  const paidColumns: ExportColumn[] = [
    { key: "customer_name", header: "Customer" },
    { key: "car_label", header: "Car" },
    { key: "installment_label", header: "Installment" },
    { key: "due_date", header: "Due Date", type: "date" },
    { key: "paid_date", header: "Paid Date", type: "date" },
    { key: "amount_paid", header: "Amount Paid", type: "currency" },
    { key: "payment_method", header: "Payment Method" },
  ];

  const mapPaidForExport = (rows: InstallmentWithRelations[]) =>
    rows.map((i) => {
      const customer = i.plan?.customer as Customer | null;
      const car = i.plan?.car as Car | null;
      return {
        customer_name: customer ? formatName(customer) : "Customer",
        car_label: car ? `${car.model} (${car.vin})` : "—",
        installment_label: `#${i.installment_no} of ${i.plan?.months ?? ""}`,
        due_date: i.due_date,
        paid_date: i.paid_at,
        amount_paid: i.paid_amount ?? 0,
        payment_method: i.payment_method ?? "",
      };
    });

  const plansColumns: ExportColumn[] = [
    { key: "customer_name", header: "Customer" },
    { key: "car_label", header: "Car" },
    { key: "status", header: "Status" },
    { key: "total_amount", header: "Total Amount", type: "currency" },
    { key: "down_payment", header: "Down Payment", type: "currency" },
    { key: "monthly_amount", header: "Monthly Amount", type: "currency" },
    { key: "months", header: "Months" },
    { key: "paid_count", header: "Paid Installments" },
    { key: "total_count", header: "Total Installments" },
    { key: "start_date", header: "Start Date", type: "date" },
    { key: "due_day", header: "Due Day" },
  ];

  const mapPlansForExport = (rows: PlanWithRelations[]) =>
    rows.map((p) => {
      const paidCount = p.installments.filter((i) => i.status === "paid").length;
      const totalCount = p.installments.length;
      return {
        customer_name: p.customer ? formatName(p.customer) : "Customer",
        car_label: p.car ? `${p.car.model} (${p.car.vin})` : "—",
        status: p.status,
        total_amount: p.total_amount,
        down_payment: p.down_payment,
        monthly_amount: p.monthly_amount,
        months: p.months,
        paid_count: paidCount,
        total_count: totalCount,
        start_date: p.start_date,
        due_day: p.due_day,
      };
    });

  const dueCount = dueInstallments.length;
  const upcomingCount = upcomingInstallments.length;
  const paidCount = paidInstallments.length;
  const plansCount = plans.length;
  const hasOverdue = overview.overdueCount > 0;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Installments</h1>
          <p className="text-muted-foreground">
            Track due, upcoming, and paid installments and manage payment plans.
          </p>
        </div>
        {canCreatePlan && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" onClick={openNewPlan} data-tour-id="installments-new-plan-button">
              <Plus className="mr-2 size-4" />
              New Plan
            </Button>
          </div>
        )}
      </div>

      <div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card
          className={`flex flex-col justify-between rounded-lg border bg-card p-6 ${
            hasOverdue
              ? "border-l-4 border-l-red-500"
              : dueCount > 0
                ? "border-l-4 border-l-amber-400"
                : "border-l-4 border-l-slate-500"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0">
            <div className="flex items-center gap-2">
              <DollarSign className="size-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Due
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="mt-3 p-0">
            <div className="text-2xl font-bold">
              {currencyFormatter.format(overview.totalDue || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between rounded-lg border border-l-4 border-l-red-500 bg-card p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Overdue Count
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="mt-3 p-0">
            <div className="text-2xl font-bold text-red-600">
              {overview.overdueCount}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between rounded-lg border border-l-4 border-l-amber-400 bg-card p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Due This Month
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="mt-3 p-0">
            <div className="text-2xl font-bold text-amber-600">
              {overview.dueThisMonth}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between rounded-lg border border-l-4 border-l-emerald-500 bg-card p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Collected This Month
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="mt-3 p-0">
            <div className="text-2xl font-bold text-green-600">
              {currencyFormatter.format(overview.collectedThisMonth || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between rounded-lg border border-l-4 border-l-slate-500 bg-card p-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Active Plans
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="mt-3 p-0">
            <div className="text-2xl font-bold">
              {overview.activePlans}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="inline-flex h-auto gap-2 border-b-0 bg-transparent p-0" data-tour-id="installments-tabs">
            <TabsTrigger
              value="due"
              className="relative rounded-none border-b-[3px] border-transparent px-3 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-amber-500 data-[state=active]:text-foreground outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <span>Due</span>
              <Badge
                variant="secondary"
                className={`ml-2 h-5 px-2 text-xs font-semibold ${
                  hasOverdue
                    ? "bg-red-500 text-white"
                    : dueCount > 0
                      ? "bg-amber-500 text-black"
                      : ""
                }`}
              >
                {dueCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="upcoming"
              className="relative rounded-none border-b-[3px] border-transparent px-3 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-amber-500 data-[state=active]:text-foreground outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <span>Upcoming</span>
              <Badge
                variant="secondary"
                className="ml-2 h-5 px-2 text-xs font-semibold"
              >
                {upcomingCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="paid"
              className="relative rounded-none border-b-[3px] border-transparent px-3 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-amber-500 data-[state=active]:text-foreground outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <span>Paid</span>
              <Badge
                variant="secondary"
                className={`ml-2 h-5 px-2 text-xs font-semibold ${
                  paidCount > 0 ? "bg-emerald-500 text-white" : ""
                }`}
              >
                {paidCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="plans"
              className="relative rounded-none border-b-[3px] border-transparent px-3 py-2 text-sm font-medium text-muted-foreground data-[state=active]:border-amber-500 data-[state=active]:text-foreground outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              <span>Plans</span>
              <Badge
                variant="secondary"
                className="ml-2 h-5 px-2 text-xs font-semibold"
              >
                {plansCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="due" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Due / Overdue Installments</h2>
            <ExportButton
              filename="installments-due"
              columns={dueColumns}
              data={mapDueForExport(dueInstallments)}
              allData={mapDueForExport(dueInstallments)}
            />
          </div>
          <>
            <div className="space-y-3 pb-6 md:hidden">
              {dueInstallments.map((i) => {
                const isOverdue = i.status === "overdue";
                const customer = i.plan?.customer as Customer | null | undefined;
                const car = i.plan?.car as Car | null | undefined;
                const borderClass = isOverdue
                  ? "border-l-4 border-red-500 bg-red-50/80 dark:bg-red-950/20"
                  : "border-l-4 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20";
                return (
                  <div
                    key={i.id}
                    className={`rounded-xl border border-border/50 p-4 shadow-sm ${borderClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {customer ? formatName(customer) : "Customer"}
                        </p>
                        {customer?.phone_primary && (
                          <a
                            href={`tel:${customer.phone_primary.replace(/\s/g, "")}`}
                            className="mt-1 block text-sm text-primary hover:underline"
                          >
                            {customer.phone_primary}
                          </a>
                        )}
                        <p
                          className="mt-1 text-sm text-muted-foreground"
                          title={carTitleAttr(car ?? null)}
                        >
                          {carLabelShort(car ?? null)}
                        </p>
                      </div>
                      <Badge
                        className={
                          isOverdue
                            ? "shrink-0 bg-red-100 text-red-800"
                            : "shrink-0 bg-amber-100 text-amber-800"
                        }
                      >
                        {isOverdue ? "Overdue" : "Due"}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1 border-t border-border/50 pt-3 text-sm">
                      <p>
                        <span className="text-muted-foreground">Installment:</span>{" "}
                        #{i.installment_no} of {i.plan?.months ?? ""}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Due:</span>{" "}
                        {format(new Date(i.due_date), "dd/MM/yyyy")}
                      </p>
                      <p className="font-medium">
                        {currencyFormatter.format(i.amount_due)}
                      </p>
                      {isOverdue && (
                        <p className="text-destructive">
                          {daysLate(i.due_date)} days late
                        </p>
                      )}
                    </div>
                    {canMarkPaid && (
                      <Button
                        className="mt-3 w-full touch-manipulation"
                        size="sm"
                        onClick={() => onOpenMarkPaid(i)}
                      >
                        Mark Paid
                      </Button>
                    )}
                  </div>
                );
              })}
              {dueInstallments.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mb-2 size-6" />
                  <p className="font-medium">No due or overdue installments</p>
                  <p className="text-xs">All payments are up to date.</p>
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
              <Table className="min-w-[920px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Car</TableHead>
                    <TableHead>Installment</TableHead>
                    <TableHead className="text-center">Due Date</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Days Late</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dueInstallments.map((i) => {
                    const isOverdue = i.status === "overdue";
                    const rowClass = isOverdue
                      ? "border-l-4 border-red-400 bg-red-50 odd:bg-red-50"
                      : "border-l-4 border-amber-300 odd:bg-slate-50";
                    return (
                      <TableRow
                        key={i.id}
                        className={`${rowClass} hover:bg-slate-100`}
                      >
                        <TableCell className="font-medium">
                          {i.plan?.customer
                            ? formatName(i.plan.customer as Customer)
                            : "Customer"}
                        </TableCell>
                        <TableCell>
                          {i.plan?.customer
                            ? (i.plan.customer as Customer).phone_primary
                            : ""}
                        </TableCell>
                        <TableCell>
                          {i.plan?.car
                            ? `${(i.plan.car as Car).model} (${(i.plan.car as Car).vin})`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          #{i.installment_no} of {i.plan?.months ?? ""}
                        </TableCell>
                        <TableCell className="text-center">
                          {format(new Date(i.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {currencyFormatter.format(i.amount_due)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              isOverdue
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {isOverdue ? "Overdue" : "Due"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {isOverdue ? daysLate(i.due_date) : 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {canMarkPaid && (
                            <Button size="sm" onClick={() => onOpenMarkPaid(i)} data-tour-id="installments-due-row-mark-paid">
                              Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {dueInstallments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10">
                        <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                          <CheckCircle2 className="mb-2 size-6" />
                          <p className="font-medium">No due or overdue installments</p>
                          <p className="text-xs">
                            All payments are up to date.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Upcoming Installments</h2>
            <ExportButton
              filename="installments-upcoming"
              columns={upcomingColumns}
              data={mapUpcomingForExport(upcomingInstallments)}
              allData={mapUpcomingForExport(upcomingInstallments)}
            />
          </div>
          <>
            <div className="space-y-3 pb-6 md:hidden">
              {upcomingInstallments.map((i) => {
                const customer = i.plan?.customer as Customer | null | undefined;
                const car = i.plan?.car as Car | null | undefined;
                return (
                  <div
                    key={i.id}
                    className="rounded-xl border border-border/50 bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {customer ? formatName(customer) : "Customer"}
                        </p>
                        {customer?.phone_primary && (
                          <a
                            href={`tel:${customer.phone_primary.replace(/\s/g, "")}`}
                            className="mt-1 block text-sm text-primary hover:underline"
                          >
                            {customer.phone_primary}
                          </a>
                        )}
                        <p
                          className="mt-1 text-sm text-muted-foreground"
                          title={carTitleAttr(car ?? null)}
                        >
                          {carLabelShort(car ?? null)}
                        </p>
                      </div>
                      <Badge className="shrink-0 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                        Upcoming
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1 border-t border-border/50 pt-3 text-sm">
                      <p>
                        #{i.installment_no} of {i.plan?.months ?? ""} · Due{" "}
                        {format(new Date(i.due_date), "dd/MM/yyyy")}
                      </p>
                      <p className="font-medium">
                        {currencyFormatter.format(i.amount_due)}
                      </p>
                    </div>
                    {canMarkPaid && (
                      <Button
                        className="mt-3 w-full touch-manipulation"
                        size="sm"
                        onClick={() => onOpenMarkPaid(i)}
                      >
                        Mark Paid
                      </Button>
                    )}
                  </div>
                );
              })}
              {upcomingInstallments.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  <Inbox className="mb-2 size-6" />
                  <p className="font-medium">No upcoming installments</p>
                  <p className="text-xs">There are no future payments scheduled.</p>
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
              <Table className="min-w-[800px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Car</TableHead>
                    <TableHead>Installment</TableHead>
                    <TableHead className="text-center">Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingInstallments.map((i) => (
                    <TableRow
                      key={i.id}
                      className="odd:bg-slate-50 hover:bg-slate-100"
                    >
                      <TableCell className="font-medium">
                        {i.plan?.customer
                          ? formatName(i.plan.customer as Customer)
                          : "Customer"}
                      </TableCell>
                      <TableCell>
                        {i.plan?.customer
                          ? (i.plan.customer as Customer).phone_primary
                          : ""}
                      </TableCell>
                      <TableCell>
                        {i.plan?.car
                          ? `${(i.plan.car as Car).model} (${(i.plan.car as Car).vin})`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        #{i.installment_no} of {i.plan?.months ?? ""}
                      </TableCell>
                      <TableCell className="text-center">
                        {format(new Date(i.due_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {currencyFormatter.format(i.amount_due)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-slate-100 text-slate-800">
                          Upcoming
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canMarkPaid && (
                          <Button size="sm" onClick={() => onOpenMarkPaid(i)}>
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {upcomingInstallments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10">
                        <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                          <Inbox className="mb-2 size-6" />
                          <p className="font-medium">No upcoming installments</p>
                          <p className="text-xs">
                            There are no future payments scheduled.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        </TabsContent>

        <TabsContent value="paid" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Paid Installments</h2>
            <ExportButton
              filename="installments-paid"
              columns={paidColumns}
              data={mapPaidForExport(paidInstallments)}
              allData={mapPaidForExport(paidInstallments)}
            />
          </div>
          <>
            <div className="space-y-3 pb-6 md:hidden">
              {paidInstallments.map((i) => {
                const customer = i.plan?.customer as Customer | null | undefined;
                const car = i.plan?.car as Car | null | undefined;
                return (
                  <div
                    key={i.id}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-50/80 p-4 shadow-sm dark:bg-emerald-950/20"
                  >
                    <p className="font-semibold">
                      {customer ? formatName(customer) : "Customer"}
                    </p>
                    <p
                      className="mt-1 text-sm text-muted-foreground"
                      title={carTitleAttr(car ?? null)}
                    >
                      {carLabelShort(car ?? null)}
                    </p>
                    <div className="mt-3 space-y-1 border-t border-border/50 pt-3 text-sm">
                      <p>
                        #{i.installment_no} of {i.plan?.months ?? ""}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Due:</span>{" "}
                        {format(new Date(i.due_date), "dd/MM/yyyy")}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Paid:</span>{" "}
                        {i.paid_at
                          ? format(new Date(i.paid_at), "dd/MM/yyyy")
                          : "—"}
                      </p>
                      <p className="font-medium text-emerald-800 dark:text-emerald-300">
                        {currencyFormatter.format(i.paid_amount || 0)}
                      </p>
                      <p className="text-muted-foreground">
                        {i.payment_method || "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
              {paidInstallments.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  <Inbox className="mb-2 size-6" />
                  <p className="font-medium">No paid installments yet</p>
                  <p className="text-xs">
                    Payments will appear here after they are recorded.
                  </p>
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
              <Table className="min-w-[880px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Car</TableHead>
                    <TableHead>Installment</TableHead>
                    <TableHead className="text-center">Due Date</TableHead>
                    <TableHead className="text-center">Paid Date</TableHead>
                    <TableHead className="text-right">Amount Paid</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Marked By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidInstallments.map((i) => (
                    <TableRow
                      key={i.id}
                      className="bg-emerald-50 odd:bg-emerald-50 hover:bg-emerald-100"
                    >
                      <TableCell className="font-medium">
                        {i.plan?.customer
                          ? formatName(i.plan.customer as Customer)
                          : "Customer"}
                      </TableCell>
                      <TableCell>
                        {i.plan?.car
                          ? `${(i.plan.car as Car).model} (${(i.plan.car as Car).vin})`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        #{i.installment_no} of {i.plan?.months ?? ""}
                      </TableCell>
                      <TableCell className="text-center">
                        {format(new Date(i.due_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-center">
                        {i.paid_at ? format(new Date(i.paid_at), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {currencyFormatter.format(i.paid_amount || 0)}
                      </TableCell>
                      <TableCell>{i.payment_method || "—"}</TableCell>
                      <TableCell>
                        {i.marked_paid_by
                          ? profileNames[i.marked_paid_by] ?? "Unknown"
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {paidInstallments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10">
                        <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                          <Inbox className="mb-2 size-6" />
                          <p className="font-medium">No paid installments yet</p>
                          <p className="text-xs">
                            Payments will appear here after they are recorded.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Payment Plans</h2>
            <div className="flex items-center gap-2">
              <ExportButton
                filename="payment-plans"
                columns={plansColumns}
                data={mapPlansForExport(plans)}
                allData={mapPlansForExport(plans)}
              />
              {canCreatePlan && (
                <Button size="sm" onClick={openNewPlan}>
                  <Plus className="mr-2 size-4" />
                  New Plan
                </Button>
              )}
            </div>
          </div>
          <>
            <div className="space-y-3 pb-6 md:hidden">
              {plans.map((p) => {
                const paidCount = p.installments.filter((i) => i.status === "paid").length;
                const totalCount = p.installments.length;
                const pct = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

                let badgeColor = "bg-emerald-100 text-emerald-800";
                if (p.status === "completed") badgeColor = "bg-blue-100 text-blue-800";
                if (p.status === "defaulted") badgeColor = "bg-red-100 text-red-800";
                if (p.status === "cancelled") badgeColor = "bg-slate-100 text-slate-800";

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-border/50 bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {p.customer ? formatName(p.customer) : "Customer"}
                        </p>
                        <p
                          className="mt-1 text-sm text-muted-foreground"
                          title={carTitleAttr(p.car ?? null)}
                        >
                          {carLabelShort(p.car ?? null)}
                        </p>
                      </div>
                      <Badge className={`shrink-0 ${badgeColor}`}>{p.status}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-medium">
                          {currencyFormatter.format(p.total_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly</p>
                        <p className="font-medium">
                          {currencyFormatter.format(p.monthly_amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Down</p>
                        <p>{currencyFormatter.format(p.down_payment)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Months</p>
                        <p>{p.months}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {paidCount} of {totalCount} paid
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Start {format(new Date(p.start_date), "dd/MM/yyyy")} · Due day{" "}
                      {p.due_day}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full touch-manipulation"
                      onClick={() => setDetailPlan(p)}
                    >
                      View Details
                    </Button>
                    {p.status === "defaulted" && isOwner && (
                      <Button
                        variant="default"
                        size="sm"
                        className="mt-2 w-full touch-manipulation"
                        onClick={() => {
                          setRecoverPlanId(p.id);
                          setRecoverReason("");
                        }}
                      >
                        Recover from default…
                      </Button>
                    )}
                  </div>
                );
              })}
              {plans.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  <Inbox className="mb-2 size-6" />
                  <p className="font-medium">No payment plans yet</p>
                  <p className="text-xs">Create a payment plan to get started.</p>
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
              <Table className="min-w-[1000px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Car</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Down Payment</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead className="text-center">Months</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-center">Start Date</TableHead>
                    <TableHead className="text-center">Due Day</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((p) => {
                    const paidCount = p.installments.filter((i) => i.status === "paid").length;
                    const totalCount = p.installments.length;
                    const pct = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

                    let badgeColor = "bg-emerald-100 text-emerald-800";
                    if (p.status === "completed") badgeColor = "bg-blue-100 text-blue-800";
                    if (p.status === "defaulted") badgeColor = "bg-red-100 text-red-800";
                    if (p.status === "cancelled") badgeColor = "bg-slate-100 text-slate-800";

                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.customer ? formatName(p.customer) : "Customer"}
                        </TableCell>
                        <TableCell>
                          {p.car ? `${p.car.model} (${p.car.vin})` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={badgeColor}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {currencyFormatter.format(p.total_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {currencyFormatter.format(p.down_payment)}
                        </TableCell>
                        <TableCell className="text-right">
                          {currencyFormatter.format(p.monthly_amount)}
                        </TableCell>
                        <TableCell className="text-center">{p.months}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-xs">
                              {paidCount} of {totalCount} paid
                            </div>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {format(new Date(p.start_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-center">{p.due_day}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailPlan(p)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {plans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="py-10">
                        <div className="flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
                          <Inbox className="mb-2 size-6" />
                          <p className="font-medium">No payment plans yet</p>
                          <p className="text-xs">
                            Create a payment plan to get started.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        </TabsContent>
      </Tabs>

      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent className="max-w-xl bg-background p-6 sm:p-8" data-tour-id="installments-mark-paid-dialog">
          <DialogHeader>
            <DialogTitle>Mark Installment as Paid</DialogTitle>
          </DialogHeader>
          {selectedInstallment && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">
                    {selectedInstallment.plan?.customer
                      ? formatName(selectedInstallment.plan.customer as Customer)
                      : "Customer"}
                  </span>{" "}
                  ·{" "}
                  {selectedInstallment.plan?.car
                    ? `${(selectedInstallment.plan.car as Car).model} (${(
                        selectedInstallment.plan.car as Car
                      ).vin})`
                    : "No car linked"}
                </div>
                <div>
                  Installment #{selectedInstallment.installment_no} of{" "}
                  {selectedInstallment.plan?.months ?? ""} · Due{" "}
                  {format(new Date(selectedInstallment.due_date), "dd/MM/yyyy")}
                </div>
                <div>
                  Amount due:{" "}
                  {currencyFormatter.format(selectedInstallment.amount_due)}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid-amount">Amount Paid</Label>
                <Input
                  id="paid-amount"
                  type="number" inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  data-tour-id="installments-mark-paid-amount-input"
                />
                {(() => {
                  const amt = Number(paidAmount);
                  if (!amt || !selectedInstallment) return null;
                  const remaining =
                    selectedInstallment.amount_due -
                    (selectedInstallment.paid_amount ?? 0);
                  if (amt > remaining) {
                    const overage = amt - remaining;
                    return (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Overpaid by{" "}
                        {currencyFormatter.format(overage)} — the extra will be
                        credited to the customer&apos;s account.
                      </p>
                    );
                  }
                  if (amt < remaining) {
                    return (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Short by {currencyFormatter.format(remaining - amt)} —
                        installment will be marked &ldquo;partial&rdquo; and the
                        owner will be notified. Customer can complete it later.
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-muted-foreground">
                      Exact match — installment will be marked paid.
                    </p>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                >
                  <SelectTrigger id="payment-method" data-tour-id="installments-mark-paid-method-select">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receipt-url">Receipt URL</Label>
                <Input
                  id="receipt-url"
                  value={receiptUrl}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                  placeholder="Link to receipt or uploaded file"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setMarkPaidOpen(false)}
                  data-tour-id="installments-mark-paid-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleMarkPaid}
                  disabled={markingPaid}
                  data-tour-id="installments-mark-paid-confirm"
                >
                  {markingPaid ? "Saving..." : "Confirm Paid"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={newPlanOpen}
        onOpenChange={(open) => {
          setNewPlanOpen(open);
          if (open) {
            openNewPlan();
          }
        }}
      >
        <DialogContent className="max-w-2xl bg-background" data-tour-id="installments-new-plan-dialog">
          <DialogHeader>
            <DialogTitle>New Payment Plan</DialogTitle>
          </DialogHeader>
          {/* Step indicator — the dialog walks through 3 stages:
              pick/add customer → pick car → fill plan details. */}
          <div className="-mt-2 flex items-center gap-2 text-xs text-muted-foreground" aria-label="Progress">
            <span
              className={cn(
                "rounded-full px-2 py-0.5",
                (newPlanStep === "choose" ||
                  newPlanStep === "existingCustomer" ||
                  newPlanStep === "newCustomer") &&
                  "bg-amber-100 text-amber-800 font-medium dark:bg-amber-900/40 dark:text-amber-200"
              )}
            >
              1. Customer
            </span>
            <span aria-hidden>→</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5",
                newPlanStep === "linkCar" &&
                  "bg-amber-100 text-amber-800 font-medium dark:bg-amber-900/40 dark:text-amber-200"
              )}
            >
              2. Car
            </span>
            <span aria-hidden>→</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5",
                newPlanStep === "planForm" &&
                  "bg-amber-100 text-amber-800 font-medium dark:bg-amber-900/40 dark:text-amber-200"
              )}
            >
              3. Plan
            </span>
          </div>
          <div className="space-y-4">
            {newPlanStep === "choose" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  How would you like to create this payment plan?
                </p>
                <div className="grid gap-4 sm:grid-cols-2 items-stretch">
                  <Button
                    variant="outline"
                    className="flex h-full min-h-[150px] w-full flex-col items-start gap-4 rounded-lg border bg-card p-6 text-left hover:border-amber-500 hover:bg-muted/60 focus-visible:outline-none"
                    onClick={() => setNewPlanStep("existingCustomer")}
                  >
                    <Users className="mb-2 size-6 text-muted-foreground" />
                    <span className="font-medium">Existing Customer</span>
                    <span className="text-xs text-muted-foreground break-words whitespace-normal">
                      Search existing customers, pick a sold car, then create the plan.
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex h-full min-h-[150px] w-full flex-col items-start gap-4 rounded-lg border bg-card p-6 text-left hover:border-amber-500 hover:bg-muted/60 focus-visible:outline-none"
                    onClick={() => setNewPlanStep("newCustomer")}
                  >
                    <UserPlus className="mb-2 size-6 text-muted-foreground" />
                    <span className="font-medium">New Customer</span>
                    <span className="text-xs text-muted-foreground break-words whitespace-normal">
                      Add a new customer, optionally link a car, then create the plan.
                    </span>
                  </Button>
                </div>
              </div>
            )}

            {newPlanStep === "existingCustomer" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Step 1 of 3 — Select Customer</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewPlanStep("choose")}
                    >
                      Back
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewPlanOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                <Input
                  placeholder="Search customers by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  {customers
                    .filter((c) => {
                      if (!customerSearch.trim()) return true;
                      const q = customerSearch.toLowerCase();
                      const name = formatName(c).toLowerCase();
                      const phone = (c.phone_primary ?? "").toLowerCase();
                      return name.includes(q) || phone.includes(q);
                    })
                    .map((c) => {
                      const carCount = plans.filter((p) => p.customer_id === c.id).length;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setNewPlanCustomerId(c.id);
                            void loadCustomerCars(c.id);
                            setNewPlanStep("existingCar");
                          }}
                        >
                          <div>
                            <div className="font-medium">{formatName(c)}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.phone_primary}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Cars with plans: {carCount}
                          </div>
                        </button>
                      );
                    })}
                  {customers.length === 0 && (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      No customers found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {newPlanStep === "existingCar" && selectedCustomer && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Step 2 of 3 — Select Car</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewPlanStep("existingCustomer")}
                    >
                      Back
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewPlanOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border bg-muted p-3 text-sm">
                  <div className="font-medium">{formatName(selectedCustomer)}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedCustomer.phone_primary}
                  </div>
                </div>
                {loadingCustomerCars ? (
                  <p className="text-sm text-muted-foreground">Loading cars...</p>
                ) : customerCarOptions.length === 0 ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                      All cars for this customer already have payment plans or no sold cars
                      were found.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNewPlanStep("existingCustomer")}
                      >
                        Back
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCar(null);
                          setNewPlanCarId("");
                          setNewPlanStep("planForm");
                        }}
                      >
                        Skip car linking
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="max-h-64 overflow-y-auto rounded-md border">
                      {customerCarOptions.map((car) => (
                        <button
                          key={car.carId}
                          type="button"
                          className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            const hasPlan = activePlanCarIds.has(car.carId);
                            if (hasPlan || car.client_name) {
                              setPendingCarSelection({
                                carId: car.carId,
                                model: car.model,
                                vin: car.vin,
                                modelYear: car.modelYear,
                                exterior_color: car.exterior_color,
                                hasPlan,
                                clientName: car.client_name ?? null,
                              });
                              return;
                            }
                            setSelectedCar({
                              id: car.carId,
                              model: car.model,
                              vin: car.vin,
                              model_year: car.modelYear,
                              exterior_color: car.exterior_color,
                            });
                            setNewPlanCarId(car.carId);
                            setNewPlanStep("planForm");
                          }}
                        >
                          <div>
                            <div className="font-medium">
                              {car.model} ({car.vin})
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {car.modelYear ? `Year: ${car.modelYear} · ` : ""}
                              {car.exterior_color || ""}
                            </div>
                            {car.client_name && (
                              <div className="text-xs text-amber-700">
                                Current client: {car.client_name}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Status: {car.status}
                          </div>
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCar(null);
                        setNewPlanCarId("");
                        setNewPlanStep("planForm");
                      }}
                    >
                      Skip car linking
                    </Button>
                  </>
                )}
              </div>
            )}

            {newPlanStep === "newCustomer" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Step 1 of 3 — New Customer</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewPlanStep("choose")}
                    >
                      Back
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewPlanOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input
                      value={newCustFirstName}
                      onChange={(e) => setNewCustFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input
                      value={newCustLastName}
                      onChange={(e) => setNewCustLastName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input
                      value={newCustPhonePrimary}
                      onChange={(e) => setNewCustPhonePrimary(e.target.value)}
                      type="tel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone 2</Label>
                    <Input
                      value={newCustPhoneSecondary}
                      onChange={(e) => setNewCustPhoneSecondary(e.target.value)}
                      type="tel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={newCustEmail}
                      onChange={(e) => setNewCustEmail(e.target.value)}
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred Language</Label>
                    <Select
                      value={newCustPreferredLanguage}
                      onValueChange={setNewCustPreferredLanguage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input
                      value={newCustDateOfBirth}
                      onChange={(e) => setNewCustDateOfBirth(e.target.value)}
                      type="date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Source</Label>
                    <Select
                      value={newCustLeadSource || "_"}
                      onValueChange={(v) =>
                        setNewCustLeadSource(v === "_" ? "" : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_">—</SelectItem>
                        {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newCustNotes}
                    onChange={(e) => setNewCustNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewPlanOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={newCustSubmitting}
                    onClick={async () => {
                      if (!newCustFirstName.trim() || !newCustLastName.trim()) {
                        toast.error("First and last name are required.");
                        return;
                      }
                      if (!newCustPhonePrimary.trim()) {
                        toast.error("Phone is required.");
                        return;
                      }
                      const emailTrimmed = newCustEmail.trim();
                      if (
                        emailTrimmed &&
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)
                      ) {
                        toast.error("Please enter a valid email address.");
                        return;
                      }
                      setNewCustSubmitting(true);
                      const {
                        data: { user },
                      } = await supabase.auth.getUser();
                      const { data, error } = await supabase
                        .from("customers")
                        .insert({
                          first_name: newCustFirstName.trim(),
                          last_name: newCustLastName.trim() || null,
                          phone_primary: newCustPhonePrimary.trim(),
                          phone_secondary:
                            newCustPhoneSecondary.trim() || null,
                          email: emailTrimmed || null,
                          date_of_birth: newCustDateOfBirth || null,
                          preferred_language:
                            newCustPreferredLanguage || "en",
                          // Stays "interested" until the plan row is actually
                          // created — converted is set after create_payment_plan.
                          lead_status: "interested",
                          lead_source: newCustLeadSource || null,
                          address: newCustAddress.trim() || null,
                          notes: newCustNotes.trim() || null,
                          created_by: user?.id ?? null,
                        })
                        .select("*")
                        .single();
                      setNewCustSubmitting(false);
                      if (error || !data) {
                        const isDuplicate =
                          error?.code === "23505" ||
                          (error?.message ?? "")
                            .toLowerCase()
                            .includes("duplicate") ||
                          (error?.message ?? "")
                            .toLowerCase()
                            .includes("unique");
                        toast.error(
                          isDuplicate
                            ? "A customer with these details already exists."
                            : `Failed to create customer: ${error?.message ?? "Unknown error"}`
                        );
                        return;
                      }
                      setSelectedCustomer(data as Customer);
                      setNewPlanCustomerId(data.id as string);
                      setNewPlanStep("linkCar");
                    }}
                  >
                    {newCustSubmitting ? "Creating..." : "Create Customer"}
                  </Button>
                </div>
              </div>
            )}

            {newPlanStep === "linkCar" && selectedCustomer && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Step 2 of 3 — Link to Existing Car (optional)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNewPlanStep("newCustomer")}
                    >
                      Back
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewPlanOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border bg-muted p-3 text-sm">
                  <div className="font-medium">{formatName(selectedCustomer)}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedCustomer.phone_primary}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      placeholder="Search sold cars by VIN or model..."
                      value={linkCarSearch}
                      onChange={(e) => void searchCarsForLinking(e.target.value)}
                      className="flex-1"
                    />
                    <VinScanButton onScan={(vin) => void searchCarsForLinking(vin)} />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCar(null);
                      setNewPlanCarId("");
                      setNewPlanStep("planForm");
                    }}
                  >
                    Skip car linking
                  </Button>
                </div>
                {linkCarLoading ? (
                  <p className="text-sm text-muted-foreground">Searching cars...</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-md border">
                    {linkCarResults.map((car) => (
                      <button
                        key={car.id}
                        type="button"
                        className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setSelectedCar({
                            id: car.id,
                            model: car.model,
                            vin: car.vin,
                            model_year: car.model_year,
                            exterior_color: car.exterior_color,
                          });
                          setNewPlanCarId(car.id);
                          setNewPlanStep("planForm");
                        }}
                      >
                        <div>
                          <div className="font-medium">
                            {car.model} ({car.vin})
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {car.model_year ? `Year: ${car.model_year} · ` : ""}
                            {car.exterior_color || ""}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Status: {car.status}
                        </div>
                      </button>
                    ))}
                    {linkCarResults.length === 0 && !linkCarLoading && (
                      <div className="px-3 py-4 text-sm text-muted-foreground">
                        No cars found. Adjust your search or skip linking.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {newPlanStep === "planForm" && selectedCustomer && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Step 3 of 3 — Payment Plan Details
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedCar || newPlanCarId) {
                          setNewPlanStep(
                            selectedCustomer && plans.some((p) => p.customer_id === selectedCustomer.id)
                              ? "existingCar"
                              : "linkCar"
                          );
                        } else if (newPlanCustomerId && !selectedCar) {
                          setNewPlanStep("linkCar");
                        } else {
                          setNewPlanStep("choose");
                        }
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNewPlanOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 rounded-md border bg-muted p-3 text-sm">
                  <div className="font-medium">{formatName(selectedCustomer)}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedCustomer.phone_primary}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Car:{" "}
                    {selectedCar
                      ? `${selectedCar.model} (${selectedCar.vin})`
                      : "Not linked"}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Total Amount *</Label>
                    <Input
                      value={newPlanTotal}
                      onChange={(e) => setNewPlanTotal(e.target.value)}
                      type="number" inputMode="decimal"
                      min={0}
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Down Payment</Label>
                    <Input
                      value={newPlanDown}
                      onChange={(e) => setNewPlanDown(e.target.value)}
                      type="number" inputMode="decimal"
                      min={0}
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Down Payment Method</Label>
                    <Select
                      value={newPlanDownPaymentMethod}
                      onValueChange={setNewPlanDownPaymentMethod}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Months *</Label>
                    <Input
                      value={newPlanMonths}
                      onChange={(e) => setNewPlanMonths(e.target.value)}
                      type="number" inputMode="decimal"
                      min={1}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Amount *</Label>
                    <Input
                      value={newPlanMonthly}
                      onChange={(e) => {
                        setNewPlanMonthly(e.target.value);
                        setNewPlanMonthlyEdited(true);
                      }}
                      type="number" inputMode="decimal"
                      min={0}
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <Input
                      value={newPlanStartDate}
                      onChange={(e) => setNewPlanStartDate(e.target.value)}
                      type="date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Day (1–31) *</Label>
                    <Input
                      value={newPlanDueDay}
                      onChange={(e) => setNewPlanDueDay(e.target.value)}
                      type="number" inputMode="decimal"
                      min={1}
                      max={31}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Late interest rate (% optional)</Label>
                    <Input
                      value={newPlanInterestRate}
                      onChange={(e) => setNewPlanInterestRate(e.target.value)}
                      type="number" inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
                {schedulePreview.summary && (
                  <div className="space-y-2 rounded-md border p-3 text-sm">
                    <p className="font-medium">Payment Plan Summary</p>
                    <p className="text-xs text-muted-foreground">
                      {schedulePreview.summary}
                    </p>
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schedulePreview.rows.map((row) => (
                            <TableRow key={row.no}>
                              <TableCell>{row.no}</TableCell>
                              <TableCell>{row.date}</TableCell>
                              <TableCell>
                                {currencyFormatter.format(row.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewPlanOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingNewPlan}
                    onClick={async () => {
                      if (!canCreatePlan) {
                        toast.error("You do not have permission to create plans.");
                        return;
                      }
                      if (!newPlanCustomerId) {
                        toast.error("Customer is required.");
                        return;
                      }
                      const totalNum = Number(newPlanTotal);
                      const downNum = Number(newPlanDown || "0");
                      const monthsNum = Number(newPlanMonths);
                      const monthlyNum = Number(newPlanMonthly);
                      const dueDayNum = Number(newPlanDueDay);

                      if (!(totalNum > 0)) {
                        toast.error("Total amount must be greater than 0.");
                        return;
                      }
                      if (downNum < 0 || downNum > totalNum) {
                        toast.error(
                          "Down payment must be between 0 and total amount."
                        );
                        return;
                      }
                      if (!(monthsNum > 0)) {
                        toast.error("Number of months must be greater than 0.");
                        return;
                      }
                      if (!(monthlyNum > 0)) {
                        toast.error("Monthly amount must be greater than 0.");
                        return;
                      }
                      const expectedMonthly = (totalNum - downNum) / monthsNum;
                      if (Math.abs(expectedMonthly - monthlyNum) > 0.02) {
                        toast.error(
                          `Monthly amount is inconsistent: (total − down) ÷ months = ${currencyFormatter.format(
                            expectedMonthly
                          )}, but monthly is ${currencyFormatter.format(monthlyNum)}.`
                        );
                        return;
                      }
                      if (!newPlanStartDate) {
                        toast.error("Start date is required.");
                        return;
                      }
                      if (dueDayNum < 1 || dueDayNum > 31) {
                        toast.error("Due day must be between 1 and 31.");
                        return;
                      }

                      setSavingNewPlan(true);

                      const { data: authData } = await supabase.auth.getUser();
                      const creatorId = authData?.user?.id || profile?.id || null;
                      const interestPct = newPlanInterestRate.trim()
                        ? Number(newPlanInterestRate)
                        : 0;
                      const interestRate =
                        Number.isFinite(interestPct) && interestPct >= 0 ? interestPct : 0;

                      // C-9: build the monthly due-date array client-side so the
                      // server doesn't need to re-implement the day-clamp logic.
                      const dueDates: string[] = [];
                      for (let i = 0; i < monthsNum; i += 1) {
                        dueDates.push(installmentDueDateIso(newPlanStartDate, i, dueDayNum));
                      }

                      // Single RPC: creates plan + installments + applies the
                      // down payment via apply_installment_payment so the cash
                      // trigger / credits ledger / audit all fire correctly.
                      const { data: rpcData, error: planError } = await supabase.rpc(
                        "create_payment_plan",
                        {
                          p_customer_id: newPlanCustomerId,
                          p_car_id: newPlanCarId || null,
                          p_total_amount: totalNum,
                          p_down_payment: downNum,
                          p_monthly_amount: monthlyNum,
                          p_months: monthsNum,
                          p_start_date: newPlanStartDate,
                          p_due_day: dueDayNum,
                          p_due_dates: dueDates,
                          p_interest_rate: interestRate,
                          p_down_payment_method: downNum > 0 ? newPlanDownPaymentMethod : null,
                          p_down_payment_note: null,
                        }
                      );

                      if (planError) {
                        setSavingNewPlan(false);
                        toast.error(`Failed to create plan: ${formatError(planError)}`);
                        return;
                      }

                      const planData = { id: (rpcData as { plan_id?: string } | null)?.plan_id ?? "" };
                      if (!planData.id) {
                        setSavingNewPlan(false);
                        toast.error("Plan created but server returned no id");
                        return;
                      }

                      const customer =
                        selectedCustomer && selectedCustomer.id === newPlanCustomerId
                          ? selectedCustomer
                          : null;
                      const customerName = customer
                        ? formatName(customer)
                        : "Customer";
                      const carLabel = selectedCar
                        ? `${selectedCar.model} (${selectedCar.vin})`
                        : "No car linked";

                      // Link car and sales order if we have both customer and car.
                      if (customer && newPlanCarId) {
                        // Read the car's current state so we can (a) decide
                        // whether the status transition to 'sold' is safe and
                        // (b) seed the auto-created sales_order with real
                        // price/currency instead of the financed total + USD.
                        const { data: carRow } = await supabase
                          .from("cars")
                          .select("status, price, price_currency")
                          .eq("id", newPlanCarId)
                          .maybeSingle();

                        // Only flip to 'sold' from a pre-sale state. Don't
                        // clobber delivered / service / recalled / etc.
                        const carStatus = (carRow?.status ?? null) as string | null;
                        const transitionable =
                          carStatus !== null &&
                          ["available", "inventory", "reserved"].includes(carStatus);
                        if (transitionable) {
                          await supabase
                            .from("cars")
                            .update({ status: "sold", sold_marker: "X" })
                            .eq("id", newPlanCarId);
                        }

                        const { data: existingSale } = await supabase
                          .from("sales_orders")
                          .select("id")
                          .eq("car_id", newPlanCarId)
                          .eq("customer_id", newPlanCustomerId)
                          .not("status", "eq", "cancelled")
                          .limit(1)
                          .maybeSingle();

                        if (!existingSale) {
                          // 'draft' (not 'confirmed') so the sales-order detail
                          // page surfaces the incomplete lifecycle and reports
                          // don't count this as a finalized sale yet.
                          // selling_price/currency come from the car (the actual
                          // cash price) rather than the plan's financed total.
                          await supabase.from("sales_orders").insert({
                            car_id: newPlanCarId,
                            customer_id: newPlanCustomerId,
                            status: "draft",
                            selling_price:
                              (carRow?.price as number | null | undefined) ?? totalNum,
                            currency:
                              (carRow?.price_currency as string | null | undefined) ?? "USD",
                            created_by: creatorId,
                            notes:
                              "Auto-created from installment plan. Complete quote / deposit / contract lifecycle.",
                          });
                        }
                      }

                      // Ensure customer status is converted
                      if (newPlanCustomerId) {
                        await supabase
                          .from("customers")
                          .update({ lead_status: "converted" })
                          .eq("id", newPlanCustomerId);
                      }

                      const { data: owners } = await supabase
                        .from("profiles")
                        .select("id")
                        .eq("user_role", "owner");

                      if (owners && owners.length > 0) {
                        const ownerIds = owners.map((o) => o.id as string);
                        await createNotificationsForUsers(
                          ownerIds,
                          "New payment plan created",
                          `New payment plan created for ${customerName} — ${carLabel} — ${currencyFormatter.format(
                            totalNum
                          )}`,
                          "/installments"
                        );
                      }

                      toast.success(
                        `Payment plan created for ${customerName} — ${carLabel}`
                      );
                      setSavingNewPlan(false);
                      setNewPlanOpen(false);

                      const [
                        { data: refreshedInstallments },
                        { data: refreshedPlans },
                      ] = await Promise.all([
                        supabase
                          .from("installment_payments")
                          .select(
                            `
                            *,
                            plan:payment_plans(
                              *,
                              customer:customers(*),
                              car:cars(*)
                            )
                          `
                          ),
                        supabase
                          .from("payment_plans")
                          .select(
                            `
                            *,
                            customer:customers(*),
                            car:cars(*),
                            installments:installment_payments(*)
                          `
                          ),
                      ]);

                      setInstallments(
                        (refreshedInstallments as InstallmentWithRelations[]) || []
                      );
                      setPlans((refreshedPlans as PlanWithRelations[]) || []);
                    }}
                  >
                    {savingNewPlan ? "Creating..." : "Create Plan"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={recoverPlanId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRecoverPlanId(null);
            setRecoverReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recover plan from default</DialogTitle>
            <DialogDescription>
              Marking this plan as active again. Why? (linked renegotiation,
              partial payment received, or any context the owner should see in
              the audit log).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="recover-reason">Reason *</Label>
            <Textarea
              id="recover-reason"
              value={recoverReason}
              onChange={(e) => setRecoverReason(e.target.value)}
              rows={4}
              placeholder="e.g. Customer paid arrears in cash on May 6, plan renegotiated to 36 months."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRecoverPlanId(null);
                setRecoverReason("");
              }}
              disabled={recovering}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleRecoverPlan()}
              disabled={recovering || !recoverReason.trim()}
            >
              {recovering ? "Recovering…" : "Recover plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingCarSelection !== null}
        onOpenChange={(open) => !open && setPendingCarSelection(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm car selection</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {pendingCarSelection?.hasPlan && (
                  <p>
                    This car already has an active payment plan. Continuing will
                    create a <strong>second</strong> plan against the same car.
                  </p>
                )}
                {pendingCarSelection?.clientName && (
                  <p>
                    This car is currently linked to{" "}
                    <strong>{pendingCarSelection.clientName}</strong>. Selecting it
                    will reassign it to the current customer.
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  Vehicle: {pendingCarSelection?.model} ({pendingCarSelection?.vin})
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingCarSelection) return;
                setSelectedCar({
                  id: pendingCarSelection.carId,
                  model: pendingCarSelection.model,
                  vin: pendingCarSelection.vin,
                  model_year: pendingCarSelection.modelYear,
                  exterior_color: pendingCarSelection.exterior_color,
                });
                setNewPlanCarId(pendingCarSelection.carId);
                setNewPlanStep("planForm");
                setPendingCarSelection(null);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={detailPlan !== null}
        onOpenChange={(o) => !o && setDetailPlan(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Payment plan —{" "}
              {detailPlan?.customer ? formatName(detailPlan.customer) : "Customer"}
            </DialogTitle>
            <DialogDescription>
              {detailPlan?.car
                ? `${detailPlan.car.model} (${detailPlan.car.vin})`
                : "No car linked"}
            </DialogDescription>
          </DialogHeader>
          {detailPlan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium">
                    {currencyFormatter.format(detailPlan.total_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Down payment</p>
                  <p className="font-medium">
                    {currencyFormatter.format(detailPlan.down_payment)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly</p>
                  <p className="font-medium">
                    {currencyFormatter.format(detailPlan.monthly_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Months</p>
                  <p className="font-medium">{detailPlan.months}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{detailPlan.status}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Start date</p>
                  <p className="font-medium">
                    {format(new Date(detailPlan.start_date), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due day</p>
                  <p className="font-medium">{detailPlan.due_day}</p>
                </div>
              </div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...detailPlan.installments]
                      .sort((a, b) => a.installment_no - b.installment_no)
                      .map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>#{i.installment_no}</TableCell>
                          <TableCell>
                            {format(new Date(i.due_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {currencyFormatter.format(i.amount_due)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                i.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : i.status === "overdue"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                              }
                            >
                              {i.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {i.paid_amount != null
                              ? `${currencyFormatter.format(i.paid_amount)}${
                                  i.paid_at
                                    ? ` · ${format(new Date(i.paid_at), "dd/MM/yyyy")}`
                                    : ""
                                }`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    {detailPlan.installments.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-6 text-center text-muted-foreground"
                        >
                          No installments on this plan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
