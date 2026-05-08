"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay, PdiStatus, CustomsStatus, CarStatus, LocationType } from "@/types/database";
import {
  CAR_STATUS_EDITABLE,
  CAR_STATUS_LABELS,
  PDI_LABELS,
  CUSTOMS_STATUS_LABELS,
  LOCATION_LABELS,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditCarDialogProps {
  car: CarDisplay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditCarDialog({
  car,
  open,
  onOpenChange,
  onSuccess,
}: EditCarDialogProps) {
  const [status, setStatus] = useState<CarStatus>("inventory");
  const [plateNumber, setPlateNumber] = useState("");
  const [exteriorColor, setExteriorColor] = useState("");
  const [interiorColor, setInteriorColor] = useState("");
  const [dateArrived, setDateArrived] = useState("");
  const [suffix, setSuffix] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [dongle, setDongle] = useState("");
  const [issue, setIssue] = useState("");
  const [batteryPercent, setBatteryPercent] = useState("");
  const [evRangeKm, setEvRangeKm] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [softwareVersion, setSoftwareVersion] = useState("");
  const [pdiStatus, setPdiStatus] = useState<PdiStatus>("pending");
  const [notes, setNotes] = useState("");
  const [isErev, setIsErev] = useState(false);
  const [motor, setMotor] = useState("");
  const [evKm, setEvKm] = useState("");
  const [motorKm, setMotorKm] = useState("");
  const [price, setPrice] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [warrantyPerDms, setWarrantyPerDms] = useState("");
  const [warrantyBatteryDms, setWarrantyBatteryDms] = useState("");
  const [warrantyVehicleExpiry, setWarrantyVehicleExpiry] = useState("");
  const [warrantyBatteryExpiry, setWarrantyBatteryExpiry] = useState("");
  const [warrantyMonzaStartDate, setWarrantyMonzaStartDate] = useState("");
  const [warrantyVehicleKmLimit, setWarrantyVehicleKmLimit] = useState("");
  const [warrantyBatteryKmLimit, setWarrantyBatteryKmLimit] = useState("");
  const [customsStatus, setCustomsStatus] = useState<CustomsStatus>("pending");
  const [trim, setTrim] = useState("");
  const [specs, setSpecs] = useState("");
  const [blIssueDate, setBlIssueDate] = useState("");
  const [registrationDate, setRegistrationDate] = useState("");
  const [customsNotes, setCustomsNotes] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("storage");
  const [locationSlot, setLocationSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();
  const {
    canEditInventory: fullInventory,
    canEditMonzaWarrantyOnCar: monzaWarranty,
    canEditDmsWarrantyOnCar: dmsWarranty,
    canEditPdiStatusOnCar: pdiEditable,
    appRole,
  } = useUser();

  useEffect(() => {
    if (car && open) {
      setStatus(car.status);
      setPlateNumber(car.plate_number ?? "");
      setExteriorColor(car.exterior_color ?? "");
      setInteriorColor(car.interior_color ?? "");
      setDateArrived(car.date_arrived ?? "");
      setSuffix((car as { suffix?: string }).suffix ?? "");
      setEngineNumber((car as { engine_number?: string }).engine_number ?? "");
      setDongle((car as { dongle?: string }).dongle ?? "");
      setIssue((car as { issue?: string }).issue ?? "");
      setBatteryPercent(
        car.battery_percent != null ? String(car.battery_percent) : ""
      );
      setEvRangeKm(
        car.ev_range_km != null ? String(car.ev_range_km) : ""
      );
      setCurrentKm(car.current_km != null ? String(car.current_km) : "");
      setSoftwareVersion(car.software_version ?? "");
      setPdiStatus(car.pdi_status);
      setNotes(car.notes ?? "");
      const carAny = car as { is_erev?: boolean; ev_km?: number; motor_km?: number; motor?: string };
      setIsErev(carAny.is_erev ?? false);
      setMotor(carAny.motor ?? "");
      setEvKm(carAny.ev_km != null ? String(carAny.ev_km) : "");
      setMotorKm(carAny.motor_km != null ? String(carAny.motor_km) : "");
      setPrice(car.price != null ? String(car.price) : "");
      setPriceCurrency(car.price_currency ?? "USD");
      setWarrantyPerDms(car.warranty_per_dms ?? "");
      setWarrantyBatteryDms(
        (car as { warranty_battery_dms?: string | null }).warranty_battery_dms ?? ""
      );
      const vehicleExpiry =
        car.warranty_vehicle_expiry ??
        car.warranty_expiry ??
        car.warranty_monza_start_date ??
        "";
      setWarrantyVehicleExpiry(vehicleExpiry ?? "");
      setWarrantyBatteryExpiry(car.warranty_battery_expiry ?? "");
      setWarrantyMonzaStartDate(car.warranty_monza_start_date ?? "");
      setWarrantyVehicleKmLimit(
        car.warranty_vehicle_km_limit != null
          ? String(car.warranty_vehicle_km_limit)
          : ""
      );
      setWarrantyBatteryKmLimit(
        car.warranty_battery_km_limit != null
          ? String(car.warranty_battery_km_limit)
          : ""
      );
      setCustomsStatus(car.customs_status ?? "pending");
      const cExtra = car as CarDisplay & {
        trim?: string | null;
        specs?: string | null;
        bl_issue_date?: string | null;
        registration_date?: string | null;
        customs_notes?: string | null;
      };
      setTrim(cExtra.trim ?? "");
      setSpecs(cExtra.specs ?? "");
      setBlIssueDate(cExtra.bl_issue_date ?? "");
      setRegistrationDate(cExtra.registration_date ?? "");
      setCustomsNotes(cExtra.customs_notes ?? "");
      setLocationType(car.location_type ?? "storage");
      setLocationSlot(car.location_slot ?? "");
    }
  }, [car, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!car) return;

    const canSaveAnything =
      fullInventory || monzaWarranty || dmsWarranty || pdiEditable;
    if (!canSaveAnything) {
      toast.error("You don't have permission to edit this vehicle.");
      return;
    }

    setSubmitting(true);

    const cAny = car as CarDisplay & {
      warranty_vehicle_expiry?: string | null;
      warranty_expiry?: string | null;
      warranty_battery_expiry?: string | null;
      warranty_vehicle_km_limit?: number | null;
      warranty_battery_km_limit?: number | null;
      warranty_battery_dms?: string | null;
    };

    const monzaSnapshot = {
      warranty_monza_start_date: car.warranty_monza_start_date ?? null,
      warranty_vehicle_expiry: cAny.warranty_vehicle_expiry ?? null,
      warranty_battery_expiry: cAny.warranty_battery_expiry ?? null,
      warranty_expiry: cAny.warranty_expiry ?? null,
      warranty_vehicle_km_limit: cAny.warranty_vehicle_km_limit ?? null,
      warranty_battery_km_limit: cAny.warranty_battery_km_limit ?? null,
    };

    const dmsSnapshot = {
      warranty_per_dms: car.warranty_per_dms ?? null,
      warranty_battery_dms: cAny.warranty_battery_dms ?? null,
    };

    let updates: Record<string, unknown>;

    if (fullInventory) {
      updates = {
        status,
        plate_number: plateNumber.trim() || null,
        exterior_color: exteriorColor.trim() || null,
        interior_color: interiorColor.trim() || null,
        date_arrived: dateArrived || null,
        suffix: suffix.trim() || null,
        engine_number: engineNumber.trim() || null,
        dongle: dongle.trim() || null,
        issue: issue.trim() || null,
        notes: notes.trim() || null,
        software_version: softwareVersion.trim() || null,
        pdi_status: pdiEditable ? pdiStatus : car.pdi_status,
        customs_status: customsStatus,
        trim: trim.trim() || null,
        specs: specs.trim() || null,
        bl_issue_date: blIssueDate || null,
        registration_date: registrationDate || null,
        customs_notes: customsNotes.trim() || null,
        warranty_per_dms: dmsWarranty ? warrantyPerDms || null : dmsSnapshot.warranty_per_dms,
        warranty_battery_dms: dmsWarranty
          ? warrantyBatteryDms || null
          : dmsSnapshot.warranty_battery_dms,
        warranty_vehicle_expiry: monzaWarranty
          ? warrantyVehicleExpiry || null
          : monzaSnapshot.warranty_vehicle_expiry,
        warranty_battery_expiry: monzaWarranty
          ? warrantyBatteryExpiry || null
          : monzaSnapshot.warranty_battery_expiry,
        warranty_expiry: monzaWarranty
          ? warrantyVehicleExpiry || null
          : monzaSnapshot.warranty_expiry,
        warranty_monza_start_date: monzaWarranty
          ? warrantyMonzaStartDate || null
          : monzaSnapshot.warranty_monza_start_date,
        warranty_vehicle_km_limit: monzaWarranty
          ? warrantyVehicleKmLimit.trim() && !Number.isNaN(Number(warrantyVehicleKmLimit))
            ? Number(warrantyVehicleKmLimit)
            : null
          : monzaSnapshot.warranty_vehicle_km_limit,
        warranty_battery_km_limit: monzaWarranty
          ? warrantyBatteryKmLimit.trim() && !Number.isNaN(Number(warrantyBatteryKmLimit))
            ? Number(warrantyBatteryKmLimit)
            : null
          : monzaSnapshot.warranty_battery_km_limit,
        location_type: locationType,
        location_slot: locationSlot.trim() || null,
      };

      const priceNum = price ? parseFloat(price) : null;
      if (priceNum !== null && !Number.isNaN(priceNum) && priceNum >= 0) {
        updates.price = priceNum;
        updates.price_currency = priceCurrency;
      } else {
        updates.price = null;
      }

      const batteryNum = batteryPercent ? parseInt(batteryPercent, 10) : null;
      if (batteryNum !== null && !Number.isNaN(batteryNum) && batteryNum >= 0 && batteryNum <= 100) {
        updates.battery_percent = batteryNum;
      }
      const evRangeNum = evRangeKm ? parseInt(evRangeKm, 10) : null;
      if (evRangeNum !== null && !Number.isNaN(evRangeNum)) {
        updates.ev_range_km = evRangeNum;
      }
      const currentKmNum = currentKm ? parseInt(currentKm, 10) : null;
      if (currentKmNum !== null && !Number.isNaN(currentKmNum)) {
        updates.current_km = currentKmNum;
      }

      if (isErev) {
        updates.is_erev = true;
        updates.motor = motor.trim() || null;
        const evKmNum = evKm ? parseInt(evKm, 10) : null;
        const motorKmNum = motorKm ? parseInt(motorKm, 10) : null;
        if (evKmNum !== null && !Number.isNaN(evKmNum)) updates.ev_km = evKmNum;
        if (motorKmNum !== null && !Number.isNaN(motorKmNum)) updates.motor_km = motorKmNum;
      } else {
        updates.is_erev = false;
        updates.motor = null;
        updates.ev_km = null;
        updates.motor_km = null;
      }
    } else {
      updates = {};
      if (monzaWarranty) {
        updates.warranty_monza_start_date = warrantyMonzaStartDate || null;
        updates.warranty_vehicle_expiry = warrantyVehicleExpiry || null;
        updates.warranty_battery_expiry = warrantyBatteryExpiry || null;
        updates.warranty_expiry = warrantyVehicleExpiry || null;
        updates.warranty_vehicle_km_limit =
          warrantyVehicleKmLimit.trim() && !Number.isNaN(Number(warrantyVehicleKmLimit))
            ? Number(warrantyVehicleKmLimit)
            : null;
        updates.warranty_battery_km_limit =
          warrantyBatteryKmLimit.trim() && !Number.isNaN(Number(warrantyBatteryKmLimit))
            ? Number(warrantyBatteryKmLimit)
            : null;
      }
      if (dmsWarranty) {
        updates.warranty_per_dms = warrantyPerDms || null;
        updates.warranty_battery_dms = warrantyBatteryDms || null;
      }
      if (pdiEditable) {
        updates.pdi_status = pdiStatus;
      }
      if (Object.keys(updates).length === 0) {
        setSubmitting(false);
        toast.error("No permitted fields to save.");
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("cars")
      .update(updates)
      .eq("id", car.id);

    if (updateError) {
      setSubmitting(false);
      const isRls =
        updateError.code === "42501" ||
        updateError.message.toLowerCase().includes("permission");
      toast.error(
        isRls ? "You don't have permission to do this." : updateError.message
      );
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("car_events").insert({
      car_id: car.id,
      event_type: "details_updated",
      note: fullInventory ? "Details updated" : "Warranty / PDI fields updated",
      created_by: user?.id ?? null,
    });

    if (
      fullInventory &&
      locationType === "garage" &&
      car.location_type !== "garage" &&
      (appRole === "owner" || appRole === "garage_manager")
    ) {
      void fetch("/api/garage/bootstrap-car", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ car_id: car.id }),
      }).catch(() => {});
    }

    setSubmitting(false);
    toast.success("Car updated successfully");
    onSuccess();
    onOpenChange(false);
  }

  if (!car) return null;

  const coreLocked = !fullInventory;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit car</DialogTitle>
          <DialogDescription>
            {fullInventory
              ? "Update vehicle details. Changes will be logged."
              : "You can edit only the fields your role allows (warranty / PDI)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CarStatus)}
                disabled={submitting || coreLocked}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAR_STATUS_EDITABLE.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CAR_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate">Plate number</Label>
              <Input
                id="plate"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateArrived">Date Arrived</Label>
              <Input
                id="dateArrived"
                type="date"
                value={dateArrived}
                onChange={(e) => setDateArrived(e.target.value)}
                disabled={submitting || coreLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suffix">Suffix</Label>
              <Input
                id="suffix"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="engineNumber">Engine number</Label>
              <Input
                id="engineNumber"
                value={engineNumber}
                onChange={(e) => setEngineNumber(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dongle">Dongle</Label>
              <Input
                id="dongle"
                value={dongle}
                onChange={(e) => setDongle(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="locationType">Location type</Label>
              <Select
                value={locationType}
                onValueChange={(v) => setLocationType(v as LocationType)}
                disabled={submitting || coreLocked}
              >
                <SelectTrigger id="locationType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LOCATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationSlot">Location slot</Label>
              <Input
                id="locationSlot"
                value={locationSlot}
                onChange={(e) => setLocationSlot(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pdi">PDI status</Label>
              <Select
                value={pdiStatus}
                onValueChange={(v) => setPdiStatus(v as PdiStatus)}
                disabled={submitting || !pdiEditable}
              >
                <SelectTrigger id="pdi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PDI_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exterior">Exterior color</Label>
              <Input
                id="exterior"
                value={exteriorColor}
                onChange={(e) => setExteriorColor(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="interior">Interior color</Label>
              <Input
                id="interior"
                value={interiorColor}
                onChange={(e) => setInteriorColor(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="software">Software version</Label>
              <Input
                id="software"
                value={softwareVersion}
                onChange={(e) => setSoftwareVersion(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="battery">Battery %</Label>
              <Input
                id="battery"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={batteryPercent}
                onChange={(e) => setBatteryPercent(e.target.value)}
                placeholder="0–100"
                disabled={submitting || coreLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evRange">EV range (km)</Label>
              <Input
                id="evRange"
                type="number"
                inputMode="numeric"
                min={0}
                value={evRangeKm}
                onChange={(e) => setEvRangeKm(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currentKm">Current KM</Label>
              <Input
                id="currentKm"
                type="number"
                inputMode="numeric"
                min={0}
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isErev"
              checked={isErev}
              onCheckedChange={(c) => setIsErev(c === true)}
              disabled={submitting || coreLocked}
            />
            <Label htmlFor="isErev" className="cursor-pointer text-sm font-normal">
              Is EREV
            </Label>
          </div>

          {isErev && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="motor">Motor</Label>
                <Input
                  id="motor"
                  value={motor}
                  onChange={(e) => setMotor(e.target.value)}
                  placeholder="e.g. 1.5T"
                  disabled={submitting || coreLocked}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evKm">EV KM</Label>
                <Input
                  id="evKm"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={evKm}
                  onChange={(e) => setEvKm(e.target.value)}
                  placeholder="Optional"
                  disabled={submitting || coreLocked}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="motorKm">Motor KM</Label>
                <Input
                  id="motorKm"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={motorKm}
                  onChange={(e) => setMotorKm(e.target.value)}
                  placeholder="Optional"
                  disabled={submitting || coreLocked}
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="editPrice">Price</Label>
              <Input
                id="editPrice"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={priceCurrency}
                onValueChange={setPriceCurrency}
                disabled={submitting || coreLocked}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                  <SelectItem value="LBP">LBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Customs</Label>
              <Select
                value={customsStatus}
                onValueChange={(v) => setCustomsStatus(v as CustomsStatus)}
                disabled={submitting || coreLocked}
              >
                <SelectTrigger id="editCustomsStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CUSTOMS_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="carTrim">Trim / variant</Label>
              <Input
                id="carTrim"
                value={trim}
                onChange={(e) => setTrim(e.target.value)}
                placeholder="Optional"
                disabled={submitting || coreLocked}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="carSpecs">Specs</Label>
              <Textarea
                id="carSpecs"
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                placeholder="Optional technical specs"
                rows={2}
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="blIssue">B/L issue date</Label>
              <Input
                id="blIssue"
                type="date"
                value={blIssueDate}
                onChange={(e) => setBlIssueDate(e.target.value)}
                disabled={submitting || coreLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regDate">Registration date</Label>
              <Input
                id="regDate"
                type="date"
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
                disabled={submitting || coreLocked}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customsNotes">Customs notes</Label>
            <Textarea
              id="customsNotes"
              value={customsNotes}
              onChange={(e) => setCustomsNotes(e.target.value)}
              placeholder="Customs-related notes (separate from general notes)"
              rows={2}
              disabled={submitting || coreLocked}
            />
          </div>

          <div className="grid gap-4 rounded-md border border-amber-500/25 bg-muted/15 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="space-y-2 lg:col-span-2 xl:col-span-2">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                DMS (Khalil / owners)
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="editWarrantyDms">Warranty vehicle DMS</Label>
                  <Input
                    id="editWarrantyDms"
                    type="date"
                    value={warrantyPerDms}
                    onChange={(e) => setWarrantyPerDms(e.target.value)}
                    disabled={submitting || !dmsWarranty}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editWarrantyBatteryDms">Warranty battery DMS</Label>
                  <Input
                    id="editWarrantyBatteryDms"
                    type="date"
                    value={warrantyBatteryDms}
                    onChange={(e) => setWarrantyBatteryDms(e.target.value)}
                    disabled={submitting || !dmsWarranty}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 lg:col-span-2 xl:col-span-3">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Monza (Lara / Samaya / owners)
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="editWarrantyVehicle">Warranty on Vehicle (Expiry)</Label>
                  <Input
                    id="editWarrantyVehicle"
                    type="date"
                    value={warrantyVehicleExpiry}
                    onChange={(e) => setWarrantyVehicleExpiry(e.target.value)}
                    disabled={submitting || !monzaWarranty}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editWarrantyBattery">Warranty on Battery (Expiry)</Label>
                  <Input
                    id="editWarrantyBattery"
                    type="date"
                    value={warrantyBatteryExpiry}
                    onChange={(e) => setWarrantyBatteryExpiry(e.target.value)}
                    disabled={submitting || !monzaWarranty}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editWarrantyMonza">Warranty Monza Start Date</Label>
                  <Input
                    id="editWarrantyMonza"
                    type="date"
                    value={warrantyMonzaStartDate}
                    onChange={(e) => setWarrantyMonzaStartDate(e.target.value)}
                    disabled={submitting || !monzaWarranty}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue">Issue / Notes</Label>
            <Textarea
              id="issue"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Optional"
              rows={3}
              disabled={submitting || coreLocked}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={3}
              disabled={submitting || coreLocked}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
