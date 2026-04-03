import { NextResponse } from "next/server";
import { canEditGarageCapacities, getSessionUserAndRole } from "@/lib/server/session-app-role";
import { isGarageGmIncrementOnlyResource } from "@/lib/constants/garage-workflow";

const ACTIVE_STATUSES = ["pending", "in_progress"] as const;

/** GET: all capacity rows + usage_count for tasks in pending/in_progress with matching resource_type */
export async function GET() {
  try {
    const session = await getSessionUserAndRole();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: caps, error: capErr } = await session.supabase
      .from("garage_capacities")
      .select("resource_name, capacity, updated_at, updated_by")
      .order("resource_name");

    if (capErr) {
      return NextResponse.json({ error: capErr.message }, { status: 500 });
    }

    const { data: tasks, error: taskErr } = await session.supabase
      .from("garage_tasks")
      .select("resource_type, status")
      .in("status", [...ACTIVE_STATUSES]);

    if (taskErr) {
      return NextResponse.json({ error: taskErr.message }, { status: 500 });
    }

    const usage: Record<string, number> = {};
    for (const t of tasks ?? []) {
      const rt = (t as { resource_type: string | null }).resource_type;
      if (!rt) continue;
      usage[rt] = (usage[rt] ?? 0) + 1;
    }

    const list = (caps ?? []).map((c: { resource_name: string; capacity: number; updated_at: string; updated_by: string | null }) => ({
      ...c,
      usage_count: usage[c.resource_name] ?? 0,
    }));

    return NextResponse.json({ capacities: list });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH: { resource_name, capacity } — owner / khalil_hybrid (any non‑negative); garage_manager +1 on listed resources only (not car_wash). */
export async function PATCH(req: Request) {
  try {
    const session = await getSessionUserAndRole();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canEditGarageCapacities(session.appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      resource_name?: string;
      capacity?: number;
    } | null;

    const resourceName = body?.resource_name?.trim();
    const capacity = body?.capacity;
    if (!resourceName || typeof capacity !== "number" || capacity < 0 || !Number.isFinite(capacity)) {
      return NextResponse.json({ error: "resource_name and non-negative capacity required" }, { status: 400 });
    }

    const role = session.appRole;
    if (role === "garage_manager") {
      if (resourceName === "car_wash") {
        return NextResponse.json(
          { error: "Garage managers cannot change car wash capacity; ask an owner or Khalil." },
          { status: 403 }
        );
      }
      if (!isGarageGmIncrementOnlyResource(resourceName)) {
        return NextResponse.json({ error: "Garage managers cannot update this resource" }, { status: 403 });
      }
      const { data: current, error: curErr } = await session.supabase
        .from("garage_capacities")
        .select("capacity")
        .eq("resource_name", resourceName)
        .maybeSingle();
      if (curErr) {
        return NextResponse.json({ error: curErr.message }, { status: 500 });
      }
      if (!current) {
        return NextResponse.json({ error: "Unknown resource_name" }, { status: 404 });
      }
      const prev = (current as { capacity: number }).capacity;
      const next = Math.floor(capacity);
      if (next !== prev + 1) {
        return NextResponse.json(
          { error: "Garage managers may only add +1 to this capacity (current " + prev + ")." },
          { status: 400 }
        );
      }
    }

    const { data, error } = await session.supabase
      .from("garage_capacities")
      .update({
        capacity: Math.floor(capacity),
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
      })
      .eq("resource_name", resourceName)
      .select()
      .maybeSingle();

    if (error) {
      const status = error.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    if (!data) {
      return NextResponse.json({ error: "Unknown resource_name" }, { status: 404 });
    }

    return NextResponse.json({ capacity: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
