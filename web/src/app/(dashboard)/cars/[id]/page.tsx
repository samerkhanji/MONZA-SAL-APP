"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay, CarEvent } from "@/types/database";
import { PDI_LABELS, type CarEventType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const EVENT_LABELS: Record<CarEventType, string> = {
  created: "Created",
  moved: "Moved",
  status_changed: "Status changed",
  battery_updated: "Battery updated",
  pdi_updated: "PDI updated",
  details_updated: "Details updated",
  note_added: "Note added",
};

export default function CarProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canEditInventory, canDelete } = useUser();
  const param = params.id as string;
  // Support lookup by VIN (17 alphanumeric) or by UUID
  const isVin = /^[A-HJ-NPR-Z0-9]{17}$/i.test(param);
  const [car, setCar] = useState<CarDisplay | null>(null);
  const [events, setEvents] = useState<CarEvent[]>([]);
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

  const supabase = createClient();

  async function copyVinToClipboard() {
    if (!car?.vin) return;
    await navigator.clipboard.writeText(car.vin);
    toast.success("VIN copied");
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
      .select("*")
      .eq("car_id", car.id)
      .order("created_at", { ascending: false });

    if (error) {
      setEvents([]);
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

  async function handleDelete() {
    if (!car) return;
    const { error } = await supabase
      .from("cars")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", car.id);

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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="container mx-auto space-y-4 py-8">
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
  const garageVisitsCount = garageEvents.length;
  const maintenanceCount = maintenanceEvents.length;

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
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/cars">← Back</Link>
          </Button>
          <div>
            <h1 className="font-mono text-xl font-semibold">
              VIN: {car.vin}
            </h1>
            <p className="text-muted-foreground text-sm">
              {car.brand} {car.model} {car.model_year ? `(${car.model_year})` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEditInventory && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
          <Button variant="outline" onClick={() => setMoveOpen(true)}>
            Move location
          </Button>
          {canDelete && (
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
              onClick={() => void handleDelete()}
            >
              Delete
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
        onOpenDay={(dateStr) => {
          setSelectedDateStr(dateStr);
          setDayDetailOpen(true);
        }}
      />

      <Tabs defaultValue="documents">
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
                <p className="text-muted-foreground text-sm">Status</p>
                <Badge className={statusBadgeClass}>
                  {car.status_display ?? car.status}
                </Badge>
              </div>
              {createdByName && (
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Created by</p>
                  <p>{createdByName}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
              <CardDescription>Where the vehicle is stored</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Location</p>
                <p>{car.location_full ?? `${car.location_type}${car.location_slot ? ` · ${car.location_slot}` : ""}`}</p>
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
            </CardContent>
          </Card>

          {/* Section 2b: Visits & Maintenance */}
          <Card>
            <CardHeader>
              <CardTitle>Visits & Maintenance</CardTitle>
              <CardDescription>Garage visits, company entries, service history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVisitsMaintenanceMode("garage");
                    setVisitsMaintenanceOpen(true);
                  }}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                >
                  <Badge
                    variant="outline"
                    className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  >
                    Garage visits: {garageVisitsCount}
                  </Badge>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVisitsMaintenanceMode("maintenance");
                    setVisitsMaintenanceOpen(true);
                  }}
                  className="cursor-pointer transition-opacity hover:opacity-90"
                >
                  <Badge
                    variant="outline"
                    className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                  >
                    Maintenance: {maintenanceCount}
                  </Badge>
                </button>
              </div>
              {visitEvents.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    Visitation history (click date to open full history & files)
                  </p>
                  <div className="space-y-2">
                    {sortedDates
                      .filter((d) =>
                        eventsByDate[d].some((e) => e.event_type === "moved")
                      )
                      .map((dateStr) => {
                        const dayEvents = eventsByDate[dateStr];
                        const dayVisits = dayEvents.filter((e) => e.event_type === "moved");
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
                              {dayVisits.length} visit
                              {dayVisits.length !== 1 ? "s" : ""}
                              {dayEvents.length > dayVisits.length
                                ? ` · ${dayEvents.length} total events`
                                : ""}
                            </span>
                            <span className="text-muted-foreground">→</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
              {visitEvents.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No visitation history yet.
                </p>
              )}
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
                <p className="text-muted-foreground text-sm">Current KM</p>
                <p>{car.km_display ?? (car.current_km != null ? `${car.current_km} km` : "—")}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Software Version</p>
                <p>{car.software_version ?? "—"}</p>
              </div>
              <div
                className="space-y-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setPdiOpen(true);
                }}
              >
                <p className="text-muted-foreground text-sm">PDI Status</p>
                <Badge className={`${pdiBadgeClass} hover:opacity-80`}>
                  {PDI_LABELS[car.pdi_status]}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Vehicle Type</p>
                <Badge variant="outline">
                  {(car as { is_erev?: boolean }).is_erev ? "EREV" : "Pure EV"}
                </Badge>
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
