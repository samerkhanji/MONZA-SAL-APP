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

interface TradeInRow {
  id: string;
  trade_in_number: string;
  customer_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_vin: string | null;
  mileage_km: number | null;
  status: string;
  provisional_value: number;
  recommended_value: number | null;
  accepted_value: number | null;
  currency: string;
  created_at: string;
  linked_sales_order_id: string | null;
}

interface CustomerLite { id: string; full_name?: string | null; name?: string | null; }

const STATUS_BUCKETS = [
  { id: "all", label: "All" },
  { id: "provisional", label: "Provisional" },
  { id: "inspecting", label: "Inspecting" },
  { id: "inspected", label: "Inspected" },
  { id: "approved", label: "Approved" },
  { id: "committed", label: "Committed" },
  { id: "rejected", label: "Rejected/Cancelled" },
] as const;
type Bucket = (typeof STATUS_BUCKETS)[number]["id"];

const STATUS_COLOR: Record<string, string> = {
  provisional: "bg-muted text-foreground",
  inspecting: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  inspected: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  committed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-muted text-foreground",
};

const fmt = (n: number | null, c = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(Number(n));

export default function TradeInsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isOwner, hasCapability } = useUser();
  const canRead =
    isOwner ||
    hasCapability("sales") ||
    hasCapability("garage") ||
    hasCapability("manage_team") ||
    hasCapability("view_reports");
  const canRequest = isOwner || hasCapability("sales");

  const [rows, setRows] = useState<TradeInRow[]>([]);
  const [customers, setCustomers] = useState<Map<string, CustomerLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    const [r, c] = await Promise.all([
      supabase
        .from("trade_ins")
        .select("id, trade_in_number, customer_id, vehicle_make, vehicle_model, vehicle_year, vehicle_vin, mileage_km, status, provisional_value, recommended_value, accepted_value, currency, created_at, linked_sales_order_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("customers").select("id, full_name, name").limit(5000),
    ]);
    if (r.error) toast.error(formatError(r.error));
    else setRows((r.data as TradeInRow[]) ?? []);
    if (!c.error) {
      const m = new Map<string, CustomerLite>();
      ((c.data as CustomerLite[]) ?? []).forEach((x) => m.set(x.id, x));
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
        const c = customers.get(x.customer_id);
        return (
          x.trade_in_number.toLowerCase().includes(q) ||
          `${x.vehicle_make} ${x.vehicle_model}`.toLowerCase().includes(q) ||
          (x.vehicle_vin ?? "").toLowerCase().includes(q) ||
          (c?.full_name ?? c?.name ?? "").toLowerCase().includes(q)
        );
      });
    }
    return r;
  }, [rows, bucket, query, customers]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((x) => (m[x.status] = (m[x.status] ?? 0) + 1));
    return m;
  }, [rows]);

  if (!canRead) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <AlertTriangle className="mx-auto mb-3 size-6" />
        <p>You don&apos;t have access to trade-ins.</p>
        <Button variant="link" asChild><Link href="/">Back to dashboard</Link></Button>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Trade-ins</h1>
          <p className="text-muted-foreground text-sm">
            Sales creates the request, garage inspects, owner approves. No sale
            is affected until the trade-in is approved and committed.
          </p>
        </div>
        {canRequest && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Request trade-in
          </Button>
        )}
      </div>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
        <TabsList className="flex h-auto flex-wrap">
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
          placeholder="Search by number, vehicle, VIN, customer…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {rows.length === 0 ? "No trade-ins yet." : "No trade-ins match the filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Number</th>
                    <th className="px-3 py-2">Vehicle</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2 text-right">Provisional</th>
                    <th className="px-3 py-2 text-right">Recommended</th>
                    <th className="px-3 py-2 text-right">Accepted</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((x) => {
                    const c = customers.get(x.customer_id);
                    return (
                      <tr
                        key={x.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => router.push(`/trade-ins/${x.id}`)}
                      >
                        <td className="px-3 py-2 font-mono">{x.trade_in_number}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span>{x.vehicle_year ? `${x.vehicle_year} ` : ""}{x.vehicle_make} {x.vehicle_model}</span>
                            <span className="text-muted-foreground text-xs font-mono">{x.vehicle_vin ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">{c?.full_name ?? c?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(x.provisional_value, x.currency)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(x.recommended_value, x.currency)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(x.accepted_value, x.currency)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] uppercase", STATUS_COLOR[x.status] ?? "")}>
                            {x.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(x.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RequestTradeInDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          void load();
          router.push(`/trade-ins/${id}`);
        }}
      />
    </div>
  );
}

function RequestTradeInDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const supabase = createClient();
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [color, setColor] = useState("");
  const [trim, setTrim] = useState("");
  const [mileage, setMileage] = useState("");
  const [provisional, setProvisional] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomerId("");
    setMake("");
    setModel("");
    setYear("");
    setVin("");
    setPlate("");
    setColor("");
    setTrim("");
    setMileage("");
    setProvisional("");
    setCurrency("USD");
    setNotes("");
    void (async () => {
      const { data } = await supabase.from("customers").select("id, full_name, name").limit(5000);
      setCustomers(((data as CustomerLite[]) ?? []).sort((a, b) =>
        (a.full_name ?? a.name ?? "").localeCompare(b.full_name ?? b.name ?? "")
      ));
    })();
  }, [open, supabase]);

  async function submit() {
    if (!customerId) return toast.error("Pick the customer offering the trade-in");
    if (!make.trim() || !model.trim()) return toast.error("Make and model are required");
    const p = Number(provisional);
    if (!Number.isFinite(p) || p < 0) return toast.error("Provisional value must be ≥ 0");
    setSubmitting(true);
    const { data, error } = await supabase.rpc("request_trade_in", {
      p_customer_id: customerId,
      p_vehicle_make: make.trim(),
      p_vehicle_model: model.trim(),
      p_provisional_value: p,
      p_currency: currency,
      p_vehicle_year: year ? Number(year) : null,
      p_vehicle_vin: vin.trim() || null,
      p_vehicle_plate: plate.trim() || null,
      p_vehicle_color: color.trim() || null,
      p_vehicle_trim: trim.trim() || null,
      p_mileage_km: mileage ? Number(mileage) : null,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(formatError(error));
    toast.success("Trade-in request created — garage will inspect");
    onCreated(data as string);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a trade-in</DialogTitle>
          <DialogDescription>
            Starts as provisional. Garage will inspect and recommend a value;
            owner approval is required before any sale is affected.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Pick a customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.name ?? c.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Make *</Label>
            <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" />
          </div>
          <div className="space-y-1">
            <Label>Model *</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Camry" />
          </div>
          <div className="space-y-1">
            <Label>Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2022" />
          </div>
          <div className="space-y-1">
            <Label>Trim</Label>
            <Input value={trim} onChange={(e) => setTrim(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>VIN</Label>
            <Input className="font-mono" value={vin} onChange={(e) => setVin(e.target.value)} placeholder="17-char VIN" />
          </div>
          <div className="space-y-1">
            <Label>Plate</Label>
            <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Color</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Mileage (km)</Label>
            <Input type="number" min="0" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Provisional value *</Label>
            <Input type="number" min="0" step="0.01" value={provisional} onChange={(e) => setProvisional(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="LBP">LBP</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did the customer say? Any context for garage?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Creating…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
