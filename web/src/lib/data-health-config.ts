import type { AppRole } from "@/lib/permissions";

export type DataHealthSectionId =
  | "cars_missing_data"
  | "sales_orders_missing_data"
  | "customers_missing_data"
  | "broken_relationships"
  | "warranty_data_missing"
  | "reservation_delivery_missing"
  | "installment_data_missing"
  | "software_health"
  | "garage_health"
  | "cars_missing_technical"
  | "parts_health"
  | "requests_health";

export const DATA_HEALTH_SECTIONS_BY_ROLE: Record<AppRole, DataHealthSectionId[]> = {
  owner: [
    "cars_missing_data",
    "sales_orders_missing_data",
    "customers_missing_data",
    "broken_relationships",
    "warranty_data_missing",
    "reservation_delivery_missing",
    "installment_data_missing",
    "software_health",
    "garage_health",
    "parts_health",
    "requests_health",
  ],
  assistant: [
    "customers_missing_data",
    "sales_orders_missing_data",
    "broken_relationships",
    "reservation_delivery_missing",
    "installment_data_missing",
    "requests_health",
  ],
  sales_ops: [
    "customers_missing_data",
    "sales_orders_missing_data",
    "broken_relationships",
    "reservation_delivery_missing",
    "installment_data_missing",
    "warranty_data_missing",
  ],
  garage_manager: [
    "garage_health",
    "cars_missing_technical",
    "warranty_data_missing",
    "parts_health",
  ],
  garage_staff: ["garage_health"],
  it: ["software_health"],
  hybrid: ["parts_health", "requests_health"],
  khalil_hybrid: ["parts_health", "requests_health"],
  sales: [
    "customers_missing_data",
    "sales_orders_missing_data",
    "broken_relationships",
    "reservation_delivery_missing",
    "installment_data_missing",
    "warranty_data_missing",
  ],
};

export const ROLES_WITH_DATA_HEALTH_ACCESS: AppRole[] = [
  "owner",
  "assistant",
  "sales_ops",
  "sales",
  "garage_manager",
  "garage_staff",
  "it",
  "hybrid",
  "khalil_hybrid",
];

export const SECTION_LABELS: Record<DataHealthSectionId, string> = {
  cars_missing_data: "Cars Missing Data",
  sales_orders_missing_data: "Sales Orders Missing Data",
  customers_missing_data: "Customers Missing Data",
  broken_relationships: "Broken Relationships",
  warranty_data_missing: "Warranty Data Missing",
  reservation_delivery_missing: "Reservation / Delivery Missing",
  installment_data_missing: "Installment Data Missing",
  software_health: "Software Health",
  garage_health: "Garage Health",
  cars_missing_technical: "Cars Missing Technical Data",
  parts_health: "Parts Health",
  requests_health: "Requests Health",
};

/** Section display order: sort by issue count descending. Returns sections in display order. */
export function getSectionsInDisplayOrder(
  sections: DataHealthSectionId[],
  getCount: (id: DataHealthSectionId) => number
): DataHealthSectionId[] {
  return [...sections].sort((a, b) => getCount(b) - getCount(a));
}

/** Target software versions by model for IT health checks. Update as Monza deploys new versions. */
export const LATEST_SOFTWARE_VERSION_BY_MODEL: Record<string, string> = {
  FREE: "latest",
  DREAM: "latest",
  "M HERO 1": "latest",
  "M HERO 2": "latest",
  Voyah: "latest",
};
