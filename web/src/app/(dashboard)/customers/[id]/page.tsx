"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatError } from "@/lib/error-messages";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditCustomerDialog } from "@/components/customers/EditCustomerDialog";
import { CustomerNotes } from "@/components/customers/CustomerNotes";
import { CustomerDocuments } from "@/components/customers/CustomerDocuments";
import { STATUS_BADGE_COLORS } from "@/lib/constants/badges";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog as StartSaleDialog,
  DialogContent as StartSaleDialogContent,
  DialogDescription as StartSaleDialogDescription,
  DialogFooter as StartSaleDialogFooter,
  DialogHeader as StartSaleDialogHeader,
  DialogTitle as StartSaleDialogTitle,
} from "@/components/ui/dialog";

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
  const canDeleteCustomer = canPerform("customers", "delete", appRole ?? null);
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
  const [startSaleOpen, setStartSaleOpen] = useState(false);
  const [startSaleSearch, setStartSaleSearch] = useState("");
  const [startSaleResults, setStartSaleResults] = useState<
    Array<{ id: string; vin: string; brand: string; model: string; status: string | null }>
  >([]);
  const [startSaleSubmitting, setStartSaleSubmitting] = useState(false);
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [anonymizeReason, setAnonymizeReason] = useState("");
  const [anonymizing, setAnonymizing] = useState(false);

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

    // C1: collapse the per-car N+1 into 2 batched queries.
    const typedOrders = orders as unknown as EnrichedSaleOrder[];
    const carIds: string[] = typedOrders
      .map((o) => (o.cars as { id?: string } | null)?.id ?? null)
      .filter((id): id is string => Boolean(id));

    type EventRow = {
      id: string;
      car_id: string;
      event_type: string;
      from_value: string | null;
      to_value: string | null;
      created_at: string;
    };

    let movedByCar = new Map<string, EventRow[]>();
    let maintByCar = new Map<string, number>();

    if (carIds.length > 0) {
      const [movedRes, maintRes] = await Promise.all([
        supabase
          .from("car_events")
          .select("id, car_id, event_type, from_value, to_value, created_at")
          .in("car_id", carIds)
          .eq("event_type", "moved")
          .order("created_at", { ascending: false }),
        supabase
          .from("car_events")
          .select("car_id")
          .in("car_id", carIds)
          .eq("event_type", "status_changed")
          .eq("to_value", "service"),
      ]);

      for (const ev of (movedRes.data ?? []) as EventRow[]) {
        const arr = movedByCar.get(ev.car_id) ?? [];
        arr.push(ev);
        movedByCar.set(ev.car_id, arr);
      }
      for (const ev of (maintRes.data ?? []) as { car_id: string }[]) {
        maintByCar.set(ev.car_id, (maintByCar.get(ev.car_id) ?? 0) + 1);
      }
    }

    const enrichedOrders: EnrichedSaleOrder[] = typedOrders.map((order) => {
      const carId = (order.cars as { id?: string } | null)?.id;
      if (!carId) {
        return { ...order, visits: 0, maintenance: 0, visitEvents: [] };
      }
      const movedEvents = movedByCar.get(carId) ?? [];
      const visitEvents: VisitEvent[] = movedEvents.map((ev) => {
        const toVal = (ev.to_value ?? "").toLowerCase();
        const isGarage = toVal.includes("garage");
        return {
          id: ev.id,
          event_type: ev.event_type,
          from_value: ev.from_value,
          to_value: ev.to_value,
          created_at: ev.created_at,
          visitType: isGarage ? "garage" : "company_entry",
        };
      });
      const garageCount = visitEvents.filter((v) => v.visitType === "garage").length;
      return {
        ...order,
        visits: garageCount,
        maintenance: maintByCar.get(carId) ?? 0,
        visitEvents,
      };
    });

    setVehicles(enrichedOrders);
  }

  async function fetchLegacyVehicles(fullName: string) {
    if (!fullName.trim()) {
      setLegacyVehicles([]);
      return;
    }

    // `client_name` / `client_phone` live on the cars_display view, not the
    // base cars table. Embedding sales_orders from a view isn't reliable in
    // PostgREST, so we fetch matching cars and the customer's orders
    // separately, then filter out cars that already have a sales order.
    const { data, error } = await supabase
      .from("cars_display")
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
        client_phone
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
    }[];

    const carIds = rows.map((r) => r.id);
    const linkedCarIds = new Set<string>();
    if (carIds.length > 0) {
      const { data: linkedOrders } = await supabase
        .from("sales_orders")
        .select("car_id")
        .in("car_id", carIds);
      for (const o of (linkedOrders ?? []) as { car_id: string | null }[]) {
        if (o.car_id) linkedCarIds.add(o.car_id);
      }
    }

    const unlinked = rows.filter((row) => !linkedCarIds.has(row.id));

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
    if (!canDeleteCustomer) {
      toast.error("You don't have permission to delete customers.");
      return;
    }

    // Pre-check for related records the DB delete trigger doesn't cover
    // (payment plans). Active sales orders are still blocked server-side
    // via the customers delete trigger; this just surfaces a clear message
    // before the request and stops payment plans being orphaned.
    const [{ count: activeOrders }, { count: activePlans }] = await Promise.all([
      supabase
        .from("sales_orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .not("status", "in", "(cancelled,delivered)"),
      supabase
        .from("payment_plans")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .not("status", "in", "(completed,cancelled)"),
    ]);
    if ((activeOrders ?? 0) > 0 || (activePlans ?? 0) > 0) {
      const parts: string[] = [];
      if ((activeOrders ?? 0) > 0) {
        parts.push(`${activeOrders} active sales order${(activeOrders ?? 0) === 1 ? "" : "s"}`);
      }
      if ((activePlans ?? 0) > 0) {
        parts.push(`${activePlans} active payment plan${(activePlans ?? 0) === 1 ? "" : "s"}`);
      }
      toast.error(
        `Cannot delete this customer — they still have ${parts.join(" and ")}. Cancel or complete them first.`
      );
      return;
    }

    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(
        typeof body?.error === "string" ? body.error : `Failed to delete (${res.status})`
      );
      return;
    }

    toast.success("Customer removed successfully");
    setDeleteOpen(false);
    router.push("/customers");
  }

  // Search for available cars to attach to a new sales order. Excludes
  // already-sold/delivered/scrapped cars; matches VIN/brand/model substring.
  useEffect(() => {
    if (!startSaleOpen) return;
    const q = startSaleSearch.trim().toLowerCase();
    let cancelled = false;
    (async () => {
      const sb = createClient();
      let query = sb
        .from("cars")
        .select("id, vin, brand, model, status")
        .is("deleted_at", null)
        .not("status", "in", "(sold,delivered,scrapped)")
        .order("created_at", { ascending: false })
        .limit(15);
      if (q) {
        query = query.or(`vin.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`);
      }
      const { data } = await query;
      if (!cancelled) setStartSaleResults((data ?? []) as typeof startSaleResults);
    })();
    return () => {
      cancelled = true;
    };
  }, [startSaleOpen, startSaleSearch]);

  async function startNewSale(carId: string) {
    if (!customer) return;
    setStartSaleSubmitting(true);
    const sb = createClient();
    const { data, error } = await sb
      .from("sales_orders")
      .insert({
        customer_id: customer.id,
        car_id: carId,
        status: "draft",
      })
      .select("id")
      .single();
    setStartSaleSubmitting(false);
    if (error || !data) {
      toast.error(formatError(error));
      return;
    }
    setStartSaleOpen(false);
    setStartSaleSearch("");
    toast.success("Draft sale created. Add the quote next.");
    router.push(`/sales-orders/${(data as { id: string }).id}`);
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
            <Button variant="outline" onClick={() => setEditOpen(true)} data-tour-id="customers-detail-edit-button">
              Edit
            </Button>
          )}
          {canDeleteCustomer && (
            <Button variant="destructive" onClick={() => setDeleteOpen(true)} data-tour-id="customers-detail-delete-button">
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
              This removes the customer from active lists. It is blocked if they
              still have an active sales order or payment plan — cancel or
              complete those first. The record can be restored by an admin.
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

      <Tabs defaultValue="profile" className="space-y-4" data-tour-id="customers-detail-tabs">
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
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Linked Vehicles</CardTitle>
                <CardDescription>Cars linked via sales orders</CardDescription>
              </div>
              {!customer.anonymized_at && canEditCustomer && (
                <Button
                  size="sm"
                  onClick={() => setStartSaleOpen(true)}
                  className="shrink-0"
                >
                  <Plus className="mr-1 size-4" />
                  Start a new sale
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {vehicles.length === 0 ? (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    No vehicles linked to this customer yet.
                  </p>
                  {!customer.anonymized_at && canEditCustomer && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStartSaleOpen(true)}
                    >
                      <Plus className="mr-1 size-4" />
                      Start a new sale for this customer
                    </Button>
                  )}
                </div>
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

      {/* GDPR / privacy tools — owner-only. Anonymization is irreversible
          and overwrites PII; the export gives the customer a copy of
          everything the dealership stores about them. */}
      {appRole === "owner" && !customer.anonymized_at && (
        <Card className="border-amber-300/50">
          <CardHeader>
            <CardTitle className="text-base">Privacy / GDPR</CardTitle>
            <CardDescription>
              Owner-only. Use these to satisfy GDPR right-of-access (export)
              and right-to-erasure (anonymize) requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = `/api/customers/${customer.id}/export`;
              }}
            >
              Export customer data (JSON)
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setAnonymizeReason("");
                setAnonymizeOpen(true);
              }}
            >
              Anonymize this customer…
            </Button>
          </CardContent>
        </Card>
      )}

      {customer.anonymized_at && (
        <Card className="border-red-300/60 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-base text-red-700 dark:text-red-300">
              Customer data anonymized
            </CardTitle>
            <CardDescription>
              Anonymized {new Date(customer.anonymized_at).toLocaleString()} per
              GDPR request. PII has been removed; transactional records
              (sales, installments) remain for tax/audit retention.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Start a new sale for this customer — pick an available car, draft
          sales order is created and we route to it. Closes audit B1. */}
      <StartSaleDialog open={startSaleOpen} onOpenChange={setStartSaleOpen}>
        <StartSaleDialogContent className="sm:max-w-lg">
          <StartSaleDialogHeader>
            <StartSaleDialogTitle>Start a new sale</StartSaleDialogTitle>
            <StartSaleDialogDescription>
              Pick an available car for {customer.first_name}
              {customer.last_name ? ` ${customer.last_name}` : ""}. A draft
              sales order will be created so you can record the quote next.
            </StartSaleDialogDescription>
          </StartSaleDialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Search VIN, brand, or model…"
              value={startSaleSearch}
              onChange={(e) => setStartSaleSearch(e.target.value)}
            />
            <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border/60">
              {startSaleResults.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">
                  No matching available cars.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {startSaleResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={startSaleSubmitting}
                        onClick={() => startNewSale(c.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{c.brand} {c.model}</span>
                          <span className="text-muted-foreground ml-2 font-mono text-xs">
                            {c.vin ? `…${c.vin.slice(-8)}` : "—"}
                          </span>
                        </span>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {CAR_STATUS_LABELS[c.status as keyof typeof CAR_STATUS_LABELS] ?? c.status ?? "—"}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <StartSaleDialogFooter>
            <Button
              variant="outline"
              onClick={() => setStartSaleOpen(false)}
              disabled={startSaleSubmitting}
            >
              Cancel
            </Button>
          </StartSaleDialogFooter>
        </StartSaleDialogContent>
      </StartSaleDialog>

      <Dialog
        open={anonymizeOpen}
        onOpenChange={(open) => {
          if (!anonymizing) setAnonymizeOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anonymize this customer?</DialogTitle>
            <DialogDescription>
              This replaces name, phone, email, and address with{" "}
              <span className="font-mono">[Anonymized]</span> and{" "}
              <strong>cannot be undone</strong>. Sales history and audit trails
              are preserved. Use this for GDPR right-to-erasure requests.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="anonymize-reason">Reason *</Label>
            <Textarea
              id="anonymize-reason"
              value={anonymizeReason}
              onChange={(e) => setAnonymizeReason(e.target.value)}
              rows={4}
              placeholder="e.g. GDPR erasure ticket #LB-2026-0142, customer email request dated 2026-05-04."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnonymizeOpen(false)}
              disabled={anonymizing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={anonymizing || !anonymizeReason.trim()}
              onClick={async () => {
                if (!customer) return;
                setAnonymizing(true);
                const supabase = createClient();
                const { error } = await supabase.rpc("gdpr_anonymize_customer", {
                  p_customer_id: customer.id,
                  p_reason: anonymizeReason.trim(),
                });
                setAnonymizing(false);
                if (error) {
                  toast.error(formatError(error));
                  return;
                }
                toast.success("Customer anonymized.");
                setAnonymizeOpen(false);
                router.push("/customers");
              }}
            >
              {anonymizing ? "Anonymizing…" : "Anonymize permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
