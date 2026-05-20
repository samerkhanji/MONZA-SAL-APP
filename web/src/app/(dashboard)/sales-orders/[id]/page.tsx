"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileText, CheckCircle2, Truck, Receipt, Loader2, Repeat } from "lucide-react";
import { formatError } from "@/lib/error-messages";

type SaleStatus = "draft" | "reserved" | "confirmed" | "paid" | "delivered" | "cancelled";

interface SalesOrderDetail {
  id: string;
  car_id: string | null;
  customer_id: string | null;
  status: SaleStatus;
  selling_price: number | null;
  currency: string | null;
  notes: string | null;
  sale_date: string | null;
  date_bought: string | null;
  reservation_date: string | null;
  reserved_until: string | null;
  reserved_by: string | null;
  delivery_date: string | null;
  // Lifecycle (added in migration 056)
  quote_amount: number | null;
  quote_currency: string | null;
  quote_sent_at: string | null;
  quote_accepted_at: string | null;
  deposit_amount: number | null;
  deposit_currency: string | null;
  deposit_paid_at: string | null;
  deposit_method: string | null;
  signed_contract_url: string | null;
  contract_signed_at: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  delivery_notes: string | null;
  // Void / reversal (added in migration 078)
  void_at: string | null;
  void_reason: string | null;
  void_by: string | null;
  created_at: string;
  cars?: {
    id: string;
    vin: string;
    brand: string;
    model: string;
    model_year: number | null;
    exterior_color: string | null;
  } | null;
  customers?: {
    id: string;
    first_name: string;
    last_name: string | null;
    phone_primary: string | null;
    email: string | null;
    lead_status: string | null;
  } | null;
}

interface CommittedTradeIn {
  id: string;
  trade_in_number: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  accepted_value: number | null;
  currency: string | null;
}

