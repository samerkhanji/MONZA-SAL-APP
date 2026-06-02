"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { canRecordManualCashMovement } from "@/lib/permissions-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHint } from "@/components/ui/field-hint";
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
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Wallet } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

interface Drawer {
  id: string;
  name: string;
}
interface Settings {
  variance_threshold: number;
  currency: string;
}
interface Session {
  id: string;
  drawer_id: string;
  business_date: string;
  opened_at: string;
  opened_by: string | null;
  opening_balance: number;
  opening_note: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closing_actual: number | null;
  closing_note: string | null;
  variance: number | null;
  variance_note: string | null;
  status: "open" | "closed" | "flagged" | "pending_review";
  notes: string | null;
}
interface Movement {
  id: string;
  session_id: string;
  kind: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
  source_type: string | null;
  source_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}
interface ProfileLite {
  id: string;
  full_name: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  open: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  flagged: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const KIND_LABEL: Record<string, string> = {
  opening_float: "Opening float",
  installment_payment: "Installment payment",
  sale_deposit: "Sale deposit",
  service_payment: "Service payment",
  parts_payment: "Parts payment",
  refund: "Refund",
  expense: "Expense",
  manual_adjustment: "Manual adjustment",
  closing_count: "Closing count",
};

const fmt = (n: number | null | undefined, currency = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n);

export default function CashPage() {
  const { isOwner, hasCapability } = useUser();
  const allowed = isOwner || hasCapability("cashier") || hasCapability("manage_team");

  if (!allowed) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <AlertTriangle className="mx-auto mb-3 size-6" />
        <p>You don&apos;t have access to the cash register.</p>
        <Button variant="link" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }
  return <Body />;
}

