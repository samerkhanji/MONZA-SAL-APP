import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
import { toPublicApiError } from "@/lib/server/api-error";
import { isUuid } from "@/lib/validation/uuid";

/** Soft-delete garage job. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireCrud("garage_jobs", "delete");
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
    }

    // Soft-delete via SECURITY DEFINER RPC so deleted_by/delete_reason are
    // recorded for audit (migration 165).
    let reason: string | undefined;
    try {
      const body = (await _req.json()) as { reason?: unknown };
      if (typeof body?.reason === "string" && body.reason.trim() !== "") {
        reason = body.reason.trim();
      }
    } catch {
      // No body — soft-delete without a reason.
    }

    const { error } = await gate.supabase.rpc("soft_delete_garage_jobs", {
      p_id: id,
      p_reason: reason,
    });

    if (error) {
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
