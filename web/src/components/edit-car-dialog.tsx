"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { CarDisplay, PdiStatus, CustomsStatus } from "@/types/database";
import { PDI_LABELS, CUSTOMS_STATUS_LABELS } from "@/types/database";
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
  const [plateNumber, setPlateNumber] = useState("");
  const [exteriorColor, setExteriorColor] = useState("");
  const [interiorColor, setInteriorColor] = useState("");
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
  const [warrantyMonzaStartDate, setWarrantyMonzaStartDate] = useState("");
  const [customsStatus, setCustomsStatus] = useState<CustomsStatus>("pending");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (car && open) {
      setPlateNumber(car.plate_number ?? "");
      setExteriorColor(car.exterior_color ?? "");
      setInteriorColor(car.interior_color ?? "");
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
      setWarrantyMonzaStartDate(car.warranty_monza_start_date ?? "");
      setCustomsStatus(car.customs_status ?? "pending");
    }
  }, [car, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!car) return;

    setSubmitting(true);

    const updates: Record<string, unknown> = {
      plate_number: plateNumber.trim() || null,
      exterior_color: exteriorColor.trim() || null,
      interior_color: interiorColor.trim() || null,
      notes: notes.trim() || null,
      software_version: softwareVersion.trim() || null,
      pdi_status: pdiStatus,
      customs_status: customsStatus,
      warranty_per_dms: warrantyPerDms || null,
      warranty_monza_start_date: warrantyMonzaStartDate || null,
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
      note: "Details updated",
      created_by: user?.id ?? null,
    });

    setSubmitting(false);
    toast.success("Car updated successfully");
    onSuccess();
    onOpenChange(false);
  }

  if (!car) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit car</DialogTitle>
          <DialogDescription>
            Update vehicle details. Changes will be logged.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plate">Plate number</Label>
              <Input
                id="plate"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdi">PDI status</Label>
              <Select value={pdiStatus} onValueChange={(v) => setPdiStatus(v as PdiStatus)}>
                <SelectTrigger>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exterior">Exterior color</Label>
              <Input
                id="exterior"
                value={exteriorColor}
                onChange={(e) => setExteriorColor(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interior">Interior color</Label>
              <Input
                id="interior"
                value={interiorColor}
                onChange={(e) => setInteriorColor(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="battery">Battery %</Label>
              <Input
                id="battery"
                type="number"
                min={0}
                max={100}
                value={batteryPercent}
                onChange={(e) => setBatteryPercent(e.target.value)}
                placeholder="0–100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evRange">EV range (km)</Label>
              <Input
                id="evRange"
                type="number"
                min={0}
                value={evRangeKm}
                onChange={(e) => setEvRangeKm(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currentKm">Current KM</Label>
              <Input
                id="currentKm"
                type="number"
                min={0}
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="software">Software version</Label>
              <Input
                id="software"
                value={softwareVersion}
                onChange={(e) => setSoftwareVersion(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isErev"
              checked={isErev}
              onCheckedChange={(c) => setIsErev(c === true)}
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evKm">EV KM</Label>
                <Input
                  id="evKm"
                  type="number"
                  min={0}
                  value={evKm}
                  onChange={(e) => setEvKm(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="motorKm">Motor KM</Label>
                <Input
                  id="motorKm"
                  type="number"
                  min={0}
                  value={motorKm}
                  onChange={(e) => setMotorKm(e.target.value)}
                  placeholder="Optional"
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
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={priceCurrency} onValueChange={setPriceCurrency}>
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
              <Select value={customsStatus} onValueChange={(v) => setCustomsStatus(v as CustomsStatus)}>
                <SelectTrigger>
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
              <Label htmlFor="editWarrantyDms">Warranty as per DMS</Label>
              <Input
                id="editWarrantyDms"
                type="date"
                value={warrantyPerDms}
                onChange={(e) => setWarrantyPerDms(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editWarrantyMonza">Warranty as per Monza (Start)</Label>
              <Input
                id="editWarrantyMonza"
                type="date"
                value={warrantyMonzaStartDate}
                onChange={(e) => setWarrantyMonzaStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={3}
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
