"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
// @e965/xlsx: maintained fork shipping fixes for the proto-pollution +
// ReDoS advisories upstream xlsx no longer patches on npm.
import * as XLSX from "@e965/xlsx";
import { createClient } from "@/lib/supabase";
import type { Database } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";

type CarInsert = Database["public"]["Tables"]["cars"]["Insert"];
type SalesOrderInsert = Database["public"]["Tables"]["sales_orders"]["Insert"];
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";

const STATUS_MAP: Record<string, string> = {
  "registered": "registered",
  "under registration": "under_registration",
  "sold / under registration": "sold",
  "sold": "sold",
  "delivered": "delivered",
  "inventory": "inventory",
  "in stock": "in_stock",
  "available": "available",
  "reserved": "reserved",
  "sent to dealership": "sent_to_sub_dealer",
  "dealership": "sent_to_sub_dealer",
  "automena display": "demo",
  "fares south car display": "demo",
  "black motors display": "demo",
  "sent to customs": "sent_to_customs",
  "company car": "company_car",
  "sub dealer": "sent_to_sub_dealer",
};

function mapStatus(excelStatus: string): string {
  if (!excelStatus || typeof excelStatus !== "string") return "in_stock";
  const key = excelStatus.trim().toLowerCase();
  return STATUS_MAP[key] ?? "in_stock";
}

function safeStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  return "";
}

