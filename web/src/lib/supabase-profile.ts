/**
 * Safely extract full_name from Supabase joined profiles.
 * Supabase returns profiles as an array { full_name }[] for FK relations;
 * this normalizes to a single object and extracts the name without type assertions.
 */
function isProfile(obj: unknown): obj is { full_name?: string | null } {
  return obj !== null && typeof obj === "object" && "full_name" in obj;
}

export function getProfileFullName(profiles: unknown): string {
  if (profiles == null) return "Unknown";
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  if (isProfile(p)) {
    return p.full_name ?? "Unknown";
  }
  return "Unknown";
}
