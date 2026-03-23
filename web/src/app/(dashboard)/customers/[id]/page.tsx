"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { canPerform } from "@/lib/permissions";
import type { CustomerDisplay } from "@/types/database";
import { CAR_STATUS_LABELS } from "@/types/database";
import {
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  LANGUAGE_LABELS,
  LEAD_STATUS_COLORS,
} from "@/lib/constants/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditCustomerDialog } from "@/components/customers/EditCustomerDialog";
import { CustomerNotes } from "@/components/customers/CustomerNotes";
import { CustomerDocuments } from "@/components/customers/CustomerDocuments";
import { STATUS_BADGE_COLORS } from "@/lib/constants/badges";

interface VisitEvent {
  id: string;
  event_type: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
  visitType: "garage" | "company_entry";
}

interface EnrichedSaleOrder {
  id: string;
  car_id: string;
  customer_id: string;
  status: string;
  selling_price: number | null;
  currency: string | null;
  sale_date: string | null;
  date_bought: string | null;
  delivery_date: string | null;
  visits: number;
  maintenance: number;
  visitEvents: VisitEvent[];
  cars?: {
    id: string;
    vin: string;
    brand: string;
    model: string;
    model_year: number | null;
    exterior_color: string | null;
    status: string;
    sub_dealer_name?: string | null;
  } | null;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { canEditInventory, canDelete, appRole } = useUser();
  const id = params.id as string;
  const [customer, setCustomer] = useState<CustomerDisplay | null>(null);
  const [vehicles, setVehicles] = useState<EnrichedSaleOrder[]>([]);
  const [legacyVehicles, setLegacyVehicles] = useState<
    {
      id: string;
      vin: string;
      brand: string;
      model: string;
      model_year: number | null;
      exterior_color: string | null;
      status: string;
      client_name: string | null;
      client_phone: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const supabase = createClient();

  async function fetchCustomer() {
    const { data, error } = await supabase
      .from("customers_display")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      setCustomer(null);
      return;
    }
    setCustomer(data as CustomerDisplay);
  }

  async function fetchVehicles() {
    const { data: orders, error } = await supabase
      .from("sales_orders")
      .select(`
        id,
        car_id,
        customer_id,
        status,
        selling_price,
        currency,
        sale_date,
        date_bought,
        delivery_date,
        cars:car_id (
          id,
          vin,
          brand,
          model,
          model_year,
          exterior_color,
          status,
          sub_dealer_name
        )
      `)
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    if (error || !orders) {
      setVehicles([]);
      return;
    }

    const enrichedOrders: EnrichedSaleOrder[] = await Promise.all(
      (orders as unknown as EnrichedSaleOrder[]).map(async (order) => {
        const carId = (order.cars as { id?: string } | null)?.id;
        if (!carId) {
          return { ...order, visits: 0, maintenance: 0, visitEvents: [] };
        }

        const [movedEventsRes, maintenanceRes] = await Promise.all([
          supabase
            .from("car_events")
            .select("id, event_type, from_value, to_value, created_at")
            .eq("car_id", carId)
            .eq("event_type", "moved")
            .order("created_at", { ascending: false }),
          supabase
            .from("car_events")
            .select("*", { count: "exact", head: true })
            .eq("car_id", carId)
            .eq("event_type", "status_changed")
            .eq("to_value", "service"),
        ]);

        const movedEvents = (movedEventsRes.data ?? []).map((ev: any) => ({
          id: ev.id as string,
          event_type: ev.event_type as string,
          from_value: ev.from_value as string | null,
          to_value: ev.to_value as string | null,
          created_at: ev.created_at as string,
        }));

        const visitEvents: VisitEvent[] = movedEvents.map((ev) => {
          const toVal = (ev.to_value ?? "").toLowerCase();
          const isGarage = toVal.includes("garage");
          return { ...ev, visitType: isGarage ? "garage" : "company_entry" };
        });

        const garageCount = visitEvents.filter((v) => v.visitType === "garage").length;

        return {
          ...order,
          visits: garageCount,
          maintenance: maintenanceRes.count ?? 0,
          visitEvents,
        };
      })
    );

    setVehicles(enrichedOrders);
  }

