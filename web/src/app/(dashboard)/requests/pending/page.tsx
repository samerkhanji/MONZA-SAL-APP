"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PendingItem = {
  id: string;
  type: "delete" | "request" | "document_access" | "page_access";
  typeLabel: string;
  subject?: string;
  item_type?: string;
  item_id?: string;
  item_details?: Record<string, unknown>;
  requested_by: string;
  requester_name?: string;
  created_at: string;
  link?: string;
};

export default function PendingRequestsPage() {
  const router = useRouter();
  const { canSeeSettings, loading: profileLoading } = useUser();
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [pendingItemsLoading, setPendingItemsLoading] = useState(false);
  const [deleteActioning, setDeleteActioning] = useState<string | null>(null);
  const [docActioning, setDocActioning] = useState<string | null>(null);
  const [pageActioning, setPageActioning] = useState<string | null>(null);
  const supabase = createClient();

  const fetchPendingItems = useCallback(async () => {
    setPendingItemsLoading(true);
    const items: PendingItem[] = [];

    const [delRes, reqRes, docRes, pageRes] = await Promise.all([
      supabase
        .from("delete_requests")
        .select("id, item_type, item_id, item_details, requested_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("requests")
        .select("id, subject, submitted_by, created_at")
        .eq("status", "submitted")
        .in("send_to", ["houssam", "kareem"])
        .order("created_at", { ascending: false }),
      supabase
        .from("document_access_requests")
        .select("id, search_query, requested_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("page_access_requests")
        .select("id, page_name, requested_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    const userIds = new Set<string>();
    (delRes.data ?? []).forEach((r) => { if (r.requested_by) userIds.add(r.requested_by); });
    (reqRes.data ?? []).forEach((r) => userIds.add(r.submitted_by));
    (docRes.data ?? []).forEach((r) => { if (r.requested_by) userIds.add(r.requested_by); });
    (pageRes.data ?? []).forEach((r) => { if (r.requested_by) userIds.add(r.requested_by); });

    let namesMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(userIds));
      namesMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"])
      );
    }

    (delRes.data ?? []).forEach((r) => {
      const details = (r.item_details ?? {}) as Record<string, unknown>;
      const label = r.item_type === "car"
        ? `${details.brand ?? ""} ${details.model ?? ""} (${details.vin ?? ""})`
        : `${details.part_name ?? ""} (OE: ${details.oe_number ?? "—"})`;
      const requestedBy = r.requested_by ?? "";
      items.push({
        id: `del-${r.id}`,
        type: "delete",
        typeLabel: "Delete",
        subject: label,
        item_type: r.item_type,
        item_id: r.item_id,
        item_details: details,
        requested_by: requestedBy,
        requester_name: namesMap[requestedBy] ?? "Unknown",
        created_at: r.created_at ?? "",
      });
    });

    (reqRes.data ?? []).forEach((r) => {
      items.push({
        id: `req-${r.id}`,
        type: "request",
        typeLabel: "Request",
        subject: r.subject,
        requested_by: r.submitted_by,
        requester_name: namesMap[r.submitted_by] ?? "Unknown",
        created_at: r.created_at,
        link: `/requests?detail=${r.id}`,
      });
    });

    (docRes.data ?? []).forEach((r) => {
      const requestedBy = r.requested_by ?? "";
      items.push({
        id: `doc-${r.id}`,
        type: "document_access",
        typeLabel: "Document Access",
        subject: r.search_query,
        requested_by: requestedBy,
        requester_name: namesMap[requestedBy] ?? "Unknown",
        created_at: r.created_at ?? "",
      });
    });

    (pageRes.data ?? []).forEach((r) => {
      const requestedBy = r.requested_by ?? "";
      items.push({
        id: `page-${r.id}`,
        type: "page_access",
        typeLabel: "Page Access",
        subject: r.page_name,
        requested_by: requestedBy,
        requester_name: namesMap[requestedBy] ?? "Unknown",
        created_at: r.created_at ?? "",
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPendingItems(items);
    setPendingItemsLoading(false);
  }, []);

  useEffect(() => {
    if (!profileLoading && !canSeeSettings) {
      router.replace("/requests");
    }
  }, [profileLoading, canSeeSettings, router]);

  useEffect(() => {
    if (canSeeSettings) {
      fetchPendingItems();
    }
  }, [canSeeSettings, fetchPendingItems]);

  async function callApproval(
    type: "delete" | "document-access" | "page-access",
    reqId: string,
    action: "approve" | "deny"
  ): Promise<boolean> {
    const res = await fetch(`/api/approvals/${type}/${reqId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(typeof j?.error === "string" ? j.error : "Action failed");
      return false;
    }
    return true;
  }

  async function handleApproveDelete(reqId: string) {
    setDeleteActioning(reqId);
    const ok = await callApproval("delete", reqId, "approve");
    setDeleteActioning(null);
    if (ok) {
      toast.success("Deletion approved");
      fetchPendingItems();
    }
  }

  async function handleDenyDelete(reqId: string) {
    setDeleteActioning(reqId);
    const ok = await callApproval("delete", reqId, "deny");
    setDeleteActioning(null);
    if (ok) {
      toast.success("Deletion denied");
      fetchPendingItems();
    }
  }

  async function handleDocAccess(reqId: string, action: "approve" | "deny") {
    setDocActioning(reqId);
    const ok = await callApproval("document-access", reqId, action);
    setDocActioning(null);
    if (ok) {
      toast.success(action === "approve" ? "Document access approved" : "Document access denied");
      fetchPendingItems();
    }
  }

  async function handlePageAccess(reqId: string, action: "approve" | "deny") {
    setPageActioning(reqId);
    const ok = await callApproval("page-access", reqId, action);
    setPageActioning(null);
    if (ok) {
      toast.success(action === "approve" ? "Page access approved" : "Page access denied");
      fetchPendingItems();
    }
  }

  if (!profileLoading && !canSeeSettings) return null;

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card data-tour-id="requests-pending-panel">
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
          <CardDescription>
            All pending items requiring action: deletions, employee requests, document access, page access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingItemsLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : pendingItems.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No pending requests
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border" data-tour-id="requests-pending-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Details</th>
                    <th className="px-4 py-3 text-left font-medium">Requested By</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((r) => {
                    const deleteId = r.type === "delete" ? r.id.replace("del-", "") : null;
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-xs font-medium",
                              r.type === "delete" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                              r.type === "request" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                              r.type === "document_access" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                              r.type === "page_access" && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            )}
                          >
                            {r.typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.link ? (
                            <Link href={r.link} className="max-w-[200px] block truncate text-primary hover:underline">
                              {r.subject ?? "—"}
                            </Link>
                          ) : (
                            r.subject ?? "—"
                          )}
                        </td>
                        <td className="px-4 py-3">{r.requester_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.type === "delete" && deleteId ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApproveDelete(deleteId)}
                                disabled={deleteActioning === deleteId}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDenyDelete(deleteId)}
                                disabled={deleteActioning === deleteId}
                              >
                                Deny
                              </Button>
                            </div>
                          ) : r.type === "document_access" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleDocAccess(r.id.replace("doc-", ""), "approve")}
                                disabled={docActioning === r.id.replace("doc-", "")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDocAccess(r.id.replace("doc-", ""), "deny")}
                                disabled={docActioning === r.id.replace("doc-", "")}
                              >
                                Deny
                              </Button>
                            </div>
                          ) : r.type === "page_access" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handlePageAccess(r.id.replace("page-", ""), "approve")}
                                disabled={pageActioning === r.id.replace("page-", "")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePageAccess(r.id.replace("page-", ""), "deny")}
                                disabled={pageActioning === r.id.replace("page-", "")}
                              >
                                Deny
                              </Button>
                            </div>
                          ) : (
                            r.link && (
                              <Link href={r.link}>
                                <Button size="sm" variant="outline">View</Button>
                              </Link>
                            )
                          )}
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
    </div>
  );
}
