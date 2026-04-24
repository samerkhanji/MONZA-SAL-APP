import type { AppRole } from "@/lib/permissions";

/**
 * Lara / Samaya: same resolution approach as `getProfileIdsByNames` / migration 014
 * (substring match on full_name, case-insensitive).
 */
export function profileMatchesMonzaWarrantyEditor(
  fullName: string | null | undefined
): boolean {
  if (!fullName?.trim()) return false;
  const n = fullName.toLowerCase();
  return n.includes("lara") || n.includes("samaya");
}

export function canEditMonzaWarrantyOnCar(
  appRole: AppRole | null,
  fullName: string | null | undefined
): boolean {
  if (appRole === "owner") return true;
  if (appRole === "assistant" && profileMatchesMonzaWarrantyEditor(fullName)) {
    return true;
  }
  return false;
}

export function canEditDmsWarrantyOnCar(appRole: AppRole | null): boolean {
  return appRole === "owner" || appRole === "hybrid";
}

/** Phase 3.3 — owners, all assistants, garage managers (matches DB trigger). */
export function canEditPdiStatusOnCar(appRole: AppRole | null): boolean {
  return (
    appRole === "owner" ||
    appRole === "assistant" ||
    appRole === "garage_manager"
  );
}

/** Open the combined car editor (full or field-restricted saves). */
export function canOpenCarEditDialog(
  appRole: AppRole | null,
  fullName: string | null | undefined
): boolean {
  return (
    appRole === "owner" ||
    appRole === "sales_ops" ||
    canEditMonzaWarrantyOnCar(appRole, fullName) ||
    canEditDmsWarrantyOnCar(appRole)
  );
}
