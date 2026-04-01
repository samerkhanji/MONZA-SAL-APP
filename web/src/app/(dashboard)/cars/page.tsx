"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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

/** Pixel widths — single source of truth via <colgroup> (header + body). 20 columns. */
const CARS_TABLE_COL_PX = [
  220, 120, 150, 90, 140, 140, 130, 220, 140, 140, 130, 190, 140, 190, 140, 120, 140,
  140, 140, 100,
] as const;

const CARS_TH =
  "sticky top-0 z-10 box-border min-w-0 max-w-full border-b-2 border-r border-border bg-[var(--table-header)] px-2 py-2 text-left align-middle text-[11px] font-semibold text-[var(--table-header-text)] whitespace-nowrap overflow-hidden text-ellipsis";
const CARS_TD =
  "box-border min-w-0 max-w-full border-b border-r border-border bg-card px-2 py-2 text-left align-middle text-xs whitespace-nowrap overflow-hidden text-ellipsis";

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
  return (
    vin.includes(q) ||
    plate.includes(q) ||
    brand.includes(q) ||
    model.includes(q) ||
    issue.includes(q) ||
    notes.includes(q)
  );
}

export default function CarsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFromUrl = searchParams.get("status");
  const { canEditInventory, canDelete, profile, isOwner, appRole, canOpenCarEditDialog } =
    useUser();
  const [cars, setCars] = useState<CarDisplay[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  useEffect(() => {
    if (
      statusFromUrl &&
        /^(inventory|in_stock|showroom|reserved|sold|delivered|service|sent_to_sub_dealer|demo|registered|under_registration|sent_to_customs|company_car)$/.test(
          statusFromUrl
        )
    ) {
      setStatusFilter(statusFromUrl);
    }
  }, [statusFromUrl]);
  const [brandFilter, setBrandFilter] = useState<string>("all");
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

    const { error } = await supabase
      .from("cars")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteCar.id);

    setDeleteLoading(false);

    if (error) {
      const isRls =
        error.code === "42501" ||
        error.message.toLowerCase().includes("permission");
      toast.error(
        isRls ? "You don't have permission to do this." : error.message
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

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      if (!matchesSearch(car, search)) return false;
      if (statusFilter !== "all" && car.status !== statusFilter) return false;
      if (locationFilter !== "all" && car.location_type !== locationFilter)
        return false;
      if (brandFilter !== "all" && car.brand !== brandFilter) return false;
      return true;
    });
  }, [cars, search, statusFilter, locationFilter, brandFilter]);

  const carExportColumns: ExportColumn[] = [
    { key: "vin", header: "VIN", width: 22 },
    { key: "brand", header: "Brand" },
    { key: "model", header: "Model" },
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
        status_display: CAR_STATUS_LABELS[c.status as keyof typeof CAR_STATUS_LABELS] ?? c.status,
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
              {Object.entries(CAR_STATUS_LABELS)
                .filter(([value]) => value !== "inbound")
                .map(([value, label]) => (
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
                    <th scope="col" className={`${CARS_TH} font-mono`}>
                      VIN
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Brand
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Model
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Year
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Exterior
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Interior
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Status
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Client
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Client Phone
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Delivery Date
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Location
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Warranty Vehicle DMS
                    </th>
                    <th scope="col" title="Warranty V.M" className={CARS_TH}>
                      W.V.M
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Warranty Battery DMS
                    </th>
                    <th scope="col" title="Warranty B.M" className={CARS_TH}>
                      W.B.M
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Battery %
                    </th>
                    <th scope="col" className={CARS_TH}>
                      PDI
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Customs
                    </th>
                    <th scope="col" className={CARS_TH}>
                      Date Arrived
                    </th>
                    <th scope="col" className={`${CARS_TH} text-right`}>
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
                    const statusLabel =
                      CAR_STATUS_LABELS[car.status as keyof typeof CAR_STATUS_LABELS] ?? car.status;
                    const statusCellText = pendingDeletes[car.id]
                      ? `${statusLabel} · Pending`
                      : statusLabel;

                    return (
                      <tr
                        key={car.id}
                        className="cursor-pointer hover:bg-muted/30"
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
          {(isOwner || profile?.role === "owner") ? (
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
              disabled={deleteLoading || !deletePassword || !(isOwner || profile?.role === "owner")}
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
