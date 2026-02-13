import type { UserRole } from "@/lib/contexts/UserContext";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  sales: "Sales",
  garage_manager: "Garage Manager",
  assistant: "Assistant",
};
