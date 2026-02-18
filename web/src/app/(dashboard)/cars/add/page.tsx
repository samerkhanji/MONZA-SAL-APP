"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Car, Users, Zap, ScanLine } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { createClient } from "@/lib/supabase";
import type { CarStatus, LocationType, CustomsStatus } from "@/types/database";
import {
  CAR_STATUS_LABELS,
  LOCATION_LABELS,
  CUSTOMS_STATUS_LABELS,
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const BRANDS = ["Voyah", "MHero"] as const;
type Brand = (typeof BRANDS)[number];

const CURRENCIES = ["USD", "AED", "LBP"] as const;
type Currency = (typeof CURRENCIES)[number];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
] as const;

const INITIAL_STATUS: CarStatus = "inbound";
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
  const [scanVinOpen, setScanVinOpen] = useState(false);

  // Section 1: Vehicle Information
  const [vin, setVin] = useState("");
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
  const [warrantyMonzaStartDate, setWarrantyMonzaStartDate] = useState("");
  const [customsStatus, setCustomsStatus] = useState<CustomsStatus>("pending");
  const [notes, setNotes] = useState("");

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
  const [sellingPrice, setSellingPrice] = useState("");
  const [saleDate, setSaleDate] = useState(todayISO());
  const [deliveryDate, setDeliveryDate] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [reservedUntil, setReservedUntil] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  const showCustomerSection = status === "sold" || status === "reserved";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const vinTrimmed = vin.trim().toUpperCase();
    if (!validateVin(vinTrimmed)) {
      toast.error(
        "VIN must be exactly 17 characters (uppercase letters and numbers only)"
      );
      return;
    }

    if (!brand) {
      toast.error("Please select a brand");
      return;
    }

    if (showCustomerSection) {
      if (!clientFirstName.trim()) {
        toast.error("Client first name is required when status is Sold or Reserved");
        return;
      }
      if (!clientPhone.trim()) {
        toast.error("Client phone is required when status is Sold or Reserved");
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

    // ─── Step 1: Create car via RPC ───
    const { data: carData, error: carError } = await supabase.rpc("create_car", {
      p_vin: vinTrimmed,
      p_brand: brand,
      p_model: model.trim(),
      p_model_year: modelYear ? parseInt(modelYear, 10) : null,
      p_exterior_color: exteriorColor.trim() || null,
      p_interior_color: interiorColor.trim() || null,
      p_location_type: locationType,
      p_location_slot: null,
      p_location_floor: null,
      p_status: status,
      p_user_id: user.id,
    });

    if (carError) {
      setSubmitting(false);
      const isRls =
        carError.code === "42501" ||
        carError.message.toLowerCase().includes("permission") ||
        carError.message.toLowerCase().includes("policy");
      toast.error(
        isRls ? "You don't have permission to add cars." : `Failed to add car: ${carError.message}`
      );
      return;
    }

    const carId = (carData as { id: string } | null)?.id;
    if (!carId) {
      setSubmitting(false);
      toast.error("Car created but no ID returned");
      return;
    }

    // ─── Step 2: Update car with extra fields ───
    const extraFields: Partial<{
      plate_number: string;
      date_arrived: string;
      notes: string;
      battery_percent: number;
      current_km: number;
      software_version: string;
      pdi_status: string;
      is_erev: boolean;
      motor: string;
      ev_km: number;
      motor_km: number;
      warranty_per_dms: string;
      warranty_monza_start_date: string;
      customs_status: string;
    }> = {};

    if (plateNumber.trim()) extraFields.plate_number = plateNumber.trim();
    if (dateArrived) extraFields.date_arrived = dateArrived;
    if (notes.trim()) extraFields.notes = notes.trim();

    if (warrantyPerDms) extraFields.warranty_per_dms = warrantyPerDms;
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
        toast.error(
          `Car created but failed to save customer: ${customerError.message}`
        );
      } else if (customerData?.id) {
        const saleFields: Record<string, unknown> = {
          car_id: carId,
          customer_id: customerData.id,
          status: status === "sold" ? "confirmed" : "reserved",
          created_by: user.id,
        };

        const priceNum = sellingPrice ? parseFloat(sellingPrice) : undefined;
        if (priceNum !== undefined && !Number.isNaN(priceNum))
          saleFields.selling_price = priceNum;
        saleFields.currency = "USD";
        if (saleDate) saleFields.sale_date = saleDate;
        if (deliveryDate) saleFields.delivery_date = deliveryDate;
        if (saleNotes.trim()) saleFields.notes = saleNotes.trim();

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
          toast.error(
            `Car + customer created but failed to save sale: ${saleError.message}`
          );
        }
      }
    }

    setSubmitting(false);
    toast.success("Car added successfully!");
    router.push("/cars");
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cars">← Back</Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Add Car</h1>
          <p className="text-muted-foreground">Add a new car to inventory</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Vehicle Information */}
        <Card>
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
                <Label htmlFor="car-vin">VIN *</Label>
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
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setScanVinOpen(true)}
                    title="Scan VIN"
                  >
                    <ScanLine className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Exactly 17 uppercase letters and numbers
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-brand">Brand *</Label>
                <Select
                  value={brand}
                  onValueChange={(v) => setBrand(v as Brand)}
                  required
                >
                  <SelectTrigger id="car-brand">
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-model-year">Model Year</Label>
                <Input
                  id="car-model-year"
                  name="car-model-year"
                  type="number"
                  min={1900}
                  max={2100}
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

            <div className="space-y-2">
              <Label htmlFor="car-location">Location</Label>
              <Select
                value={locationType}
                onValueChange={(v) => setLocationType(v as LocationType)}
              >
                <SelectTrigger id="car-location">
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
                <Label htmlFor="car-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as CarStatus)}
                >
                  <SelectTrigger id="car-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAR_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
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

            <div className="grid gap-4 sm:grid-cols-3">
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
                <Label htmlFor="car-warranty-dms">Warranty as per DMS</Label>
                <Input
                  id="car-warranty-dms"
                  name="car-warranty-dms"
                  type="date"
                  value={warrantyPerDms}
                  onChange={(e) => setWarrantyPerDms(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="car-warranty-monza">Warranty as per Monza</Label>
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
                <Label htmlFor="car-customs-status">Customs Status</Label>
                <Select
                  value={customsStatus}
                  onValueChange={(v) => setCustomsStatus(v as CustomsStatus)}
                >
                  <SelectTrigger id="car-customs-status">
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5" />
              Technical Details
            </CardTitle>
            <CardDescription>Battery, range, KM, software, PDI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="car-battery-percent">Battery %</Label>
                <Input
                  id="car-battery-percent"
                  name="car-battery-percent"
                  type="number"
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
                  type="number"
                  min={0}
                  value={currentKm}
                  onChange={(e) => setCurrentKm(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="car-software-version">Software Version</Label>
              <Input
                id="car-software-version"
                name="car-software-version"
                value={softwareVersion}
                onChange={(e) => setSoftwareVersion(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label>PDI Status</Label>
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
              </Label>
            </div>

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
                    <Label htmlFor="car-ev-km">EV KM</Label>
                    <Input
                      id="car-ev-km"
                      name="car-ev-km"
                      type="number"
                      min={0}
                      value={evKm}
                      onChange={(e) => setEvKm(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="car-motor-km">Motor KM</Label>
                    <Input
                      id="car-motor-km"
                      name="car-motor-km"
                      type="number"
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
            <Card>
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

            <Card>
              <CardHeader>
                <CardTitle>Sale Details (Optional)</CardTitle>
                <CardDescription>
                  Selling price, dates, deposit (for reservations)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sale-selling-price">Selling Price (USD)</Label>
                    <Input
                      id="sale-selling-price"
                      name="sale-selling-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="USD 0.00"
                    />
                  </div>
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

                {status === "reserved" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sale-deposit-amount">Deposit Amount (USD)</Label>
                      <Input
                        id="sale-deposit-amount"
                        name="sale-deposit-amount"
                        type="number"
                        min={0}
                        step="0.01"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="USD 0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale-reserved-until">Reserved Until</Label>
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
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add Car"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/cars">Cancel</Link>
          </Button>
        </div>
      </form>

      <ScannerDialog
        open={scanVinOpen}
        onClose={() => setScanVinOpen(false)}
        onScan={(value) => {
          setVin(value.toUpperCase());
          setScanVinOpen(false);
        }}
        title="Scan VIN"
        placeholder="17-character VIN..."
        scanType="vin"
      />
    </div>
  );
}
