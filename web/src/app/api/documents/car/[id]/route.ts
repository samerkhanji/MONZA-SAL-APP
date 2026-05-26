import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
import { toPublicApiError } from "@/lib/server/api-error";
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

    // Delete the DB row FIRST. If the row delete fails (e.g. RLS / 42501) the
    // storage object is still intact and the user can retry. If we removed
    // storage first and then the DB delete failed, the row would still
    // reference a missing object — broken viewer/downloader forever, with
    // no clean recovery from the UI.
    //
    // The reverse ordering — orphaning a storage object — is recoverable by
    // a background janitor sweep that compares storage listings to the
    // car_documents table (out of scope here; tracked separately).
    const { error: delErr } = await gate.supabase.from("car_documents").delete().eq("id", id);
    if (delErr) {
      const status = delErr.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: toPublicApiError(delErr) }, { status });
    }

    const { error: storageError } = await gate.supabase.storage.from("car-documents").remove([path]);
    if (storageError) {
      // Row is already gone; report storage failure with `ok: true` so the
      // UI removes the entry and a janitor job can sweep the orphan blob.
      // Logged for observability rather than surfaced as a 5xx (the user-
      // facing operation succeeded).
      // eslint-disable-next-line no-console
      console.warn(
        "[documents/car] storage object orphaned after row delete",
        { id, path, error: storageError.message }
      );
      return NextResponse.json({ ok: true, storageOrphaned: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: toPublicApiError(e) }, { status: 500 });
  }
}