  async function fetchLegacyVehicles(fullName: string) {
    if (!fullName.trim()) {
      setLegacyVehicles([]);
      return;
    }

    const { data, error } = await supabase
      .from("cars")
      .select(
        `
        id,
        vin,
        brand,
        model,
        model_year,
        exterior_color,
        status,
        client_name,
        client_phone,
        sales_orders:car_id ( id )
      `
      )
      .eq("client_name", fullName)
      .is("deleted_at", null);

    if (error || !data) {
      setLegacyVehicles([]);
      return;
    }

    const rows = data as unknown as {
      id: string;
      vin: string;
      brand: string;
      model: string;
      model_year: number | null;
      exterior_color: string | null;
      status: string;
      client_name: string | null;
      client_phone: string | null;
      sales_orders?: { id: string }[] | null;
    }[];

    const unlinked = rows.filter(
      (row) => !row.sales_orders || row.sales_orders.length === 0
    );

    setLegacyVehicles(
      unlinked.map((row) => ({
        id: row.id,
        vin: row.vin,
        brand: row.brand,
        model: row.model,
        model_year: row.model_year,
        exterior_color: row.exterior_color,
        status: row.status,
        client_name: row.client_name,
        client_phone: row.client_phone,
      }))
    );
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchCustomer().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!customer?.id) return;
    fetchVehicles();
    const fullName =
      customer.full_name ??
      `${customer.first_name} ${customer.last_name ?? ""}`.trim();
    void fetchLegacyVehicles(fullName);
  }, [customer?.id]);

  async function handleDelete() {
    if (!customer) return;
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", customer.id);

    if (error) {
      toast.error(`Failed to delete: ${error.message}`);
      return;
    }

    toast.success("Customer removed successfully");
    setDeleteOpen(false);
    router.push("/customers");
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-8">
        <Button variant="ghost" onClick={() => router.back()}>
          ← Back
        </Button>
        <p className="text-muted-foreground">Customer not found.</p>
      </div>
    );
  }

  const fullName =
    customer.full_name ?? `${customer.first_name} ${customer.last_name ?? ""}`.trim();
  const statusClass =
    LEAD_STATUS_COLORS[customer.lead_status] ?? "bg-muted text-muted-foreground";
  const statusLabel =
    customer.status_display ??
    LEAD_STATUS_LABELS[customer.lead_status] ??
    customer.lead_status;
  const sourceLabel =
    customer.source_display ??
    (customer.lead_source ? LEAD_SOURCE_LABELS[customer.lead_source] : null) ??
    "—";
  const langLabel =
    customer.language_display ??
    LANGUAGE_LABELS[customer.preferred_language ?? "en"] ??
    "—";

  const canEditCustomer = canPerform("customers", "edit", appRole ?? null);
  const canDeleteCustomer = canPerform("customers", "delete", appRole ?? null);

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{fullName || "—"}</h1>
            <Badge className={`mt-1 ${statusClass}`}>{statusLabel}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {canEditCustomer && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
          {canDeleteCustomer && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <EditCustomerDialog
        customer={customer}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          setEditOpen(false);
          fetchCustomer();
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this customer? This action can be undone by an
              admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="vehicles">
            Vehicles
            {vehicles.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {vehicles.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Interaction History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contact Info</CardTitle>
                <CardDescription>Phone, email, address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Full Name</p>
                  <p>{fullName || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    Phone
                    {!customer.phone_primary?.trim() && (
                      <Badge variant="outline" className="border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400 text-xs">
                        Missing
                      </Badge>
                    )}
                  </p>
                  {customer.phone_primary ? (
                    <a href={`tel:${customer.phone_primary}`} className="text-primary hover:underline">
                      {customer.phone_primary}
                    </a>
                  ) : (
                    <p>—</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Phone 2</p>
                  <p>
                    {customer.phone_secondary ? (
                      <a href={`tel:${customer.phone_secondary}`} className="text-primary hover:underline">
                        {customer.phone_secondary}
                      </a>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm flex items-center gap-2">
                    Email
                    {!customer.email?.trim() && (
                      <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                        Missing
                      </Badge>
                    )}
                  </p>
                  <p>
                    {customer.email ? (
                      <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                        {customer.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Preferred Language</p>
                  <p>{langLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Date of Birth</p>
                  <p>
                    {customer.date_of_birth
                      ? new Date(customer.date_of_birth).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Address</p>
                  <p className="whitespace-pre-wrap">{customer.address ?? "—"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead Info</CardTitle>
                <CardDescription>Status, source, dates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Lead Status</p>
                  <Badge className={statusClass}>{statusLabel}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Lead Source</p>
                  <p>{sourceLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Total Orders</p>
                  <p>
                    {customer.total_orders != null ? (
                      <Badge variant="secondary">{customer.total_orders}</Badge>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Last Visit</p>
                  <p>
                    {customer.last_visit_date
                      ? new Date(customer.last_visit_date).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Created</p>
                  <p>{new Date(customer.created_at).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">Notes</p>
                  <p className="whitespace-pre-wrap">{customer.notes ?? "—"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Linked Vehicles</CardTitle>
              <CardDescription>Cars linked via sales orders</CardDescription>
            </CardHeader>
            <CardContent>
              {vehicles.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No vehicles linked to this customer.
                </p>
              ) : (
                <div className="space-y-4">
                  {vehicles.map((so) => {
                  const car = so.cars;
                  if (!car) return null;
                  const isSubDealer = car.status === "sent_to_sub_dealer";
                  const carStatusClass =
                    STATUS_BADGE_COLORS[car.status] ?? "bg-muted text-muted-foreground";
                  const carStatusLabel =
                    CAR_STATUS_LABELS[car.status as keyof typeof CAR_STATUS_LABELS] ??
                    car.status;
                  const dateBoughtDisplay = so.date_bought ?? so.sale_date;
                    return (
                      <div
                        key={so.id}
                        className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-lg font-medium">
                              {car.brand} {car.model}
                              {car.model_year ? ` (${car.model_year})` : ""}
                            </p>
                            <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                              <p
                                className="cursor-pointer font-mono text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(car.vin);
                                  toast.success("VIN copied");
                                }}
                                title="Click to copy"
                              >
                                VIN: {car.vin}
                              </p>
                              <p className="flex items-center gap-1">
                                Status:{" "}
                                <Badge className={carStatusClass}>{carStatusLabel}</Badge>
                                {isSubDealer && (
                                  <Badge variant="outline" className="bg-muted text-muted-foreground">
                                    {car.sub_dealer_name || "Sub-dealer"}
                                  </Badge>
                                )}
                              </p>
                              <p>Color: {car.exterior_color ?? "—"}</p>
                              <p>
                                Price:{" "}
                                {so.selling_price != null
                                  ? `${Number(so.selling_price).toLocaleString()} ${so.currency ?? "USD"}`
                                  : "—"}
                              </p>
                              <p>
                                Date Bought:{" "}
                                {dateBoughtDisplay
                                  ? new Date(dateBoughtDisplay).toLocaleDateString()
                                  : "—"}
                              </p>
                              <p>
                                Delivery:{" "}
                                {so.delivery_date
                                  ? new Date(so.delivery_date).toLocaleDateString()
                                  : "—"}
                              </p>
                              <p>
                                Sale:{" "}
                                <Badge variant="secondary">{so.status}</Badge>
                              </p>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/cars/${encodeURIComponent(car.vin ?? car.id)}?open=garage`
                                  )
                                }
                                className="cursor-pointer transition-opacity hover:opacity-90"
                              >
                                <Badge
                                  variant="outline"
                                  className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                >
                                  Garage visits: {so.visits}
                                </Badge>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/cars/${encodeURIComponent(car.vin ?? car.id)}?open=maintenance`
                                  )
                                }
                                className="cursor-pointer transition-opacity hover:opacity-90"
                              >
                                <Badge
                                  variant="outline"
                                  className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                >
                                  Maintenance: {so.maintenance}
                                </Badge>
                              </button>
                            </div>
                            {so.visitEvents.length > 0 && (
                              <div className="mt-4 border-t pt-4">
                                <p className="mb-2 text-sm font-medium text-muted-foreground">
                                  Visitation history
                                </p>
                                <ul className="space-y-1.5 text-sm">
                                  {so.visitEvents.map((ev) => (
                                    <li key={ev.id} className="flex items-center gap-2">
                                      <span
                                        className={
                                          ev.visitType === "garage"
                                            ? "text-blue-600 dark:text-blue-400"
                                            : "text-muted-foreground"
                                        }
                                      >
                                        {ev.visitType === "garage"
                                          ? "🔧 Garage"
                                          : "🏢 Company entry"}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {ev.from_value && ev.to_value
                                          ? `${ev.from_value} → ${ev.to_value}`
                                          : ev.to_value ?? ev.from_value ?? ""}
                                      </span>
                                      <span className="text-muted-foreground text-xs">
                                        {new Date(ev.created_at).toLocaleString()}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`)
                            }
                          >
                            View Car →
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {legacyVehicles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Legacy vehicles not yet linked</CardTitle>
                <CardDescription>
                  Cars where this name appears on the car row but no sales
                  order exists yet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {legacyVehicles.map((car) => {
                    const statusClass =
                      STATUS_BADGE_COLORS[car.status] ??
                      "bg-muted text-muted-foreground";
                    const statusLabel =
                      CAR_STATUS_LABELS[car.status as keyof typeof CAR_STATUS_LABELS] ??
                      car.status;

                    return (
                      <div
                        key={car.id}
                        className="flex items-start justify-between gap-4 rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {car.brand} {car.model}
                            {car.model_year ? ` (${car.model_year})` : ""}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            VIN: {car.vin}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Status:{" "}
                            <Badge className={statusClass}>{statusLabel}</Badge>
                          </p>
                          {car.client_phone && (
                            <p className="text-xs text-muted-foreground">
                              Phone on car: {car.client_phone}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/cars/${encodeURIComponent(car.vin ?? car.id)}`
                            )
                          }
                        >
                          View & Link →
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <CustomerNotes customerId={customer.id} />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <CustomerDocuments customerId={customer.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
