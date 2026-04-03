import { NextResponse } from "next/server";
import {
  getSessionUserAndRole,
  isGarageMgmtRole,
} from "@/lib/server/session-app-role";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

/** GET: list tasks (RLS filters by role). Query: car_id, status, assigned_to */
export async function GET(req: Request) {
  try {
    const session = await getSessionUserAndRole();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const carId = searchParams.get("car_id");
    const status = searchParams.get("status");
    const assignedTo = searchParams.get("assigned_to");

    let q = session.supabase
      .from("garage_tasks")
      .select(
        `
        *,
        cars ( id, vin, brand, model, status )
      `
      )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (carId) {
      if (!isUuid(carId)) {
        return NextResponse.json({ error: "Invalid car_id" }, { status: 400 });
      }
      q = q.eq("car_id", carId);
    }
    if (status) {
      q = q.eq("status", status);
    }
    if (assignedTo) {
      if (!isUuid(assignedTo)) {
        return NextResponse.json({ error: "Invalid assigned_to" }, { status: 400 });
      }
      q = q.eq("assigned_to", assignedTo);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tasks: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type TaskInput = {
  description: string;
  resourceType?: string | null;
  sortOrder?: number;
};

/** POST: create task(s) for a car — owner / garage_manager only (RLS + API). */
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
    const body = bodyRaw as {
      carId?: string;
      templateId?: string;
      tasks?: TaskInput[];
    };

    const carId = body.carId?.trim();
    if (!carId || !isUuid(carId)) {
      return NextResponse.json({ error: "carId is required (uuid)" }, { status: 400 });
    }

    const rows: {
      car_id: string;
      description: string;
      resource_type: string | null;
      sort_order: number;
      created_by: string;
    }[] = [];

    if (body.templateId) {
      if (!isUuid(body.templateId)) {
        return NextResponse.json({ error: "Invalid templateId" }, { status: 400 });
      }
      const { data: items, error: itemsErr } = await session.supabase
        .from("garage_task_template_items")
        .select("id, description, sort_order, default_resource_type")
        .eq("template_id", body.templateId)
        .order("sort_order", { ascending: true });

      if (itemsErr) {
        return NextResponse.json({ error: itemsErr.message }, { status: 500 });
      }
      if (!items?.length) {
        return NextResponse.json({ error: "Template has no items" }, { status: 400 });
      }
      for (const it of items) {
        rows.push({
          car_id: carId,
          description: it.description,
          resource_type: it.default_resource_type ?? null,
          sort_order: it.sort_order ?? 0,
          created_by: session.userId,
        });
      }
    } else if (body.tasks?.length) {
      for (let i = 0; i < body.tasks.length; i += 1) {
        const t = body.tasks[i];
        const desc = (t.description ?? "").trim();
        if (!desc) {
          return NextResponse.json({ error: "Each task needs a description" }, { status: 400 });
        }
        rows.push({
          car_id: carId,
          description: desc,
          resource_type: t.resourceType?.trim() || null,
          sort_order: t.sortOrder ?? i,
          created_by: session.userId,
        });
      }
    } else {
      return NextResponse.json(
        { error: "Provide templateId or tasks[]" },
        { status: 400 }
      );
    }

    const { data, error } = await session.supabase
      .from("garage_tasks")
      .insert(rows)
      .select();

    if (error) {
      const code = error.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: error.message }, { status: code });
    }

    return NextResponse.json({ tasks: data ?? [] }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
