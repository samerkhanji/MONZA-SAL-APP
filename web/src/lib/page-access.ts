import { createClient } from "@/lib/supabase";
import { createNotification, createNotificationsForUsers } from "./notifications";
import { getOwnerIds } from "./user-lookup";

export async function requestPageAccess(
  requestedBy: string,
  pageName: string,
  requesterName: string
): Promise<{ success: boolean; requestId?: string }> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("page_access_requests")
    .select("id, status")
    .eq("requested_by", requestedBy)
    .eq("page_name", pageName)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existing) {
    if (existing.status === "approved") return { success: true };
    return { success: true, requestId: (existing as { id: string }).id };
  }

  const { data: req, error } = await supabase
    .from("page_access_requests")
    .insert({
      requested_by: requestedBy,
      page_name: pageName,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { success: false };

  const ownerIds = await getOwnerIds();
  if (ownerIds.length > 0) {
    await createNotificationsForUsers(
      ownerIds,
      "Page access requested",
      `${requesterName} is requesting access to Garage History`,
      "/garage/history",
      {
        type: "page_access_request",
        page_access_request_id: (req as { id: string }).id,
      }
    );
  }

  return { success: true, requestId: (req as { id: string }).id };
}

export async function hasApprovedPageAccess(
  userId: string,
  pageName: string
): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("page_access_requests")
    .select("id, expires_at")
    .eq("requested_by", userId)
    .eq("page_name", pageName)
    .eq("status", "approved")
    .maybeSingle();

  if (!data) return false;
  const row = data as { expires_at: string | null };
  if (row.expires_at && new Date(row.expires_at) < new Date()) return false;
  return true;
}

export type PageAccessStatus = "none" | "pending" | "approved" | "denied";

export async function getPageAccessStatus(
  userId: string,
  pageName: string
): Promise<PageAccessStatus> {
  const supabase = createClient();
  const { data } = await supabase
    .from("page_access_requests")
    .select("status, expires_at")
    .eq("requested_by", userId)
    .eq("page_name", pageName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return "none";
  const row = data as { status: string; expires_at: string | null };
  if (row.status === "approved") {
    if (row.expires_at && new Date(row.expires_at) < new Date()) return "none";
    return "approved";
  }
  if (row.status === "pending") return "pending";
  if (row.status === "denied") return "denied";
  return "none";
}

export async function approvePageAccessRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = createClient();
  const { data: req } = await supabase
    .from("page_access_requests")
    .select("requested_by, page_name")
    .eq("id", requestId)
    .single();

  if (!req) return false;

  const { error } = await supabase
    .from("page_access_requests")
    .update({
      status: "approved",
      reviewed_by: reviewedBy,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq("id", requestId);

  if (error) return false;

  await createNotification({
    userId: (req as { requested_by: string }).requested_by,
    title: "Access approved",
    message: `Your access to Garage History has been approved.`,
    link: "/garage/history",
  });

  return true;
}

export async function denyPageAccessRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = createClient();
  const { data: req } = await supabase
    .from("page_access_requests")
    .select("requested_by")
    .eq("id", requestId)
    .single();

  if (!req) return false;

  const { error } = await supabase
    .from("page_access_requests")
    .update({
      status: "denied",
      reviewed_by: reviewedBy,
    })
    .eq("id", requestId);

  if (error) return false;

  await createNotification({
    userId: (req as { requested_by: string }).requested_by,
    title: "Access not approved",
    message: `Your access to Garage History was not approved.`,
    link: "/garage/history",
  });

  return true;
}
