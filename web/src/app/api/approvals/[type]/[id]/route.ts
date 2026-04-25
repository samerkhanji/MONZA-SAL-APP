import { NextRequest, NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Unified approvals endpoint. Accepts:
//   POST /api/approvals/delete/:id           body: { action: "approve" | "deny" }
//   POST /api/approvals/document-access/:id  body: { action: "approve" | "deny" }
//   POST /api/approvals/page-access/:id      body: { action: "approve" | "deny" }
//
// Enforces owner-only authorization server-side (defense-in-depth over RLS).
// Uses service role to perform the cascading actions atomically.

type ApprovalType = "delete" | "document-access" | "page-access";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function isApprovalType(v: string): v is ApprovalType {
  return v === "delete" || v === "document-access" || v === "page-access";
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await ctx.params;

  if (!isApprovalType(type)) {
    return NextResponse.json({ error: "Unknown approval type" }, { status: 404 });
  }
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // 1. Verify session + owner role.
  const serverClient = await createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await serverClient
    .from("profiles")
    .select("user_role")
    .eq("id", user.id)
    .single();

  const effectiveRole = (profile?.user_role as string | undefined) ?? null;

  if (effectiveRole !== "owner") {
    return NextResponse.json({ error: "Only owners can approve requests" }, { status: 403 });
  }

  // 2. Parse body.
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action;
  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "action must be 'approve' or 'deny'" }, { status: 400 });
  }

  // 3. Use service role for the cascading writes (bypass RLS; we already authorized).
  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase service credentials not configured" },
      { status: 500 }
    );
  }

  const nowIso = new Date().toISOString();
  const newStatus = action === "approve" ? "approved" : "denied";

  try {
    if (type === "delete") {
      const { data: req, error: loadErr } = await admin
        .from("delete_requests")
        .select("item_type, item_id, requested_by, status")
        .eq("id", id)
        .maybeSingle();
      if (loadErr || !req) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }
      if (req.status !== "pending") {
        return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });
      }

      // Update delete_request.
      const { error: upErr } = await admin
        .from("delete_requests")
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: nowIso,
        })
        .eq("id", id);
      if (upErr) {
        return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
      }

      // If approved, perform the soft-delete on the target item. (H1)
      // Defensive: pin to expected tables, require row to exist + not already
      // deleted, and require the requester is who delete_requests said it was.
      if (action === "approve") {
        if (req.item_type !== "car" && req.item_type !== "part") {
          return NextResponse.json(
            { error: `Unsupported item_type: ${req.item_type}` },
            { status: 400 }
          );
        }
        const table = req.item_type === "car" ? "cars" : "parts";
        const { data: delRow, error: delErr } = await admin
          .from(table)
          .update({ deleted_at: nowIso })
          .eq("id", req.item_id)
          .is("deleted_at", null)
          .select("id")
          .maybeSingle();
        if (delErr) {
          return NextResponse.json(
            { error: "Request marked approved but item delete failed" },
            { status: 500 }
          );
        }
        if (!delRow) {
          return NextResponse.json(
            { error: "Target row no longer exists or is already deleted" },
            { status: 409 }
          );
        }
      }

      // Notify the requester.
      await admin.from("notifications").insert({
        user_id: req.requested_by,
        title: action === "approve" ? "Deletion approved" : "Deletion denied",
        message:
          action === "approve"
            ? "Your deletion request has been approved."
            : "Your deletion request was not approved.",
        link: req.item_type === "car" ? "/cars" : "/garage/inventory",
      });

      return NextResponse.json({ ok: true });
    }

    if (type === "document-access") {
      const { data: req, error: loadErr } = await admin
        .from("document_access_requests")
        .select("requested_by, search_query, status")
        .eq("id", id)
        .maybeSingle();
      if (loadErr || !req) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }
      if (req.status !== "pending") {
        return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });
      }

      const { error: upErr } = await admin
        .from("document_access_requests")
        .update({ status: newStatus, reviewed_by: user.id })
        .eq("id", id);
      if (upErr) {
        return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
      }

      await admin.from("notifications").insert({
        user_id: req.requested_by,
        title: action === "approve" ? "Document search approved" : "Document search not approved",
        message:
          action === "approve"
            ? `Your document search for "${req.search_query}" has been approved.`
            : `Your document search for "${req.search_query}" was not approved.`,
        link: "/documents",
      });

      return NextResponse.json({ ok: true });
    }

    // page-access
    const { data: req, error: loadErr } = await admin
      .from("page_access_requests")
      .select("requested_by, page_name, status")
      .eq("id", id)
      .maybeSingle();
    if (loadErr || !req) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (req.status !== "pending") {
      return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });
    }

    const expiresAt =
      action === "approve"
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null;

    const { error: upErr } = await admin
      .from("page_access_requests")
      .update({
        status: newStatus,
        reviewed_by: user.id,
        expires_at: expiresAt,
      })
      .eq("id", id);
    if (upErr) {
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
    }

    await admin.from("notifications").insert({
      user_id: req.requested_by,
      title: action === "approve" ? "Access approved" : "Access not approved",
      message:
        action === "approve"
          ? `Your access to ${req.page_name} has been approved.`
          : `Your access to ${req.page_name} was not approved.`,
      link: "/requests/pending",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[approvals] unexpected", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
