"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  Car,
  FileText,
  Users,
  AlertTriangle,
  Shield,
  Calendar,
  CreditCard,
  Activity,
  ExternalLink,
  Pencil,
  Wrench,
  Package,
  Cpu,
  ClipboardList,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUser } from "@/lib/contexts/UserContext";
import { USER_ROLE_LABELS } from "@/lib/constants/user";
import {
  DATA_HEALTH_SECTIONS_BY_ROLE,
  ROLES_WITH_DATA_HEALTH_ACCESS,
  type DataHealthSectionId,
  LATEST_SOFTWARE_VERSION_BY_MODEL,
  getSectionsInDisplayOrder,
  SECTION_LABELS,
} from "@/lib/data-health-config";
import { toast } from "sonner";
import { VinScanButton } from "@/components/scanner/VinScanButton";
import { formatError } from "@/lib/error-messages";

type CarRow = {
  id: string;
  vin: string | null;
  brand: string;
  model: string;
  created_at?: string | null;
  updated_at?: string | null;
  model_year: number | null;
  status: string;
  exterior_color: string | null;
  interior_color: string | null;
  engine_number: string | null;
  location_type: string | null;
  location_slot: string | null;
  warranty_vehicle_expiry: string | null;
  warranty_battery_expiry: string | null;
  warranty_vehicle_dms: string | null;
  battery_percent: number | null;
  date_arrived: string | null;
  reservation_date: string | null;
  reserved_by: string | null;
  delivery_date: string | null;
  deleted_at: string | null;
  software_version?: string | null;
  software_update?: string | null;
  dongle?: string | null;
  issue?: string | null;
};

type GarageJobRow = {
  id: string;
  car_id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  diagnosis: string | null;
  work_done: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PartRow = {
  id: string;
  part_name: string;
  oe_number: string | null;
  deleted_at: string | null;
};

type RequestRow = {
  id: string;
  subject: string;
  category: string | null;
  status: string;
  description: string | null;
  assigned_to: string | null;
};

type SalesOrderRow = {
  id: string;
  car_id: string | null;
  customer_id: string | null;
  selling_price: number | null;
  currency: string | null;
  sale_date: string | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type CustomerRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_primary: string | null;
  email: string | null;
  address: string | null;
  deleted_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type InstallmentRow = { due_date: string | null; status?: string };
type PaymentPlanRow = {
  id: string;
  customer_id: string;
  car_id: string | null;
  status: string;
  total_amount: number;
  installments?: InstallmentRow[];
};

function empty(val: unknown): boolean {
  if (val == null) return true;
  if (typeof val === "string") return val.trim() === "";
  return false;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

const PLACEHOLDER_PATTERNS = /^(0000|0001|n\/a|na|—|-|\.\.\.|xxx|test|placeholder)$/i;
function isPlaceholderValue(val: string): boolean {
  const t = val.trim();
  return PLACEHOLDER_PATTERNS.test(t) || /^0+$/.test(t);
}

function matchesSearch(
  search: string,
  text: string | null | undefined,
  ...rest: (string | null | undefined)[]
): boolean {
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  const parts = [text, ...rest].filter(Boolean).map((s) => String(s).toLowerCase());
  return parts.some((p) => p.includes(q));
}

function QuickFixCustomerPhone({ customerId, onSaved }: { customerId: string; onSaved: () => void }) {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  async function handleSave() {
    const trimmed = phone.trim();
    if (!trimmed) return;
    if (isPlaceholderValue(trimmed)) {
      toast.error("Please enter a valid phone number, not a placeholder (e.g. 0000, N/A)");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("customers").update({ phone_primary: trimmed, updated_at: new Date().toISOString() }).eq("id", customerId);
    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${formatError(error)}`);
    } else {
      toast.success("Phone saved");
      onSaved();
    }
  }
  return (
    <div className="flex gap-2">
      <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 w-32" />
      <Button size="sm" onClick={handleSave} disabled={saving || !phone.trim()}>
        {saving ? "…" : "Save"}
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/customers/${customerId}`}>
          <ExternalLink className="size-3" />
        </Link>
      </Button>
    </div>
  );
}

function QuickFixJobDiagnosis({ jobId, onSaved }: { jobId: string; onSaved: () => void }) {
  const [diagnosis, setDiagnosis] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  async function handleSave() {
    const trimmed = diagnosis.trim();
    if (!trimmed) return;
    if (isPlaceholderValue(trimmed)) {
      toast.error("Please enter a valid diagnosis, not a placeholder (e.g. N/A, —)");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("garage_jobs").update({ diagnosis: trimmed, updated_at: new Date().toISOString() }).eq("id", jobId);
    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${formatError(error)}`);
    } else {
      toast.success("Diagnosis saved");
      onSaved();
    }
  }
  return (
    <div className="flex gap-2">
      <Input placeholder="Add diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="h-8 min-w-[140px]" />
      <Button size="sm" onClick={handleSave} disabled={saving || !diagnosis.trim()}>
        {saving ? "…" : "Save"}
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/garage/jobs/${jobId}`}>
          <ExternalLink className="size-3" />
        </Link>
      </Button>
    </div>
  );
}

function QuickFixReservedBy({ carId, onSaved }: { carId: string; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isPlaceholderValue(trimmed)) {
      toast.error("Please enter a valid name, not a placeholder (e.g. N/A, —)");
      return;
    }
    setSaving(true);
    // reserved_by lives on sales_orders (the latest non-cancelled order for this car), not on
    // public.cars. Update the most recent matching order.
    const { data: latestOrder, error: lookupErr } = await supabase
      .from("sales_orders")
      .select("id")
      .eq("car_id", carId)
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lookupErr || !latestOrder) {
      setSaving(false);
      toast.error(
        lookupErr
          ? `Failed to save: ${formatError(lookupErr)}`
          : "No active sales order — open the car page and link a customer first."
      );
      return;
    }
    const { error } = await supabase
      .from("sales_orders")
      .update({ reserved_by: trimmed, updated_at: new Date().toISOString() })
      .eq("id", latestOrder.id);
    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${formatError(error)}`);
    } else {
      toast.success("Reserved by saved");
      onSaved();
    }
  }
  return (
    <div className="flex gap-2">
      <Input placeholder="Reserved by" value={name} onChange={(e) => setName(e.target.value)} className="h-8 min-w-[120px]" />
      <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
        {saving ? "…" : "Save"}
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/cars/${carId}`}>
          <ExternalLink className="size-3" />
        </Link>
      </Button>
    </div>
  );
}

