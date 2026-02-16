"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MoreHorizontal, FileText } from "lucide-react";
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
  const { canEditInventory, canDelete } = useUser();
  const [cars, setCars] = useState<CarDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
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

  const supabase = createClient();

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
    <div className="container mx-auto max-w-[1800px] space-y-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Car Inventory</h1>
          <p className="text-muted-foreground">View and manage all cars</p>
        </div>
        {canEditInventory && (
          <Button asChild>
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
        <CardContent className="flex flex-wrap gap-4">
          <Input
            placeholder="Search by VIN (primary), plate, brand, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>VIN</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Exterior</TableHead>
                    <TableHead>Interior</TableHead>
                    <TableHead>Plate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Warranty (DMS)</TableHead>
                    <TableHead>Warranty (Monza)</TableHead>
                    <TableHead>Battery %</TableHead>
                    <TableHead>KM</TableHead>
                    <TableHead>EV Range</TableHead>
                    <TableHead>Motor</TableHead>
                    <TableHead>PDI</TableHead>
                    <TableHead>Customs</TableHead>
                    <TableHead>Date Arrived</TableHead>
                    <TableHead>Software</TableHead>
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
                        <TableCell className="font-mono text-sm font-medium">
                          {car.vin ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {car.brand ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {car.model}
                        </TableCell>
                        <TableCell className="text-sm">
                          {car.model_year ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {car.exterior_color ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
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
                        <TableCell className="text-sm">
                          {car.location_full || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {car.price_display && car.price_display !== "-"
                            ? car.price_display
                            : car.price != null
                              ? `${Number(car.price).toLocaleString()} ${car.price_currency ?? "USD"}`
                              : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {car.warranty_per_dms
                            ? new Date(car.warranty_per_dms).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
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
                        <TableCell className="text-sm">
                          {car.ev_range_km != null ? `${car.ev_range_km} km` : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
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
                          className="cursor-pointer"
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
                        <TableCell className="text-sm">
                          {car.software_version ?? "—"}
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
