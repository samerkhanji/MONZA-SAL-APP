import { NextResponse } from "next/server";
import {
  getSessionUserAndRole,
  isGarageMgmtRole,
} from "@/lib/server/session-app-role";
import type { AppRole } from "@/lib/permissions";

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

async function assertMayActOnTask(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string,
  appRole: AppRole | null,
  taskId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: t, error } = await supabase
    .from("garage_tasks")
    .select("id, assigned_to")
    .eq("id", taskId)
    .maybeSingle();
  if (error || !t) {
    return { ok: false, status: 404, error: "Task not found" };
  }
  if (isGarageMgmtRole(appRole)) return { ok: true };
  if (appRole === "garage_staff") {
    if (t.assigned_to !== userId) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    return { ok: true };
  }
  return { ok: false, status: 403, error: "Forbidden" };
}

/** GET: open timers (yours, or all if owner/gm). */
export async function GET(req: Request) {
  try {
    const session = await getSessionUserAndRole();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let q = session.supabase
      .from("task_timers")
      .select(
        "id, task_id, user_id, start_time, end_time, duration_seconds, garage_tasks ( id, description, car_id, cars ( vin, brand, model ) )"
      )
      .is("end_time", null)
      .order("start_time", { ascending: false });

    if (!isGarageMgmtRole(session.appRole)) {
      q = q.eq("user_id", session.userId);
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("task_id");
    if (taskId) {
      if (!isUuid(taskId)) {
        return NextResponse.json({ error: "Invalid task_id" }, { status: 400 });
      }
      q = q.eq("task_id", taskId);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ openTimers: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST: { action: "start" | "stop", taskId: uuid } */
export async function POST(req: Request) {
  try {
    const session = await getSessionUserAndRole();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      action?: string;
      taskId?: string;
    } | null;

    const taskId = body?.taskId?.trim();
    if (!taskId || !isUuid(taskId)) {
      return NextResponse.json({ error: "taskId is required (uuid)" }, { status: 400 });
    }

    const gate = await assertMayActOnTask(
      session.supabase,
      session.userId,
      session.appRole,
      taskId
    );
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    if (body?.action === "start") {
      const { data: existing } = await session.supabase
        .from("task_timers")
        .select("id")
        .eq("task_id", taskId)
        .eq("user_id", session.userId)
        .is("end_time", null)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: "Timer already running for this task" }, { status: 400 });
      }

      const { data, error } = await session.supabase
        .from("task_timers")
        .insert({
          task_id: taskId,
          user_id: session.userId,
        })
        .select()
        .single();

      if (error) {
        const code = error.code === "42501" ? 403 : 400;
        return NextResponse.json({ error: error.message }, { status: code });
      }

      return NextResponse.json({ timer: data }, { status: 201 });
    }

    if (body?.action === "stop") {
      const { data: openRow, error: findErr } = await session.supabase
        .from("task_timers")
        .select("id, start_time")
        .eq("task_id", taskId)
        .eq("user_id", session.userId)
        .is("end_time", null)
        .maybeSingle();

      if (findErr || !openRow) {
        return NextResponse.json({ error: "No open timer for this task" }, { status: 400 });
      }

      const end = new Date();
      const start = new Date(openRow.start_time);
      const durationSeconds = Math.max(
        0,
        Math.floor((end.getTime() - start.getTime()) / 1000)
      );

      const { data, error } = await session.supabase
        .from("task_timers")
        .update({
          end_time: end.toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq("id", openRow.id)
        .select()
        .single();

      if (error) {
        const code = error.code === "42501" ? 403 : 400;
        return NextResponse.json({ error: error.message }, { status: code });
      }

      return NextResponse.json({ timer: data });
    }

    return NextResponse.json({ error: "action must be start or stop" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
