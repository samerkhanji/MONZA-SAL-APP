"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

interface TradeIn {
  id: string;
  trade_in_number: string;
  customer_id: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_vin: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  vehicle_trim: string | null;
  mileage_km: number | null;
  currency: string;
  provisional_value: number;
  recommended_value: number | null;
  estimated_repair_cost: number | null;
  accepted_value: number | null;
  condition: string | null;
  inspection_notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  inspected_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  linked_sales_order_id: string | null;
  committed_at: string | null;
}

interface Issue {
  id: string;
  description: string;
  severity: string;
  estimated_cost: number | null;
  notes: string | null;
  created_at: string;
}

interface Doc {
  id: string;
  storage_path: string;
  filename: string;
  kind: string;
  caption: string | null;
  created_at: string;
}

interface CustomerLite { id: string; full_name?: string | null; name?: string | null; }
interface SalesOrderLite { id: string; vin: string | null; selling_price: number | null; currency: string | null; status: string | null; customer_id: string | null; }

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
    : new Intl.NumberFormat("en-US", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(Number(n));

// Sanity caps — friendly client-side limits, comfortably below the DB numeric
// overflow. The company operates in USD (migration 158).
const MAX_TRADE_IN_VALUE = 100_000_000;
const MAX_ISSUE_COST = 1_000_000;

// Inspection issues are part of the audit trail — only editable while the
// trade-in is still being worked (before owner approval).
const ISSUE_EDITABLE_STATUSES = ["provisional", "inspecting"];

export default function TradeInDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const supabase = createClient();
  const { isOwner, hasCapability, profile } = useUser();

  const canGarage = isOwner || hasCapability("garage");
  const canSales = isOwner || hasCapability("sales");

  const [t, setT] = useState<TradeIn | null>(null);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // dialogs
  const [inspectOpen, setInspectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [deletingIssue, setDeletingIssue] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [w, i, d] = await Promise.all([
      supabase.from("trade_ins").select("*").eq("id", id).single(),
      supabase.from("trade_in_issues").select("*").eq("trade_in_id", id).order("created_at"),
      supabase.from("trade_in_documents").select("*").eq("trade_in_id", id).order("created_at", { ascending: false }),
    ]);
    if (w.error) {
      toast.error(formatError(w.error));
      setLoading(false);
      return;
    }
    const ti = w.data as TradeIn;
    setT(ti);
    if (ti.customer_id) {
      const { data: c } = await supabase.from("customers_display").select("id, full_name").eq("id", ti.customer_id).single();
      setCustomer((c as CustomerLite | null) ?? null);
    }
    setIssues((i.data as Issue[]) ?? []);
    setDocs((d.data as Doc[]) ?? []);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function startInspection() {
    setActing(true);
    const { error } = await supabase.rpc("start_trade_in_inspection", { p_trade_in_id: id });
    setActing(false);
    if (error) return toast.error(formatError(error));
    toast.success("Inspection started");
    void load();
  }

  async function confirmDeleteIssue() {
    if (!issueToDelete) return;
    setDeletingIssue(true);
    try {
      const { error } = await supabase
        .from("trade_in_issues")
        .delete()
        .eq("id", issueToDelete.id);
      if (error) {
        toast.error(formatError(error));
        return;
      }
      toast.success("Issue removed");
      setIssueToDelete(null);
      await load();
    } finally {
      setDeletingIssue(false);
    }
  }

  async function cancel() {
    setActing(true);
    const trimmedReason = cancelReason.trim();
    const { error } = await supabase.rpc("cancel_trade_in", {
      p_trade_in_id: id,
      ...(trimmedReason ? { p_reason: trimmedReason } : {}),
    });
    setActing(false);
    if (error) return toast.error(formatError(error));
    toast.success("Trade-in cancelled");
    setCancelOpen(false);
    setCancelReason("");
    void load();
  }

  async function uploadDocs(files: FileList | null) {
    if (!t || !files || files.length === 0) return;
    const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    const MAX_BYTES = 10 * 1024 * 1024;
    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        toast.error(
          `${file.name}: only PDF and image files (JPEG, PNG, WebP) are allowed`
        );
        return;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: file size must be under 10MB`);
        return;
      }
    }
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id ?? null;
    for (const file of Array.from(files)) {
      const path = `trade-ins/${t.id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("job-documents").upload(path, file);
      if (up.error) {
        toast.error(`Upload failed: ${up.error.message}`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      const { error } = await supabase.from("trade_in_documents").insert({
        trade_in_id: t.id,
        storage_path: path,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        kind: isImage ? "photo" : "document",
        created_by: uid,
      });
      if (error) toast.error(formatError(error));
    }
    setUploading(false);
    void load();
  }

  // Only show the full-page skeleton on the first load. Refetches after an
  // action keep the existing content on screen (no jarring blank flash).
  if (loading && !t) {
    return (
      <div className="container space-y-3 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!t) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        Trade-in not found.
        <div className="mt-3">
          <Button variant="link" asChild>
            <Link href="/trade-ins"><ArrowLeft className="mr-1 size-3" /> Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isRequester = profile?.id && t.created_by === profile.id;
  const canCancel = (t.status !== "committed" && t.status !== "rejected" && t.status !== "cancelled") && (isOwner || (isRequester && canSales));

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/trade-ins" className="text-muted-foreground inline-flex items-center text-xs hover:underline">
            <ArrowLeft className="mr-1 size-3" /> Trade-ins
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-semibold">{t.trade_in_number}</h1>
          <p className="text-muted-foreground">
            {t.vehicle_year ? `${t.vehicle_year} ` : ""}{t.vehicle_make} {t.vehicle_model}
            {t.vehicle_trim ? ` ${t.vehicle_trim}` : ""}
          </p>
        </div>
        <Badge variant="outline" className={cn("h-6 px-2 text-[11px] uppercase", STATUS_COLOR[t.status] ?? "")}>
          {t.status}
        </Badge>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Customer</Label>
            <p>{customer ? (customer.full_name ?? customer.name ?? "—") : "—"}</p>
            {customer && <Link href={`/customers/${customer.id}`} className="text-xs text-sky-600 hover:underline">View customer</Link>}
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">VIN</Label>
            <p className="font-mono text-xs">{t.vehicle_vin ?? "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Plate</Label>
            <p>{t.vehicle_plate ?? "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Color</Label>
            <p>{t.vehicle_color ?? "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Mileage</Label>
            <p>{t.mileage_km != null ? `${t.mileage_km.toLocaleString()} km` : "—"}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Condition</Label>
            <p className="capitalize">{t.condition ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Provisional (sales)</Label>
            <p className="text-lg font-mono">{fmt(t.provisional_value, t.currency)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Recommended (garage)</Label>
            <p className="text-lg font-mono">{fmt(t.recommended_value, t.currency)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Accepted (owner)</Label>
            <p className={cn("text-lg font-mono", t.accepted_value != null && "font-bold text-emerald-700 dark:text-emerald-400")}>
              {fmt(t.accepted_value, t.currency)}
            </p>
          </div>
          {t.estimated_repair_cost != null && (
            <div>
              <Label className="text-muted-foreground text-xs uppercase">Estimated repair cost</Label>
              <p>{fmt(t.estimated_repair_cost, t.currency)}</p>
            </div>
          )}
          {t.inspection_notes && (
            <div className="sm:col-span-3">
              <Label className="text-muted-foreground text-xs uppercase">Inspection notes</Label>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{t.inspection_notes}</p>
            </div>
          )}
          {t.linked_sales_order_id && (
            <div className="sm:col-span-3">
              <Label className="text-muted-foreground text-xs uppercase">Linked sale</Label>
              <Link href={`/sales-orders/${t.linked_sales_order_id}`} className="text-sky-600 hover:underline">
                View sales order
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Inspection issues</h2>
            <span className="text-muted-foreground text-xs">{issues.length} issue{issues.length === 1 ? "" : "s"}</span>
          </div>
          {issues.length === 0 ? (
            <p className="text-muted-foreground text-sm">No issues logged yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {issues.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium">{i.description}</span>
                    <Badge variant="outline" className="ml-2 h-4 px-1.5 text-[10px] uppercase">{i.severity}</Badge>
                    {i.notes && <p className="text-muted-foreground text-xs">{i.notes}</p>}
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs">{fmt(i.estimated_cost, t.currency)}</span>
                    {canGarage && ISSUE_EDITABLE_STATUSES.includes(t.status) && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="ml-1"
                        aria-label="Remove issue"
                        onClick={() => setIssueToDelete(i)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canGarage && (t.status === "provisional" || t.status === "inspecting") && (
            <AddIssueForm tradeInId={t.id} onAdded={load} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Photos &amp; documents</h2>
            <span className="text-muted-foreground text-xs">{docs.length} file{docs.length === 1 ? "" : "s"}</span>
          </div>
          {docs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No photos attached yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span>{d.kind === "photo" ? "🖼" : "📄"} {d.filename}</span>
                  <span className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
          {(canGarage || canSales) && (
            <div>
              <Label htmlFor="ti-files" className="text-muted-foreground text-xs uppercase">Upload</Label>
              <Input
                id="ti-files"
                type="file"
                multiple
                accept=".pdf,image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => void uploadDocs(e.target.files)}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                {uploading
                  ? "Uploading…"
                  : "PDF or image (JPEG, PNG, WebP), up to 10MB."}{" "}
                Stored in <code>job-documents/trade-ins/{t.id}/</code>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <div className="text-muted-foreground text-xs uppercase">Timeline</div>
          <div>Requested {new Date(t.created_at).toLocaleString()}</div>
          {t.inspected_at && <div>Inspected {new Date(t.inspected_at).toLocaleString()}</div>}
          {t.approved_at && (
            <div className="text-emerald-700 dark:text-emerald-400">
              Approved {new Date(t.approved_at).toLocaleString()} — accepted value {fmt(t.accepted_value, t.currency)}
            </div>
          )}
          {t.rejected_at && (
            <div className="text-red-700 dark:text-red-400">
              Rejected {new Date(t.rejected_at).toLocaleString()}
              {t.rejection_reason && <> — {t.rejection_reason}</>}
            </div>
          )}
          {t.cancelled_at && (
            <div className="text-muted-foreground">
              Cancelled {new Date(t.cancelled_at).toLocaleString()}
              {t.cancellation_reason && <> — {t.cancellation_reason}</>}
            </div>
          )}
          {t.committed_at && (
            <div className="text-emerald-700 dark:text-emerald-400">
              Committed to sale {new Date(t.committed_at).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action drawer — visible action set depends on status + role */}
      <div className="flex flex-wrap gap-2">
        {t.status === "provisional" && canGarage && (
          <Button onClick={() => void startInspection()} disabled={acting} data-tour-id="trade-in-detail-start-inspection">Start inspection</Button>
        )}
        {(t.status === "provisional" || t.status === "inspecting") && canGarage && (
          <Button variant="outline" onClick={() => setInspectOpen(true)} disabled={acting}>
            Complete inspection
          </Button>
        )}
        {t.status === "inspected" && isOwner && (
          <>
            <Button onClick={() => setApproveOpen(true)} disabled={acting}>Approve</Button>
            <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={acting}>Reject</Button>
          </>
        )}
        {t.status === "approved" && (canSales || isOwner) && (
          <Button onClick={() => setCommitOpen(true)} disabled={acting}>
            Commit to sales order
          </Button>
        )}
        {canCancel && (
          <Button variant="outline" onClick={() => setCancelOpen(true)} disabled={acting}>Cancel</Button>
        )}
      </div>

      {t.status === "inspected" && !isOwner && (
        <p className="text-muted-foreground text-xs">
          Owner approval is required before this trade-in can affect any sale.
        </p>
      )}

      <InspectDialog
        open={inspectOpen}
        onClose={() => setInspectOpen(false)}
        tradeIn={t}
        onDone={() => { setInspectOpen(false); void load(); }}
      />
      <ApproveDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        tradeIn={t}
        onDone={() => { setApproveOpen(false); void load(); }}
      />
      <RejectDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        tradeIn={t}
        onDone={() => { setRejectOpen(false); void load(); }}
      />
      <CommitDialog
        open={commitOpen}
        onClose={() => setCommitOpen(false)}
        tradeIn={t}
        onDone={() => { setCommitOpen(false); void load(); }}
      />

      {/* Cancel dialog — replaces the old window.prompt(). Reason is optional. */}
      <Dialog
        open={cancelOpen}
        onOpenChange={(v) => {
          if (acting) return;
          setCancelOpen(v);
          if (!v) setCancelReason("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel trade-in</DialogTitle>
            <DialogDescription>
              This closes the trade-in. You can note a reason for the audit
              trail (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancelling (optional)"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={acting}
            >
              Keep trade-in
            </Button>
            <Button
              variant="destructive"
              onClick={() => void cancel()}
              disabled={acting}
            >
              {acting ? "Cancelling…" : "Cancel trade-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-issue confirmation — destructive, so confirm first. */}
      <Dialog
        open={issueToDelete !== null}
        onOpenChange={(v) => {
          if (deletingIssue) return;
          if (!v) setIssueToDelete(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove this inspection issue?</DialogTitle>
            <DialogDescription>
              {issueToDelete ? `"${issueToDelete.description}" will be permanently removed. ` : ""}
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueToDelete(null)} disabled={deletingIssue}>
              Keep issue
            </Button>
            <Button variant="destructive" onClick={() => void confirmDeleteIssue()} disabled={deletingIssue}>
              {deletingIssue ? "Removing…" : "Remove issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddIssueForm({ tradeInId, onAdded }: { tradeInId: string; onAdded: () => void }) {
  const supabase = createClient();
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const missingDescription = !description.trim();
  async function add() {
    if (missingDescription) {
      setAttempted(true);
      return toast.error("Issue description is required.");
    }
    if (cost.trim()) {
      const cnum = Number(cost);
      if (!Number.isFinite(cnum) || cnum < 0) return toast.error("Est. cost must be ≥ 0");
      if (cnum > MAX_ISSUE_COST)
        return toast.error(`Est. cost can't exceed ${fmt(MAX_ISSUE_COST)}`);
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("trade_in_issues").insert({
      trade_in_id: tradeInId,
      description: description.trim(),
      severity,
      estimated_cost: cost ? Number(cost) : null,
      created_by: u?.user?.id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(formatError(error));
    setDescription("");
    setCost("");
    setAttempted(false);
    onAdded();
  }
  return (
    <div className="bg-muted/30 grid gap-2 rounded-md border p-3 sm:grid-cols-4">
      <div className="space-y-1 sm:col-span-2">
        <Input
          placeholder="Issue description *"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (e.target.value.trim()) setAttempted(false);
          }}
          aria-invalid={attempted && missingDescription}
          className={attempted && missingDescription ? "border-destructive focus-visible:ring-destructive" : undefined}
        />
        {attempted && missingDescription && (
          <p className="text-xs text-destructive">Issue description is required.</p>
        )}
      </div>
      <Select value={severity} onValueChange={setSeverity}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="cosmetic">Cosmetic</SelectItem>
          <SelectItem value="minor">Minor</SelectItem>
          <SelectItem value="major">Major</SelectItem>
          <SelectItem value="safety">Safety</SelectItem>
        </SelectContent>
      </Select>
      <Input type="number" min="0" max={MAX_ISSUE_COST} placeholder="Est. cost" value={cost} onChange={(e) => setCost(e.target.value)} />
      <div className="sm:col-span-4 flex justify-end">
        <Button size="sm" onClick={() => void add()} disabled={busy}>
          <Plus className="mr-1 size-3.5" /> Add issue
        </Button>
      </div>
    </div>
  );
}

function InspectDialog({
  open,
  onClose,
  tradeIn,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  tradeIn: TradeIn;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [condition, setCondition] = useState("good");
  const [mileage, setMileage] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [recommended, setRecommended] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCondition(tradeIn.condition ?? "good");
    setMileage(tradeIn.mileage_km != null ? String(tradeIn.mileage_km) : "");
    setRepairCost(tradeIn.estimated_repair_cost != null ? String(tradeIn.estimated_repair_cost) : "");
    setRecommended(tradeIn.recommended_value != null ? String(tradeIn.recommended_value) : String(tradeIn.provisional_value));
    setNotes(tradeIn.inspection_notes ?? "");
  }, [open, tradeIn]);

  async function submit() {
    const r = Number(recommended);
    if (!Number.isFinite(r) || r < 0) return toast.error("Recommended value must be ≥ 0");
    if (r > MAX_TRADE_IN_VALUE)
      return toast.error(`Recommended value can't exceed ${fmt(MAX_TRADE_IN_VALUE)}`);
    if (repairCost.trim()) {
      const rc = Number(repairCost);
      if (!Number.isFinite(rc) || rc < 0) return toast.error("Estimated repair cost must be ≥ 0");
      if (rc > MAX_ISSUE_COST)
        return toast.error(`Estimated repair cost can't exceed ${fmt(MAX_ISSUE_COST)}`);
    }
    setBusy(true);
    const trimmedNotes = notes.trim();
    const { error } = await supabase.rpc("complete_trade_in_inspection", {
      p_trade_in_id: tradeIn.id,
      p_condition: condition,
      p_recommended_value: r,
      ...(mileage ? { p_mileage_km: Number(mileage) } : {}),
      ...(repairCost ? { p_estimated_repair_cost: Number(repairCost) } : {}),
      ...(trimmedNotes ? { p_inspection_notes: trimmedNotes } : {}),
    });
    setBusy(false);
    if (error) return toast.error(formatError(error));
    toast.success("Inspection submitted — awaiting owner approval");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete inspection</DialogTitle>
          <DialogDescription>
            Owner approval is required before the trade-in becomes accepted.
            Add photos and issues first if you haven&apos;t already.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Condition *</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
                <SelectItem value="salvage">Salvage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Mileage (km)</Label>
            <Input type="number" min="0" value={mileage} onChange={(e) => setMileage(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Estimated repair cost</Label>
            <Input type="number" min="0" max={MAX_ISSUE_COST} step="0.01" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Recommended value *</Label>
            <Input type="number" min="0" max={MAX_TRADE_IN_VALUE} step="0.01" value={recommended} onChange={(e) => setRecommended(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Inspection notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Submitting…" : "Submit for owner approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApproveDialog({
  open,
  onClose,
  tradeIn,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  tradeIn: TradeIn;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setValue(tradeIn.recommended_value != null ? String(tradeIn.recommended_value) : "");
  }, [open, tradeIn]);
  async function submit() {
    if (!value.trim()) return toast.error("Accepted value is required.");
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return toast.error("Accepted value must be greater than 0.");
    if (v > MAX_TRADE_IN_VALUE)
      return toast.error(`Accepted value can't exceed ${fmt(MAX_TRADE_IN_VALUE)}.`);
    setBusy(true);
    const { error } = await supabase.rpc("approve_trade_in", {
      p_trade_in_id: tradeIn.id,
      p_accepted_value: v,
    });
    setBusy(false);
    if (error) return toast.error(formatError(error));
    toast.success("Trade-in approved");
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Approve trade-in</DialogTitle>
          <DialogDescription>
            Sets the binding accepted value. After approval, sales can commit
            this trade-in to a sales order.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/30 grid grid-cols-2 gap-2 rounded-md border p-3 text-xs">
            <div>
              <p className="text-muted-foreground">Provisional</p>
              <p className="font-mono">{fmt(tradeIn.provisional_value, tradeIn.currency)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Recommended</p>
              <p className="font-mono">{fmt(tradeIn.recommended_value, tradeIn.currency)}</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Accepted value ({tradeIn.currency}) *</Label>
            <Input type="number" min="0" max={MAX_TRADE_IN_VALUE} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  open,
  onClose,
  tradeIn,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  tradeIn: TradeIn;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  useEffect(() => { if (open) { setReason(""); setAttempted(false); } }, [open]);
  const missingReason = !reason.trim();
  async function submit() {
    if (missingReason) {
      setAttempted(true);
      return toast.error("A reason is required to reject a trade-in.");
    }
    setBusy(true);
    const { error } = await supabase.rpc("reject_trade_in", {
      p_trade_in_id: tradeIn.id,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) return toast.error(formatError(error));
    toast.success("Trade-in rejected");
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reject trade-in</DialogTitle>
          <DialogDescription>The requester is notified.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Reason *</Label>
          <Textarea
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setAttempted(false);
            }}
            placeholder="Why are you rejecting this trade-in?"
            aria-invalid={attempted && missingReason}
            className={attempted && missingReason ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {attempted && missingReason && (
            <p className="text-xs text-destructive">A reason is required to reject a trade-in.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommitDialog({
  open,
  onClose,
  tradeIn,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  tradeIn: TradeIn;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [salesOrderId, setSalesOrderId] = useState("");
  const [orders, setOrders] = useState<SalesOrderLite[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSalesOrderId("");
    void (async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("id, vin, selling_price, currency, status, customer_id")
        .eq("customer_id", tradeIn.customer_id)
        .in("status", ["reserved","draft","confirmed"])
        .order("created_at", { ascending: false })
        .limit(50);
      setOrders((data as SalesOrderLite[]) ?? []);
    })();
  }, [open, tradeIn, supabase]);

  async function submit() {
    if (!salesOrderId) return toast.error("Pick a sales order");
    const targetOrder = orders.find((o) => o.id === salesOrderId);
    if (
      targetOrder &&
      targetOrder.currency &&
      tradeIn.currency &&
      targetOrder.currency !== tradeIn.currency
    ) {
      return toast.error(
        `Currency mismatch: trade-in is in ${tradeIn.currency} but the sales order is in ${targetOrder.currency}.`
      );
    }
    setBusy(true);
    const { error } = await supabase.rpc("commit_trade_in_to_sale", {
      p_trade_in_id: tradeIn.id,
      p_sales_order_id: salesOrderId,
    });
    setBusy(false);
    if (error) return toast.error(formatError(error));
    toast.success("Trade-in committed to sale");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Commit trade-in to sale</DialogTitle>
          <DialogDescription>
            Pick an open sales order for the same customer. The accepted value
            ({fmt(tradeIn.accepted_value, tradeIn.currency)}) will apply as
            trade-in credit on that sale.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Sales order *</Label>
            {orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No open sales orders for this customer. Create one in{" "}
                <Link href="/sales-orders" className="text-sky-600 hover:underline">Sales Orders</Link>
                {" "}then come back.
              </p>
            ) : (
              <Select value={salesOrderId} onValueChange={setSalesOrderId}>
                <SelectTrigger><SelectValue placeholder="Pick a sales order" /></SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.vin ?? o.id.slice(0, 8)} — {fmt(o.selling_price, o.currency ?? "USD")} [{o.status}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || !salesOrderId}>
            {busy ? "Committing…" : "Commit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
