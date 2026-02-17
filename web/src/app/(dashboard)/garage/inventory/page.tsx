"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { Part } from "@/types/database";
import { PART_STATUS_COLORS, PART_STATUS_LABELS } from "@/lib/constants/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, RefreshCw, Upload, Download, MoreHorizontal, ArrowLeft, ScanLine } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { AddPartDialog } from "@/components/garage/AddPartDialog";
import { StockMovementDialog } from "@/components/garage/StockMovementDialog";
import { EditPartDialog } from "@/components/garage/EditPartDialog";
import { PartHistoryDialog } from "@/components/garage/PartHistoryDialog";
import { ImportPartsDialog } from "@/components/garage/ImportPartsDialog";

function exportToExcel(parts: Part[]) {
  const ws = XLSX.utils.json_to_sheet(
    parts.map((p) => ({
      "Part Name": p.part_name,
      "OE Number": p.oe_number,
      "Car Model": p.car_model,
      Quantity: p.quantity,
      "Min Quantity": p.min_quantity,
      "Storage Zone": p.storage_zone,
      Supplier: p.supplier,
      "Unit Cost": p.unit_cost,
      Currency: p.currency ?? "USD",
      "Order Date": p.order_date,
      Status: p.status,
      Notes: p.notes,
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Parts");
  XLSX.writeFile(wb, "monza_parts_inventory.xlsx");
}

function matchesSearch(p: Part, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    (p.part_name ?? "").toLowerCase().includes(s) ||
    (p.oe_number ?? "").toLowerCase().includes(s) ||
    (p.storage_zone ?? "").toLowerCase().includes(s)
  );
}

export default function GarageInventoryPage() {
  const searchParams = useSearchParams();
  const { canManageParts, canDelete } = useUser();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scanPartOpen, setScanPartOpen] = useState(false);
  const [carModelFilter, setCarModelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [stockDialogPart, setStockDialogPart] = useState<Part | null>(null);
  const [stockDialogType, setStockDialogType] = useState<"stock_in" | "stock_out">("stock_in");
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [historyPart, setHistoryPart] = useState<Part | null>(null);
  const [deletePart, setDeletePart] = useState<Part | null>(null);

  const supabase = createClient();

  async function fetchParts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("parts")
      .select("*")
      .is("deleted_at", null)
      .order("part_name", { ascending: true });

    if (error) {
      toast.error(error.message);
      setParts([]);
    } else {
      setParts((data as Part[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchParts();
  }, []);

  useEffect(() => {
    const q = searchParams.get("search");
    if (q) setSearch(q);
  }, [searchParams]);

  async function handlePartScan(oeNumber: string) {
    const { data: part } = await supabase
      .from("parts")
      .select("id, part_name, oe_number, quantity")
      .eq("oe_number", oeNumber.trim().toUpperCase())
      .is("deleted_at", null)
      .single();

    if (!part) {
      toast.error(`No part found with OE: ${oeNumber}`);
      return;
    }
    const p = part as { part_name: string; quantity: number };
    setSearch(oeNumber.trim().toUpperCase());
    setScanPartOpen(false);
    toast.success(`Found: ${p.part_name} · Stock: ${p.quantity}`);
  }

  const carModels = useMemo(() => {
    const set = new Set<string>();
    for (const p of parts) {
      if (p.car_model) set.add(p.car_model);
    }
    return Array.from(set).sort();
  }, [parts]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    for (const p of parts) {
      if (p.supplier) set.add(p.supplier);
    }
    return Array.from(set).sort();
  }, [parts]);

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      if (!matchesSearch(p, search)) return false;
      if (carModelFilter !== "all" && p.car_model !== carModelFilter) return false;
      if (statusFilter === "low_or_out") {
        if (p.status !== "low_stock" && p.status !== "out_of_stock") return false;
      } else if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (supplierFilter !== "all" && p.supplier !== supplierFilter) return false;
      return true;
    });
  }, [parts, search, carModelFilter, statusFilter, supplierFilter]);

  const lowStockCount = useMemo(
    () =>
      parts.filter(
        (p) => p.status === "low_stock" || p.status === "out_of_stock"
      ).length,
    [parts]
  );

  const showLowStockOnly = () => {
    setStatusFilter("low_or_out");
  };

  async function handleDelete() {
    if (!deletePart) return;
    const { error } = await supabase
      .from("parts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deletePart.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Part removed");
    setDeletePart(null);
    fetchParts();
  }

  function quantityColor(p: Part): string {
    if (p.quantity === 0) return "text-red-600 dark:text-red-400";
    if (p.quantity <= p.min_quantity) return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  }

  return (
    <div className="container mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/garage">
            <ArrowLeft className="mr-2 size-4" />
            Garage
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">Garage Inventory</h1>
      </div>

      {lowStockCount > 0 && (
        <button
          type="button"
          onClick={showLowStockOnly}
          className="flex w-full items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 text-left text-amber-800 transition-colors hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
        >
          <span>⚠️</span>
          <span>
            {lowStockCount} parts are low or out of stock — click to filter
          </span>
        </button>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Parts Inventory</CardTitle>
              <CardDescription>
                Manage parts, stock in/out, view history
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManageParts && (
                <>
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="mr-2 size-4" />
                    Add New Part
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="mr-2 size-4" />
                    Import from Excel
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportToExcel(filteredParts)}
              >
                <Download className="mr-2 size-4" />
                Export to Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchParts()}
                disabled={loading}
              >
                <RefreshCw
                  className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex w-full gap-2 sm:w-auto sm:max-w-xs">
              <Input
                placeholder="Search part name, OE number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-11 flex-1 text-base sm:text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="size-11 min-h-11 min-w-11 shrink-0"
                onClick={() => setScanPartOpen(true)}
                title="Scan Part"
              >
                <ScanLine className="size-4" />
              </Button>
            </div>
            <Select
              value={carModelFilter}
              onValueChange={setCarModelFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Car Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {carModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="low_or_out">Low or Out</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={supplierFilter}
              onValueChange={setSupplierFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-muted-foreground py-8">Loading...</p>
          ) : filteredParts.length === 0 ? (
            <p className="text-muted-foreground py-8">
              No parts found. Add a part or adjust filters.
            </p>
          ) : (
            <>
              {/* Mobile: card layout */}
              <div className="space-y-3 md:hidden">
                {filteredParts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full flex-col gap-2 rounded-lg border border-border/50 bg-card p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
                    onClick={() => setHistoryPart(p)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{p.part_name}</p>
                      <Badge
                        className={
                          PART_STATUS_COLORS[p.status] ??
                          "bg-muted text-muted-foreground"
                        }
                      >
                        {PART_STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </div>
                    <p className="font-mono text-sm text-muted-foreground">
                      {p.oe_number ?? "—"}
                    </p>
                    <p className={`text-sm font-medium ${quantityColor(p)}`}>
                      Qty: {p.quantity}
                      {p.min_quantity != null && ` / min ${p.min_quantity}`}
                    </p>
                  </button>
                ))}
              </div>

              {/* Tablet/Desktop: table */}
              <div className="hidden overflow-x-auto rounded border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part Name</TableHead>
                    <TableHead>OE Number</TableHead>
                    <TableHead>Car Model</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Min Qty</TableHead>
                    <TableHead>Storage Zone</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.part_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {p.oe_number ?? "—"}
                      </TableCell>
                      <TableCell>{p.car_model ?? "—"}</TableCell>
                      <TableCell className={quantityColor(p)}>
                        {p.quantity}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.min_quantity}
                      </TableCell>
                      <TableCell>{p.storage_zone ?? "—"}</TableCell>
                      <TableCell>{p.supplier ?? "—"}</TableCell>
                      <TableCell>
                        {p.unit_cost != null
                          ? `${p.unit_cost} ${p.currency ?? "USD"}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {p.order_date
                          ? new Date(p.order_date).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            PART_STATUS_COLORS[p.status] ??
                            "bg-muted text-muted-foreground"
                          }
                        >
                          {PART_STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canManageParts && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setStockDialogPart(p);
                                    setStockDialogType("stock_in");
                                  }}
                                >
                                  Stock In
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setStockDialogPart(p);
                                    setStockDialogType("stock_out");
                                  }}
                                >
                                  Stock Out
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setEditPart(p)}
                                >
                                  Edit
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => setHistoryPart(p)}
                            >
                              View History
                            </DropdownMenuItem>
                            {canDelete && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeletePart(p)}
                              >
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <AddPartDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={fetchParts}
      />

      <ImportPartsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={fetchParts}
      />

      <StockMovementDialog
        open={!!stockDialogPart}
        onOpenChange={(o) => !o && setStockDialogPart(null)}
        part={stockDialogPart}
        movementType={stockDialogType}
        onSuccess={fetchParts}
      />

      <EditPartDialog
        part={editPart}
        open={!!editPart}
        onOpenChange={(o) => !o && setEditPart(null)}
        onSuccess={fetchParts}
      />

      <PartHistoryDialog
        part={historyPart}
        open={!!historyPart}
        onOpenChange={(o) => !o && setHistoryPart(null)}
      />

      <ScannerDialog
        open={scanPartOpen}
        onClose={() => setScanPartOpen(false)}
        onScan={handlePartScan}
        title="Scan Part OE Number"
        placeholder="OE number..."
        scanType="part"
      />

      <AlertDialog open={!!deletePart} onOpenChange={(o) => !o && setDeletePart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete part?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete &quot;{deletePart?.part_name}&quot;. You can
              restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
