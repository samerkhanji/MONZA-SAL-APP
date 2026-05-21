"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

interface RefundRow {
  id: string;
  refund_number: string;
  kind: "parts" | "service";
  customer_id: string;
  amount: number;
  currency: string;
  status: string;
  approval_required: "auto" | "manager" | "owner";
  reason: string;
  requested_at: string;
  requested_by: string | null;
}

interface CustomerLite {
  id: string;
  full_name?: string | null;
  name?: string | null;
}

interface PartLite {
  id: string;
  name: string;
}

interface JobLite {
  id: string;
  title: string;
  vin: string | null;
}

const STATUS_BUCKETS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
  { id: "rejected", label: "Rejected/Cancelled" },
] as const;
type Bucket = (typeof STATUS_BUCKETS)[number]["id"];

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-muted text-foreground",
};

const APPROVAL_COLOR: Record<string, string> = {
  auto: "bg-muted text-foreground",
  manager: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const fmt = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n);

export default function RefundsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isOwner, hasCapability } = useUser();
  const canRead =
    isOwner ||
    hasCapability("garage") ||
    hasCapability("cashier") ||
    hasCapability("manage_team") ||
    hasCapability("view_reports");
  const canRequest = isOwner || hasCapability("garage") || hasCapability("cashier");

  const [rows, setRows] = useState<RefundRow[]>([]);
  const [customers, setCustomers] = useState<Map<string, CustomerLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // A warranty case can deep-link here to open a pre-filled, case-linked refund.
  const searchParams = useSearchParams();
  const [refundPrefill, setRefundPrefill] = useState<{
    warrantyCaseId: string;
    customerId: string;
  } | null>(null);

  useEffect(() => {
    const warrantyCaseId = searchParams.get("warranty_case");
    if (warrantyCaseId) {
      setRefundPrefill({
        warrantyCaseId,
        customerId: searchParams.get("customer") ?? "",
      });
      setCreateOpen(true);
      // Strip the params so a later manual "Request refund" starts blank.
      router.replace("/garage/refunds");
    }
    // Consume the deep-link params once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    const [r, c] = await Promise.all([
      supabase
        .from("refunds")
        .select("id, refund_number, kind, customer_id, amount, currency, status, approval_required, reason, requested_at, requested_by")
        .is("deleted_at", null)
        .order("requested_at", { ascending: false })
        .limit(500),
      supabase.from("customers_display").select("id, full_name").limit(2000),
    ]);
    if (r.error) toast.error(formatError(r.error));
    else setRows((r.data as RefundRow[]) ?? []);
    if (c.error) toast.error(formatError(c.error));
    else {
      const m = new Map<string, CustomerLite>();
      ((c.data as CustomerLite[]) ?? []).forEach((x) => m.set(x.id, x));
      setCustomers(m);
    }
    setLoading(false);
  }, [canRead, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let r = rows;
    if (bucket === "rejected") r = r.filter((x) => x.status === "rejected" || x.status === "cancelled");
    else if (bucket !== "all") r = r.filter((x) => x.status === bucket);
    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter((x) => {
        const c = customers.get(x.customer_id);
        const cname = (c?.full_name ?? c?.name ?? "").toLowerCase();
        return (
          x.refund_number.toLowerCase().includes(q) ||
          x.reason.toLowerCase().includes(q) ||
          cname.includes(q)
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
        <p>You don&apos;t have access to refunds.</p>
        <Button variant="link" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Refunds</h1>
          <p className="text-muted-foreground text-sm">
            Parts and service refunds only — no full car returns. Amounts above
            the owner threshold require owner approval before payment.
          </p>
        </div>
        {canRequest && (
          <Button data-tour-id="refunds-request" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Request refund
          </Button>
        )}
      </div>

      <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
        <TabsList data-tour-id="refunds-status-tabs" className="flex h-auto flex-wrap">
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
          data-tour-id="refunds-search"
          placeholder="Search by number, customer, reason…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      <Card data-tour-id="refunds-table">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {rows.length === 0 ? "No refunds yet." : "No refunds match the filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Number</th>
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Approval</th>
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
                        onClick={() => router.push(`/garage/refunds/${x.id}`)}
                      >
                        <td className="px-3 py-2 font-mono">{x.refund_number}</td>
                        <td className="px-3 py-2 capitalize">{x.kind}</td>
                        <td className="px-3 py-2">{c?.full_name ?? c?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(x.amount), x.currency)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] uppercase", APPROVAL_COLOR[x.approval_required] ?? "")}>
                            {x.approval_required}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] uppercase", STATUS_COLOR[x.status] ?? "")}>
                            {x.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(x.requested_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateRefundDialog
        open={createOpen}
        initialCustomerId={refundPrefill?.customerId}
        initialWarrantyCaseId={refundPrefill?.warrantyCaseId}
        onClose={() => {
          setCreateOpen(false);
          setRefundPrefill(null);
        }}
        onCreated={(id) => {
          setCreateOpen(false);
          setRefundPrefill(null);
          void load();
          router.push(`/garage/refunds/${id}`);
        }}
      />
    </div>
  );
}

function CreateRefundDialog({
  open,
  onClose,
  onCreated,
  initialCustomerId,
  initialWarrantyCaseId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  initialCustomerId?: string;
  initialWarrantyCaseId?: string;
}) {
  const supabase = createClient();
  const [kind, setKind] = useState<"parts" | "service">("service");
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [partId, setPartId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [jobId, setJobId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [parts, setParts] = useState<PartLite[]>([]);
  const [jobs, setJobs] = useState<JobLite[]>([]);

  useEffect(() => {
    if (!open) return;
    setKind("service");
    setCustomerId(initialCustomerId ?? "");
    setAmount("");
    setCurrency("USD");
    setReason("");
    setNotes("");
    setPartId("");
    setQuantity("1");
    setJobId("");
    void (async () => {
      const [c, p, j] = await Promise.all([
        supabase.from("customers_display").select("id, full_name").limit(2000),
        supabase.from("parts").select("id, name:part_name").limit(2000),
        supabase
          .from("garage_jobs")
          .select("id, title, cars:car_id(vin)")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      setCustomers(((c.data as CustomerLite[]) ?? []).sort((a, b) => (a.full_name ?? a.name ?? "").localeCompare(b.full_name ?? b.name ?? "")));
      setParts(((p.data as PartLite[]) ?? []).sort((a, b) => a.name.localeCompare(b.name)));
      type JobRaw = { id: string; title: string; cars?: { vin?: string | null } | { vin?: string | null }[] | null };
      setJobs(
        ((j.data as JobRaw[]) ?? []).map((row) => {
          const car = Array.isArray(row.cars) ? row.cars[0] : row.cars;
          return { id: row.id, title: row.title, vin: car?.vin ?? null };
        })
      );
    })();
  }, [open, supabase, initialCustomerId]);

  async function submit() {
    if (!customerId) return toast.error("Pick a customer");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a positive amount");
    if (!reason.trim()) return toast.error("Reason is required");
    if (kind === "parts" && !partId) return toast.error("Pick the part being refunded");

    setSubmitting(true);
    const { data, error } = await supabase.rpc("request_refund", {
      p_kind: kind,
      p_customer_id: customerId,
      p_amount: amt,
      p_reason: reason.trim(),
      p_currency: currency,
      p_job_id: jobId || null,
      p_invoice_id: null,
      p_warranty_case_id: initialWarrantyCaseId ?? null,
      p_part_id: kind === "parts" ? partId : null,
      p_quantity: kind === "parts" ? Number(quantity) || 1 : null,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(formatError(error));
    toast.success("Refund requested");
    onCreated(data as string);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-tour-id="refunds-request-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request a refund</DialogTitle>
          <DialogDescription>
            Approval level is set automatically from the amount. Refunds above
            the owner threshold cannot be paid without owner sign-off.
          </DialogDescription>
        </DialogHeader>
        {initialWarrantyCaseId && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            This refund will be linked to the originating warranty case.
          </p>
        )}
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Kind *</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "parts" | "service")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parts">Parts</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
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
          </div>

          <div className="space-y-1">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Linked job (optional)</Label>
              <Select
                value={jobId || "__none__"}
                onValueChange={(v) => setJobId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="No linked job" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No linked job</SelectItem>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title}{j.vin ? ` — ${j.vin}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {kind === "parts" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <Label>Part *</Label>
                <Select value={partId} onValueChange={setPartId}>
                  <SelectTrigger><SelectValue placeholder="Pick a part" /></SelectTrigger>
                  <SelectContent>
                    {parts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Reason *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Defective part, service overcharge, warranty…" />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit refund request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