function Body() {
  const supabase = createClient();
  const { isOwner, hasCapability, profile } = useUser();
  const canWrite = isOwner || hasCapability("cashier");
  const canRecordMovement = canRecordManualCashMovement(profile);

  const [drawers, setDrawers] = useState<Drawer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [openSession, setOpenSession] = useState<Session | null>(null);
  const [openSessionMoves, setOpenSessionMoves] = useState<Movement[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [dr, st, ss, hist, profs] = await Promise.all([
      supabase.from("cash_drawers").select("id, name").eq("active", true).order("name"),
      supabase.from("cash_settings").select("variance_threshold, currency").eq("id", "default").maybeSingle(),
      supabase
        .from("cash_sessions")
        .select("*")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("cash_sessions")
        .select("*")
        .neq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(30),
      supabase.from("profiles").select("id, full_name"),
    ]);
    if (dr.error) toast.error(formatError(dr.error));
    else setDrawers((dr.data as Drawer[]) ?? []);
    if (st.data) setSettings(st.data as Settings);
    setOpenSession((ss.data as Session | null) ?? null);
    setHistory((hist.data as Session[]) ?? []);
    const pm: Record<string, ProfileLite> = {};
    ((profs.data as ProfileLite[]) ?? []).forEach((p) => (pm[p.id] = p));
    setProfiles(pm);

    if (ss.data) {
      const { data: m } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("session_id", (ss.data as Session).id)
        .order("created_at");
      setOpenSessionMoves((m as Movement[]) ?? []);
    } else {
      setOpenSessionMoves([]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    // A cash session reconciles a single currency (cash_settings.currency).
    // Summing movements logged in another currency would corrupt the
    // expected total and the variance check, so only count matching-currency
    // movements here. otherCurrencyCount surfaces any that were excluded.
    const sessionCurrency = settings?.currency ?? "USD";
    const inCurrency = openSessionMoves.filter(
      (m) => (m.currency ?? "USD") === sessionCurrency
    );
    const otherCurrencyCount = openSessionMoves.length - inCurrency.length;
    const cashIn = inCurrency
      .filter((m) => m.direction === "in")
      .reduce((s, m) => s + Number(m.amount), 0);
    const cashOut = inCurrency
      .filter((m) => m.direction === "out")
      .reduce((s, m) => s + Number(m.amount), 0);
    return { cashIn, cashOut, expected: cashIn - cashOut, otherCurrencyCount };
  }, [openSessionMoves, settings?.currency]);

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Wallet className="size-6" /> Cash register
          </h1>
          <p className="text-muted-foreground text-sm">
            One session per day. Cash payments from installments and sale
            deposits attach automatically when a session is open.
            {settings && (
              <>
                {" "}Variance threshold:{" "}
                <strong>{fmt(settings.variance_threshold, settings.currency)}</strong>.
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {!openSession && canWrite && (
            <Button onClick={() => setOpenDialogOpen(true)} data-tour-id="cash-open-session-button">
              <Plus className="mr-1.5 size-4" /> Open today&apos;s session
            </Button>
          )}
          {openSession && canWrite && (
            <>
              {canRecordMovement && (
                <Button variant="outline" onClick={() => setMovementDialogOpen(true)} data-tour-id="cash-add-movement-button">
                  Add movement
                </Button>
              )}
              <Button variant="destructive" onClick={() => setCloseDialogOpen(true)} data-tour-id="cash-close-session-button">
                Close session
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : !openSession ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p className="text-sm">No open session today.</p>
            {canWrite && (
              <Button className="mt-3" onClick={() => setOpenDialogOpen(true)}>
                <Plus className="mr-1.5 size-4" /> Open one now
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card data-tour-id="cash-today-session-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Today&apos;s session
              <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", STATUS_COLOR.open)}>
                OPEN
              </Badge>
            </CardTitle>
            <CardDescription>
              Opened{" "}
              {new Date(openSession.opened_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              by {profiles[openSession.opened_by ?? ""]?.full_name ?? "—"} ·{" "}
              {openSession.business_date}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <Stat label="Opening" value={fmt(openSession.opening_balance, settings?.currency ?? "USD")} />
              <Stat
                label="Cash in"
                value={fmt(totals.cashIn, settings?.currency ?? "USD")}
                color="text-emerald-700"
              />
              <Stat
                label="Cash out"
                value={fmt(totals.cashOut, settings?.currency ?? "USD")}
                color="text-red-700"
              />
              <Stat
                label="Expected"
                value={fmt(totals.expected, settings?.currency ?? "USD")}
                emphasize
              />
            </div>

            {totals.otherCurrencyCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" />
                {totals.otherCurrencyCount} movement
                {totals.otherCurrencyCount === 1 ? " is" : "s are"} in another
                currency and {totals.otherCurrencyCount === 1 ? "is" : "are"} not
                included in the {settings?.currency ?? "USD"} totals above.
              </p>
            )}

            {openSessionMoves.length === 0 ? (
              <p className="text-muted-foreground text-sm">No movements yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1">Time</th>
                      <th className="px-2 py-1">Kind</th>
                      <th className="px-2 py-1">Note</th>
                      <th className="px-2 py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {openSessionMoves.map((m) => (
                      <tr key={m.id}>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            {m.direction === "in" ? (
                              <ArrowDown className="size-3 text-emerald-700" />
                            ) : (
                              <ArrowUp className="size-3 text-red-700" />
                            )}
                            {KIND_LABEL[m.kind] ?? m.kind}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {m.note ?? "—"}
                        </td>
                        <td
                          className={cn(
                            "px-2 py-1.5 text-right font-mono",
                            m.direction === "in" ? "text-emerald-700" : "text-red-700"
                          )}
                        >
                          {m.direction === "in" ? "+" : "−"}
                          {fmt(Number(m.amount), m.currency).replace(/^[+-]?\$?/, "$")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card data-tour-id="cash-history-panel">
        <CardHeader>
          <CardTitle className="text-base">Recent sessions</CardTitle>
          <CardDescription>Last 30 closed or flagged sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No history yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1 text-right">Opening</th>
                    <th className="px-2 py-1 text-right">Closing (actual)</th>
                    <th className="px-2 py-1 text-right">Variance</th>
                    <th className="px-2 py-1">Note</th>
                    <th className="px-2 py-1">By</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {history.map((s) => {
                    const sev = s.variance == null ? 0 : Math.abs(Number(s.variance));
                    return (
                      <tr key={s.id}>
                        <td className="px-2 py-1.5">{s.business_date}</td>
                        <td className="px-2 py-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-1.5 text-[10px] uppercase",
                              STATUS_COLOR[s.status]
                            )}
                          >
                            {s.status}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {fmt(s.opening_balance, settings?.currency ?? "USD")}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {fmt(s.closing_actual, settings?.currency ?? "USD")}
                        </td>
                        <td
                          className={cn(
                            "px-2 py-1.5 text-right font-mono",
                            sev > 0 && (s.status === "flagged" ? "text-red-700" : "text-amber-700")
                          )}
                        >
                          {s.variance == null
                            ? "—"
                            : `${Number(s.variance) >= 0 ? "+" : ""}${fmt(
                                Number(s.variance),
                                settings?.currency ?? "USD"
                              ).replace(/^[+-]?\$?/, "$")}`}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {s.variance_note ?? s.closing_note ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {profiles[s.closed_by ?? ""]?.full_name ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <OpenSessionDialog
        open={openDialogOpen}
        drawers={drawers}
        onClose={() => setOpenDialogOpen(false)}
        onDone={() => {
          setOpenDialogOpen(false);
          void load();
        }}
      />
      {openSession && (
        <CloseSessionDialog
          open={closeDialogOpen}
          session={openSession}
          expected={totals.expected}
          currency={settings?.currency ?? "USD"}
          threshold={settings?.variance_threshold ?? 20}
          onClose={() => setCloseDialogOpen(false)}
          onDone={() => {
            setCloseDialogOpen(false);
            void load();
          }}
        />
      )}
      {openSession && (
        <ManualMovementDialog
          open={movementDialogOpen}
          onClose={() => setMovementDialogOpen(false)}
          onDone={() => {
            setMovementDialogOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  emphasize,
}: {
  label: string;
  value: string;
  color?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-center",
        emphasize && "bg-primary/5 border-primary/40"
      )}
    >
      <div className={cn("font-mono text-lg", color)}>{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

function OpenSessionDialog({
  open,
  drawers,
  onClose,
  onDone,
}: {
  open: boolean;
  drawers: Drawer[];
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [drawerId, setDrawerId] = useState<string>("");
  const [opening, setOpening] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && drawers.length === 1) setDrawerId(drawers[0].id);
  }, [open, drawers]);

  async function submit() {
    const v = Number(opening);
    if (isNaN(v) || v < 0) {
      toast.error("Opening balance must be 0 or greater");
      return;
    }
    setSubmitting(true);
    const trimmedNote = note.trim();
    const { error } = await supabase.rpc("open_cash_session", {
      p_opening_balance: v,
      ...(drawerId ? { p_drawer_id: drawerId } : {}),
      ...(trimmedNote ? { p_note: trimmedNote } : {}),
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Session opened");
    setOpening("");
    setNote("");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-tour-id="cash-open-session-dialog">
        <DialogHeader>
          <DialogTitle>Open today&apos;s session</DialogTitle>
          <DialogDescription>
            Count the cash physically in the drawer now and enter it. Every
            cash payment today will attach to this session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {drawers.length > 1 && (
            <div className="space-y-1">
              <Label>
                Drawer
                <FieldHint text="Which cash register or till this session is for, if you have more than one." />
              </Label>
              <Select value={drawerId} onValueChange={setDrawerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a drawer" />
                </SelectTrigger>
                <SelectContent>
                  {drawers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>
              Counted opening balance *
              <FieldHint text="The exact amount of cash physically in the drawer right now, before any sales today." />
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="0.00"
              data-tour-id="cash-open-session-opening-input"
            />
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. starting float for the week"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting} data-tour-id="cash-open-session-cancel">
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || !opening} data-tour-id="cash-open-session-submit">
            {submitting ? "Opening…" : "Open session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseSessionDialog({
  open,
  session,
  expected,
  currency,
  threshold,
  onClose,
  onDone,
}: {
  open: boolean;
  session: Session;
  expected: number;
  currency: string;
  threshold: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [actual, setActual] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [varianceNote, setVarianceNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setActual("");
      setClosingNote("");
      setVarianceNote("");
    }
  }, [open]);

  const actualNum = Number(actual);
  const variance = isNaN(actualNum) ? 0 : actualNum - expected;
  const overThreshold = Math.abs(variance) > threshold;

  async function submit() {
    if (isNaN(actualNum) || actualNum < 0) {
      toast.error("Counted closing must be 0 or greater");
      return;
    }
    if (overThreshold && !varianceNote.trim()) {
      toast.error(`Variance exceeds ${currency} ${threshold} — write a note`);
      return;
    }
    setSubmitting(true);
    const trimmedClosingNote = closingNote.trim();
    const trimmedVarianceNote = varianceNote.trim();
    const { error } = await supabase.rpc("close_cash_session", {
      p_session_id: session.id,
      p_actual_balance: actualNum,
      ...(trimmedClosingNote ? { p_closing_note: trimmedClosingNote } : {}),
      ...(trimmedVarianceNote ? { p_variance_note: trimmedVarianceNote } : {}),
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success(
      overThreshold
        ? `Closed with variance ${variance.toFixed(2)} — owner notified`
        : "Session closed"
    );
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-tour-id="cash-close-session-dialog">
        <DialogHeader>
          <DialogTitle>Close session</DialogTitle>
          <DialogDescription>
            Count the cash now and enter the exact amount in the drawer. The
            system computes the expected total from all movements logged today.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/40 rounded-md p-3 text-center">
              <div className="font-mono">{fmt(expected, currency)}</div>
              <div className="text-muted-foreground text-xs">Expected</div>
            </div>
            <div className="bg-primary/5 border-primary/40 rounded-md border p-3 text-center">
              <div className="font-mono">{fmt(actualNum || 0, currency)}</div>
              <div className="text-muted-foreground text-xs">Counted</div>
            </div>
          </div>
          {!isNaN(actualNum) && actual !== "" && (
            <div
              className={cn(
                "rounded-md border p-3 text-center text-sm",
                overThreshold && "border-red-500/40 bg-red-50/40 dark:bg-red-950/20",
                !overThreshold && variance !== 0 && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20"
              )}
            >
              Variance:{" "}
              <span className="font-mono font-semibold">
                {variance >= 0 ? "+" : ""}
                {fmt(variance, currency).replace(/^[+-]?\$?/, "$")}
              </span>
              {overThreshold && (
                <p className="text-muted-foreground text-xs">
                  Above {fmt(threshold, currency)} threshold. A variance note is required.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label>
              Counted closing *
              <FieldHint text="The exact amount of cash you physically count in the drawer now, at end of day." />
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              data-tour-id="cash-close-actual-input"
            />
          </div>
          <div className="space-y-1">
            <Label>Closing note (optional)</Label>
            <Input
              value={closingNote}
              onChange={(e) => setClosingNote(e.target.value)}
              placeholder="e.g. counted twice"
            />
          </div>
          {overThreshold && (
            <div className="space-y-1">
              <Label>
                Variance note *
                <FieldHint text="Explain why the counted cash doesn't match the expected amount." />
              </Label>
              <Textarea
                value={varianceNote}
                onChange={(e) => setVarianceNote(e.target.value)}
                rows={3}
                placeholder="e.g. customer paid 50 less, will pay tomorrow"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting} data-tour-id="cash-close-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting || !actual || (overThreshold && !varianceNote.trim())}
            data-tour-id="cash-close-submit"
          >
            {submitting ? "Closing…" : "Close session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualMovementDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [kind, setKind] = useState<string>("expense");
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [directionTouched, setDirectionTouched] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setKind("expense");
      setDirection("out");
      setDirectionTouched(false);
      setAmount("");
      setNote("");
    }
  }, [open]);

  useEffect(() => {
    // Sensible default direction per kind — but never override a manual choice.
    if (directionTouched) return;
    if (kind === "expense" || kind === "refund") setDirection("out");
    else if (kind === "service_payment" || kind === "parts_payment") setDirection("in");
  }, [kind, directionTouched]);

  async function submit() {
    const v = Number(amount);
    if (isNaN(v) || v <= 0) {
      toast.error("Amount must be > 0");
      return;
    }
    setSubmitting(true);
    const trimmedNote = note.trim();
    const { error } = await supabase.rpc("record_manual_cash_movement", {
      p_kind: kind,
      p_direction: direction,
      p_amount: v,
      ...(trimmedNote ? { p_note: trimmedNote } : {}),
    });
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Movement recorded");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-tour-id="cash-movement-dialog">
        <DialogHeader>
          <DialogTitle>Record a manual cash movement</DialogTitle>
          <DialogDescription>
            Use for petty cash expenses, walk-in cash service payments,
            refunds, or ad-hoc corrections.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>
              Kind *
              <FieldHint text="The type of cash movement — an expense, a refund, or a payment received." />
            </Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense (out)</SelectItem>
                <SelectItem value="refund">Refund (out)</SelectItem>
                <SelectItem value="service_payment">Service payment (in)</SelectItem>
                <SelectItem value="parts_payment">Parts payment (in)</SelectItem>
                <SelectItem value="manual_adjustment">Manual adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>
              Direction *
              <FieldHint text="Whether cash is coming into the drawer or going out of it." />
            </Label>
            <Select
              value={direction}
              onValueChange={(v) => {
                setDirectionTouched(true);
                setDirection(v as "in" | "out");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">In (received)</SelectItem>
                <SelectItem value="out">Out (paid)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Amount *</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-tour-id="cash-movement-amount-input"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Mark — petty cash for shop supplies"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting} data-tour-id="cash-movement-cancel">
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || !amount} data-tour-id="cash-movement-submit">
            {submitting ? "Recording…" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
