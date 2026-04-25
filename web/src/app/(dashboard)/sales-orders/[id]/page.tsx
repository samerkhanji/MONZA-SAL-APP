"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileText, CheckCircle2, Truck, Receipt } from "lucide-react";

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

  // Editable form state for the lifecycle blocks
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState("USD");
  const [depositMethod, setDepositMethod] = useState("");
  const [contractUrl, setContractUrl] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

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
      toast.error(error?.message ?? "Sales order not found");
      router.push("/sales-orders");
      return;
    }
    const row = data as unknown as SalesOrderDetail;
    setOrder(row);
    setQuoteAmount(row.quote_amount != null ? String(row.quote_amount) : "");
    setQuoteCurrency(row.quote_currency ?? row.currency ?? "USD");
    setDepositAmount(row.deposit_amount != null ? String(row.deposit_amount) : "");
    setDepositCurrency(row.deposit_currency ?? row.currency ?? "USD");
    setDepositMethod(row.deposit_method ?? "");
    setContractUrl(row.signed_contract_url ?? "");
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
      toast.error(error.message);
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
      quote_currency: quoteCurrency,
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
    const ok = await patchOrder({
      deposit_amount: amt,
      deposit_currency: depositCurrency,
      deposit_method: depositMethod || null,
      deposit_paid_at: order?.deposit_paid_at ?? new Date().toISOString(),
      // Auto-advance status
      status: order?.status === "draft" ? ("reserved" as SaleStatus) : order!.status,
    });
    if (ok) toast.success("Deposit recorded");
  }

  async function saveContract() {
    const ok = await patchOrder({
      signed_contract_url: contractUrl || null,
      contract_signed_at: contractUrl ? new Date().toISOString() : null,
      status: order?.status === "draft" || order?.status === "reserved" ? ("confirmed" as SaleStatus) : order!.status,
    });
    if (ok) toast.success(contractUrl ? "Contract recorded" : "Contract cleared");
  }

  async function markDelivered() {
    if (!confirm("Mark this sale as delivered? This is the final step and will set the customer to converted.")) return;
    setSaving(true);
    const { error } = await supabase.rpc("complete_delivery", {
      p_sales_order_id: id,
      p_notes: deliveryNotes || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Delivered. Customer marked as converted.");
    await fetchOrder();
  }

  async function changeStatus(next: SaleStatus) {
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
          {canEdit && (
            <Select value={order.status} onValueChange={(v) => changeStatus(v as SaleStatus)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Lifecycle stepper */}
      <Card>
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
            <p className="mt-2 text-muted-foreground">Sale date: {fmtDate(order.sale_date)}</p>
            <p className="text-muted-foreground">Planned delivery: {fmtDate(order.delivery_date)}</p>
          </CardContent>
        </Card>
      </div>

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
                id="quote-amount" type="number" min={0} step="any"
                value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="quote-currency">Currency</Label>
              <Select value={quoteCurrency} onValueChange={setQuoteCurrency} disabled={!canEdit}>
                <SelectTrigger id="quote-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={saveQuote} disabled={!canEdit || saving} className="flex-1">
                {order.quote_sent_at ? "Update quote" : "Send quote"}
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
                id="deposit-amount" type="number" min={0} step="any"
                value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="deposit-currency">Currency</Label>
              <Select value={depositCurrency} onValueChange={setDepositCurrency} disabled={!canEdit}>
                <SelectTrigger id="deposit-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CCY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deposit-method">Method</Label>
              <Input
                id="deposit-method" placeholder="cash / wire / card"
                value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={saveDeposit} disabled={!canEdit || saving} className="w-full">
                {order.deposit_paid_at ? "Update deposit" : "Mark paid"}
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
            <Label htmlFor="contract-url">Contract URL</Label>
            <Input
              id="contract-url"
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
    </div>
  );
}
