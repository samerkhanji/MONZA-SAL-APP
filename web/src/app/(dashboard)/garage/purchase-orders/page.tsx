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
import { AlertTriangle, ArrowLeft, Plus, Search, X } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
}

interface PORow {
  id: string;
  po_number: string;
  status: string;
  estimated_total: number;
  currency: string;
  supplier_id: string | null;
  created_at: string;
  requested_by: string | null;
  expected_delivery_at: string | null;
}

const STATUS_BUCKETS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "pending_approval", label: "Pending approval" },
  { id: "approved", label: "Approved" },
  { id: "sent_to_supplier", label: "Sent" },
  { id: "partially_received", label: "Partial" },
  { id: "received", label: "Received" },
  { id: "invoiced", label: "Invoiced" },
  { id: "paid", label: "Paid" },
  { id: "cancelled", label: "Cancelled/Rejected" },
] as const;

type Bucket = (typeof STATUS_BUCKETS)[number]["id"];

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-foreground",
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  sent_to_supplier: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  partially_received: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  received: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  invoiced: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const fmt = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierFilter = searchParams.get("supplier");
  const { isOwner, hasCapability } = useUser();
  const supabase = createClient();
  const allowed = isOwner || hasCapability("inventory") || hasCapability("cashier");

  const [pos, setPos] = useState<PORow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState<string>("");
  const [newNote, setNewNote] = useState("");

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    const [p, s] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("id, po_number, status, estimated_total, currency, supplier_id, created_at, requested_by, expected_delivery_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("suppliers")
        .select("id, name")
        .is("deleted_at", null)
        .order("name", { ascending: true }),
    ]);
    if (p.error) toast.error(formatError(p.error));
    else setPos((p.data as PORow[]) ?? []);
    if (s.error) toast.error(formatError(s.error));
    else setSuppliers((s.data as Supplier[]) ?? []);
    setLoading(false);
  }, [allowed, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (supplierFilter) setNewSupplierId(supplierFilter);
  }, [supplierFilter]);

  const supplierById = useMemo(() => {
    const m = new Map<string, Supplier>();
    suppliers.forEach((s) => m.set(s.id, s));
    return m;
  }, [suppliers]);

  const filtered = useMemo(() => {
    let rows = pos;
    if (supplierFilter) {
      rows = rows.filter((p) => p.supplier_id === supplierFilter);
    }
    if (bucket === "cancelled") {
      rows = rows.filter((p) => p.status === "cancelled" || p.status === "rejected");
    } else if (bucket !== "all") {
      rows = rows.filter((p) => p.status === bucket);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) => {
        const sn = supplierById.get(p.supplier_id ?? "")?.name?.toLowerCase() ?? "";
        return p.po_number.toLowerCase().includes(q) || sn.includes(q);
      });
    }
    return rows;
  }, [pos, bucket, query, supplierById, supplierFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    pos.forEach((p) => (c[p.status] = (c[p.status] ?? 0) + 1));
    return c;
  }, [pos]);

  async function createDraft() {
    if (!newSupplierId) {
      toast.error("Pick a supplier");
      return;
    }
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id ?? null;
    const { data: gen } = await supabase.rpc("generate_po_number");
    const poNumber = (gen as string) ?? `PO-${Date.now()}`;
    const { data, error } = await supabase
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        supplier_id: newSupplierId,
        status: "draft",
        currency: "USD",
        notes: newNote.trim() || null,
        requested_by: userId,
        created_by: userId,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    const id = (data as { id: string }).id;
    toast.success(`PO ${poNumber} created`);
    setCreateOpen(false);
    setNewNote("");
    setNewSupplierId("");
    router.push(`/garage/purchase-orders/${id}`);
  }

  if (!allowed) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <AlertTriangle className="mx-auto mb-3 size-6" />
        <p>You don&apos;t have access to purchase orders.</p>
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
          <h1 className="text-2xl font-semibold">Purchase orders</h1>
          <p className="text-muted-foreground text-sm">
            Full lifecycle from draft to paid. Stock only increases when a
            receipt (GRN) is logged.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-4" /> New PO
        </Button>
      </div>

      {supplierFilter && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm dark:border-sky-900 dark:bg-sky-950">
          <span className="text-sky-900 dark:text-sky-200">
            Filtering by supplier:{" "}
            <strong>
              {supplierById.get(supplierFilter)?.name ?? "Unknown supplier"}
            </strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace("/garage/purchase-orders")}
            className="h-7 px-2"
          >
            <X className="mr-1 size-3" /> Clear
          </Button>
        </div>
      )}

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
          placeholder="Search by PO number or supplier…"
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
              {pos.length === 0 ? "No purchase orders yet." : "No POs match the filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">PO</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Estimated</th>
                    <th className="px-3 py-2">Expected</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/garage/purchase-orders/${p.id}`)}
                    >
                      <td className="px-3 py-2 font-mono">{p.po_number}</td>
                      <td className="px-3 py-2">
                        {supplierById.get(p.supplier_id ?? "")?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 px-1.5 text-[10px] uppercase",
                            STATUS_COLOR[p.status] ?? ""
                          )}
                        >
                          {p.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(p.estimated_total ?? 0, p.currency)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.expected_delivery_at ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
            <DialogDescription>
              Starts as a draft. Add line items on the next screen, then submit
              for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="po-supplier">Supplier *</Label>
              <Select value={newSupplierId} onValueChange={setNewSupplierId}>
                <SelectTrigger id="po-supplier">
                  <SelectValue placeholder="Pick a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suppliers.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  No suppliers yet. Add one in Settings → Suppliers first.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="po-note">Notes (optional)</Label>
              <Input
                id="po-note"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="e.g. brake pads for VIN ...XXXX"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={() => void createDraft()} disabled={creating || !newSupplierId}>
              {creating ? "Creating…" : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-muted-foreground flex items-center justify-between pt-2 text-xs">
        <Button variant="link" size="sm" asChild>
          <Link href="/garage/inventory">
            <ArrowLeft className="mr-1 size-3" /> Parts inventory
          </Link>
        </Button>
      </div>
    </div>
  );
}