function SectionCard({
  title,
  description,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  count: number;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-5 text-amber-500" />
          {title}
          <Badge variant="secondary">{count} issues</Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function DataHealthPage() {
  const { appRole, profile } = useUser();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlanRow[]>([]);
  const [garageJobs, setGarageJobs] = useState<GarageJobRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning">("all");
  const [openIssuesOnly, setOpenIssuesOnly] = useState(false);

  const hasAccess = appRole && ROLES_WITH_DATA_HEALTH_ACCESS.includes(appRole);
  const visibleSections = (appRole && DATA_HEALTH_SECTIONS_BY_ROLE[appRole]) ?? [];
  const showSection = (id: DataHealthSectionId) => visibleSections.includes(id);
  const isOwner = appRole === "owner";
  const roleLabel = appRole && USER_ROLE_LABELS[appRole] ? USER_ROLE_LABELS[appRole] : appRole ?? "Unknown";

  useEffect(() => {
    if (!hasAccess) return;

    async function fetch() {
      setLoading(true);
      const carSelect = "id, vin, brand, model, model_year, status, exterior_color, interior_color, engine_number, location_type, location_slot, warranty_vehicle_expiry, warranty_battery_expiry, warranty_vehicle_dms, battery_percent, date_arrived, reservation_date, reserved_by, delivery_date, deleted_at, software_version, software_update, dongle, issue, created_at, updated_at";

      let jobsQuery = supabase.from("garage_jobs").select("id, car_id, title, status, assigned_to, notes, diagnosis, work_done, created_at, updated_at").is("deleted_at", null);
      if (appRole === "garage_staff" && profile?.id) {
        jobsQuery = jobsQuery.eq("assigned_to", profile.id);
      }

      let reqQuery = supabase.from("requests").select("id, subject, category, status, description, assigned_to");
      if (appRole === "hybrid" && profile?.id) {
        reqQuery = reqQuery.eq("assigned_to", profile.id);
      }

      const [
        carsRes,
        soRes,
        custRes,
        plansRes,
        jobsRes,
        partsRes,
        reqRes,
      ] = await Promise.all([
        supabase.from("cars_display").select(carSelect).is("deleted_at", null).limit(10000),
        supabase
          .from("sales_orders")
          .select(
            "id, car_id, customer_id, selling_price, currency, sale_date, date_bought, delivery_date, reservation_date, status, created_at, updated_at"
          )
          .not("status", "eq", "cancelled")
          .limit(10000),
        supabase.from("customers").select("id, first_name, last_name, phone_primary, email, address, deleted_at, created_at, updated_at").is("deleted_at", null).limit(10000),
        supabase.from("payment_plans").select("id, customer_id, car_id, status, total_amount, installments:installment_payments(due_date, status)").limit(10000),
        jobsQuery.limit(10000),
        supabase.from("parts").select("id, part_name, oe_number, deleted_at").is("deleted_at", null).limit(10000),
        reqQuery.limit(10000),
      ]);

      const errors: string[] = [];
      if (carsRes.error) errors.push("Cars");
      if (soRes.error) errors.push("Sales Orders");
      if (custRes.error) errors.push("Customers");
      if (plansRes.error) errors.push("Payment Plans");
      if (jobsRes.error) errors.push("Garage Jobs");
      if (partsRes.error) errors.push("Parts");
      if (reqRes.error) errors.push("Requests");

      setCars((carsRes.data as CarRow[]) ?? []);
      setSalesOrders((soRes.data as SalesOrderRow[]) ?? []);
      setCustomers((custRes.data as CustomerRow[]) ?? []);
      setPaymentPlans((plansRes.data as PaymentPlanRow[]) ?? []);
      setGarageJobs((jobsRes.data as GarageJobRow[]) ?? []);
      setParts((partsRes.data as PartRow[]) ?? []);
      setRequests((reqRes.data as RequestRow[]) ?? []);
      setLoadErrors(errors);
      setLoading(false);
    }
    fetch();
  }, [hasAccess, appRole, profile?.id, refreshKey]);

  // 1. Cars missing data (location_type required; location_slot optional)
  const carsMissingData = useMemo(() => {
    return cars.filter((c) => {
      return (
        empty(c.vin) ||
        empty(c.model) ||
        empty(c.exterior_color) ||
        empty(c.interior_color) ||
        empty(c.engine_number) ||
        empty(c.location_type) ||
        empty(c.warranty_vehicle_expiry) ||
        empty(c.warranty_battery_expiry) ||
        (c.battery_percent == null) ||
        empty(c.date_arrived)
      );
    });
  }, [cars]);

  // 2. Sales orders missing data
  const soMissingData = useMemo(() => {
    return salesOrders.filter((so) => {
      return (
        empty(so.car_id) ||
        empty(so.customer_id) ||
        so.selling_price == null ||
        empty(so.currency) ||
        empty(so.sale_date)
      );
    });
  }, [salesOrders]);

  // 3. Customers missing data
  const customersMissingData = useMemo(() => {
    return customers.filter((c) => {
      return (
        empty(c.first_name) ||
        empty(c.last_name) ||
        empty(c.phone_primary) ||
        empty(c.email) ||
        empty(c.address)
      );
    });
  }, [customers]);

  // 4. Broken relationships
  const soldCarsNoOrder = useMemo(() => {
    const soCarIds = new Set(salesOrders.map((s) => s.car_id).filter(Boolean));
    return cars.filter(
      (c) =>
        ["sold", "reserved"].includes(c.status) &&
        !soCarIds.has(c.id)
    );
  }, [cars, salesOrders]);

  const soNoCar = useMemo(() => {
    const carIds = new Set(cars.map((c) => c.id));
    return salesOrders.filter((so) => so.car_id && !carIds.has(so.car_id));
  }, [cars, salesOrders]);

  const soNoCustomer = useMemo(() => {
    const custIds = new Set(customers.map((c) => c.id));
    return salesOrders.filter(
      (so) => so.customer_id && !custIds.has(so.customer_id)
    );
  }, [customers, salesOrders]);

  // 5. Warranty data missing
  const carsWarrantyMissing = useMemo(() => {
    return cars.filter((c) => {
      return (
        empty(c.warranty_vehicle_dms) &&
        empty(c.warranty_vehicle_expiry) &&
        empty(c.warranty_battery_expiry)
      );
    });
  }, [cars]);
  // Sales Ops: warranty missing only for sold/reserved cars
  const carsWarrantyMissingSoldReservedDelivered = useMemo(() => {
    return carsWarrantyMissing.filter((c) => ["sold", "reserved"].includes(c.status));
  }, [carsWarrantyMissing]);

  // 6. Reservation / delivery missing
  const reservedNoDate = useMemo(() => {
    return cars.filter(
      (c) => c.status === "reserved" && empty(c.reservation_date)
    );
  }, [cars]);
  const reservedNoBy = useMemo(() => {
    return cars.filter(
      (c) => c.status === "reserved" && empty(c.reserved_by)
    );
  }, [cars]);
  const deliveredNoDate = useMemo(() => {
    return cars.filter((c) => c.status === "sold" && empty(c.delivery_date));
  }, [cars]);

  // 7. Installment data missing
  const plansMissingInstallments = useMemo(() => {
    return paymentPlans.filter((p) => {
      const inst = p.installments ?? [];
      return inst.length === 0 || inst.some((i) => empty(i.due_date));
    });
  }, [paymentPlans]);

  // 8. Software health (IT)
  const carsMissingSoftwareVersion = useMemo(() => cars.filter((c) => empty((c as CarRow).software_version)), [cars]);
  const carsMissingSoftwareUpdate = useMemo(() => cars.filter((c) => empty((c as CarRow).software_update)), [cars]);
  const carsMissingDongle = useMemo(() => cars.filter((c) => empty((c as CarRow).dongle)), [cars]);
  const carsWithSoftwareIssue = useMemo(() => {
    const keywords = /software|electrical|dongle|update|version/i;
    return cars.filter((c) => {
      const issue = (c as CarRow).issue ?? "";
      return keywords.test(issue);
    });
  }, [cars]);
  // Only compare versions when target is a real version (not "latest" placeholder)
  const carsOutdatedSoftware = useMemo(() => {
    const hasRealTarget = Object.values(LATEST_SOFTWARE_VERSION_BY_MODEL).some((t) => t !== "latest");
    if (!hasRealTarget) return [];
    return cars.filter((c) => {
      const v = (c as CarRow).software_version;
      if (empty(v)) return false;
      const model = (c.model ?? "").trim() || "Voyah";
      const target = LATEST_SOFTWARE_VERSION_BY_MODEL[model] ?? LATEST_SOFTWARE_VERSION_BY_MODEL["Voyah"] ?? "latest";
      if (target === "latest") return false;
      return (v as string).toLowerCase() !== target.toLowerCase();
    });
  }, [cars]);

  // 9. Garage health
  const jobsMissingStatus = useMemo(() => garageJobs.filter((j) => empty(j.status)), [garageJobs]);
  const jobsMissingNotes = useMemo(() => garageJobs.filter((j) => empty(j.notes)), [garageJobs]);
  const jobsMissingAssigned = useMemo(() => garageJobs.filter((j) => empty(j.assigned_to)), [garageJobs]);
  const jobsMissingDiagnosis = useMemo(() => garageJobs.filter((j) => empty(j.diagnosis)), [garageJobs]);
  const carsInServiceNoIssue = useMemo(() => {
    const serviceCarIds = new Set(garageJobs.map((j) => j.car_id));
    return cars.filter(
      (c) => c.location_type === "garage" && serviceCarIds.has(c.id) && empty((c as CarRow).issue)
    );
  }, [cars, garageJobs]);

  // 10. Cars missing technical (garage_manager)
  // engine_number, date_arrived = always issue; issue = only for cars physically in garage
  const carsMissingTechnical = useMemo(() => {
    return cars.filter((c) => {
      if (empty(c.engine_number) || empty(c.date_arrived)) return true;
      if (c.location_type === "garage" && empty((c as CarRow).issue)) return true;
      return false;
    });
  }, [cars]);

  // 11. Parts health (khalil)
  const partsMissingData = useMemo(() => parts.filter((p) => empty(p.part_name) || empty(p.oe_number)), [parts]);

  // 12. Requests health (khalil)
  const requestsMissingCategory = useMemo(() => requests.filter((r) => empty(r.category)), [requests]);
  const requestsMissingStatus = useMemo(() => requests.filter((r) => empty(r.status)), [requests]);
  const requestsMissingDetails = useMemo(() => requests.filter((r) => empty(r.description)), [requests]);

  // Section count for sorting and display (must be after all data useMemos)
  const getSectionCount = (id: DataHealthSectionId): number => {
    switch (id) {
      case "cars_missing_data": return carsMissingData.length;
      case "sales_orders_missing_data": return soMissingData.length;
      case "customers_missing_data": return customersMissingData.length;
      case "broken_relationships": return soldCarsNoOrder.length + soNoCar.length + soNoCustomer.length;
      case "warranty_data_missing": return appRole === "sales_ops" ? carsWarrantyMissingSoldReservedDelivered.length : carsWarrantyMissing.length;
      case "reservation_delivery_missing": return reservedNoDate.length + reservedNoBy.length + deliveredNoDate.length;
      case "installment_data_missing": return plansMissingInstallments.length;
      case "software_health": return carsMissingSoftwareVersion.length + carsMissingSoftwareUpdate.length + carsMissingDongle.length + carsWithSoftwareIssue.length + carsOutdatedSoftware.length;
      case "garage_health": return jobsMissingStatus.length + jobsMissingNotes.length + jobsMissingAssigned.length + jobsMissingDiagnosis.length + carsInServiceNoIssue.length;
      case "cars_missing_technical": return carsMissingTechnical.length;
      case "parts_health": return partsMissingData.length;
      case "requests_health": return requestsMissingCategory.length + requestsMissingStatus.length + requestsMissingDetails.length;
      default: return 0;
    }
  };
  const sortedSections = useMemo(
    () => getSectionsInDisplayOrder(visibleSections, getSectionCount),
    [
      visibleSections,
      carsMissingData.length,
      soMissingData.length,
      customersMissingData.length,
      soldCarsNoOrder.length,
      soNoCar.length,
      soNoCustomer.length,
      carsWarrantyMissing.length,
      carsWarrantyMissingSoldReservedDelivered.length,
      reservedNoDate.length,
      reservedNoBy.length,
      deliveredNoDate.length,
      plansMissingInstallments.length,
      carsMissingSoftwareVersion.length,
      carsMissingSoftwareUpdate.length,
      carsMissingDongle.length,
      carsWithSoftwareIssue.length,
      carsOutdatedSoftware.length,
      jobsMissingStatus.length,
      jobsMissingNotes.length,
      jobsMissingAssigned.length,
      jobsMissingDiagnosis.length,
      carsInServiceNoIssue.length,
      carsMissingTechnical.length,
      partsMissingData.length,
      requestsMissingCategory.length,
      requestsMissingStatus.length,
      requestsMissingDetails.length,
      appRole,
    ]
  );

  // Lookup maps for search
  const carById = useMemo(() => new Map(cars.map((c) => [c.id, c])), [cars]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // Plans with overdue installments
  const planIdsWithOverdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ids = new Set<string>();
    for (const p of paymentPlans) {
      const inst = p.installments ?? [];
      if (inst.some((i) => i.due_date && i.due_date < today && (i as InstallmentRow).status !== "paid")) ids.add(p.id);
    }
    return ids;
  }, [paymentPlans]);

  // Critical count must stay consistent with the per-row severity used by
  // isRowCritical / filterRowBySeverity, and only counts visible sections so
  // warningCount = totalVisibleCount - criticalCount stays correct.
  const criticalCount = useMemo(() => {
    let count = 0;
    if (visibleSections.includes("broken_relationships")) {
      count += soldCarsNoOrder.length + soNoCar.length + soNoCustomer.length;
    }
    if (visibleSections.includes("cars_missing_data")) {
      count += carsMissingData.filter((c) => empty(c.vin)).length;
    }
    if (visibleSections.includes("cars_missing_technical")) {
      count += carsMissingTechnical.filter((c) => empty(c.vin)).length;
    }
    if (visibleSections.includes("sales_orders_missing_data")) {
      count += soMissingData.filter(
        (so) => empty(so.car_id) || empty(so.customer_id)
      ).length;
    }
    if (visibleSections.includes("installment_data_missing")) {
      count += plansMissingInstallments.filter((p) => planIdsWithOverdue.has(p.id)).length;
    }
    return count;
  }, [
    visibleSections,
    soldCarsNoOrder.length,
    soNoCar.length,
    soNoCustomer.length,
    carsMissingData,
    carsMissingTechnical,
    soMissingData,
    plansMissingInstallments,
    planIdsWithOverdue,
  ]);

  function rowMatchesSearch(
    sectionId: DataHealthSectionId,
    row: Record<string, unknown>,
    search: string
  ): boolean {
    if (!search.trim()) return true;
    const car = (row as { car_id?: string }).car_id
      ? carById.get((row as { car_id: string }).car_id)
      : (row as CarRow);
    const customer = (row as { customer_id?: string }).customer_id
      ? customerById.get((row as { customer_id: string }).customer_id)
      : (row as CustomerRow);
    const vin = car?.vin ?? (row as CarRow).vin;
    const name = customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : `${(row as CustomerRow).first_name ?? ""} ${(row as CustomerRow).last_name ?? ""}`.trim();
    const phone = customer?.phone_primary ?? (row as CustomerRow).phone_primary;
    const partName = (row as PartRow).part_name;
    const oeNumber = (row as PartRow).oe_number;
    const subject = (row as RequestRow).subject;
    return matchesSearch(search, vin, name, phone, partName, oeNumber, subject);
  }

  function isRowCritical(
    sectionId: DataHealthSectionId,
    row: Record<string, unknown>
  ): boolean {
    if (sectionId === "broken_relationships") return true;
    if (sectionId === "cars_missing_data" || sectionId === "cars_missing_technical")
      return empty((row as CarRow).vin);
    if (sectionId === "sales_orders_missing_data")
      return empty((row as SalesOrderRow).car_id) || empty((row as SalesOrderRow).customer_id);
    if (sectionId === "installment_data_missing")
      return planIdsWithOverdue.has((row as PaymentPlanRow).id);
    return false;
  };

  function getRowSeverityClass(
    sectionId: DataHealthSectionId,
    row: Record<string, unknown>
  ): string {
    return isRowCritical(sectionId, row) ? "bg-destructive/10" : "bg-amber-500/10";
  }

  function filterRowBySeverity(
    sectionId: DataHealthSectionId,
    row: Record<string, unknown>
  ): boolean {
    if (severityFilter === "all") return true;
    const critical = isRowCritical(sectionId, row);
    if (severityFilter === "critical") return critical;
    if (severityFilter === "warning") return !critical;
    return true;
  }
  const totalVisibleCount = useMemo(
    () => visibleSections.reduce((sum, id) => sum + getSectionCount(id), 0),
    [
      visibleSections,
      carsMissingData.length,
      soMissingData.length,
      customersMissingData.length,
      soldCarsNoOrder.length,
      soNoCar.length,
      soNoCustomer.length,
      carsWarrantyMissing.length,
      carsWarrantyMissingSoldReservedDelivered.length,
      reservedNoDate.length,
      reservedNoBy.length,
      deliveredNoDate.length,
      plansMissingInstallments.length,
      carsMissingSoftwareVersion.length,
      carsMissingSoftwareUpdate.length,
      carsMissingDongle.length,
      carsWithSoftwareIssue.length,
      carsOutdatedSoftware.length,
      jobsMissingStatus.length,
      jobsMissingNotes.length,
      jobsMissingAssigned.length,
      jobsMissingDiagnosis.length,
      carsInServiceNoIssue.length,
      carsMissingTechnical.length,
      partsMissingData.length,
      requestsMissingCategory.length,
      requestsMissingStatus.length,
      requestsMissingDetails.length,
      appRole,
    ]
  );
  const warningCount = Math.max(0, totalVisibleCount - criticalCount);

  // Data health scores (location_type required; battery_percent optional, excluded)
  const carFields = ["vin", "model", "exterior_color", "interior_color", "engine_number", "location_type", "warranty_vehicle_expiry", "warranty_battery_expiry", "date_arrived"];
  const custFields = ["first_name", "last_name", "phone_primary", "email", "address"];
  const soFields = ["car_id", "customer_id", "selling_price", "currency", "sale_date"];
  const warrantyFields = ["warranty_vehicle_dms", "warranty_vehicle_expiry", "warranty_battery_expiry"];

  const carsScore = useMemo(() => {
    if (cars.length === 0) return 100;
    let total = 0;
    let filled = 0;
    for (const c of cars) {
      for (const f of carFields) {
        total++;
        const v = (c as Record<string, unknown>)[f];
        if (f === "battery_percent") {
          if (v != null) filled++;
        } else if (!empty(v)) filled++;
      }
    }
    return total === 0 ? 100 : Math.round((filled / total) * 100);
  }, [cars]);

  const customersScore = useMemo(() => {
    if (customers.length === 0) return 100;
    let total = 0;
    let filled = 0;
    for (const c of customers) {
      for (const f of custFields) {
        total++;
        const v = (c as Record<string, unknown>)[f];
        if (!empty(v)) filled++;
      }
    }
    return total === 0 ? 100 : Math.round((filled / total) * 100);
  }, [customers]);

  const soScore = useMemo(() => {
    if (salesOrders.length === 0) return 100;
    let total = 0;
    let filled = 0;
    for (const s of salesOrders) {
      for (const f of soFields) {
        total++;
        const v = (s as Record<string, unknown>)[f];
        if (!empty(v)) filled++;
      }
    }
    return total === 0 ? 100 : Math.round((filled / total) * 100);
  }, [salesOrders]);

  const warrantyScore = useMemo(() => {
    if (cars.length === 0) return 100;
    let total = 0;
    let filled = 0;
    for (const c of cars) {
      for (const f of warrantyFields) {
        total++;
        const v = (c as Record<string, unknown>)[f];
        if (!empty(v)) filled++;
      }
    }
    return total === 0 ? 100 : Math.round((filled / total) * 100);
  }, [cars]);

  const onQuickFix = () => setRefreshKey((k) => k + 1);

  const ActionButtons = ({
    carId,
    customerId,
    planId,
    soCarId,
    soCustomerId,
    isSalesOrder,
    jobId,
    requestId,
  }: {
    carId?: string;
    customerId?: string;
    planId?: string;
    soCarId?: string;
    soCustomerId?: string;
    isSalesOrder?: boolean;
    jobId?: string;
    requestId?: string;
  }) => {
    // Sales order: 1) car → /cars/[id], 2) else customer → /customers/[id], 3) else disabled
    const soOpenHref = soCarId ? `/cars/${soCarId}` : soCustomerId ? `/customers/${soCustomerId}` : null;
    const soCanOpen = soOpenHref != null;
    return (
      <div className="flex gap-2">
        {carId && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/cars/${carId}`}>
                <Pencil className="mr-1 size-3" />
                Edit
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/cars/${carId}`}>
                <ExternalLink className="mr-1 size-3" />
                Open
              </Link>
            </Button>
          </>
        )}
        {customerId && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/customers/${customerId}`}>
                <Pencil className="mr-1 size-3" />
                Edit
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/customers/${customerId}`}>
                <ExternalLink className="mr-1 size-3" />
                Open
              </Link>
            </Button>
          </>
        )}
        {planId && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/installments?plan=${planId}`}>
              <ExternalLink className="mr-1 size-3" />
              Open
            </Link>
          </Button>
        )}
        {isSalesOrder && (
          soCanOpen ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={soOpenHref!}>
                <ExternalLink className="mr-1 size-3" />
                Open
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled title="No car or customer linked">
              <ExternalLink className="mr-1 size-3" />
              Open
            </Button>
          )
        )}
        {jobId && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/garage/jobs/${jobId}`}>
                <Pencil className="mr-1 size-3" />
                Edit
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/garage/jobs/${jobId}`}>
                <ExternalLink className="mr-1 size-3" />
                Open
              </Link>
            </Button>
          </>
        )}
        {requestId && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/requests?detail=${requestId}`}>
              <ExternalLink className="mr-1 size-3" />
              Open
            </Link>
          </Button>
        )}
      </div>
    );
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You do not have access to the Data Health dashboard.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Data Health</h1>
        <p className="text-muted-foreground">
          {isOwner
            ? "Showing all company data health sections"
            : `Showing data health for: ${roleLabel}`}
        </p>
      </div>

      {loadErrors.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Some data couldn&apos;t load.</p>
            <p>Affected: {loadErrors.join(", ")}. Counts below may be incomplete — refresh to retry.</p>
          </div>
        </div>
      )}

      {/* Global Critical / Warning indicator */}
      <div className="flex flex-wrap gap-4" data-tour-id="data-health-severity-totals">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2">
          <AlertCircle className="size-5 text-destructive" />
          <span className="text-sm font-medium">Critical Issues:</span>
          <span className="text-lg font-bold text-destructive">{criticalCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2">
          <AlertTriangle className="size-5 text-amber-600" />
          <span className="text-sm font-medium">Warnings:</span>
          <span className="text-lg font-bold text-amber-700">{warningCount}</span>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-4">
        <div className="relative flex flex-1 min-w-[200px] items-center gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-tour-id="data-health-search-input"
              placeholder="Search by VIN, customer name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <VinScanButton onScan={(vin) => setSearchQuery(vin)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger data-tour-id="data-health-filter-section" className="w-[200px]">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {visibleSections.map((id) => (
                <SelectItem key={id} value={id}>
                  {SECTION_LABELS[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as "all" | "critical" | "warning")}>
            <SelectTrigger data-tour-id="data-health-filter-severity" className="w-[140px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical only</SelectItem>
              <SelectItem value="warning">Warning only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="open-issues-only"
            checked={openIssuesOnly}
            onCheckedChange={(c) => setOpenIssuesOnly(c === true)}
          />
          <Label htmlFor="open-issues-only" className="cursor-pointer text-sm font-normal">
            Open issues only
          </Label>
        </div>
      </div>

      {/* Role-specific summary cards */}
      <Card className="border-primary/20 bg-primary/5" data-tour-id="data-health-summary-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            {isOwner ? "Data Health Score" : "Your Data Health Summary"}
          </CardTitle>
          <CardDescription>
            {isOwner ? "Overall completeness by entity type" : "Issues relevant to your role"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isOwner && (
              <>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Cars</p>
                  <p className="text-2xl font-bold">{carsScore}% complete</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Customers</p>
                  <p className="text-2xl font-bold">{customersScore}% complete</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Sales Orders</p>
                  <p className="text-2xl font-bold">{soScore}% complete</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Warranty Data</p>
                  <p className="text-2xl font-bold">{warrantyScore}% complete</p>
                </div>
              </>
            )}
            {appRole === "assistant" && (
              <>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Customers missing phone</p>
                  <p className="text-2xl font-bold">{customers.filter((c) => empty(c.phone_primary)).length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Sales orders missing data</p>
                  <p className="text-2xl font-bold">{soMissingData.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Reservation/delivery missing</p>
                  <p className="text-2xl font-bold">{reservedNoDate.length + reservedNoBy.length + deliveredNoDate.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Installment issues</p>
                  <p className="text-2xl font-bold">{plansMissingInstallments.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Requests missing data</p>
                  <p className="text-2xl font-bold">{requestsMissingCategory.length + requestsMissingStatus.length + requestsMissingDetails.length}</p>
                </div>
              </>
            )}
            {appRole === "sales_ops" && (
              <>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Customers missing data</p>
                  <p className="text-2xl font-bold">{customersMissingData.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Sales orders missing data</p>
                  <p className="text-2xl font-bold">{soMissingData.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Warranty missing (sold/reserved)</p>
                  <p className="text-2xl font-bold">{carsWarrantyMissingSoldReservedDelivered.length}</p>
                </div>
              </>
            )}
            {appRole === "garage_manager" && (
              <>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Jobs missing diagnosis</p>
                  <p className="text-2xl font-bold">{jobsMissingDiagnosis.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Cars missing engine number</p>
                  <p className="text-2xl font-bold">{cars.filter((c) => empty(c.engine_number)).length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Warranty missing</p>
                  <p className="text-2xl font-bold">{carsWarrantyMissing.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Parts missing data</p>
                  <p className="text-2xl font-bold">{partsMissingData.length}</p>
                </div>
              </>
            )}
            {appRole === "garage_staff" && (
              <>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">My jobs missing status</p>
                  <p className="text-2xl font-bold">{jobsMissingStatus.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">My jobs missing notes</p>
                  <p className="text-2xl font-bold">{jobsMissingNotes.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">My jobs missing diagnosis</p>
                  <p className="text-2xl font-bold">{jobsMissingDiagnosis.length}</p>
                </div>
              </>
            )}
            {appRole === "it" && (
              <>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Cars missing software version</p>
                  <p className="text-2xl font-bold">{carsMissingSoftwareVersion.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Cars missing software update</p>
                  <p className="text-2xl font-bold">{carsMissingSoftwareUpdate.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Cars missing dongle</p>
                  <p className="text-2xl font-bold">{carsMissingDongle.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Cars with software/electrical issues</p>
                  <p className="text-2xl font-bold">{carsWithSoftwareIssue.length}</p>
                </div>
                {carsOutdatedSoftware.length > 0 && (
                  <div className="rounded-lg border bg-background p-4">
                    <p className="text-sm font-medium text-muted-foreground">Cars outdated software</p>
                    <p className="text-2xl font-bold">{carsOutdatedSoftware.length}</p>
                  </div>
                )}
              </>
            )}
            {appRole === "hybrid" && (
              <>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">Parts missing data</p>
                  <p className="text-2xl font-bold">{partsMissingData.length}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-sm font-medium text-muted-foreground">My requests missing data</p>
                  <p className="text-2xl font-bold">{requestsMissingCategory.length + requestsMissingStatus.length + requestsMissingDetails.length}</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Loading...</p>
      ) : (
        <div className="flex flex-col gap-8">
          {sortedSections
            .filter((id) => (sectionFilter === "all" || sectionFilter === id) && (!openIssuesOnly || getSectionCount(id) > 0))
            .map((sectionId, idx) => {
            const sectionNum = idx + 1;
            if (sectionId === "cars_missing_data") {
              const filtered = carsMissingData.filter(
                (c) => rowMatchesSearch("cars_missing_data", c, searchQuery) && filterRowBySeverity("cars_missing_data", c)
              );
              return (
                <div key={sectionId} style={{ order: idx }}>
                <SectionCard
                  title={`${sectionNum}. Cars Missing Data`}
                  description="Cars where VIN, model, exterior_color, interior_color, engine_number, location_type, warranty_vehicle_expiry, warranty_battery_expiry, battery_percent, or date_arrived are NULL or empty"
                  count={filtered.length}
                  icon={Car}
                >
                  {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No issues found.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Missing</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((c) => {
                          const missing: string[] = [];
                          if (empty(c.vin)) missing.push("vin");
                          if (empty(c.model)) missing.push("model");
                          if (empty(c.exterior_color)) missing.push("exterior_color");
                          if (empty(c.interior_color)) missing.push("interior_color");
                          if (empty(c.engine_number)) missing.push("engine_number");
                          if (empty(c.location_type)) missing.push("location_type");
                          if (empty(c.warranty_vehicle_expiry)) missing.push("warranty_vehicle_expiry");
                          if (empty(c.warranty_battery_expiry)) missing.push("warranty_battery_expiry");
                          if (c.battery_percent == null) missing.push("battery_percent");
                          if (empty(c.date_arrived)) missing.push("date_arrived");
                          return (
                            <TableRow key={c.id} className={getRowSeverityClass("cars_missing_data", c)}>
                              <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                              <TableCell>{c.brand} {c.model} {c.model_year}</TableCell>
                              <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{missing.join(", ")}</TableCell>
                              <TableCell><ActionButtons carId={c.id} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </SectionCard>
                </div>
              );
            }
            if (sectionId === "sales_orders_missing_data") {
              const filtered = soMissingData.filter(
                (so) => rowMatchesSearch("sales_orders_missing_data", so, searchQuery) && filterRowBySeverity("sales_orders_missing_data", so)
              );
              return (
                <div key={sectionId} style={{ order: idx }}>
                <SectionCard
                  title={`${sectionNum}. Sales Orders Missing Data`}
                  description="Sales orders where car_id, customer_id, selling_price, currency, or sale_date are NULL"
                  count={filtered.length}
                  icon={FileText}
                >
                  {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No issues found.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Missing</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((so) => {
                          const missing: string[] = [];
                          if (empty(so.car_id)) missing.push("car_id");
                          if (empty(so.customer_id)) missing.push("customer_id");
                          if (so.selling_price == null) missing.push("selling_price");
                          if (empty(so.currency)) missing.push("currency");
                          if (empty(so.sale_date)) missing.push("sale_date");
                          return (
                            <TableRow key={so.id} className={getRowSeverityClass("sales_orders_missing_data", so)}>
                              <TableCell className="font-mono text-sm">{so.id.slice(0, 8)}…</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{missing.join(", ")}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(so.created_at)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(so.updated_at)}</TableCell>
                              <TableCell><ActionButtons isSalesOrder soCarId={so.car_id ?? undefined} soCustomerId={so.customer_id ?? undefined} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </SectionCard>
                </div>
              );
            }
            if (sectionId === "customers_missing_data") {
              const filtered = customersMissingData.filter(
                (c) => rowMatchesSearch("customers_missing_data", c, searchQuery) && filterRowBySeverity("customers_missing_data", c)
              );
              return (
                <div key={sectionId} style={{ order: idx }}>
                <SectionCard
                  title={`${sectionNum}. Customers Missing Data`}
                  description="Customers where first_name, last_name, phone_primary, email, or address are missing"
                  count={filtered.length}
                  icon={Users}
                >
                  {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No issues found.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Missing</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="w-48">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((c) => {
                          const missing: string[] = [];
                          if (empty(c.first_name)) missing.push("first_name");
                          if (empty(c.last_name)) missing.push("last_name");
                          if (empty(c.phone_primary)) missing.push("phone_primary");
                          if (empty(c.email)) missing.push("email");
                          if (empty(c.address)) missing.push("address");
                          return (
                            <TableRow key={c.id} className={getRowSeverityClass("customers_missing_data", c)}>
                              <TableCell>{c.first_name} {c.last_name ?? ""}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{missing.join(", ")}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(c.updated_at)}</TableCell>
                              <TableCell>
                                {empty(c.phone_primary) ? (
                                  <QuickFixCustomerPhone customerId={c.id} onSaved={onQuickFix} />
                                ) : (
                                  <ActionButtons customerId={c.id} />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </SectionCard>
                </div>
              );
            }
            return null;
          })}
          {/* Remaining sections - use order for flex sorting */}
          {showSection("broken_relationships") && (sectionFilter === "all" || sectionFilter === "broken_relationships") && (!openIssuesOnly || soldCarsNoOrder.length + soNoCar.length + soNoCustomer.length > 0) && (
          <div style={{ order: sortedSections.indexOf("broken_relationships") }}>
          <SectionCard
            title={`${sortedSections.indexOf("broken_relationships") + 1}. Broken Relationships`}
            description="Cars sold or reserved with no sales_orders; sales_orders without cars or customers"
            count={
              soldCarsNoOrder.filter((c) => rowMatchesSearch("broken_relationships", c, searchQuery) && filterRowBySeverity("broken_relationships", c)).length +
              soNoCar.filter((so) => rowMatchesSearch("broken_relationships", so, searchQuery) && filterRowBySeverity("broken_relationships", so)).length +
              soNoCustomer.filter((so) => rowMatchesSearch("broken_relationships", so, searchQuery) && filterRowBySeverity("broken_relationships", so)).length
            }
            icon={AlertTriangle}
          >
            {(() => {
              const filteredSold = soldCarsNoOrder.filter((c) => rowMatchesSearch("broken_relationships", c, searchQuery) && filterRowBySeverity("broken_relationships", c));
              const filteredSoNoCar = soNoCar.filter((so) => rowMatchesSearch("broken_relationships", so, searchQuery) && filterRowBySeverity("broken_relationships", so));
              const filteredSoNoCust = soNoCustomer.filter((so) => rowMatchesSearch("broken_relationships", so, searchQuery) && filterRowBySeverity("broken_relationships", so));
              const total = filteredSold.length + filteredSoNoCar.length + filteredSoNoCust.length;
              if (total === 0) return <p className="text-sm text-muted-foreground">No issues found.</p>;
              return (
              <div className="space-y-4">
                {filteredSold.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Cars marked sold or reserved with no sales_order</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSold.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("broken_relationships", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                            <TableCell><ActionButtons carId={c.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {filteredSoNoCar.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Sales orders without linked car</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSoNoCar.map((so) => (
                          <TableRow key={so.id} className={getRowSeverityClass("broken_relationships", so)}>
                            <TableCell className="font-mono text-sm">{so.id.slice(0, 8)}…</TableCell>
                            <TableCell><ActionButtons isSalesOrder soCarId={so.car_id ?? undefined} soCustomerId={so.customer_id ?? undefined} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {filteredSoNoCust.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Sales orders without linked customer</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSoNoCust.map((so) => (
                          <TableRow key={so.id} className={getRowSeverityClass("broken_relationships", so)}>
                            <TableCell className="font-mono text-sm">{so.id.slice(0, 8)}…</TableCell>
                            <TableCell><ActionButtons isSalesOrder soCarId={so.car_id ?? undefined} soCustomerId={so.customer_id ?? undefined} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              );
            })()}
          </SectionCard>
          </div>
          )}

          {showSection("warranty_data_missing") && (sectionFilter === "all" || sectionFilter === "warranty_data_missing") && (!openIssuesOnly || (appRole === "sales_ops" ? carsWarrantyMissingSoldReservedDelivered.length : carsWarrantyMissing.length) > 0) && (
          <div style={{ order: sortedSections.indexOf("warranty_data_missing") }}>
          <SectionCard
            title={`${sortedSections.indexOf("warranty_data_missing") + 1}. Warranty Data Missing`}
            description={
              appRole === "sales_ops"
                ? "Sold or reserved cars where all warranty fields are missing"
                : "Cars where all warranty fields (warranty_vehicle_dms, warranty_vehicle_expiry, warranty_battery_expiry) are NULL"
            }
            count={(appRole === "sales_ops" ? carsWarrantyMissingSoldReservedDelivered : carsWarrantyMissing).filter(
              (c) => rowMatchesSearch("warranty_data_missing", c, searchQuery) && filterRowBySeverity("warranty_data_missing", c)
            ).length}
            icon={Shield}
          >
            {(() => {
              const list = appRole === "sales_ops" ? carsWarrantyMissingSoldReservedDelivered : carsWarrantyMissing;
              const filtered = list.filter((c) => rowMatchesSearch("warranty_data_missing", c, searchQuery) && filterRowBySeverity("warranty_data_missing", c));
              if (filtered.length === 0) return <p className="text-sm text-muted-foreground">No issues found.</p>;
              return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>VIN</TableHead>
                    <TableHead>Car</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className={getRowSeverityClass("warranty_data_missing", c)}>
                      <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                      <TableCell>{c.brand} {c.model}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      <TableCell><ActionButtons carId={c.id} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              );
            })()}
          </SectionCard>
          </div>
          )}

          {showSection("reservation_delivery_missing") && (sectionFilter === "all" || sectionFilter === "reservation_delivery_missing") && (!openIssuesOnly || reservedNoDate.length + reservedNoBy.length + deliveredNoDate.length > 0) && (
          <div style={{ order: sortedSections.indexOf("reservation_delivery_missing") }}>
          <SectionCard
            title={`${sortedSections.indexOf("reservation_delivery_missing") + 1}. Reservation / Delivery Missing`}
            description="Reserved cars without reservation_date or reserved_by; sold cars without delivery_date"
            count={
              reservedNoDate.filter((c) => rowMatchesSearch("reservation_delivery_missing", c, searchQuery) && filterRowBySeverity("reservation_delivery_missing", c)).length +
              reservedNoBy.filter((c) => rowMatchesSearch("reservation_delivery_missing", c, searchQuery) && filterRowBySeverity("reservation_delivery_missing", c)).length +
              deliveredNoDate.filter((c) => rowMatchesSearch("reservation_delivery_missing", c, searchQuery) && filterRowBySeverity("reservation_delivery_missing", c)).length
            }
            icon={Calendar}
          >
            {(() => {
              const f1 = reservedNoDate.filter((c) => rowMatchesSearch("reservation_delivery_missing", c, searchQuery) && filterRowBySeverity("reservation_delivery_missing", c));
              const f2 = reservedNoBy.filter((c) => rowMatchesSearch("reservation_delivery_missing", c, searchQuery) && filterRowBySeverity("reservation_delivery_missing", c));
              const f3 = deliveredNoDate.filter((c) => rowMatchesSearch("reservation_delivery_missing", c, searchQuery) && filterRowBySeverity("reservation_delivery_missing", c));
              if (f1.length + f2.length + f3.length === 0) return <p className="text-sm text-muted-foreground">No issues found.</p>;
              return (
              <div className="space-y-4">
                {f1.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Reserved cars without reservation_date</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f1.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("reservation_delivery_missing", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell><ActionButtons carId={c.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f2.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Reserved cars without reserved_by</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f2.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("reservation_delivery_missing", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell><QuickFixReservedBy carId={c.id} onSaved={onQuickFix} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f3.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Delivered cars without delivery_date</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f3.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("reservation_delivery_missing", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell><ActionButtons carId={c.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              );
            })()}
          </SectionCard>
          </div>
          )}

          {showSection("installment_data_missing") && (sectionFilter === "all" || sectionFilter === "installment_data_missing") && (!openIssuesOnly || plansMissingInstallments.length > 0) && (
          <div style={{ order: sortedSections.indexOf("installment_data_missing") }}>
          <SectionCard
            title={`${sortedSections.indexOf("installment_data_missing") + 1}. Installment Data Missing`}
            description="Payment plans without installment rows or with installments missing due_date"
            count={plansMissingInstallments.filter(
              (p) => rowMatchesSearch("installment_data_missing", p, searchQuery) && filterRowBySeverity("installment_data_missing", p)
            ).length}
            icon={CreditCard}
          >
            {(() => {
              const filtered = plansMissingInstallments.filter(
                (p) => rowMatchesSearch("installment_data_missing", p, searchQuery) && filterRowBySeverity("installment_data_missing", p)
              );
              if (filtered.length === 0) return <p className="text-sm text-muted-foreground">No issues found.</p>;
              return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const inst = p.installments ?? [];
                    const noRows = inst.length === 0;
                    const noDueDate = inst.some((i) => empty(i.due_date));
                    const issue = noRows ? "No installment rows" : noDueDate ? "Missing due_date" : "—";
                    return (
                      <TableRow key={p.id} className={getRowSeverityClass("installment_data_missing", p)}>
                        <TableCell className="font-mono text-sm">{p.id.slice(0, 8)}…</TableCell>
                        <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{issue}</TableCell>
                        <TableCell><ActionButtons planId={p.id} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              );
            })()}
          </SectionCard>
          </div>
          )}

          {showSection("software_health") && (sectionFilter === "all" || sectionFilter === "software_health") && (!openIssuesOnly || carsMissingSoftwareVersion.length + carsMissingSoftwareUpdate.length + carsMissingDongle.length + carsWithSoftwareIssue.length + carsOutdatedSoftware.length > 0) && (
          <div style={{ order: sortedSections.indexOf("software_health") }}>
          <SectionCard
            title={`${sortedSections.indexOf("software_health") + 1}. Software Health`}
            description="Cars missing software version, software update, dongle, or with software/electrical issues"
            count={
              carsMissingSoftwareVersion.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c)).length +
              carsMissingSoftwareUpdate.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c)).length +
              carsMissingDongle.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c)).length +
              carsWithSoftwareIssue.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c)).length +
              carsOutdatedSoftware.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c)).length
            }
            icon={Cpu}
          >
            {(() => {
              const f1 = carsMissingSoftwareVersion.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c));
              const f2 = carsMissingSoftwareUpdate.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c));
              const f3 = carsMissingDongle.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c));
              const f4 = carsWithSoftwareIssue.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c));
              const f5 = carsOutdatedSoftware.filter((c) => rowMatchesSearch("software_health", c, searchQuery) && filterRowBySeverity("software_health", c));
              if (f1.length + f2.length + f3.length + f4.length + f5.length === 0) return <p className="text-sm text-muted-foreground">No issues found.</p>;
              return (
              <div className="space-y-4">
                {f1.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Cars missing software version</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f1.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("software_health", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell><ActionButtons carId={c.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f2.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Cars missing software update</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f2.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("software_health", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell><ActionButtons carId={c.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f3.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Cars missing dongle info</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f3.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("software_health", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell><ActionButtons carId={c.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f4.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Cars with software/electrical issue indicators</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f4.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("software_health", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{(c as CarRow).issue ?? "—"}</TableCell>
                            <TableCell><ActionButtons carId={c.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f5.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Cars not updated to latest software version</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead>Current Version</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f5.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("software_health", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell className="text-xs">{(c as CarRow).software_version ?? "—"}</TableCell>
                            <TableCell><ActionButtons carId={c.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              );
            })()}
          </SectionCard>
          </div>
          )}

          {showSection("garage_health") && (sectionFilter === "all" || sectionFilter === "garage_health") && (!openIssuesOnly || jobsMissingStatus.length + jobsMissingNotes.length + jobsMissingAssigned.length + jobsMissingDiagnosis.length + carsInServiceNoIssue.length > 0) && (
          <div style={{ order: sortedSections.indexOf("garage_health") }}>
          <SectionCard
            title={`${sortedSections.indexOf("garage_health") + 1}. Garage Health`}
            description="Garage jobs missing status, assigned employee, notes; cars in service with no issue logged"
            count={
              jobsMissingStatus.filter((j) => rowMatchesSearch("garage_health", j, searchQuery) && filterRowBySeverity("garage_health", j)).length +
              jobsMissingNotes.filter((j) => rowMatchesSearch("garage_health", j, searchQuery) && filterRowBySeverity("garage_health", j)).length +
              jobsMissingAssigned.filter((j) => rowMatchesSearch("garage_health", j, searchQuery) && filterRowBySeverity("garage_health", j)).length +
              jobsMissingDiagnosis.filter((j) => rowMatchesSearch("garage_health", j, searchQuery) && filterRowBySeverity("garage_health", j)).length +
              carsInServiceNoIssue.filter((c) => rowMatchesSearch("garage_health", c, searchQuery) && filterRowBySeverity("garage_health", c)).length
            }
            icon={Wrench}
          >
            {(() => {
              const f1 = jobsMissingStatus.filter((j) => rowMatchesSearch("garage_health", j, searchQuery) && filterRowBySeverity("garage_health", j));
              const f2 = jobsMissingNotes.filter((j) => rowMatchesSearch("garage_health", j, searchQuery) && filterRowBySeverity("garage_health", j));
              const f3 = jobsMissingAssigned.filter((j) => rowMatchesSearch("garage_health", j, searchQuery) && filterRowBySeverity("garage_health", j));
              const f4 = jobsMissingDiagnosis.filter((j) => rowMatchesSearch("garage_health", j, searchQuery) && filterRowBySeverity("garage_health", j));
              const f5 = carsInServiceNoIssue.filter((c) => rowMatchesSearch("garage_health", c, searchQuery) && filterRowBySeverity("garage_health", c));
              if (f1.length + f2.length + f3.length + f4.length + f5.length === 0) return <p className="text-sm text-muted-foreground">No issues found.</p>;
              return (
              <div className="space-y-4">
                {f1.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Jobs missing status</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job</TableHead>
                          <TableHead>Car ID</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f1.map((j) => (
                          <TableRow key={j.id} className={getRowSeverityClass("garage_health", j)}>
                            <TableCell>{j.title}</TableCell>
                            <TableCell className="font-mono text-sm">{j.car_id?.slice(0, 8)}…</TableCell>
                            <TableCell><ActionButtons jobId={j.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f2.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Jobs missing notes</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f2.map((j) => (
                          <TableRow key={j.id} className={getRowSeverityClass("garage_health", j)}>
                            <TableCell>{j.title}</TableCell>
                            <TableCell><ActionButtons jobId={j.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f3.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Jobs missing assigned employee</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f3.map((j) => (
                          <TableRow key={j.id} className={getRowSeverityClass("garage_health", j)}>
                            <TableCell>{j.title}</TableCell>
                            <TableCell><ActionButtons jobId={j.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f4.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Jobs missing diagnosis</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f4.map((j) => (
                          <TableRow key={j.id} className={getRowSeverityClass("garage_health", j)}>
                            <TableCell>{j.title}</TableCell>
                            <TableCell><QuickFixJobDiagnosis jobId={j.id} onSaved={onQuickFix} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f5.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Cars in garage with no issue logged</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>VIN</TableHead>
                          <TableHead>Car</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f5.map((c) => (
                          <TableRow key={c.id} className={getRowSeverityClass("garage_health", c)}>
                            <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                            <TableCell>{c.brand} {c.model}</TableCell>
                            <TableCell><ActionButtons carId={c.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              );
            })()}
          </SectionCard>
          </div>
          )}

          {showSection("cars_missing_technical") && (sectionFilter === "all" || sectionFilter === "cars_missing_technical") && (!openIssuesOnly || carsMissingTechnical.length > 0) && (
          <div style={{ order: sortedSections.indexOf("cars_missing_technical") }}>
          <SectionCard
            title={`${sortedSections.indexOf("cars_missing_technical") + 1}. Cars Missing Technical Data`}
            description="Cars missing engine_number, issue, or date_arrived"
            count={carsMissingTechnical.filter(
              (c) => rowMatchesSearch("cars_missing_technical", c, searchQuery) && filterRowBySeverity("cars_missing_technical", c)
            ).length}
            icon={Car}
          >
            {(() => {
              const filtered = carsMissingTechnical.filter(
                (c) => rowMatchesSearch("cars_missing_technical", c, searchQuery) && filterRowBySeverity("cars_missing_technical", c)
              );
              if (filtered.length === 0) return <p className="text-sm text-muted-foreground">No issues found.</p>;
              return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>VIN</TableHead>
                    <TableHead>Car</TableHead>
                    <TableHead>Missing</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const missing: string[] = [];
                    if (empty(c.engine_number)) missing.push("engine_number");
                    if (empty(c.date_arrived)) missing.push("date_arrived");
                    if (c.location_type === "garage" && empty((c as CarRow).issue)) missing.push("issue");
                    return (
                      <TableRow key={c.id} className={getRowSeverityClass("cars_missing_technical", c)}>
                        <TableCell className="font-mono text-sm">{c.vin ?? "—"}</TableCell>
                        <TableCell>{c.brand} {c.model}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{missing.join(", ")}</TableCell>
                        <TableCell><ActionButtons carId={c.id} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              );
            })()}
          </SectionCard>
          </div>
          )}

          {showSection("parts_health") && (sectionFilter === "all" || sectionFilter === "parts_health") && (!openIssuesOnly || partsMissingData.length > 0) && (
          <div style={{ order: sortedSections.indexOf("parts_health") }}>
          <SectionCard
            title={`${sortedSections.indexOf("parts_health") + 1}. Parts Health`}
            description="Parts missing OE number or other key data"
            count={partsMissingData.filter(
              (p) => rowMatchesSearch("parts_health", p, searchQuery) && filterRowBySeverity("parts_health", p)
            ).length}
            icon={Package}
          >
            {(() => {
              const filtered = partsMissingData.filter(
                (p) => rowMatchesSearch("parts_health", p, searchQuery) && filterRowBySeverity("parts_health", p)
              );
              if (filtered.length === 0) return <p className="text-sm text-muted-foreground">No issues found.</p>;
              return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead>OE Number</TableHead>
                    <TableHead>Missing</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const missing: string[] = [];
                    if (empty(p.part_name)) missing.push("part_name");
                    if (empty(p.oe_number)) missing.push("oe_number");
                    return (
                      <TableRow key={p.id} className={getRowSeverityClass("parts_health", p)}>
                        <TableCell>{p.part_name}</TableCell>
                        <TableCell className="font-mono text-sm">{p.oe_number ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{missing.join(", ")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/garage/inventory`}>Open</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              );
            })()}
          </SectionCard>
          </div>
          )}

          {showSection("requests_health") && (sectionFilter === "all" || sectionFilter === "requests_health") && (!openIssuesOnly || requestsMissingCategory.length + requestsMissingStatus.length + requestsMissingDetails.length > 0) && (
          <div style={{ order: sortedSections.indexOf("requests_health") }}>
          <SectionCard
            title={`${sortedSections.indexOf("requests_health") + 1}. Requests Health`}
            description="Requests assigned to you missing category, status, or details"
            count={
              requestsMissingCategory.filter((r) => rowMatchesSearch("requests_health", r, searchQuery) && filterRowBySeverity("requests_health", r)).length +
              requestsMissingStatus.filter((r) => rowMatchesSearch("requests_health", r, searchQuery) && filterRowBySeverity("requests_health", r)).length +
              requestsMissingDetails.filter((r) => rowMatchesSearch("requests_health", r, searchQuery) && filterRowBySeverity("requests_health", r)).length
            }
            icon={ClipboardList}
          >
            {(() => {
              const f1 = requestsMissingCategory.filter((r) => rowMatchesSearch("requests_health", r, searchQuery) && filterRowBySeverity("requests_health", r));
              const f2 = requestsMissingStatus.filter((r) => rowMatchesSearch("requests_health", r, searchQuery) && filterRowBySeverity("requests_health", r));
              const f3 = requestsMissingDetails.filter((r) => rowMatchesSearch("requests_health", r, searchQuery) && filterRowBySeverity("requests_health", r));
              if (f1.length + f2.length + f3.length === 0) return <p className="text-sm text-muted-foreground">No issues found.</p>;
              return (
              <div className="space-y-4">
                {f1.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Requests missing category</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f1.map((r) => (
                          <TableRow key={r.id} className={getRowSeverityClass("requests_health", r)}>
                            <TableCell>{r.subject}</TableCell>
                            <TableCell><ActionButtons requestId={r.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f2.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Requests missing status</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f2.map((r) => (
                          <TableRow key={r.id} className={getRowSeverityClass("requests_health", r)}>
                            <TableCell>{r.subject}</TableCell>
                            <TableCell><ActionButtons requestId={r.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {f3.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Requests missing details</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead className="w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {f3.map((r) => (
                          <TableRow key={r.id} className={getRowSeverityClass("requests_health", r)}>
                            <TableCell>{r.subject}</TableCell>
                            <TableCell><ActionButtons requestId={r.id} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              );
            })()}
          </SectionCard>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
