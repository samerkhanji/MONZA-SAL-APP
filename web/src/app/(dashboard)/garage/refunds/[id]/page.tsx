"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ArrowLeft, Check, X } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import {
  approveRefund,
  rejectRefund,
} from "@/lib/server/actions/money-mover";
import { cn } from "@/lib/utils";

interface Refund {
  id: string;
  refund_number: string;
  kind: "parts" | "service";
  customer_id: string;
  job_id: string | null;
  invoice_id: string | null;
  warranty_case_id: string | null;
  part_id: string | null;
  quantity: number | null;
  amount: number;
  currency: string;
  reason: string;
  notes: string | null;
  approval_required: "auto" | "manager" | "owner";
  status: "pending" | "approved" | "rejected" | "paid" | "cancelled";
  requested_at: string;
  requested_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_method: string | null;
}

const fmt = (n: number, c = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n);

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-muted text-foreground",
};

export default function RefundDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const router = useRouter();
  const supabase = createClient();
  const { isOwner, hasCapability, profile } = useUser();
  const canApproveAny = isOwner || hasCapability("manage_team");
  const canPay = isOwner || hasCapability("cashier");

  const [refund, setRefund] = useState<Refund | null>(null);
  const [customer, setCustomer] = useState<{ id: string; full_name?: string | null; name?: string | null } | null>(null);
  const [requesterName, setRequesterName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "bank" | "credit" | "other">("cash");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("refunds")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      toast.error(formatError(error));
      setLoading(false);
      return;
    }
    setRefund(data as Refund);
    if ((data as Refund).customer_id) {
      const { data: c } = await supabase
        .from("customers_display")
        .select("id, full_name")
        .eq("id", (data as Refund).customer_id)
        .single();
      setCustomer((c as { id: string; full_name?: string | null; name?: string | null } | null) ?? null);
    }
    const requestedBy = (data as Refund).requested_by;
    if (requestedBy) {
      const { data: rp } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", requestedBy)
        .single();
      setRequesterName((rp as { full_name?: string | null } | null)?.full_name ?? null);
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="container space-y-3 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!refund) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        Refund not found.
        <div className="mt-3">
          <Button variant="link" asChild>
            <Link href="/garage/refunds"><ArrowLeft className="mr-1 size-3" /> Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  const requesterIsMe = profile?.id && refund.requested_by === profile.id;
  const isPending = refund.status === "pending";
  const isApproved = refund.status === "approved";

  // Approve / reject visibility:
  // - owner-required refunds: only owner sees the action
  // - manager-required (or auto): owner or manage_team
  const canActOnApproval =
    isPending &&
    (refund.approval_required === "owner" ? isOwner : canApproveAny);

  async function approve() {
    if (!refund) return;
    setActing(true);
    const result = await approveRefund(refund.id);
    setActing(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Refund approved");
    void load();
  }

  async function reject() {
    if (!refund) return;
    if (!rejectReason.trim()) return toast.error("Rejection reason is required");
    setActing(true);
    const result = await rejectRefund(refund.id, rejectReason.trim());
    setActing(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Refund rejected");
    setRejectOpen(false);
    setRejectReason("");
    void load();
  }

  async function pay() {
    if (!refund) return;
    setActing(true);
    const { error } = await supabase.rpc("mark_refund_paid", { p_refund_id: refund.id, p_method: payMethod });
    setActing(false);
    if (error) return toast.error(formatError(error));
    toast.success("Marked as paid");
    setPayOpen(false);
    void load();
  }

  async function cancel() {
    if (!refund) return;
    setActing(true);
    const { error } = await supabase.rpc("cancel_refund", { p_refund_id: refund.id });
    setActing(false);
    if (error) return toast.error(formatError(error));
    toast.success("Refund cancelled");
    void load();
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link data-tour-id="refund-detail-back" href="/garage/refunds" className="text-muted-foreground inline-flex items-center text-xs hover:underline">
            <ArrowLeft className="mr-1 size-3" /> Refunds
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-semibold">{refund.refund_number}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("h-6 px-2 text-[11px] uppercase", STATUS_COLOR[refund.status] ?? "")}>
            {refund.status}
          </Badge>
          <Badge variant="outline" className="h-6 px-2 text-[11px] uppercase">
            {refund.approval_required} approval
          </Badge>
        </div>
      </div>

      <Card data-tour-id="refund-detail-summary">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Customer</Label>
            <p className="font-medium">
              {customer ? (
                <Link href={`/customers/${customer.id}`} className="hover:underline">
                  {customer.full_name ?? customer.name ?? customer.id}
                </Link>
              ) : "—"}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Kind</Label>
            <p className="font-medium capitalize">{refund.kind}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Amount</Label>
            <p className="font-mono text-lg">{fmt(Number(refund.amount), refund.currency)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Requested</Label>
            <p>{new Date(refund.requested_at).toLocaleString()}</p>
          </div>
          {refund.job_id && (
            <div>
              <Label className="text-muted-foreground text-xs uppercase">Linked job</Label>
              <p>
                <Link href={`/garage/jobs/${refund.job_id}`} className="hover:underline">View job</Link>
              </p>
            </div>
          )}
          {refund.warranty_case_id && (
            <div>
              <Label className="text-muted-foreground text-xs uppercase">Warranty case</Label>
              <p>
                <Link href={`/garage/warranty/${refund.warranty_case_id}`} className="hover:underline">View warranty case</Link>
              </p>
            </div>
          )}
          <div className="sm:col-span-2">
            <Label className="text-muted-foreground text-xs uppercase">Reason</Label>
            <p className="whitespace-pre-wrap">{refund.reason}</p>
          </div>
          {refund.notes && (
            <div className="sm:col-span-2">
              <Label className="text-muted-foreground text-xs uppercase">Notes</Label>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{refund.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {(refund.approved_at || refund.rejected_at || refund.paid_at) && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="text-muted-foreground text-xs uppercase">Timeline</div>
            {refund.approved_at && (
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-600" />
                <span>Approved {new Date(refund.approved_at).toLocaleString()}</span>
              </div>
            )}
            {refund.rejected_at && (
              <div className="flex items-center gap-2">
                <X className="size-3.5 text-red-600" />
                <span>Rejected {new Date(refund.rejected_at).toLocaleString()}</span>
                {refund.rejection_reason && (
                  <span className="text-muted-foreground"> — {refund.rejection_reason}</span>
                )}
              </div>
            )}
            {refund.paid_at && (
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-600" />
                <span>Paid via {refund.payment_method} on {new Date(refund.paid_at).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div data-tour-id="refund-detail-actions" className="flex flex-wrap gap-2">
        {canActOnApproval && (
          <>
            <Button data-tour-id="refund-detail-approve" onClick={() => void approve()} disabled={acting}>
              <Check className="mr-1.5 size-4" /> Approve
            </Button>
            <Button data-tour-id="refund-detail-reject" variant="outline" onClick={() => setRejectOpen(true)} disabled={acting}>
              <X className="mr-1.5 size-4" /> Reject
            </Button>
          </>
        )}
        {isApproved && canPay && (
          <Button data-tour-id="refund-detail-pay" onClick={() => setPayOpen(true)} disabled={acting}>
            Mark as paid
          </Button>
        )}
        {isPending && (isOwner || requesterIsMe) && (
          <Button data-tour-id="refund-detail-cancel" variant="outline" onClick={() => void cancel()} disabled={acting}>
            Cancel request
          </Button>
        )}
      </div>

      {refund.approval_required === "owner" && isPending && !isOwner && (
        <p className="text-muted-foreground text-xs">
          This refund is above the owner threshold and can only be approved by
          the owner.
        </p>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject refund</DialogTitle>
            <DialogDescription>
              The original requester is notified with this reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            placeholder="Why is this being rejected?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={acting}>Cancel</Button>
            <Button onClick={() => void reject()} disabled={acting || !rejectReason.trim()}>
              {acting ? "Rejecting…" : "Reject refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark refund paid</DialogTitle>
            <DialogDescription>
              Record how the customer was reimbursed.
            </DialogDescription>
          </DialogHeader>
          <Label>Payment method</Label>
          <Select value={payMethod} onValueChange={(v) => setPayMethod(v as typeof payMethod)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="credit">Store credit</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={acting}>Cancel</Button>
            <Button onClick={() => void pay()} disabled={acting}>
              {acting ? "Saving…" : "Confirm paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-muted-foreground text-xs">
        {requesterIsMe
          ? "Routed by you."
          : `Routed by ${
              refund.requested_by
                ? requesterName ?? `user ${refund.requested_by.slice(0, 8)}…`
                : "system"
            }.`}
      </p>
    </div>
  );
}
