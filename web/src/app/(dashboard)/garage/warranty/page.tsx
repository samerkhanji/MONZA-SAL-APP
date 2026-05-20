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

interface Row {
  id: string;
  case_number: string;
  car_id: string;
  customer_id: string | null;
  job_id: string | null;
  kind: string;
  severity: string;
  status: string;
  summary: string;
  opened_at: string;
}

interface CarLite {
  id: string;
  vin: string | null;
  model: string | null;
  model_year: number | null;
}

interface CustomerLite { id: string; full_name?: string | null; name?: string | null; }

const STATUS_BUCKETS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "investigating", label: "Investigating" },
  { id: "awaiting_parts", label: "Awaiting parts" },
  { id: "in_repair", label: "In repair" },
  { id: "completed", label: "Completed" },
  { id: "rejected", label: "Rejected/Cancelled" },
] as const;
type Bucket = (typeof STATUS_BUCKETS)[number]["id"];

const STATUS_COLOR: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  investigating: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  awaiting_parts: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  in_repair: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-muted text-foreground",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-muted text-foreground",
  normal: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default function WarrantyPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isOwner, hasCapability } = useUser();
  const canRead = isOwner || hasCapability("garage") || hasCapability("view_reports") || hasCapability("manage_team");
  const canWrite = isOwner || hasCapability("garage");

  const [rows, setRows] = useState<Row[]>([]);
  const [cars, setCars] = useState<Map<string, CarLite>>(new Map());
  const [customers, setCustomers] = useState<Map<string, CustomerLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    const [w, c, cu] = await Promise.all([
      supabase
        .from("warranty_cases")
        .select("id, case_number, car_id, customer_id, job_id, kind, severity, status, summary, opened_at")
        .is("deleted_at", null)
        .order("opened_at", { ascending: false })
        .limit(500),
      supabase.from("cars").select("id, vin, model, model_year").limit(5000),
      supabase.from("customers").select("id, full_name, name").limit(5000),
    ]);
    if (w.error) toast.error(formatError(w.error));
    else setRows((w.data as Row[]) ?? []);
    if (!c.error) {
      const m = new Map<string, CarLite>();
      ((c.data as CarLite[]) ?? []).forEach((x) => m.set(x.id, x));
      setCars(m);
    }
    if (!cu.error) {
      const m = new Map<string, CustomerLite>();
      ((cu.data as CustomerLite[]) ?? []).forEach((x) => m.set(x.id, x));
      setCustomers(m);
    }
    setLoading(false);
  }, [canRead, supabase]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    let r = rows;
    if (bucket === "rejected") r = r.filter((x) => x.status === "rejected" || x.status === "cancelled");
    else if (bucket !== "all") r = r.filter((x) => x.status === bucket);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((x) => {
        const c = cars.get(x.car_id);
        const cu = x.customer_id ? customers.get(x.customer_id) : null;
        return (
          x.case_number.toLowerCase().includes(q) ||
          x.summary.toLowerCase().includes(q) ||
          (c?.vin ?? "").toLowerCase().includes(q) ||
          (cu?.full_name ?? cu?.name ?? "").toLowerCase().includes(q)
        );
      });
    }
    return r;
  }, [rows, bucket, query, cars, customers]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((x) => (m[x.status] = (m[x.status] ?? 0) + 1));
    return m;
  }, [rows]);

  if (!canRead) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <AlertTriangle className="mx-auto mb-3 size-6" />
        <p>You don&apos;t have access to warranty cases.</p>
        <Button variant="link" asChild><Link href="/">Back to dashboard</Link></Button>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Warranty cases</h1>
          <p className="text-muted-foreground text-sm">
            Manufacturer, battery, recall, and dealer-goodwill cases. Each is
            linked to a VIN and optionally a customer and a garage job.
          </p>
        </div>
        {canWrite && (
          <Button data-tour-id="warranty-new-case" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" /> New case
          </Button>
        )}
      </div>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
        <TabsList data-tour-id="warranty-status-tabs" className="flex h-auto flex-wrap">
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
          data-tour-id="warranty-search"
          placeholder="Search by case number, VIN, customer, summary…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      <Card data-tour-id="warranty-table">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {rows.length === 0 ? "No warranty cases yet." : "No cases match the filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Case</th>
                    <th className="px-3 py-2">VIN / Vehicle</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((x) => {
                    const c = cars.get(x.car_id);
                    const cu = x.customer_id ? customers.get(x.customer_id) : null;
                    return (
                      <tr
                        key={x.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/garage/warranty/${x.id}`)}
                      >
                        <td className="px-3 py-2 font-mono">{x.case_number}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs">{c?.vin ?? "—"}</span>
                            <span className="text-muted-foreground text-xs">
                              {[c?.model_year, c?.model].filter(Boolean).join(" ")}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">{cu?.full_name ?? cu?.name ?? "—"}</td>
                        <td className="px-3 py-2 capitalize">{x.kind.replace("_", " ")}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] uppercase", SEVERITY_COLOR[x.severity] ?? "")}>
                            {x.severity}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] uppercase", STATUS_COLOR[x.status] ?? "")}>
                            {x.status.replace(/_/g, " ")}
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

      <CreateCaseDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          void load();
          router.push(`/garage/warranty/${id}`);
        }}
      />
    </div>
  );
}

function CreateCaseDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const supabase = createClient();
  const [cars, setCars] = useState<CarLite[]>([]);
  const [carId, setCarId] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [kind, setKind] = useState("manufacturer");
  const [severity, setSeverity] = useState("normal");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCarId("");
    setCustomerId("");
    setKind("manufacturer");
    setSeverity("normal");
    setSummary("");
    setNotes("");
    void (async () => {
      const [c, cu] = await Promise.all([
        supabase.from("cars").select("id, vin, model, model_year").limit(5000),
        supabase.from("customers").select("id, full_name, name").limit(5000),
      ]);
      setCars(((c.data as CarLite[]) ?? []).sort((a, b) => (a.vin ?? "").localeCompare(b.vin ?? "")));
      setCustomers(((cu.data as CustomerLite[]) ?? []).sort((a, b) => (a.full_name ?? a.name ?? "").localeCompare(b.full_name ?? b.name ?? "")));
    })();
  }, [open, supabase]);

  // When a car is picked, default the customer to that car's owner
  useEffect(() => {
    if (!carId) return;
    void (async () => {
      const { data } = await supabase.from("cars").select("customer_id").eq("id", carId).single();
      const cid = (data as { customer_id: string | null } | null)?.customer_id ?? "";
      if (cid && !customerId) setCustomerId(cid);
    })();
  }, [carId, customerId, supabase]);

  async function submit() {
    if (!carId) return toast.error("Pick a vehicle");
    if (!summary.trim()) return toast.error("Summary is required");
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id ?? null;
    const { data: numRpc } = await supabase.rpc("generate_warranty_case_number");
    const caseNumber = (numRpc as string) ?? `WC-${Date.now()}`;
    const { data, error } = await supabase
      .from("warranty_cases")
      .insert({
        case_number: caseNumber,
        car_id: carId,
        customer_id: customerId || null,
        kind,
        severity,
        status: "open",
        summary: summary.trim(),
        notes: notes.trim() || null,
        opened_by: uid,
        created_by: uid,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) return toast.error(formatError(error));
    toast.success(`Case ${caseNumber} opened`);
    onCreated((data as { id: string }).id);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-tour-id="warranty-new-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Open warranty case</DialogTitle>
          <DialogDescription>
            Add parts, photos, and resolution notes on the next screen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Vehicle (VIN) *</Label>
            <Select value={carId} onValueChange={setCarId}>
              <SelectTrigger><SelectValue placeholder="Pick a vehicle" /></SelectTrigger>
              <SelectContent>
                {cars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.vin ?? "(no VIN)"} — {[c.model_year, c.model].filter(Boolean).join(" ") || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Auto-filled from car" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.name ?? c.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="battery">Battery</SelectItem>
                  <SelectItem value="recall">Recall</SelectItem>
                  <SelectItem value="dealer_goodwill">Dealer goodwill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Summary *</Label>
            <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What is wrong?" />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !carId || !summary.trim()}>
            {submitting ? "Opening…" : "Open case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
