"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { formatError } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Siren } from "lucide-react";

interface RecalledCar {
  id: string;
  vin: string;
  brand: string;
  model: string;
  model_year: number | null;
  exterior_color: string | null;
  status: string;
  customer_id: string | null;
  recalled_at: string;
  recall_reason: string | null;
  recall_notes: string | null;
}

const REASON_BUCKETS = [
  { id: "all", label: "All" },
  { id: "shipping", label: "Shipping" },
  { id: "issue", label: "Issues" },
] as const;
type Bucket = (typeof REASON_BUCKETS)[number]["id"];

function reasonLabel(reason: string | null): string {
  if (reason === "shipping") return "Shipping";
  if (reason === "issue") return "Issue with the car";
  return "—";
}

export default function RecallCenterPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { canEditInventory } = useUser();

  const [cars, setCars] = useState<RecalledCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [query, setQuery] = useState("");
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [clearTarget, setClearTarget] = useState<RecalledCar | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cars")
      .select(
        "id, vin, brand, model, model_year, exterior_color, status, customer_id, recalled_at, recall_reason, recall_notes"
      )
      .not("recalled_at", "is", null)
      .is("deleted_at", null)
      .order("recalled_at", { ascending: false })
      .limit(5000);
    if (error) {
      toast.error(formatError(error));
      setCars([]);
    } else {
      setCars((data as RecalledCar[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let r = cars;
    if (bucket !== "all") r = r.filter((c) => c.recall_reason === bucket);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (c) =>
          c.vin.toLowerCase().includes(q) ||
          c.brand.toLowerCase().includes(q) ||
          c.model.toLowerCase().includes(q) ||
          (c.recall_notes ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [cars, bucket, query]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    cars.forEach((c) => {
      if (c.recall_reason) m[c.recall_reason] = (m[c.recall_reason] ?? 0) + 1;
    });
    return m;
  }, [cars]);

  async function handleClear(car: RecalledCar) {
    if (!canEditInventory) return;
    setClearingId(car.id);
    const { error } = await supabase
      .from("cars")
      .update({ recalled_at: null, recall_reason: null, recall_notes: null })
      .eq("id", car.id);
    setClearingId(null);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Recall cleared");
    setCars((prev) => prev.filter((c) => c.id !== car.id));
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Siren className="size-6" />
          Recall Center
        </h1>
        <p className="text-muted-foreground text-sm">
          Cars recalled to the manufacturer (Voyah) for shipping or vehicle
          issues.
        </p>
      </div>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
        <TabsList className="flex h-auto flex-wrap">
          {REASON_BUCKETS.map((b) => (
            <TabsTrigger key={b.id} value={b.id} className="text-xs">
              {b.label}
              {b.id !== "all" && (counts[b.id] ?? 0) > 0 && (
                <Badge variant="outline" className="ml-2 h-4 px-1.5 text-[10px]">
                  {counts[b.id]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search by VIN, brand, model, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {cars.length === 0
                ? "No cars are currently recalled to Voyah."
                : "No recalled cars match the filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">VIN</th>
                    <th className="px-3 py-2">Vehicle</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Notes</th>
                    <th className="px-3 py-2">Recalled</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td
                        className="cursor-pointer px-3 py-2 font-mono"
                        onClick={() =>
                          router.push(`/cars/${encodeURIComponent(c.vin)}`)
                        }
                      >
                        {c.vin}
                      </td>
                      <td className="px-3 py-2">
                        {c.brand} {c.model}
                        {c.model_year ? ` (${c.model_year})` : ""}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={
                            c.recall_reason === "issue"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }
                        >
                          {reasonLabel(c.recall_reason)}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground max-w-[20rem] px-3 py-2">
                        {c.recall_notes || "—"}
                      </td>
                      <td className="text-muted-foreground px-3 py-2">
                        {new Date(c.recalled_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              router.push(`/cars/${encodeURIComponent(c.vin)}`)
                            }
                          >
                            Open
                          </Button>
                          {canEditInventory && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              disabled={clearingId === c.id}
                              onClick={() => setClearTarget(c)}
                            >
                              {clearingId === c.id ? "Clearing…" : "Clear recall"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={clearTarget !== null}
        onOpenChange={(open) => !open && setClearTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear recall?</AlertDialogTitle>
            <AlertDialogDescription>
              {clearTarget
                ? `The recall on VIN ${clearTarget.vin} will be cleared and the car removed from this list.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (clearTarget) {
                  void handleClear(clearTarget);
                  setClearTarget(null);
                }
              }}
            >
              Clear recall
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
