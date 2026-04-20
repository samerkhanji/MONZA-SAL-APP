"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { addDays, isWithinInterval, parseISO, startOfDay } from "date-fns";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MoreHorizontal, FileText, ScanLine, FileSpreadsheet } from "lucide-react";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay } from "@/types/database";
import {
  CAR_STATUS_LABELS,
  formatCarStatusLabel,
  LOCATION_LABELS,
  PDI_LABELS,
  CUSTOMS_STATUS_LABELS,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getPendingDeleteRequestsForItems } from "@/lib/delete-requests";
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";
import { canPerform } from "@/lib/permissions";
import { getCarsDisplay } from "@/lib/data/cars";
import { createClient } from "@/lib/supabase";

const ScannerDialog = dynamic(
  () => import("@/components/scanner/ScannerDialog").then((m) => ({ default: m.ScannerDialog })),
  { ssr: false }
);
const CustomsDialog = dynamic(
  () => import("@/components/customs-dialog").then((m) => ({ default: m.CustomsDialog })),
  { ssr: false }
);
const PdiStatusDialog = dynamic(
  () => import("@/components/pdi-status-dialog").then((m) => ({ default: m.PdiStatusDialog })),
  { ssr: false }
);
const MoveCarDialog = dynamic(
  () => import("@/components/move-car-dialog").then((m) => ({ default: m.MoveCarDialog })),
  { ssr: false }
);
const EditCarDialog = dynamic(
  () => import("@/components/edit-car-dialog").then((m) => ({ default: m.EditCarDialog })),
  { ssr: false }
);
const ImportExcelDialog = dynamic(
  () => import("@/components/ImportExcelDialog").then((m) => ({ default: m.ImportExcelDialog })),
  { ssr: false }
);

function fmtSheetDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

function warrantyVehicleExpiry(car: CarDisplay): string {
  const v =
    car.warranty_vehicle_expiry ?? car.warranty_expiry ?? car.warranty_monza_start_date;
  return fmtSheetDate(v ?? null);
}

const COL_EMPTY = "__empty__";
const FILTER_ALL = "all";

function dateKeyDb(v: string | null | undefined): string {
  if (!v) return COL_EMPTY;
  return String(v).slice(0, 10);
}

function locationTextForFilter(car: CarDisplay): string {
  return (
    car.location_full ??
    (car.location_type
      ? `${LOCATION_LABELS[car.location_type as keyof typeof LOCATION_LABELS] ?? car.location_type}${car.location_slot ? ` ${car.location_slot}` : ""}`
      : "—")
  );
}

function vehicleWarrantyDateKey(car: CarDisplay): string {
  const v = car.warranty_vehicle_expiry ?? car.warranty_expiry ?? car.warranty_monza_start_date;
  return dateKeyDb(v ?? null);
}

function customsFilterValue(car: CarDisplay): string {
  if (car.customs_status === "cleared") return "Complete";
  if (car.customs_status === "in_progress") return "Incomplete";
  return CUSTOMS_STATUS_LABELS[car.customs_status] ?? "Pending";
}

function warrantyInNextDays(
  iso: string | null | undefined,
  start: Date,
  end: Date
): boolean {
  if (!iso) return false;
  const d = parseISO(String(iso).slice(0, 10));
  if (Number.isNaN(d.getTime())) return false;
  return isWithinInterval(d, { start, end });
}

type ColFilterOpts = { value: string; label: string };

function freqOpts(
  list: CarDisplay[],
  pick: (c: CarDisplay) => string | null | undefined,
  sort: "freq" | "alpha" = "freq"
): ColFilterOpts[] {
  const m = new Map<string, number>();
  for (const c of list) {
    const raw = pick(c);
    const k =
      raw == null || String(raw).trim() === "" ? COL_EMPTY : String(raw).trim();
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const entries = [...m.entries()];
  if (sort === "freq") entries.sort((a, b) => b[1] - a[1]);
  else entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([value, n]) => ({
    value,
    label: value === COL_EMPTY ? `(Empty) · ${n}` : `${value} · ${n}`,
  }));
}

function yearOpts(list: CarDisplay[]): ColFilterOpts[] {
  const m = new Map<string, number>();
  for (const c of list) {
    const k = c.model_year == null ? COL_EMPTY : String(c.model_year);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => {
      if (a[0] === COL_EMPTY) return 1;
      if (b[0] === COL_EMPTY) return -1;
      return Number(b[0]) - Number(a[0]);
    })
    .map(([value, n]) => ({
      value,
      label: value === COL_EMPTY ? `(Empty) · ${n}` : `${value} · ${n}`,
    }));
}

