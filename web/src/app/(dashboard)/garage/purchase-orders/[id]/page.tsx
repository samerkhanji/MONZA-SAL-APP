"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

interface PO {
  id: string;
  po_number: string;
  status: string;
  supplier_id: string | null;
  currency: string;
  estimated_total: number;
  notes: string | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  sent_at: string | null;
  supplier_contact: string | null;
  supplier_reference: string | null;
  expected_delivery_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

interface POLine {
  id: string;
  po_id: string;
  part_id: string | null;
  part_name: string;
  oe_number: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  note: string | null;
  sort_order: number;
}

interface PartOption {
  id: string;
  part_name: string;
  oe_number: string | null;
  unit_cost: number | null;
}

interface Receipt {
  id: string;
  grn_number: string;
  received_at: string;
  condition_note: string | null;
  lines?: ReceiptLine[];
}
interface ReceiptLine {
  id: string;
  po_line_id: string;
  quantity_received: number;
  condition: string;
  note: string | null;
}

interface Invoice {
  id: string;
  supplier_invoice_number: string;
  invoice_date: string;
  amount: number;
  currency: string;
  vat_amount: number;
  due_at: string | null;
  file_url: string | null;
  status: string;
}

interface Payment {
  id: string;
  invoice_id: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  reference: string | null;
  paid_at: string;
  notes: string | null;
}

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
  new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n);

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();
  const supabase = createClient();
  const { isOwner, hasCapability } = useUser();
  const canManage = isOwner || hasCapability("inventory");
  const canPay = isOwner || hasCapability("cashier");

  const [po, setPo] = useState<PO | null>(null);
  const [lines, setLines] = useState<POLine[]>([]);
  const [parts, setParts] = useState<PartOption[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [p, l, r, inv, pay, allParts] = await Promise.all([
      supabase.from("purchase_orders").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
      supabase.from("purchase_order_lines").select("*").eq("po_id", id).order("sort_order"),
      supabase.from("purchase_order_receipts").select("*, lines:purchase_order_receipt_lines(*)").eq("po_id", id).order("received_at"),
      supabase.from("purchase_order_invoices").select("*").eq("po_id", id).order("invoice_date"),
      supabase.from("purchase_order_payments").select("*").eq("po_id", id).order("paid_at"),
      supabase.from("parts").select("id, part_name, oe_number, unit_cost").is("deleted_at", null).order("part_name"),
    ]);
    if (p.error || !p.data) {
      toast.error(p.error ? formatError(p.error) : "Not found");
      router.push("/garage/purchase-orders");
      return;
    }
    setPo(p.data as PO);
    setLines((l.data as POLine[]) ?? []);
    setReceipts((r.data as Receipt[]) ?? []);
    setInvoices((inv.data as Invoice[]) ?? []);
    setPayments((pay.data as Payment[]) ?? []);
    setParts((allParts.data as PartOption[]) ?? []);
    setLoading(false);
  }, [id, supabase, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalEstimate = useMemo(
    () => lines.reduce((s, l) => s + Number(l.line_total ?? 0), 0),
    [lines]
  );

  const totalReceived = useMemo(() => {
    const m = new Map<string, number>();
    receipts.forEach((r) => {
      r.lines?.forEach((rl) => {
        if (rl.condition === "good" || rl.condition === "extra") {
          m.set(rl.po_line_id, (m.get(rl.po_line_id) ?? 0) + Number(rl.quantity_received));
        }
      });
    });
    return m;
  }, [receipts]);

  const totalInvoiced = useMemo(
    () => invoices.reduce((s, i) => s + Number(i.amount), 0),
    [invoices]
  );
  const totalPaid = useMemo(
    () => payments.reduce((s, p) => s + Number(p.amount), 0),
    [payments]
  );

  if (loading || !po) {
    return (
      <div className="container space-y-4 py-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isDraft = po.status === "draft";
  const isPending = po.status === "pending_approval";
  const isApproved = po.status === "approved";
  const canReceive =
    po.status === "approved" ||
    po.status === "sent_to_supplier" ||
    po.status === "partially_received";
  const canAttachInvoice = [
    "partially_received",
    "received",
    "invoiced",
    "sent_to_supplier",
  ].includes(po.status);

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button data-tour-id="po-detail-back" variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/garage/purchase-orders">
              <ArrowLeft className="mr-1 size-3" /> All purchase orders
            </Link>
          </Button>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            {po.po_number}
            <Badge
              variant="outline"
              className={cn("h-5 px-1.5 text-[10px] uppercase", STATUS_COLOR[po.status])}
            >
              {po.status.replace(/_/g, " ")}
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            Created {new Date(po.created_at).toLocaleString()} ·{" "}
            {po.notes ?? "no notes"}
          </p>
        </div>
      </div>

      {po.status === "rejected" && po.rejection_reason && (
        <div className="rounded-md border border-red-500/40 bg-red-50/40 p-3 text-sm dark:bg-red-950/20">
          <p className="font-medium">Rejected.</p>
          <p className="text-muted-foreground">{po.rejection_reason}</p>
        </div>
      )}
      {po.status === "cancelled" && po.cancel_reason && (
        <div className="rounded-md border border-red-500/40 bg-red-50/40 p-3 text-sm dark:bg-red-950/20">
          <p className="font-medium">Cancelled.</p>
          <p className="text-muted-foreground">{po.cancel_reason}</p>
        </div>
      )}

      {/* Lines */}
      <Card data-tour-id="po-detail-lines">
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
          <CardDescription>
            Estimate {fmt(totalEstimate, po.currency)} · Received{" "}
            {Array.from(totalReceived.values()).reduce((s, n) => s + n, 0)} /{" "}
            {lines.reduce((s, l) => s + Number(l.quantity), 0)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">No lines yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1">Part</th>
                    <th className="px-2 py-1">OE</th>
                    <th className="px-2 py-1 text-right">Qty</th>
                    <th className="px-2 py-1 text-right">Unit</th>
                    <th className="px-2 py-1 text-right">Line total</th>
                    <th className="px-2 py-1 text-right">Received</th>
                    {isDraft && canManage && <th />}
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-2 py-1.5">{l.part_name}</td>
                      <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                        {l.oe_number ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">{l.quantity}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(Number(l.unit_cost), po.currency)}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(Number(l.line_total), po.currency)}</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">
                        {totalReceived.get(l.id) ?? 0} / {l.quantity}
                      </td>
                      {isDraft && canManage && (
                        <td className="px-2 py-1.5">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => void deleteLine(supabase, l.id, lines, setLines)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isDraft && canManage && (
            <AddLineForm
              poId={po.id}
              parts={parts}
              onAdded={() => void load()}
            />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card data-tour-id="po-detail-actions">
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {isDraft && canManage && (
            <>
              <Button
                onClick={async () => {
                  setBusy(true);
                  const { data, error } = await supabase.rpc("submit_purchase_order", { p_po_id: po.id });
                  setBusy(false);
                  if (error) {
                    toast.error(formatError(error));
                    return;
                  }
                  const r = data as { status?: string };
                  toast.success(
                    r.status === "approved" ? "Approved (under threshold)" : "Submitted for approval"
                  );
                  void load();
                }}
                disabled={busy || lines.length === 0}
              >
                Submit for approval
              </Button>
              <Button
                variant="outline"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
              >
                Cancel draft
              </Button>
            </>
          )}

          {isPending && isOwner && (
            <>
              <Button
                onClick={async () => {
                  setBusy(true);
                  const { error } = await supabase.rpc("approve_purchase_order", { p_po_id: po.id });
                  setBusy(false);
                  if (error) {
                    toast.error(formatError(error));
                    return;
                  }
                  toast.success("Approved");
                  void load();
                }}
                disabled={busy}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejectOpen(true)}
                disabled={busy}
              >
                Reject
              </Button>
            </>
          )}

          {isApproved && canManage && (
            <Button onClick={() => setSendOpen(true)} disabled={busy}>
              Send to supplier
            </Button>
          )}

          {canReceive && canManage && (
            <Button data-tour-id="po-detail-log-grn" variant="secondary" onClick={() => setReceiptOpen(true)} disabled={busy}>
              Log GRN (receipt)
            </Button>
          )}

          {canAttachInvoice && (canManage || canPay) && (
            <Button variant="secondary" onClick={() => setInvoiceOpen(true)} disabled={busy}>
              Attach invoice
            </Button>
          )}

          {invoices.length > 0 && canPay && (
            <Button variant="secondary" onClick={() => setPaymentOpen(true)} disabled={busy}>
              Record payment
            </Button>
          )}

          {!["received", "invoiced", "paid", "cancelled", "rejected"].includes(po.status) && canManage && (
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setCancelOpen(true)}
              disabled={busy}
            >
              Cancel PO
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Receipts */}
      {receipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipts (GRN)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {receipts.map((r) => (
              <div key={r.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{r.grn_number}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(r.received_at).toLocaleString()}
                  </span>
                </div>
                {r.condition_note && (
                  <p className="text-muted-foreground mt-1 text-xs">{r.condition_note}</p>
                )}
                {r.lines && r.lines.length > 0 && (
                  <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                    {r.lines.map((rl) => {
                      const ln = lines.find((x) => x.id === rl.po_line_id);
                      return (
                        <li key={rl.id}>
                          {ln?.part_name ?? rl.po_line_id} · qty {rl.quantity_received} ·{" "}
                          <span className={rl.condition === "good" ? "" : "text-amber-700"}>
                            {rl.condition}
                          </span>
                          {rl.note ? ` — ${rl.note}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invoices + Payments */}
      {(invoices.length > 0 || payments.length > 0) && (
        <Card data-tour-id="po-detail-money">
          <CardHeader>
            <CardTitle className="text-base">Money</CardTitle>
            <CardDescription>
              Invoiced {fmt(totalInvoiced, po.currency)} · Paid{" "}
              {fmt(totalPaid, po.currency)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{inv.supplier_invoice_number}</p>
                  <p className="text-muted-foreground text-xs">
                    {inv.invoice_date} · {fmt(Number(inv.amount), inv.currency)}
                    {inv.due_at ? ` · due ${inv.due_at}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {inv.status}
                </Badge>
              </div>
            ))}
            {payments.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs uppercase">Payments</p>
                <ul className="space-y-1 text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="text-muted-foreground">
                      {new Date(p.paid_at).toLocaleDateString()} · {p.payment_method} ·{" "}
                      {fmt(Number(p.amount), p.currency)}
                      {p.reference ? ` · ref ${p.reference}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ReceiptDialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        po={po}
        lines={lines}
        received={totalReceived}
        onDone={() => {
          setReceiptOpen(false);
          void load();
        }}
      />
      <InvoiceDialog
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        po={po}
        onDone={() => {
          setInvoiceOpen(false);
          void load();
        }}
      />
      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        po={po}
        invoices={invoices}
        onDone={() => {
          setPaymentOpen(false);
          void load();
        }}
      />
      <SendDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        poId={po.id}
        onDone={() => {
          setSendOpen(false);
          void load();
        }}
      />
      <ReasonDialog
        open={rejectOpen}
        title="Reject PO"
        description="Why are you rejecting this PO? The requester will see this reason."
        confirmLabel="Reject"
        onClose={() => setRejectOpen(false)}
        onSubmit={async (reason) => {
          const { error } = await supabase.rpc("reject_purchase_order", {
            p_po_id: po.id,
            p_reason: reason,
          });
          if (error) {
            toast.error(formatError(error));
            return;
          }
          toast.success("Rejected");
          setRejectOpen(false);
          void load();
        }}
      />
      <ReasonDialog
        open={cancelOpen}
        title="Cancel PO"
        description="Why? Cancelling means the supplier won't be told. Stock is not affected."
        confirmLabel="Cancel PO"
        onClose={() => setCancelOpen(false)}
        onSubmit={async (reason) => {
          const { error } = await supabase.rpc("cancel_purchase_order", {
            p_po_id: po.id,
            p_reason: reason,
          });
          if (error) {
            toast.error(formatError(error));
            return;
          }
          toast.success("Cancelled");
          setCancelOpen(false);
          void load();
        }}
      />
    </div>
  );
}

async function deleteLine(
  supabase: ReturnType<typeof createClient>,
  id: string,
  lines: POLine[],
  setLines: (l: POLine[]) => void
) {
  const { error } = await supabase.from("purchase_order_lines").delete().eq("id", id);
  if (error) {
    toast.error(formatError(error));
    return;
  }
  setLines(lines.filter((l) => l.id !== id));
}

function AddLineForm({
  poId,
  parts,
  onAdded,
}: {
  poId: string;
  parts: PartOption[];
  onAdded: () => void;
}) {
  const supabase = createClient();
  const [partId, setPartId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const p = parts.find((x) => x.id === partId);
    if (!p) {
      toast.error("Pick a part");
      return;
    }
    const qty = Number(quantity);
    const uc = Number(unitCost);
    if (!qty || qty <= 0) {
      toast.error("Quantity must be > 0");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("purchase_order_lines").insert({
      po_id: poId,
      part_id: p.id,
      part_name: p.part_name,
      oe_number: p.oe_number,
      quantity: qty,
      unit_cost: isNaN(uc) ? 0 : uc,
      note: note.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setPartId("");
    setQuantity("1");
    setUnitCost("");
    setNote("");
    onAdded();
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="mb-2 text-sm font-medium">Add line</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Part *</Label>
          <Select value={partId} onValueChange={setPartId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a part" />
            </SelectTrigger>
            <SelectContent>
              {parts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.part_name}
                  {p.oe_number ? ` — ${p.oe_number}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quantity *</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Unit cost</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Note</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. for VIN ...XXXX"
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={() => void submit()} disabled={submitting || !partId}>
          <Plus className="mr-1 size-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}

function ReceiptDialog({
  open,
  onClose,
  po,
  lines,
  received,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  po: PO;
  lines: POLine[];
  received: Map<string, number>;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [grnNumber, setGrnNumber] = useState<string>("");
  const [conditionNote, setConditionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [perLine, setPerLine] = useState<Record<string, { qty: string; cond: string }>>({});

  useEffect(() => {
    if (open) {
      setGrnNumber(`GRN-${Date.now().toString().slice(-6)}`);
      setConditionNote("");
      const seed: Record<string, { qty: string; cond: string }> = {};
      lines.forEach((l) => {
        const remaining = Number(l.quantity) - (received.get(l.id) ?? 0);
        seed[l.id] = { qty: String(Math.max(0, remaining)), cond: "good" };
      });
      setPerLine(seed);
    }
  }, [open, lines, received]);

  async function submit() {
    const rl = lines
      .map((l) => {
        const v = perLine[l.id];
        const qty = Number(v?.qty ?? 0);
        if (!qty) return null;
        return {
          po_line_id: l.id,
          quantity_received: qty,
          condition: v?.cond ?? "good",
        };
      })
      .filter(Boolean);
    if (rl.length === 0) {
      toast.error("Enter at least one received qty");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("record_purchase_order_receipt", {
      p_po_id: po.id,
      p_grn_number: grnNumber.trim(),
      p_received_lines: rl,
      p_condition_note: conditionNote.trim() || null,
      p_photos: null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("GRN logged · stock updated");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log goods received (GRN)</DialogTitle>
          <DialogDescription>
            Stock bumps only for &quot;good&quot; or &quot;extra&quot; lines.
            Damaged / wrong-item / short don&apos;t add to inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>GRN number *</Label>
              <Input value={grnNumber} onChange={(e) => setGrnNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Condition note (optional)</Label>
              <Input value={conditionNote} onChange={(e) => setConditionNote(e.target.value)} />
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1">Line</th>
                <th className="px-2 py-1 text-right">Ord</th>
                <th className="px-2 py-1 text-right">Already</th>
                <th className="px-2 py-1 w-24">Receive</th>
                <th className="px-2 py-1 w-28">Condition</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {lines.map((l) => {
                const v = perLine[l.id] ?? { qty: "0", cond: "good" };
                const already = received.get(l.id) ?? 0;
                return (
                  <tr key={l.id}>
                    <td className="px-2 py-1">{l.part_name}</td>
                    <td className="px-2 py-1 text-right">{l.quantity}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{already}</td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={v.qty}
                        onChange={(e) =>
                          setPerLine((prev) => ({
                            ...prev,
                            [l.id]: { ...v, qty: e.target.value },
                          }))
                        }
                        className="h-8"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Select
                        value={v.cond}
                        onValueChange={(c) =>
                          setPerLine((prev) => ({ ...prev, [l.id]: { ...v, cond: c } }))
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">good</SelectItem>
                          <SelectItem value="extra">extra</SelectItem>
                          <SelectItem value="damaged">damaged</SelectItem>
                          <SelectItem value="wrong_item">wrong item</SelectItem>
                          <SelectItem value="short">short</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Logging…" : "Log GRN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDialog({
  open,
  onClose,
  po,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  po: PO;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [invNo, setInvNo] = useState("");
  const [invDate, setInvDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("0");
  const [dueAt, setDueAt] = useState<string>("");
  const [fileUrl, setFileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setInvNo("");
      setInvDate(new Date().toISOString().slice(0, 10));
      setAmount("");
      setVat("0");
      setDueAt("");
      setFileUrl("");
    }
  }, [open]);

  async function submit() {
    if (!invNo.trim() || !Number(amount)) {
      toast.error("Invoice number + amount are required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("attach_purchase_order_invoice", {
      p_po_id: po.id,
      p_invoice_no: invNo.trim(),
      p_invoice_date: invDate,
      p_amount: Number(amount),
      p_currency: po.currency,
      p_vat: Number(vat) || 0,
      p_due_at: dueAt || null,
      p_file_url: fileUrl.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Invoice attached");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach supplier invoice</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Supplier invoice # *</Label>
            <Input value={invNo} onChange={(e) => setInvNo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Invoice date *</Label>
            <Input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Due date</Label>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Amount * ({po.currency})</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>VAT</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>File URL (optional)</Label>
            <Input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="link to scanned PDF / image"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Attaching…" : "Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  open,
  onClose,
  po,
  invoices,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  po: PO;
  invoices: Invoice[];
  onDone: () => void;
}) {
  const supabase = createClient();
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("bank_transfer");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const first = invoices.find((i) => i.status !== "paid")?.id ?? invoices[0]?.id ?? "";
      setInvoiceId(first);
      setAmount("");
      setMethod("bank_transfer");
      setRef("");
      setNotes("");
    }
  }, [open, invoices]);

  async function submit() {
    if (!invoiceId) {
      toast.error("Pick an invoice");
      return;
    }
    if (!Number(amount) || Number(amount) <= 0) {
      toast.error("Amount must be > 0");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("record_purchase_order_payment", {
      p_po_id: po.id,
      p_invoice_id: invoiceId,
      p_amount: Number(amount),
      p_method: method,
      p_currency: po.currency,
      p_reference: ref.trim() || null,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Payment recorded");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Against invoice *</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick an invoice" />
              </SelectTrigger>
              <SelectContent>
                {invoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.supplier_invoice_number} · {fmt(Number(i.amount), i.currency)} · {i.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Amount * ({po.currency})</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Method *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">cash</SelectItem>
                <SelectItem value="bank_transfer">bank transfer</SelectItem>
                <SelectItem value="cheque">cheque</SelectItem>
                <SelectItem value="card">card</SelectItem>
                <SelectItem value="other">other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Reference</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="cheque # / wire ref" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || !invoiceId}>
            {submitting ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendDialog({
  open,
  onClose,
  poId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  poId: string;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [contact, setContact] = useState("");
  const [ref, setRef] = useState("");
  const [eta, setEta] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const { error } = await supabase.rpc("send_purchase_order", {
      p_po_id: poId,
      p_supplier_contact: contact.trim() || null,
      p_supplier_reference: ref.trim() || null,
      p_expected_delivery: eta || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Sent to supplier");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send PO to supplier</DialogTitle>
          <DialogDescription>
            Records that you placed the order. Doesn&apos;t actually send email
            or WhatsApp — that&apos;s on your side.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label>Contact (optional)</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. Ahmad — XYZ Auto" />
          </div>
          <div className="space-y-1">
            <Label>Supplier reference (optional)</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="supplier's quote/order ref" />
          </div>
          <div className="space-y-1">
            <Label>Expected delivery (optional)</Label>
            <Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Sending…" : "Mark as sent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1">
          <Label>Reason *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              if (!reason.trim()) {
                toast.error("Reason is required");
                return;
              }
              setSubmitting(true);
              await onSubmit(reason.trim());
              setSubmitting(false);
            }}
            disabled={submitting || !reason.trim()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
