/** Keys seeded in migration 043 `garage_capacities` */
export const GARAGE_RESOURCE_KEYS = [
  "bays",
  "pit",
  "car_wash",
  "oven",
  "car_painting",
  "ev_bays",
  "body_work",
  "battery_lab",
  "polish",
] as const;

/** Garage managers may only +1 these; owners and Khalil have full numeric edit. Car wash is owner/Khalil only. */
export const GARAGE_GM_INCREMENT_ONLY_RESOURCES = [
  "bays",
  "pit",
  "oven",
  "car_painting",
  "ev_bays",
  "body_work",
  "battery_lab",
  "polish",
] as const;

const GM_INCREMENT_SET = new Set<string>(GARAGE_GM_INCREMENT_ONLY_RESOURCES);

export function isGarageGmIncrementOnlyResource(resourceName: string): boolean {
  return GM_INCREMENT_SET.has(resourceName);
}

export const GARAGE_RESOURCE_LABELS: Record<string, string> = {
  bays: "Bays (general service)",
  pit: "Pit (oil change)",
  car_wash: "Car wash",
  oven: "Oven",
  car_painting: "Car painting",
  ev_bays: "EV bays",
  body_work: "Body work",
  battery_lab: "Battery lab (batteries only — not full vehicle bays)",
  polish: "Polish",
};

export const GARAGE_TASK_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;
