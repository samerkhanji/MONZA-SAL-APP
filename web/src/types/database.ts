// Enums matching Supabase
export type CarStatus =
  | "inbound"
  | "in_stock"
  | "showroom"
  | "reserved"
  | "sold"
  | "delivered"
  | "service";

export type LocationType = "showroom1" | "showroom2" | "garage" | "storage";

export type PdiStatus = "pending" | "in_progress" | "done";

export type CarEventType =
  | "created"
  | "moved"
  | "status_changed"
  | "battery_updated"
  | "pdi_updated"
  | "details_updated"
  | "note_added";

export interface Car {
  id: string;
  vin: string;
  plate_number: string | null;
  brand: string;
  model: string;
  model_year: number | null;
  exterior_color: string | null;
  interior_color: string | null;
  status: CarStatus;
  location_type: LocationType;
  location_slot: string | null;
  battery_percent: number | null;
  ev_range_km: number | null;
  motor: string | null;
  software_version: string | null;
  pdi_status: PdiStatus;
  current_km: number | null;
  date_arrived: string | null;
  location_changed_at: string | null;
  status_changed_at: string | null;
  deleted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CarDisplay extends Car {
  vin_short?: string;
  location_full?: string;
  status_display?: string;
  battery_display?: string;
  km_display?: string;
  days_in_inventory?: number | null;
}

export interface CarEvent {
  id: string;
  car_id: string;
  event_type: CarEventType;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  meta: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export const CAR_STATUS_LABELS: Record<CarStatus, string> = {
  inbound: "Inbound",
  in_stock: "In Stock",
  showroom: "Showroom",
  reserved: "Reserved",
  sold: "Sold",
  delivered: "Delivered",
  service: "Service",
};

export const LOCATION_LABELS: Record<LocationType, string> = {
  showroom1: "Showroom 1",
  showroom2: "Showroom 2",
  garage: "Garage",
  storage: "Storage",
};

export const PDI_LABELS: Record<PdiStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
};
