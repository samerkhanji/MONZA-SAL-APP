import type { CarDisplay } from "@/types/database";

/** ISO date YYYY-MM-DD from delivery + whole years (calendar-safe via UTC noon). */
export function warrantyExpiryFromDeliveryYmd(
  deliveryYmd: string,
  years: number
): string {
  const t = deliveryYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCFullYear(dt.getUTCFullYear() + years);
  return dt.toISOString().slice(0, 10);
}

/** True when Monza-backed warranty fields are all unset (safe to auto-fill from delivery). */
export function monzaWarrantySlotsEmpty(car: CarDisplay): boolean {
  const c = car as CarDisplay & {
    warranty_vehicle_expiry?: string | null;
    warranty_expiry?: string | null;
    warranty_battery_expiry?: string | null;
  };
  if (car.warranty_monza_start_date?.trim()) return false;
  if (c.warranty_vehicle_expiry?.trim()) return false;
  if (c.warranty_battery_expiry?.trim()) return false;
  if (c.warranty_expiry?.trim()) return false;
  return true;
}
