/**
 * Import MONZA_CRM_Import.xlsx into Supabase
 *
 * Run from web/:
 *   node --env-file=.env.local scripts/import-excel-to-supabase.js "C:\path\to\MONZA_CRM_Import.xlsx"
 *
 * Or ensure .env.local is in web/ and contains NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY).
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

// Load .env.local (try web/.env.local)
const envPaths = [
  path.join(__dirname, "../.env.local"),
  path.join(process.cwd(), ".env.local"),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf8")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) return;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      });
    break;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const excelPath = process.argv[2];
if (!excelPath || !fs.existsSync(excelPath)) {
  console.error("Usage: node scripts/import-excel-to-supabase.js <path-to-excel>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function safeStr(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  return "";
}

function safeDate(v) {
  const s = safeStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function safeNum(v) {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return Math.round(v);
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

// Map STATUS (CRM) from Excel to car_status enum
const STATUS_MAP = {
  "inbound": "inbound",
  "in_stock": "in_stock",
  "in stock": "in_stock",
  "available": "in_stock",
  "showroom": "showroom",
  "reserved": "reserved",
  "sold": "sold",
  "delivered": "delivered",
  "service": "service",
  "sent_to_sub_dealer": "sent_to_sub_dealer",
  "sub dealer": "sent_to_sub_dealer",
  "demo": "demo",
  "display": "demo",
  "registered": "registered",
  "under_registration": "under_registration",
  "under registration": "under_registration",
  "sent_to_customs": "sent_to_customs",
  "company_car": "company_car",
  "company car": "company_car",
};

function mapStatus(excelStatus) {
  if (!excelStatus || typeof excelStatus !== "string") return "in_stock";
  const key = excelStatus.trim().toLowerCase().replace(/\s+/g, "_");
  return STATUS_MAP[key] || STATUS_MAP[excelStatus.trim()] || "in_stock";
}

// PDI status mapping
const PDI_MAP = { "pending": "pending", "in_progress": "in_progress", "done": "done", "complete": "done" };
function mapPdiStatus(v) {
  if (!v) return "pending";
  const k = String(v).trim().toLowerCase();
  return PDI_MAP[k] || "pending";
}

async function importCars() {
  const wb = XLSX.readFile(excelPath);
  const carsByVin = new Map();

  // Sheet 1: Voyah 2026 Inventory
  const sheet1 = wb.Sheets["Voyah 2026 Inventory"];
  if (sheet1) {
    const json = XLSX.utils.sheet_to_json(sheet1, { header: 1, defval: "" });
    const headers = (json[1] ?? []).map((h) => String(h ?? "").toUpperCase());
    const rows = json.slice(2) ?? [];

    const idx = (name) => headers.findIndex((h) => h.includes(name));
    const vinI = idx("VIN");
    const engineI = idx("ENGINE");
    const brandI = idx("BRAND");
    const modelI = idx("MODEL");
    const suffixI = idx("SUFFIX");
    const yearI = idx("YEAR");
    const extI = headers.findIndex((h) => /EXTERIOR|EXT.*COLOR/i.test(h));
    const intI = headers.findIndex((h) => /INTERIOR|INT.*COLOR/i.test(h));
    const statusI = idx("STATUS");
    const issueI = idx("ISSUE");
    const swI = idx("SOFTWARE");
    const dongleI = idx("DONGLE");
    const soldI = idx("SOLD");
    const clientI = headers.findIndex((h) => /CLIENT\s*NAME|^CLIENT$/i.test(h));
    const deliveryI = idx("DELIVERY");
    const phoneI = idx("PHONE");
    const reservedI = idx("RESERVED");
    const plateI = idx("PLATE");
    const dateArrivedI = headers.findIndex((h) => /DATE\s*ARRIVED|ARRIVED/i.test(h));
    const batteryI = idx("BATTERY");
    const kmI = headers.findIndex((h) => /KM|MILEAGE|ODOMETER/i.test(h));
    const evRangeI = headers.findIndex((h) => /EV\s*RANGE|RANGE/i.test(h));
    const motorI = idx("MOTOR");
    const warrantyDmsI = headers.findIndex((h) => /WARRANTY.*DMS|DMS.*WARRANTY/i.test(h));
    const warrantyMonzaI = headers.findIndex((h) => /WARRANTY.*MONZA|MONZA.*WARRANTY/i.test(h));

    for (const row of rows) {
      const vin = safeStr(row[vinI]).toUpperCase();
      if (!vin || vin.length !== 17) continue;

      const car = {
        vin,
        brand: safeStr(row[brandI]) || "Voyah",
        model: safeStr(row[modelI]) || "—",
        model_year: safeNum(row[yearI]),
        exterior_color: safeStr(row[extI]) || null,
        interior_color: safeStr(row[intI]) || null,
        engine_number: safeStr(row[engineI]) || null,
        suffix: safeStr(row[suffixI]) || null,
        status: mapStatus(row[statusI]),
        location_type: "storage",
        issue: safeStr(row[issueI]) || null,
        software_update: safeStr(row[swI]) || null,
        dongle: safeStr(row[dongleI]) || null,
        sold_marker: /x|yes|1|sold/i.test(safeStr(row[soldI])) ? "X" : null,
        client_name: clientI >= 0 ? safeStr(row[clientI]) || null : null,
        delivery_date: safeDate(row[deliveryI]),
        client_phone: safeStr(row[phoneI]) || null,
        reserved_by: safeStr(row[reservedI]) || null,
      };
      if (plateI >= 0 && safeStr(row[plateI])) car.plate_number = safeStr(row[plateI]);
      if (dateArrivedI >= 0 && safeDate(row[dateArrivedI])) car.date_arrived = safeDate(row[dateArrivedI]);
      if (batteryI >= 0) {
        const b = safeNum(row[batteryI]);
        if (b != null && b >= 0 && b <= 100) car.battery_percent = b;
      }
      if (kmI >= 0 && safeNum(row[kmI]) != null) car.current_km = safeNum(row[kmI]);
      if (evRangeI >= 0 && safeNum(row[evRangeI]) != null) car.ev_range_km = safeNum(row[evRangeI]);
      if (motorI >= 0 && safeStr(row[motorI])) car.motor = safeStr(row[motorI]);
      if (warrantyDmsI >= 0 && safeStr(row[warrantyDmsI])) car.warranty_per_dms = safeStr(row[warrantyDmsI]);
      if (warrantyMonzaI >= 0) car.warranty_monza_start_date = safeDate(row[warrantyMonzaI]);
      carsByVin.set(vin, car);
    }
  }

  // Sheet 2: 2026YM Clean
  const sheet2 = wb.Sheets["2026YM Clean"];
  if (sheet2) {
    const json = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: "" });
    const headers = (json[1] ?? []).map((h) => String(h ?? "").toUpperCase());
    const rows = json.slice(2) ?? [];

    const idx = (name) => headers.findIndex((h) => h.includes(name));
    const vinI = idx("VIN");
    const engineI = idx("ENGINE");
    const modelI = idx("MODEL");
    const suffixI = idx("SUFFIX");
    const extI = idx("EXT");
    const intI = idx("INT");
    const statusI = idx("STATUS");
    const swI = idx("SOFTWARE");
    const issueI = idx("ISSUE");
    const soldI = idx("SOLD");
    const clientI = headers.findIndex((h) => /CLIENT\s*NAME|^CLIENT$/i.test(h));
    const deliveryI = idx("DELIVERY");
    const phoneI = idx("PHONE");
    const reservedI = idx("RESERVED");
    const reservationI = idx("RESERVATION");
    const pdiI = idx("PDI");
    const plateI = idx("PLATE");
    const dateArrivedI = headers.findIndex((h) => /DATE\s*ARRIVED|ARRIVED/i.test(h));
    const batteryI = idx("BATTERY");
    const kmI = headers.findIndex((h) => /KM|MILEAGE|ODOMETER/i.test(h));
    const evRangeI = headers.findIndex((h) => /EV\s*RANGE|RANGE/i.test(h));
    const motorI = idx("MOTOR");
    const warrantyDmsI = headers.findIndex((h) => /WARRANTY.*DMS|DMS.*WARRANTY/i.test(h));
    const warrantyMonzaI = headers.findIndex((h) => /WARRANTY.*MONZA|MONZA.*WARRANTY/i.test(h));

    for (const row of rows) {
      const vin = safeStr(row[vinI]).toUpperCase();
      if (!vin || vin.length !== 17) continue;

      const existing = carsByVin.get(vin) || {};
      const merge = {
        ...existing,
        vin,
        brand: existing.brand || "Voyah",
        model: safeStr(row[modelI]) || existing.model || "—",
        model_year: existing.model_year || null,
        exterior_color: safeStr(row[extI]) || existing.exterior_color || null,
        interior_color: safeStr(row[intI]) || existing.interior_color || null,
        engine_number: safeStr(row[engineI]) || existing.engine_number || null,
        suffix: safeStr(row[suffixI]) || existing.suffix || null,
        status: mapStatus(row[statusI]) || existing.status || "in_stock",
        location_type: "storage",
        issue: safeStr(row[issueI]) || existing.issue || null,
        software_update: safeStr(row[swI]) || existing.software_update || null,
        dongle: existing.dongle || null,
        sold_marker: /x|yes|1|sold/i.test(safeStr(row[soldI])) ? "X" : existing.sold_marker || null,
        client_name: clientI >= 0 ? (safeStr(row[clientI]) || existing.client_name) : existing.client_name,
        delivery_date: safeDate(row[deliveryI]) || existing.delivery_date,
        client_phone: safeStr(row[phoneI]) || existing.client_phone || null,
        reserved_by: safeStr(row[reservedI]) || existing.reserved_by || null,
        reservation_date: safeDate(row[reservationI]) || existing.reservation_date,
        pdi_status: mapPdiStatus(row[pdiI]) || existing.pdi_status || "pending",
      };
      if (plateI >= 0 && safeStr(row[plateI])) merge.plate_number = safeStr(row[plateI]);
      if (dateArrivedI >= 0 && safeDate(row[dateArrivedI])) merge.date_arrived = safeDate(row[dateArrivedI]);
      if (batteryI >= 0) {
        const b = safeNum(row[batteryI]);
        if (b != null && b >= 0 && b <= 100) merge.battery_percent = b;
      }
      if (kmI >= 0 && safeNum(row[kmI]) != null) merge.current_km = safeNum(row[kmI]);
      if (evRangeI >= 0 && safeNum(row[evRangeI]) != null) merge.ev_range_km = safeNum(row[evRangeI]);
      if (motorI >= 0 && safeStr(row[motorI])) merge.motor = safeStr(row[motorI]);
      if (warrantyDmsI >= 0 && safeStr(row[warrantyDmsI])) merge.warranty_per_dms = safeStr(row[warrantyDmsI]);
      if (warrantyMonzaI >= 0 && safeDate(row[warrantyMonzaI])) merge.warranty_monza_start_date = safeDate(row[warrantyMonzaI]);
      carsByVin.set(vin, merge);
    }
  }

  // Upsert cars (on update: preserve existing DB values when Excel has empty)
  let inserted = 0, updated = 0, errors = 0;
  for (const [vin, car] of carsByVin) {
    const { pdi_status, ...rest } = car;
    let payload = { ...rest, pdi_status: pdi_status || "pending" };

    const { data: existing } = await supabase
      .from("cars")
      .select("*")
      .eq("vin", vin)
      .maybeSingle();

    if (existing) {
      // Preserve existing values when import has empty (don't overwrite data patch / prior imports)
      const preserved = [
        "client_name", "client_phone", "engine_number", "plate_number",
        "reserved_by", "reservation_date", "delivery_date", "issue", "suffix",
        "battery_percent", "current_km", "ev_range_km", "motor",
        "warranty_per_dms", "warranty_monza_start_date", "date_arrived"
      ];
      for (const key of preserved) {
        const val = payload[key];
        if (val == null || (typeof val === "string" && !val.trim())) {
          payload[key] = existing[key];
        }
      }
      const { error } = await supabase.from("cars").update(payload).eq("id", existing.id);
      if (error) {
        console.error("Update error", vin, error.message);
        errors++;
      } else updated++;
    } else {
      const { error } = await supabase.from("cars").insert(payload);
      if (error) {
        console.error("Insert error", vin, error.message);
        errors++;
      } else inserted++;
    }
  }

  return { carsInserted: inserted, carsUpdated: updated, carsErrors: errors };
}

async function importCustomersFromCarSheets() {
  const wb = XLSX.readFile(excelPath);
  const clientsByKey = new Map(); // key = phone || name for dedup

  const sheetsToScan = ["Voyah 2026 Inventory", "2026YM Clean"];
  for (const sheetName of sheetsToScan) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const headers = (json[1] ?? json[0] ?? []).map((h) => String(h ?? "").toUpperCase());
    const rows = json.slice(headers[0] ? 2 : 1) ?? [];
    const idx = (name) => headers.findIndex((h) => h.includes(name));
    const clientI = idx("CLIENT");
    const phoneI = idx("PHONE");
    if (clientI < 0) continue;
    for (const row of rows) {
      const name = safeStr(row[clientI]);
      const phone = safeStr(row[phoneI]);
      if (!name) continue;
      const key = phone || name;
      if (key && !clientsByKey.has(key)) {
        clientsByKey.set(key, { name, phone: phone || null });
      }
    }
  }

  let inserted = 0, updated = 0, errors = 0;
  for (const { name, phone } of clientsByKey.values()) {
    if (phone) {
      const { data: byPhone } = await supabase.from("customers").select("id").eq("phone_primary", phone).limit(1).maybeSingle();
      if (byPhone) {
        const { error } = await supabase.from("customers").update({ lead_status: "converted", lead_source: "walk_in" }).eq("id", byPhone.id);
        if (error) errors++;
        else updated++;
        continue;
      }
      const { error } = await supabase.from("customers").insert({
        first_name: name.split(" ")[0] || name,
        last_name: name.split(" ").slice(1).join(" ") || null,
        phone_primary: phone,
        email: null,
        notes: null,
        lead_status: "converted",
        lead_source: "walk_in",
      });
      if (error) {
        if (error.code === "23505") updated++;
        else { console.error("Client from car sheet:", name, error.message); errors++; }
      } else inserted++;
    } else {
      const firstName = name.trim().split(/\s+/)[0];
      const { data: byName } = await supabase.from("customers").select("id").eq("first_name", firstName).limit(1);
      const match = byName?.[0];
      if (match) {
        const { error } = await supabase.from("customers").update({ lead_status: "converted", lead_source: "walk_in" }).eq("id", match.id);
        if (error) errors++;
        else updated++;
      }
    }
  }
  return { inserted, updated, errors };
}

async function importCustomers() {
  const wb = XLSX.readFile(excelPath);
  const LEAD_STATUS_MAP = { new_lead: "new_lead", contacted: "contacted", interested: "interested", converted: "converted", lost: "lost" };
  const LEAD_SOURCE_MAP = { referral: "referral", walk_in: "walk_in", phone: "phone", website: "website", other: "other" };
  let inserted = 0, errors = 0;
  for (const sheetName of ["Clients Import", "Customers Import", "Voyah Clients"]) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    // Find header row (first row containing NAME or PHONE)
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(6, json.length); i++) {
      const row = (json[i] ?? []).map((x) => String(x ?? "").toUpperCase());
      if (row.some((c) => c.includes("NAME") || c.includes("PHONE"))) {
        headerRowIdx = i;
        break;
      }
    }
    const headers = (json[headerRowIdx] ?? []).map((h) => String(h ?? "").toUpperCase());
    const rows = json.slice(headerRowIdx + 1) ?? [];
    const idx = (name) => headers.findIndex((h) => h.includes(name));
    const nameI = idx("NAME");
    const phoneI = idx("PHONE");
    const emailI = idx("EMAIL");
    const notesI = idx("NOTES");
    const leadStatusI = idx("LEAD STATUS");
    const leadSourceI = idx("LEAD SOURCE");
    for (const row of rows) {
      const phone = safeStr(row[phoneI]);
      const name = safeStr(row[nameI]);
      if (!phone) continue;
      const { data: existing } = await supabase.from("customers").select("id").eq("phone_primary", phone).limit(1).maybeSingle();
      if (existing) continue;
      const leadStatus = LEAD_STATUS_MAP[String(row[leadStatusI] || "converted").toLowerCase()] || "converted";
      const leadSource = LEAD_SOURCE_MAP[String(row[leadSourceI] || "walk_in").toLowerCase()] || "walk_in";
      const { error } = await supabase.from("customers").insert({
        first_name: name.split(" ")[0] || name,
        last_name: name.split(" ").slice(1).join(" ") || null,
        phone_primary: phone,
        email: safeStr(row[emailI]) || null,
        notes: safeStr(row[notesI]) || null,
        lead_status: leadStatus,
        lead_source: leadSource,
      });
      if (error) {
        console.error("Customer error", phone, error.message);
        errors++;
      } else inserted++;
    }
  }
  return { inserted, errors };
}

async function main() {
  console.log("Importing MONZA_CRM_Import.xlsx into Supabase...\n");

  const carResult = await importCars();
  console.log("Cars:", carResult.carsInserted, "inserted,", carResult.carsUpdated, "updated,", carResult.carsErrors, "errors");

  const custFromSheets = await importCustomersFromCarSheets();
  console.log("Customers from car CLIENT columns:", custFromSheets.inserted, "inserted,", custFromSheets.updated, "updated,", custFromSheets.errors, "errors");

  const custResult = await importCustomers();
  console.log("Customers from Clients/Voyah Clients sheets:", custResult.inserted, "inserted,", custResult.errors, "errors");

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
