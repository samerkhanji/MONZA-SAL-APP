"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Car, Users, Zap, ScanLine } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import type { CarStatus, LocationType, CustomsStatus } from "@/types/database";

type CarUpdate = Database["public"]["Tables"]["cars"]["Update"];
type SalesOrderInsert = Database["public"]["Tables"]["sales_orders"]["Insert"];
import {
  CAR_STATUS_LABELS,
  CAR_STATUS_EDITABLE,
  LOCATION_LABELS,
  CUSTOMS_STATUS_LABELS,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field-hint";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const BRANDS = ["Voyah", "MHero"] as const;
type Brand = (typeof BRANDS)[number];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
] as const;

const INITIAL_STATUS: CarStatus = "inventory";
const INITIAL_LOCATION: LocationType = "storage";
// PDI status is always "pending" on creation; checklist available on detail page

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

function validateVin(vin: string): boolean {
  const normalized = vin.trim().toUpperCase();
  return normalized.length === 17 && VIN_REGEX.test(normalized);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentYear(): number {
  return new Date().getFullYear();
}

export default function AddCarPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Warn before losing a part-filled form on refresh/close/external nav. (App
  // back-button is SPA history; this covers the hard-navigation cases.)
  useEffect(() => {
    if (!dirty || submitting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, submitting]);
  const [scanVinOpen, setScanVinOpen] = useState(false);

  // Section 1: Vehicle Information
  const [vin, setVin] = useState("");

  // Pre-fill the VIN when arriving from a scan (e.g. the global scan button
  // routes here as `/cars/add?vin=...` when a scanned VIN isn't in the system).
  useEffect(() => {
    const scanned = new URLSearchParams(window.location.search).get("vin");
    if (scanned && VIN_REGEX.test(scanned.trim())) {
      setVin(scanned.trim().toUpperCase());
    }
  }, []);

  const [brand, setBrand] = useState<Brand | "">("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState(String(currentYear()));
  const [exteriorColor, setExteriorColor] = useState("");
  const [interiorColor, setInteriorColor] = useState("");
  const [locationType, setLocationType] = useState<LocationType>(INITIAL_LOCATION);
  const [status, setStatus] = useState<CarStatus>(INITIAL_STATUS);
  const [plateNumber, setPlateNumber] = useState("");
  const [dateArrived, setDateArrived] = useState(todayISO());
  const [warrantyPerDms, setWarrantyPerDms] = useState("");
  const [warrantyVehicleExpiry, setWarrantyVehicleExpiry] = useState("");
  const [warrantyBatteryExpiry, setWarrantyBatteryExpiry] = useState("");
  const [warrantyMonzaStartDate, setWarrantyMonzaStartDate] = useState("");
  const [customsStatus, setCustomsStatus] = useState<CustomsStatus>("pending");
  const [notes, setNotes] = useState("");
  const [issue, setIssue] = useState("");
  const [suffix, setSuffix] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [softwareUpdate, setSoftwareUpdate] = useState("");
  const [dongle, setDongle] = useState("");
  const [soldMarker, setSoldMarker] = useState(false);
  const [reservedBy, setReservedBy] = useState("");
  const [reservationDate, setReservationDate] = useState("");

  // Section 2: Technical Details
  const [batteryPercent, setBatteryPercent] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [softwareVersion, setSoftwareVersion] = useState("");
  // PDI starts as pending; no user selection needed
  const [isErev, setIsErev] = useState(false);
  const [motor, setMotor] = useState("");
  const [evKm, setEvKm] = useState("");
  const [motorKm, setMotorKm] = useState("");

  // Section 3: Customer & Sale (only when sold/reserved)
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientPhone2, setClientPhone2] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [saleDate, setSaleDate] = useState(todayISO());
  const [deliveryDate, setDeliveryDate] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [reservedUntil, setReservedUntil] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  const CUSTOMER_REQUIRED_STATUSES: CarStatus[] = ["sold", "reserved"];
  const showCustomerSection = CUSTOMER_REQUIRED_STATUSES.includes(status) || soldMarker;
  const requireDeliveryDate = status === "sold" || soldMarker;

  // EREV fields are only persisted when the toggle is on at submit. Warn the
  // user if they entered EREV data but then turned the toggle off, so the
  // data loss is visible rather than silent.
  const hasUnsavedErevData =
    !isErev && (motor.trim() !== "" || evKm.trim() !== "" || motorKm.trim() !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const vinTrimmed = vin.trim().toUpperCase();
    if (!validateVin(vinTrimmed)) {
      toast.error(
        "VIN must be exactly 17 characters. Letters and numbers only — the letters I, O and Q are not allowed in a VIN."
      );
      return;
    }

    if (!brand) {
      toast.error("Please select a brand");
      return;
    }

    if (modelYear.trim()) {
      const yearNum = parseInt(modelYear, 10);
      const maxYear = currentYear() + 2;
      if (Number.isNaN(yearNum) || yearNum < 1990 || yearNum > maxYear) {
        toast.error(`Model year must be between 1990 and ${maxYear}`);
        return;
      }
    }

    if (showCustomerSection || soldMarker) {
      if (!clientFirstName.trim()) {
        toast.error("Client name is required");
        return;
      }
      if (!clientPhone.trim()) {
        toast.error("Client phone is required");
        return;
      }
      if ((requireDeliveryDate || soldMarker) && !deliveryDate.trim()) {
        toast.error("Delivery date is required when sold");
        return;
      }
    }

    setSubmitting(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      toast.error("Not authenticated");
      return;
    }

    // Pre-check for an existing VIN so the user gets a clear message
    // instead of a raw Postgres unique-violation.
    const { data: existingCar } = await supabase
      .from("cars")
      .select("id")
      .eq("vin", vinTrimmed)
      .limit(1)
      .maybeSingle();

    if (existingCar) {
      setSubmitting(false);
      toast.error("A car with this VIN already exists.");
      return;
    }

    // ─── Step 1: Create car via RPC ───
    const { data: carData, error: carError } = await supabase.rpc("create_car", {
      p_vin: vinTrimmed,
      p_brand: brand,
      p_model: model.trim(),
      ...(modelYear ? { p_model_year: parseInt(modelYear, 10) } : {}),
      ...(exteriorColor.trim() ? { p_exterior_color: exteriorColor.trim() } : {}),
      ...(interiorColor.trim() ? { p_interior_color: interiorColor.trim() } : {}),
      p_location_type: locationType,
      p_status: status,
      p_user_id: user.id,
    });

    if (carError) {
      setSubmitting(false);
      const isRls =
        carError.code === "42501" ||
        carError.message.toLowerCase().includes("permission") ||
        carError.message.toLowerCase().includes("policy");
      const isDuplicateVin =
        carError.code === "23505" ||
        carError.message.toLowerCase().includes("duplicate") ||
        carError.message.toLowerCase().includes("unique");
      toast.error(
        isDuplicateVin
          ? "A car with this VIN already exists."
          : isRls
            ? "You don't have permission to add cars."
            : `Failed to add car: ${carError.message}`
      );
      return;
    }

    const carId = (carData as { id: string } | null)?.id;
    if (!carId) {
      setSubmitting(false);
      toast.error("Car created but no ID returned");
      return;
    }

    // Steps 2 and 3 are not transactional. Track whether any of them
    // failed so we never tell the user "success" on a partial save.
    let hadFailure = false;

    // ─── Step 2: Update car with extra fields ───
    const extraFields: CarUpdate = {};

    if (plateNumber.trim()) extraFields.plate_number = plateNumber.trim();
    if (dateArrived) extraFields.date_arrived = dateArrived;
    if (notes.trim()) extraFields.notes = notes.trim();
    if (issue.trim()) extraFields.issue = issue.trim();
    if (suffix.trim()) extraFields.suffix = suffix.trim();
    if (engineNumber.trim()) extraFields.engine_number = engineNumber.trim();
    if (softwareUpdate.trim()) extraFields.software_update = softwareUpdate.trim();
    if (dongle.trim()) extraFields.dongle = dongle.trim();
    extraFields.sold_marker = soldMarker ? "X" : "";
    if (reservationDate) extraFields.reservation_date = reservationDate;

    if (warrantyPerDms) extraFields.warranty_per_dms = warrantyPerDms;
    if (warrantyVehicleExpiry) {
      extraFields.warranty_vehicle_expiry = warrantyVehicleExpiry;
      extraFields.warranty_expiry = warrantyVehicleExpiry;
    }
    if (warrantyBatteryExpiry) extraFields.warranty_battery_expiry = warrantyBatteryExpiry;
    if (warrantyMonzaStartDate) extraFields.warranty_monza_start_date = warrantyMonzaStartDate;
    extraFields.customs_status = customsStatus;
    const batteryNum = batteryPercent ? parseInt(batteryPercent, 10) : undefined;
    if (batteryNum !== undefined && !Number.isNaN(batteryNum) && batteryNum >= 0 && batteryNum <= 100)
      extraFields.battery_percent = batteryNum;
    const currentKmNum = currentKm ? parseInt(currentKm, 10) : undefined;
    if (currentKmNum !== undefined && !Number.isNaN(currentKmNum))
      extraFields.current_km = currentKmNum;
    if (softwareVersion.trim()) extraFields.software_version = softwareVersion.trim();
    // PDI status stays as default "pending" — not set here
    if (isErev) {
      extraFields.is_erev = true;
      if (motor.trim()) extraFields.motor = motor.trim();
      const evKmNum = evKm ? parseInt(evKm, 10) : undefined;
      const motorKmNum = motorKm ? parseInt(motorKm, 10) : undefined;
      if (evKmNum !== undefined && !Number.isNaN(evKmNum)) extraFields.ev_km = evKmNum;
      if (motorKmNum !== undefined && !Number.isNaN(motorKmNum))
        extraFields.motor_km = motorKmNum;
    }

    if (Object.keys(extraFields).length > 0) {
      const { error: updateError } = await supabase
        .from("cars")
        .update(extraFields)
        .eq("id", carId);

      if (updateError) {
        hadFailure = true;
        toast.error(
          `Car created but failed to save extra details: ${updateError.message}`
        );
      }
    }

    // ─── Step 3: If sold/reserved, create customer + sales order ───
    if (showCustomerSection) {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .insert({
          first_name: clientFirstName.trim(),
          last_name: clientLastName.trim() || null,
          phone_primary: clientPhone.trim(),
          phone_secondary: clientPhone2.trim() || null,
          email: clientEmail.trim() || null,
          preferred_language: preferredLanguage || "en",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (customerError) {
        hadFailure = true;
        toast.error(
          `Car created but failed to save customer: ${customerError.message}`
        );
      } else if (customerData?.id) {
        const saleFields: SalesOrderInsert = {
          car_id: carId,
          customer_id: customerData.id,
          status: status === "sold" ? "confirmed" : "reserved",
          created_by: user.id,
        };

        saleFields.currency = "USD";
        if (saleDate) {
          saleFields.sale_date = saleDate;
          saleFields.date_bought = saleDate;
        }
        if (deliveryDate) saleFields.delivery_date = deliveryDate;
        if (saleNotes.trim()) saleFields.notes = saleNotes.trim();
        if (reservedBy.trim()) saleFields.reserved_by = reservedBy.trim();

        if (status === "reserved") {
          const depositNum = depositAmount ? parseFloat(depositAmount) : undefined;
          if (depositNum !== undefined && !Number.isNaN(depositNum))
            saleFields.deposit_amount = depositNum;
          if (reservedUntil) saleFields.reserved_until = reservedUntil;
        }

        const { error: saleError } = await supabase
          .from("sales_orders")
          .insert(saleFields);

        if (saleError) {
          hadFailure = true;
          toast.error(
            `Car + customer created but failed to save sale: ${saleError.message}`
          );
        }
      }
    }

    setSubmitting(false);
    if (hadFailure) {
      toast.warning(
        "Car created, but not everything saved — open the car to review and complete it."
      );
    } else {
      toast.success("Car added successfully!");
    }
    router.push("/cars");
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild data-tour-id="cars-add-back-button">
          <Link href="/cars">← Back</Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Add Car</h1>
          <p className="text-muted-foreground">Add a new car to inventory</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        onChange={() => { if (!dirty) setDirty(true); }}
        className="space-y-6"
        data-tour-id="cars-add-form"
      >
        {/* Section 1: Vehicle Information */}
        <Card data-tour-id="cars-add-vehicle-info-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="size-5" />
              Vehicle Information
            </CardTitle>
            <CardDescription>VIN, brand, model, location, status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="car-vin">
                  VIN *
                  <FieldHint text="The car's unique 17-character Vehicle Identification Number — found on the dashboard or door frame." />
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="car-vin"
                    name="car-vin"
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="17 characters"
                    maxLength={17}
                    required
                    className="font-mono"
                    data-tour-id="cars-add-vin-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setScanVinOpen(true)}
                    title="Scan VIN"
                    data-tour-id="cars-add-scan-vin-button"
                  >
                    <ScanLine className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Exactly 17 characters — letters and numbers, no I, O or Q
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-brand">Brand *</Label>
                <Select
                  value={brand}
                  onValueChange={(v) => setBrand(v as Brand)}
                  required
                >
                  <SelectTrigger id="car-brand" data-tour-id="cars-add-brand-select">
                    <SelectValue placeholder="Select brand" />
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="car-model">Model *</Label>
                <Input
                  id="car-model"
                  name="car-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model name"
                  required
                  data-tour-id="cars-add-model-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-model-year">Model Year</Label>
                <Input
                  id="car-model-year"
                  name="car-model-year"
                  type="number" inputMode="decimal"
                  min={1990}
                  max={currentYear() + 2}
                  value={modelYear}
                  onChange={(e) => setModelYear(e.target.value)}
                  placeholder="2024"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="car-exterior-color">Exterior Color</Label>
                <Input
                  id="car-exterior-color"
                  name="car-exterior-color"
                  value={exteriorColor}
                  onChange={(e) => setExteriorColor(e.target.value)}
                  placeholder="e.g. Pearl White"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-interior-color">Interior Color</Label>
                <Input
                  id="car-interior-color"
                  name="car-interior-color"
                  value={interiorColor}
                  onChange={(e) => setInteriorColor(e.target.value)}
                  placeholder="e.g. Black"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="car-suffix">
                  Suffix
                  <FieldHint text="The trim or spec code that comes after the model name, like 'GCC REV' or 'H97c'." />
                </Label>
                <Input
                  id="car-suffix"
                  name="car-suffix"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder="e.g. H97c REV CN, 318 GCC REV"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-engine-number">
                  Engine Number
                  <FieldHint text="The serial number stamped on the engine block — different from the VIN." />
                </Label>
                <Input
                  id="car-engine-number"
                  name="car-engine-number"
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(e.target.value)}
                  placeholder="e.g. 254001204DUB"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="car-location">
                Location
                <FieldHint text="Where the car physically sits right now — showroom floor, storage lot, or the garage." />
              </Label>
              <Select
                value={locationType}
                onValueChange={(v) => setLocationType(v as LocationType)}
              >
                <SelectTrigger id="car-location" data-tour-id="cars-add-location-select">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="car-status">
                  Status
                  <FieldHint text="Where the car is in its life with you — in inventory, reserved, sold, or in the garage." />
                </Label>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    const s = v as CarStatus;
                    setStatus(s);
                    if (s === "sold") setSoldMarker(true);
                  }}
                >
                  <SelectTrigger id="car-status" data-tour-id="cars-add-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Assignable statuses only — Scrapped is an archive-only
                        state handled via the scrap/delete flow, not picked here. */}
                    {CAR_STATUS_EDITABLE.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CAR_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-plate-number">Plate Number</Label>
                <Input
                  id="car-plate-number"
                  name="car-plate-number"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="car-date-arrived">Date Arrived</Label>
                <Input
                  id="car-date-arrived"
                  name="car-date-arrived"
                  type="date"
                  value={dateArrived}
                  onChange={(e) => setDateArrived(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-warranty-dms">
                  Warranty DMS
                  <FieldHint text="The warranty start date as recorded in the manufacturer's Dealer Management System." />
                </Label>
                <Input
                  id="car-warranty-dms"
                  name="car-warranty-dms"
                  type="date"
                  value={warrantyPerDms}
                  onChange={(e) => setWarrantyPerDms(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-warranty-vehicle">
                  Warranty on Vehicle (Expiry)
                  <FieldHint text="The date the vehicle's general warranty runs out." />
                </Label>
                <Input
                  id="car-warranty-vehicle"
                  name="car-warranty-vehicle"
                  type="date"
                  value={warrantyVehicleExpiry}
                  onChange={(e) => setWarrantyVehicleExpiry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-warranty-battery">
                  Warranty on Battery (Expiry)
                  <FieldHint text="The date the separate battery warranty runs out — EV batteries are usually covered longer than the vehicle." />
                </Label>
                <Input
                  id="car-warranty-battery"
                  name="car-warranty-battery"
                  type="date"
                  value={warrantyBatteryExpiry}
                  onChange={(e) => setWarrantyBatteryExpiry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-warranty-monza">
                  Warranty as per Monza
                  <FieldHint text="The warranty start date your dealership honours, which may differ from the manufacturer's date." />
                </Label>
                <Input
                  id="car-warranty-monza"
                  name="car-warranty-monza"
                  type="date"
                  value={warrantyMonzaStartDate}
                  onChange={(e) => setWarrantyMonzaStartDate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="car-customs-status">
                  Customs Status
                  <FieldHint text="Whether the car has cleared import customs and its duties are paid." />
                </Label>
                <Select
                  value={customsStatus}
                  onValueChange={(v) => setCustomsStatus(v as CustomsStatus)}
                >
                  <SelectTrigger id="car-customs-status" data-tour-id="cars-add-customs-status-select">
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

            <div className="space-y-2">
              <Label htmlFor="car-issue">
                Issue
                <FieldHint text="Any known problem with the car right now, like missing parts or a pending fix." />
              </Label>
              <Input
                id="car-issue"
                name="car-issue"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="e.g. Missing Parts, DVR Updated"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="car-sold-marker"
                checked={soldMarker}
                onCheckedChange={(c) => setSoldMarker(!!c)}
              />
              <Label htmlFor="car-sold-marker" className="font-normal">
                Sold (X)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="car-notes">Notes</Label>
              <Textarea
                id="car-notes"
                name="car-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Technical Details */}
        <Card data-tour-id="cars-add-technical-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5" />
              Technical Details
            </CardTitle>
            <CardDescription>Battery, range, KM, software, PDI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="car-software-update"
                  checked={!!softwareUpdate}
                  onCheckedChange={(c) => setSoftwareUpdate(c ? "Yes" : "")}
                />
                <Label htmlFor="car-software-update" className="font-normal">
                  Software update done
                  <FieldHint text="Tick this once the car has been updated to the latest software at the dealership." />
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="car-dongle"
                  checked={!!dongle}
                  onCheckedChange={(c) => setDongle(c ? "Yes" : "")}
                />
                <Label htmlFor="car-dongle" className="font-normal">
                  Dongle
                  <FieldHint text="Tick this if the car comes with its diagnostic dongle accessory." />
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="car-battery-percent">Battery %</Label>
                <Input
                  id="car-battery-percent"
                  name="car-battery-percent"
                  type="number" inputMode="decimal"
                  min={0}
                  max={100}
                  value={batteryPercent}
                  onChange={(e) => setBatteryPercent(e.target.value)}
                  placeholder="0–100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-current-km">KM Driven</Label>
                <Input
                  id="car-current-km"
                  name="car-current-km"
                  type="number" inputMode="decimal"
                  min={0}
                  value={currentKm}
                  onChange={(e) => setCurrentKm(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="car-software-version">
                Software Version
                <FieldHint text="The exact version number of the software currently installed on the car." />
              </Label>
              <Input
                id="car-software-version"
                name="car-software-version"
                value={softwareVersion}
                onChange={(e) => setSoftwareVersion(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>
                PDI Status
                <FieldHint text="Pre-Delivery Inspection — the safety and quality check done before a car can be handed to a customer." />
              </Label>
              <p className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  Pending
                </span>
                <span className="text-muted-foreground text-xs">
                  PDI checklist available after car is created
                </span>
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isErev"
                checked={isErev}
                onCheckedChange={(checked) => setIsErev(checked === true)}
              />
              <Label
                htmlFor="isErev"
                className="cursor-pointer text-sm font-normal"
              >
                Is EREV (Extended Range Electric Vehicle)
                <FieldHint text="Tick this for hybrids that have a small petrol engine to recharge the battery on the go." />
              </Label>
            </div>

            {hasUnsavedErevData && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                EREV details you entered (Motor, EV KM, Motor KM) won&apos;t be
                saved while this toggle is off. Turn it back on to keep them.
              </p>
            )}

            {isErev && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                    <Label htmlFor="car-motor">Motor</Label>
                  <Input
                    id="car-motor"
                    name="car-motor"
                    value={motor}
                    onChange={(e) => setMotor(e.target.value)}
                    placeholder="e.g. 1.5T"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="car-ev-km">
                      EV KM
                      <FieldHint text="Distance the car has driven on battery power alone." />
                    </Label>
                    <Input
                      id="car-ev-km"
                      name="car-ev-km"
                      type="number" inputMode="decimal"
                      min={0}
                      value={evKm}
                      onChange={(e) => setEvKm(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="car-motor-km">
                      Motor KM
                      <FieldHint text="Distance the car has driven using its petrol motor." />
                    </Label>
                    <Input
                      id="car-motor-km"
                      name="car-motor-km"
                      type="number" inputMode="decimal"
                      min={0}
                      value={motorKm}
                      onChange={(e) => setMotorKm(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Customer & Sale Details (only when sold/reserved) */}
        {showCustomerSection && (
          <>
            <Card data-tour-id="cars-add-customer-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5" />
                  Customer Details
                </CardTitle>
                <CardDescription>
                  Client info (required when status is Sold or Reserved)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="client-first-name">Client First Name *</Label>
                    <Input
                      id="client-first-name"
                      name="client-first-name"
                      value={clientFirstName}
                      onChange={(e) => setClientFirstName(e.target.value)}
                      placeholder="Required"
                      required={showCustomerSection}
                      data-tour-id="cars-add-client-first-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-last-name">Client Last Name</Label>
                    <Input
                      id="client-last-name"
                      name="client-last-name"
                      value={clientLastName}
                      onChange={(e) => setClientLastName(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="client-phone">Client Phone *</Label>
                    <Input
                      id="client-phone"
                      name="client-phone"
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="Required"
                      required={showCustomerSection}
                      data-tour-id="cars-add-client-phone-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-phone-2">Client Phone 2</Label>
                    <Input
                      id="client-phone-2"
                      name="client-phone-2"
                      type="tel"
                      value={clientPhone2}
                      onChange={(e) => setClientPhone2(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="client-email">Client Email</Label>
                    <Input
                      id="client-email"
                      name="client-email"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
              <div className="space-y-2">
                <Label htmlFor="client-preferred-language">Preferred Language</Label>
                <Select
                  value={preferredLanguage}
                  onValueChange={setPreferredLanguage}
                >
                  <SelectTrigger id="client-preferred-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-tour-id="cars-add-sale-panel">
              <CardHeader>
                <CardTitle>Sale Details (Optional)</CardTitle>
                <CardDescription>
                  Dates, deposit (for reservations)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sale-date">Date of Sale</Label>
                    <Input
                      id="sale-date"
                      name="sale-date"
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sale-delivery-date">Delivery Date</Label>
                    <Input
                      id="sale-delivery-date"
                      name="sale-delivery-date"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reserved-by">
                      Reserved By
                      <FieldHint text="The staff member who took this reservation for the customer." />
                    </Label>
                    <Input
                      id="reserved-by"
                      name="reserved-by"
                      value={reservedBy}
                      onChange={(e) => setReservedBy(e.target.value)}
                      placeholder="Employee name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reservation-date">Reservation Date</Label>
                    <Input
                      id="reservation-date"
                      name="reservation-date"
                      type="date"
                      value={reservationDate}
                      onChange={(e) => setReservationDate(e.target.value)}
                    />
                  </div>
                </div>

                {status === "reserved" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sale-deposit-amount">
                        Deposit Amount (USD)
                        <FieldHint text="The upfront money the customer paid to hold this car." />
                      </Label>
                      <Input
                        id="sale-deposit-amount"
                        name="sale-deposit-amount"
                        type="number" inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="USD 0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale-reserved-until">
                        Reserved Until
                        <FieldHint text="The date the hold expires — after this the car can be sold to someone else." />
                      </Label>
                      <Input
                        id="sale-reserved-until"
                        name="sale-reserved-until"
                        type="date"
                        value={reservedUntil}
                        onChange={(e) => setReservedUntil(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="sale-notes">Sale Notes</Label>
                  <Textarea
                    id="sale-notes"
                    name="sale-notes"
                    value={saleNotes}
                    onChange={(e) => setSaleNotes(e.target.value)}
                    placeholder="Optional"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} data-tour-id="cars-add-submit-button" data-tour="save-car-button">
            {submitting ? "Adding..." : "Add Car"}
          </Button>
          <Button type="button" variant="outline" asChild data-tour-id="cars-add-cancel-button">
            <Link href="/cars">Cancel</Link>
          </Button>
        </div>
      </form>

      <ScannerDialog
        open={scanVinOpen}
        onClose={() => setScanVinOpen(false)}
        onScan={(value) => {
          const scanned = value.toUpperCase();
          setVin(scanned);
          setScanVinOpen(false);
          // Known VIN → surface the existing car right away rather than
          // letting the user fill the whole form and hit the duplicate
          // error on submit.
          if (validateVin(scanned)) {
            void createClient()
              .from("cars")
              .select("id, brand, model")
              .eq("vin", scanned.trim())
              .is("deleted_at", null)
              .limit(1)
              .maybeSingle()
              .then(({ data: existing }: { data: { id: string; brand: string; model: string } | null }) => {
                if (existing) {
                  toast.warning(
                    `This car is already in the system: ${existing.brand} ${existing.model}`,
                    {
                      action: {
                        label: "Open it",
                        onClick: () => router.push(`/cars/${existing.id}`),
                      },
                    }
                  );
                }
              });
          }
        }}
        title="Scan VIN"
        placeholder="17-character VIN..."
        scanType="vin"
      />
    </div>
  );
}
