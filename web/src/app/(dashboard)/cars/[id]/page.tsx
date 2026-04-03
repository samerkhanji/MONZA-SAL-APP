"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type {
  CarDisplay,
  CarEvent,
  CarStatus,
  CustomsStatus,
  LocationType,
} from "@/types/database";
import {
  CAR_STATUS_LABELS,
  CUSTOMS_STATUS_LABELS,
  LOCATION_LABELS,
  PDI_LABELS,
  type CarEventType,
} from "@/types/database";
import { fetchActiveTestDriveForCar } from "@/lib/data/test-drives";
import { canPerform } from "@/lib/permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoveCarDialog } from "@/components/move-car-dialog";
import { EditCarDialog } from "@/components/edit-car-dialog";
import { PdiStatusDialog } from "@/components/pdi-status-dialog";
import { CarDocuments } from "@/components/car-documents";
import { DayDetailDialog } from "@/components/car-day-detail-dialog";
import { VisitsMaintenanceDialog } from "@/components/visits-maintenance-dialog";
import { STATUS_BADGE_COLORS, PDI_BADGE_COLORS } from "@/lib/constants/badges";
import { getProfileFullName } from "@/lib/supabase-profile";
import { AlertCircle, Check, Loader2, User, X } from "lucide-react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const StatusCustomerDialog = dynamic(
  () => import("@/components/status-customer-dialog").then((m) => ({ default: m.StatusCustomerDialog })),
  { ssr: false }
);

const EVENT_LABELS: Record<CarEventType, string> = {
  created: "Created",
  moved: "Moved",
  status_changed: "Status changed",
  battery_updated: "Battery updated",
  pdi_updated: "PDI updated",
  details_updated: "Details updated",
  note_added: "Note added",
};

type ChecklistSection = "base" | "inspections" | "customer" | "subdealer";

interface ChecklistItem {
  key: string;
  label: string;
  section: ChecklistSection;
  isFilled: boolean;
  editTarget?:
    | { type: "edit"; fieldId?: string }
    | { type: "statusDialog" }
    | { type: "uneditable" };
}

interface ChecklistResult {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
}

function computeChecklist(car: CarDisplay): ChecklistResult {
  const baseItems: ChecklistItem[] = [
    {
      key: "vin",
      label: "VIN Number",
      section: "base",
      isFilled: !!car.vin?.trim(),
      editTarget: { type: "uneditable" },
    },
    {
      key: "model",
      label: "Model",
      section: "base",
      isFilled: !!car.model?.trim(),
      editTarget: { type: "uneditable" },
    },
    {
      key: "suffix",
      label: "Suffix",
      section: "base",
      isFilled: !!car.suffix?.trim(),
      editTarget: { type: "edit", fieldId: "suffix" },
    },
    {
      key: "model_year",
      label: "Year",
      section: "base",
      isFilled: car.model_year != null,
      editTarget: { type: "uneditable" },
    },
    {
      key: "exterior_color",
      label: "Exterior Color",
      section: "base",
      isFilled: !!car.exterior_color?.trim(),
      editTarget: { type: "edit", fieldId: "exterior" },
    },
    {
      key: "interior_color",
      label: "Interior Color",
      section: "base",
      isFilled: !!car.interior_color?.trim(),
      editTarget: { type: "edit", fieldId: "interior" },
    },
    {
      key: "engine_number",
      label: "Engine Number",
      section: "base",
      isFilled: !!car.engine_number?.trim(),
      editTarget: { type: "edit", fieldId: "engineNumber" },
    },
    {
      key: "issue",
      label: "Issue",
      section: "base",
      isFilled: !!car.issue?.trim(),
      editTarget: { type: "edit", fieldId: "issue" },
    },
  ];

  const inspectionItems: ChecklistItem[] = [
    {
      key: "pdi_status",
      label: "PDI Status",
      section: "inspections",
      // Consider PDI "done" as complete; pending / in_progress need attention
      isFilled: car.pdi_status === "done",
      editTarget: { type: "edit", fieldId: "pdi" },
    },
    {
      key: "customs_status",
      label: "Customs Status",
      section: "inspections",
      // Consider cleared/exempt as complete; others need attention
      isFilled: car.customs_status === "cleared" || car.customs_status === "exempt",
      editTarget: { type: "edit", fieldId: "editCustomsStatus" },
    },
    {
      key: "warranty_per_dms",
      label: "Warranty Vehicle DMS",
      section: "inspections",
      isFilled: !!car.warranty_per_dms,
      editTarget: { type: "edit", fieldId: "editWarrantyDms" },
    },
    {
      key: "warranty_vehicle_expiry",
      label: "Warranty on Vehicle (Expiry)",
      section: "inspections",
      isFilled:
        !!(car as any).warranty_vehicle_expiry ||
        !!(car as any).warranty_expiry ||
        !!car.warranty_monza_start_date,
      editTarget: { type: "edit", fieldId: "editWarrantyVehicle" },
    },
    {
      key: "warranty_battery_expiry",
      label: "Warranty Battery Monza (Expiry)",
      section: "inspections",
      isFilled: !!(car as any).warranty_battery_expiry,
      editTarget: { type: "edit", fieldId: "editWarrantyBattery" },
    },
    {
      key: "warranty_monza_start_date",
      label: "Warranty Monza Start Date",
      section: "inspections",
      isFilled: !!car.warranty_monza_start_date,
      editTarget: { type: "edit", fieldId: "editWarrantyMonza" },
    },
  ];

  const customerItems: ChecklistItem[] = [];
  const subDealerItems: ChecklistItem[] = [];

  if (car.status === "sold") {
    customerItems.push(
      {
        key: "client_name",
        label: "Client Name",
        section: "customer",
        isFilled: !!car.client_name?.trim(),
        editTarget: { type: "statusDialog" },
      },
      {
        key: "client_phone",
        label: "Client Phone",
        section: "customer",
        isFilled: !!car.client_phone?.trim(),
        editTarget: { type: "statusDialog" },
      },
      {
        key: "delivery_date",
        label: "Delivery Date",
        section: "customer",
        isFilled: !!car.delivery_date,
        editTarget: { type: "statusDialog" },
      },
      {
        key: "sold_marker",
        label: "Sold Marker",
        section: "customer",
        isFilled: !!car.sold_marker?.trim(),
        editTarget: { type: "uneditable" },
      },
    );
  } else if (car.status === "reserved") {
    customerItems.push(
      {
        key: "client_name",
        label: "Client Name",
        section: "customer",
        isFilled: !!car.client_name?.trim(),
        editTarget: { type: "statusDialog" },
      },
      {
        key: "client_phone",
        label: "Client Phone",
        section: "customer",
        isFilled: !!car.client_phone?.trim(),
        editTarget: { type: "statusDialog" },
      },
      {
        key: "reserved_by",
        label: "Reserved By",
        section: "customer",
        isFilled: !!car.reserved_by?.trim(),
        editTarget: { type: "uneditable" },
      },
    );
  } else if (car.status === "sent_to_sub_dealer") {
    subDealerItems.push({
      key: "sub_dealer_name",
      label: "Sub-dealer Name",
      section: "subdealer",
      isFilled: !!car.sub_dealer_name?.trim(),
      editTarget: { type: "statusDialog" },
    });
  }

  const items = [...baseItems, ...inspectionItems, ...customerItems, ...subDealerItems];
  const totalCount = items.length;
  const completedCount = items.filter((i) => i.isFilled).length;
  const percent = totalCount === 0 ? 100 : Math.round((completedCount / totalCount) * 100);

  return { items, completedCount, totalCount, percent };
}

