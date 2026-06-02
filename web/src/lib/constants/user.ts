import type { AppRole } from "@/lib/permissions";

export const USER_ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  assistant: "Assistant",
  hybrid: "Hybrid",
  khalil_hybrid: "Hybrid",
  it: "IT",
  garage_manager: "Garage Manager",
  garage_staff: "Garage Staff",
  sales_ops: "Sales Ops",
  sales: "Sales",
};

// Roles that can be assigned from the UI. `khalil_hybrid` is a legacy,
// person-specific alias of `hybrid` (same label) — including it makes the role
// dropdown show "Hybrid" twice, so it is excluded from assignment while still
// rendering correctly for any existing user via USER_ROLE_LABELS.
export const ASSIGNABLE_USER_ROLES: AppRole[] = (
  Object.keys(USER_ROLE_LABELS) as AppRole[]
).filter((r) => r !== "khalil_hybrid");
