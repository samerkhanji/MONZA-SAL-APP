/**
 * Accessory inventory — mirrors `public.accessory_inventory` (see supabase/migrations/033_accessory_inventory.sql).
 */
export type AccessoryCategory =
  | "plates"
  | "black_plates"
  | "cushion"
  | "charger"
  | "floor_matt";

export const ACCESSORY_CATEGORIES: ReadonlyArray<{ id: AccessoryCategory; label: string }> = [
  { id: "plates", label: "Plates" },
  { id: "black_plates", label: "Black Plates" },
  { id: "cushion", label: "Cushion" },
  { id: "charger", label: "Charger" },
  { id: "floor_matt", label: "Floor Matt" },
] as const;

export type AccessoryCategoryId = AccessoryCategory;

/** ISO 8601 strings in the client JSON; timestamptz in Postgres. */
export type AccessoryInventoryRow = {
  id: string;
  category: AccessoryCategory;
  label: string;
  quantity: number;
  note: string;
  linked_plate: string | null;
  created_at: string;
  updated_at: string;
};
