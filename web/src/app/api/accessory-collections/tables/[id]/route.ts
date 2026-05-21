import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
import { toPublicApiError } from "@/lib/server/api-error";
import { isUuid } from "@/lib/validation/uuid";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireCrud("accessory_collections", "delete");
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid table id" }, { status: 400 });
    }

    const { error } = await gate.supabase.from("accessory_custom_tables").delete().eq("id", id);
    if (error) {
      const status = error.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: toPublicApiError(error) }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: toPublicApiError(e) }, { status: 500 });
  }
}
