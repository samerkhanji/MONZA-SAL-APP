import { createClient } from "@/lib/supabase";

/**
 * Returns true if a non-deleted part already uses the given OE number.
 *
 * OE numbers are meant to be unique identifiers, but there is no DB-level
 * uniqueness constraint yet (one would need the existing duplicates cleaned up
 * first). This is a UI-level guard so Add/Edit can warn before creating a
 * second part with the same OE number.
 *
 * Case-insensitive. Fails open: if the lookup itself errors we return false so
 * a transient network/RLS hiccup never blocks a legitimate save.
 *
 * @param excludePartId omit the part being edited from the check.
 */
export async function oeNumberInUse(
  oeNumber: string,
  excludePartId?: string
): Promise<boolean> {
  const oe = oeNumber.trim();
  if (!oe) return false;
  const supabase = createClient();
  let query = supabase
    .from("parts")
    .select("id")
    .is("deleted_at", null)
    .ilike("oe_number", oe)
    .limit(1);
  if (excludePartId) query = query.neq("id", excludePartId);
  const { data, error } = await query;
  if (error) return false;
  return ((data as { id: string }[]) ?? []).length > 0;
}
