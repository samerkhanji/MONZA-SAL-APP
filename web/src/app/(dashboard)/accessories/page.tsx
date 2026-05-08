"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
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
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";
import { formatError } from "@/lib/error-messages";

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

type SaveState = "idle" | "saving" | "saved" | "error";

function rowToDb(r: AccessoryInventoryRow) {
  return {
    id: r.id,
    category: r.category,
    label: r.label,
    quantity: r.quantity,
    note: r.note,
    linked_plate: r.linked_plate,
  };
}

export default function AccessoriesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<AccessoryInventoryRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pendingDelete, setPendingDelete] = useState<AccessoryInventoryRow | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());

  // Load from Supabase. If empty + we have localStorage data from a prior
  // version of this page, migrate it once. Otherwise insert the seed list.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data, error } = await supabase
        .from("accessory_inventory")
        .select("*");
      if (cancelled) return;

      if (error) {
        toast.error(`Could not load accessories: ${formatError(error)}`);
        const local = loadFromStorage();
        setRows(local ?? cloneSeed());
        setHydrated(true);
        return;
      }

      const dbRows = (data ?? []) as AccessoryInventoryRow[];
      if (dbRows.length > 0) {
        setRows(dbRows);
        setHydrated(true);
        return;
      }

      // DB empty — bootstrap.
      const local = loadFromStorage();
      const bootstrap = local && local.length > 0 ? local : cloneSeed();
      const { error: insertError } = await supabase
        .from("accessory_inventory")
        .insert(bootstrap.map(rowToDb));
      if (cancelled) return;
      if (insertError) {
        toast.error(`Could not save accessories: ${formatError(insertError)}`);
        setRows(bootstrap);
      } else {
        if (local && local.length > 0) {
          toast.success("Migrated this device's accessories to the server");
          try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          } catch {
            // ignore
          }
        }
        setRows(bootstrap);
      }
      setHydrated(true);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Debounced auto-save: 1s after the last edit, push dirty rows to Supabase.
  useEffect(() => {
    if (!hydrated || dirtyIdsRef.current.size === 0) return;
    const timer = setTimeout(async () => {
      const dirtyIds = Array.from(dirtyIdsRef.current);
      dirtyIdsRef.current = new Set();
      const dirtyRows = rows.filter((r) => dirtyIds.includes(r.id));
      if (dirtyRows.length === 0) return;
      setSaveState("saving");
      const { error } = await supabase
        .from("accessory_inventory")
        .upsert(dirtyRows.map(rowToDb));
      if (error) {
        setSaveState("error");
        toast.error(`Could not save changes: ${formatError(error)}`);
        // Re-mark as dirty so a later edit retries.
        dirtyIds.forEach((id) => dirtyIdsRef.current.add(id));
      } else {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [rows, hydrated, supabase]);

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

  const patchRow = useCallback(
    (id: string, patch: Partial<AccessoryInventoryRow>) => {
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
      dirtyIdsRef.current.add(id);
    },
    []
  );

  const deleteRow = useCallback(
    async (id: string) => {
      const removed = rows.find((r) => r.id === id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      const { error } = await supabase.from("accessory_inventory").delete().eq("id", id);
      if (error) {
        toast.error(`Could not delete: ${formatError(error)}`);
        if (removed) setRows((prev) => [...prev, removed]);
        return;
      }
      toast.success("Row removed");
    },
    [rows, supabase]
  );

  const addRow = useCallback(
    async (category: AccessoryCategoryId) => {
      const { data, error } = await supabase
        .from("accessory_inventory")
        .insert({
          category,
          label: "",
          quantity: 1,
          note: "",
          linked_plate: null,
        })
        .select("*")
        .single();
      if (error || !data) {
        toast.error(`Could not add row: ${error?.message ?? "unknown error"}`);
        return;
      }
      setRows((prev) => [...prev, data as AccessoryInventoryRow]);
      toast.success("Line added");
    },
    [supabase]
  );

  const resetToSeed = useCallback(async () => {
    const seed = cloneSeed();
    // Wipe and re-insert in two steps. Use a never-matching uuid filter to
    // satisfy Supabase's "DELETE without filter" guard.
    const { error: delError } = await supabase
      .from("accessory_inventory")
      .delete()
      .gte("created_at", "1970-01-01");
    if (delError) {
      toast.error(`Reset failed: ${formatError(delError)}`);
      return;
    }
    const { data, error: insError } = await supabase
      .from("accessory_inventory")
      .insert(seed.map(rowToDb))
      .select("*");
    if (insError) {
      toast.error(`Reset failed: ${formatError(insError)}`);
      return;
    }
    setRows((data ?? []) as AccessoryInventoryRow[]);
    dirtyIdsRef.current = new Set();
    toast.success("Reset to seed data");
  }, [supabase]);

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
            Standard lists below are saved to the server — every device sees the same data.
            Changes save automatically about a second after you stop typing.{" "}
            <strong>Custom collections</strong> at the bottom are also synced; staff can
            create them and edit lines; only owners can rename or delete a collection.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-live="polite"
            className={cn(
              "text-xs tabular-nums",
              saveState === "saving" && "text-amber-600 dark:text-amber-400",
              saveState === "saved" && "text-emerald-600 dark:text-emerald-400",
              saveState === "error" && "text-destructive",
              saveState === "idle" && "text-transparent select-none"
            )}
          >
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved"}
            {saveState === "error" && "Save failed"}
            {saveState === "idle" && "—"}
          </span>
          <ExportButton
            data={filtered.map((r) => ({
              category:
                ACCESSORY_CATEGORIES.find((c) => c.id === r.category)?.label ?? r.category,
              label: r.label,
              quantity: r.quantity,
              note: r.note,
              linked_plate: r.linked_plate ?? "",
            }))}
            allData={rows.map((r) => ({
              category:
                ACCESSORY_CATEGORIES.find((c) => c.id === r.category)?.label ?? r.category,
              label: r.label,
              quantity: r.quantity,
              note: r.note,
              linked_plate: r.linked_plate ?? "",
            }))}
            columns={[
              { key: "category", header: "Category" },
              { key: "label", header: "Label" },
              { key: "quantity", header: "Quantity", type: "number" },
              { key: "note", header: "Note" },
              { key: "linked_plate", header: "Linked plate" },
            ] satisfies ExportColumn[]}
            filename="Accessories"
            options={{ pageName: "Accessories", summary: `Total quantity: ${grandTotalQty}` }}
            disabled={!hydrated}
          />
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
                                onClick={() => setPendingDelete(row)}
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

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this accessory?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This permanently removes "${pendingDelete.label || "(unlabeled)"}" from the accessory list. You can re-add it later, but the current count and notes will be lost.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  void deleteRow(pendingDelete.id);
                  setPendingDelete(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
