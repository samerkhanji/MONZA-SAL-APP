// Car lifecycle: four operational values + scrapped (migration 051; DB-only soft-remove).
export type CarStatus = "inventory" | "available" | "reserved" | "sold" | "scrapped";

/**
 * UI label. Includes the operational statuses plus legacy values still present
 * in data (in_stock, in_workshop, delivered — e.g. migration 162) so they
 * render and filter cleanly instead of showing a raw lowercase "in stock".
 * Unknown strings fall back to Title Case.
 */
export const CAR_STATUS_LABELS: Record<string, string> = {
  inventory: "Inventory",
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  scrapped: "Scrapped",
  in_stock: "In Stock",
  in_workshop: "In Workshop",
  delivered: "Delivered",
};

/** Statuses users can assign in normal workflows (not scrapped — use archive/scrap flow). */
export const CAR_STATUS_EDITABLE: CarStatus[] = ["inventory", "available", "reserved", "sold"];

export function formatCarStatusLabel(status: string | null | undefined): string {
  if (status == null || status === "") return "—";
  if (CAR_STATUS_LABELS[status]) return CAR_STATUS_LABELS[status];
  // Humanise an unknown enum: "ready_for_pickup" → "Ready For Pickup".
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  /** Relational link on public.cars; may be exposed via cars_display */
  customer_id?: string | null;
  /** From sales_orders via cars_display (latest non-cancelled order) */
  date_bought?: string | null;
  delivery_date: string | null;
  client_phone: string | null;
  reserved_by: string | null;
  reservation_date: string | null;
  location_type: LocationType;
  location_slot: string | null;
  location_floor: string | null;
  battery_percent: number | null;
  km_range: number | null;
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
  warranty_vehicle_expiry: string | null;
  warranty_battery_expiry: string | null;
  warranty_per_dms: string | null;
  warranty_monza_start_date: string | null;
  warranty_battery_dms?: string | null;
  warranty_vehicle_km_limit: number | null;
  warranty_battery_km_limit: number | null;
  customs_status: CustomsStatus;
  customs_amount_paid: number | null;
  customs_amount_currency: string | null;
  /** Migration 042 */
  trim?: string | null;
  specs?: string | null;
  bl_issue_date?: string | null;
  registration_date?: string | null;
  customs_notes?: string | null;
  /** Incoming car shipment tracking (Ordered Cars page). */
  incoming_eta?: string | null;
  shipment_code?: string | null;
  /** Recall Center: set when a car is recalled to the manufacturer (Voyah). */
  recalled_at?: string | null;
  recall_reason?: "shipping" | "issue" | null;
  recall_notes?: string | null;
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

export type CarDocumentType = string;

export interface CarDocument {
  id: string;
  car_id: string;
  document_type: CarDocumentType;
  file_name: string;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  /** Legacy columns retained on the table for backward compatibility. */
  storage_path?: string | null;
  file_size_bytes?: number | null;
  uploaded_at?: string;
  event_date?: string | null;
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

export type TestDriveStatus =
  | "pending"
  | "out_for_test_drive"
  | "returned"
  | "cancelled";

export const TEST_DRIVE_STATUS_LABELS: Record<TestDriveStatus, string> = {
  pending: "Pending",
  out_for_test_drive: "Out",
  returned: "Returned",
  cancelled: "Cancelled",
};

/** Employee-defined accessory grouping (migration 035). */
export interface AccessoryCustomTable {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
}

/** Line items in accessory_custom_tables. */
export interface AccessoryCustomItem {
  id: string;
  table_id: string;
  label: string;
  quantity: number;
  note: string | null;
  linked_plate: string | null;
  created_at: string;
  updated_at: string;
}

/** Row shape for public.test_drives */
export interface TestDriveRow {
  id: string;
  car_id: string;
  vin: string;
  employee_user_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  employee_name: string | null;
  status: TestDriveStatus;
  test_drive_start_at: string;
  expected_return_at: string | null;
  actual_return_at: string | null;
  route: string | null;
  purpose: string | null;
  companion_employee: string | null;
  odometer_out: number | null;
  odometer_in: number | null;
  battery_out: number | null;
  battery_in: number | null;
  fuel_out: number | null;
  fuel_in: number | null;
  driver_license_checked: boolean;
  license_number: string | null;
  waiver_signed: boolean;
  incident_notes: string | null;
  notes: string | null;
  car_status_before_test_drive: CarStatus | null;
  created_at: string;
  updated_at: string;
}

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
  // GDPR right-to-erasure (migration 079).
  anonymized_at: string | null;
  anonymized_by: string | null;
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

/** Row shape for public.sales_orders (partial — extend as needed) */
export interface SalesOrderRow {
  id: string;
  car_id: string;
  customer_id: string | null;
  status: string;
  selling_price: number | null;
  currency: string | null;
  sale_date: string | null;
  date_bought: string | null;
  delivery_date: string | null;
  reservation_date: string | null;
  reserved_by?: string | null;
  created_at?: string;
  updated_at?: string;
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
  /** When the part was logged as physically received. */
  received_at?: string | null;
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

export type GarageBayType =
  | "normal"
  | "pit"
  | "car_wash"
  | "oven"
  | "paint"
  | "ev"
  | "body_work"
  | "battery_lab"
  | "polish";

export interface GarageBay {
  id: string;
  bay_number: number;
  name: string;
  bay_type: GarageBayType;
  current_job_id: string | null;
  status: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface JobTimeEntry {
  id: string;
  job_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  created_at: string;
}

export type RepairProposalStatus =
  | "draft"
  | "pending_owner_approval"
  | "sent_to_customer_service"
  | "sent_to_customer"
  | "partially_approved"
  | "fully_approved"
  | "rejected";

export type ProposalItemDecision = "pending" | "approved" | "declined";

export interface RepairProposal {
  id: string;
  job_id: string;
  status: RepairProposalStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepairProposalItem {
  id: string;
  proposal_id: string;
  item_type: "part" | "labor" | "service";
  name: string;
  part_number: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  customer_decision: ProposalItemDecision;
  created_at: string;
}

/**
 * Per-bay-type working data. Stored in the `context` jsonb column of the
 * `garage_job_bay_context` table — these are NOT flat table columns.
 */
export interface GarageJobBayContextData {
  paint_color?: string | null;
  paint_started_at?: string | null;
  paint_ended_at?: string | null;
  oven_temp_c?: number | null;
  oven_started_at?: string | null;
  oven_ended_at?: string | null;
  wash_type?: "exterior" | "interior" | "full" | "detail" | null;
  wash_started_at?: string | null;
  wash_ended_at?: string | null;
  polish_type?: string | null;
  polish_started_at?: string | null;
  polish_ended_at?: string | null;
  battery_health_pct?: number | null;
  battery_test_notes?: string | null;
}

/** A row of the `garage_job_bay_context` table. */
export interface GarageJobBayContext {
  id: string;
  job_id: string;
  bay_type: string;
  context: GarageJobBayContextData;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GarageJob {
  id: string;
  car_id: string | null;
  title: string;
  description: string | null;
  priority: JobPriority;
  status: JobStatus;
  assigned_to: string | null;
  external_assignee_name: string | null;
  assigned_profile?: { id: string; full_name: string | null } | null;
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
  garage_bay_id?: string | null;
  is_battery_only?: boolean;
  work_checklist?: Array<{ id: string; label: string; done: boolean }>;
  task_category_id?: string | null;
  current_km?: number | null;
}

export interface JobPart {
  id: string;
  job_id: string;
  part_id: string;
  quantity: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  unit_cost_snapshot?: number | null;
  currency_snapshot?: string | null;
  returned_at?: string | null;
  returned_quantity?: number | null;
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
  /** Optional VIN (migration 049); 17-char vehicle reference. */
  vin?: string | null;
  status: RequestStatus;
  priority: RequestPriority;
  assistant_notes: string | null;
  management_comments: string | null;
  submitted_by: string;
  assigned_to: string | null;
  send_to: string | null;
  send_to_user_id: string | null;
  reviewed_by: string | null;
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
  /** Late-payment interest rate (percentage or policy-specific; stored as numeric). */
  interest_rate?: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InstallmentStatus =
  | "upcoming"
  | "due"
  | "overdue"
  | "partial"
  | "paid"
  | "waived";

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

/** Migration 043 — garage workflow */
export type GarageTaskStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

export interface GarageTaskTemplate {
  id: string;
  name: string;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
}

export interface GarageTaskTemplateItem {
  id: string;
  template_id: string;
  description: string;
  sort_order: number;
  default_resource_type: string | null;
}

export interface GarageTask {
  id: string;
  car_id: string;
  description: string;
  status: GarageTaskStatus;
  assigned_to: string | null;
  resource_type: string | null;
  template_item_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GarageCapacityRow {
  resource_name: string;
  capacity: number;
  updated_at: string;
  updated_by: string | null;
}
