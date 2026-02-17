"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MoreHorizontal, FileText, ScanLine } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
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
import { StatusCustomerDialog } from "@/components/status-customer-dialog";
import { CustomsDialog } from "@/components/customs-dialog";
import { PdiStatusDialog } from "@/components/pdi-status-dialog";
import { MoveCarDialog } from "@/components/move-car-dialog";
import { EditCarDialog } from "@/components/edit-car-dialog";

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
  const { canEditInventory, canDelete } = useUser();
  const [cars, setCars] = useState<CarDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  useEffect(() => {
    if (
      statusFromUrl &&
      /^(inbound|in_stock|showroom|reserved|sold|delivered|service|sent_to_sub_dealer|demo)$/.test(
        statusFromUrl
      )
    ) {
      setStatusFilter(statusFromUrl);
    }
  }, [statusFromUrl]);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [pdiFilter, setPdiFilter] = useState<string>("all");
  const [statusDialogCar, setStatusDialogCar] = useState<CarDisplay | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [customsDialogCar, setCustomsDialogCar] = useState<CarDisplay | null>(null);
  const [customsDialogOpen, setCustomsDialogOpen] = useState(false);
  const [pdiDialogCar, setPdiDialogCar] = useState<CarDisplay | null>(null);
  const [pdiDialogOpen, setPdiDialogOpen] = useState(false);
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

  async function handleDeleteCar() {
    if (!deleteCar) return;
    const { error } = await supabase
      .from("cars")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteCar.id);

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
    setDeleteCar(null);
    fetchCars();
  }

  async function fetchCars() {
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
  }

  useEffect(() => {
    fetchCars();
  }, []);

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      if (!matchesSearch(car, search)) return false;
      if (statusFilter !== "all" && car.status !== statusFilter) return false;
      if (locationFilter !== "all" && car.location_type !== locationFilter)
        return false;
      if (brandFilter !== "all" && car.brand !== brandFilter) return false;
      if (pdiFilter !== "all" && car.pdi_status !== pdiFilter) return false;
      return true;
    });
  }, [cars, search, statusFilter, locationFilter, brandFilter, pdiFilter]);

  return (
    <div className="container mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Car Inventory</h1>
          <p className="text-muted-foreground">View and manage all cars</p>
        </div>
        {canEditInventory && (
          <Button asChild className="shrink-0">
            <Link href="/cars/add">Add Car</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search by VIN, plate, brand, model · Status · Location · Brand · PDI
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 sm:gap-4">
          <div className="flex w-full gap-2 sm:w-auto sm:max-w-xs">
            <Input
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
            <SelectTrigger className="w-[180px]">
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
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {Object.entries(LOCATION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              <SelectItem value="Voyah">Voyah</SelectItem>
              <SelectItem value="MHero">MHero</SelectItem>
            </SelectContent>
          </Select>
          <Select value={pdiFilter} onValueChange={setPdiFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="PDI" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All PDI</SelectItem>
              {Object.entries(PDI_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
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
            <p className="text-muted-foreground">Loading...</p>
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
                        <Badge className={`shrink-0 ${statusClass}`}>
                          {CAR_STATUS_LABELS[car.status]}
                        </Badge>
                      </div>
                      <p className="text-base font-medium">
                        {car.brand ?? "—"} {car.model ?? "—"}
                      </p>
                      {car.model_year && (
                        <p className="text-sm text-muted-foreground">{car.model_year}</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tablet/Desktop: table */}
              <div className="scrollbar-thick hidden overflow-x-auto rounded-lg border border-border/50 md:block">
              <Table className="w-full min-w-[900px] xl:min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px] whitespace-nowrap">VIN</TableHead>
                    <TableHead className="whitespace-nowrap">Brand</TableHead>
                    <TableHead className="whitespace-nowrap">Model</TableHead>
                    <TableHead className="whitespace-nowrap">Year</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Exterior</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Interior</TableHead>
                    <TableHead className="whitespace-nowrap">Plate</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="hidden whitespace-nowrap lg:table-cell">Location</TableHead>
                    <TableHead className="min-w-[80px] whitespace-nowrap">Price</TableHead>
                    <TableHead className="hidden min-w-[100px] whitespace-nowrap xl:table-cell">Warranty (DMS)</TableHead>
                    <TableHead className="hidden min-w-[110px] whitespace-nowrap xl:table-cell">Warranty (Monza)</TableHead>
                    <TableHead className="whitespace-nowrap">Battery %</TableHead>
                    <TableHead className="whitespace-nowrap">KM</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">EV Range</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Motor</TableHead>
                    <TableHead className="whitespace-nowrap">PDI</TableHead>
                    <TableHead className="hidden whitespace-nowrap xl:table-cell">Customs</TableHead>
                    <TableHead className="whitespace-nowrap">Date Arrived</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                        <TableCell className="text-sm">
                          {car.plate_number ?? car.sub_dealer_name ?? "—"}
                        </TableCell>
                        <TableCell
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusDialogCar(car);
                            setStatusDialogOpen(true);
                          }}
                        >
                          <Badge className={`${statusClass} hover:opacity-80`}>
                            {CAR_STATUS_LABELS[car.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden max-w-[100px] truncate text-sm lg:table-cell" title={car.location_full ?? undefined}>
                          {car.location_full || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {car.price_display && car.price_display !== "-"
                            ? car.price_display
                            : car.price != null
                              ? `${Number(car.price).toLocaleString()} ${car.price_currency ?? "USD"}`
                              : "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {car.warranty_per_dms
                            ? new Date(car.warranty_per_dms).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {car.warranty_monza_start_date
                            ? new Date(car.warranty_monza_start_date).toLocaleDateString()
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
                        <TableCell className="text-sm">
                          {car.km_display ?? (car.current_km != null ? `${car.current_km} km` : "—")}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {car.ev_range_km != null ? `${car.ev_range_km} km` : "—"}
                        </TableCell>
                        <TableCell className="hidden text-sm xl:table-cell">
                          {car.motor ?? "—"}
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
                        <TableCell className="text-sm">
                          {car.date_arrived
                            ? new Date(car.date_arrived).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Open documents & files"
                              onClick={() =>
                                router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`)
                              }
                            >
                              <FileText className="size-4" />
                            </Button>
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
                              <DropdownMenuContent align="end">
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
                                {canEditInventory && (
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
                              {canDelete && (
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
            <AlertDialogTitle>Remove vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this vehicle? This action can be
              undone by an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                handleDeleteCar();
                setDeleteCar(null);
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
