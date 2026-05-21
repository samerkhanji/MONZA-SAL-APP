"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { formatError } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Ship, Plus } from "lucide-react";

/**
 * Ordered Cars — tracks cars that have been ordered and are inbound
 * (car status 'inbound'). Shows shipment code, ETA and VIN. When a car
 * arrives it is marked as in inventory and drops off this list, so the
 * page works as an arrivals checklist.
 */

const BRANDS = ["Voyah", "MHero"] as const;
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

interface IncomingCar {
  id: string;
  vin: string;
  brand: string;
  model: string;
  model_year: number | null;
  shipment_code: string | null;
  incoming_eta: string | null;
  notes: string | null;
}

export default function OrderedCarsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { canEditInventory } = useUser();

  const [cars, setCars] = useState<IncomingCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [arrivingCar, setArrivingCar] = useState<IncomingCar | null>(null);

  // Add-incoming-car form state
  const [vin, setVin] = useState("");
  const [brand, setBrand] = useState<string>("Voyah");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [shipmentCode, setShipmentCode] = useState("");
  const [eta, setEta] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cars")
      .select(
        "id, vin, brand, model, model_year, shipment_code, incoming_eta, notes"
      )
      .eq("status", "inbound")
      .is("deleted_at", null)
      .order("incoming_eta", { ascending: true, nullsFirst: false });
    if (error) {
      toast.error(formatError(error));
      setCars([]);
    } else {
      setCars((data as IncomingCar[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cars;
    return cars.filter(
      (c) =>
        c.vin.toLowerCase().includes(q) ||
        c.brand.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        (c.shipment_code ?? "").toLowerCase().includes(q)
    );
  }, [cars, query]);

  function resetForm() {
    setVin("");
    setBrand("Voyah");
    setModel("");
    setModelYear("");
    setShipmentCode("");
    setEta("");
  }

  async function handleAdd() {
    const vinTrimmed = vin.trim().toUpperCase();
    if (vinTrimmed.length !== 17 || !VIN_REGEX.test(vinTrimmed)) {
      toast.error("VIN must be exactly 17 letters and numbers.");
      return;
    }
    if (!model.trim()) {
      toast.error("Model is required.");
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      toast.error("Not authenticated");
      return;
    }

    const { data: carData, error: carError } = await supabase.rpc("create_car", {
      p_vin: vinTrimmed,
      p_brand: brand,
      p_model: model.trim(),
      p_model_year: modelYear ? parseInt(modelYear, 10) : null,
      p_location_type: "storage",
      p_location_slot: null,
      p_status: "inbound",
      p_user_id: user.id,
    });

    if (carError) {
      setSubmitting(false);
      const isRls =
        carError.code === "42501" ||
        carError.message.toLowerCase().includes("permission") ||
        carError.message.toLowerCase().includes("policy");
      toast.error(
        isRls
          ? "You don't have permission to add cars."
          : `Failed to add car: ${carError.message}`
      );
      return;
    }

    const carId = (carData as { id: string } | null)?.id;
    if (carId && (shipmentCode.trim() || eta)) {
      const { error: updErr } = await supabase
        .from("cars")
        .update({
          shipment_code: shipmentCode.trim() || null,
          incoming_eta: eta || null,
        })
        .eq("id", carId);
      if (updErr) {
        toast.error(
          `Car added but shipment details failed to save: ${formatError(updErr)}`
        );
      }
    }

    setSubmitting(false);
    toast.success("Incoming car added");
    resetForm();
    setAddOpen(false);
    void load();
  }

  async function handleArrived(car: IncomingCar) {
    if (!canEditInventory) return;
    setBusyId(car.id);
    const { error } = await supabase
      .from("cars")
      .update({
        status: "inventory",
        date_arrived: new Date().toISOString().slice(0, 10),
      })
      .eq("id", car.id);
    setBusyId(null);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success(`${car.vin} marked as arrived`);
    setCars((prev) => prev.filter((c) => c.id !== car.id));
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Ship className="size-6" />
            Ordered Cars
          </h1>
          <p className="text-muted-foreground text-sm">
            Cars on order and inbound — shipment code, ETA and VIN. Mark each
            one as arrived when it lands and it drops off the list.
          </p>
        </div>
        {canEditInventory && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            Add incoming car
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search by VIN, brand, model, shipment code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {cars.length === 0
                ? "No cars are currently on order."
                : "No ordered cars match the search."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">VIN</th>
                    <th className="px-3 py-2">Vehicle</th>
                    <th className="px-3 py-2">Shipment code</th>
                    <th className="px-3 py-2">ETA</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td
                        className="cursor-pointer px-3 py-2 font-mono"
                        onClick={() =>
                          router.push(`/cars/${encodeURIComponent(c.vin)}`)
                        }
                      >
                        {c.vin}
                      </td>
                      <td className="px-3 py-2">
                        {c.brand} {c.model}
                        {c.model_year ? ` (${c.model_year})` : ""}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {c.shipment_code || "—"}
                      </td>
                      <td className="text-muted-foreground px-3 py-2">
                        {c.incoming_eta
                          ? new Date(c.incoming_eta).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              router.push(`/cars/${encodeURIComponent(c.vin)}`)
                            }
                          >
                            Open
                          </Button>
                          {canEditInventory && (
                            <Button
                              size="sm"
                              disabled={busyId === c.id}
                              onClick={() => setArrivingCar(c)}
                            >
                              {busyId === c.id ? "Saving…" : "Mark as arrived"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add incoming car</DialogTitle>
            <DialogDescription>
              Records a car with status &quot;inbound&quot; so it shows on this
              list until it arrives.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="oc-vin">VIN *</Label>
              <Input
                id="oc-vin"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase().slice(0, 17))}
                placeholder="17-character VIN"
                className="font-mono"
                maxLength={17}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="oc-brand">Brand *</Label>
                <Select value={brand} onValueChange={setBrand}>
                  <SelectTrigger id="oc-brand">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="oc-year">Model year</Label>
                <Input
                  id="oc-year"
                  type="number"
                  inputMode="numeric"
                  value={modelYear}
                  onChange={(e) => setModelYear(e.target.value)}
                  placeholder="2025"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oc-model">Model *</Label>
              <Input
                id="oc-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Free, Dreamer"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="oc-shipment">Shipment code</Label>
                <Input
                  id="oc-shipment"
                  value={shipmentCode}
                  onChange={(e) => setShipmentCode(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oc-eta">ETA</Label>
                <Input
                  id="oc-eta"
                  type="date"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? "Adding…" : "Add incoming car"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={arrivingCar !== null}
        onOpenChange={(open) => !open && setArrivingCar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as arrived?</AlertDialogTitle>
            <AlertDialogDescription>
              VIN {arrivingCar?.vin} will move into inventory and drop off this
              list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (arrivingCar) {
                  void handleArrived(arrivingCar);
                  setArrivingCar(null);
                }
              }}
            >
              Mark as arrived
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
