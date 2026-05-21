import { createClient } from "@/lib/supabase";

export interface ProfileBasic {
  id: string;
  full_name: string | null;
}

let profilesCache: ProfileBasic[] | null = null;
let cacheTime = 0;
const CACHE_MS = 60_000;

/**
 * Drops the in-memory profile cache. Call this after a profile is created,
 * renamed, or deactivated so name-based lookups don't keep routing to stale
 * staff for up to the TTL window.
 */
export function invalidateProfilesCache(): void {
  profilesCache = null;
  cacheTime = 0;
}

export async function getAllProfiles(): Promise<ProfileBasic[]> {
  if (profilesCache && Date.now() - cacheTime < CACHE_MS) {
    return profilesCache;
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");
  profilesCache = (data as ProfileBasic[]) ?? [];
  cacheTime = Date.now();
  return profilesCache;
}

export async function getProfileIdsByNames(
  names: string[]
): Promise<string[]> {
  if (names.length === 0) return [];
  const profiles = await getAllProfiles();
  const ids: string[] = [];
  for (const name of names) {
    const n = name.toLowerCase();
    const p = profiles.find(
      (pr) => pr.full_name && pr.full_name.toLowerCase().includes(n)
    );
    if (p) ids.push(p.id);
  }
  return [...new Set(ids)];
}

export async function getProfileIdByName(name: string): Promise<string | null> {
  const ids = await getProfileIdsByNames([name]);
  return ids[0] ?? null;
}

/**
 * Returns IDs of all active profiles whose `capabilities` array contains the
 * given capability. Use this for role-targeted notifications instead of
 * looking up specific people by name (which silently breaks when staff is
 * renamed or replaced).
 *
 * Examples:
 *   await getProfileIdsByCapability("garage")     // all garage technicians
 *   await getProfileIdsByCapability("manage_team") // all team managers
 */
export async function getProfileIdsByCapability(
  capability: string
): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true)
    .contains("capabilities", [capability]);
  return ((data ?? []) as { id: string }[]).map((p) => p.id);
}

/**
 * Returns IDs of all active profiles whose user_role matches one of the given
 * roles. Use this for role-targeted notifications instead of hardcoding
 * staff by name.
 *
 * Examples:
 *   await getProfileIdsByRole("assistant")              // Lara, Samaya
 *   await getProfileIdsByRole("garage_manager")         // Mark
 *   await getProfileIdsByRole(["assistant", "hybrid"])  // CS + hybrids
 */
export async function getProfileIdsByRole(
  role: string | string[]
): Promise<string[]> {
  const roles = Array.isArray(role) ? role : [role];
  if (roles.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true)
    .in("user_role", roles);
  return ((data ?? []) as { id: string }[]).map((p) => p.id);
}

/**
 * Returns IDs of all active profiles with user_role = 'owner'.
 * Use this for ownership-tier approvals (delete requests, page access,
 * document access) instead of hardcoding "Houssam"/"Samer"/"Kareem".
 */
export async function getOwnerIds(): Promise<string[]> {
  return getProfileIdsByRole("owner");
}
