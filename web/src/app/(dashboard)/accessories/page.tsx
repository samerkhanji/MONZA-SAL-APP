"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ACCESSORY_SEED_ROWS } from "@/lib/data/accessory-seed";
import {
  ACCESSORY_CATEGORIES,
  type AccessoryCategory,
  type AccessoryCategoryId,
  type AccessoryInventoryRow,
} from "@/types/accessories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomAccessoryCollections } from "@/components/accessories/CustomAccessoryCollections";

const STORAGE_KEY = "monza-crm-accessories-inventory-v2";
const LEGACY_STORAGE_KEY = "monza-crm-accessories-inventory-v1";

function cloneSeed(): AccessoryInventoryRow[] {
  return ACCESSORY_SEED_ROWS.map((r) => ({ ...r }));
}

const CATEGORY_SET = new Set<string>(ACCESSORY_CATEGORIES.map((c) => c.id));

function isValidStoredRow(x: unknown): x is AccessoryInventoryRow {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  const linkedOk = o.linked_plate === null || typeof o.linked_plate === "string";
  return (
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    typeof o.quantity === "number" &&
    Number.isFinite(o.quantity) &&
    typeof o.note === "string" &&
    linkedOk &&
    typeof o.created_at === "string" &&
    typeof o.updated_at === "string" &&
    typeof o.category === "string" &&
    CATEGORY_SET.has(o.category)
  );
}

/** Migrate rows saved with the previous shape (name, notes, linked_plate_or_car, sort_order). */
function migrateLegacyRow(o: unknown): AccessoryInventoryRow | null {
  if (typeof o !== "object" || o === null) return null;
  const r = o as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.category !== "string" || !CATEGORY_SET.has(r.category)) {
    return null;
  }
  if (typeof r.name !== "string" || typeof r.quantity !== "number" || !Number.isFinite(r.quantity)) {
    return null;
  }
  const now = new Date().toISOString();
  const category = r.category as AccessoryCategory;
  const notes = typeof r.notes === "string" ? r.notes : "";
  let linked: string | null =
    typeof r.linked_plate_or_car === "string" && r.linked_plate_or_car.trim()
      ? r.linked_plate_or_car.trim()
      : null;
  if (category === "plates") {
    linked = r.name.trim() || null;
  }
  return {
    id: r.id,
    category,
    label: r.name,
    quantity: r.quantity,
    note: notes,
    linked_plate: linked,
    created_at: now,
    updated_at: now,
  };
}

