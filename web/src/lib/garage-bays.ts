import type { GarageBayType } from "@/types/database";

export const BAY_TYPE_GROUP_ORDER: GarageBayType[] = [
  "normal",
  "pit",
  "car_wash",
  "oven",
  "paint",
  "ev",
  "body_work",
  "battery_lab",
  "polish",
];

export const BAY_TYPE_GROUP_LABEL: Record<GarageBayType, string> = {
  normal: "Normal Bays",
  pit: "Pit",
  car_wash: "Car Wash",
  oven: "Oven",
  paint: "Paint",
  ev: "EV",
  body_work: "Body Work",
  battery_lab: "Battery Lab",
  polish: "Polish",
};

/** Default label for "+ Add Bay" row */
export const BAY_TYPE_ADD_LABEL: Record<GarageBayType, string> = {
  normal: "Normal Bays",
  pit: "Oil Change Pit",
  car_wash: "Car Wash",
  oven: "Oven",
  paint: "Paint Bays",
  ev: "EV Bays",
  body_work: "Body Work",
  battery_lab: "Battery Lab",
  polish: "Polish",
};

export const BAY_TYPE_BORDER: Record<GarageBayType, string> = {
  normal: "border-l-zinc-500",
  pit: "border-l-amber-800",
  car_wash: "border-l-blue-500",
  oven: "border-l-orange-500",
  paint: "border-l-violet-500",
  ev: "border-l-emerald-500",
  body_work: "border-l-red-500",
  battery_lab: "border-l-yellow-500",
  polish: "border-l-teal-500",
};

export function formatLiveDuration(startedAtIso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function formatDurationMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}
