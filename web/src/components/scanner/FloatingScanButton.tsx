"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { ScannerDialog } from "./ScannerDialog";
import { ScanLine, ExternalLink, MapPin, Wrench } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCATION_LABELS } from "@/types/database";
import type { LocationType } from "@/types/database";

const IS_VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

function isVin(value: string): boolean {
  return IS_VIN.test(value.toUpperCase());
}

interface FoundCar {
  id: string;
  vin: string;
  brand: string;
  model: string;
  status: string;
  location_type: LocationType | null;
}

export function FloatingScanButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [foundCar, setFoundCar] = useState<FoundCar | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const supabase = createClient();

  async function handleScan(value: string) {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;

    if (isVin(trimmed)) {
      const { data: car } = await supabase
        .from("cars")
        .select("id, vin, brand, model, status, location_type")
        .eq("vin", trimmed)
        .is("deleted_at", null)
        .single();

      if (!car) {
        // Not in the system yet — offer to start a new profile with the VIN
        // pre-filled so the user doesn't retype 17 characters.
        toast.error(`No car found with VIN: ${trimmed}`, {
          action: {
            label: "Create car",
            onClick: () =>
              router.push(`/cars/add?vin=${encodeURIComponent(trimmed)}`),
          },
        });
        return;
      }

      // Context-specific shortcuts: some pages want the VIN dropped straight
      // into their own form rather than a generic menu.
      if (pathname.startsWith("/requests")) {
        window.dispatchEvent(new CustomEvent("requests-scan-vin", { detail: trimmed }));
        toast.success(`VIN added to request form: ${trimmed}`);
        return;
      }
      if (pathname.startsWith("/test-drive")) {
        window.dispatchEvent(new CustomEvent("test-drive-scan-vin", { detail: trimmed }));
        toast.success(`VIN ready: ${trimmed}`);
        return;
      }

      // Default: show a quick-action menu so the user can open, move, or
      // start a job without loading the full profile first.
      setFoundCar(car as FoundCar);
      setOpen(false);
    } else {
      const { data: part } = await supabase
        .from("parts")
        .select("id, part_name, oe_number, quantity, status")
        .eq("oe_number", trimmed)
        .is("deleted_at", null)
        .single();

      if (!part) {
        toast.error(`No part found with OE: ${trimmed}`);
        return;
      }

      const partData = part as {
        id: string;
        part_name: string;
        oe_number: string | null;
        quantity: number;
        status: string;
      };

      if (pathname.startsWith("/garage/inventory")) {
        router.push(
          `/garage/inventory?search=${encodeURIComponent(trimmed)}`
        );
        toast.success(
          `Found: ${partData.part_name} · Stock: ${partData.quantity}`
        );
        return;
      }

      if (pathname.startsWith("/garage/jobs/")) {
        window.dispatchEvent(
          new CustomEvent("scan-part", { detail: partData })
        );
        toast.success(`Found: ${partData.part_name} · Stock: ${partData.quantity}`);
        return;
      }

      toast.success(
        `Found: ${partData.part_name} · Stock: ${partData.quantity}`
      );
      router.push(`/garage/inventory?search=${encodeURIComponent(trimmed)}`);
    }
  }

  const carRef = (c: FoundCar) => encodeURIComponent(c.vin || c.id);

  function openProfile() {
    if (!foundCar) return;
    const ref = carRef(foundCar);
    setFoundCar(null);
    router.push(`/cars/${ref}`);
  }

  function startJob() {
    if (!foundCar) return;
    const vin = encodeURIComponent(foundCar.vin);
    setFoundCar(null);
    router.push(`/garage?vin=${vin}`);
  }

  async function moveLocation(next: LocationType) {
    if (!foundCar || next === foundCar.location_type) return;
    setSavingLocation(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("cars")
        .update({ location_type: next, updated_at: new Date().toISOString() })
        .eq("id", foundCar.id);
      if (error) {
        toast.error(`Could not move car: ${error.message}`);
        return;
      }
      // Audit trail, mirroring the car detail page's quick-field save.
      await supabase
        .from("car_events")
        .insert({
          car_id: foundCar.id,
          event_type: "details_updated",
          note: `Location type → ${next}`,
          created_by: user?.id ?? null,
        })
        .then(({ error: e }) => {
          if (e) console.warn("Failed to record car_events location move:", e);
        });
      setFoundCar({ ...foundCar, location_type: next });
      toast.success(`Moved to ${LOCATION_LABELS[next] ?? next}`);
    } finally {
      setSavingLocation(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
        aria-label="Scan barcode"
      >
        <ScanLine className="size-7 sm:size-5" />
      </button>
      <ScannerDialog
        open={open}
        onClose={() => setOpen(false)}
        onScan={handleScan}
        title="Scan VIN or Part"
        placeholder="VIN or OE number..."
        scanType="any"
      />

      {/* Quick-action menu for a found car */}
      <Dialog open={!!foundCar} onOpenChange={(o) => { if (!o) setFoundCar(null); }}>
        <DialogContent className="max-w-[420px]">
          {foundCar && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {foundCar.brand} {foundCar.model}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  <p className="font-mono tracking-wider">{foundCar.vin}</p>
                  <p className="text-muted-foreground">
                    Status: {foundCar.status}
                    {foundCar.location_type
                      ? ` · ${LOCATION_LABELS[foundCar.location_type] ?? foundCar.location_type}`
                      : ""}
                  </p>
                </div>

                {/* Move location */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="size-4" /> Move to location
                  </label>
                  <Select
                    value={foundCar.location_type ?? undefined}
                    onValueChange={(v) => void moveLocation(v as LocationType)}
                    disabled={savingLocation}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose location…" />
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

                <div className="flex flex-col gap-2">
                  <Button onClick={openProfile} className="w-full justify-start">
                    <ExternalLink className="mr-2 size-4" /> Open car profile
                  </Button>
                  <Button
                    onClick={startJob}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Wrench className="mr-2 size-4" /> Start garage job
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
