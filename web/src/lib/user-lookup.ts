import { createClient } from "@/lib/supabase";

export interface ProfileBasic {
  id: string;
  full_name: string | null;
}

let profilesCache: ProfileBasic[] | null = null;
let cacheTime = 0;
const CACHE_MS = 60_000;

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
