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

export const GARAGE_RESOURCE_LABELS: Record<string, string> = {
  bays: "Bays",
  pit: "Pit",
  car_wash: "Car wash",
  oven: "Oven",
  car_painting: "Car painting",
  ev_bays: "EV bays",
  body_work: "Body work",
  battery_lab: "Battery lab",
  polish: "Polish",
};

export const GARAGE_TASK_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
] as const;
