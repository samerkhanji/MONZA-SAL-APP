"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
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
  const [result, setResult] = useState<{ cars: number; clients: number; updates: number } | null>(null);
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

  function countRows(wb: XLSX.WorkBook): { cars: number; clients: number; updates: number } {
    let cars = 0;
    const carSheets = ["Voyah 2023 & 2024 & 2025YM", "Voyah 2026YM", "Sent to Customs"];
    for (const name of carSheets) {
      const sheet = wb.Sheets[name];
      if (sheet) {
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const rows = (json as unknown[][])?.slice(2) ?? [];
        cars += rows.filter((r) => r && (r as unknown[]).some((c) => c)).length;
      }
    }
    const clientsSheet = wb.Sheets["Voyah Clients"];
    let clients = 0;
    if (clientsSheet) {
      const json = XLSX.utils.sheet_to_json(clientsSheet, { header: 1, defval: "" });
      const rows = (json as unknown[][])?.slice(4) ?? [];
      clients = rows.filter((r) => r && (r as unknown[]).some((c) => c)).length;
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

        const carsByVin = new Map<string, Record<string, unknown>>();

        for (const sheetName of ["Voyah 2023 & 2024 & 2025YM", "Voyah 2026YM", "Sent to Customs"]) {
          const sheet = wb.Sheets[sheetName];
          if (!sheet) continue;
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
          const headers = (json[1] ?? []) as string[];
          const rows = json.slice(2) ?? [];
          const statusIdx = headers.findIndex((h) => /status/i.test(String(h ?? "")));
          const issueIdx = headers.findIndex((h) => /issue/i.test(String(h ?? "")));
          const modelIdx = headers.findIndex((h) => /model/i.test(String(h ?? "")));
          const suffixIdx = headers.findIndex((h) => /suffix/i.test(String(h ?? "")));
          const yearIdx = headers.findIndex((h) => /year/i.test(String(h ?? "")));
          const extIdx = headers.findIndex((h) => /exterior|color/i.test(String(h ?? "")));
          const intIdx = headers.findIndex((h) => /interior/i.test(String(h ?? "")));
          const vinIdx = headers.findIndex((h) => /vin/i.test(String(h ?? "")));
          const engineIdx = headers.findIndex((h) => /engine/i.test(String(h ?? "")));
          const clientIdx = headers.findIndex((h) => /client/i.test(String(h ?? "")));
          const swIdx = headers.findIndex((h) => /software/i.test(String(h ?? "")));
          const dongleIdx = headers.findIndex((h) => /dongle/i.test(String(h ?? "")));
          const soldIdx = headers.findIndex((h) => /sold/i.test(String(h ?? "")));

          for (const row of rows) {
            const arr = row as unknown[];
            const vin = safeStr(arr[vinIdx] ?? arr[headers.findIndex((h) => String(h).toUpperCase().includes("VIN"))]).toUpperCase();
            if (!vin || vin.length !== 17) continue;

            const status = mapStatus(arr[statusIdx] as string);
            // Legacy fields client_name/client_phone are read-only fallback; use customers + sales_orders instead
            const car: Record<string, unknown> = {
              vin,
              brand: "Voyah",
              model: safeStr(arr[modelIdx]) || "—",
              model_year: safeNum(arr[yearIdx]),
              exterior_color: safeStr(arr[extIdx]) || null,
              interior_color: safeStr(arr[intIdx]) || null,
              status,
              location_type: "storage",
              issue: safeStr(arr[issueIdx]) || null,
              engine_number: safeStr(arr[engineIdx]) || null,
              suffix: safeStr(arr[suffixIdx]) || null,
              software_update: safeStr(arr[swIdx]) || null,
              dongle: safeStr(arr[dongleIdx]) || null,
              sold_marker: /x|yes|1|sold/i.test(safeStr(arr[soldIdx])) ? "X" : "",
              created_by: user.id,
            };

            carsByVin.set(vin, car);
          }
        }

        for (const [vin, car] of carsByVin) {
          const { data: existing } = await supabase.from("cars").select("id").eq("vin", vin).maybeSingle();
          if (existing) {
            const { error } = await supabase.from("cars").update(car).eq("id", (existing as { id: string }).id);
            if (!error) recordsUpdated++;
          } else {
            const { error } = await supabase.from("cars").insert(car);
            if (!error) carsImported++;
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
          for (const row of rows) {
            const arr = row as unknown[];
            const name = safeStr(arr[nameIdx]);
            const phone = safeStr(arr[phoneIdx]);
            if (!name && !phone) continue;
            if (!phone) continue;
            const { data: existing } = await supabase.from("customers").select("id").eq("phone_primary", phone).limit(1).maybeSingle();
            if (existing) continue;
            const { error: custErr } = await supabase.from("customers").insert({
              first_name: name.split(" ")[0] || name,
              last_name: name.split(" ").slice(1).join(" ") || null,
              phone_primary: phone,
              email: safeStr(arr[emailIdx]) || null,
              lead_status: "new_lead",
              created_by: user.id,
            });
            if (!custErr) clientsImported++;
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
          for (const row of rows) {
            const arr = row as unknown[];
            const vin = safeStr(arr[vinIdx]).toUpperCase();
            if (!vin) continue;
            const client = safeStr(arr[clientIdx]);
            const phone = safeStr(arr[phoneIdx]);
            const delivery = safeDate(arr[deliveryIdx]);
            const reserved = safeStr(arr[reservedIdx]);
            const resDate = safeDate(arr[resDateIdx]);
            if (!client && !phone) continue;

            const { data: carRow } = await supabase.from("cars").select("id, price, price_currency").eq("vin", vin).maybeSingle();
            if (!carRow?.id) continue;

            let customerId: string | null = null;
            if (phone) {
              const { data: existingCust } = await supabase.from("customers").select("id").eq("phone_primary", phone).limit(1).maybeSingle();
              if (existingCust?.id) {
                customerId = existingCust.id;
              } else {
                const parts = client.trim().split(/\s+/);
                const { data: newCust } = await supabase.from("customers").insert({
                  first_name: parts[0] ?? client,
                  last_name: parts.slice(1).join(" ") || null,
                  phone_primary: phone,
                  created_by: user.id,
                }).select("id").single();
                if (newCust?.id) customerId = newCust.id;
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

            const { data: existingSale } = await supabase.from("sales_orders").select("id").eq("car_id", carRow.id).not("status", "eq", "cancelled").limit(1).maybeSingle();
            if (existingSale) continue;

            const salePayload: Record<string, unknown> = {
              car_id: carRow.id,
              customer_id: customerId,
              status: "confirmed",
              created_by: user.id,
              // Copy price from the car we just imported so sales reports aren't empty.
              selling_price: carRow.price ?? null,
              currency: carRow.price_currency ?? "USD",
            };
            if (delivery) salePayload.delivery_date = delivery;
            if (reserved) salePayload.reserved_by = reserved;
            if (resDate) salePayload.reserved_until = resDate;

            const { error: saleErr } = await supabase.from("sales_orders").insert(salePayload);
            if (!saleErr) recordsUpdated++;
          }
        }

        setResult({ cars: carsImported, clients: clientsImported, updates: recordsUpdated });
        toast.success(`Imported ${carsImported} cars, ${clientsImported} clients, ${recordsUpdated} updates`);
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
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
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
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm dark:border-green-800 dark:bg-green-950/30">
              <p className="font-medium">Import complete</p>
              <p className="text-muted-foreground">
                {result.cars} cars, {result.clients} clients, {result.updates} updates
              </p>
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
