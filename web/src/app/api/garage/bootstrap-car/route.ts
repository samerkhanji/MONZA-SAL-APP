import { NextResponse } from "next/server";
import { getSessionUserAndRole, isGarageMgmtRole } from "@/lib/server/session-app-role";
import { toPublicApiError } from "@/lib/server/api-error";
import { isUuid } from "@/lib/validation/uuid";

const DEFAULT_TEMPLATE_NAME = "Standard service";

/**
 * POST { car_id } — create checklist from system template if car has no active tasks.
 * Owner / garage_manager only.
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionUserAndRole();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isGarageMgmtRole(session.appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bodyRaw = await req.json().catch(() => null);
    if (bodyRaw === null || typeof bodyRaw !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const body = bodyRaw as { car_id?: string };
    const carId = body.car_id?.trim();
    if (!carId || !isUuid(carId)) {
      return NextResponse.json({ error: "car_id is required (uuid)" }, { status: 400 });
    }

    const { data: car, error: carErr } = await session.supabase
      .from("cars")
      .select("id, location_type")
      .eq("id", carId)
      .maybeSingle();

    if (carErr || !car) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 });
    }

    if ((car as { location_type: string }).location_type !== "garage") {
      return NextResponse.json({ skipped: true, reason: "not_in_garage", tasks: [] });
    }

    const { data: existing, error: exErr } = await session.supabase
      .from("garage_tasks")
      .select("id")
      .eq("car_id", carId)
      .or("status.eq.pending,status.eq.in_progress,status.eq.blocked")
      .limit(1);

    if (exErr) {
      return NextResponse.json({ error: toPublicApiError(exErr) }, { status: 500 });
    }
    if (existing && existing.length > 0) {
      return NextResponse.json({
        skipped: true,
        message: "Car already has active garage tasks",
        tasks: [],
      });
    }

    let templateId: string | null = null;
    const { data: tpl } = await session.supabase
      .from("garage_task_templates")
      .select("id")
      .eq("name", DEFAULT_TEMPLATE_NAME)
      .eq("is_system", true)
      .maybeSingle();

    if (tpl?.id) {
      templateId = tpl.id as string;
    } else {
      const { data: anyTpl } = await session.supabase
        .from("garage_task_templates")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      templateId = (anyTpl as { id?: string } | null)?.id ?? null;
    }

    if (!templateId) {
      return NextResponse.json(
        { error: "No garage task template found. Run migration 043 or create a template." },
        { status: 400 }
      );
    }

    const { data: items, error: itemsErr } = await session.supabase
      .from("garage_task_template_items")
      .select("description, sort_order, default_resource_type")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });

    if (itemsErr) {
      return NextResponse.json({ error: toPublicApiError(itemsErr) }, { status: 500 });
    }
    if (!items?.length) {
      return NextResponse.json({ error: "Template has no items" }, { status: 400 });
    }

    const rows = items.map(
      (it: {
        description: string;
        sort_order: number | null;
        default_resource_type: string | null;
      }) => ({
        car_id: carId,
        description: it.description,
        resource_type: it.default_resource_type ?? null,
        sort_order: it.sort_order ?? 0,
        created_by: session.userId,
      })
    );

    const { data: inserted, error: insErr } = await session.supabase
      .from("garage_tasks")
      .insert(rows)
      .select();

    if (insErr) {
      const status = insErr.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: toPublicApiError(insErr) }, { status });
    }

    return NextResponse.json({ tasks: inserted ?? [], skipped: false }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: toPublicApiError(e) }, { status: 500 });
  }
}
