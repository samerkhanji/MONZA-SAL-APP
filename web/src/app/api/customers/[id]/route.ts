import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
import { isUuid } from "@/lib/validation/uuid";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireCrud("customers", "delete");
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    const { error } = await gate.supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      // Trigger tg_customers_block_delete_with_active_orders raises 23503
      // (foreign_key_violation errcode) with a human-friendly message.
      // Surface that text to the user as a 409 instead of a 500.
      if (error.code === "23503") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      const status = error.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
