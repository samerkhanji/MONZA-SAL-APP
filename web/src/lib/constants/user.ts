import type { AppRole } from "@/lib/permissions";

export const USER_ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  assistant: "Assistant",
  khalil_hybrid: "Hybrid (Khalil)",
  it: "IT",
  garage_manager: "Garage Manager",
  garage_staff: "Garage Staff",
  sales_ops: "Sales Ops",
};
