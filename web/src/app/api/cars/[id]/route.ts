import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
import { isUuid } from "@/lib/validation/uuid";

/**
 * Permanently remove a vehicle from active inventory (physically scrapped).
 * Sets status = scrapped and deleted_at together (DB CHECK requires both).
 * Return/resell must not use this route — use unlink customer + available instead.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireCrud("cars", "delete");
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid car id" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await gate.supabase
      .from("cars")
      .update({
        status: "scrapped",
        deleted_at: now,
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      const status = error.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
