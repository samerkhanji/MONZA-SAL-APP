import { NextResponse } from "next/server";
import { getSessionUserAndRole } from "@/lib/server/session-app-role";
import { toPublicApiError } from "@/lib/server/api-error";

export async function PATCH(request: Request) {
  const s = await getSessionUserAndRole();
  if (!s || s.appRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { desired_variant_id?: string | null; desired_addon_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const variantRaw = body.desired_variant_id;
  const variant =
    variantRaw === undefined || variantRaw === null
      ? null
      : String(variantRaw).trim() === ""
        ? null
        : String(variantRaw).trim();
  const addonType = (body.desired_addon_type?.trim() || "compute_instance") as string;

  const { error } = await s.supabase
    .from("infrastructure_compute_target")
    .update({
      desired_variant_id: variant,
      desired_addon_type: addonType,
      updated_at: new Date().toISOString(),
      updated_by: s.userId,
    })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: toPublicApiError(error) }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
