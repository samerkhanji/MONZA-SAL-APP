"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { getProfileIdsByRole } from "@/lib/user-lookup";
import { createNotificationsForUsers } from "@/lib/notifications";

const THRESHOLDS = [30, 14, 7];
const SESSION_KEY = "monza-warranty-check";

function shouldRunWarrantyCheck(): boolean {
  if (typeof window === "undefined") return true;
  const today = new Date().toDateString();
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored === today) return false;
  sessionStorage.setItem(SESSION_KEY, today);
  return true;
}

export function WarrantyNotificationChecker() {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !shouldRunWarrantyCheck()) return;
    ranRef.current = true;

    const run = async () => {
      const supabase = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Customer-service assistants + hybrids handle warranty follow-up.
      const recipientIds = await getProfileIdsByRole(["assistant", "hybrid"]);
      if (recipientIds.length === 0) return;

      const { data } = await supabase
        .from("cars")
        .select(
          "id, vin, brand, model, warranty_per_dms, warranty_vehicle_expiry, warranty_battery_expiry, warranty_expiry, warranty_monza_start_date"
        )
        .is("deleted_at", null);

      const cars = (data ?? []).map((car: any) => ({
        id: car.id as string,
        vin: car.vin as string,
        brand: car.brand as string,
        model: car.model as string,
        warranty_per_dms: car.warranty_per_dms as string | null,
        warranty_vehicle_expiry: car.warranty_vehicle_expiry as string | null,
        warranty_battery_expiry: car.warranty_battery_expiry as string | null,
        warranty_expiry: car.warranty_expiry as string | null,
        warranty_monza_start_date: car.warranty_monza_start_date as string | null,
      }));

      if (cars.length === 0) return;

      for (const car of cars) {
        const makeModel = `${car.brand} ${car.model}`.trim();

        for (const days of THRESHOLDS) {
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + days);

          if (car.warranty_per_dms) {
            const expiry = new Date(car.warranty_per_dms);
            expiry.setHours(0, 0, 0, 0);
            const diffDays = Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
            if (diffDays === days) {
              const { data: existing } = await supabase
                .from("warranty_notifications_sent")
                .select("id")
                .eq("car_id", car.id)
                .eq("warranty_type", "dms")
                .eq("threshold_days", days)
                .limit(1);
              if (existing && existing.length > 0) continue;

              await createNotificationsForUsers(
                recipientIds,
                "Warranty alert (DMS)",
                `Warranty alert (DMS): VIN ${car.vin} — ${makeModel} warranty expires in ${days} days (${car.warranty_per_dms})`,
                `/cars/${car.vin}`
              );
              await supabase.from("warranty_notifications_sent").insert({
                car_id: car.id,
                warranty_type: "dms",
                threshold_days: days,
              });
            }
          }

          const vehicleExpiry =
            car.warranty_vehicle_expiry ??
            car.warranty_expiry ??
            car.warranty_monza_start_date;
          if (vehicleExpiry) {
            const expiry = new Date(vehicleExpiry);
            expiry.setHours(0, 0, 0, 0);
            const diffDays = Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
            if (diffDays === days) {
              const { data: existing } = await supabase
                .from("warranty_notifications_sent")
                .select("id")
                .eq("car_id", car.id)
                .eq("warranty_type", "vehicle")
                .eq("threshold_days", days)
                .limit(1);
              if (existing && existing.length > 0) continue;

              await createNotificationsForUsers(
                recipientIds,
                "Warranty alert (Vehicle)",
                `Warranty alert (Vehicle): VIN ${car.vin} — ${makeModel} warranty expires in ${days} days (${vehicleExpiry})`,
                `/cars/${car.vin}`
              );
              await supabase.from("warranty_notifications_sent").insert({
                car_id: car.id,
                warranty_type: "vehicle",
                threshold_days: days,
              });
            }
          }

          if (car.warranty_battery_expiry) {
            const expiry = new Date(car.warranty_battery_expiry);
            expiry.setHours(0, 0, 0, 0);
            const diffDays = Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
            if (diffDays === days) {
              const { data: existing } = await supabase
                .from("warranty_notifications_sent")
                .select("id")
                .eq("car_id", car.id)
                .eq("warranty_type", "battery")
                .eq("threshold_days", days)
                .limit(1);
              if (existing && existing.length > 0) continue;

              await createNotificationsForUsers(
                recipientIds,
                "Warranty alert (Battery)",
                `Warranty alert (Battery): VIN ${car.vin} — ${makeModel} warranty expires in ${days} days (${car.warranty_battery_expiry})`,
                `/cars/${car.vin}`
              );
              await supabase.from("warranty_notifications_sent").insert({
                car_id: car.id,
                warranty_type: "battery",
                threshold_days: days,
              });
            }
          }
        }
      }
    };

    run();
  }, []);

  return null;
}