function dateOpts(
  list: CarDisplay[],
  pick: (c: CarDisplay) => string | null | undefined
): ColFilterOpts[] {
  const m = new Map<string, number>();
  for (const c of list) {
    const v = pick(c);
    const k = v ? String(v).slice(0, 10) : COL_EMPTY;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => {
      if (a[0] === COL_EMPTY) return 1;
      if (b[0] === COL_EMPTY) return -1;
      return b[0].localeCompare(a[0]);
    })
    .map(([value, n]) => ({
      value,
      label: value === COL_EMPTY ? `(Empty) · ${n}` : `${value} · ${n}`,
    }));
}

/** Pixel widths — single source of truth via <colgroup> (header + body). 21 columns. */
const CARS_TABLE_COL_PX = [
  220, 120, 150, 110, 90, 140, 140, 130, 220, 140, 140, 130, 190, 140, 190, 140, 120, 140,
  140, 140, 100,
] as const;

const CARS_TH =
  "sticky top-0 z-10 box-border min-w-0 max-w-full border-b-2 border-r border-border bg-[var(--table-header)] px-2 py-2 text-left align-middle text-[11px] font-semibold text-[var(--table-header-text)] whitespace-nowrap overflow-hidden text-ellipsis";
const CARS_TD =
  "box-border min-w-0 max-w-full border-b border-r border-border bg-card px-2 py-2 text-left align-middle text-xs whitespace-nowrap overflow-hidden text-ellipsis";

const CAR_COL_BANDS = [
  "bg-sky-500/[0.06] dark:bg-sky-500/10",
  "bg-emerald-500/[0.06] dark:bg-emerald-500/10",
  "bg-amber-500/[0.06] dark:bg-amber-500/10",
  "bg-violet-500/[0.06] dark:bg-violet-500/10",
] as const;
function carColBand(i: number, base: string) {
  return `${base} ${CAR_COL_BANDS[i % CAR_COL_BANDS.length]}`;
}

function matchesSearch(
  car: CarDisplay,
  search: string
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const vin = (car.vin ?? "").toLowerCase();
  const plate = (car.plate_number ?? "").toLowerCase();
  const brand = (car.brand ?? "").toLowerCase();
  const model = (car.model ?? "").toLowerCase();
  const issue = (car.issue ?? "").toLowerCase();
  const notes = (car.notes ?? "").toLowerCase();
  const trimVal = ((car as CarDisplay & { trim?: string | null }).trim ?? "").toLowerCase();
  return (
    vin.includes(q) ||
    plate.includes(q) ||
    brand.includes(q) ||
    model.includes(q) ||
    trimVal.includes(q) ||
    issue.includes(q) ||
    notes.includes(q)
  );
}