function getEventActor(ev: CarEvent): string {
  const name = getProfileFullName(ev.profiles);
  return (name !== "Unknown" && name.trim() && ev.created_by) ? name : "System";
}

/** Statuses that show the customer / sale dates section on the vehicle page */
const CUSTOMER_RELATED_STATUSES: CarStatus[] = [
  "sold",
  "reserved",
  "sent_to_sub_dealer",
  "delivered",
  "registered",
  "under_registration",
];

/** Empty string → null for Postgres DATE */
function normalizeDateForDb(value: string): string | null {
  const t = value.trim();
  return t.length === 0 ? null : t;
}

/** Client-side validation for optional date inputs (YYYY-MM-DD). */
function validateOptionalIsoDate(value: string, fieldLabel: string): string | null {
  const t = value.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return `${fieldLabel}: use a valid date (YYYY-MM-DD).`;
  }
  const time = Date.parse(`${t}T12:00:00`);
  if (Number.isNaN(time)) return `${fieldLabel}: invalid date.`;
  return null;
}

/** Default sales_orders.status when inserting from the vehicle page (matches status dialog). */
function defaultSalesOrderStatusForCar(carStatus: CarStatus): "reserved" | "confirmed" {
  return carStatus === "reserved" ? "reserved" : "confirmed";
}

