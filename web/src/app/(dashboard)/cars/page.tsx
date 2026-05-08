"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MoreHorizontal, FileText, ScanLine, FileSpreadsheet, Plus } from "lucide-react";
import { pluralize } from "@/lib/plural";
import { useUser } from "@/lib/contexts/UserContext";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
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
import { cn } from "@/lib/utils";

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

function locationDisplayText(car: CarDisplay): string {
  return (
    car.location_full ??
    (car.location_type
      ? `${LOCATION_LABELS[car.location_type as keyof typeof LOCATION_LABELS] ?? car.location_type}${car.location_slot ? ` ${car.location_slot}` : ""}`
      : "—")
  );
}

function warrantySummaryDisplay(car: CarDisplay): string {
  const v = car.warranty_vehicle_expiry ?? car.warranty_expiry ?? car.warranty_monza_start_date;
  if (v) return fmtSheetDate(v);
  if (car.warranty_battery_expiry) return fmtSheetDate(car.warranty_battery_expiry);
  return "—";
}

const SORT_INF = Number.MAX_SAFE_INTEGER;

function dateSortTs(v: string | null | undefined): number {
  if (!v) return SORT_INF;
  const t = Date.parse(String(v).slice(0, 10));
  return Number.isNaN(t) ? SORT_INF : t;
}

