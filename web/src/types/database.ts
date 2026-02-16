// Enums matching Supabase
export type CarStatus =
  | "inbound"
  | "in_stock"
  | "showroom"
  | "reserved"
  | "sold"
  | "delivered"
  | "service"
  | "sent_to_sub_dealer"
  | "demo";

export type LocationType = "showroom1" | "showroom2" | "garage" | "storage" | "inventory";

export type PdiStatus = "pending" | "in_progress" | "done";

export type CustomsStatus = "pending" | "in_progress" | "cleared" | "exempt";

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
  sub_dealer_name: string | null;
  brand: string;
  model: string;
  model_year: number | null;
  exterior_color: string | null;
  interior_color: string | null;
  status: CarStatus;
  location_type: LocationType;
  location_slot: string | null;
  location_floor: string | null;
  battery_percent: number | null;
  ev_range_km: number | null;
  motor: string | null;
  software_version: string | null;
  pdi_status: PdiStatus;
  current_km: number | null;
  date_arrived: string | null;
  location_changed_at: string | null;
  status_changed_at: string | null;
  price: number | null;
  price_currency: string | null;
  warranty_expiry: string | null;
  warranty_per_dms: string | null;
  warranty_monza_start_date: string | null;
  customs_status: CustomsStatus;
  customs_amount_paid: number | null;
  customs_amount_currency: string | null;
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
  price_display?: string;
  warranty_display?: string;
  customs_display?: string;
}

export type CarDocumentType = "pdi" | "job_card";

export interface CarDocument {
  id: string;
  car_id: string;
  document_type: CarDocumentType;
  file_name: string;
  storage_path: string;
  file_size_bytes: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
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
  sent_to_sub_dealer: "Sent to Sub Dealer",
  demo: "Demo",
};

export const LOCATION_LABELS: Record<LocationType, string> = {
  showroom1: "Showroom 1",
  showroom2: "Showroom 2",
  garage: "Garage",
  storage: "Storage",
  inventory: "Inventory",
};

export const PDI_LABELS: Record<PdiStatus, string> = {
  pending: "Incomplete",
  in_progress: "In Progress",
  done: "Done",
};

export const CUSTOMS_STATUS_LABELS: Record<CustomsStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  cleared: "Cleared",
  exempt: "Exempt",
};

export type LeadStatus =
  | "new_lead"
  | "contacted"
  | "interested"
  | "test_drive"
  | "negotiation"
  | "converted"
  | "lost";

export type LeadSource =
  | "walk_in"
  | "phone"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "website"
  | "referral"
  | "event"
  | "other";

export interface Customer {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_primary: string;
  phone_secondary: string | null;
  email: string | null;
  preferred_language: string | null;
  lead_status: LeadStatus;
  lead_source: LeadSource | null;
  company: string | null;
  address: string | null;
  date_of_birth: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_visit_date: string | null;
  deleted_at: string | null;
}

export interface CustomerDisplay extends Customer {
  full_name?: string;
  status_display?: string;
  source_display?: string;
  language_display?: string;
  total_orders?: number;
  total_notes?: number;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  note_type: string;
  content: string;
  created_by: string | null;
  created_at: string;
}
