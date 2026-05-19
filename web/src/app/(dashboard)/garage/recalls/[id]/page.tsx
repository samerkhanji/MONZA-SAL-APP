"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Search } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

interface Recall {
  id: string;
  recall_number: string;
  title: string;
  description: string | null;
  manufacturer: string | null;
  affected_models: string[] | null;
  model_year_min: number | null;
  model_year_max: number | null;
  required_parts: string | null;
  estimated_labor_hours: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

interface RecallVehicle {
  id: string;
  recall_id: string;
  car_id: string;
  status: string;
  notified_at: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

interface CarLite {
  id: string;
  vin: string | null;
  model: string | null;
  model_year: number | null;
  customer_id: string | null;
}

const VEHICLE_STATUSES = ["pending","customer_notified","scheduled","in_progress","completed","not_applicable","customer_refused"];

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-foreground",
  customer_notified: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  scheduled: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  in_progress: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  not_applicable: "bg-muted text-foreground",
  customer_refused: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default function RecallDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const supabase = createClient();
  const { isOwner, hasCapability } = useUser();
  const canWrite = isOwner || hasCapability("garage");

  const [recall, setRecall] = useState<Recall | null>(null);
  const [vehicles, setVehicles] = useState<RecallVehicle[]>([]);
  const [carById, setCarById] = useState<Map<string, CarLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, v] = await Promise.all([
      supabase.from("recalls").select("*").eq("id", id).single(),
      supabase.from("recall_vehicles").select("*").eq("recall_id", id),
    ]);
    if (r.error) {
      toast.error(formatError(r.error));
      setLoading(false);
      return;
    }
    setRecall(r.data as Recall);
    setVehicles((v.data as RecallVehicle[]) ?? []);
    const carIds = ((v.data as RecallVehicle[]) ?? []).map((x) => x.car_id);
    if (carIds.length) {
      const { data: cars } = await supabase
        .from("cars")
        .select("id, vin, model, model_year, customer_id")
        .in("id", carIds);
      const m = new Map<string, CarLite>();
      ((cars as CarLite[]) ?? []).forEach((c) => m.set(c.id, c));
      setCarById(m);
    } else {
      setCarById(new Map());
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const total = vehicles.length;
    const completed = vehicles.filter((v) => v.status === "completed" || v.status === "not_applicable").length;
    return { total, completed };
  }, [vehicles]);

  async function changeVehicleStatus(vid: string, status: string) {
    const { error } = await supabase.rpc("mark_recall_vehicle", {
      p_recall_vehicle_id: vid,
      p_status: status,
    });
    if (error) return toast.error(formatError(error));
    void load();
  }

  async function changeRecallStatus(next: string) {
    if (!recall) return;
    const { error } = await supabase.rpc("set_recall_status", {
      p_recall_id: recall.id,
      p_status: next,
    });
    if (error) return toast.error(formatError(error));
    toast.success(`Recall ${next}`);
    void load();
  }

  if (loading) {
    return (
      <div className="container space-y-3 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!recall) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        Recall not found.
        <div className="mt-3">
          <Button variant="link" asChild>
            <Link href="/garage/recalls"><ArrowLeft className="mr-1 size-3" /> Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/garage/recalls" className="text-muted-foreground inline-flex items-center text-xs hover:underline">
            <ArrowLeft className="mr-1 size-3" /> Recalls
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-semibold">{recall.recall_number}</h1>
          <p className="text-muted-foreground">{recall.title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-6 px-2 text-[11px] uppercase">{recall.status}</Badge>
          {canWrite && (
            <Select value={recall.status} onValueChange={(v) => void changeRecallStatus(v)}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Manufacturer</Label>
            <p>{recall.manufacturer ?? "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Affected models</Label>
            <p>{(recall.affected_models ?? []).join(", ") || "—"}
              {recall.model_year_min && (
                <span className="text-muted-foreground"> ({recall.model_year_min}{recall.model_year_max && recall.model_year_max !== recall.model_year_min ? `–${recall.model_year_max}` : ""})</span>
              )}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Required parts</Label>
            <p>{recall.required_parts ?? "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Estimated labor</Label>
            <p>{recall.estimated_labor_hours != null ? `${recall.estimated_labor_hours} h` : "—"}</p>
          </div>
          {recall.description && (
            <div className="sm:col-span-2">
              <Label className="text-muted-foreground text-xs uppercase">Description</Label>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{recall.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Affected vehicles
              <span className="text-muted-foreground ml-2 text-xs font-normal">
                {stats.completed}/{stats.total} done ({stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%)
              </span>
            </h2>
            {canWrite && (
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                Assign vehicles
              </Button>
            )}
          </div>
          {vehicles.length === 0 ? (
            <p className="text-muted-foreground text-sm">No vehicles assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1.5">VIN</th>
                    <th className="py-1.5">Vehicle</th>
                    <th className="py-1.5">Status</th>
                    <th className="py-1.5">Completed</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {vehicles.map((rv) => {
                    const c = carById.get(rv.car_id);
                    return (
                      <tr key={rv.id}>
                        <td className="py-1.5 font-mono text-xs">
                          {c?.id ? (
                            <Link href={`/cars/${c.id}`} className="hover:underline">{c.vin ?? "—"}</Link>
                          ) : (c?.vin ?? "—")}
                        </td>
                        <td className="py-1.5 text-muted-foreground text-xs">
                          {[c?.model_year, c?.model].filter(Boolean).join(" ")}
                        </td>
                        <td className="py-1.5">
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] uppercase", STATUS_COLOR[rv.status] ?? "")}>
                            {rv.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-muted-foreground text-xs">
                          {rv.completed_at ? new Date(rv.completed_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-1.5 text-right">
                          {canWrite && (
                            <Select value={rv.status} onValueChange={(v) => void changeVehicleStatus(rv.id, v)}>
                              <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {VEHICLE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AssignVehiclesDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        recallId={recall.id}
        affectedModels={recall.affected_models ?? []}
        yearMin={recall.model_year_min}
        yearMax={recall.model_year_max}
        existingCarIds={new Set(vehicles.map((v) => v.car_id))}
        onAssigned={() => {
          setAssignOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function AssignVehiclesDialog({
  open,
  onClose,
  recallId,
  affectedModels,
  yearMin,
  yearMax,
  existingCarIds,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  recallId: string;
  affectedModels: string[];
  yearMin: number | null;
  yearMax: number | null;
  existingCarIds: Set<string>;
  onAssigned: () => void;
}) {
  const supabase = createClient();
  const [cars, setCars] = useState<CarLite[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    setQuery("");
    void (async () => {
      let q = supabase.from("cars").select("id, vin, model, model_year, customer_id").limit(5000);
      if (affectedModels.length) q = q.in("model", affectedModels);
      if (yearMin != null) q = q.gte("model_year", yearMin);
      if (yearMax != null) q = q.lte("model_year", yearMax);
      const { data } = await q;
      setCars(((data as CarLite[]) ?? []).filter((c) => !existingCarIds.has(c.id)));
    })();
  }, [open, supabase, affectedModels, yearMin, yearMax, existingCarIds]);

  const visible = useMemo(() => {
    const qq = query.trim().toLowerCase();
    if (!qq) return cars;
    return cars.filter((c) =>
      (c.vin ?? "").toLowerCase().includes(qq) ||
      (c.model ?? "").toLowerCase().includes(qq)
    );
  }, [cars, query]);

  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  function selectAllVisible() {
    const next = new Set(picked);
    visible.forEach((c) => next.add(c.id));
    setPicked(next);
  }

  async function submit() {
    if (picked.size === 0) return toast.error("Pick at least one vehicle");
    setSubmitting(true);
    const { data, error } = await supabase.rpc("assign_recall_vehicles", {
      p_recall_id: recallId,
      p_car_ids: Array.from(picked),
    });
    setSubmitting(false);
    if (error) return toast.error(formatError(error));
    toast.success(`${data} vehicle${(data as number) === 1 ? "" : "s"} added`);
    onAssigned();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign vehicles to this recall</DialogTitle>
          <DialogDescription>
            Pre-filtered by the recall&apos;s affected models and year range.
            Already-assigned VINs are hidden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              className="h-9 pl-10"
              placeholder="Filter by VIN or model"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>{visible.length} candidate{visible.length === 1 ? "" : "s"} — {picked.size} selected</span>
            <Button variant="link" size="sm" onClick={selectAllVisible}>Select all visible</Button>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-md border">
            {visible.length === 0 ? (
              <p className="text-muted-foreground p-4 text-center text-sm">
                {cars.length === 0 ? "No matching cars in inventory." : "Nothing matches the filter."}
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <tbody className="divide-border divide-y">
                  {visible.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-muted/40 cursor-pointer"
                      onClick={() => toggle(c.id)}
                    >
                      <td className="w-8 px-3 py-1.5">
                        <Checkbox checked={picked.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs">{c.vin ?? "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground text-xs">
                        {[c.model_year, c.model].filter(Boolean).join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || picked.size === 0}>
            {submitting ? "Adding…" : `Add ${picked.size || ""} vehicle${picked.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