function strSort(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

const STATUS_SORT_RANK: Record<string, number> = {
  inventory: 0,
  available: 1,
  reserved: 2,
  sold: 3,
};

function customsSortKey(car: CarDisplay): string {
  if (car.customs_status === "cleared") return "complete";
  if (car.customs_status === "in_progress") return "incomplete";
  return (CUSTOMS_STATUS_LABELS[car.customs_status] ?? "pending").toLowerCase();
}

type InventorySortKey =
  | "vin"
  | "brand"
  | "model"
  | "model_year"
  | "exterior"
  | "interior"
  | "status"
  | "client"
  | "client_phone"
  | "delivery_date"
  | "location"
  | "warranty_per_dms"
  | "wvm"
  | "warranty_battery_dms"
  | "warranty_battery_expiry"
  | "warranties"
  | "battery_percent"
  | "pdi"
  | "customs"
  | "software_update"
  | "date_arrived";

function compareInventoryRows(
  a: CarDisplay,
  b: CarDisplay,
  key: InventorySortKey,
  asc: boolean
): number {
  const dir = asc ? 1 : -1;
  const n = (x: number, y: number) => (x < y ? -1 : x > y ? 1 : 0) * dir;
  const s = (x: string, y: string) => x.localeCompare(y, undefined, { sensitivity: "base" }) * dir;

  switch (key) {
    case "vin":
      return s(strSort(a.vin), strSort(b.vin));
    case "brand":
      return s(strSort(a.brand), strSort(b.brand));
    case "model":
      return s(strSort(a.model), strSort(b.model));
    case "model_year":
      return n(a.model_year ?? SORT_INF, b.model_year ?? SORT_INF);
    case "exterior":
      return s(strSort(a.exterior_color), strSort(b.exterior_color));
    case "interior":
      return s(strSort(a.interior_color), strSort(b.interior_color));
    case "status": {
      const ra = STATUS_SORT_RANK[a.status] ?? 99;
      const rb = STATUS_SORT_RANK[b.status] ?? 99;
      const c = n(ra, rb);
      return c !== 0 ? c : s(strSort(a.status), strSort(b.status));
    }
    case "client":
      return s(strSort(a.client_name), strSort(b.client_name));
    case "client_phone":
      return s(
        strSort((a as { client_phone?: string }).client_phone),
        strSort((b as { client_phone?: string }).client_phone)
      );
    case "delivery_date":
      return n(dateSortTs(a.delivery_date), dateSortTs(b.delivery_date));
    case "location": {
      const la = strSort(locationDisplayText(a) === "—" ? "" : locationDisplayText(a));
      const lb = strSort(locationDisplayText(b) === "—" ? "" : locationDisplayText(b));
      return s(la, lb);
    }
    case "warranty_per_dms":
      return n(dateSortTs(a.warranty_per_dms), dateSortTs(b.warranty_per_dms));
    case "wvm": {
      const va = a.warranty_vehicle_expiry ?? a.warranty_expiry ?? a.warranty_monza_start_date;
      const vb = b.warranty_vehicle_expiry ?? b.warranty_expiry ?? b.warranty_monza_start_date;
      return n(dateSortTs(va), dateSortTs(vb));
    }
    case "warranty_battery_dms":
      return n(dateSortTs(a.warranty_battery_dms), dateSortTs(b.warranty_battery_dms));
    case "warranty_battery_expiry":
      return n(dateSortTs(a.warranty_battery_expiry), dateSortTs(b.warranty_battery_expiry));
    case "warranties": {
      const datesA = [
        dateSortTs(a.warranty_vehicle_expiry ?? a.warranty_expiry ?? a.warranty_monza_start_date),
        dateSortTs(a.warranty_battery_expiry),
        dateSortTs(a.warranty_per_dms),
      ].filter((t) => t !== SORT_INF);
      const datesB = [
        dateSortTs(b.warranty_vehicle_expiry ?? b.warranty_expiry ?? b.warranty_monza_start_date),
        dateSortTs(b.warranty_battery_expiry),
        dateSortTs(b.warranty_per_dms),
      ].filter((t) => t !== SORT_INF);
      const minA = datesA.length ? Math.min(...datesA) : SORT_INF;
      const minB = datesB.length ? Math.min(...datesB) : SORT_INF;
      if (minA !== minB) return n(minA, minB);
      const nameA = [a.warranty_vehicle_expiry, a.warranty_battery_expiry, a.warranty_per_dms]
        .filter(Boolean)
        .join("|")
        .toLowerCase();
      const nameB = [b.warranty_vehicle_expiry, b.warranty_battery_expiry, b.warranty_per_dms]
        .filter(Boolean)
        .join("|")
        .toLowerCase();
      return s(nameA, nameB);
    }
    case "battery_percent":
      return n(a.battery_percent ?? SORT_INF, b.battery_percent ?? SORT_INF);
    case "pdi": {
      const da = a.pdi_status === "done" ? 1 : 0;
      const db = b.pdi_status === "done" ? 1 : 0;
      const c = n(da, db);
      return c !== 0 ? c : s(strSort(a.pdi_status), strSort(b.pdi_status));
    }
    case "customs":
      return s(customsSortKey(a), customsSortKey(b));
    case "software_update": {
      const sa = (a.software_update ?? "").trim();
      const sb = (b.software_update ?? "").trim();
      const isoA = /^\d{4}-\d{2}-\d{2}/.test(sa) ? dateSortTs(sa) : null;
      const isoB = /^\d{4}-\d{2}-\d{2}/.test(sb) ? dateSortTs(sb) : null;
      if (isoA !== null && isoB !== null) return n(isoA, isoB);
      if (isoA !== null && isoB === null) return asc ? -1 : 1;
      if (isoA === null && isoB !== null) return asc ? 1 : -1;
      const ha = sa ? 1 : 0;
      const hb = sb ? 1 : 0;
      const c = n(ha, hb);
      return c !== 0 ? c : s(strSort(a.software_update), strSort(b.software_update));
    }
    case "date_arrived":
      return n(dateSortTs(a.date_arrived), dateSortTs(b.date_arrived));
    default:
      return 0;
  }
}

function InventorySortTh({
  k,
  sortKey,
  sortDir,
  onToggle,
  children,
  className = "",
  title: thTitle,
}: {
  k: InventorySortKey;
  sortKey: InventorySortKey | null;
  sortDir: "asc" | "desc";
  onToggle: (key: InventorySortKey) => void;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const active = sortKey === k;
  return (
    <th
      scope="col"
      title={thTitle}
      className={cn(`${CARS_TH} p-0`.trim(), className)}
    >
      <button
        type="button"
        className={cn(
          "flex w-full min-w-0 items-center gap-0.5 px-2 py-2 text-left hover:bg-muted/40",
          active && "bg-muted/25"
        )}
        onClick={() => onToggle(k)}
      >
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {active ? (
          <span className="shrink-0 tabular-nums" aria-hidden>
            {sortDir === "asc" ? "\u2191" : "\u2193"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

/** Pixel widths — <colgroup> for 23 columns (incl. Warranties, Software update). */
const CARS_TABLE_COL_PX = [
  220, 118, 148, 108, 72, 132, 132, 118, 200, 132, 128, 124, 168, 124, 168, 124, 108, 96, 124, 124,
  120, 120, 96,
] as const;

const CARS_TH =
  "sticky top-0 z-10 box-border min-w-0 max-w-full border-b-2 border-r border-border bg-[var(--table-header)] px-2 py-2 text-left align-middle text-[11px] font-semibold text-[var(--table-header-text)] whitespace-nowrap overflow-hidden text-ellipsis";
const CARS_TD =
  "box-border min-w-0 max-w-full border-b border-r border-border bg-transparent px-2 py-2 text-left align-middle text-xs whitespace-nowrap overflow-hidden text-ellipsis";

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
  // Debounce so the 23-column compareInventoryRows sort doesn't run on every keystroke.
  const debouncedSearch = useDebouncedValue(search, 250);
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
  const [sortKey, setSortKey] = useState<InventorySortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
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

    toast.success("Vehicle marked as scrapped and removed from inventory");
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

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      if (!matchesSearch(car, debouncedSearch)) return false;
      if (statusFilter !== "all" && car.status !== statusFilter) return false;
      if (locationFilter !== "all" && car.location_type !== locationFilter)
        return false;
      if (brandFilter !== "all" && car.brand !== brandFilter) return false;
      return true;
    });
  }, [cars, debouncedSearch, statusFilter, locationFilter, brandFilter]);

  const sortedCars = useMemo(() => {
    if (!sortKey) return filteredCars;
    const asc = sortDir === "asc";
    return [...filteredCars].sort((a, b) => compareInventoryRows(a, b, sortKey, asc));
  }, [filteredCars, sortKey, sortDir]);

  const toggleSort = useCallback((k: InventorySortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }, [sortKey]);

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
    { key: "warranties_summary", header: "Warranties" },
    { key: "battery_percent_display", header: "Battery %" },
    { key: "pdi_display", header: "PDI" },
    { key: "customs_display", header: "Customs" },
    { key: "software_update", header: "Software Update" },
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
        warranties_summary: warrantySummaryDisplay(c),
        software_update: (c.software_update ?? "").trim() || "",
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
            data={carExportData(sortedCars)}
            allData={carExportData(cars)}
            columns={carExportColumns}
            filename="Car_Inventory"
            options={{
              pageName: "Car Inventory",
              summary: `Total Cars: ${sortedCars.length}`,
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
        <CardHeader>
          <CardTitle>Cars</CardTitle>
          <CardDescription>
            {loading ? "Loading..." : pluralize(sortedCars.length, "car")}
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedCars.length === 0 ? (
            cars.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground">No cars yet.</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button asChild size="sm">
                    <Link href="/cars/add">
                      <Plus className="mr-2 size-4" />
                      Add a car
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportExcelOpen(true)}
                  >
                    Import from Excel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-muted-foreground">No cars match your filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setLocationFilter("all");
                    setBrandFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )
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
                    <InventorySortTh
                      k="vin"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                      className="font-mono"
                    >
                      VIN
                    </InventorySortTh>
                    <InventorySortTh
                      k="brand"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Brand
                    </InventorySortTh>
                    <InventorySortTh
                      k="model"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Model
                    </InventorySortTh>
                    <th scope="col" className={CARS_TH}>
                      Trim
                    </th>
                    <InventorySortTh
                      k="model_year"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Year
                    </InventorySortTh>
                    <InventorySortTh
                      k="exterior"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Exterior
                    </InventorySortTh>
                    <InventorySortTh
                      k="interior"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Interior
                    </InventorySortTh>
                    <InventorySortTh
                      k="status"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Status
                    </InventorySortTh>
                    <InventorySortTh
                      k="client"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Client
                    </InventorySortTh>
                    <InventorySortTh
                      k="client_phone"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Client Phone
                    </InventorySortTh>
                    <InventorySortTh
                      k="delivery_date"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Delivery Date
                    </InventorySortTh>
                    <InventorySortTh
                      k="location"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Location
                    </InventorySortTh>
                    <InventorySortTh
                      k="warranty_per_dms"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Warranty Vehicle DMS
                    </InventorySortTh>
                    <InventorySortTh
                      k="wvm"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                      title="Warranty Vehicle (Monza) — vehicle warranty expiry from Monza"
                    >
                      W.V.M
                    </InventorySortTh>
                    <InventorySortTh
                      k="warranty_battery_dms"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Warranty Battery DMS
                    </InventorySortTh>
                    <InventorySortTh
                      k="warranty_battery_expiry"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                      title="Warranty Battery (Monza) — battery warranty expiry from Monza"
                    >
                      W.B.M
                    </InventorySortTh>
                    <InventorySortTh
                      k="warranties"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Warranties
                    </InventorySortTh>
                    <InventorySortTh
                      k="battery_percent"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Battery %
                    </InventorySortTh>
                    <InventorySortTh
                      k="pdi"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      PDI
                    </InventorySortTh>
                    <InventorySortTh
                      k="customs"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Customs
                    </InventorySortTh>
                    <InventorySortTh
                      k="software_update"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Software update
                    </InventorySortTh>
                    <InventorySortTh
                      k="date_arrived"

                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    >
                      Date Arrived
                    </InventorySortTh>
                    <th scope="col" className={`${CARS_TH} text-right`}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCars.map((car) => {
                    const customsLabel =
                      car.customs_status === "cleared"
                        ? "Complete"
                        : car.customs_status === "in_progress"
                          ? "Incomplete"
                          : CUSTOMS_STATUS_LABELS[car.customs_status] ?? "Pending";
                    const batteryPercent = car.battery_percent;
                    const clientPhone = (car as { client_phone?: string }).client_phone;
                    const locationText = locationDisplayText(car);
                    const softwareText = (car.software_update ?? "").trim();
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
                        className="cursor-pointer odd:bg-gray-50 even:bg-white"
                        title={pendingDeletes[car.id] ? "Pending delete request" : undefined}
                        onClick={() => router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`)}
                      >
                        <td title={car.vin ?? ""} className={`${CARS_TD} font-mono`}>
                          {car.vin ?? "—"}
                        </td>
                        <td title={car.brand ?? undefined} className={CARS_TD}>
                          {car.brand ?? "—"}
                        </td>
                        <td title={car.model ?? undefined} className={CARS_TD}>
                          {car.model}
                        </td>
                        <td title={trimDisplay !== "—" ? trimDisplay : undefined} className={CARS_TD}>
                          {trimDisplay}
                        </td>
                        <td className={`${CARS_TD} tabular-nums`}>
                          {car.model_year ?? "—"}
                        </td>
                        <td title={car.exterior_color ?? undefined} className={CARS_TD}>
                          {car.exterior_color ?? "—"}
                        </td>
                        <td title={car.interior_color ?? undefined} className={CARS_TD}>
                          {car.interior_color ?? "—"}
                        </td>
                        <td title={statusCellText} className={CARS_TD}>
                          {statusCellText}
                        </td>
                        <td title={car.client_name ?? undefined} className={CARS_TD}>
                          {clientDisplay}
                        </td>
                        <td title={clientPhone ?? undefined} className={CARS_TD}>
                          {clientPhone ?? "—"}
                        </td>
                        <td className={`${CARS_TD} tabular-nums`}>
                          {fmtSheetDate(car.delivery_date)}
                        </td>
                        <td title={locationText !== "—" ? locationText : undefined} className={CARS_TD}>
                          {locationText}
                        </td>
                        <td className={`${CARS_TD} tabular-nums`}>
                          {fmtSheetDate(car.warranty_per_dms)}
                        </td>
                        <td className={`${CARS_TD} tabular-nums`}>
                          {warrantyVehicleExpiry(car)}
                        </td>
                        <td className={`${CARS_TD} tabular-nums`}>
                          {fmtSheetDate(car.warranty_battery_dms)}
                        </td>
                        <td className={`${CARS_TD} tabular-nums`}>
                          {fmtSheetDate(car.warranty_battery_expiry)}
                        </td>
                        <td
                          title={warrantySummaryDisplay(car)}
                          className={`${CARS_TD} tabular-nums`}
                        >
                          {warrantySummaryDisplay(car)}
                        </td>
                        <td className={`${CARS_TD} tabular-nums`}>
                          {batteryPercent != null ? `${batteryPercent}%` : "—"}
                        </td>
                        <td
                          title={PDI_LABELS[car.pdi_status]}
                          className={`${CARS_TD} cursor-pointer text-primary hover:underline`}
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
                          className={`${CARS_TD} cursor-pointer text-primary hover:underline`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomsDialogCar(car);
                            setCustomsDialogOpen(true);
                          }}
                        >
                          {customsLabel}
                        </td>
                        <td title={softwareText || undefined} className={CARS_TD}>
                          {softwareText || "—"}
                        </td>
                        <td className={`${CARS_TD} tabular-nums`}>
                          {fmtSheetDate(car.date_arrived)}
                        </td>
                        <td
                          className={`${CARS_TD} overflow-hidden text-right`}
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
                                    Scrap vehicle
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
              Permanently retire this car (scrapped)
            </AlertDialogTitle>
            <AlertDialogDescription>
              Use this only when the car is being written off (totaled, scrapped,
              decommissioned). The car stays in records for audit but is removed
              from active inventory. Don&apos;t use this for returns or resales —
              for those, change the status or unlink the customer.
              <br />
              <br />
              Re-enter your password below to confirm.
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
              {deleteLoading ? "Saving..." : "Confirm scrap"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
