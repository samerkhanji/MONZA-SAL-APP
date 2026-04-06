import { NextResponse } from "next/server";
import { getSessionUserAndRole } from "@/lib/server/session-app-role";
import {
  loadComputeStatusForOwner,
  retryComputeUpgradeWithBackoff,
} from "@/lib/infrastructure/compute-resize-service";

export async function POST(request: Request) {
  const s = await getSessionUserAndRole();
  if (!s || s.appRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { variantId?: string; addonType?: string } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = await loadComputeStatusForOwner(s.supabase);
  const variantId =
    body.variantId?.trim() ||
    status.desired?.variantId ||
    status.current?.variantId ||
    null;
  const addonType =
    body.addonType?.trim() ||
    status.desired?.addonType ||
    status.current?.addonType ||
    "compute_instance";

  if (!variantId) {
    return NextResponse.json(
      {
        error:
          "No variant to apply. Set a desired size below or pass variantId in the request body.",
      },
      { status: 400 }
    );
  }

  const out = await retryComputeUpgradeWithBackoff({ addonType, variantId });
  return NextResponse.json(out, { status: out.ok ? 200 : 502 });
}
