"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MoreHorizontal, FileText, ScanLine, FileSpreadsheet, Download, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay } from "@/types/database";
import {
  CAR_STATUS_LABELS,
  LOCATION_LABELS,
  PDI_LABELS,
  CUSTOMS_STATUS_LABELS,
} from "@/types/database";
import { STATUS_BADGE_COLORS, PDI_BADGE_COLORS, CUSTOMS_BADGE_COLORS } from "@/lib/constants/badges";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import {
  createDeleteRequest,
  getPendingDeleteRequestsForItems,
  type CarDeleteDetails,
} from "@/lib/delete-requests";
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";
import { canPerform } from "@/lib/permissions";

const ScannerDialog = dynamic(
  () => import("@/components/scanner/ScannerDialog").then((m) => ({ default: m.ScannerDialog })),
  { ssr: false }
);
const StatusCustomerDialog = dynamic(
  () => import("@/components/status-customer-dialog").then((m) => ({ default: m.StatusCustomerDialog })),
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
  return (
    vin.includes(q) ||
    plate.includes(q) ||
    brand.includes(q) ||
    model.includes(q)
  );
}

export default function CarsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFromUrl = searchParams.get("status");
  const { canEditInventory, canDelete, profile, isOwner, appRole } = useUser();
  const [cars, setCars] = useState<CarDisplay[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  useEffect(() => {
    if (
      statusFromUrl &&
        /^(inbound|in_stock|showroom|reserved|sold|delivered|service|sent_to_sub_dealer|demo|registered|under_registration|sent_to_customs|company_car)$/.test(
          statusFromUrl
        )
    ) {
      setStatusFilter(statusFromUrl);
    }
  }, [statusFromUrl]);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [statusDialogCar, setStatusDialogCar] = useState<CarDisplay | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
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

  const LINKED_STATUSES = ["sold", "delivered", "registered"] as const;

  async function handleStatusClick(car: CarDisplay) {
    if (!LINKED_STATUSES.includes(car.status as typeof LINKED_STATUSES[number])) {
      setStatusDialogCar(car);
      setStatusDialogOpen(true);
      return;
    }
    // 1. Find linked customer via sales_orders (any non-cancelled order)
    const { data: order } = await supabase
      .from("sales_orders")
      .select("customer_id")
      .eq("car_id", car.id)
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (order?.customer_id) {
      router.push(`/customers/${order.customer_id}`);
      return;
    }
    // 2. Fallback: exact match by phone if we have client_phone (no fuzzy matching)
    const clientPhone = (car as { client_phone?: string }).client_phone;
    if (clientPhone?.trim()) {
      const { data: byPhone } = await supabase
        .from("customers")
        .select("id")
        .eq("phone_primary", clientPhone.trim())
        .limit(1)
        .maybeSingle();
      if (byPhone) {
        router.push(`/customers/${byPhone.id}`);
        return;
      }
    }
    // No fuzzy first-name match — it can incorrectly link to wrong customers (e.g. OMAR HAOUCHI vs OMAR AKAR)
    setStatusDialogCar(car);
    setStatusDialogOpen(true);
  }

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
    const { data, error } = await supabase
      .from("cars_display")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.name === "AbortError" || error.message?.includes("aborted")) {
        setLoading(false);
        return;
      }
      console.error("Failed to fetch cars:", error.message ?? error.code ?? error);
      toast.error(error.message ?? "Failed to load cars");
      setCars([]);
    } else {
      setCars((data as CarDisplay[]) ?? []);
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
    { key: "vin", header: "VIN Number", width: 22 },
    { key: "model", header: "Model" },
    { key: "suffix", header: "Suffix / Trim" },
    { key: "model_year", header: "Year" },
    { key: "exterior_color", header: "Exterior Color" },
    { key: "interior_color", header: "Interior Color" },
    { key: "status_display", header: "Status" },
    { key: "engine_number", header: "Engine Number" },
    { key: "issue", header: "Issue" },
    { key: "client_name", header: "Client" },
    { key: "client_phone", header: "Client Phone", width: 18 },
    { key: "delivery_date", header: "Delivery Date", type: "date" },
    { key: "reservation_date", header: "Reservation Date", type: "date" },
    { key: "reserved_by", header: "Reserved By" },
    { key: "location_display", header: "Location" },
    { key: "warranty_per_dms", header: "Warranty DMS", type: "date" },
    { key: "warranty_vehicle_expiry", header: "Warranty Vehicle", type: "date" },
    { key: "warranty_battery_expiry", header: "Warranty Battery", type: "date" },
  ];

  const carExportData = (list: CarDisplay[]) =>
    list.map((c) => ({
      ...c,
      status_display: CAR_STATUS_LABELS[c.status as keyof typeof CAR_STATUS_LABELS] ?? c.status,
      location_display: c.location_full ?? (c.location_type ? `${LOCATION_LABELS[c.location_type as keyof typeof LOCATION_LABELS] ?? c.location_type}${c.location_slot ? ` ${c.location_slot}` : ""}` : ""),
      model: `${c.brand ?? ""} ${c.model ?? ""}`.trim(),
    }));

  const canCreateCar = canPerform("cars", "create", appRole ?? null);
  const canEditCar = canPerform("cars", "edit", appRole ?? null);
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
                .filter(([value]) => value)
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
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredCars.length === 0 ? (
            <p className="text-muted-foreground">No cars found.</p>
          ) : (
            <>
              {/* Mobile: card layout */}
              <div className="space-y-3 md:hidden">
                {filteredCars.map((car) => {
                  const statusClass =
                    STATUS_BADGE_COLORS[car.status] ??
                    "bg-muted text-muted-foreground";
                  return (
                    <button
                      key={car.id}
                      type="button"
                      className="flex w-full flex-col gap-2 rounded-lg border border-border/50 bg-card p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
                      onClick={() => router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-sm font-medium text-muted-foreground">
                          {car.vin ?? "—"}
                        </span>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          <Badge
                            className={`${statusClass} ${LINKED_STATUSES.includes(car.status as (typeof LINKED_STATUSES)[number]) ? "hover:ring-2 hover:ring-offset-1 cursor-pointer" : ""}`}
                            onClick={(e) => {
                              if (LINKED_STATUSES.includes(car.status as (typeof LINKED_STATUSES)[number])) {
                                e.stopPropagation();
                                void handleStatusClick(car);
                              }
                            }}
                          >
                            {CAR_STATUS_LABELS[car.status]}
                            {LINKED_STATUSES.includes(car.status as (typeof LINKED_STATUSES)[number]) && (car.client_name || (car as { client_phone?: string }).client_phone) && (
                              <ExternalLink className="ml-1 inline h-3 w-3 opacity-60" />
                            )}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-base font-medium">
                        {car.brand ?? "—"} {car.model ?? "—"}
                      </p>
                      {car.model_year && (
                        <p className="text-sm text-muted-foreground">{car.model_year}</p>
                      )}
                      {car.client_name && (
                        <p className="text-sm text-muted-foreground">Client: {car.client_name}</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tablet/Desktop: table */}
              <div className="scrollbar-thick hidden overflow-x-auto overflow-visible rounded-lg border border-border/50 md:block">
              <Table className="w-full min-w-[600px] overflow-visible xl:min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px] whitespace-nowrap">VIN</TableHead>
                    <TableHead className="whitespace-nowrap">Brand</TableHead>
                    <TableHead className="whitespace-nowrap">Model</TableHead>
                    <TableHead className="whitespace-nowrap">Year</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Exterior</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Interior</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Client</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Client Phone</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Delivery Date</TableHead>
                    <TableHead className="hidden whitespace-nowrap lg:table-cell">Location</TableHead>
                    <TableHead className="hidden min-w-[100px] whitespace-nowrap xl:table-cell">Warranty DMS</TableHead>
                    <TableHead className="hidden min-w-[110px] whitespace-nowrap xl:table-cell">Warranty Vehicle</TableHead>
                    <TableHead className="hidden min-w-[110px] whitespace-nowrap xl:table-cell">Warranty Battery</TableHead>
                    <TableHead className="whitespace-nowrap">Battery %</TableHead>
                    <TableHead className="whitespace-nowrap">PDI</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Customs</TableHead>
                    <TableHead className="whitespace-nowrap">Date Arrived</TableHead>
                    <TableHead className="text-right w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCars.map((car) => {
                    const statusClass =
                      STATUS_BADGE_COLORS[car.status] ??
                      "bg-muted text-muted-foreground";
                    const pdiClass =
                      PDI_BADGE_COLORS[car.pdi_status] ??
                      "bg-muted text-muted-foreground";
                    const customsClass =
                      CUSTOMS_BADGE_COLORS[car.customs_status] ??
                      "bg-muted text-muted-foreground";
                    const batteryPercent = car.battery_percent;

                    return (
                      <TableRow
                        key={car.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`)}
                      >
                        <TableCell className="min-w-[180px] font-mono text-sm font-medium whitespace-nowrap">
                          {car.vin ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[80px] truncate text-sm" title={car.brand ?? undefined}>
                          {car.brand ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[90px] truncate text-sm" title={car.model ?? undefined}>
                          {car.model}
                        </TableCell>
                        <TableCell className="text-sm">
                          {car.model_year ?? "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                          {car.exterior_color ?? "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                          {car.interior_color ?? "—"}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleStatusClick(car);
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge
                                className={
                                  LINKED_STATUSES.includes(car.status as (typeof LINKED_STATUSES)[number]) && (car.client_name || (car as { client_phone?: string }).client_phone)
                                    ? `${statusClass} hover:opacity-80 hover:ring-2 hover:ring-offset-1 hover:ring-current`
                                    : `${statusClass} hover:opacity-80`
                                }
                              >
                                {CAR_STATUS_LABELS[car.status]}
                                {LINKED_STATUSES.includes(car.status as (typeof LINKED_STATUSES)[number]) && (car.client_name || (car as { client_phone?: string }).client_phone) && (
                                  <ExternalLink className="ml-1 inline h-3 w-3 opacity-60" />
                                )}
                              </Badge>
                            </div>
                            {pendingDeletes[car.id] && (
                              <Badge variant="outline" className="text-amber-600 border-amber-400 dark:text-amber-400 dark:border-amber-500">
                                Pending Request
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {car.client_name ?? "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {car.client_phone ?? "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {car.delivery_date
                            ? new Date(car.delivery_date).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden max-w-[100px] truncate text-sm lg:table-cell" title={car.location_full ?? undefined}>
                          {car.location_full || "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {car.warranty_per_dms
                            ? new Date(car.warranty_per_dms).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {((car as any).warranty_vehicle_expiry ??
                            (car as any).warranty_expiry ??
                            car.warranty_monza_start_date)
                            ? new Date(
                                ((car as any).warranty_vehicle_expiry ??
                                  (car as any).warranty_expiry ??
                                  car.warranty_monza_start_date) as string
                              ).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {(car as any).warranty_battery_expiry
                            ? new Date((car as any).warranty_battery_expiry as string).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {batteryPercent != null ? `${batteryPercent}%` : "—"}
                            </span>
                            {batteryPercent != null && (
                              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full bg-primary"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, batteryPercent))}%`,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPdiDialogCar(car);
                            setPdiDialogOpen(true);
                          }}
                        >
                          <Badge className={`${pdiClass} hover:opacity-80`}>
                            {PDI_LABELS[car.pdi_status]}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="hidden cursor-pointer xl:table-cell"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomsDialogCar(car);
                            setCustomsDialogOpen(true);
                          }}
                        >
                          <Badge className={`${customsClass} hover:opacity-80`}>
                            {car.customs_status === "cleared"
                              ? "Complete"
                              : car.customs_status === "in_progress"
                                ? "Incomplete"
                                : CUSTOMS_STATUS_LABELS[car.customs_status] ?? "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {car.date_arrived
                            ? new Date(car.date_arrived).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell
                          className="min-w-[80px] w-[80px] text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                              title="Open documents & files"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`);
                              }}
                            >
                              <FileText className="size-4" />
                            </Button>
                            <div className="relative w-8 shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                >
                                  <MoreHorizontal className="size-4" />
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
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditCar(car);
                                      }}
                                    >
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setMoveCar(car);
                                      }}
                                    >
                                      Move
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {canDeleteCar && (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setDeleteCar(car)}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <StatusCustomerDialog
        car={statusDialogCar}
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        onSuccess={fetchCars}
      />

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
