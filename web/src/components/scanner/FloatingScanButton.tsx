"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { ScannerDialog } from "./ScannerDialog";
import { ScanLine } from "lucide-react";

const IS_VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

function isVin(value: string): boolean {
  return IS_VIN.test(value.toUpperCase());
}

export function FloatingScanButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  async function handleScan(value: string) {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;

    if (isVin(trimmed)) {
      const { data: car } = await supabase
        .from("cars")
        .select("id, vin, brand, model, status")
        .eq("vin", trimmed)
        .is("deleted_at", null)
        .single();

      if (!car) {
        toast.error(`No car found with VIN: ${trimmed}`);
        return;
      }

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

      if (pathname.startsWith("/garage/jobs/")) {
        toast.success(`Found: ${(car as { brand: string }).brand} ${(car as { model: string }).model}`);
        router.push(`/cars/${encodeURIComponent((car as { vin: string }).vin ?? (car as { id: string }).id)}`);
        return;
      }

      toast.success(`Found: ${(car as { brand: string }).brand} ${(car as { model: string }).model}`);
      router.push(`/cars/${encodeURIComponent((car as { vin: string }).vin ?? (car as { id: string }).id)}`);
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
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
    </>
  );
}
