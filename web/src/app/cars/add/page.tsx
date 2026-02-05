"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { CarStatus, LocationType } from "@/types/database";
import { CAR_STATUS_LABELS, LOCATION_LABELS } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const INITIAL_STATUS: CarStatus = "inbound";
const INITIAL_LOCATION: LocationType = "storage";

export default function AddCarPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vin, setVin] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [exteriorColor, setExteriorColor] = useState("");
  const [interiorColor, setInteriorColor] = useState("");
  const [locationType, setLocationType] = useState<LocationType>(INITIAL_LOCATION);
  const [locationSlot, setLocationSlot] = useState("");
  const [status, setStatus] = useState<CarStatus>(INITIAL_STATUS);
  const [dateArrived, setDateArrived] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();

    const payload = {
      vin: vin.trim(),
      brand: brand.trim(),
      model: model.trim(),
      model_year: modelYear ? parseInt(modelYear, 10) : null,
      exterior_color: exteriorColor.trim() || null,
      interior_color: interiorColor.trim() || null,
      location_type: locationType,
      location_slot: locationSlot.trim() || null,
      status,
      date_arrived: dateArrived || null,
      notes: notes.trim() || null,
    };

    const { data, error: insertError } = await supabase
      .from("cars")
      .insert(payload)
      .select("id")
      .single();

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (data?.id) {
      router.push(`/cars/${data.id}`);
    } else {
      router.push("/cars");
    }
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 py-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cars">← Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Add Car</h1>
          <p className="text-muted-foreground">Add a new car to inventory</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Car details</CardTitle>
          <CardDescription>VIN, brand, model, location</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vin">VIN *</Label>
                <Input
                  id="vin"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  placeholder="e.g. WVWZZZ3CZWE123456"
                  required
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand *</Label>
                <Input
                  id="brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Voyah / MHero"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelYear">Year</Label>
                <Input
                  id="modelYear"
                  type="number"
                  min={1900}
                  max={2100}
                  value={modelYear}
                  onChange={(e) => setModelYear(e.target.value)}
                  placeholder="2024"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exteriorColor">Exterior color</Label>
                <Input
                  id="exteriorColor"
                  value={exteriorColor}
                  onChange={(e) => setExteriorColor(e.target.value)}
                  placeholder="e.g. Pearl White"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interiorColor">Interior color</Label>
                <Input
                  id="interiorColor"
                  value={interiorColor}
                  onChange={(e) => setInteriorColor(e.target.value)}
                  placeholder="e.g. Black"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Initial location</Label>
                <Select
                  value={locationType}
                  onValueChange={(v) => setLocationType(v as LocationType)}
                >
                  <SelectTrigger>
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
                <Label htmlFor="locationSlot">Slot</Label>
                <Input
                  id="locationSlot"
                  value={locationSlot}
                  onChange={(e) => setLocationSlot(e.target.value)}
                  placeholder="e.g. S1-R3-C12"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as CarStatus)}>
                  <SelectTrigger>
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
                <Label htmlFor="dateArrived">Date arrived</Label>
                <Input
                  id="dateArrived"
                  type="date"
                  value={dateArrived}
                  onChange={(e) => setDateArrived(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add car"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/cars">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