function validateSaleOrderDateOrdering(
  reservation: string | null,
  delivery: string | null,
  bought: string | null
): string | null {
  const parse = (s: string | null) =>
    s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T12:00:00`) : NaN;
  const r = parse(reservation);
  const d = parse(delivery);
  const b = parse(bought);
  if (!Number.isNaN(r) && !Number.isNaN(d) && r > d) {
    return "Reservation date cannot be after delivery date.";
  }
  if (!Number.isNaN(b) && !Number.isNaN(d) && b > d) {
    return "Date Bought cannot be after delivery date.";
  }
  return null;
}

/** Raw public.cars columns (not cars_display) for legacy display + date prefill when no sales_orders row */
type LegacyCarFields = {
  customer_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  reservation_date: string | null;
  delivery_date: string | null;
  reserved_by: string | null;
};

type SalesOrderDetail = {
  id: string;
  customer_id: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string | null;
    phone_primary?: string | null;
    email?: string | null;
  } | null;
  status?: string;
  date_bought: string | null;
  delivery_date: string | null;
  reservation_date: string | null;
  reserved_by: string | null;
};

function formatEventDisplay(ev: CarEvent): string {
  const actor = getEventActor(ev);
  const from = ev.from_value ?? "";
  const to = ev.to_value ?? "";
  switch (ev.event_type) {
    case "status_changed":
      return from && to
        ? `${actor} changed status from ${from} to ${to}`
        : to
          ? `${actor} changed status to ${to}`
          : `${actor} changed status`;
    case "moved":
      return from && to
        ? `${actor} moved from ${from} to ${to}`
        : to
          ? `${actor} moved to ${to}`
          : from
            ? `${actor} moved from ${from}`
            : `${actor} moved`;
    case "created":
      return `${actor} created the car`;
    case "battery_updated":
      return from && to
        ? `${actor} updated battery from ${from} to ${to}`
        : `${actor} updated battery`;
    case "pdi_updated":
      return from && to
        ? `${actor} updated PDI from ${from} to ${to}`
        : `${actor} updated PDI`;
    case "details_updated":
      return `${actor} updated details`;
    case "note_added":
      return `${actor} added a note`;
    default:
      return from && to
        ? `${actor}: ${from} → ${to}`
        : `${actor}: ${ev.event_type}`;
  }
}

export default function CarProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    canEditInventory,
    profile,
    appRole,
    canOpenCarEditDialog,
    canEditPdiStatusOnCar,
  } = useUser();
  const canDeleteCar = canPerform("cars", "delete", appRole ?? null);
  const param = params.id as string;
  // Support lookup by VIN (17 alphanumeric) or by UUID
  const isVin = /^[A-HJ-NPR-Z0-9]{17}$/i.test(param);
  const [car, setCar] = useState<CarDisplay | null>(null);
  const [events, setEvents] = useState<CarEvent[]>([]);
  const [partsUsed, setPartsUsed] = useState<
    { part_name: string; oe_number: string | null; quantity: number; job_title: string; job_id: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [moveOpen, setMoveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pdiOpen, setPdiOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [visitsMaintenanceOpen, setVisitsMaintenanceOpen] = useState(false);
  const [visitsMaintenanceMode, setVisitsMaintenanceMode] = useState<
    "garage" | "maintenance"
  >("garage");
  const [salesOrder, setSalesOrder] = useState<SalesOrderDetail | null>(null);
  const [legacyCarSnapshot, setLegacyCarSnapshot] = useState<LegacyCarFields | null>(null);
  const [reservationDateInput, setReservationDateInput] = useState("");
  const [deliveryDateInput, setDeliveryDateInput] = useState("");
  const [dateBoughtInput, setDateBoughtInput] = useState("");
  const [saleDatesSaving, setSaleDatesSaving] = useState(false);
  const [saleDatesError, setSaleDatesError] = useState<string | null>(null);
  const [linkCustomerOpen, setLinkCustomerOpen] = useState(false);
  const [statusDialogPreset, setStatusDialogPreset] = useState<CarStatus | null>(null);
  const [quickFieldSaving, setQuickFieldSaving] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [pendingFieldFocusId, setPendingFieldFocusId] = useState<string | null>(null);
  const [activeTestDriveBanner, setActiveTestDriveBanner] = useState<{
    id: string;
    test_drive_start_at: string;
    employee_name: string | null;
  } | null>(null);

  const supabase = createClient();

  async function fetchLegacyCarSnapshot(carId: string) {
    const { data, error } = await supabase
      .from("cars")
      .select(
        "customer_id, client_name, client_phone, reservation_date, delivery_date, reserved_by"
      )
      .eq("id", carId)
      .maybeSingle();
    if (error || !data) {
      setLegacyCarSnapshot(null);
      return;
    }
    setLegacyCarSnapshot(data as LegacyCarFields);
  }

  async function fetchSalesOrderForCar(carId: string) {
    const { data, error } = await supabase
      .from("sales_orders")
      .select(
        "id, car_id, customer_id, reservation_date, delivery_date, date_bought, created_at, status, reserved_by, customers(id, first_name, last_name, phone_primary, email)"
      )
      .eq("car_id", carId)
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      setSalesOrder(null);
      return;
    }

    type Row = {
      id: string;
      car_id: string;
      customer_id: string | null;
      reservation_date?: string | null;
      delivery_date?: string | null;
      date_bought?: string | null;
      created_at: string;
      status?: string;
      reserved_by?: string | null;
      customers: SalesOrderDetail["customer"];
    };

    if (!data) {
      setSalesOrder(null);
      return;
    }

    const row = data as unknown as Row;

    let customer = row.customers;
    if (Array.isArray(customer)) {
      customer = customer[0] ?? null;
    }
    setSalesOrder({
      id: row.id,
      customer_id: row.customer_id ?? null,
      customer,
      status: row.status,
      date_bought: row.date_bought ?? null,
      delivery_date: row.delivery_date ?? null,
      reservation_date: row.reservation_date ?? null,
      reserved_by: row.reserved_by ?? null,
    });
  }

  /**
   * For INSERT into sales_orders: cars.customer_id → latest sales_orders row (any status) → payment_plans.
   */
  async function resolveCustomerIdForNewSalesOrder(carId: string): Promise<string | null> {
    const { data: carRow, error: carErr } = await supabase
      .from("cars")
      .select("customer_id")
      .eq("id", carId)
      .maybeSingle();
    if (!carErr && carRow && (carRow as { customer_id?: string | null }).customer_id) {
      return (carRow as { customer_id: string }).customer_id;
    }
    const { data: anyOrder } = await supabase
      .from("sales_orders")
      .select("customer_id")
      .eq("car_id", carId)
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anyOrder && (anyOrder as { customer_id?: string | null }).customer_id) {
      return (anyOrder as { customer_id: string }).customer_id;
    }
    const { data: plan } = await supabase
      .from("payment_plans")
      .select("customer_id")
      .eq("car_id", carId)
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return plan?.customer_id ?? null;
  }

  async function handleSaveSaleDates() {
    if (!car || !canEditInventory) return;
    const carId = car.id;
    setSaleDatesSaving(true);
    setSaleDatesError(null);
    try {
      const reservation_date = normalizeDateForDb(reservationDateInput);
      const delivery_date = normalizeDateForDb(deliveryDateInput);
      const date_bought = normalizeDateForDb(dateBoughtInput);

      for (const err of [
        validateOptionalIsoDate(reservationDateInput, "Reservation date"),
        validateOptionalIsoDate(deliveryDateInput, "Delivery date"),
        validateOptionalIsoDate(dateBoughtInput, "Date Bought"),
      ]) {
        if (err) {
          setSaleDatesError(err);
          toast.error(err);
          return;
        }
      }
      const orderErr = validateSaleOrderDateOrdering(
        reservation_date,
        delivery_date,
        date_bought
      );
      if (orderErr) {
        setSaleDatesError(orderErr);
        toast.error(orderErr);
        return;
      }

      const { data: salesOrder, error: fetchError } = await supabase
        .from("sales_orders")
        .select("id, car_id, customer_id, reservation_date, delivery_date, date_bought, created_at")
        .eq("car_id", carId)
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        const m =
          fetchError && typeof fetchError === "object" && "message" in fetchError
            ? String((fetchError as { message: string }).message)
            : "Could not load sales order";
        throw new Error(m);
      }

      if (salesOrder?.id) {
        const { error: updateError } = await supabase
          .from("sales_orders")
          .update({
            reservation_date,
            delivery_date,
            date_bought,
          })
          .eq("id", salesOrder.id);

        if (updateError) {
          const m =
            updateError.message ||
            (typeof updateError === "object" && "details" in updateError
              ? String((updateError as { details?: string }).details)
              : "Update failed");
          throw new Error(m);
        }
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("Not authenticated");
        }
        const customerId = await resolveCustomerIdForNewSalesOrder(carId);
        const { error: insertError } = await supabase.from("sales_orders").insert({
          car_id: carId,
          customer_id: customerId ?? null,
          status: defaultSalesOrderStatusForCar(car.status),
          created_by: user.id,
          currency: "USD",
          reservation_date,
          delivery_date,
          date_bought,
        });

        if (insertError) {
          const m =
            insertError.message ||
            (typeof insertError === "object" && "details" in insertError
              ? String((insertError as { details?: string }).details)
              : "Insert failed");
          throw new Error(m);
        }
      }

      toast.success("Saved reservation, delivery, and date bought to public.sales_orders.");
      await fetchCar();
      await fetchSalesOrderForCar(carId);
      await fetchLegacyCarSnapshot(carId);
      await fetchEvents();
      router.refresh();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Failed to save to sales_orders";
      setSaleDatesError(msg);
      toast.error(msg, { description: "Only public.sales_orders is updated (not cars_display)." });
    } finally {
      setSaleDatesSaving(false);
    }
  }

  async function copyVinToClipboard() {
    if (!car?.vin) return;
    await navigator.clipboard.writeText(car.vin);
    toast.success("VIN copied");
  }

  async function saveQuickCarField(
    patch: Partial<{
      status: CarStatus;
      customs_status: CustomsStatus;
      location_type: LocationType;
    }>
  ) {
    if (!car || !canEditInventory) return;
    const prev = car;
    setQuickFieldSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const updates: Record<string, unknown> = {
        ...patch,
        updated_at: new Date().toISOString(),
      };
      if (patch.status != null) {
        updates.status_changed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("cars").update(updates).eq("id", car.id);
      if (error) {
        toast.error(error.message ?? "Update failed");
        return;
      }
      if (patch.status != null && patch.status !== prev.status) {
        await supabase.from("car_events").insert({
          car_id: car.id,
          event_type: "status_changed",
          from_value: prev.status,
          to_value: patch.status,
          created_by: user?.id ?? null,
        });
      } else if (patch.customs_status != null || patch.location_type != null) {
        const note =
          patch.customs_status != null
            ? `Customs status → ${patch.customs_status}`
            : `Location type → ${patch.location_type}`;
        await supabase.from("car_events").insert({
          car_id: car.id,
          event_type: "details_updated",
          note,
          created_by: user?.id ?? null,
        });
      }
      toast.success("Saved");
      await fetchCar();
      await fetchEvents();
      router.refresh();
    } finally {
      setQuickFieldSaving(false);
    }
  }

  function onQuickStatusChange(value: string) {
    const ns = value as CarStatus;
    if (CUSTOMER_RELATED_STATUSES.includes(ns)) {
      setStatusDialogPreset(ns);
      setLinkCustomerOpen(true);
      return;
    }
    void saveQuickCarField({ status: ns });
  }

  async function fetchCar() {
    const query = supabase.from("cars_display").select("*");
    const { data, error } = isVin
      ? await query.eq("vin", param.toUpperCase()).maybeSingle()
      : await query.eq("id", param).single();

    if (error || !data) {
      setCar(null);
      return;
    }
    setCar(data as CarDisplay);
  }

  async function fetchEvents() {
    if (!car?.id) return;
    const { data, error } = await supabase
      .from("car_events")
      .select("*, profiles:created_by(full_name)")
      .eq("car_id", car.id)
      .order("created_at", { ascending: false });

    if (error) {
      const { data: fallback } = await supabase
        .from("car_events")
        .select("*")
        .eq("car_id", car.id)
        .order("created_at", { ascending: false });
      setEvents((fallback as CarEvent[]) ?? []);
      return;
    }
    setEvents((data as CarEvent[]) ?? []);
  }

  useEffect(() => {
    if (!param) return;
    setLoading(true);
    fetchCar().finally(() => setLoading(false));
  }, [param]);

  useEffect(() => {
    if (!car?.id) return;
    fetchEvents();
  }, [car?.id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client stable; refetch when car changes
  useEffect(() => {
    if (!car?.id) {
      setActiveTestDriveBanner(null);
      return;
    }
    (async () => {
      const { data, error } = await fetchActiveTestDriveForCar(supabase, car.id);
      if (error || !data) {
        setActiveTestDriveBanner(null);
        return;
      }
      setActiveTestDriveBanner({
        id: data.id,
        test_drive_start_at: data.test_drive_start_at,
        employee_name: data.employee_name,
      });
    })();
  }, [car?.id]);

  useEffect(() => {
    if (!car?.id) return;
    (async () => {
      const { data: jobs } = await supabase
        .from("garage_jobs")
        .select("id, title")
        .eq("car_id", car.id)
        .is("deleted_at", null);
      const jobIds = jobs?.map((j) => j.id) ?? [];
      if (jobIds.length === 0) {
        setPartsUsed([]);
        return;
      }
      const { data } = await supabase
        .from("job_parts")
        .select("job_id, quantity, parts:part_id(part_name, oe_number)")
        .in("job_id", jobIds);
      const jobMap = Object.fromEntries((jobs ?? []).map((j) => [j.id, j.title ?? ""]));
      const rows = (data as { job_id: string; quantity: number; parts: { part_name: string; oe_number: string | null } | null }[] | null) ?? [];
      setPartsUsed(
        rows.map((r) => {
          const part = r.parts;
          return {
            part_name: part?.part_name ?? "—",
            oe_number: part?.oe_number ?? null,
            quantity: r.quantity,
            job_title: jobMap[r.job_id] ?? "—",
            job_id: r.job_id,
          };
        })
      );
    })();
  }, [car?.id]);

  useEffect(() => {
    const open = searchParams.get("open");
    if (open === "garage" || open === "maintenance") {
      setVisitsMaintenanceMode(open);
      setVisitsMaintenanceOpen(true);
      router.replace(`/cars/${encodeURIComponent(param)}`, { scroll: false });
    }
  }, [searchParams, param, router]);

  useEffect(() => {
    if (!car?.created_by) {
      setCreatedByName(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", car.created_by)
        .single();
      setCreatedByName(data?.full_name ?? null);
    })();
  }, [car?.created_by]);

  useEffect(() => {
    if (!car?.id) return;
    void fetchSalesOrderForCar(car.id);
    void fetchLegacyCarSnapshot(car.id);
  }, [car?.id]);

  // Prefill dates: latest sales_orders row wins; reservation/delivery may fall back to public.cars;
  // Date Bought on cars_display reflects sales_orders and prefills when there is no row yet.
  useEffect(() => {
    if (salesOrder) {
      setReservationDateInput(
        salesOrder.reservation_date ? salesOrder.reservation_date.slice(0, 10) : ""
      );
      setDeliveryDateInput(
        salesOrder.delivery_date ? salesOrder.delivery_date.slice(0, 10) : ""
      );
      setDateBoughtInput(
        salesOrder.date_bought
          ? salesOrder.date_bought.slice(0, 10)
          : car?.date_bought
            ? car.date_bought.slice(0, 10)
            : ""
      );
      return;
    }
    setReservationDateInput(
      legacyCarSnapshot?.reservation_date
        ? legacyCarSnapshot.reservation_date.slice(0, 10)
        : ""
    );
    setDeliveryDateInput(
      legacyCarSnapshot?.delivery_date
        ? legacyCarSnapshot.delivery_date.slice(0, 10)
        : ""
    );
    setDateBoughtInput(car?.date_bought ? car.date_bought.slice(0, 10) : "");
  }, [salesOrder, legacyCarSnapshot, car?.date_bought]);

  const hasConfirmedSaleButWrongStatus =
    car &&
    salesOrder?.customer &&
    salesOrder?.status === "confirmed" &&
    (car.status === "registered" || car.status === "under_registration");

  async function handleUpdateToSold() {
    if (!car || !canEditInventory) return;
    const { error } = await supabase
      .from("cars")
      .update({ status: "sold" })
      .eq("id", car.id);
    if (error) {
      toast.error(error.message ?? "Failed to update status");
      return;
    }
    toast.success("Status updated to Sold");
    fetchCar();
    fetchEvents();
  }

  function onMoved() {
    setMoveOpen(false);
    fetchCar();
    fetchEvents();
  }

  function onEdited() {
    setEditOpen(false);
    fetchCar();
    fetchEvents();
  }

  function onLinkCustomerSuccess() {
    setLinkCustomerOpen(false);
    void fetchCar();
    if (car?.id) {
      void fetchSalesOrderForCar(car.id);
      void fetchLegacyCarSnapshot(car.id);
      void fetchEvents();
    }
    router.refresh();
  }

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!editOpen || !pendingFieldFocusId) return;
    if (typeof document === "undefined") return;
    const timeout = window.setTimeout(() => {
      const el = document.getElementById(pendingFieldFocusId);
      if (el && "focus" in el) {
        (el as HTMLElement).focus();
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      setPendingFieldFocusId(null);
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [editOpen, pendingFieldFocusId]);

  async function handleDelete() {
    if (!car || !profile) return;
    if (!canDeleteCar) {
      toast.error("Only owners can delete vehicles.");
      return;
    }

    setDeleteError(null);
    setDeleteLoading(true);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) {
      setDeleteLoading(false);
      toast.error("Unable to verify current user. Please sign in again.");
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: deletePassword,
    });

    if (authError) {
      setDeleteLoading(false);
      setDeleteError("Incorrect password");
      return;
    }

    const res = await fetch(`/api/cars/${car.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const body = await res.json().catch(() => ({}));

    setDeleteLoading(false);

    if (!res.ok) {
      const msg =
        typeof body?.error === "string" ? body.error : `Delete failed (${res.status})`;
      toast.error(
        res.status === 403
          ? "You don't have permission to do this."
          : msg
      );
      return;
    }

    toast.success("Car removed successfully");
    setDeletePassword("");
    setDeleteOpen(false);
    router.push("/cars");
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!car || !noteText.trim()) return;

    setNoteSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("car_events").insert({
      car_id: car.id,
      event_type: "note_added",
      note: noteText.trim(),
      created_by: user?.id ?? null,
    });

    setNoteSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Note added");
    setNoteText("");
    setAddNoteOpen(false);
    fetchEvents();
  }

  const checklist = useMemo(
    () =>
      car
        ? computeChecklist(car)
        : { items: [], completedCount: 0, totalCount: 0, percent: 0 },
    [car]
  );
  const hasIncomplete =
    checklist.totalCount > 0 && checklist.completedCount < checklist.totalCount;

  const missingItems = checklist.items.filter((item) => !item.isFilled);

  function getProgressBarColor(percent: number): string {
    if (percent < 50) return "bg-red-500 dark:bg-red-600";
    if (percent < 80) return "bg-amber-500 dark:bg-amber-500";
    return "bg-emerald-500 dark:bg-emerald-500";
  }

  function handleChecklistItemClick(item: ChecklistItem) {
    if (item.isFilled) return;
    if (item.editTarget?.type === "edit") {
      if (item.editTarget.fieldId === "pdi") {
        setChecklistOpen(false);
        setPdiOpen(true);
        return;
      }
      if (item.editTarget.fieldId) {
        if (!canOpenCarEditDialog) {
          toast.info("You don't have permission to edit this vehicle.");
          return;
        }
        setChecklistOpen(false);
        setPendingFieldFocusId(item.editTarget.fieldId);
        setEditOpen(true);
        return;
      }
      toast.info("This field is not directly editable here.");
      return;
    }
    if (item.editTarget?.type === "statusDialog") {
      setChecklistOpen(false);
      setLinkCustomerOpen(true);
      return;
    }
    if (item.editTarget?.type === "uneditable") {
      toast.info("This field can only be updated from the import or creation flows.");
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-8">
        <Button variant="ghost" asChild>
          <Link href="/cars">← Back to Cars</Link>
        </Button>
        <p className="text-muted-foreground">Car not found.</p>
      </div>
    );
  }

  const statusBadgeClass =
    STATUS_BADGE_COLORS[car.status] ?? "bg-muted text-muted-foreground";
  const pdiBadgeClass =
    PDI_BADGE_COLORS[car.pdi_status] ?? "bg-muted text-muted-foreground";

  const movedEvents = events.filter((e) => e.event_type === "moved");
  const visitEvents = movedEvents.map((ev) => {
    const toVal = (ev.to_value ?? "").toLowerCase();
    return {
      ...ev,
      visitType: toVal.includes("garage") ? "garage" as const : "company_entry" as const,
    };
  });
  const garageEvents = visitEvents.filter((v) => v.visitType === "garage");
  const maintenanceEvents = events.filter(
    (e) => e.event_type === "status_changed" && e.to_value === "service"
  );

  const eventsByDate = events.reduce<Record<string, CarEvent[]>>((acc, ev) => {
    const d = new Date(ev.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});
  const sortedDates = Object.keys(eventsByDate).sort((a, b) => b.localeCompare(a));

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
          <div>
            <h1 className="break-all font-mono text-lg font-semibold sm:text-xl">
              VIN: {car.vin}
            </h1>
            <p className="text-muted-foreground text-sm">
              {car.brand} {car.model} {car.model_year ? `(${car.model_year})` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasIncomplete ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>
                  Incomplete — {missingItems.length}{" "}
                  {missingItems.length === 1 ? "item" : "items"} need attention
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                <span>Complete</span>
              </div>
            )}
            {hasIncomplete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setChecklistOpen(true)}
              >
                Checklist
              </Button>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {canOpenCarEditDialog && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            )}
            <Button variant="outline" onClick={() => setMoveOpen(true)}>
              Move location
            </Button>
            {canDeleteCar && (
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {activeTestDriveBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-500/50 bg-violet-500/10 px-4 py-3 text-sm">
          <p className="text-violet-950 dark:text-violet-100">
            <strong>Test drive in progress</strong> since{" "}
            {new Date(activeTestDriveBanner.test_drive_start_at).toLocaleString()}
            {activeTestDriveBanner.employee_name ? (
              <> · Staff: {activeTestDriveBanner.employee_name}</>
            ) : null}
            .
          </p>
          <Button size="sm" variant="secondary" asChild>
            <Link href="/test-drive">Open Test Drive</Link>
          </Button>
        </div>
      )}

      {hasConfirmedSaleButWrongStatus && canEditInventory && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This car has a linked customer with a confirmed sale but status is still{" "}
            <strong>{car.status_display ?? car.status}</strong>. Should it be updated to Sold?
          </p>
          <Button size="sm" variant="outline" onClick={() => void handleUpdateToSold()}>
            Update to Sold
          </Button>
        </div>
      )}

      <MoveCarDialog
        carId={car.id}
        currentLocationType={car.location_type}
        currentStatus={car.status}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onSuccess={onMoved}
      />

      <EditCarDialog
        car={car}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onEdited}
      />

      <PdiStatusDialog
        car={car}
        open={pdiOpen}
        onOpenChange={setPdiOpen}
        onSuccess={() => {
          setPdiOpen(false);
          fetchCar();
          fetchEvents();
        }}
      />

      <StatusCustomerDialog
        car={car}
        open={linkCustomerOpen}
        onOpenChange={(o) => {
          setLinkCustomerOpen(o);
          if (!o) setStatusDialogPreset(null);
        }}
        presetTargetStatus={statusDialogPreset}
        onSuccess={onLinkCustomerSuccess}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm deletion — enter your password to permanently delete this vehicle
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action is irreversible. Please confirm your password to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {canDeleteCar ? (
            <div className="space-y-2">
              <Label htmlFor="delete-password-detail">Password</Label>
              <Input
                id="delete-password-detail"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only owners can delete vehicles.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteLoading || !deletePassword || !canDeleteCar}
              onClick={() => void handleDelete()}
            >
              {deleteLoading ? "Deleting..." : "Confirm Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedDateStr && (
        <DayDetailDialog
          open={dayDetailOpen}
          onOpenChange={setDayDetailOpen}
          dateStr={selectedDateStr}
          dayEvents={eventsByDate[selectedDateStr] ?? []}
          carId={car.id}
          carVin={car.vin}
          eventLabels={EVENT_LABELS}
          formatEventDisplay={formatEventDisplay}
          onRefresh={() => {
            fetchEvents();
          }}
        />
      )}

      <VisitsMaintenanceDialog
        open={visitsMaintenanceOpen}
        onOpenChange={setVisitsMaintenanceOpen}
        mode={visitsMaintenanceMode}
        events={
          visitsMaintenanceMode === "garage"
            ? (garageEvents as CarEvent[])
            : maintenanceEvents
        }
        eventLabels={EVENT_LABELS}
        formatEventDisplay={formatEventDisplay}
        onOpenDay={(dateStr) => {
          setSelectedDateStr(dateStr);
          setDayDetailOpen(true);
        }}
      />

      <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Car Completion Checklist</DialogTitle>
            <DialogDescription>
              Make sure all core vehicle, compliance, and customer fields are complete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Progress: {checklist.completedCount} of {checklist.totalCount} fields
                complete ({checklist.percent}%)
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${getProgressBarColor(checklist.percent)}`}
                  style={{ width: `${checklist.percent}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Base Information
                </p>
                <div className="mt-2 space-y-1.5">
                  {checklist.items
                    .filter((i) => i.section === "base")
                    .map((item) => {
                      const isMissing = !item.isFilled;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                            isMissing
                              ? "hover:bg-amber-500/10"
                              : "hover:bg-emerald-500/5"
                          }`}
                          onClick={() => handleChecklistItemClick(item)}
                        >
                          <span className="flex items-center gap-2">
                            {item.isFilled ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                                <X className="h-3 w-3" />
                              </span>
                            )}
                            <span>{item.label}</span>
                          </span>
                          {!item.isFilled && (
                            <span className="text-xs font-medium text-red-600 dark:text-red-400">
                              Missing
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Inspections &amp; Compliance
                </p>
                <div className="mt-2 space-y-1.5">
                  {checklist.items
                    .filter((i) => i.section === "inspections")
                    .map((item) => {
                      const isMissing = !item.isFilled;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                            isMissing
                              ? "hover:bg-amber-500/10"
                              : "hover:bg-emerald-500/5"
                          }`}
                          onClick={() => handleChecklistItemClick(item)}
                        >
                          <span className="flex items-center gap-2">
                            {item.isFilled ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                                <X className="h-3 w-3" />
                              </span>
                            )}
                            <span>{item.label}</span>
                          </span>
                          {!item.isFilled && (
                            <span className="text-xs font-medium text-red-600 dark:text-red-400">
                              Missing
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              {checklist.items.some((i) => i.section === "customer") && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Customer Information
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {checklist.items
                      .filter((i) => i.section === "customer")
                      .map((item) => {
                        const isMissing = !item.isFilled;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                              isMissing
                                ? "hover:bg-amber-500/10"
                                : "hover:bg-emerald-500/5"
                            }`}
                            onClick={() => handleChecklistItemClick(item)}
                          >
                            <span className="flex items-center gap-2">
                              {item.isFilled ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                                  <Check className="h-3 w-3" />
                                </span>
                              ) : (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                                  <X className="h-3 w-3" />
                                </span>
                              )}
                              <span>{item.label}</span>
                            </span>
                            {!item.isFilled && (
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                Missing
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {checklist.items.some((i) => i.section === "subdealer") && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Sub-dealer Information
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {checklist.items
                      .filter((i) => i.section === "subdealer")
                      .map((item) => {
                        const isMissing = !item.isFilled;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                              isMissing
                                ? "hover:bg-amber-500/10"
                                : "hover:bg-emerald-500/5"
                            }`}
                            onClick={() => handleChecklistItemClick(item)}
                          >
                            <span className="flex items-center gap-2">
                              {item.isFilled ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                                  <Check className="h-3 w-3" />
                                </span>
                              ) : (
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
                                  <X className="h-3 w-3" />
                                </span>
                              )}
                              <span>{item.label}</span>
                            </span>
                            {!item.isFilled && (
                              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                Missing
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setChecklistOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Movement / Status history</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Section 1: Vehicle Info */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Info</CardTitle>
              <CardDescription>Brand, model, colors, status</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Full VIN</p>
                <p
                  className="cursor-pointer font-mono text-sm hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyVinToClipboard();
                  }}
                  title="Click to copy"
                >
                  {car.vin}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Brand</p>
                <p>{car.brand}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Model</p>
                <p>{car.model}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Year</p>
                <p>{car.model_year ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Exterior Color</p>
                <p>{car.exterior_color ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Interior Color</p>
                <p>{car.interior_color ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Plate Number</p>
                <p>{car.plate_number ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Suffix</p>
                <p className="font-mono text-sm">{car.suffix ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Status</p>
                {canEditInventory ? (
                  <Select
                    value={car.status}
                    onValueChange={onQuickStatusChange}
                    disabled={quickFieldSaving}
                  >
                    <SelectTrigger className="max-w-xs" id="car-quick-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CAR_STATUS_LABELS) as CarStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {CAR_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={statusBadgeClass}>
                    {car.status_display ?? car.status}
                  </Badge>
                )}
                {canEditInventory && (
                  <p className="text-xs text-muted-foreground">
                    Customer-related statuses open the status &amp; customer dialog.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Engine Number</p>
                <p className="font-mono text-sm">{(car as { engine_number?: string }).engine_number ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Software Update</p>
                <p className="text-sm">{(car as { software_update?: string }).software_update ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Dongle</p>
                <p className="text-sm">{(car as { dongle?: string }).dongle ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Issue / Notes</p>
                <p className="text-sm">{(car as { issue?: string }).issue ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Vehicle Type</p>
                <Badge
                  className={
                    (car as { is_erev?: boolean }).is_erev
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  }
                >
                  {(car as { is_erev?: boolean }).is_erev ? "EREV" : "Pure EV"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Sales order dates — always shown; writes only to public.sales_orders (views are read-only) */}
          <Card>
            <CardHeader>
              <CardTitle>Sales order dates</CardTitle>
              <CardDescription>
                Loads the latest non-cancelled <span className="font-mono text-[11px]">sales_orders</span> row for
                this <span className="font-mono text-[11px]">car_id</span>. Saving updates that row or inserts a new
                one. Do not write to <span className="font-mono text-[11px]">cars_display</span> /{" "}
                <span className="font-mono text-[11px]">cars_with_sales</span> — they are read-only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {canEditInventory ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="sale-reservation-date-global">Reservation date</Label>
                      <Input
                        id="sale-reservation-date-global"
                        type="date"
                        value={reservationDateInput}
                        onChange={(e) => setReservationDateInput(e.target.value)}
                        disabled={saleDatesSaving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale-delivery-date-global">Delivery date</Label>
                      <Input
                        id="sale-delivery-date-global"
                        type="date"
                        value={deliveryDateInput}
                        onChange={(e) => setDeliveryDateInput(e.target.value)}
                        disabled={saleDatesSaving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale-date-bought-global">Date Bought</Label>
                      <Input
                        id="sale-date-bought-global"
                        type="date"
                        value={dateBoughtInput}
                        onChange={(e) => setDateBoughtInput(e.target.value)}
                        disabled={saleDatesSaving}
                      />
                    </div>
                  </div>
                  {saleDatesError && (
                    <p className="flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{saleDatesError}</span>
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSaveSaleDates()}
                    disabled={saleDatesSaving}
                  >
                    {saleDatesSaving ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save to sales_orders"
                    )}
                  </Button>
                </>
              ) : (
                <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                  <p>
                    <span className="font-medium text-foreground">Reservation:</span>{" "}
                    {salesOrder?.reservation_date
                      ? new Date(salesOrder.reservation_date).toLocaleDateString()
                      : legacyCarSnapshot?.reservation_date
                        ? new Date(legacyCarSnapshot.reservation_date).toLocaleDateString()
                        : "—"}
                    {!salesOrder && legacyCarSnapshot?.reservation_date && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-500">
                        (car row)
                      </span>
                    )}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Delivery:</span>{" "}
                    {salesOrder?.delivery_date
                      ? new Date(salesOrder.delivery_date).toLocaleDateString()
                      : legacyCarSnapshot?.delivery_date
                        ? new Date(legacyCarSnapshot.delivery_date).toLocaleDateString()
                        : "—"}
                    {!salesOrder && legacyCarSnapshot?.delivery_date && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-500">
                        (car row)
                      </span>
                    )}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Date Bought:</span>{" "}
                    {car.date_bought
                      ? new Date(car.date_bought).toLocaleDateString()
                      : salesOrder?.date_bought
                        ? new Date(salesOrder.date_bought).toLocaleDateString()
                        : "—"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section: Customer — relational first, legacy clearly separated */}
          {CUSTOMER_RELATED_STATUSES.includes(car.status) && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Customer</CardTitle>
                  <CardDescription>Linked buyer for this vehicle</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {salesOrder?.customer ? (
                    <Link href={`/customers/${salesOrder.customer.id}`} className="block">
                      <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 transition-colors hover:bg-accent cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                            <User className="h-4 w-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {salesOrder.customer.first_name}{" "}
                              {salesOrder.customer.last_name ?? ""}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              View customer profile →
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          <p>
                            <span className="font-medium">Phone:</span>{" "}
                            {salesOrder.customer.phone_primary ?? "—"}
                          </p>
                          <p>
                            <span className="font-medium">Email:</span>{" "}
                            {salesOrder.customer.email ?? "—"}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ) : salesOrder?.customer_id ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                      <p className="text-sm text-muted-foreground">
                        Linked sales order exists, but the customer record could not be loaded.
                      </p>
                      <Button variant="outline" size="sm" className="w-fit" asChild>
                        <Link href={`/customers/${salesOrder.customer_id}`}>
                          Open customer by ID
                        </Link>
                      </Button>
                    </div>
                  ) : salesOrder?.id ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                      <p className="text-sm text-muted-foreground">
                        A sales order exists for this vehicle. Reservation and delivery dates can be
                        edited below. Link a customer to see profile details here.
                      </p>
                      {canEditInventory && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-fit text-xs"
                          onClick={() => setLinkCustomerOpen(true)}
                        >
                          Link customer
                        </Button>
                      )}
                    </div>
                  ) : car.client_name ? (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                        <User className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{car.client_name}</p>
                        <p className="text-amber-600 text-xs dark:text-amber-500">
                          Not linked to a customer profile yet
                        </p>
                      </div>
                      {canEditInventory && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-xs"
                          onClick={() => setLinkCustomerOpen(true)}
                        >
                          Link
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                        <User className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          Add customer
                        </p>
                        <p className="text-amber-600 text-xs dark:text-amber-500">
                          This status requires customer data
                        </p>
                      </div>
                      {canEditInventory && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-xs"
                          onClick={() => setLinkCustomerOpen(true)}
                        >
                          Add customer
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="text-muted-foreground border-t border-border pt-4 text-xs">
                    Edit reservation, delivery, and date bought in the <span className="font-medium">Sales order dates</span>{" "}
                    section above (writes to <span className="font-mono text-[11px]">public.sales_orders</span> only).
                  </p>
                </CardContent>
              </Card>

              {/* Legacy customer data — raw columns from public.cars (read-only) */}
              {legacyCarSnapshot &&
                (legacyCarSnapshot.customer_id ||
                  legacyCarSnapshot.client_name ||
                  legacyCarSnapshot.client_phone ||
                  legacyCarSnapshot.reservation_date ||
                  legacyCarSnapshot.delivery_date ||
                  legacyCarSnapshot.reserved_by) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">
                        Legacy / car-row reference
                      </CardTitle>
                      <CardDescription>
                        Raw <span className="font-mono text-[11px]">public.cars</span> fields (read-only in this
                        UI). Canonical sale dates live on <span className="font-mono text-[11px]">sales_orders</span>{" "}
                        after you save above.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        <span className="font-medium">Customer ID (car row):</span>{" "}
                        {legacyCarSnapshot.customer_id ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Client Name:</span>{" "}
                        {legacyCarSnapshot.client_name ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Client Phone:</span>{" "}
                        {legacyCarSnapshot.client_phone ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium">Reservation Date (car row):</span>{" "}
                        {legacyCarSnapshot.reservation_date
                          ? new Date(legacyCarSnapshot.reservation_date).toLocaleDateString()
                          : "—"}
                      </p>
                      <p>
                        <span className="font-medium">Delivery Date (car row):</span>{" "}
                        {legacyCarSnapshot.delivery_date
                          ? new Date(legacyCarSnapshot.delivery_date).toLocaleDateString()
                          : "—"}
                      </p>
                      <p>
                        <span className="font-medium">Reserved By:</span>{" "}
                        {legacyCarSnapshot.reserved_by ?? "—"}
                      </p>
                    </CardContent>
                  </Card>
                )}
            </>
          )}

          {/* Section 2: Location & Status */}
          <Card>
            <CardHeader>
              <CardTitle>Location & Status</CardTitle>
              <CardDescription>Where the vehicle is stored</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Location type</p>
                {canEditInventory ? (
                  <Select
                    value={car.location_type}
                    onValueChange={(v) =>
                      void saveQuickCarField({ location_type: v as LocationType })
                    }
                    disabled={quickFieldSaving}
                  >
                    <SelectTrigger className="max-w-xs" id="car-quick-location-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LOCATION_LABELS) as LocationType[]).map((lt) => (
                        <SelectItem key={lt} value={lt}>
                          {LOCATION_LABELS[lt]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p>
                    {car.location_full ??
                      (car.location_type
                        ? `${car.location_type}${car.location_slot ? ` · ${car.location_slot}` : ""}`
                        : "—")}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Location (display)</p>
                <p>
                  {car.location_full ??
                    (car.location_type
                      ? `${LOCATION_LABELS[car.location_type] ?? car.location_type}${car.location_slot ? ` · ${car.location_slot}` : ""}`
                      : "—")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Location Slot</p>
                <p>{car.location_slot ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Date Arrived</p>
                <p>
                  {car.date_arrived
                    ? new Date(car.date_arrived).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Days in Inventory</p>
                <p>{car.days_in_inventory != null ? car.days_in_inventory : "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Location Changed</p>
                <p>
                  {car.location_changed_at
                    ? new Date(car.location_changed_at).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Status Changed</p>
                <p>
                  {car.status_changed_at
                    ? new Date(car.status_changed_at).toLocaleString()
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Technical / EV */}
          <Card>
            <CardHeader>
              <CardTitle>Technical / EV</CardTitle>
              <CardDescription>Battery, KM, software, PDI</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Battery %</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {car.battery_percent != null ? `${car.battery_percent}%` : "—"}
                  </span>
                  {car.battery_percent != null && (
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${Math.min(100, Math.max(0, car.battery_percent))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">EV Range (km)</p>
                <p>{car.ev_range_km != null ? `${car.ev_range_km} km` : "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Current KM</p>
                <p>
                  {car.km_display ??
                    (car.current_km != null ? `${car.current_km} km` : "—")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Software Version</p>
                <p>{car.software_version ?? "—"}</p>
              </div>
              <div
                className={canEditPdiStatusOnCar ? "space-y-1 cursor-pointer" : "space-y-1"}
                onClick={(e) => {
                  e.stopPropagation();
                  setPdiOpen(true);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPdiOpen(true);
                  }
                }}
              >
                <p className="text-muted-foreground text-sm">PDI Status</p>
                <Badge
                  className={`${pdiBadgeClass} ${canEditPdiStatusOnCar ? "hover:opacity-80" : ""}`}
                >
                  {PDI_LABELS[car.pdi_status]}
                </Badge>
                {!canEditPdiStatusOnCar && (
                  <p className="text-muted-foreground text-xs">Tap to view</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Customs Status</p>
                {canEditInventory ? (
                  <Select
                    value={car.customs_status}
                    onValueChange={(v) =>
                      void saveQuickCarField({ customs_status: v as CustomsStatus })
                    }
                    disabled={quickFieldSaving}
                  >
                    <SelectTrigger className="max-w-xs" id="car-quick-customs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CUSTOMS_STATUS_LABELS) as CustomsStatus[]).map((cs) => (
                        <SelectItem key={cs} value={cs}>
                          {CUSTOMS_STATUS_LABELS[cs]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p>{CUSTOMS_STATUS_LABELS[car.customs_status] ?? car.customs_status}</p>
                )}
              </div>
              {(car as { is_erev?: boolean }).is_erev && (
                <>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Motor</p>
                    <p>{(car as { motor?: string }).motor ?? "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">EV KM</p>
                    <p>
                      {(car as { ev_km?: number }).ev_km != null
                        ? `${(car as { ev_km?: number }).ev_km} km`
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">Motor KM</p>
                    <p>
                      {(car as { motor_km?: number }).motor_km != null
                        ? `${(car as { motor_km?: number }).motor_km} km`
                        : "—"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Part Numbers Used */}
          <Card>
            <CardHeader>
              <CardTitle>Part Numbers Used</CardTitle>
              <CardDescription>
                Parts used on garage jobs for this vehicle
              </CardDescription>
            </CardHeader>
            <CardContent>
              {partsUsed.length === 0 ? (
                <p className="text-muted-foreground text-sm">No parts used yet.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground">
                    <span>Part Name</span>
                    <span>OE Number</span>
                    <span>Qty</span>
                    <span>Job</span>
                  </div>
                  {partsUsed.map((p, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-4 gap-2 rounded border p-2 text-sm"
                    >
                      <span>{p.part_name}</span>
                      <span className="font-mono">{p.oe_number ?? "—"}</span>
                      <span>{p.quantity}</span>
                      <Link
                        href={`/garage/jobs/${p.job_id}`}
                        className="text-primary hover:underline"
                      >
                        {p.job_title}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Additional notes for this vehicle</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">
                {car.notes?.trim() ?? "—"}
              </p>
            </CardContent>
          </Card>

          {/* Section 5: Record Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Record Info
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  Created by: {createdByName ?? "—"}
                </span>
                <span>
                  Created at:{" "}
                  {car.created_at
                    ? new Date(car.created_at).toLocaleString()
                    : "—"}
                </span>
                <span>
                  Updated at:{" "}
                  {car.updated_at
                    ? new Date(car.updated_at).toLocaleString()
                    : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <CarDocuments carId={car.id} carVin={car.vin} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Movement / Status history</CardTitle>
                  <CardDescription>Events for this car</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddNoteOpen(true)}
                >
                  Add Note
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {addNoteOpen && (
                <form
                  onSubmit={handleAddNote}
                  className="flex flex-col gap-2 rounded-lg border p-4"
                >
                  <Textarea
                    id="car-note-text"
                    name="car-note-text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                    required
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAddNoteOpen(false);
                        setNoteText("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={noteSubmitting || !noteText.trim()}
                    >
                      {noteSubmitting ? "Adding..." : "Add"}
                    </Button>
                  </div>
                </form>
              )}
              {events.length === 0 ? (
                <p className="text-muted-foreground">No events yet.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">
                    Click a date to open full history and attach files for that day.
                  </p>
                  {sortedDates.map((dateStr) => {
                    const dayEvents = eventsByDate[dateStr];
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50 hover:border-primary/50"
                        onClick={() => {
                          setSelectedDateStr(dateStr);
                          setDayDetailOpen(true);
                        }}
                      >
                        <span className="font-medium">
                          {formatDateLabel(dateStr)}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {dayEvents.length} event
                          {dayEvents.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-muted-foreground">→</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