const STATUS_COLORS: Record<SaleStatus, string> = {
  draft:     "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  reserved:  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  paid:      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const CCY_OPTIONS = ["USD", "LBP", "EUR"];

const fmtMoney = (n: number | null | undefined, c: string | null | undefined) =>
  n == null ? "—" : `${Number(n).toLocaleString()} ${c ?? "USD"}`;
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString() : "—";
const fmtDT = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString() : "—";

function customerName(c: NonNullable<SalesOrderDetail["customers"]>): string {
  return `${c.first_name}${c.last_name ? ` ${c.last_name}` : ""}`.trim() || "—";
}

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { appRole } = useUser();
  const canEdit = appRole === "owner" || appRole === "assistant" || appRole === "sales_ops" || appRole === "hybrid";

  const supabase = createClient();
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [committedTradeIns, setCommittedTradeIns] = useState<CommittedTradeIn[]>([]);

  // Editable form state for the lifecycle blocks. Currency is shared
  // across all amounts on a single order — the DB enforces this with
  // the sales_orders_currencies_consistent CHECK (migration 078).
  const [quoteAmount, setQuoteAmount] = useState("");
  const [orderCurrency, setOrderCurrency] = useState("USD");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("");
  const [contractUrl, setContractUrl] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales_orders")
      .select(
        `*,
         cars:car_id (id, vin, brand, model, model_year, exterior_color),
         customers:customer_id (id, first_name, last_name, phone_primary, email, lead_status)`
      )
      .eq("id", id)
      .single();
    if (error || !data) {
      toast.error(error ? formatError(error) : "Sales order not found");
      router.push("/sales-orders");
      return;
    }
    const row = data as unknown as SalesOrderDetail;
    setOrder(row);
    setQuoteAmount(row.quote_amount != null ? String(row.quote_amount) : "");
    // Single currency for the whole order. Default to whichever is set,
    // or USD.
    setOrderCurrency(
      row.currency ?? row.quote_currency ?? row.deposit_currency ?? "USD"
    );
    setDepositAmount(row.deposit_amount != null ? String(row.deposit_amount) : "");
    setDepositMethod(row.deposit_method ?? "");
    setContractUrl(row.signed_contract_url ?? "");

    // Load any committed trade-ins linked to this sales order. We render
    // these under the price card so the user can see what credit was
    // applied. The "where status='committed'" filter is technically
    // redundant (linked_sales_order_id is only set on commit), but it's
    // an extra belt-and-suspenders.
    const { data: tradeIns } = await supabase
      .from("trade_ins")
      .select(
        "id, trade_in_number, vehicle_make, vehicle_model, vehicle_year, accepted_value, currency"
      )
      .eq("linked_sales_order_id", id)
      .eq("status", "committed");
    setCommittedTradeIns((tradeIns ?? []) as unknown as CommittedTradeIn[]);

    setLoading(false);
  }, [id, supabase, router]);

  useEffect(() => {
    if (id) void fetchOrder();
  }, [id, fetchOrder]);

  async function patchOrder(patch: Partial<SalesOrderDetail>) {
    setSaving(true);
    const { error } = await supabase
      .from("sales_orders")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error(formatError(error));
      return false;
    }
    await fetchOrder();
    return true;
  }

  async function saveQuote() {
    const amt = parseFloat(quoteAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a positive quote amount");
      return;
    }
    const ok = await patchOrder({
      quote_amount: amt,
      quote_currency: orderCurrency,
      currency: orderCurrency,
      quote_sent_at: order?.quote_sent_at ?? new Date().toISOString(),
    });
    if (ok) toast.success("Quote saved");
  }
  async function markQuoteAccepted() {
    if (!order?.quote_sent_at) {
      toast.error("Send the quote first");
      return;
    }
    const ok = await patchOrder({ quote_accepted_at: new Date().toISOString() });
    if (ok) toast.success("Quote accepted");
  }

  async function saveDeposit() {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a positive deposit amount");
      return;
    }
    // Lifecycle guard: the DB now enforces a CHECK that
    // deposit_paid_at requires quote_sent_at (migration 132). Show a
    // friendlier toast here than the raw constraint violation.
    if (!order?.quote_sent_at) {
      toast.error("Quote must be sent first");
      return;
    }
    // The quote lifecycle fills quote_amount; selling_price stays null until
    // the order is finalised. Cap the deposit against whichever price is set.
    const priceCap = order?.selling_price ?? order?.quote_amount ?? null;
    if (priceCap != null && Number.isFinite(priceCap) && amt > priceCap) {
      toast.error(
        `Deposit (${amt.toLocaleString()}) cannot exceed the price (${priceCap.toLocaleString()}).`
      );
      return;
    }
    const ok = await patchOrder({
      deposit_amount: amt,
      deposit_currency: orderCurrency,
      currency: orderCurrency,
      deposit_method: depositMethod || null,
      deposit_paid_at: order?.deposit_paid_at ?? new Date().toISOString(),
      // Auto-advance status
      status: order?.status === "draft" ? ("reserved" as SaleStatus) : order!.status,
    });
    if (ok) toast.success("Deposit recorded");
  }

  async function saveContract() {
    const trimmed = contractUrl.trim();
    if (trimmed && !/^https?:\/\/[^\s]+$/i.test(trimmed)) {
      toast.error("Contract URL must start with http:// or https://");
      return;
    }
    const ok = await patchOrder({
      signed_contract_url: trimmed || null,
      contract_signed_at: trimmed ? new Date().toISOString() : null,
      status: order?.status === "draft" || order?.status === "reserved" ? ("confirmed" as SaleStatus) : order!.status,
    });
    if (ok) toast.success(trimmed ? "Contract recorded" : "Contract cleared");
  }

  async function markDelivered() {
    if (!confirm("Mark this sale as delivered? This is the final step and will set the customer to converted.")) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("complete_delivery", {
        p_sales_order_id: id,
        p_notes: deliveryNotes || null,
      });
      if (error) {
        toast.error(formatError(error));
        return;
      }
      toast.success("Delivered. Customer marked as converted.");
    } finally {
      // Always refetch — even on error the RPC may have partially applied
      // (e.g. updated the order but failed to insert the car_event row).
      // Refetching keeps the UI honest with the DB.
      setSaving(false);
      await fetchOrder();
    }
  }

  async function confirmVoidSale() {
    if (!order) return;
    if (!voidReason.trim()) {
      toast.error("A reason is required to void a sale.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("void_sales_order", {
        p_sales_order_id: order.id,
        p_reason: voidReason.trim(),
      });
      if (error) {
        toast.error(formatError(error));
        return;
      }
      toast.success("Sale voided.");
      setVoidOpen(false);
      setVoidReason("");
    } finally {
      setSaving(false);
      await fetchOrder();
    }
  }

  async function changeStatus(next: SaleStatus) {
    // Going TO 'delivered' must happen via complete_delivery() — the DB
    // enforces (status='delivered') = (delivered_at IS NOT NULL), so a plain
    // patch would either be blocked or leave the row in an inconsistent
    // state. Route the user to the proper button.
    if (next === "delivered") {
      toast.error("Use the 'Mark delivered' button at the bottom — it runs the proper checks.");
      return;
    }
    // Coming FROM 'delivered' is rejected by the DB trigger (migration 131)
    // unless the caller is owner AND the change goes through the void path.
    // Force users to the Void button so the audit trail is complete.
    if (order?.status === "delivered") {
      toast.error("Delivered sales can only be reversed via the 'Void sale' button.");
      return;
    }
    const ok = await patchOrder({ status: next });
    if (ok) toast.success(`Status: ${next}`);
  }

  if (loading || !order) {
    return <div className="container mx-auto py-12 text-muted-foreground">Loading…</div>;
  }

  const car = order.cars;
  const customer = order.customers;

  // Lifecycle stepper state
  const steps: { key: string; label: string; done: boolean; date?: string | null }[] = [
    { key: "quote", label: "Quote", done: !!order.quote_sent_at, date: order.quote_sent_at },
    { key: "accepted", label: "Accepted", done: !!order.quote_accepted_at, date: order.quote_accepted_at },
    { key: "deposit", label: "Deposit", done: !!order.deposit_paid_at, date: order.deposit_paid_at },
    { key: "contract", label: "Contract", done: !!order.contract_signed_at, date: order.contract_signed_at },
    { key: "delivered", label: "Delivered", done: !!order.delivered_at, date: order.delivered_at },
  ];

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/sales-orders")}>
            <ArrowLeft className="mr-2 size-4" />
            All orders
          </Button>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">
              {car ? `${car.brand} ${car.model}` : "Sales order"}
              {car?.model_year ? ` (${car.model_year})` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              VIN <span className="font-mono">{car?.vin ?? "—"}</span> · created {fmtDate(order.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLORS[order.status]}>{order.status}</Badge>
          {canEdit && order.status !== "delivered" && order.status !== "cancelled" && (
            <Select value={order.status} onValueChange={(v) => changeStatus(v as SaleStatus)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                {/* "Delivered" intentionally NOT a manual option — use the
                    "Mark delivered" button so complete_delivery() runs its
                    quote/deposit/contract checks. */}
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Lifecycle stepper */}
      <Card data-tour-id="sales-order-detail-stepper">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex h-8 min-w-32 items-center gap-2 rounded-full border px-3 text-sm ${
                    s.done
                      ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {s.done ? <CheckCircle2 className="size-4" /> : <span className="size-4 rounded-full border border-current" />}
                  <span className="font-medium">{s.label}</span>
                  {s.date && <span className="text-xs opacity-70">{fmtDate(s.date)}</span>}
                </div>
                {i < steps.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer */}
        <Card>
          <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {customer ? (
              <>
                <div>
                  <Link
                    href={`/customers/${customer.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {customerName(customer)}
                  </Link>
                </div>
                {customer.phone_primary && <div className="text-muted-foreground">📞 {customer.phone_primary}</div>}
                {customer.email && <div className="text-muted-foreground">✉ {customer.email}</div>}
                {customer.lead_status && (
                  <div>
                    <Badge variant="outline" className="text-xs">Lead: {customer.lead_status}</Badge>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No customer linked.</p>
            )}
          </CardContent>
        </Card>

        {/* Selling price */}
        <Card>
          <CardHeader><CardTitle className="text-base">Selling price</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p className="text-2xl font-semibold tabular-nums">
              {fmtMoney(order.selling_price, order.currency)}
            </p>
            {committedTradeIns.length > 0 && (() => {
              const tradeInTotal = committedTradeIns.reduce(
                (sum, t) => sum + (Number(t.accepted_value) || 0),
                0
              );
              const net =
                order.selling_price != null
                  ? Number(order.selling_price) - tradeInTotal
                  : null;
              return (
                <div className="mt-2 space-y-0.5 border-t pt-2">
                  <p className="text-muted-foreground">
                    Trade-in credit:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      −{fmtMoney(tradeInTotal, order.currency)}
                    </span>
                  </p>
                  {net != null && (
                    <p className="text-sm font-semibold tabular-nums">
                      Net after trade-in: {fmtMoney(net, order.currency)}
                    </p>
                  )}
                </div>
              );
            })()}
            <p className="mt-2 text-muted-foreground">Sale date: {fmtDate(order.sale_date)}</p>
            <p className="text-muted-foreground">Planned delivery: {fmtDate(order.delivery_date)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Committed trade-ins — what credit is being applied to this sale. */}
      {committedTradeIns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Repeat className="size-4" /> Trade-ins applied
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {committedTradeIns.map((t) => {
              const vehicle =
                [t.vehicle_year, t.vehicle_make, t.vehicle_model]
                  .filter(Boolean)
                  .join(" ") || "—";
              return (
                <Link
                  key={t.id}
                  href={`/trade-ins/${t.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm transition hover:bg-muted"
                >
                  <div>
                    <div className="font-medium text-primary">
                      {t.trade_in_number}
                    </div>
                    <div className="text-muted-foreground">{vehicle}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">
                      {fmtMoney(t.accepted_value, t.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Accepted value
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Quote */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> Quote
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="quote-amount">Amount</Label>
              <Input
                id="quote-amount" type="number" inputMode="decimal" min={0} step="any"
                value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="quote-currency">
                Currency
                <FieldHint text="The currency for this whole order — picking it here applies to the quote, deposit, and contract." />
              </Label>
              <Select value={orderCurrency} onValueChange={setOrderCurrency} disabled={!canEdit}>
                <SelectTrigger id="quote-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={saveQuote} disabled={!canEdit || saving} className="flex-1" data-tour-id="sales-order-detail-save-quote">
                {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                {saving ? "Saving…" : order.quote_sent_at ? "Update quote" : "Send quote"}
              </Button>
              {order.quote_sent_at && !order.quote_accepted_at && (
                <Button variant="outline" onClick={markQuoteAccepted} disabled={!canEdit || saving}>
                  Mark accepted
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Sent: {fmtDT(order.quote_sent_at)} · Accepted: {fmtDT(order.quote_accepted_at)}
          </p>
        </CardContent>
      </Card>

      {/* Deposit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4" /> Deposit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label htmlFor="deposit-amount">Amount</Label>
              <Input
                id="deposit-amount" type="number" inputMode="decimal" min={0} step="any"
                value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="deposit-currency">Currency</Label>
              <Select value={orderCurrency} onValueChange={setOrderCurrency} disabled={!canEdit}>
                <SelectTrigger id="deposit-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deposit-method">
                Method
                <FieldHint text="How the customer paid the deposit — cash, bank wire, or card." />
              </Label>
              <Input
                id="deposit-method" placeholder="cash / wire / card"
                value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={saveDeposit} disabled={!canEdit || saving} className="w-full" data-tour-id="sales-order-detail-save-deposit">
                {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                {saving ? "Saving…" : order.deposit_paid_at ? "Update deposit" : "Mark paid"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Paid at: {fmtDT(order.deposit_paid_at)}
          </p>
        </CardContent>
      </Card>

      {/* Contract */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" /> Signed contract
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="contract-url">
              Contract URL
              <FieldHint text="A link to the scanned, signed contract document — stored online so anyone can open it." />
            </Label>
            <Input
              id="contract-url"
              type="url"
              inputMode="url"
              placeholder="https://… (Drive / Dropbox / Supabase storage link)"
              value={contractUrl}
              onChange={(e) => setContractUrl(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Signed at: {fmtDT(order.contract_signed_at)}
            </p>
            <Button onClick={saveContract} disabled={!canEdit || saving} variant="outline">
              {order.signed_contract_url ? "Update" : "Save"}
            </Button>
          </div>
          {order.signed_contract_url && (
            <a
              href={order.signed_contract_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm text-primary hover:underline"
            >
              Open contract ↗
            </a>
          )}
        </CardContent>
      </Card>

      {/* Delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4" /> Delivery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.delivered_at ? (
            <div className="rounded-md border border-green-500/30 bg-green-50 p-3 text-sm dark:bg-green-950">
              ✓ Delivered on {fmtDT(order.delivered_at)}.
              {order.delivery_notes && (
                <p className="mt-1 text-muted-foreground">Notes: {order.delivery_notes}</p>
              )}
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="delivery-notes">Delivery notes (optional)</Label>
                <Textarea
                  id="delivery-notes"
                  placeholder="Plates issued, keys handed over, walkthrough completed…"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  disabled={!canEdit}
                />
              </div>
              <Button
                onClick={markDelivered}
                disabled={!canEdit || saving}
                className="bg-green-600 hover:bg-green-700"
              >
                Mark delivered
              </Button>
              <p className="text-xs text-muted-foreground">
                This stamps delivery time, advances order status to <span className="font-mono">delivered</span>,
                and sets the customer&apos;s lead status to <span className="font-mono">converted</span>.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Void notice — only when the sale was voided */}
      {order.status === "cancelled" && order.void_at && (
        <Card className="border-red-300/60 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-base text-red-700 dark:text-red-300">Sale voided</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Voided on {fmtDT(order.void_at)}.</p>
            {order.void_reason && (
              <p className="text-muted-foreground">
                <span className="font-medium">Reason:</span> {order.void_reason}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Owner-only void action — for delivered or in-progress sales that
          need to be reversed (return, cancel, error). */}
      {appRole === "owner" && order.status !== "cancelled" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reverse this sale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Owner-only. Cancels the sale, returns the car to inventory, and
              reverts the customer&apos;s lead status if they were auto-converted.
            </p>
            <Button variant="destructive" onClick={() => setVoidOpen(true)} disabled={saving} data-tour-id="sales-order-detail-void-button">
              Void sale…
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{order.notes}</CardContent>
        </Card>
      )}

      {/* Payment plan link */}
      {order.customer_id && (
        <Card>
          <CardHeader><CardTitle className="text-base">Payment plan</CardTitle></CardHeader>
          <CardContent>
            <Link
              href={`/installments?customer=${order.customer_id}`}
              className="text-sm text-primary hover:underline"
            >
              View / create payment plan for this customer →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Void dialog — replaces the old window.prompt(). Owner-only access
          is still enforced by the void_sales_order RPC; this just gives a
          properly-styled, accessible modal for the reason. */}
      <Dialog
        open={voidOpen}
        onOpenChange={(open) => {
          setVoidOpen(open);
          if (!open) setVoidReason("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void this sale?</DialogTitle>
            <DialogDescription>
              The car returns to inventory and the customer&apos;s lead status
              reverts from &quot;converted&quot; back to &quot;interested&quot;. The void is
              recorded in the audit log. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="void-reason"
              className="text-sm font-medium leading-none"
            >
              Reason
            </label>
            <Textarea
              id="void-reason"
              autoFocus
              rows={3}
              placeholder="e.g. Customer changed their mind; returned within 24h."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setVoidOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmVoidSale}
              disabled={saving || !voidReason.trim()}
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              Void sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
