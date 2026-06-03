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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Ship, Plus, ClipboardCheck } from "lucide-react";

/**
 * Ordered Cars — tracks cars that have been ordered and are inbound
 * (car status 'inbound'). Shows shipment code, ETA and VIN. When a car
 * arrives it is received via a receiving inspection checklist, then moves
 * into inventory and is gated as "Awaiting PDI" until its PDI is done.
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

interface AwaitingPdiCar {
  id: string;
  vin: string;
  brand: string;
  model: string;
  model_year: number | null;
  date_arrived: string | null;
  pdi_status: string | null;
  has_issues: boolean;
}

const RECEIVE_CHECKS = [
  { key: "vin_confirmed", label: "VIN matches the shipment", isReceived: false },
  { key: "keys_received", label: "Keys received", isReceived: true },
  { key: "documents_received", label: "Documents received", isReceived: true },
  {
    key: "charger_received",
    label: "Charger / charging cable received",
    isReceived: true,
  },
  { key: "accessories_received", label: "Accessories received", isReceived: true },
  { key: "exterior_ok", label: "Exterior — no damage", isReceived: false },
] as const;

type CheckKey = (typeof RECEIVE_CHECKS)[number]["key"];

const PDI_BADGE_LABEL: Record<string, string> = {
  pending: "PDI pending",
  in_progress: "PDI in progress",
  done: "PDI done",
};

export default function OrderedCarsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { canEditInventory } = useUser();

  const [cars, setCars] = useState<IncomingCar[]>([]);
  const [awaitingPdi, setAwaitingPdi] = useState<AwaitingPdiCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // Add-incoming-car form state
  const [vin, setVin] = useState("");
  const [brand, setBrand] = useState<string>("Voyah");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [shipmentCode, setShipmentCode] = useState("");
  const [eta, setEta] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Receive-car dialog state
  const [receivingCar, setReceivingCar] = useState<IncomingCar | null>(null);
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({
    vin_confirmed: false,
    keys_received: false,
    documents_received: false,
    charger_received: false,
    accessories_received: false,
    exterior_ok: false,
  });
  const [damageNotes, setDamageNotes] = useState("");
  const [missingNotes, setMissingNotes] = useState("");
  const [receiving, setReceiving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const inboundReq = supabase
      .from("cars")
      .select(
        "id, vin, brand, model, model_year, shipment_code, incoming_eta, notes"
      )
      .eq("status", "inbound")
      .is("deleted_at", null)
      .order("incoming_eta", { ascending: true, nullsFirst: false })
      .limit(500);

    const checksReq = supabase
      .from("car_arrival_checks")
      .select("car_id, has_issues, checked_at")
      .order("checked_at", { ascending: false })
      .limit(500);

    const arrivedReq = supabase
      .from("cars")
      .select("id, vin, brand, model, model_year, date_arrived, pdi_status")
      .eq("status", "inventory")
      .neq("pdi_status", "done")
      .is("deleted_at", null)
      .limit(500);

    const [inboundRes, checksRes, arrivedRes] = await Promise.all([
      inboundReq,
      checksReq,
      arrivedReq,
    ]);

    if (inboundRes.error) {
      toast.error(formatError(inboundRes.error));
      setCars([]);
    } else {
      setCars((inboundRes.data as IncomingCar[]) ?? []);
    }

    if (checksRes.error || arrivedRes.error) {
      toast.error(formatError(checksRes.error ?? arrivedRes.error));
      setAwaitingPdi([]);
    } else {
      const checkRows =
        (checksRes.data as { car_id: string; has_issues: boolean }[]) ?? [];
      const issuesByCar = new Map<string, boolean>();
      for (const row of checkRows) {
        if (!issuesByCar.has(row.car_id)) {
          issuesByCar.set(row.car_id, row.has_issues);
        } else if (row.has_issues) {
          issuesByCar.set(row.car_id, true);
        }
      }
      const arrivedRows =
        (arrivedRes.data as Omit<AwaitingPdiCar, "has_issues">[]) ?? [];
      const awaiting = arrivedRows
        .map<AwaitingPdiCar>((c) => ({
          ...c,
          has_issues: issuesByCar.get(c.id) ?? false,
        }))
        .sort((a, b) =>
          (b.date_arrived ?? "").localeCompare(a.date_arrived ?? "")
        );
      setAwaitingPdi(awaiting);
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
        String(c.model_year ?? "").toLowerCase().includes(q) ||
        (c.shipment_code ?? "").toLowerCase().includes(q)
    );
  }, [cars, query]);

  // Same search input filters the Awaiting PDI section too. Previously the
  // search only narrowed the "Cars on order" table, which surprised users who
  // typed a VIN expecting it to find the matching just-arrived car here.
  const filteredAwaitingPdi = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return awaitingPdi;
    return awaitingPdi.filter(
      (c) =>
        c.vin.toLowerCase().includes(q) ||
        c.brand.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        String(c.model_year ?? "").toLowerCase().includes(q) ||
        (c.pdi_status ?? "").toLowerCase().includes(q)
    );
  }, [awaitingPdi, query]);

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
      ...(modelYear ? { p_model_year: parseInt(modelYear, 10) } : {}),
      p_location_type: "storage",
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

  function openReceive(car: IncomingCar) {
    setReceivingCar(car);
    setChecks({
      vin_confirmed: false,
      keys_received: false,
      documents_received: false,
      charger_received: false,
      accessories_received: false,
      exterior_ok: false,
    });
    setDamageNotes("");
    setMissingNotes("");
  }

  function closeReceive() {
    setReceivingCar(null);
  }

  async function handleReceive() {
    if (!receivingCar || !canEditInventory) return;

    const hasIssues = RECEIVE_CHECKS.some((c) => !checks[c.key]);

    // Foolproof rule: an unchecked box must be explained in the matching note.
    const missingUnchecked = RECEIVE_CHECKS.some(
      (c) => c.isReceived && !checks[c.key]
    );
    if (missingUnchecked && !missingNotes.trim()) {
      toast.error(
        "Some items were not received — fill in the missing items notes."
      );
      return;
    }
    if (!checks.vin_confirmed && !missingNotes.trim()) {
      toast.error(
        "VIN does not match — explain it in the missing items notes."
      );
      return;
    }
    if (!checks.exterior_ok && !damageNotes.trim()) {
      toast.error(
        "Exterior is not clear — describe the damage in the damage notes."
      );
      return;
    }

    setReceiving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error: checkError } = await supabase
      .from("car_arrival_checks")
      .insert({
        car_id: receivingCar.id,
        vin_confirmed: checks.vin_confirmed,
        keys_received: checks.keys_received,
        documents_received: checks.documents_received,
        charger_received: checks.charger_received,
        accessories_received: checks.accessories_received,
        exterior_ok: checks.exterior_ok,
        has_issues: hasIssues,
        damage_notes: damageNotes.trim() || null,
        missing_notes: missingNotes.trim() || null,
        checked_by: user?.id ?? null,
      });

    if (checkError) {
      setReceiving(false);
      toast.error(formatError(checkError));
      return;
    }

    const { error: carError } = await supabase
      .from("cars")
      .update({
        status: "inventory",
        date_arrived: new Date().toISOString().slice(0, 10),
      })
      .eq("id", receivingCar.id);

    setReceiving(false);
    if (carError) {
      toast.error(formatError(carError));
      return;
    }

    toast.success(`${receivingCar.vin} received — now awaiting PDI`);
    setReceivingCar(null);
    void load();
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
            Cars on order and inbound — shipment code, ETA and VIN. Receive each
            one with the inspection checklist when it lands.
          </p>
        </div>
        {canEditInventory && (
          <Button
            data-tour-id="ordered-cars-add"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1.5 size-4" />
            Add incoming car
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          id="ordered-cars-search"
          name="ordered-cars-search"
          data-tour-id="ordered-cars-search"
          placeholder="Search by VIN, brand, model, year, shipment code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      <Card data-tour-id="ordered-cars-in-transit">
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
                        onClick={() => router.push(`/cars/${c.id}`)}
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
                        {c.incoming_eta ? (
                          new Date(c.incoming_eta).toLocaleDateString()
                        ) : (
                          <span title="No ETA recorded yet.">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/cars/${c.id}`)}
                          >
                            Open
                          </Button>
                          {canEditInventory && (
                            <Button
                              data-tour-id="ordered-cars-receive"
                              size="sm"
                              onClick={() => openReceive(c)}
                            >
                              Receive car
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

      <div data-tour-id="ordered-cars-awaiting-pdi" className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardCheck className="size-5" />
            Awaiting PDI
          </h2>
          <p className="text-muted-foreground text-sm">
            Cars that have been received but still need a PDI check before they
            count as fleet-ready. Open a car to record its PDI.
          </p>
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredAwaitingPdi.length === 0 ? (
              <p className="text-muted-foreground p-8 text-center text-sm">
                {awaitingPdi.length === 0
                  ? "No cars are waiting for a PDI check."
                  : "No PDI-pending cars match the search."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">VIN</th>
                      <th className="px-3 py-2">Vehicle</th>
                      <th className="px-3 py-2">Arrived</th>
                      <th className="px-3 py-2">PDI status</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {filteredAwaitingPdi.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/50">
                        <td
                          className="cursor-pointer px-3 py-2 font-mono"
                          onClick={() => router.push(`/cars/${c.id}`)}
                        >
                          {c.vin}
                        </td>
                        <td className="px-3 py-2">
                          {c.brand} {c.model}
                          {c.model_year ? ` (${c.model_year})` : ""}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">
                          {c.date_arrived ? (
                            new Date(c.date_arrived).toLocaleDateString()
                          ) : (
                            <span title="No arrival date recorded yet.">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">
                              {PDI_BADGE_LABEL[c.pdi_status ?? "pending"] ??
                                "PDI pending"}
                            </Badge>
                            {c.has_issues && (
                              <Badge variant="destructive">Issues noted</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/cars/${c.id}`)}
                          >
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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

      <Dialog
        open={receivingCar !== null}
        onOpenChange={(o) => !o && closeReceive()}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Receive car — {receivingCar?.vin}
            </DialogTitle>
            <DialogDescription>
              Go through the receiving inspection. Tick everything that is
              correct; anything missing or damaged must be written down.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              {RECEIVE_CHECKS.map((c) => (
                <div key={c.key} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`receive-${c.key}`}
                    checked={checks[c.key]}
                    onCheckedChange={(v) =>
                      setChecks((prev) => ({ ...prev, [c.key]: v === true }))
                    }
                  />
                  <Label
                    htmlFor={`receive-${c.key}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {c.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="receive-damage">Damage notes</Label>
              <Textarea
                id="receive-damage"
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                placeholder="Describe any exterior damage found."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receive-missing">Missing items notes</Label>
              <Textarea
                id="receive-missing"
                value={missingNotes}
                onChange={(e) => setMissingNotes(e.target.value)}
                placeholder="List anything that did not arrive (keys, documents, charger, accessories)."
                rows={3}
              />
            </div>

            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              After receiving, this car still needs a PDI check before it counts
              as fleet-ready.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeReceive}
              disabled={receiving}
            >
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={receiving}>
              {receiving ? "Saving…" : "Confirm receive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
