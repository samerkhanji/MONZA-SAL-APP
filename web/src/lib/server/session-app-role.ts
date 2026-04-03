import { createClient } from "@/lib/supabase/server";
import { getAppRoleFromProfile, type AppRole } from "@/lib/permissions";
import type { UserProfile } from "@/lib/contexts/UserContext";

export async function getSessionUserAndRole(): Promise<{
  userId: string;
  appRole: AppRole | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, user_role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    appRole: getAppRoleFromProfile(profile as UserProfile | null),
    supabase,
  };
}

export function isGarageMgmtRole(role: AppRole | null): boolean {
  return role === "owner" || role === "garage_manager";
}

/** Garage capacity PATCH + settings page (capacities); templates remain owner + garage_manager via RLS. */
export function canEditGarageCapacities(role: AppRole | null): boolean {
  return role === "owner" || role === "garage_manager" || role === "khalil_hybrid";
}