function safeDate(v: unknown): string | null {
  const s = safeStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function safeNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

// Excel often stores phone numbers as floats ("9613701829.0"); strip the
// artifact and keep digits/leading +.
function cleanPhone(v: unknown): string {
  let s = safeStr(v).replace(/\.0+$/, "");
  s = s.replace(/[^\d+]/g, "");
  return s;
}

// Map a free-text customs cell ("Yes"/"No"/…) to the app's customs_status.
function mapCustoms(v: unknown): string | null {
  const s = safeStr(v).toLowerCase();
  if (!s) return null;
  if (/^(y|yes|cleared|done|paid|ok)/.test(s)) return "cleared";
  if (/^(n|no|pending|not)/.test(s)) return "pending";
  if (/exempt/.test(s)) return "exempt";
  return null;
}

export function ImportExcelDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ cars: number; clients: number; updates: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ cars: number; clients: number; updates: number; failed: number; error?: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("Please select an Excel file (.xlsx or .xls)");
      return;
    }
    setFile(f);
    setPreview(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (!data) return;
        const wb = XLSX.read(data, { type: "array" });
        const counts = countRows(wb);
        setPreview(counts);
      } catch (err) {
        console.error(err);
        toast.error("Failed to read file");
        setFile(null);
      }
    };
    reader.readAsArrayBuffer(f);
  }

  // Find the header row + data rows in ANY sheet that has a VIN column, so the
  // importer works regardless of tab names or which row the header sits on.
  function extractVinSheet(
    sheet: XLSX.WorkSheet | undefined
  ): { headers: string[]; rows: unknown[][] } | null {
    if (!sheet) return null;
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    for (let r = 0; r < Math.min(json.length, 8); r++) {
      const row = (json[r] ?? []) as unknown[];
      if (row.some((c) => /vin/i.test(String(c ?? "")))) {
        return { headers: row.map((c) => String(c ?? "")), rows: json.slice(r + 1) };
      }
    }
    return null;
  }

  // Brand isn't a column in the fleet sheet; infer it from the model name.
  function inferBrand(model: string): string {
    return /hero/i.test(model) ? "MHero" : "Voyah";
  }

  function countRows(wb: XLSX.WorkBook): { cars: number; clients: number; updates: number } {
    let cars = 0;
    const clientNames = new Set<string>();
    for (const name of wb.SheetNames) {
      const parsed = extractVinSheet(wb.Sheets[name]);
      if (!parsed) continue;
      const vinIdx = parsed.headers.findIndex((h) => /vin/i.test(h));
      const clientIdx = parsed.headers.findIndex((h) => /^client$|client name/i.test(h));
      for (const r of parsed.rows) {
        const row = r as unknown[];
        if (safeStr(row[vinIdx]).toUpperCase().length !== 17) continue;
        cars++;
        if (clientIdx >= 0) {
          const nm = safeStr(row[clientIdx]).trim().toLowerCase();
          if (nm) clientNames.add(nm);
        }
      }
    }
    let clients = clientNames.size;
    const clientsSheet = wb.Sheets["Voyah Clients"];
    if (clientsSheet) {
      const json = XLSX.utils.sheet_to_json(clientsSheet, { header: 1, defval: "" });
      const rows = (json as unknown[][])?.slice(4) ?? [];
      clients += rows.filter((r) => r && (r as unknown[]).some((c) => c)).length;
    }
    const reportSheet = wb.Sheets["Voyah Report"];
    const soldSheet = wb.Sheets["Voyah Sold"];
    let updates = 0;
    if (reportSheet) {
      const json = XLSX.utils.sheet_to_json(reportSheet, { header: 1, defval: "" });
      updates += Math.max(0, ((json as unknown[][])?.length ?? 0) - 2);
    }
    if (soldSheet) {
      const json = XLSX.utils.sheet_to_json(soldSheet, { header: 1, defval: "" });
      updates += Math.max(0, ((json as unknown[][])?.length ?? 0) - 2);
    }
    return { cars, clients, updates };
  }

  async function handleImport() {
    if (!file || !preview) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = ev.target?.result;
        if (!data) throw new Error("No data");
        const wb = XLSX.read(data, { type: "array" });
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        let carsImported = 0;
        let clientsImported = 0;
        let recordsUpdated = 0;
        let failed = 0;
        // Captured from the first row the database rejects, so the user sees the
        // real reason (e.g. a drifted CHECK constraint) instead of a silent skip.
        let firstError: string | null = null;
        const noteError = (msg?: string | null) => {
          if (!firstError && msg) firstError = msg;
        };

        const carsByVin = new Map<string, CarInsert>();
        // Inline client (name + phone) captured per VIN so we can create
        // customers and link each car to its buyer/holder via cars.customer_id.
        const clientByVin = new Map<string, { name: string; phone: string }>();

        for (const sheetName of wb.SheetNames) {
          const parsed = extractVinSheet(wb.Sheets[sheetName]);
          if (!parsed) continue;
          const headers = parsed.headers;
          const rows = parsed.rows;
          const statusIdx = headers.findIndex((h) => /status/i.test(String(h ?? "")));
          const issueIdx = headers.findIndex((h) => /issue/i.test(String(h ?? "")));
          const modelIdx = headers.findIndex((h) => /model/i.test(String(h ?? "")));
          const suffixIdx = headers.findIndex((h) => /suffix/i.test(String(h ?? "")));
          const yearIdx = headers.findIndex((h) => /year/i.test(String(h ?? "")));
          const extIdx = headers.findIndex((h) => /exterior|color/i.test(String(h ?? "")));
          const intIdx = headers.findIndex((h) => /interior/i.test(String(h ?? "")));
          const vinIdx = headers.findIndex((h) => /vin/i.test(String(h ?? "")));
          const engineIdx = headers.findIndex((h) => /engine/i.test(String(h ?? "")));
          const swIdx = headers.findIndex((h) => /software/i.test(String(h ?? "")));
          const dongleIdx = headers.findIndex((h) => /dongle/i.test(String(h ?? "")));
          const soldIdx = headers.findIndex((h) => /^sold$/i.test(String(h ?? "")));
          // Extra columns present in the real fleet file.
          const plateIdx = headers.findIndex((h) => /plate/i.test(String(h ?? "")));
          const notesIdx = headers.findIndex((h) => /^note|notes/i.test(String(h ?? "")));
          const locIdx = headers.findIndex((h) => /location/i.test(String(h ?? "")));
          const customsIdx = headers.findIndex((h) => /customs/i.test(String(h ?? "")));
          const arrivalIdx = headers.findIndex((h) => /arrival/i.test(String(h ?? "")));
          const regIdx = headers.findIndex((h) => /registration/i.test(String(h ?? "")));
          const deliveryIdx = headers.findIndex((h) => /delivery/i.test(String(h ?? "")));
          const blIdx = headers.findIndex((h) => /bl issue|b\.l|bill of lading/i.test(String(h ?? "")));
          const wVdmsIdx = headers.findIndex((h) => /warranty v\.?d/i.test(String(h ?? "")));
          const wVmIdx = headers.findIndex((h) => /warranty v\.?m/i.test(String(h ?? "")));
          const wBdmsIdx = headers.findIndex((h) => /warranty b\.?d/i.test(String(h ?? "")));
          const wBmIdx = headers.findIndex((h) => /warranty b\.?m/i.test(String(h ?? "")));
          const clientIdx = headers.findIndex((h) => /^client$|client name/i.test(String(h ?? "")));
          const clientPhoneIdx = headers.findIndex((h) => /client number|client phone|^phone/i.test(String(h ?? "")));

          const at = (i: number) => (i >= 0 ? arr[i] : undefined);
          let arr: unknown[] = [];
          for (const row of rows) {
            arr = row as unknown[];
            const vin = safeStr(arr[vinIdx] ?? arr[headers.findIndex((h) => String(h).toUpperCase().includes("VIN"))]).toUpperCase();
            if (!vin || vin.length !== 17) continue;

            const status = mapStatus(safeStr(at(statusIdx)));
            const carModel = safeStr(at(modelIdx)) || "—";
            const car: CarInsert = {
              vin,
              brand: inferBrand(carModel),
              model: carModel,
              model_year: safeNum(at(yearIdx)),
              exterior_color: safeStr(at(extIdx)) || null,
              interior_color: safeStr(at(intIdx)) || null,
              status: status as CarInsert["status"],
              location_type: "storage",
              location_slot: safeStr(at(locIdx)) || null,
              issue: safeStr(at(issueIdx)) || null,
              engine_number: safeStr(at(engineIdx)) || null,
              suffix: safeStr(at(suffixIdx)) || null,
              plate_number: safeStr(at(plateIdx)) || null,
              notes: safeStr(at(notesIdx)) || null,
              customs_status: mapCustoms(at(customsIdx)),
              date_arrived: safeDate(at(arrivalIdx)),
              registration_date: safeDate(at(regIdx)),
              delivery_date: safeDate(at(deliveryIdx)),
              bl_issue_date: safeDate(at(blIdx)),
              warranty_per_dms: safeStr(at(wVdmsIdx)) || null,
              warranty_vehicle_expiry: safeDate(at(wVmIdx)),
              warranty_battery_dms: safeStr(at(wBdmsIdx)) || null,
              warranty_battery_expiry: safeDate(at(wBmIdx)),
              software_update: safeStr(at(swIdx)) || null,
              dongle: safeStr(at(dongleIdx)) || null,
              sold_marker: status === "sold" ? "X" : "",
              created_by: user.id,
            };
            carsByVin.set(vin, car);

            const clientName = safeStr(at(clientIdx));
            const clientPhone = cleanPhone(at(clientPhoneIdx));
            if (clientName || clientPhone) {
              clientByVin.set(vin, { name: clientName, phone: clientPhone });
            }
          }
        }

        // Batch-resolve existing VINs in one round-trip instead of N selects.
        // A 500-row import used to fire 500 `select … eq vin` calls back-to-back;
        // now we do a single `in(vin, [...])` and look up locally.
        const vinList = Array.from(carsByVin.keys());
        const existingByVin = new Map<string, string>();
        // PostgREST has a practical URL-length cap for `in(...)`; chunk to be safe.
        const CAR_VIN_CHUNK = 200;
        for (let i = 0; i < vinList.length; i += CAR_VIN_CHUNK) {
          const slice = vinList.slice(i, i + CAR_VIN_CHUNK);
          if (slice.length === 0) continue;
          const { data: existingRows } = await supabase
            .from("cars")
            .select("id, vin")
            .in("vin", slice);
          for (const row of (existingRows ?? []) as { id: string; vin: string }[]) {
            existingByVin.set(row.vin, row.id);
          }
        }

        const vinToCarId = new Map<string, string>(existingByVin);
        for (const [vin, car] of carsByVin) {
          const existingId = existingByVin.get(vin);
          if (existingId) {
            const { error } = await supabase.from("cars").update(car).eq("id", existingId);
            if (!error) recordsUpdated++;
            else {
              noteError(error.message);
              failed++;
            }
          } else {
            const { data: ins, error } = await supabase
              .from("cars")
              .insert(car)
              .select("id")
              .single();
            if (!error && ins) {
              carsImported++;
              vinToCarId.set(vin, (ins as { id: string }).id);
            } else {
              // Fallback: some statuses (notably "sold"/"delivered") may be
              // rejected by an INSERT-time guard. Land the row as inventory,
              // then move it to its real status with an UPDATE so the car —
              // and its buyer linkage below — is never dropped.
              let landed = false;
              if (car.status === "sold" || car.status === "delivered") {
                const target = car.status;
                const { data: ins2, error: err2 } = await supabase
                  .from("cars")
                  .insert({ ...car, status: "inventory" })
                  .select("id")
                  .single();
                if (!err2 && ins2) {
                  const newId = (ins2 as { id: string }).id;
                  // sold_marker='X' is required by the cars_sold_marker_when_sold
                  // CHECK constraint whenever status='sold'; set it on the same
                  // UPDATE so the move can't trip the constraint.
                  const { error: upErr } = await supabase
                    .from("cars")
                    .update({ status: target, sold_marker: target === "sold" ? "X" : "" })
                    .eq("id", newId);
                  // Keep the car even if it can't reach "sold"; record the linkage.
                  vinToCarId.set(vin, newId);
                  carsImported++;
                  landed = true;
                  if (upErr) noteError(`status→${target}: ${upErr.message}`);
                }
              }
              if (!landed) {
                noteError(error?.message);
                failed++;
              }
            }
          }
        }

        // ── Customers from the inline Client column, linked to their car ──
        // Dedupe by normalized name (one "AUTOMENA DISPLAY" customer even though
        // it appears on many cars); reuse an existing customer when the phone
        // already matches one. Cars get linked via cars.customer_id.
        const custData = new Map<string, { name: string; phone: string; converted: boolean }>();
        for (const [vin, c] of clientByVin) {
          const key = c.name ? c.name.trim().toLowerCase() : `phone:${c.phone}`;
          if (!key) continue;
          const carStatus = carsByVin.get(vin)?.status;
          const converted = carStatus === "sold" || carStatus === "delivered";
          const prev = custData.get(key);
          if (!prev) custData.set(key, { name: c.name || c.phone, phone: c.phone, converted });
          else {
            if (!prev.phone && c.phone) prev.phone = c.phone;
            if (converted) prev.converted = true;
          }
        }
        const keyToCustId = new Map<string, string>();
        for (const [key, d] of custData) {
          let custId: string | null = null;
          if (d.phone) {
            const { data: ex } = await supabase
              .from("customers")
              .select("id")
              .eq("phone_primary", d.phone)
              .limit(1)
              .maybeSingle();
            if (ex) custId = (ex as { id: string }).id;
          }
          if (!custId) {
            const parts = d.name.trim().split(/\s+/);
            const { data: ins, error } = await supabase
              .from("customers")
              .insert({
                first_name: parts[0] || d.name,
                last_name: parts.slice(1).join(" ") || null,
                // phone_primary is NOT NULL; the fleet sheet rarely carries a
                // phone, so fall back to an empty string (the unique-phone index
                // is partial and ignores empty/blank phones, so this never
                // collides across the many phoneless imported customers).
                phone_primary: d.phone || "",
                lead_status: d.converted ? "converted" : "interested",
                lead_source: "other",
                created_by: user.id,
              })
              .select("id")
              .single();
            if (!error && ins) {
              custId = (ins as { id: string }).id;
              clientsImported++;
            } else {
              noteError(error?.message);
              failed++;
            }
          }
          if (custId) keyToCustId.set(key, custId);
        }
        // Link each car to its customer.
        for (const [vin, c] of clientByVin) {
          const key = c.name ? c.name.trim().toLowerCase() : `phone:${c.phone}`;
          const custId = keyToCustId.get(key);
          const carId = vinToCarId.get(vin);
          if (custId && carId) {
            await supabase.from("cars").update({ customer_id: custId }).eq("id", carId);
          }
        }

        const clientsSheet = wb.Sheets["Voyah Clients"];
        if (clientsSheet) {
          const json = XLSX.utils.sheet_to_json(clientsSheet, { header: 1, defval: "" }) as unknown[][];
          const headers = (json[3] ?? []) as string[];
          const rows = json.slice(4) ?? [];
          const nameIdx = headers.findIndex((h) => /name/i.test(String(h ?? "")));
          const phoneIdx = headers.findIndex((h) => /phone/i.test(String(h ?? "")));
          const emailIdx = headers.findIndex((h) => /email/i.test(String(h ?? "")));

          // Pre-collect rows so we can batch-check existence with a single `in()`.
          type ClientRow = { name: string; phone: string; email: string };
          const clientRows: ClientRow[] = [];
          for (const row of rows) {
            const arr = row as unknown[];
            const name = safeStr(arr[nameIdx]);
            const phone = safeStr(arr[phoneIdx]);
            if (!name && !phone) continue;
            if (!phone) continue;
            clientRows.push({ name, phone, email: safeStr(arr[emailIdx]) });
          }
          const phoneList = Array.from(new Set(clientRows.map((r) => r.phone)));
          const existingPhones = new Set<string>();
          const PHONE_CHUNK = 200;
          for (let i = 0; i < phoneList.length; i += PHONE_CHUNK) {
            const slice = phoneList.slice(i, i + PHONE_CHUNK);
            if (slice.length === 0) continue;
            const { data: existingRows } = await supabase
              .from("customers")
              .select("phone_primary")
              .in("phone_primary", slice);
            for (const row of (existingRows ?? []) as { phone_primary: string }[]) {
              existingPhones.add(row.phone_primary);
            }
          }

          for (const { name, phone, email } of clientRows) {
            if (existingPhones.has(phone)) continue;
            const { error: custErr } = await supabase.from("customers").insert({
              first_name: name.split(" ")[0] || name,
              last_name: name.split(" ").slice(1).join(" ") || null,
              phone_primary: phone,
              email: email || null,
              lead_status: "new_lead",
              created_by: user.id,
            });
            if (!custErr) {
              clientsImported++;
              // Avoid double-insert if the same phone appears twice in the sheet.
              existingPhones.add(phone);
            } else failed++;
          }
        }

        // Voyah Report: create customers + sales_orders instead of writing legacy fields on cars
        const reportSheet = wb.Sheets["Voyah Report"];
        if (reportSheet) {
          const json = XLSX.utils.sheet_to_json(reportSheet, { header: 1, defval: "" }) as unknown[][];
          const headers = (json[1] ?? []) as string[];
          const rows = json.slice(2) ?? [];
          const vinIdx = headers.findIndex((h) => /vin/i.test(String(h ?? "")));
          const clientIdx = headers.findIndex((h) => /client/i.test(String(h ?? "")));
          const deliveryIdx = headers.findIndex((h) => /delivery/i.test(String(h ?? "")));
          const phoneIdx = headers.findIndex((h) => /phone/i.test(String(h ?? "")));
          const reservedIdx = headers.findIndex((h) => /reserved/i.test(String(h ?? "")));
          const resDateIdx = headers.findIndex((h) => /reservation/i.test(String(h ?? "")));

          // Pre-parse rows so we can batch-fetch cars/customers/sales_orders in
          // bulk rather than firing three serial selects per row (a 500-row
          // import used to be 1500+ round-trips taking many minutes).
          type ReportRow = {
            vin: string;
            client: string;
            phone: string;
            delivery: string | null;
            reserved: string;
            resDate: string | null;
          };
          const reportRows: ReportRow[] = [];
          for (const row of rows) {
            const arr = row as unknown[];
            const vin = safeStr(arr[vinIdx]).toUpperCase();
            if (!vin) continue;
            const client = safeStr(arr[clientIdx]);
            const phone = safeStr(arr[phoneIdx]);
            if (!client && !phone) continue;
            reportRows.push({
              vin,
              client,
              phone,
              delivery: safeDate(arr[deliveryIdx]),
              reserved: safeStr(arr[reservedIdx]),
              resDate: safeDate(arr[resDateIdx]),
            });
          }

          // 1) Batch-resolve cars by VIN.
          const reportVins = Array.from(new Set(reportRows.map((r) => r.vin)));
          type CarLookup = { id: string };
          const carsByVinLookup = new Map<string, CarLookup>();
          const REPORT_CAR_CHUNK = 200;
          for (let i = 0; i < reportVins.length; i += REPORT_CAR_CHUNK) {
            const slice = reportVins.slice(i, i + REPORT_CAR_CHUNK);
            if (slice.length === 0) continue;
            const { data: carRows } = await supabase
              .from("cars")
              .select("id, vin")
              .in("vin", slice);
            for (const row of (carRows ?? []) as ({ vin: string } & CarLookup)[]) {
              carsByVinLookup.set(row.vin, {
                id: row.id,
              });
            }
          }

          // 2) Batch-resolve customers by phone (only non-empty phones).
          const reportPhones = Array.from(
            new Set(reportRows.map((r) => r.phone).filter((p) => p.length > 0))
          );
          const custByPhone = new Map<string, string>();
          const REPORT_PHONE_CHUNK = 200;
          for (let i = 0; i < reportPhones.length; i += REPORT_PHONE_CHUNK) {
            const slice = reportPhones.slice(i, i + REPORT_PHONE_CHUNK);
            if (slice.length === 0) continue;
            const { data: custRows } = await supabase
              .from("customers")
              .select("id, phone_primary")
              .in("phone_primary", slice);
            for (const row of (custRows ?? []) as { id: string; phone_primary: string }[]) {
              custByPhone.set(row.phone_primary, row.id);
            }
          }

          // 3) Batch-resolve existing non-cancelled sales orders by car_id.
          const reportCarIds = Array.from(
            new Set(
              reportRows
                .map((r) => carsByVinLookup.get(r.vin)?.id)
                .filter((v): v is string => !!v)
            )
          );
          const carsWithOpenSale = new Set<string>();
          const REPORT_SALE_CHUNK = 200;
          for (let i = 0; i < reportCarIds.length; i += REPORT_SALE_CHUNK) {
            const slice = reportCarIds.slice(i, i + REPORT_SALE_CHUNK);
            if (slice.length === 0) continue;
            const { data: saleRows } = await supabase
              .from("sales_orders")
              .select("car_id")
              .in("car_id", slice)
              .not("status", "eq", "cancelled");
            for (const row of (saleRows ?? []) as { car_id: string }[]) {
              carsWithOpenSale.add(row.car_id);
            }
          }

          for (const { vin, client, phone, delivery, reserved, resDate } of reportRows) {
            const carRow = carsByVinLookup.get(vin);
            if (!carRow?.id) continue;

            let customerId: string | null = null;
            if (phone) {
              const cached = custByPhone.get(phone);
              if (cached) {
                customerId = cached;
              } else {
                const parts = client.trim().split(/\s+/);
                const { data: newCust } = await supabase.from("customers").insert({
                  first_name: parts[0] ?? client,
                  last_name: parts.slice(1).join(" ") || null,
                  phone_primary: phone,
                  created_by: user.id,
                }).select("id").single();
                if (newCust?.id) {
                  customerId = newCust.id;
                  custByPhone.set(phone, newCust.id);
                }
              }
            } else if (client) {
              const parts = client.trim().split(/\s+/);
              const { data: newCust } = await supabase.from("customers").insert({
                first_name: parts[0] ?? client,
                last_name: parts.slice(1).join(" ") || null,
                phone_primary: "N/A",
                created_by: user.id,
              }).select("id").single();
              if (newCust?.id) customerId = newCust.id;
            }
            if (!customerId) continue;

            if (carsWithOpenSale.has(carRow.id)) continue;

            const salePayload: SalesOrderInsert = {
              car_id: carRow.id,
              customer_id: customerId,
              status: "confirmed",
              created_by: user.id,
            };
            if (delivery) salePayload.delivery_date = delivery;
            if (reserved) salePayload.reserved_by = reserved;
            if (resDate) salePayload.reserved_until = resDate;

            const { error: saleErr } = await supabase.from("sales_orders").insert(salePayload);
            if (!saleErr) {
              recordsUpdated++;
              // Prevent a duplicate insert if the same VIN appears more than
              // once in the sheet now that we no longer round-trip per row.
              carsWithOpenSale.add(carRow.id);
            } else failed++;
          }
        }

        setResult({ cars: carsImported, clients: clientsImported, updates: recordsUpdated, failed, error: firstError });
        if (failed > 0) {
          toast.warning(
            `Imported ${carsImported} cars, ${clientsImported} clients, ${recordsUpdated} updates — ${failed} row(s) skipped.` +
              (firstError ? ` First error: ${firstError}` : "")
          );
        } else {
          toast.success(`Imported ${carsImported} cars, ${clientsImported} clients, ${recordsUpdated} updates`);
        }
        onSuccess();
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleClose(open: boolean) {
    if (!open) {
      setFile(null);
      setPreview(null);
      setResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from Excel</DialogTitle>
          <DialogDescription>
            Upload Reservation_Table_Voyah_2026.xlsx to import cars, clients, and sales data
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            id="import-excel-file-input"
            name="import-excel-file"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            aria-label="Excel file"
            title="Excel file"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 size-4" />
            {file ? file.name : "Choose file"}
          </Button>
          {preview && (
            <div className="rounded-lg border bg-muted/50 p-4 text-sm">
              <p className="font-medium">Preview</p>
              <p className="text-muted-foreground">
                ~{preview.cars} cars, ~{preview.clients} clients, ~{preview.updates} updates
              </p>
            </div>
          )}
          {result && (
            <div
              className={
                result.failed > 0
                  ? "rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30"
                  : "rounded-lg border border-green-200 bg-green-50 p-4 text-sm dark:border-green-800 dark:bg-green-950/30"
              }
            >
              <p className="font-medium">
                {result.failed > 0 ? "Import complete (with skipped rows)" : "Import complete"}
              </p>
              <p className="text-muted-foreground">
                {result.cars} cars, {result.clients} clients, {result.updates} updates
                {result.failed > 0 ? ` · ${result.failed} skipped` : ""}
              </p>
              {result.failed > 0 && result.error && (
                <p className="mt-2 break-words font-mono text-xs text-amber-700 dark:text-amber-300">
                  First error: {result.error}
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && file && preview && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : "Confirm Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