export default function CarsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFromUrl = searchParams.get("status");
  const locationFromUrl = searchParams.get("location");
  const { canEditInventory, canDelete, profile, isOwner, appRole, canOpenCarEditDialog } =
    useUser();
  const [cars, setCars] = useState<CarDisplay[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  useEffect(() => {
    if (statusFromUrl && /^(inventory|available|reserved|sold)$/.test(statusFromUrl)) {
      setStatusFilter(statusFromUrl);
    }
  }, [statusFromUrl]);

  useEffect(() => {
    if (locationFromUrl && Object.keys(LOCATION_LABELS).includes(locationFromUrl)) {
      setLocationFilter(locationFromUrl);
    }
  }, [locationFromUrl]);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [colVin, setColVin] = useState("");
  const [colClientPhone, setColClientPhone] = useState("");
  const [colFilters, setColFilters] = useState({
    brand: FILTER_ALL,
    model: FILTER_ALL,
    model_year: FILTER_ALL,
    exterior: FILTER_ALL,
    interior: FILTER_ALL,
    status: FILTER_ALL,
    client: FILTER_ALL,
    delivery_date: FILTER_ALL,
    location: FILTER_ALL,
    warranty_per_dms: FILTER_ALL,
    wvm: FILTER_ALL,
    warranty_battery_dms: FILTER_ALL,
    wbm: FILTER_ALL,
    battery: FILTER_ALL,
    pdi: FILTER_ALL,
    customs: FILTER_ALL,
    date_arrived: FILTER_ALL,
    software_update: FILTER_ALL,
    extra_pdi: FILTER_ALL,
    extra_software: FILTER_ALL,
    extra_warranty: FILTER_ALL,
  });
  const [customsDialogCar, setCustomsDialogCar] = useState<CarDisplay | null>(null);
  const [customsDialogOpen, setCustomsDialogOpen] = useState(false);
  const [pdiDialogCar, setPdiDialogCar] = useState<CarDisplay | null>(null);
  const [pdiDialogOpen, setPdiDialogOpen] = useState(false);
  const [importExcelOpen, setImportExcelOpen] = useState(false);
  const [moveCar, setMoveCar] = useState<CarDisplay | null>(null);
  const [editCar, setEditCar] = useState<CarDisplay | null>(null);
  const [deleteCar, setDeleteCar] = useState<CarDisplay | null>(null);
  const [scanVinOpen, setScanVinOpen] = useState(false);

  const supabase = createClient();

  async function handleVinScan(vin: string) {
    const { data: car } = await supabase
      .from("cars")
      .select("id, vin, brand, model")
      .eq("vin", vin.trim().toUpperCase())
      .is("deleted_at", null)
      .single();

    if (!car) {
      toast.error(`No car found with VIN: ${vin}`);
      return;
    }
    toast.success(`Found: ${(car as { brand: string }).brand} ${(car as { model: string }).model}`);
    router.push(`/cars/${(car as { id: string }).id}`);
    setScanVinOpen(false);
  }

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDeleteCar() {
    if (!deleteCar || !profile) return;
    if (!canDeleteCar) {
      toast.error("You don't have permission to delete vehicles.");
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

    const res = await fetch(`/api/cars/${deleteCar.id}`, {
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
    setDeleteCar(null);
    fetchCars();
  }

  const fetchCars = useCallback(async () => {
    setLoading(true);
    const { data, error, aborted, usedFallback } = await getCarsDisplay();

    if (aborted) {
      setLoading(false);
      return;
    }

    if (error) {
      const message =
        (typeof error === "object" && error && "message" in error
          ? (error as { message?: unknown }).message
          : null) ??
        (typeof error === "object" && error && "code" in error
          ? (error as { code?: unknown }).code
          : null) ??
        "Failed to load cars";

      // eslint-disable-next-line no-console
      console.error("Failed to fetch cars:", message, error);
      toast.error(String(message));
      setCars([]);
    } else {
      setCars(data);
      if (usedFallback) {
        // eslint-disable-next-line no-console
        console.warn(
          "[cars] Loaded inventory from public.cars (cars_display unavailable — e.g. schema cache). Apply migration / NOTIFY pgrst reload in Supabase when ready."
        );
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCars();
  }, [fetchCars]);

  useEffect(() => {
    if (cars.length === 0) return;
    getPendingDeleteRequestsForItems("car", cars.map((c) => c.id)).then((map) => {
      const byId: Record<string, boolean> = {};
      cars.forEach((c) => {
        byId[c.id] = !!map[c.id];
      });
      setPendingDeletes(byId);
    });
  }, [cars]);

  const colOpts = useMemo(
    () => ({
      brand: freqOpts(cars, (c) => c.brand),
      model: freqOpts(cars, (c) => c.model),
      model_year: yearOpts(cars),
      exterior: freqOpts(cars, (c) => c.exterior_color),
      interior: freqOpts(cars, (c) => c.interior_color),
      status: freqOpts(cars, (c) => c.status),
      client: freqOpts(cars, (c) => c.client_name),
      delivery_date: dateOpts(cars, (c) => c.delivery_date),
      location: freqOpts(cars, (c) => {
        const t = locationTextForFilter(c);
        return t === "—" ? null : t;
      }),
      warranty_per_dms: dateOpts(cars, (c) => c.warranty_per_dms),
      wvm: dateOpts(cars, (c) => c.warranty_vehicle_expiry ?? c.warranty_expiry ?? c.warranty_monza_start_date),
      warranty_battery_dms: dateOpts(cars, (c) => c.warranty_battery_dms),
      wbm: dateOpts(cars, (c) => c.warranty_battery_expiry),
      battery: freqOpts(cars, (c) =>
        c.battery_percent != null ? String(c.battery_percent) : null
      ),
      pdi: freqOpts(cars, (c) => c.pdi_status),
      customs: freqOpts(cars, customsFilterValue),
      date_arrived: dateOpts(cars, (c) => c.date_arrived),
      software_update: freqOpts(cars, (c) => c.software_update, "alpha"),
    }),
    [cars]
  );

  const filteredCars = useMemo(() => {
    const wStart = startOfDay(new Date());
    const wEnd = startOfDay(addDays(new Date(), 90));
    return cars.filter((car) => {
      if (!matchesSearch(car, search)) return false;
      if (statusFilter !== "all" && car.status !== statusFilter) return false;
      if (locationFilter !== "all" && car.location_type !== locationFilter)
        return false;
      if (brandFilter !== "all" && car.brand !== brandFilter) return false;

      const vinQ = colVin.trim().toLowerCase();
      if (vinQ && !(car.vin ?? "").toLowerCase().includes(vinQ)) return false;
      const phQ = colClientPhone.trim().toLowerCase();
      const clientPh = ((car as { client_phone?: string }).client_phone ?? "")
        .trim()
        .toLowerCase();
      if (phQ && !clientPh.includes(phQ)) return false;

      if (colFilters.brand !== FILTER_ALL) {
        const v = car.brand?.trim() ? car.brand.trim() : COL_EMPTY;
        if (v !== colFilters.brand) return false;
      }
      if (colFilters.model !== FILTER_ALL) {
        const v = car.model?.trim() ? car.model.trim() : COL_EMPTY;
        if (v !== colFilters.model) return false;
      }
      if (colFilters.model_year !== FILTER_ALL) {
        const v = car.model_year == null ? COL_EMPTY : String(car.model_year);
        if (v !== colFilters.model_year) return false;
      }
      if (colFilters.exterior !== FILTER_ALL) {
        const v = car.exterior_color?.trim() ? car.exterior_color.trim() : COL_EMPTY;
        if (v !== colFilters.exterior) return false;
      }
      if (colFilters.interior !== FILTER_ALL) {
        const v = car.interior_color?.trim() ? car.interior_color.trim() : COL_EMPTY;
        if (v !== colFilters.interior) return false;
      }
      if (colFilters.status !== FILTER_ALL && car.status !== colFilters.status) return false;
      if (colFilters.client !== FILTER_ALL) {
        const v = car.client_name?.trim() ? car.client_name.trim() : COL_EMPTY;
        if (v !== colFilters.client) return false;
      }
      if (colFilters.delivery_date !== FILTER_ALL) {
        if (dateKeyDb(car.delivery_date) !== colFilters.delivery_date) return false;
      }
      if (colFilters.location !== FILTER_ALL) {
        const loc = locationTextForFilter(car);
        const v = loc === "—" ? COL_EMPTY : loc;
        if (v !== colFilters.location) return false;
      }
      if (colFilters.warranty_per_dms !== FILTER_ALL) {
        if (dateKeyDb(car.warranty_per_dms) !== colFilters.warranty_per_dms) return false;
      }
      if (colFilters.wvm !== FILTER_ALL) {
        if (vehicleWarrantyDateKey(car) !== colFilters.wvm) return false;
      }
      if (colFilters.warranty_battery_dms !== FILTER_ALL) {
        if (dateKeyDb(car.warranty_battery_dms) !== colFilters.warranty_battery_dms)
          return false;
      }
      if (colFilters.wbm !== FILTER_ALL) {
        if (dateKeyDb(car.warranty_battery_expiry) !== colFilters.wbm) return false;
      }
      if (colFilters.battery !== FILTER_ALL) {
        const v =
          car.battery_percent != null ? String(car.battery_percent) : COL_EMPTY;
        if (v !== colFilters.battery) return false;
      }
      if (colFilters.pdi !== FILTER_ALL && car.pdi_status !== colFilters.pdi) return false;
      if (colFilters.customs !== FILTER_ALL) {
        if (customsFilterValue(car) !== colFilters.customs) return false;
      }
      if (colFilters.date_arrived !== FILTER_ALL) {
        if (dateKeyDb(car.date_arrived) !== colFilters.date_arrived) return false;
      }
      if (colFilters.software_update !== FILTER_ALL) {
        const raw = car.software_update?.trim();
        const v = raw ? raw : COL_EMPTY;
        if (v !== colFilters.software_update) return false;
      }

      if (colFilters.extra_pdi === "done" && car.pdi_status !== "done") return false;
      if (colFilters.extra_pdi === "not_done" && car.pdi_status === "done") return false;

      if (colFilters.extra_software === "has" && !(car.software_update ?? "").trim())
        return false;
      if (colFilters.extra_software === "empty" && (car.software_update ?? "").trim())
        return false;

      if (colFilters.extra_warranty === "expiring90") {
        const hit =
          warrantyInNextDays(car.warranty_vehicle_expiry, wStart, wEnd) ||
          warrantyInNextDays(car.warranty_battery_expiry, wStart, wEnd) ||
          warrantyInNextDays(car.warranty_expiry, wStart, wEnd) ||
          warrantyInNextDays(car.warranty_monza_start_date, wStart, wEnd);
        if (!hit) return false;
      }
      if (colFilters.extra_warranty === "no_vehicle_with_arrival") {
        if (!car.date_arrived) return false;
        if (vehicleWarrantyDateKey(car) !== COL_EMPTY) return false;
      }
      if (colFilters.extra_warranty === "no_battery_with_arrival") {
        if (!car.date_arrived) return false;
        if (dateKeyDb(car.warranty_battery_expiry) !== COL_EMPTY) return false;
      }

      return true;
    });
  }, [
    cars,
    search,
    statusFilter,
    locationFilter,
    brandFilter,
    colVin,
    colClientPhone,
    colFilters,
  ]);

  const carExportColumns: ExportColumn[] = [
    { key: "vin", header: "VIN", width: 22 },
    { key: "brand", header: "Brand" },
    { key: "model", header: "Model" },
    { key: "trim", header: "Trim" },
    { key: "model_year", header: "Year" },
    { key: "exterior_color", header: "Exterior" },
    { key: "interior_color", header: "Interior" },
    { key: "status_display", header: "Status" },
    { key: "client_name", header: "Client" },
    { key: "client_phone", header: "Client Phone", width: 18 },
    { key: "delivery_date", header: "Delivery Date", type: "date" },
    { key: "location_display", header: "Location" },
    { key: "warranty_per_dms", header: "Warranty Vehicle DMS", type: "date" },
    { key: "warranty_vm_display", header: "W.V.M", type: "date" },
    { key: "warranty_battery_dms", header: "Warranty Battery DMS", type: "date" },
    { key: "warranty_battery_expiry", header: "W.B.M", type: "date" },
    { key: "battery_percent_display", header: "Battery %" },
    { key: "pdi_display", header: "PDI" },
    { key: "customs_display", header: "Customs" },
    { key: "date_arrived", header: "Date Arrived", type: "date" },
  ];

  const carExportData = (list: CarDisplay[]) =>
    list.map((c) => {
      const wvm =
        c.warranty_vehicle_expiry ?? c.warranty_expiry ?? c.warranty_monza_start_date;
      const clientPhone = (c as { client_phone?: string }).client_phone;
      return {
        ...c,
        status_display: formatCarStatusLabel(c.status),
        client_phone: clientPhone ?? "",
        location_display:
          c.location_full ??
          (c.location_type
            ? `${LOCATION_LABELS[c.location_type as keyof typeof LOCATION_LABELS] ?? c.location_type}${c.location_slot ? ` ${c.location_slot}` : ""}`
            : ""),
        warranty_vm_display: wvm ?? null,
        battery_percent_display:
          c.battery_percent != null ? `${c.battery_percent}%` : "",
        pdi_display: PDI_LABELS[c.pdi_status],
        customs_display:
          c.customs_status === "cleared"
            ? "Complete"
            : c.customs_status === "in_progress"
              ? "Incomplete"
              : CUSTOMS_STATUS_LABELS[c.customs_status] ?? "Pending",
      };
    });

  const canCreateCar = canPerform("cars", "create", appRole ?? null);
  const canEditCar = canOpenCarEditDialog;
  const canDeleteCar = canPerform("cars", "delete", appRole ?? null);

  return (
    <div className="container mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Car Inventory</h1>
          <p className="text-muted-foreground">View and manage all cars</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ExportButton
            data={carExportData(filteredCars)}
            allData={carExportData(cars)}
            columns={carExportColumns}
            filename="Car_Inventory"
            options={{
              pageName: "Car Inventory",
              summary: `Total Cars: ${filteredCars.length}`,
            }}
            disabled={loading}
          />
          {isOwner && (
            <Button variant="outline" onClick={() => setImportExcelOpen(true)}>
              <FileSpreadsheet className="mr-2 size-4" />
              Import from Excel
            </Button>
          )}
          {canCreateCar && (
            <Button asChild>
              <Link href="/cars/add">Add Car</Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search by VIN, plate, brand, model · Status · Location · Brand
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 sm:gap-4">
          <div className="flex w-full gap-2 sm:w-auto sm:max-w-xs">
            <Input
              id="car-inventory-search"
              name="car-inventory-search"
              placeholder="Search by VIN, plate, brand, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 flex-1 text-base sm:text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              className="size-11 min-h-11 min-w-11 shrink-0"
              onClick={() => setScanVinOpen(true)}
              title="Scan VIN"
            >
              <ScanLine className="size-4" />
            </Button>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="car-status-filter" className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(CAR_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger id="car-location-filter" className="w-[180px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {Object.entries(LOCATION_LABELS)
                .filter(([value]) => value)
                .map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger id="car-brand-filter" className="w-[140px]">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              <SelectItem value="Voyah">Voyah</SelectItem>
              <SelectItem value="MHero">MHero</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Column filters</CardTitle>
            <CardDescription>
              Per-column values (categories by frequency, dates newest first, year descending). VIN and
              client phone use text match.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setColVin("");
              setColClientPhone("");
              setColFilters({
                brand: FILTER_ALL,
                model: FILTER_ALL,
                model_year: FILTER_ALL,
                exterior: FILTER_ALL,
                interior: FILTER_ALL,
                status: FILTER_ALL,
                client: FILTER_ALL,
                delivery_date: FILTER_ALL,
                location: FILTER_ALL,
                warranty_per_dms: FILTER_ALL,
                wvm: FILTER_ALL,
                warranty_battery_dms: FILTER_ALL,
                wbm: FILTER_ALL,
                battery: FILTER_ALL,
                pdi: FILTER_ALL,
                customs: FILTER_ALL,
                date_arrived: FILTER_ALL,
                software_update: FILTER_ALL,
                extra_pdi: FILTER_ALL,
                extra_software: FILTER_ALL,
                extra_warranty: FILTER_ALL,
              });
            }}
          >
            Clear column filters
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="col-filter-vin" className="text-xs text-muted-foreground">
                VIN contains
              </Label>
              <Input
                id="col-filter-vin"
                value={colVin}
                onChange={(e) => setColVin(e.target.value)}
                placeholder="Substring…"
                className="h-9 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="col-filter-phone" className="text-xs text-muted-foreground">
                Client phone contains
              </Label>
              <Input
                id="col-filter-phone"
                value={colClientPhone}
                onChange={(e) => setColClientPhone(e.target.value)}
                placeholder="Digits…"
                className="h-9 text-xs"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(
              [
                ["col-brand", "Brand", "brand", colOpts.brand],
                ["col-model", "Model", "model", colOpts.model],
                ["col-year", "Year", "model_year", colOpts.model_year],
                ["col-ext", "Exterior", "exterior", colOpts.exterior],
                ["col-int", "Interior", "interior", colOpts.interior],
                ["col-st", "Status", "status", colOpts.status],
                ["col-client", "Client", "client", colOpts.client],
                ["col-del", "Delivery date", "delivery_date", colOpts.delivery_date],
                ["col-loc", "Location", "location", colOpts.location],
                ["col-wdms", "Warranty Vehicle DMS", "warranty_per_dms", colOpts.warranty_per_dms],
                ["col-wvm", "W.V.M", "wvm", colOpts.wvm],
                ["col-wbdms", "Warranty Battery DMS", "warranty_battery_dms", colOpts.warranty_battery_dms],
                ["col-wbm", "W.B.M", "wbm", colOpts.wbm],
                ["col-bat", "Battery %", "battery", colOpts.battery],
                ["col-pdi", "PDI", "pdi", colOpts.pdi],
                ["col-cust", "Customs", "customs", colOpts.customs],
                ["col-arr", "Date arrived", "date_arrived", colOpts.date_arrived],
                ["col-sw", "Software update", "software_update", colOpts.software_update],
              ] as const
            ).map(([id, label, key, options]) => (
              <div key={id} className="flex min-w-0 flex-col gap-1">
                <Label htmlFor={id} className="text-xs text-muted-foreground">
                  {label}
                </Label>
                <Select
                  value={colFilters[key as keyof typeof colFilters] as string}
                  onValueChange={(v) =>
                    setColFilters((prev) => ({ ...prev, [key]: v }))
                  }
                >
                  <SelectTrigger id={id} className="h-9 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>All</SelectItem>
                    {options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {key === "pdi" && o.value !== COL_EMPTY
                          ? `${PDI_LABELS[o.value as keyof typeof PDI_LABELS] ?? o.value} · ${o.label.split(" · ")[1] ?? ""}`
                          : o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="col-extra-pdi" className="text-xs text-muted-foreground">
                PDI done (extra)
              </Label>
              <Select
                value={colFilters.extra_pdi}
                onValueChange={(v) => setColFilters((p) => ({ ...p, extra_pdi: v }))}
              >
                <SelectTrigger id="col-extra-pdi" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All</SelectItem>
                  <SelectItem value="done">PDI done</SelectItem>
                  <SelectItem value="not_done">PDI not done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="col-extra-sw" className="text-xs text-muted-foreground">
                Software update (extra)
              </Label>
              <Select
                value={colFilters.extra_software}
                onValueChange={(v) => setColFilters((p) => ({ ...p, extra_software: v }))}
              >
                <SelectTrigger id="col-extra-sw" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All</SelectItem>
                  <SelectItem value="has">Has value</SelectItem>
                  <SelectItem value="empty">Empty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="col-extra-war" className="text-xs text-muted-foreground">
                Warranties vs arrival
              </Label>
              <Select
                value={colFilters.extra_warranty}
                onValueChange={(v) => setColFilters((p) => ({ ...p, extra_warranty: v }))}
              >
                <SelectTrigger id="col-extra-war" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All</SelectItem>
                  <SelectItem value="expiring90">Expires within 90 days (vehicle or battery)</SelectItem>
                  <SelectItem value="no_vehicle_with_arrival">
                    Date arrived set · no vehicle warranty date
                  </SelectItem>
                  <SelectItem value="no_battery_with_arrival">
                    Date arrived set · no battery warranty date
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cars</CardTitle>
          <CardDescription>
            {loading ? "Loading..." : `${filteredCars.length} car(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredCars.length === 0 ? (
            <p className="text-muted-foreground">No cars found.</p>
          ) : (
            <div className="scrollbar-thick w-full min-w-0 max-h-[min(72vh,calc(100dvh-14rem))] overflow-x-auto overflow-y-auto rounded-md border border-border bg-card [-webkit-overflow-scrolling:touch]">
              <table className="w-max min-w-full table-fixed border-collapse">
                <colgroup>
                  {CARS_TABLE_COL_PX.map((w, i) => (
                    <col key={i} style={{ width: `${w}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className={carColBand(0, `${CARS_TH} font-mono`)}>
                      VIN
                    </th>
                    <th scope="col" className={carColBand(1, CARS_TH)}>
                      Brand
                    </th>
                    <th scope="col" className={carColBand(2, CARS_TH)}>
                      Model
                    </th>
                    <th scope="col" className={carColBand(3, CARS_TH)}>
                      Trim
                    </th>
                    <th scope="col" className={carColBand(4, CARS_TH)}>
                      Year
                    </th>
                    <th scope="col" className={carColBand(5, CARS_TH)}>
                      Exterior
                    </th>
                    <th scope="col" className={carColBand(6, CARS_TH)}>
                      Interior
                    </th>
                    <th scope="col" className={carColBand(7, CARS_TH)}>
                      Status
                    </th>
                    <th scope="col" className={carColBand(8, CARS_TH)}>
                      Client
                    </th>
                    <th scope="col" className={carColBand(9, CARS_TH)}>
                      Client Phone
                    </th>
                    <th scope="col" className={carColBand(10, CARS_TH)}>
                      Delivery Date
                    </th>
                    <th scope="col" className={carColBand(11, CARS_TH)}>
                      Location
                    </th>
                    <th scope="col" className={carColBand(12, CARS_TH)}>
                      Warranty Vehicle DMS
                    </th>
                    <th scope="col" title="Warranty V.M" className={carColBand(13, CARS_TH)}>
                      W.V.M
                    </th>
                    <th scope="col" className={carColBand(14, CARS_TH)}>
                      Warranty Battery DMS
                    </th>
                    <th scope="col" title="Warranty B.M" className={carColBand(15, CARS_TH)}>
                      W.B.M
                    </th>
                    <th scope="col" className={carColBand(16, CARS_TH)}>
                      Battery %
                    </th>
                    <th scope="col" className={carColBand(17, CARS_TH)}>
                      PDI
                    </th>
                    <th scope="col" className={carColBand(18, CARS_TH)}>
                      Customs
                    </th>
                    <th scope="col" className={carColBand(19, CARS_TH)}>
                      Date Arrived
                    </th>
                    <th scope="col" className={carColBand(20, `${CARS_TH} text-right`)}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCars.map((car) => {
                    const customsLabel =
                      car.customs_status === "cleared"
                        ? "Complete"
                        : car.customs_status === "in_progress"
                          ? "Incomplete"
                          : CUSTOMS_STATUS_LABELS[car.customs_status] ?? "Pending";
                    const batteryPercent = car.battery_percent;
                    const clientPhone = (car as { client_phone?: string }).client_phone;
                    const locationText =
                      car.location_full ??
                      (car.location_type
                        ? `${LOCATION_LABELS[car.location_type as keyof typeof LOCATION_LABELS] ?? car.location_type}${car.location_slot ? ` ${car.location_slot}` : ""}`
                        : "—");
                    const clientDisplay = pendingDeletes[car.id]
                      ? `(!) ${car.client_name ?? "—"}`
                      : (car.client_name ?? "—");
                    const statusLabel = formatCarStatusLabel(car.status);
                    const statusCellText = pendingDeletes[car.id]
                      ? `${statusLabel} · Pending`
                      : statusLabel;
                    const trimDisplay =
                      (car as CarDisplay & { trim?: string | null }).trim ?? "—";

                    return (
                      <tr
                        key={car.id}
                        className="cursor-pointer hover:bg-muted/30"
                        title={pendingDeletes[car.id] ? "Pending delete request" : undefined}
                        onClick={() => router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`)}
                      >
                        <td title={car.vin ?? ""} className={carColBand(0, `${CARS_TD} font-mono`)}>
                          {car.vin ?? "—"}
                        </td>
                        <td title={car.brand ?? undefined} className={carColBand(1, CARS_TD)}>
                          {car.brand ?? "—"}
                        </td>
                        <td title={car.model ?? undefined} className={carColBand(2, CARS_TD)}>
                          {car.model}
                        </td>
                        <td title={trimDisplay !== "—" ? trimDisplay : undefined} className={carColBand(3, CARS_TD)}>
                          {trimDisplay}
                        </td>
                        <td className={carColBand(4, `${CARS_TD} tabular-nums`)}>
                          {car.model_year ?? "—"}
                        </td>
                        <td title={car.exterior_color ?? undefined} className={carColBand(5, CARS_TD)}>
                          {car.exterior_color ?? "—"}
                        </td>
                        <td title={car.interior_color ?? undefined} className={carColBand(6, CARS_TD)}>
                          {car.interior_color ?? "—"}
                        </td>
                        <td title={statusCellText} className={carColBand(7, CARS_TD)}>
                          {statusCellText}
                        </td>
                        <td title={car.client_name ?? undefined} className={carColBand(8, CARS_TD)}>
                          {clientDisplay}
                        </td>
                        <td title={clientPhone ?? undefined} className={carColBand(9, CARS_TD)}>
                          {clientPhone ?? "—"}
                        </td>
                        <td className={carColBand(10, `${CARS_TD} tabular-nums`)}>
                          {fmtSheetDate(car.delivery_date)}
                        </td>
                        <td title={locationText !== "—" ? locationText : undefined} className={carColBand(11, CARS_TD)}>
                          {locationText}
                        </td>
                        <td className={carColBand(12, `${CARS_TD} tabular-nums`)}>
                          {fmtSheetDate(car.warranty_per_dms)}
                        </td>
                        <td className={carColBand(13, `${CARS_TD} tabular-nums`)}>
                          {warrantyVehicleExpiry(car)}
                        </td>
                        <td className={carColBand(14, `${CARS_TD} tabular-nums`)}>
                          {fmtSheetDate(car.warranty_battery_dms)}
                        </td>
                        <td className={carColBand(15, `${CARS_TD} tabular-nums`)}>
                          {fmtSheetDate(car.warranty_battery_expiry)}
                        </td>
                        <td className={carColBand(16, `${CARS_TD} tabular-nums`)}>
                          {batteryPercent != null ? `${batteryPercent}%` : "—"}
                        </td>
                        <td
                          title={PDI_LABELS[car.pdi_status]}
                          className={carColBand(17, `${CARS_TD} cursor-pointer text-primary hover:underline`)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPdiDialogCar(car);
                            setPdiDialogOpen(true);
                          }}
                        >
                          {PDI_LABELS[car.pdi_status]}
                        </td>
                        <td
                          title={customsLabel}
                          className={carColBand(18, `${CARS_TD} cursor-pointer text-primary hover:underline`)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomsDialogCar(car);
                            setCustomsDialogOpen(true);
                          }}
                        >
                          {customsLabel}
                        </td>
                        <td className={carColBand(19, `${CARS_TD} tabular-nums`)}>
                          {fmtSheetDate(car.date_arrived)}
                        </td>
                        <td
                          className={carColBand(20, `${CARS_TD} overflow-hidden text-right`)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="inline-flex max-w-full flex-nowrap items-center justify-end gap-0.5 overflow-hidden">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0"
                              title="Open documents & files"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`);
                              }}
                            >
                              <FileText className="size-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-7 shrink-0">
                                  <MoreHorizontal className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" side="left" sideOffset={4}>
                                <DropdownMenuItem
                                  onClick={() => router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`)}
                                >
                                  View profile
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`)
                                  }
                                >
                                  <FileText className="mr-2 size-4" />
                                  Documents & PDFs
                                </DropdownMenuItem>
                                {canEditCar && (
                                  <>
                                    <DropdownMenuItem onClick={() => setEditCar(car)}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setMoveCar(car)}>Move</DropdownMenuItem>
                                  </>
                                )}
                                {canDeleteCar && (
                                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteCar(car)}>
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomsDialog
        car={customsDialogCar}
        open={customsDialogOpen}
        onOpenChange={setCustomsDialogOpen}
        onSuccess={fetchCars}
      />

      <PdiStatusDialog
        car={pdiDialogCar}
        open={pdiDialogOpen}
        onOpenChange={setPdiDialogOpen}
        onSuccess={fetchCars}
      />

      {moveCar && (
        <MoveCarDialog
          carId={moveCar.id}
          currentLocationType={moveCar.location_type}
          currentStatus={moveCar.status}
          open={!!moveCar}
          onOpenChange={(open) => !open && setMoveCar(null)}
          onSuccess={() => {
            setMoveCar(null);
            fetchCars();
          }}
        />
      )}

      <EditCarDialog
        car={editCar}
        open={!!editCar}
        onOpenChange={(open) => !open && setEditCar(null)}
        onSuccess={() => {
          setEditCar(null);
          fetchCars();
        }}
      />

      <ImportExcelDialog
        open={importExcelOpen}
        onOpenChange={setImportExcelOpen}
        onSuccess={fetchCars}
      />

      <ScannerDialog
        open={scanVinOpen}
        onClose={() => setScanVinOpen(false)}
        onScan={handleVinScan}
        title="Scan VIN"
        placeholder="17-character VIN..."
        scanType="vin"
      />

      <AlertDialog
        open={!!deleteCar}
        onOpenChange={(open) => !open && setDeleteCar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm deletion — enter your password to permanently delete this vehicle
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action is irreversible. Please confirm your password to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(isOwner || profile?.user_role === "owner") ? (
            <div className="space-y-2">
              <Label htmlFor="delete-password">Password</Label>
              <Input
                id="delete-password"
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
              disabled={deleteLoading || !deletePassword || !(isOwner || profile?.user_role === "owner")}
              onClick={() => {
                void handleDeleteCar();
              }}
            >
              {deleteLoading ? "Deleting..." : "Confirm Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
