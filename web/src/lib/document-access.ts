import { createClient } from "@/lib/supabase";
import { createNotification } from "./notifications";

export async function approveDocumentAccessRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = createClient();
  const { data: req } = await supabase
    .from("document_access_requests")
    .select("requested_by, search_query")
    .eq("id", requestId)
    .single();

  if (!req) return false;

  const { error } = await supabase
    .from("document_access_requests")
    .update({
      status: "approved",
      reviewed_by: reviewedBy,
    })
    .eq("id", requestId);

  if (error) return false;

  await createNotification({
    userId: (req as { requested_by: string }).requested_by,
    title: "Document search approved",
    message: `Your document search for "${(req as { search_query: string }).search_query}" has been approved. You can now view the results.`,
    link: "/documents",
  });

  return true;
}

export async function denyDocumentAccessRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  const supabase = createClient();
  const { data: req } = await supabase
    .from("document_access_requests")
    .select("requested_by, search_query")
    .eq("id", requestId)
    .single();

  if (!req) return false;

  const { error } = await supabase
    .from("document_access_requests")
    .update({
      status: "denied",
      reviewed_by: reviewedBy,
    })
    .eq("id", requestId);

  if (error) return false;

  await createNotification({
    userId: (req as { requested_by: string }).requested_by,
    title: "Document search not approved",
    message: `Your document search for "${(req as { search_query: string }).search_query}" was not approved.`,
    link: "/documents",
  });

  return true;
}