function loadFromStorage(): AccessoryInventoryRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidStoredRow)) {
        return parsed;
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      const migrated = parsed.map(migrateLegacyRow).filter((x): x is AccessoryInventoryRow => x !== null);
      if (migrated.length === parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function matchesSearch(row: AccessoryInventoryRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const plate = row.linked_plate ?? "";
  return (
    row.label.toLowerCase().includes(s) ||
    row.note.toLowerCase().includes(s) ||
    plate.toLowerCase().includes(s) ||
    String(row.quantity).includes(s)
  );
}

function newRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AccessoriesPage() {
  const [rows, setRows] = useState<AccessoryInventoryRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const stored = loadFromStorage();
    setRows(stored ?? cloneSeed());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      toast.error("Could not save accessories to browser storage.");
    }
  }, [rows, hydrated]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => matchesSearch(r, q));
  }, [rows, search]);

  const stats = useMemo(() => {
    return ACCESSORY_CATEGORIES.map((cat) => {
      const catRows = filtered.filter((r) => r.category === cat.id);
      const qtySum = catRows.reduce((acc, r) => acc + (Number.isFinite(r.quantity) ? r.quantity : 0), 0);
      return {
        ...cat,
        lineCount: catRows.length,
        qtySum,
      };
    });
  }, [filtered]);

  const grandTotalQty = useMemo(
    () => filtered.reduce((acc, r) => acc + (Number.isFinite(r.quantity) ? r.quantity : 0), 0),
    [filtered]
  );

  const patchRow = useCallback((id: string, patch: Partial<AccessoryInventoryRow>) => {
    const now = new Date().toISOString();
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next: AccessoryInventoryRow = { ...r, ...patch, updated_at: now };
        if (patch.created_at === undefined) next.created_at = r.created_at;
        if (next.category === "plates" && patch.label !== undefined) {
          const trimmed = String(patch.label).trim();
          next.linked_plate = trimmed || null;
        }
        if (patch.linked_plate !== undefined) {
          const v = patch.linked_plate;
          next.linked_plate = typeof v === "string" && v.trim() === "" ? null : v;
        }
        return next;
      })
    );
  }, []);

  const deleteRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Row removed");
  }, []);

  const addRow = useCallback((category: AccessoryCategoryId) => {
    const now = new Date().toISOString();
    const row: AccessoryInventoryRow = {
      id: newRowId(),
      category,
      label: "",
      quantity: 1,
      note: "",
      linked_plate: null,
      created_at: now,
      updated_at: now,
    };
    setRows((prev) => [...prev, row]);
    toast.success("Line added");
  }, []);

  const resetToSeed = useCallback(() => {
    setRows(cloneSeed());
    toast.success("Reset to seed data");
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading accessories…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 pb-24 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Accessories</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Standard lists below are stored in this browser until you wire{" "}
            <code className="rounded bg-muted px-1 text-xs">033_accessory_inventory</code>.{" "}
            <strong>Custom collections</strong> at the bottom live in Supabase (
            <code className="rounded bg-muted px-1 text-xs">035_accessory_custom_tables</code>) — staff
            can create them and edit lines; only owners can rename or delete a collection.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <RotateCcw className="size-4" />
                Reset to seed
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all accessories?</AlertDialogTitle>
                <AlertDialogDescription>
                  This replaces your current table with the original seed list. Local changes in this
                  browser will be lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetToSeed}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search label, note, linked plate, quantity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-background/80 border-border/80 h-11 pl-10 shadow-sm backdrop-blur-sm"
          aria-label="Search accessories"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card
            key={s.id}
            className={cn(
              "border-border/60 bg-card/50 shadow-sm backdrop-blur-sm transition-colors",
              s.lineCount === 0 && search.trim() !== "" && "opacity-60"
            )}
          >
            <CardHeader className="space-y-1 pb-2 pt-4">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                {s.label}
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">{s.qtySum}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground pb-4 pt-0 text-xs">
              {s.lineCount} line{s.lineCount === 1 ? "" : "s"}
              {search.trim() !== "" ? " (filtered)" : ""}
            </CardContent>
          </Card>
        ))}
        <Card className="border-primary/20 bg-primary/5 border-border/60 shadow-sm backdrop-blur-sm sm:col-span-2 lg:col-span-1 xl:col-span-1">
          <CardHeader className="space-y-1 pb-2 pt-4">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">All (filtered)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{grandTotalQty}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground pb-4 pt-0 text-xs">
            Sum of quantities · {filtered.length} lines
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {ACCESSORY_CATEGORIES.map((cat) => {
          const catRows = filtered
            .filter((r) => r.category === cat.id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));

          return (
            <Card key={cat.id} className="border-border/70 overflow-hidden shadow-sm">
              <CardHeader className="border-border/60 bg-muted/30 flex flex-row flex-wrap items-center justify-between gap-3 border-b py-4">
                <div>
                  <CardTitle className="text-lg">{cat.label}</CardTitle>
                  <CardDescription>
                    {rows.filter((r) => r.category === cat.id).length} lines total
                    {search.trim() && catRows.length !== rows.filter((r) => r.category === cat.id).length
                      ? ` · ${catRows.length} match search`
                      : ""}
                  </CardDescription>
                </div>
                <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => addRow(cat.id)}>
                  <Plus className="size-4" />
                  Add line
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="min-w-[200px] pl-6">Label</TableHead>
                        <TableHead className="w-[100px]">Qty</TableHead>
                        <TableHead className="min-w-[180px]">Note</TableHead>
                        <TableHead className="min-w-[160px]">Linked plate</TableHead>
                        <TableHead className="w-[72px] pr-6 text-right"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                            {search.trim() ? "No rows match your search in this section." : "No rows yet."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        catRows.map((row) => (
                          <TableRow key={row.id} className="group">
                            <TableCell className="pl-6 align-top">
                              <Input
                                value={row.label}
                                onChange={(e) => patchRow(row.id, { label: e.target.value })}
                                placeholder="Label"
                                className="bg-background/80 h-9 max-w-md border-transparent shadow-none focus-visible:border-input"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={1}
                                value={Number.isFinite(row.quantity) ? row.quantity : 0}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  patchRow(row.id, { quantity: Number.isFinite(v) ? v : 0 });
                                }}
                                className="bg-background/80 h-9 w-full min-w-[4.5rem] border-transparent shadow-none focus-visible:border-input"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.note}
                                onChange={(e) => patchRow(row.id, { note: e.target.value })}
                                placeholder="Optional"
                                className="bg-background/80 h-9 max-w-xl border-transparent shadow-none focus-visible:border-input"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={row.linked_plate ?? ""}
                                onChange={(e) =>
                                  patchRow(row.id, {
                                    linked_plate: e.target.value.trim() === "" ? null : e.target.value,
                                  })
                                }
                                placeholder={cat.id === "plates" ? "Same as label" : "Optional"}
                                disabled={cat.id === "plates"}
                                title={cat.id === "plates" ? "Kept in sync with label for plates" : undefined}
                                className="bg-background/80 h-9 max-w-xs border-transparent shadow-none focus-visible:border-input disabled:opacity-80"
                              />
                            </TableCell>
                            <TableCell className="pr-6 text-right align-top">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive size-9 opacity-70 group-hover:opacity-100"
                                onClick={() => deleteRow(row.id)}
                                aria-label="Remove row"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <hr className="border-border" />

      <CustomAccessoryCollections />
    </div>
  );
}
