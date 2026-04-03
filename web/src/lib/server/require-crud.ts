import { NextResponse } from "next/server";
import { canPerform, type AppRole, type CrudAction, type CrudEntity } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getSessionUserAndRole } from "@/lib/server/session-app-role";

export type AuthedSupabase = Awaited<ReturnType<typeof createClient>>;

export type CrudSession =
  | { ok: true; userId: string; appRole: AppRole | null; supabase: AuthedSupabase }
  | { ok: false; response: NextResponse };

/** Require signed-in user with canPerform(entity, action). */
export async function requireCrud(
  entity: CrudEntity,
  action: CrudAction
): Promise<CrudSession> {
  const session = await getSessionUserAndRole();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canPerform(entity, action, session.appRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, userId: session.userId, appRole: session.appRole, supabase: session.supabase };
}
