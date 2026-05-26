import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
import { toPublicApiError } from "@/lib/server/api-error";
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
      return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
    }

    const { data: row, error: loadErr } = await gate.supabase
      .from("customer_documents")
      .select("id, file_path")
      .eq("id", id)
      .maybeSingle();

    if (loadErr || !row) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const path = (row as { file_path: string }).file_path;
    if (!path) {
      return NextResponse.json({ error: "Missing file path" }, { status: 400 });
    }

    // Delete the DB row FIRST. See web/src/app/api/documents/car/[id]/route.ts
    // for the rationale: a row pointing at a missing storage object is not
    // recoverable from the UI; an orphan storage object is recoverable by a
    // background janitor sweep.
    const { error: delErr } = await gate.supabase.from("customer_documents").delete().eq("id", id);
    if (delErr) {
      const status = delErr.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: toPublicApiError(delErr) }, { status });
    }

    const { error: storageError } = await gate.supabase.storage
      .from("customer-documents")
      .remove([path]);
    if (storageError) {
      // eslint-disable-next-line no-console
      console.warn(
        "[documents/customer] storage object orphaned after row delete",
        { id, path, error: storageError.message }
      );
      return NextResponse.json({ ok: true, storageOrphaned: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: toPublicApiError(e) }, { status: 500 });
  }
}
