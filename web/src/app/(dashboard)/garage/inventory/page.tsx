"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { canPerform } from "@/lib/permissions";
import type { Part } from "@/types/database";
import { PART_STATUS_COLORS, PART_STATUS_LABELS } from "@/lib/constants/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, RefreshCw, Upload, MoreHorizontal, ScanLine, ChevronRight } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { AddPartDialog } from "@/components/garage/AddPartDialog";
import { StockMovementDialog } from "@/components/garage/StockMovementDialog";
import { EditPartDialog } from "@/components/garage/EditPartDialog";
import { PartHistoryDialog } from "@/components/garage/PartHistoryDialog";
import { ImportPartsDialog } from "@/components/garage/ImportPartsDialog";
import {
  createDeleteRequest,
  getPendingDeleteRequestsForItems,
  type PartDeleteDetails,
} from "@/lib/delete-requests";
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";
import { formatError } from "@/lib/error-messages";

function formatOeShort(oe: string | null | undefined): string {
  const v = (oe ?? "").trim();
  if (!v) return "—";
  if (v.length <= 12) return v;
  return `…${v.slice(-8)}`;
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

// A part's storage_zone holds every location it sits in, e.g.
// "Z0COL6S1ST1 x7 (5 used), Z1COL1S2ST5 x8". Split it into structured entries.
type ZoneEntry = { loc: string; qty: number; used: number };
function parseZones(storageZone: string | null | undefined): ZoneEntry[] {
  if (!storageZone) return [];
  return storageZone
    .split(",")
    .map((seg) => {
      const s = seg.trim();
      if (!s) return null;
      const loc = (s.match(/^(\S+)/)?.[1] ?? s).trim();
      const qty = Number(s.match(/x(\d+)/)?.[1] ?? 0);
      const used = Number(s.match(/\((\d+)\s*used\)/i)?.[1] ?? 0);
      return { loc, qty, used };
    })
    .filter((z): z is ZoneEntry => z != null && z.loc.length > 0);
}

export default function GarageInventoryPage() {
  const searchParams = useSearchParams();
  const { profile, appRole } = useUser();
  const [parts, setParts] = useState<Part[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [scanPartOpen, setScanPartOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
      toast.error(formatError(error));
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
    if (parts.length === 0) return;
    getPendingDeleteRequestsForItems("part", parts.map((p) => p.id)).then((map) => {
      const byId: Record<string, boolean> = {};
      parts.forEach((p) => {
        byId[p.id] = !!map[p.id];
      });
      setPendingDeletes(byId);
    });
  }, [parts]);

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

  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    parts.forEach((p) => {
      const s = p.supplier?.trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [parts]);

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      if (!matchesSearch(p, search)) return false;
      if (supplierFilter !== "all" && p.supplier !== supplierFilter) return false;
      if (statusFilter === "low_or_out") {
        if (p.status !== "low_stock" && p.status !== "out_of_stock") return false;
      } else if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [parts, search, supplierFilter, statusFilter]);

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

  // ── By Location view: group parts by each physical location ──
  const locationGroups = useMemo(() => {
    const q = locationSearch.trim().toLowerCase();
    const map = new Map<string, { part: Part; qty: number; used: number }[]>();
    for (const p of parts) {
      for (const z of parseZones(p.storage_zone)) {
        if (
          q &&
          !z.loc.toLowerCase().includes(q) &&
          !(p.part_name ?? "").toLowerCase().includes(q) &&
          !(p.oe_number ?? "").toLowerCase().includes(q)
        ) {
          continue;
        }
        const arr = map.get(z.loc) ?? [];
        arr.push({ part: p, qty: z.qty, used: z.used });
        map.set(z.loc, arr);
      }
    }
    return [...map.entries()]
      .map(([loc, rows]) => ({
        loc,
        rows,
        inStock: rows.reduce((s, r) => s + r.qty, 0),
        used: rows.reduce((s, r) => s + r.used, 0),
      }))
      .sort((a, b) => a.loc.localeCompare(b.loc, undefined, { numeric: true }));
  }, [parts, locationSearch]);

  // ── Totals view: portfolio-level numbers ──
  const partTotals = useMemo(() => {
    const locs = new Set<string>();
    let usedUnits = 0;
    const byBrand = new Map<string, number>();
    for (const p of parts) {
      for (const z of parseZones(p.storage_zone)) {
        locs.add(z.loc);
        usedUnits += z.used;
      }
      const b = p.car_model?.trim() || "Unspecified";
      byBrand.set(b, (byBrand.get(b) ?? 0) + 1);
    }
    return {
      parts: parts.length,
      units: parts.reduce((s, p) => s + (p.quantity ?? 0), 0),
      inStock: parts.filter((p) => p.status === "in_stock").length,
      low: parts.filter((p) => p.status === "low_stock").length,
      out: parts.filter((p) => p.status === "out_of_stock").length,
      locations: locs.size,
      usedUnits,
      byBrand: [...byBrand.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [parts]);

  const reorderList = useMemo(
    () =>
      parts
        .filter((p) => p.status === "low_stock" || p.status === "out_of_stock")
        .sort((a, b) => a.quantity - b.quantity),
    [parts]
  );

  const canDeletePart = canPerform("parts", "delete", appRole ?? null);

  async function handleDelete() {
    if (!deletePart || !profile) return;

    if (canDeletePart) {
      const res = await fetch(`/api/parts/${deletePart.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof j?.error === "string" ? j.error : "Delete failed");
        return;
      }
      toast.success("Part removed");
      setDeletePart(null);
      fetchParts();
    } else {
      const details: PartDeleteDetails = {
        part_name: deletePart.part_name,
        oe_number: deletePart.oe_number,
        quantity: deletePart.quantity,
      };
      const id = await createDeleteRequest("part", deletePart.id, details, profile.id);
      if (id) {
        toast.success("Deletion request sent for owner approval");
        setPendingDeletes((prev) => ({ ...prev, [deletePart.id]: true }));
      } else {
        toast.error("Failed to submit deletion request");
      }
      setDeletePart(null);
      fetchParts();
    }
  }

  function quantityColor(p: Part): string {
    if (p.quantity === 0) return "text-red-600 dark:text-red-400";
    if (p.min_quantity != null && p.quantity <= p.min_quantity)
      return "text-amber-600 dark:text-amber-400";
    return "text-green-600 dark:text-green-400";
  }

  const partExportColumns: ExportColumn[] = [
    { key: "part_name", header: "Part Name" },
    { key: "oe_number", header: "Part Number" },
    { key: "car_model", header: "Category" },
    { key: "quantity", header: "Qty in Stock", type: "number" },
    { key: "storage_zone", header: "Location" },
    { key: "notes", header: "Notes" },
  ];

  const partExportData = (list: Part[]) =>
    list.map((p) => ({
      ...p,
      status_display: PART_STATUS_LABELS[p.status] ?? p.status,
    }));

  const totalQty = filteredParts.reduce((s, p) => s + p.quantity, 0);

  const canCreatePart = canPerform("parts", "create", appRole ?? null);
  const canEditPart = canPerform("parts", "edit", appRole ?? null);

  return (
    <div className="container mx-auto max-w-[1800px] space-y-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="text-xl font-semibold sm:text-2xl">Garage Inventory</h1>

      {lowStockCount > 0 && (
        <button
          data-tour-id="inventory-low-stock-banner"
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

      <Tabs defaultValue="part" className="space-y-4">
        <TabsList>
          <TabsTrigger value="part">By Part Number</TabsTrigger>
          <TabsTrigger value="location">By Location</TabsTrigger>
          <TabsTrigger value="totals">Totals</TabsTrigger>
        </TabsList>

        <TabsContent value="part">
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
              {canCreatePart && (
                <>
                  <Button data-tour-id="inventory-add-part" size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="mr-2 size-4" />
                    Add New Part
                  </Button>
                  <Button
                    data-tour-id="inventory-import"
                    size="sm"
                    variant="outline"
                    onClick={() => setImportOpen(true)}
                    title="Import from Excel"
                  >
                    <Upload className="mr-2 size-4 shrink-0" />
                    <span className="hidden sm:inline">Import from Excel</span>
                    <span className="sm:hidden">Import</span>
                  </Button>
                </>
              )}
              <span data-tour-id="inventory-export">
                <ExportButton
                  data={partExportData(filteredParts)}
                  allData={partExportData(parts)}
                  columns={partExportColumns}
                  filename="Parts_Inventory"
                  options={{
                    pageName: "Parts Inventory",
                    summary: `Total Parts: ${filteredParts.length} | Total Quantity: ${totalQty}`,
                  }}
                  disabled={loading}
                />
              </span>
              <Button
                data-tour-id="inventory-refresh"
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
                data-tour-id="inventory-search"
                id="parts-search"
                name="parts-search"
                placeholder="Search part name, OE number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-11 flex-1 text-base sm:text-sm"
              />
              <Button
                data-tour-id="inventory-scan-part"
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
              value={supplierFilter}
              onValueChange={setSupplierFilter}
            >
              <SelectTrigger data-tour-id="inventory-supplier-filter" id="parts-supplier-filter" aria-label="Filter by supplier" className="w-[180px]">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {supplierOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-tour-id="inventory-status-filter" id="parts-status-filter" aria-label="Filter by stock status" className="w-[160px]">
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
          </div>

          {loading ? (
            <p className="text-muted-foreground py-8">Loading...</p>
          ) : filteredParts.length === 0 ? (
            <p className="text-muted-foreground py-8">
              No parts found. Add a part or adjust filters.
            </p>
          ) : (
            <>
              {/* Mobile: cards (same actions as table — Phase 2 spec) */}
              <div className="space-y-3 pb-8 md:hidden">
                {filteredParts.map((p) => (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    className="rounded-xl border border-border/50 bg-card p-4 text-left shadow-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setHistoryPart(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setHistoryPart(p);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug">{p.part_name}</p>
                        <p
                          className="mt-0.5 font-mono text-xs text-muted-foreground"
                          title={p.oe_number ?? undefined}
                        >
                          {formatOeShort(p.oe_number)}
                        </p>
                      </div>
                      <div
                        className="flex shrink-0 items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 touch-manipulation"
                              aria-label="Part actions"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {canEditPart && (
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
                                  disabled={p.quantity === 0}
                                  onClick={() => {
                                    setStockDialogPart(p);
                                    setStockDialogType("stock_out");
                                  }}
                                >
                                  Stock Out
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditPart(p)}>
                                  Edit
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={() => setHistoryPart(p)}>
                              View History
                            </DropdownMenuItem>
                            {canDeletePart && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeletePart(p)}
                              >
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronRight
                          className="size-5 text-muted-foreground max-sm:hidden"
                          aria-hidden
                        />
                      </div>
                    </div>

                    <div
                      className="mt-2 flex flex-wrap gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Badge
                        className={
                          PART_STATUS_COLORS[p.status] ??
                          "bg-muted text-muted-foreground"
                        }
                      >
                        {PART_STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                      {pendingDeletes[p.id] && (
                        <Badge
                          variant="outline"
                          className="border-amber-400 text-amber-600 dark:border-amber-500 dark:text-amber-400"
                        >
                          Pending
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {p.car_model && (
                        <p>
                          <span className="text-foreground/80">Model:</span>{" "}
                          {p.car_model}
                        </p>
                      )}
                      <p>
                        <span className="text-foreground/80">Location:</span>{" "}
                        {p.storage_zone ?? "—"}
                      </p>
                      <p>
                        <span className="text-foreground/80">Supplier:</span>{" "}
                        {p.supplier ?? "—"}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-sm">
                      <p className={`font-medium tabular-nums ${quantityColor(p)}`}>
                        Qty {p.quantity}
                        {p.min_quantity != null ? ` · Min ${p.min_quantity}` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        {p.unit_cost != null
                          ? `${p.unit_cost} ${p.currency ?? "USD"}`
                          : "—"}
                      </p>
                    </div>
                    {p.order_date && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Arrived{" "}
                        {new Date(p.order_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Tablet/Desktop: table */}
              <div data-tour-id="inventory-table" className="scrollbar-thick hidden overflow-x-auto rounded-lg border border-border/50 md:block">
              <Table className="min-w-[900px] w-full">
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
                    <TableHead>Arrived Date</TableHead>
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
                        <div className="flex items-center gap-1">
                          <Badge
                            className={
                              PART_STATUS_COLORS[p.status] ??
                              "bg-muted text-muted-foreground"
                            }
                          >
                            {PART_STATUS_LABELS[p.status] ?? p.status}
                          </Badge>
                          {pendingDeletes[p.id] && (
                            <Badge variant="outline" className="text-amber-600 border-amber-400 dark:text-amber-400 dark:border-amber-500">
                              Pending Request
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button data-tour-id="inventory-row-actions" variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEditPart && (
                              <>
                                <DropdownMenuItem
                                  data-tour-id="parts-inventory-stock-in"
                                  onClick={() => {
                                    setStockDialogPart(p);
                                    setStockDialogType("stock_in");
                                  }}
                                >
                                  Stock In
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  data-tour-id="parts-inventory-stock-out"
                                  disabled={p.quantity === 0}
                                  onClick={() => {
                                    setStockDialogPart(p);
                                    setStockDialogType("stock_out");
                                  }}
                                >
                                  Stock Out
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  data-tour-id="parts-inventory-edit"
                                  onClick={() => setEditPart(p)}
                                >
                                  Edit
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              data-tour-id="parts-inventory-view-history"
                              onClick={() => setHistoryPart(p)}
                            >
                              View History
                            </DropdownMenuItem>
                            {canDeletePart && (
                              <DropdownMenuItem
                                data-tour-id="parts-inventory-delete"
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
        </TabsContent>

        {/* ───────────────── BY LOCATION ───────────────── */}
        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle>By Location</CardTitle>
              <CardDescription>
                {partTotals.locations} locations · {partTotals.units} units in stock — browse what sits where
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search location, part name, OE number…"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="min-h-11 w-full text-base sm:max-w-sm sm:text-sm"
              />
              {loading ? (
                <p className="text-muted-foreground py-8">Loading...</p>
              ) : locationGroups.length === 0 ? (
                <p className="text-muted-foreground py-8">No locations match.</p>
              ) : (
                <div className="scrollbar-thick max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                  {locationGroups.map((g) => (
                    <div key={g.loc} className="rounded-lg border border-border/50">
                      <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/40 px-3 py-2">
                        <span className="font-mono text-sm font-semibold">{g.loc}</span>
                        <span className="text-xs text-muted-foreground">
                          {g.rows.length} part{g.rows.length === 1 ? "" : "s"} · {g.inStock} in stock
                          {g.used > 0 ? ` · ${g.used} used` : ""}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[480px] text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="px-3 py-1.5 font-medium">Part</th>
                              <th className="px-3 py-1.5 font-medium">OE Number</th>
                              <th className="px-3 py-1.5 text-right font-medium">In stock</th>
                              <th className="px-3 py-1.5 text-right font-medium">Used</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.rows.map(({ part, qty, used }) => (
                              <tr
                                key={`${g.loc}-${part.id}`}
                                className="cursor-pointer border-t border-border/40 hover:bg-muted/40"
                                onClick={() => setHistoryPart(part)}
                              >
                                <td className="px-3 py-1.5">{part.part_name}</td>
                                <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                                  {part.oe_number ?? "—"}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{qty}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                                  {used || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────────────── TOTALS ───────────────── */}
        <TabsContent value="totals">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[
                { label: "Distinct parts", value: partTotals.parts },
                { label: "Units in stock", value: partTotals.units },
                { label: "Locations", value: partTotals.locations },
                { label: "Used (taken)", value: partTotals.usedUnits },
                { label: "In stock", value: partTotals.inStock, tone: "text-green-600 dark:text-green-400" },
                { label: "Low stock", value: partTotals.low, tone: "text-amber-600 dark:text-amber-400" },
                { label: "Out of stock", value: partTotals.out, tone: "text-red-600 dark:text-red-400" },
                { label: "To reorder", value: partTotals.low + partTotals.out, tone: "text-amber-700 dark:text-amber-300" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone ?? ""}`}>
                      {s.value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By brand</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody>
                      {partTotals.byBrand.map(([brand, n]) => (
                        <tr key={brand} className="border-t border-border/40">
                          <td className="py-1.5">{brand}</td>
                          <td className="py-1.5 text-right tabular-nums">{n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Parts to reorder
                    <Badge variant="secondary" className="ml-2">{reorderList.length}</Badge>
                  </CardTitle>
                  <CardDescription>At or below their minimum quantity</CardDescription>
                </CardHeader>
                <CardContent>
                  {reorderList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing needs reordering. 🎉</p>
                  ) : (
                    <div className="scrollbar-thick max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="py-1.5 font-medium">Part</th>
                            <th className="py-1.5 font-medium">OE</th>
                            <th className="py-1.5 text-right font-medium">Qty</th>
                            <th className="py-1.5 text-right font-medium">Min</th>
                            <th className="py-1.5 font-medium">Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reorderList.map((p) => (
                            <tr
                              key={p.id}
                              className="cursor-pointer border-t border-border/40 hover:bg-muted/40"
                              onClick={() => setHistoryPart(p)}
                            >
                              <td className="py-1.5">{p.part_name}</td>
                              <td className="py-1.5 font-mono text-xs text-muted-foreground">
                                {formatOeShort(p.oe_number)}
                              </td>
                              <td className={`py-1.5 text-right tabular-nums ${quantityColor(p)}`}>
                                {p.quantity}
                              </td>
                              <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                                {p.min_quantity}
                              </td>
                              <td className="py-1.5 font-mono text-xs text-muted-foreground">
                                {parseZones(p.storage_zone)[0]?.loc ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

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
            <AlertDialogTitle>
              {canDeletePart ? "Delete part?" : "Request part deletion?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {canDeletePart
                ? `This will soft-delete "${deletePart?.part_name}". You can restore it later if needed.`
                : "This deletion requires owner approval. A request will be sent for review."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {/* Disabled until the profile/role has loaded — otherwise the
                delete-vs-request branch in handleDelete is decided on an
                unresolved role and silently does the wrong thing. */}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!profile}
            >
              {!profile
                ? "Checking permissions…"
                : canDeletePart
                  ? "Delete"
                  : "Send Request"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
