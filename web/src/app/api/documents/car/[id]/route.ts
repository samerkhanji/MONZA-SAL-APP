import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
import { isUuid } from "@/lib/validation/uuid";

/** Delete car document row + storage object. Requires cars.delete. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireCrud("cars", "delete");
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
    }

    const { data: row, error: loadErr } = await gate.supabase
      .from("car_documents")
      .select("id, file_path, storage_path")
      .eq("id", id)
      .maybeSingle();

    if (loadErr || !row) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const path = (row as { file_path?: string | null; storage_path?: string | null }).file_path
      ?? (row as { storage_path?: string | null }).storage_path
      ?? "";
    if (!path) {
      return NextResponse.json({ error: "Missing storage path" }, { status: 400 });
    }

    const { error: storageError } = await gate.supabase.storage.from("car-documents").remove([path]);
    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    const { error: delErr } = await gate.supabase.from("car_documents").delete().eq("id", id);
    if (delErr) {
      const status = delErr.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: delErr.message }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
