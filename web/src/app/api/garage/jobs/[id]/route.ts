import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
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

    const { error } = await gate.supabase
      .from("garage_jobs")
      .update({ deleted_at: new Date().toISOString() })
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
