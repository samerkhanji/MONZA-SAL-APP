"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { AlertTriangle, Plus, Search } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

interface Recall {
  id: string;
  recall_number: string;
  title: string;
  status: string;
  affected_models: string[] | null;
  model_year_min: number | null;
  model_year_max: number | null;
  opened_at: string;
}

interface RecallVehicleAgg {
  recall_id: string;
  total: number;
  completed: number;
}

const STATUS_BUCKETS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "active", label: "Active" },
  { id: "closed", label: "Closed" },
  { id: "cancelled", label: "Cancelled" },
] as const;
type Bucket = (typeof STATUS_BUCKETS)[number]["id"];

const STATUS_COLOR: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  active: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  closed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-muted text-foreground",
};

export default function RecallsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isOwner, hasCapability } = useUser();
  const canRead = isOwner || hasCapability("garage") || hasCapability("view_reports") || hasCapability("manage_team");
  const canWrite = isOwner || hasCapability("garage");

  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [agg, setAgg] = useState<Map<string, RecallVehicleAgg>>(new Map());
  const [loading, setLoading] = useState(true);
  // Only show skeletons if loading runs longer than a beat, so a fast fetch
  // resolves straight to the list/empty state instead of a jarring flash.
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const [r, v] = await Promise.all([
        supabase
          .from("recalls")
          .select("id, recall_number, title, status, affected_models, model_year_min, model_year_max, opened_at")
          .is("deleted_at", null)
          .order("opened_at", { ascending: false })
          .limit(5000),
        supabase.from("recall_vehicles").select("recall_id, status"),
      ]);
      if (r.error) toast.error(formatError(r.error));
      else setRecalls((r.data as Recall[]) ?? []);
      if (!v.error) {
        const m = new Map<string, RecallVehicleAgg>();
        ((v.data as Array<{ recall_id: string; status: string }>) ?? []).forEach((row) => {
          if (!m.has(row.recall_id)) m.set(row.recall_id, { recall_id: row.recall_id, total: 0, completed: 0 });
          const x = m.get(row.recall_id)!;
          x.total += 1;
          if (row.status === "completed" || row.status === "not_applicable") x.completed += 1;
        });
        setAgg(m);
      }
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setLoading(false); // never strand on the spinner
    }
  }, [canRead, supabase]);

  useEffect(() => { void load(); }, [load]);

  // Delay the skeleton so a quick fetch doesn't flash it before the empty state.
  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }
    const t = window.setTimeout(() => setShowSkeleton(true), 250);
    return () => window.clearTimeout(t);
  }, [loading]);

  const filtered = useMemo(() => {
    let r = recalls;
    if (bucket !== "all") r = r.filter((x) => x.status === bucket);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((x) =>
        x.recall_number.toLowerCase().includes(q) ||
        x.title.toLowerCase().includes(q) ||
        (x.affected_models ?? []).join(",").toLowerCase().includes(q)
      );
    }
    return r;
  }, [recalls, bucket, query]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    recalls.forEach((x) => (m[x.status] = (m[x.status] ?? 0) + 1));
    return m;
  }, [recalls]);

  if (!canRead) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <AlertTriangle className="mx-auto mb-3 size-6" />
        <p>You don&apos;t have access to recalls.</p>
        <Button variant="link" asChild><Link href="/">Back to dashboard</Link></Button>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Recalls</h1>
          <p className="text-muted-foreground text-sm">
            Manufacturer recall campaigns. Assign affected VINs and track each
            one to completion.
          </p>
        </div>
        {canWrite && (
          <Button data-tour-id="recalls-new" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" /> New recall
          </Button>
        )}
      </div>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
        <TabsList data-tour-id="recalls-status-tabs" className="flex h-auto flex-wrap">
          {STATUS_BUCKETS.map((b) => (
            <TabsTrigger key={b.id} value={b.id} className="text-xs">
              {b.label}
              {b.id !== "all" && counts[b.id] > 0 && (
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
          data-tour-id="recalls-search"
          placeholder="Search by recall number, title, model…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      <Card data-tour-id="recalls-table">
        <CardContent className="p-0">
          {showSkeleton ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : loading ? (
            <div className="p-8" />
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {recalls.length === 0 ? "No recalls yet." : "No recalls match the filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Number</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Models / years</th>
                    <th className="px-3 py-2 text-right">Progress</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((x) => {
                    const a = agg.get(x.id);
                    return (
                      <tr
                        key={x.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/garage/recalls/${x.id}`)}
                      >
                        <td className="px-3 py-2 font-mono">{x.recall_number}</td>
                        <td className="px-3 py-2">{x.title}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {(x.affected_models ?? []).join(", ") || "—"}
                          {x.model_year_min && (
                            <span> ({x.model_year_min}{x.model_year_max && x.model_year_max !== x.model_year_min ? `–${x.model_year_max}` : ""})</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-xs">
                          {a ? (
                            <>
                              <span className="tabular-nums">{a.completed}/{a.total}</span>
                              <span className="text-muted-foreground"> ({a.total ? Math.round((a.completed / a.total) * 100) : 0}%)</span>
                            </>
                          ) : "0/0"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] uppercase", STATUS_COLOR[x.status] ?? "")}>
                            {x.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(x.opened_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRecallDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          void load();
          router.push(`/garage/recalls/${id}`);
        }}
      />
    </div>
  );
}

function CreateRecallDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [manufacturer, setManufacturer] = useState("Dongfeng");
  const [models, setModels] = useState("");
  const [yMin, setYMin] = useState("");
  const [yMax, setYMax] = useState("");
  const [requiredParts, setRequiredParts] = useState("");
  const [labor, setLabor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setManufacturer("Dongfeng");
    setModels("");
    setYMin("");
    setYMax("");
    setRequiredParts("");
    setLabor("");
  }, [open]);

  async function submit() {
    if (!title.trim()) return toast.error("Title is required");
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id ?? null;
    const { data: numRpc } = await supabase.rpc("generate_recall_number");
    const recallNumber = (numRpc as string) ?? `RCL-${Date.now()}`;
    const modelArray = models
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const { data, error } = await supabase
      .from("recalls")
      .insert({
        recall_number: recallNumber,
        title: title.trim(),
        description: description.trim() || null,
        manufacturer: manufacturer.trim() || null,
        affected_models: modelArray.length ? modelArray : null,
        model_year_min: yMin ? Number(yMin) : null,
        model_year_max: yMax ? Number(yMax) : null,
        required_parts: requiredParts.trim() || null,
        estimated_labor_hours: labor ? Number(labor) : null,
        status: "open",
        created_by: uid,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) return toast.error(formatError(error));
    toast.success(`Recall ${recallNumber} created`);
    onCreated((data as { id: string }).id);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-tour-id="recalls-new-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>New recall</DialogTitle>
          <DialogDescription>
            Assign affected VINs on the next screen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Voyah Free brake-line inspection 2025-03" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Manufacturer</Label>
              <Select value={manufacturer} onValueChange={setManufacturer}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dongfeng">Dongfeng</SelectItem>
                  <SelectItem value="Voyah">Voyah</SelectItem>
                  <SelectItem value="MHERO">MHERO</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Affected models (comma-separated)</Label>
              <Input value={models} onChange={(e) => setModels(e.target.value)} placeholder="Free, Dreamer" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Year from</Label>
              <Input type="number" value={yMin} onChange={(e) => setYMin(e.target.value)} placeholder="2024" />
            </div>
            <div className="space-y-1">
              <Label>Year to</Label>
              <Input type="number" value={yMax} onChange={(e) => setYMax(e.target.value)} placeholder="2025" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Required parts (free text)</Label>
            <Input value={requiredParts} onChange={(e) => setRequiredParts(e.target.value)} placeholder="Brake line kit, gaskets" />
          </div>
          <div className="space-y-1">
            <Label>Estimated labor hours</Label>
            <Input type="number" step="0.25" value={labor} onChange={(e) => setLabor(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !title.trim()}>
            {submitting ? "Creating…" : "Create recall"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
