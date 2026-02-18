"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { getProfileIdsByNames } from "@/lib/user-lookup";
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

      const [laraId, samayaId, khalilId] = await getProfileIdsByNames([
        "Lara",
        "Samaya",
        "Khalil",
      ]);
      const recipientIds = [laraId, samayaId, khalilId].filter(Boolean);
      if (recipientIds.length === 0) return;

      const { data: cars } = await supabase
        .from("cars")
        .select("id, vin, brand, model, warranty_per_dms, warranty_expiry, warranty_monza_start_date")
        .is("deleted_at", null);

      if (!cars || cars.length === 0) return;

      for (const car of cars as Array<{
        id: string;
        vin: string;
        brand: string;
        model: string;
        warranty_per_dms: string | null;
        warranty_expiry: string | null;
        warranty_monza_start_date: string | null;
      }>) {
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

          const monzaExpiry = car.warranty_expiry ?? car.warranty_monza_start_date;
          if (monzaExpiry) {
            const expiry = new Date(monzaExpiry);
            expiry.setHours(0, 0, 0, 0);
            const diffDays = Math.round((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
            if (diffDays === days) {
              const { data: existing } = await supabase
                .from("warranty_notifications_sent")
                .select("id")
                .eq("car_id", car.id)
                .eq("warranty_type", "monza")
                .eq("threshold_days", days)
                .limit(1);
              if (existing && existing.length > 0) continue;

              await createNotificationsForUsers(
                recipientIds,
                "Warranty alert (Monza)",
                `Warranty alert (Monza): VIN ${car.vin} — ${makeModel} warranty expires in ${days} days (${monzaExpiry})`,
                `/cars/${car.vin}`
              );
              await supabase.from("warranty_notifications_sent").insert({
                car_id: car.id,
                warranty_type: "monza",
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
