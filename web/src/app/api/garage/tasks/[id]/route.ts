import { NextResponse } from "next/server";
import {
  getSessionUserAndRole,
  isGarageMgmtRole,
} from "@/lib/server/session-app-role";
import { toPublicApiError } from "@/lib/server/api-error";
import type { AppRole } from "@/lib/permissions";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

const ALLOWED_TASK_STATUSES = new Set([
  "pending",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);

const ALLOWED_RESOURCE_TYPES = new Set([
  "bays",
  "pit",
  "car_wash",
  "oven",
  "car_painting",
  "ev_bays",
  "body_work",
  "battery_lab",
  "polish",
]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUserAndRole();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as {
      status?: string;
      assigned_to?: string | null;
      resource_type?: string | null;
    } | null;

    const patch: Record<string, unknown> = {};
    if (body?.status != null) {
      if (typeof body.status !== "string" || !ALLOWED_TASK_STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      patch.status = body.status;
    }
    if (body && "assigned_to" in body) {
      if (body.assigned_to !== null && (typeof body.assigned_to !== "string" || !isUuid(body.assigned_to))) {
        return NextResponse.json({ error: "Invalid assigned_to" }, { status: 400 });
      }
      patch.assigned_to = body.assigned_to;
    }
    if (body?.resource_type !== undefined) {
      const rt = body.resource_type?.trim() || null;
      if (rt !== null && !ALLOWED_RESOURCE_TYPES.has(rt)) {
        return NextResponse.json({ error: "Invalid resource_type" }, { status: 400 });
      }
      patch.resource_type = rt;
    }

    const bodyKeys = Object.keys(patch).filter((k) => patch[k] !== undefined);
    if (bodyKeys.length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: existing, error: loadErr } = await session.supabase
      .from("garage_tasks")
      .select("id, assigned_to, status, started_at")
      .eq("id", id)
      .maybeSingle();

    if (loadErr || !existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const role = session.appRole as AppRole | null;
    const isMgmt = isGarageMgmtRole(role);
    const isStaff = role === "garage_staff";
    if (!isMgmt && !isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isStaff) {
      if (existing.assigned_to !== session.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if ("assigned_to" in patch) {
        return NextResponse.json({ error: "Cannot reassign task" }, { status: 403 });
      }
      // Staff can only progress tasks — not cancel or reopen.
      if (
        patch.status &&
        !["in_progress", "blocked", "done"].includes(patch.status as string)
      ) {
        return NextResponse.json(
          { error: "Staff can only set status to in_progress, blocked, or done" },
          { status: 403 }
        );
      }
    }

    if (patch.status === "in_progress" && existing.status !== "in_progress" && !existing.started_at) {
      patch.started_at = new Date().toISOString();
    }
    if (patch.status === "done" || patch.status === "cancelled") {
      patch.completed_at = new Date().toISOString();
    }

    let updateQuery = session.supabase
      .from("garage_tasks")
      .update(patch)
      .eq("id", id);
    // Fold the staff ownership check into the write so the check and update
    // are atomic — no TOCTOU window for a reassignment between them.
    if (isStaff) {
      updateQuery = updateQuery.eq("assigned_to", session.userId);
    }

    const { data, error } = await updateQuery.select().maybeSingle();

    if (error) {
      const code = error.code === "42501" ? 403 : 400;
      return NextResponse.json({ error: toPublicApiError(error) }, { status: code });
    }
    if (!data) {
      return NextResponse.json(
        { error: isStaff ? "Forbidden" : "Task not found" },
        { status: isStaff ? 403 : 404 }
      );
    }

    return NextResponse.json({ task: data });
  } catch (e) {
    return NextResponse.json({ error: toPublicApiError(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUserAndRole();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isGarageMgmtRole(session.appRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const { error } = await session.supabase.from("garage_tasks").delete().eq("id", id);

    if (error) {
      const code = error.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: toPublicApiError(error) }, { status: code });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: toPublicApiError(e) }, { status: 500 });
  }
}
