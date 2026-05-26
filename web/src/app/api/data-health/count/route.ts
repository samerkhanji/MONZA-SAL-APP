import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppRoleFromProfile } from "@/lib/permissions";
import {
  DATA_HEALTH_SECTIONS_BY_ROLE,
  ROLES_WITH_DATA_HEALTH_ACCESS,
  type DataHealthSectionId,
} from "@/lib/data-health-config";

function empty(val: unknown): boolean {
  if (val == null) return true;
  if (typeof val === "string") return val.trim() === "";
  return false;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_role")
    .eq("id", user.id)
    .single();

  const appRole = getAppRoleFromProfile(profile ?? null);
  if (!appRole || !ROLES_WITH_DATA_HEALTH_ACCESS.includes(appRole)) {
    return NextResponse.json({ count: 0 });
  }

  const sections = DATA_HEALTH_SECTIONS_BY_ROLE[appRole] ?? [];

  const carSelect =
    "id, vin, status, location_type, engine_number, date_arrived, warranty_vehicle_dms, warranty_vehicle_expiry, warranty_battery_expiry, reservation_date, reserved_by, delivery_date, software_version, software_update, dongle, issue";
  let jobsQuery = supabase.from("garage_jobs").select("id, status, notes, assigned_to, diagnosis").is("deleted_at", null);
  if (appRole === "garage_staff" && profile?.id) {
    jobsQuery = jobsQuery.eq("assigned_to", profile.id);
  }
  let reqQuery = supabase.from("requests").select("id, category, status, description, assigned_to");
  if (appRole === "hybrid" && profile?.id) {
    reqQuery = reqQuery.eq("assigned_to", profile.id);
  }

  const [
    { data: cars },
    { data: salesOrders },
    { data: customers },
    { data: paymentPlans },
    { data: garageJobs },
    { data: parts },
    { data: requests },
  ] = await Promise.all([
    supabase.from("cars_display").select(carSelect).is("deleted_at", null),
    supabase
      .from("sales_orders")
      .select(
        "id, car_id, customer_id, selling_price, currency, sale_date, date_bought, delivery_date, reservation_date"
      )
      .not("status", "eq", "cancelled"),
    supabase.from("customers").select("id, first_name, last_name, phone_primary, email, address").is("deleted_at", null),
    supabase.from("payment_plans").select("id, installments:installment_payments(due_date, status)"),
    jobsQuery,
    supabase.from("parts").select("id, part_name, oe_number").is("deleted_at", null),
    reqQuery,
  ]);

  const carsList = (cars ?? []) as Record<string, unknown>[];
  const soList = (salesOrders ?? []) as Record<string, unknown>[];
  const custList = (customers ?? []) as Record<string, unknown>[];
  const plansList = (paymentPlans ?? []) as { installments?: { due_date: string | null; status?: string }[] }[];
  const jobsList = (garageJobs ?? []) as Record<string, unknown>[];
  const partsList = (parts ?? []) as Record<string, unknown>[];
  const reqList = (requests ?? []) as Record<string, unknown>[];

  const soCarIds = new Set(soList.map((s) => s.car_id).filter(Boolean));
  const soldCarsNoOrder = carsList.filter((c) => ["sold", "reserved", "delivered"].includes(String(c.status)) && !soCarIds.has(c.id));
  const carIds = new Set(carsList.map((c) => c.id));
  const custIds = new Set(custList.map((c) => c.id));
  const soNoCar = soList.filter((s) => s.car_id && !carIds.has(s.car_id));
  const soNoCustomer = soList.filter((s) => s.customer_id && !custIds.has(s.customer_id));
  const carsMissingData = carsList.filter((c) => empty(c.vin) || empty(c.model) || empty(c.engine_number) || empty(c.date_arrived));
  const soMissingData = soList.filter((s) => empty(s.car_id) || empty(s.customer_id) || s.selling_price == null || empty(s.currency) || empty(s.sale_date));
  const customersMissingData = custList.filter((c) => empty(c.first_name) || empty(c.last_name) || empty(c.phone_primary) || empty(c.email) || empty(c.address));
  const carsWarrantyMissing = carsList.filter((c) => empty(c.warranty_vehicle_dms) && empty(c.warranty_vehicle_expiry) && empty(c.warranty_battery_expiry));
  const carsWarrantyMissingSold = carsWarrantyMissing.filter((c) => ["sold", "reserved", "delivered"].includes(String(c.status)));
  const reservedNoDate = carsList.filter((c) => c.status === "reserved" && empty(c.reservation_date));
  const reservedNoBy = carsList.filter((c) => c.status === "reserved" && empty(c.reserved_by));
  const deliveredNoDate = carsList.filter((c) => c.status === "delivered" && empty(c.delivery_date));
  const plansMissingInstallments = plansList.filter((p) => {
    const inst = p.installments ?? [];
    return inst.length === 0 || inst.some((i) => empty(i.due_date));
  });
  const today = new Date().toISOString().slice(0, 10);
  let overdueCount = 0;
  for (const p of plansList) {
    for (const i of p.installments ?? []) {
      if (i.due_date && i.due_date < today && i.status !== "paid") overdueCount++;
    }
  }
  const carsMissingSoftwareVersion = carsList.filter((c) => empty(c.software_version));
  const carsMissingSoftwareUpdate = carsList.filter((c) => empty(c.software_update));
  const carsMissingDongle = carsList.filter((c) => empty(c.dongle));
  const keywords = /software|electrical|dongle|update|version/i;
  const carsWithSoftwareIssue = carsList.filter((c) => keywords.test(String(c.issue ?? "")));
  const jobsMissingStatus = jobsList.filter((j) => empty(j.status));
  const jobsMissingNotes = jobsList.filter((j) => empty(j.notes));
  const jobsMissingAssigned = jobsList.filter((j) => empty(j.assigned_to));
  const jobsMissingDiagnosis = jobsList.filter((j) => empty(j.diagnosis));
  const serviceCarIds = new Set(jobsList.map((j) => j.car_id));
  const carsInServiceNoIssue = carsList.filter(
    (c) => c.location_type === "garage" && serviceCarIds.has(c.id) && empty(c.issue)
  );
  const carsMissingTechnical = carsList.filter(
    (c) =>
      empty(c.engine_number) ||
      empty(c.date_arrived) ||
      (c.location_type === "garage" && empty(c.issue))
  );
  const partsMissingData = partsList.filter((p) => empty(p.part_name) || empty(p.oe_number));
  const requestsMissingCategory = reqList.filter((r) => empty(r.category));
  const requestsMissingStatus = reqList.filter((r) => empty(r.status));
  const requestsMissingDetails = reqList.filter((r) => empty(r.description));

  const getCount = (id: DataHealthSectionId): number => {
    switch (id) {
      case "cars_missing_data": return carsMissingData.length;
      case "sales_orders_missing_data": return soMissingData.length;
      case "customers_missing_data": return customersMissingData.length;
      case "broken_relationships": return soldCarsNoOrder.length + soNoCar.length + soNoCustomer.length;
      case "warranty_data_missing": return appRole === "sales_ops" ? carsWarrantyMissingSold.length : carsWarrantyMissing.length;
      case "reservation_delivery_missing": return reservedNoDate.length + reservedNoBy.length + deliveredNoDate.length;
      case "installment_data_missing": return plansMissingInstallments.length;
      case "software_health": return carsMissingSoftwareVersion.length + carsMissingSoftwareUpdate.length + carsMissingDongle.length + carsWithSoftwareIssue.length;
      case "garage_health": return jobsMissingStatus.length + jobsMissingNotes.length + jobsMissingAssigned.length + jobsMissingDiagnosis.length + carsInServiceNoIssue.length;
      case "cars_missing_technical": return carsMissingTechnical.length;
      case "parts_health": return partsMissingData.length;
      case "requests_health": return requestsMissingCategory.length + requestsMissingStatus.length + requestsMissingDetails.length;
      default: return 0;
    }
  };

  const count = sections.reduce((sum, id) => sum + getCount(id), 0);
  return NextResponse.json({ count });
}
