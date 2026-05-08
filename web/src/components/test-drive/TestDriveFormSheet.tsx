"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { CarStatus } from "@/types/database";
import { TEST_DRIVE_STATUS_LABELS } from "@/types/database";
import type { UserProfile } from "@/lib/contexts/UserContext";
import type { TestDriveWithCar } from "@/lib/data/test-drives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatError } from "@/lib/error-messages";

export type TestDriveCarSummary = {
  id: string;
  vin: string;
  brand: string;
  model: string;
  status: CarStatus;
  current_km: number | null;
  battery_percent: number | null;
};

function isoNow(): string {
  return new Date().toISOString();
}

function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromIsoToLocalValue(iso: string): string {
  return toLocalDatetimeValue(new Date(iso));
}

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function numOrNullDecimal(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

interface TestDriveFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  car: TestDriveCarSummary | null;
  existing: TestDriveWithCar | null;
  profile: UserProfile;
  onSaved: () => void;
}

export function TestDriveFormSheet({
  open,
  onOpenChange,
  car,
  existing,
  profile,
  onSaved,
}: TestDriveFormSheetProps) {
  const supabase = createClient();
  const isExisting = !!existing?.id;
  const isOut = existing?.status === "out_for_test_drive";

  const [saving, setSaving] = useState(false);

  const [vin, setVin] = useState("");
  const [carId, setCarId] = useState("");
  const [testDriveStartAt, setTestDriveStartAt] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState("");
  const [actualReturnAt, setActualReturnAt] = useState("");
  const [outcome, setOutcome] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [route, setRoute] = useState("");
  const [purpose, setPurpose] = useState("");
  const [companionEmployee, setCompanionEmployee] = useState("");
  const [odometerOut, setOdometerOut] = useState("");
  const [odometerIn, setOdometerIn] = useState("");
  const [batteryOut, setBatteryOut] = useState("");
  const [batteryIn, setBatteryIn] = useState("");
  const [fuelOut, setFuelOut] = useState("");
  const [fuelIn, setFuelIn] = useState("");
  const [driverLicenseChecked, setDriverLicenseChecked] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [waiverSigned, setWaiverSigned] = useState(false);
  const [incidentNotes, setIncidentNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [carStatusBefore, setCarStatusBefore] = useState<CarStatus | null>(null);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setVin(existing.vin);
      setCarId(existing.car_id);
      setTestDriveStartAt(fromIsoToLocalValue(existing.test_drive_start_at));
      setExpectedReturnAt(
        existing.expected_return_at ? fromIsoToLocalValue(existing.expected_return_at) : ""
      );
      setActualReturnAt(
        existing.actual_return_at ? fromIsoToLocalValue(existing.actual_return_at) : ""
      );
      setOutcome((existing as { outcome?: string | null }).outcome ?? "");
      setCustomerName(existing.customer_name ?? "");
      setCustomerPhone(existing.customer_phone ?? "");
      setCustomerId(existing.customer_id);
      setRoute(existing.route ?? "");
      setPurpose(existing.purpose ?? "");
      setCompanionEmployee(existing.companion_employee ?? "");
      setOdometerOut(existing.odometer_out != null ? String(existing.odometer_out) : "");
      setOdometerIn(existing.odometer_in != null ? String(existing.odometer_in) : "");
      setBatteryOut(existing.battery_out != null ? String(existing.battery_out) : "");
      setBatteryIn(existing.battery_in != null ? String(existing.battery_in) : "");
      setFuelOut(existing.fuel_out != null ? String(existing.fuel_out) : "");
      setFuelIn(existing.fuel_in != null ? String(existing.fuel_in) : "");
      setDriverLicenseChecked(existing.driver_license_checked);
      setLicenseNumber(existing.license_number ?? "");
      setWaiverSigned(existing.waiver_signed);
      setIncidentNotes(existing.incident_notes ?? "");
      setNotes(existing.notes ?? "");
      setCarStatusBefore(existing.car_status_before_test_drive);
      return;
    }
    if (car) {
      setVin(car.vin);
      setCarId(car.id);
      setTestDriveStartAt(toLocalDatetimeValue(new Date()));
      setExpectedReturnAt("");
      setActualReturnAt("");
      setOutcome("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerId(null);
      setRoute("");
      setPurpose("");
      setCompanionEmployee("");
      setOdometerOut(car.current_km != null ? String(car.current_km) : "");
      setOdometerIn("");
      setBatteryOut(car.battery_percent != null ? String(car.battery_percent) : "");
      setBatteryIn("");
      setFuelOut("");
      setFuelIn("");
      setDriverLicenseChecked(false);
      setLicenseNumber("");
      setWaiverSigned(false);
      setIncidentNotes("");
      setNotes("");
      setCarStatusBefore(car.status);
    }
  }, [open, existing, car]);

  const title = useMemo(() => {
    if (existing?.id) {
      if (isOut) return "Test drive — vehicle out";
      if (existing.status === "returned") return "Test drive — returned (read-only)";
      return "Test drive";
    }
    return "Start test drive";
  }, [existing, isOut]);

  async function handleCheckoutSave() {
    if (!carId || !vin || !profile?.id) {
      toast.error("Missing vehicle or profile.");
      return;
    }
    setSaving(true);
    const now = isoNow();
    const row = {
      car_id: carId,
      vin: vin.trim().toUpperCase(),
      employee_user_id: profile.id,
      employee_name: profile.full_name ?? null,
      customer_id: customerId,
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      status: "out_for_test_drive" as const,
      test_drive_start_at: new Date(testDriveStartAt).toISOString(),
      expected_return_at: expectedReturnAt.trim() ? new Date(expectedReturnAt).toISOString() : null,
      actual_return_at: null,
      route: route.trim() || null,
      purpose: purpose.trim() || null,
      companion_employee: companionEmployee.trim() || null,
      odometer_out: numOrNull(odometerOut),
      odometer_in: null,
      battery_out: numOrNull(batteryOut),
      battery_in: null,
      fuel_out: numOrNullDecimal(fuelOut),
      fuel_in: null,
      driver_license_checked: driverLicenseChecked,
      license_number: licenseNumber.trim() || null,
      waiver_signed: waiverSigned,
      incident_notes: null,
      notes: notes.trim() || null,
      car_status_before_test_drive: carStatusBefore ?? car?.status ?? null,
      updated_at: now,
    };

    const { error: insErr } = await supabase.from("test_drives").insert(row);
    if (insErr) {
      if (
        insErr.code === "23505" ||
        insErr.message.includes("idx_test_drives_one_active_out_per_car") ||
        insErr.message.toLowerCase().includes("duplicate key")
      ) {
        toast.error("This vehicle already has an active test drive.");
      } else {
        toast.error(formatError(insErr));
      }
      setSaving(false);
      return;
    }

    const { error: carErr } = await supabase
      .from("cars")
      .update({ status: "test_drive", updated_at: now })
      .eq("id", carId);

    if (carErr) {
      toast.error(`Test drive saved but failed to update car status: ${formatError(carErr)}`);
    } else {
      toast.success("Test drive started — vehicle marked out.");
    }
    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  async function handleUpdateDetails() {
    if (!existing?.id) return;
    setSaving(true);
    const now = isoNow();
    const { error } = await supabase
      .from("test_drives")
      .update({
        customer_id: customerId,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        expected_return_at: expectedReturnAt.trim() ? new Date(expectedReturnAt).toISOString() : null,
        route: route.trim() || null,
        purpose: purpose.trim() || null,
        companion_employee: companionEmployee.trim() || null,
        odometer_out: numOrNull(odometerOut),
        battery_out: numOrNull(batteryOut),
        fuel_out: numOrNullDecimal(fuelOut),
        driver_license_checked: driverLicenseChecked,
        license_number: licenseNumber.trim() || null,
        waiver_signed: waiverSigned,
        notes: notes.trim() || null,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (error) toast.error(formatError(error));
    else toast.success("Test drive updated.");
    setSaving(false);
    if (!error) {
      onOpenChange(false);
      onSaved();
    }
  }

  async function handleCompleteReturn() {
    if (!existing?.id || !carId) return;
    setSaving(true);
    const now = isoNow();
    const returnAt = actualReturnAt.trim()
      ? new Date(actualReturnAt).toISOString()
      : now;

    const { error: uErr } = await supabase
      .from("test_drives")
      .update({
        status: "returned",
        actual_return_at: returnAt,
        odometer_in: numOrNull(odometerIn),
        battery_in: numOrNull(batteryIn),
        fuel_in: numOrNullDecimal(fuelIn),
        incident_notes: incidentNotes.trim() || null,
        notes: notes.trim() || null,
        outcome: outcome || null,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (uErr) {
      toast.error(formatError(uErr));
      setSaving(false);
      return;
    }

    const restore: CarStatus =
      (carStatusBefore as CarStatus) || (existing.car_status_before_test_drive as CarStatus) || "available";
    const { error: cErr } = await supabase
      .from("cars")
      .update({ status: restore, updated_at: now })
      .eq("id", carId);

    if (cErr) toast.error(`Return saved but car status not restored: ${formatError(cErr)}`);
    else toast.success("Vehicle marked returned.");
    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  async function handleCancelOut() {
    if (!existing?.id || !carId) return;
    if (!confirm("Cancel this test drive and restore the vehicle status?")) return;
    setSaving(true);
    const now = isoNow();
    const { error: uErr } = await supabase
      .from("test_drives")
      .update({ status: "cancelled", updated_at: now })
      .eq("id", existing.id);
    if (uErr) {
      toast.error(formatError(uErr));
      setSaving(false);
      return;
    }
    const restore: CarStatus =
      (carStatusBefore as CarStatus) || (existing.car_status_before_test_drive as CarStatus) || "available";
    const { error: cErr } = await supabase
      .from("cars")
      .update({ status: restore, updated_at: now })
      .eq("id", carId);
    if (cErr) toast.error(`Cancelled but car status not restored: ${formatError(cErr)}`);
    else toast.success("Test drive cancelled.");
    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  const readOnlyReturned = existing?.status === "returned" || existing?.status === "cancelled";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg md:max-w-xl">
        <SheetHeader className="border-border shrink-0 border-b px-6 py-4 text-left">
          <div className="flex items-center gap-2">
            <SheetTitle>{title}</SheetTitle>
            {existing && (
              <Badge variant={isOut ? "default" : "secondary"}>
                {TEST_DRIVE_STATUS_LABELS[existing.status]}
              </Badge>
            )}
          </div>
          <SheetDescription>
            Staff: <strong>{profile.full_name}</strong> · Logged-in profile id is stored on the record.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {car && (
            <div className="bg-muted/40 mb-4 rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {car.brand} {car.model}
              </p>
              <p className="text-muted-foreground font-mono text-xs">{car.vin}</p>
            </div>
          )}

          {!isExisting && (
            <p className="text-muted-foreground mb-4 text-sm">
              Fill customer and trip details, then start the test drive. The vehicle status becomes{" "}
              <strong>Test drive</strong> until return.
            </p>
          )}

          {isOut && (
            <p className="text-amber-700 dark:text-amber-400 mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
              This vehicle is currently out. Update details below or complete return to restore inventory
              status.
            </p>
          )}

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="td-start">Test drive start</Label>
              <Input
                id="td-start"
                type="datetime-local"
                value={testDriveStartAt}
                onChange={(e) => setTestDriveStartAt(e.target.value)}
                disabled={isExisting || readOnlyReturned}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="td-expected">Expected return</Label>
              <Input
                id="td-expected"
                type="datetime-local"
                value={expectedReturnAt}
                onChange={(e) => setExpectedReturnAt(e.target.value)}
                disabled={readOnlyReturned}
              />
            </div>

            <hr className="border-border" />

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Customer name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={readOnlyReturned} />
              </div>
              <div className="grid gap-2">
                <Label>Customer phone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} disabled={readOnlyReturned} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="td-cust-id">Customer ID (optional UUID)</Label>
              <Input
                id="td-cust-id"
                value={customerId ?? ""}
                onChange={(e) => setCustomerId(e.target.value.trim() || null)}
                placeholder="Link existing customer"
                disabled={readOnlyReturned}
                className="font-mono text-xs"
              />
            </div>

            <hr className="border-border" />

            <div className="grid gap-2">
              <Label>Route / destination</Label>
              <Textarea value={route} onChange={(e) => setRoute(e.target.value)} rows={2} disabled={readOnlyReturned} />
            </div>
            <div className="grid gap-2">
              <Label>Purpose</Label>
              <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} disabled={readOnlyReturned} />
            </div>
            <div className="grid gap-2">
              <Label>Companion employee</Label>
              <Input value={companionEmployee} onChange={(e) => setCompanionEmployee(e.target.value)} disabled={readOnlyReturned} />
            </div>

            <hr className="border-border" />
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Checkout readings</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Odometer out</Label>
                <Input inputMode="numeric" value={odometerOut} onChange={(e) => setOdometerOut(e.target.value)} disabled={readOnlyReturned} />
              </div>
              <div className="grid gap-2">
                <Label>Battery % out</Label>
                <Input inputMode="numeric" value={batteryOut} onChange={(e) => setBatteryOut(e.target.value)} disabled={readOnlyReturned} />
              </div>
              <div className="grid gap-2">
                <Label>Fuel out (optional)</Label>
                <Input inputMode="decimal" value={fuelOut} onChange={(e) => setFuelOut(e.target.value)} disabled={readOnlyReturned} />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dl"
                  checked={driverLicenseChecked}
                  onCheckedChange={(v) => setDriverLicenseChecked(v === true)}
                  disabled={readOnlyReturned}
                />
                <Label htmlFor="dl" className="text-sm font-normal">
                  Driver license checked
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="waiver"
                  checked={waiverSigned}
                  onCheckedChange={(v) => setWaiverSigned(v === true)}
                  disabled={readOnlyReturned}
                />
                <Label htmlFor="waiver" className="text-sm font-normal">
                  Waiver signed
                </Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>License # or note</Label>
              <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} disabled={readOnlyReturned} />
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={readOnlyReturned} />
            </div>

            {(isOut || existing?.status === "returned") && (
              <>
                <hr className="border-border" />
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Return</p>
                <div className="grid gap-2">
                  <Label htmlFor="td-actual">Actual return</Label>
                  <Input
                    id="td-actual"
                    type="datetime-local"
                    value={actualReturnAt}
                    onChange={(e) => setActualReturnAt(e.target.value)}
                    disabled={!isOut || readOnlyReturned}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Odometer in</Label>
                    <Input inputMode="numeric" value={odometerIn} onChange={(e) => setOdometerIn(e.target.value)} disabled={!isOut} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Battery % in</Label>
                    <Input inputMode="numeric" value={batteryIn} onChange={(e) => setBatteryIn(e.target.value)} disabled={!isOut} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Fuel in (optional)</Label>
                    <Input inputMode="decimal" value={fuelIn} onChange={(e) => setFuelIn(e.target.value)} disabled={!isOut} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Incident notes</Label>
                  <Textarea value={incidentNotes} onChange={(e) => setIncidentNotes(e.target.value)} rows={2} disabled={!isOut} />
                </div>
                {/* Outcome captures the whole point of the test drive: did
                    the customer like the car? Lead status auto-progresses
                    via DB trigger when this is set. */}
                <div className="grid gap-2">
                  <Label htmlFor="td-outcome">How did it go?</Label>
                  <select
                    id="td-outcome"
                    className="border-input bg-background h-10 rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    disabled={!isOut && !readOnlyReturned}
                  >
                    <option value="">Not yet captured</option>
                    <option value="interested">Customer is interested</option>
                    <option value="purchased">Customer wants to buy</option>
                    <option value="not_interested">Not interested</option>
                    <option value="no_decision">Undecided</option>
                  </select>
                  <p className="text-muted-foreground text-xs">
                    This automatically updates the customer&apos;s lead status
                    (interested → Interested, wants to buy → Negotiation, not
                    interested → Lost).
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <SheetFooter className="border-border mt-auto shrink-0 flex-col gap-2 border-t p-4 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {isOut && (
              <Button type="button" variant="destructive" size="sm" onClick={handleCancelOut} disabled={saving}>
                Cancel test drive
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Close
            </Button>
            {!isExisting && !readOnlyReturned && (
              <Button type="button" onClick={handleCheckoutSave} disabled={saving || !car}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Start test drive"}
              </Button>
            )}
            {isOut && (
              <>
                <Button type="button" variant="secondary" onClick={handleUpdateDetails} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : "Save details"}
                </Button>
                <Button type="button" onClick={handleCompleteReturn} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : "Complete return"}
                </Button>
              </>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
