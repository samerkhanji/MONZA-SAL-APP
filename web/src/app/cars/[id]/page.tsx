"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Car, CarEvent } from "@/types/database";
import {
  CAR_STATUS_LABELS,
  LOCATION_LABELS,
  PDI_LABELS,
  type CarEventType,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MoveCarDialog } from "@/components/move-car-dialog";

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
  const id = params.id as string;
  const [car, setCar] = useState<Car | null>(null);
  const [events, setEvents] = useState<CarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [moveOpen, setMoveOpen] = useState(false);

  const supabase = createClient();

  async function fetchCar() {
    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      setCar(null);
      return;
    }
    setCar(data as Car);
  }

  async function fetchEvents() {
    const { data, error } = await supabase
      .from("car_events")
      .select("*")
      .eq("car_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setEvents([]);
      return;
    }
    setEvents((data as CarEvent[]) ?? []);
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchCar(), fetchEvents()]).finally(() => setLoading(false));
  }, [id]);

  function onMoved() {
    setMoveOpen(false);
    fetchCar();
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

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/cars">← Back</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">
              {car.model} {car.model_year ? `(${car.model_year})` : ""}
            </h1>
            <p className="font-mono text-muted-foreground text-sm">
              VIN: {car.vin}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMoveOpen(true)}>
            Move location
          </Button>
        </div>
      </div>

      <MoveCarDialog
        carId={car.id}
        currentLocationType={car.location_type}
        currentLocationSlot={car.location_slot}
        currentStatus={car.status}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onSuccess={onMoved}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Movement / Status history</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current state</CardTitle>
              <CardDescription>Location, status, PDI, EV</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Status</p>
                <Badge variant="secondary">{CAR_STATUS_LABELS[car.status]}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Location</p>
                <p>
                  {LOCATION_LABELS[car.location_type]}
                  {car.location_slot ? ` · ${car.location_slot}` : ""}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">PDI</p>
                <p>{PDI_LABELS[car.pdi_status]}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Battery</p>
                <p>{car.battery_percent != null ? `${car.battery_percent}%` : "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Current KM</p>
                <p>{car.current_km != null ? `${car.current_km} km` : "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Software</p>
                <p>{car.software_version ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Date arrived</p>
                <p>
                  {car.date_arrived
                    ? new Date(car.date_arrived).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Location changed</p>
                <p>
                  {car.location_changed_at
                    ? new Date(car.location_changed_at).toLocaleString()
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Status changed</p>
                <p>
                  {car.status_changed_at
                    ? new Date(car.status_changed_at).toLocaleString()
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vehicle</CardTitle>
              <CardDescription>Brand, model, colors</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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
                <p className="text-muted-foreground text-sm">Exterior / Interior</p>
                <p>{car.exterior_color ?? "—"} / {car.interior_color ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm">Plate</p>
                <p>{car.plate_number ?? "—"}</p>
              </div>
              {car.notes && (
                <div className="col-span-2 space-y-1">
                  <p className="text-muted-foreground text-sm">Notes</p>
                  <p className="text-sm">{car.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Movement / Status history</CardTitle>
              <CardDescription>Events for this car</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-muted-foreground">No events yet.</p>
              ) : (
                <ul className="space-y-4">
                  {events.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex flex-col gap-1 border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {EVENT_LABELS[ev.event_type]}
                        </Badge>
                        <span className="text-muted-foreground text-sm">
                          {new Date(ev.created_at).toLocaleString()}
                        </span>
                      </div>
                      {(ev.from_value || ev.to_value) && (
                        <p className="text-muted-foreground text-sm">
                          {ev.from_value && <span>{ev.from_value}</span>}
                          {ev.from_value && ev.to_value && " → "}
                          {ev.to_value && <span>{ev.to_value}</span>}
                        </p>
                      )}
                      {ev.note && (
                        <p className="text-sm">{ev.note}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
