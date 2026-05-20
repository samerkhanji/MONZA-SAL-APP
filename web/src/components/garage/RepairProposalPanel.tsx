"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type {
  ProposalItemDecision,
  RepairProposal,
  RepairProposalItem,
  RepairProposalStatus,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Plus, ListChecks } from "lucide-react";
import { formatError } from "@/lib/error-messages";

const STATUS_LABEL: Record<RepairProposalStatus, string> = {
  draft: "Draft",
  pending_owner_approval: "Pending owner",
  sent_to_customer_service: "Sent to CS",
  sent_to_customer: "With customer",
  partially_approved: "Partially approved",
  fully_approved: "Approved",
  rejected: "Rejected",
};

function decisionBg(d: ProposalItemDecision): string {
  if (d === "approved") return "bg-emerald-950/50 border-emerald-700/50";
  if (d === "declined") return "bg-red-950/40 border-red-800/50 line-through opacity-80";
  return "bg-yellow-950/30 border-yellow-800/40";
}

export function RepairProposalPanel({
  jobId,
  isGarageManager,
  isAssistant,
  isOwner,
  onJobUpdated,
}: {
  jobId: string;
  isGarageManager: boolean;
  isAssistant: boolean;
  isOwner: boolean;
  onJobUpdated: () => void;
}) {
  const supabase = createClient();
  const [proposal, setProposal] = useState<RepairProposal | null>(null);
  const [items, setItems] = useState<RepairProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canGm = isGarageManager || isOwner;
  const canAsst = isAssistant || isOwner;

  // Owner approval threshold for repair estimates. Loaded once; falls back to
  // a high number so we never accidentally block a flow if the row's missing.
  const [estimateOwnerFloor, setEstimateOwnerFloor] = useState<number>(
    Number.POSITIVE_INFINITY
  );

  useEffect(() => {
    void supabase
      .from("approval_thresholds")
      .select("owner_floor")
      .eq("id", "estimate")
      .eq("active", true)
      .maybeSingle()
      .then(({ data }) => {
        const f = (data as { owner_floor?: number } | null)?.owner_floor;
        if (typeof f === "number") setEstimateOwnerFloor(f);
      });
  }, [supabase]);

  const load = useCallback(async () => {
    const { data: p, error: pe } = await supabase
      .from("repair_proposals")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pe) {
      toast.error(formatError(pe));
      setProposal(null);
      setItems([]);
      setLoading(false);
      return;
    }
    const prop = p as RepairProposal | null;
    setProposal(prop);
    if (!prop) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data: its, error: ie } = await supabase
      .from("repair_proposal_items")
      .select("*")
      .eq("proposal_id", prop.id)
      .order("created_at", { ascending: true });
    if (ie) {
      toast.error(formatError(ie));
      setItems([]);
    } else {
      setItems((its as RepairProposalItem[]) ?? []);
    }
    setLoading(false);
  }, [jobId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const originalTotal = useMemo(
    () => items.reduce((s, i) => s + Number(i.total_price || 0), 0),
    [items]
  );
  const approvedTotal = useMemo(
    () =>
      items
        .filter((i) => i.customer_decision === "approved")
        .reduce((s, i) => s + Number(i.total_price || 0), 0),
    [items]
  );

  async function createProposal() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setBusy(false);
      return;
    }
    const { data, error } = await supabase
      .from("repair_proposals")
      .insert({
        job_id: jobId,
        status: "draft",
        created_by: user.id,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setProposal(data as RepairProposal);
    setItems([]);
    toast.success("Proposal created");
  }

  async function addItemDraft() {
    if (!proposal || proposal.status !== "draft") return;
    setBusy(true);
    const { data, error } = await supabase
      .from("repair_proposal_items")
      .insert({
        proposal_id: proposal.id,
        item_type: "service",
        name: "New line",
        quantity: 1,
        unit_price: 0,
        total_price: 0,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setItems((prev) => [...prev, data as RepairProposalItem]);
  }

  async function updateItem(
    id: string,
    patch: Partial<RepairProposalItem>
  ) {
    if (!proposal || proposal.status !== "draft") return;
    setBusy(true);
    const { error } = await supabase
      .from("repair_proposal_items")
      .update(patch)
      .eq("id", id);
    setBusy(false);
    if (error) toast.error(formatError(error));
    else void load();
  }

  async function saveLineFromForm(it: RepairProposalItem) {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unit_price) || 0;
    const lineTotal = Math.round(qty * unit * 100) / 100;
    await updateItem(it.id, {
      item_type: it.item_type,
      name: it.name,
      part_number: it.part_number,
      quantity: qty,
      unit_price: unit,
      total_price: lineTotal,
    });
  }

  async function sendToCs() {
    if (!proposal) return;
    // Gate: if total exceeds owner threshold, route through pending_owner_approval
    // first. Otherwise straight to CS as before.
    const needsOwner = originalTotal >= estimateOwnerFloor;
    const nextStatus: RepairProposalStatus = needsOwner
      ? "pending_owner_approval"
      : "sent_to_customer_service";
    setBusy(true);
    const { error } = await supabase
      .from("repair_proposals")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", proposal.id);
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setProposal({ ...proposal, status: nextStatus });
    if (needsOwner) {
      toast.success("Sent up for owner approval");
      return;
    }
    const { getProfileIdsByRole } = await import("@/lib/user-lookup");
    const { createNotificationsForUsers } = await import("@/lib/notifications");
    const ids = await getProfileIdsByRole("assistant");
    if (ids.length > 0) {
      await createNotificationsForUsers(
        ids,
        "Repair proposal ready",
        "A repair proposal was sent to Customer Service for your review.",
        `/garage/jobs/${jobId}`
      );
    }
    toast.success("Sent to Customer Service");
    void load();
  }

  async function sendToCustomer() {
    if (!proposal) return;
    setBusy(true);
    const { error } = await supabase
      .from("repair_proposals")
      .update({ status: "sent_to_customer", updated_at: new Date().toISOString() })
      .eq("id", proposal.id);
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Marked as sent to customer");
    void load();
  }

  async function updateItemDecision(id: string, customer_decision: ProposalItemDecision) {
    setBusy(true);
    const { error } = await supabase
      .from("repair_proposal_items")
      .update({ customer_decision })
      .eq("id", id);
    setBusy(false);
    if (error) toast.error(formatError(error));
    else void load();
  }

  async function submitCustomerDecision() {
    if (!proposal) return;
    if (items.some((i) => i.customer_decision === "pending")) {
      toast.error("Decide every line (approved or declined) before submitting.");
      return;
    }
    const approved = items.filter((i) => i.customer_decision === "approved").length;
    const declined = items.filter((i) => i.customer_decision === "declined").length;
    let status: RepairProposalStatus = "partially_approved";
    if (approved === items.length) status = "fully_approved";
    else if (declined === items.length) status = "rejected";
    setBusy(true);
    const { error } = await supabase
      .from("repair_proposals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", proposal.id);
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    const { getProfileIdsByRole } = await import("@/lib/user-lookup");
    const { createNotificationsForUsers } = await import("@/lib/notifications");
    const gmIds = await getProfileIdsByRole("garage_manager");
    if (gmIds.length > 0) {
      await createNotificationsForUsers(
        gmIds,
        "Customer decision on repair proposal",
        `Proposal for job updated: ${STATUS_LABEL[status]}.`,
        `/garage/jobs/${jobId}`
      );
    }
    toast.success("Customer decision recorded");
    void load();
  }

  async function createWorkChecklist() {
    if (!proposal) return;
    const approved = items.filter((i) => i.customer_decision === "approved");
    if (approved.length === 0) {
      toast.error("No approved lines to add to the checklist.");
      return;
    }
    const work_checklist = approved.map((i) => ({
      id: `chk-${i.id}`,
      label: `${i.item_type}: ${i.name}`,
      done: false,
    }));
    setBusy(true);
    const { error } = await supabase
      .from("garage_jobs")
      .update({ work_checklist })
      .eq("id", jobId);
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Work checklist created from approved items");
    onJobUpdated();
  }

  function printProposal() {
    window.print();
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading proposal…</p>;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4 print:border-0 print:bg-white print:text-black">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Repair proposal</h3>
        {proposal && (
          <Badge variant="secondary">{STATUS_LABEL[proposal.status]}</Badge>
        )}
      </div>

      {!proposal && canGm && (
        <Button type="button" size="sm" onClick={() => void createProposal()} disabled={busy}>
          Create repair proposal
        </Button>
      )}

      {proposal && (
        <div id={`proposal-print-${proposal.id}`} className="space-y-4">
          <div className="flex flex-wrap gap-2 print:hidden">
            {(canAsst &&
              (proposal.status === "sent_to_customer_service" ||
                proposal.status === "sent_to_customer")) ||
            canGm ? (
              <Button type="button" size="sm" variant="outline" onClick={printProposal}>
                <Printer className="mr-2 size-4" />
                Print quote
              </Button>
            ) : null}
            {canAsst && proposal.status === "sent_to_customer_service" && (
              <Button type="button" size="sm" onClick={() => void sendToCustomer()} disabled={busy}>
                Send to customer
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {items.map((it) => (
              <div
                key={it.id}
                className={`rounded-md border p-3 text-sm ${decisionBg(it.customer_decision)}`}
              >
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {proposal.status === "draft" && canGm ? (
                    <>
                      <div>
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={it.item_type}
                          onValueChange={(v) => {
                            const t = v as RepairProposalItem["item_type"];
                            setItems((prev) =>
                              prev.map((x) => (x.id === it.id ? { ...x, item_type: t } : x))
                            );
                            void updateItem(it.id, { item_type: t });
                          }}
                        >
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="part">Part</SelectItem>
                            <SelectItem value="labor">Labor</SelectItem>
                            <SelectItem value="service">Service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Name</Label>
                        <Input
                          className="mt-1 h-9"
                          value={it.name}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id ? { ...x, name: e.target.value } : x
                              )
                            )
                          }
                          onBlur={() => void saveLineFromForm(it)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Part #</Label>
                        <Input
                          className="mt-1 h-9 font-mono"
                          value={it.part_number ?? ""}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id ? { ...x, part_number: e.target.value || null } : x
                              )
                            )
                          }
                          onBlur={() => void saveLineFromForm(it)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Qty</Label>
                        <Input
                          className="mt-1 h-9"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={it.quantity}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id
                                  ? { ...x, quantity: parseFloat(e.target.value) || 0 }
                                  : x
                              )
                            )
                          }
                          onBlur={() => void saveLineFromForm(it)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit price</Label>
                        <Input
                          className="mt-1 h-9"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={it.unit_price}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === it.id
                                  ? { ...x, unit_price: parseFloat(e.target.value) || 0 }
                                  : x
                              )
                            )
                          }
                          onBlur={() => void saveLineFromForm(it)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Line total</Label>
                        <p className="mt-2 font-mono">
                          {(Number(it.quantity) * Number(it.unit_price)).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-medium capitalize">{it.item_type}</p>
                      <p className="sm:col-span-2">{it.name}</p>
                      <p className="font-mono text-muted-foreground text-xs">
                        {it.part_number ?? "—"}
                      </p>
                      <p>
                        {it.quantity} × {Number(it.unit_price).toFixed(2)} ={" "}
                        <span className="font-mono">{Number(it.total_price).toFixed(2)}</span>
                      </p>
                      {canAsst && proposal.status === "sent_to_customer" && (
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Customer decision</Label>
                          <Select
                            value={it.customer_decision}
                            onValueChange={(v) =>
                              void updateItemDecision(it.id, v as ProposalItemDecision)
                            }
                            disabled={busy}
                          >
                            <SelectTrigger className="mt-1 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="declined">Declined</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {proposal.status === "draft" && canGm && (
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void addItemDraft()}
                disabled={busy}
              >
                <Plus className="mr-2 size-4" />
                Add line
              </Button>
              <Button type="button" size="sm" onClick={() => void sendToCs()} disabled={busy}>
                {originalTotal >= estimateOwnerFloor
                  ? "Send for owner approval"
                  : "Send to Customer Service"}
              </Button>
            </div>
          )}

          {canAsst && proposal.status === "sent_to_customer" && (
            <Button
              type="button"
              className="print:hidden"
              onClick={() => void submitCustomerDecision()}
              disabled={busy}
            >
              Submit customer decision
            </Button>
          )}

          {isOwner && proposal.status === "pending_owner_approval" && (
            <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-50/40 p-3 print:hidden dark:bg-amber-950/20">
              <p className="text-sm">
                <strong>Total {originalTotal.toFixed(2)}</strong> is above the
                owner approval threshold ({estimateOwnerFloor.toFixed(0)}). Approve
                to send to Customer Service.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    if (!proposal) return;
                    setBusy(true);
                    const { error } = await supabase
                      .from("repair_proposals")
                      .update({
                        status: "sent_to_customer_service",
                        approved_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", proposal.id);
                    setBusy(false);
                    if (error) {
                      toast.error(formatError(error));
                      return;
                    }
                    setProposal({ ...proposal, status: "sent_to_customer_service" });
                    toast.success("Approved — sent to Customer Service");
                  }}
                  disabled={busy}
                >
                  Approve & send to CS
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!proposal) return;
                    setBusy(true);
                    const { error } = await supabase
                      .from("repair_proposals")
                      .update({
                        status: "draft",
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", proposal.id);
                    setBusy(false);
                    if (error) {
                      toast.error(formatError(error));
                      return;
                    }
                    setProposal({ ...proposal, status: "draft" });
                    toast.success("Sent back to draft for revision");
                  }}
                  disabled={busy}
                >
                  Send back to draft
                </Button>
              </div>
            </div>
          )}

          {(proposal.status === "partially_approved" ||
            proposal.status === "fully_approved") &&
            canGm && (
              <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 print:hidden">
                <p className="text-sm">
                  Approved total:{" "}
                  <span className="font-mono font-semibold">{approvedTotal.toFixed(2)}</span> ·
                  Original total:{" "}
                  <span className="font-mono">{originalTotal.toFixed(2)}</span>
                </p>
                <Button type="button" size="sm" onClick={() => void createWorkChecklist()} disabled={busy}>
                  <ListChecks className="mr-2 size-4" />
                  Create work checklist
                </Button>
              </div>
            )}

          <p className="text-muted-foreground text-xs print:text-black">
            Original total: {originalTotal.toFixed(2)} · Approved total: {approvedTotal.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
