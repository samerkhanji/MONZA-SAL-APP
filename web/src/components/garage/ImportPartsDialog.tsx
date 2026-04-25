"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
// @e965/xlsx: maintained fork shipping fixes for the proto-pollution +
// ReDoS advisories upstream xlsx no longer patches on npm.
import * as XLSX from "@e965/xlsx";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ParsedRow {
  part_name?: string;
  oe_number?: string;
  car_model?: string;
  quantity?: number;
  min_quantity?: number;
  storage_zone?: string;
  supplier?: string;
  unit_cost?: number;
  currency?: string;
  order_date?: string;
  notes?: string;
}

interface ImportPartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const COLUMN_MAP: Record<string, string> = {
  "Part Name": "part_name",
  "PartName": "part_name",
  "part_name": "part_name",
  "OE Number": "oe_number",
  "OENumber": "oe_number",
  "oe_number": "oe_number",
  "Car Model": "car_model",
  "CarModel": "car_model",
  "car_model": "car_model",
  "Quantity": "quantity",
  "quantity": "quantity",
  "Min Quantity": "min_quantity",
  "MinQuantity": "min_quantity",
  "min_quantity": "min_quantity",
  "Storage Zone": "storage_zone",
  "StorageZone": "storage_zone",
  "storage_zone": "storage_zone",
  "Supplier": "supplier",
  "supplier": "supplier",
  "Unit Cost": "unit_cost",
  "UnitCost": "unit_cost",
  "unit_cost": "unit_cost",
  "Currency": "currency",
  "currency": "currency",
  "Order Date": "order_date",
  "OrderDate": "order_date",
  "Arrived Date": "order_date",
  "ArrivedDate": "order_date",
  "order_date": "order_date",
  "Notes": "notes",
  "notes": "notes",
};

function parseExcel(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const rows: ParsedRow[] = data.map((row) => {
          const out: ParsedRow = {};
          for (const [key, val] of Object.entries(row)) {
            const mapped = COLUMN_MAP[key] ?? key;
            if (mapped === "part_name") out.part_name = String(val ?? "").trim();
            else if (mapped === "oe_number") out.oe_number = val ? String(val).trim() : undefined;
            else if (mapped === "car_model") out.car_model = val ? String(val).trim() : undefined;
            else if (mapped === "quantity") out.quantity = typeof val === "number" ? val : parseInt(String(val ?? 0), 10);
            else if (mapped === "min_quantity") out.min_quantity = typeof val === "number" ? val : parseInt(String(val ?? 2), 10);
            else if (mapped === "storage_zone") out.storage_zone = val ? String(val).trim() : undefined;
            else if (mapped === "supplier") out.supplier = val ? String(val).trim() : undefined;
            else if (mapped === "unit_cost") out.unit_cost = typeof val === "number" ? val : parseFloat(String(val ?? ""));
            else if (mapped === "currency") out.currency = val ? String(val).trim() : "USD";
            else if (mapped === "order_date") out.order_date = val ? String(val).trim() : undefined;
            else if (mapped === "notes") out.notes = val ? String(val).trim() : undefined;
          }
          return out;
        });
        resolve(rows.filter((r) => r.part_name));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export function ImportPartsDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportPartsDialogProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls" && ext !== "csv") {
      toast.error("Please upload .xlsx, .xls, or .csv");
      return;
    }
    parseExcel(file)
      .then(setRows)
      .catch(() => toast.error("Failed to parse file"));
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();

    let success = 0;
    for (const r of rows) {
      const { error } = await supabase.from("parts").insert({
        part_name: r.part_name ?? "",
        oe_number: r.oe_number ?? null,
        car_model: r.car_model ?? null,
        quantity: typeof r.quantity === "number" ? r.quantity : 0,
        min_quantity: typeof r.min_quantity === "number" ? r.min_quantity : 2,
        storage_zone: r.storage_zone ?? null,
        supplier: r.supplier ?? null,
        unit_cost: r.unit_cost ?? null,
        currency: r.currency ?? "USD",
        order_date: r.order_date || null,
        notes: r.notes ?? null,
        created_by: user?.id ?? null,
      });
      if (!error) success++;
    }

    setImporting(false);
    toast.success(`Imported ${success} parts successfully`);
    onOpenChange(false);
    onSuccess();
  }

  function handleClose() {
    setRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="text-sm"
            />
          </div>
          {rows.length > 0 && (
            <>
              <p className="text-muted-foreground text-sm">
                Preview ({rows.length} rows). Columns: Part Name (required), OE Number, Car Model, Quantity, Min Quantity, Storage Zone, Supplier, Unit Cost, Currency, Arrived Date, Notes.
              </p>
              <div className="max-h-64 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part Name</TableHead>
                      <TableHead>OE</TableHead>
                      <TableHead>Car Model</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Min</TableHead>
                      <TableHead>Supplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 20).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.part_name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.oe_number}</TableCell>
                        <TableCell>{r.car_model}</TableCell>
                        <TableCell>{r.quantity ?? 0}</TableCell>
                        <TableCell>{r.min_quantity ?? 2}</TableCell>
                        <TableCell>{r.supplier}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 20 && (
                <p className="text-muted-foreground text-xs">
                  ... and {rows.length - 20} more
                </p>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={rows.length === 0 || importing}
          >
            {importing ? "Importing..." : `Import ${rows.length} parts`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
