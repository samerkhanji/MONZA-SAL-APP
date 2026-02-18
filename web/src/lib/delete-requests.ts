import { createClient } from "@/lib/supabase";
import { createNotification } from "./notifications";
import { getProfileIdByName } from "./user-lookup";

export type DeleteRequestItemType = "car" | "part";

export interface DeleteRequest {
  id: string;
  requested_by: string;
  item_type: DeleteRequestItemType;
  item_id: string;
  item_details: Record<string, unknown>;
  status: "pending" | "approved" | "denied";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CarDeleteDetails {
  vin: string;
  brand: string;
  model: string;
  model_year: number | null;
}

export interface PartDeleteDetails {
  part_name: string;
  oe_number: string | null;
  quantity: number;
}

export async function createDeleteRequest(
  itemType: DeleteRequestItemType,
  itemId: string,
  itemDetails: CarDeleteDetails | PartDeleteDetails | Record<string, unknown>,
  requestedBy: string
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("delete_requests")
    .insert({
      requested_by: requestedBy,
      item_type: itemType,
      item_id: itemId,
      item_details: itemDetails,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return null;
  const id = (data as { id: string })?.id;
  if (!id) return null;

  const houssamId = await getProfileIdByName("Houssam");
  if (houssamId) {
    const itemLabel =
      itemType === "car"
        ? `${(itemDetails as CarDeleteDetails).brand} ${(itemDetails as CarDeleteDetails).model} (${(itemDetails as CarDeleteDetails).vin})`
        : `${(itemDetails as PartDeleteDetails).part_name} (OE: ${(itemDetails as PartDeleteDetails).oe_number ?? "—"})`;
    await createNotification({
      userId: houssamId,
      title: "Delete request pending",
      message: `${itemType === "car" ? "Car" : "Part"} deletion requested: ${itemLabel}`,
      link: "/settings?tab=pending-requests",
      metadata: { type: "delete_request", delete_request_id: id },
    });
  }

  return id;
}

export async function getPendingDeleteRequest(
  itemType: DeleteRequestItemType,
  itemId: string
): Promise<DeleteRequest | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("delete_requests")
    .select("*")
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .eq("status", "pending")
    .single();
  return (data as DeleteRequest) ?? null;
}

export async function getPendingDeleteRequestsForItems(
  itemType: DeleteRequestItemType,
  itemIds: string[]
): Promise<Record<string, DeleteRequest>> {
  if (itemIds.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from("delete_requests")
    .select("*")
    .eq("item_type", itemType)
    .in("item_id", itemIds)
    .eq("status", "pending");
  const list = (data as DeleteRequest[]) ?? [];
  return Object.fromEntries(list.map((r) => [r.item_id, r]));
}

export async function approveDeleteRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = createClient();
  const { data: req } = await supabase
    .from("delete_requests")
    .select("item_type, item_id, requested_by")
    .eq("id", requestId)
    .single();

  if (!req) return false;

  const { error: updateError } = await supabase
    .from("delete_requests")
    .update({
      status: "approved",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) return false;

  const table = (req as { item_type: string }).item_type === "car" ? "cars" : "parts";
  const { error: deleteError } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", (req as { item_id: string }).item_id);

  if (deleteError) return false;

  await createNotification({
    userId: (req as { requested_by: string }).requested_by,
    title: "Deletion approved",
    message: "Your deletion request has been approved.",
    link: (req as { item_type: string }).item_type === "car" ? "/cars" : "/garage/inventory",
  });

  return true;
}

export async function denyDeleteRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = createClient();
  const { data: req } = await supabase
    .from("delete_requests")
    .select("requested_by")
    .eq("id", requestId)
    .single();

  if (!req) return false;

  const { error } = await supabase
    .from("delete_requests")
    .update({
      status: "denied",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return false;

  await createNotification({
    userId: (req as { requested_by: string }).requested_by,
    title: "Deletion denied",
    message: "Your deletion request was not approved.",
    link: "/cars",
  });

  return true;
}
