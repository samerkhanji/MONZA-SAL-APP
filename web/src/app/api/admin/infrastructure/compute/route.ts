import { NextResponse } from "next/server";
import { getSessionUserAndRole } from "@/lib/server/session-app-role";
import { toPublicApiError } from "@/lib/server/api-error";
import { loadComputeStatusForOwner } from "@/lib/infrastructure/compute-resize-service";

export async function GET() {
  const s = await getSessionUserAndRole();
  if (!s || s.appRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const payload = await loadComputeStatusForOwner(s.supabase);
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: toPublicApiError(e) }, { status: 500 });
  }
}
