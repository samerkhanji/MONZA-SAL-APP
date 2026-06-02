import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
import { toPublicApiError } from "@/lib/server/api-error";
import { isUuid } from "@/lib/validation/uuid";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  // Note: _req is read for an optional { reason } body — see below.
  try {
    const gate = await requireCrud("customers", "delete");
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    // Soft-delete via SECURITY DEFINER RPC so deleted_by/delete_reason are
    // recorded for audit (migration 165). The function performs the owner
    // capability check internally; gate.supabase already enforces RLS for
    // the caller.
    let reason: string | undefined;
    try {
      const body = (await _req.json()) as { reason?: unknown };
      if (typeof body?.reason === "string" && body.reason.trim() !== "") {
        reason = body.reason.trim();
      }
    } catch {
      // No body or unparseable body — soft-delete without a reason.
    }

    const { error } = await gate.supabase.rpc("soft_delete_customers", {
      p_id: id,
      p_reason: reason,
    });

    if (error) {
      // Trigger tg_customers_block_delete_with_active_orders raises 23503
      // (foreign_key_violation errcode) with a human-friendly message.
      // Surface that text to the user as a 409 instead of a 500.
      if (error.code === "23503") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      // 'row not found or already deleted' is reported as P0002 by the RPC.
      if (error.code === "P0002") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      const status = error.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: toPublicApiError(error) }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: toPublicApiError(e) }, { status: 500 });
  }
}
