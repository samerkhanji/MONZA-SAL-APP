import type { AccessoryInventoryRow } from "@/types/accessories";

const T0 = "2025-01-01T00:00:00.000Z";

/**
 * Canonical seed — edit this object to change defaults (then “Reset to seed” in the UI).
 * Expanded into `AccessoryInventoryRow` with stable ids + timestamps.
 */
export const ACCESSORY_SEED_CATALOG = {
  plates: [
    "Z/458476",
    "Z/458478",
    "Z/458484",
    "Z/458477",
    "Z/458468",
    "Z/458469",
    "Z/458467",
    "Z/458473",
    "Z/458483",
    "Z/458480",
    "Z/458474",
    "Z/458482",
    "Z/458479",
    "Z/458481",
    "Z/458472",
    "Z/458475",
    "Z/458475",
    "B/762826",
    "B/730000",
  ],
  black_plates: [
    { label: "M.HERO 2", quantity: 5 },
    { label: "free", quantity: 3 },
    { label: "free competition", quantity: 1 },
    { label: "Dream", quantity: 1 },
    { label: "Courage", quantity: 8 },
  ],
  cushion: [
    { label: "HEAD CUSHION", quantity: 8 },
    { label: "CAR CUSHION", quantity: 14 },
    { label: "HEAD CUSHION", quantity: 8 },
  ],
  charger: [
    { label: "Charger", quantity: 5 },
    { label: "Type 2/3 GBT", quantity: 2 },
    { label: "?", quantity: 1 },
  ],
  floor_matt: [
    { label: "MHERO", quantity: 30, note: "10 from each size" },
    { label: "Voyah Free", quantity: 160, note: "40 from each size" },
    { label: "Passion", quantity: 40, note: "10 for each size" },
    { label: "Courage", quantity: 51, note: "17 for each" },
    { label: "Without Logo", quantity: 19, note: "" },
    { label: "MHERO free", quantity: 3, note: "" },
  ],
} as const;

export type AccessorySeedCatalog = typeof ACCESSORY_SEED_CATALOG;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function expandSeedCatalog(): AccessoryInventoryRow[] {
  const rows: AccessoryInventoryRow[] = [];
  const c = ACCESSORY_SEED_CATALOG;

  c.plates.forEach((label, i) => {
    rows.push({
      id: `seed-plate-${pad2(i + 1)}`,
      category: "plates",
      label,
      quantity: 1,
      note: "",
      linked_plate: label,
      created_at: T0,
      updated_at: T0,
    });
  });

  c.black_plates.forEach((item, i) => {
    rows.push({
      id: `seed-bp-${pad2(i + 1)}`,
      category: "black_plates",
      label: item.label,
      quantity: item.quantity,
      note: "",
      linked_plate: null,
      created_at: T0,
      updated_at: T0,
    });
  });

  c.cushion.forEach((item, i) => {
    rows.push({
      id: `seed-cush-${pad2(i + 1)}`,
      category: "cushion",
      label: item.label,
      quantity: item.quantity,
      note: "",
      linked_plate: null,
      created_at: T0,
      updated_at: T0,
    });
  });

  c.charger.forEach((item, i) => {
    rows.push({
      id: `seed-chg-${pad2(i + 1)}`,
      category: "charger",
      label: item.label,
      quantity: item.quantity,
      note: "",
      linked_plate: null,
      created_at: T0,
      updated_at: T0,
    });
  });

  c.floor_matt.forEach((item, i) => {
    rows.push({
      id: `seed-fm-${pad2(i + 1)}`,
      category: "floor_matt",
      label: item.label,
      quantity: item.quantity,
      note: item.note ?? "",
      linked_plate: null,
      created_at: T0,
      updated_at: T0,
    });
  });

  return rows;
}

/**
 * Initial inventory rows for the Accessories page.
 * Loaded on first visit; edits persist in localStorage until Supabase sync exists.
 */
export const ACCESSORY_SEED_ROWS: AccessoryInventoryRow[] = expandSeedCatalog();
