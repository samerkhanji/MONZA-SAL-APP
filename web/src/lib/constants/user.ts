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
