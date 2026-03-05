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
  | "demo"
  | "registered"
  | "under_registration"
  | "sent_to_customs"
  | "company_car";

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
  issue: string | null;
  software_update: string | null;
  dongle: string | null;
  sold_marker: string | null;
  suffix: string | null;
  engine_number: string | null;
  client_name: string | null;
  delivery_date: string | null;
  client_phone: string | null;
  reserved_by: string | null;
  reservation_date: string | null;
  location_type: LocationType;
  location_slot: string | null;
  location_floor: string | null;
  battery_percent: number | null;
  ev_range_km: number | null;
  motor: string | null;
  is_erev?: boolean;
  ev_km?: number | null;
  motor_km?: number | null;
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
  profiles?: { full_name: string | null } | null;
}

export const CAR_STATUS_LABELS: Record<CarStatus, string> = {
  inbound: "Inbound",
  in_stock: "Available",
  showroom: "Showroom",
  reserved: "Reserved",
  sold: "Sold",
  delivered: "Delivered",
  service: "Service",
  sent_to_sub_dealer: "Sent to Dealership",
  demo: "Display",
  registered: "Registered",
  under_registration: "Under Registration",
  sent_to_customs: "Sent to Customs",
  company_car: "Company Car",
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

export type PartStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "discontinued";

export type MovementType =
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "return";

export interface Part {
  id: string;
  part_name: string;
  oe_number: string | null;
  car_model: string | null;
  description: string | null;
  quantity: number;
  min_quantity: number;
  storage_zone: string | null;
  supplier: string | null;
  supplier_contact: string | null;
  unit_cost: number | null;
  currency: string | null;
  order_date: string | null;
  status: PartStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PartMovement {
  id: string;
  part_id: string;
  movement_type: MovementType;
  quantity: number;
  car_id: string | null;
  job_description: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type JobStatus =
  | "pending"
  | "in_progress"
  | "waiting_parts"
  | "done"
  | "delivered"
  | "cancelled";

export type JobPriority = "low" | "normal" | "urgent";

export interface GarageJob {
  id: string;
  car_id: string;
  title: string;
  description: string | null;
  priority: JobPriority;
  status: JobStatus;
  assigned_to: string | null;
  diagnosis: string | null;
  work_done: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  started_at: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  overtime_notified: boolean | null;
  due_date: string | null;
  customer_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface JobPart {
  id: string;
  job_id: string;
  part_id: string;
  quantity: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface JobDocument {
  id: string;
  job_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export type RequestStatus =
  | "submitted"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "needs_more_info";

export type RequestPriority = "low" | "normal" | "urgent";

export interface Request {
  id: string;
  subject: string;
  description: string | null;
  category: string | null;
  status: RequestStatus;
  priority: RequestPriority;
  assistant_notes: string | null;
  management_comments: string | null;
  submitted_by: string;
  assigned_to: string | null;
  send_to: string | null;
  send_to_user_id: string | null;
  reviewed_by: string | null;
   recipient_user_id: string | null;
   recipient_role: string | null;
   reviewed_at: string | null;
   decision_reason: string | null;
  forwarded_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentPlanStatus = "active" | "completed" | "defaulted" | "cancelled";

export interface PaymentPlan {
  id: string;
  customer_id: string;
  car_id: string | null;
  status: PaymentPlanStatus;
  total_amount: number;
  down_payment: number;
  monthly_amount: number;
  months: number;
  start_date: string;
  due_day: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InstallmentStatus = "upcoming" | "due" | "overdue" | "paid";

export interface InstallmentPayment {
  id: string;
  plan_id: string;
  installment_no: number;
  due_date: string;
  amount_due: number;
  status: InstallmentStatus;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  receipt_url: string | null;
  note: string | null;
  marked_paid_by: string | null;
  created_at: string;
  updated_at: string;
}
