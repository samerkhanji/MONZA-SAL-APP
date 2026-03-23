import type { UserProfile } from "@/lib/contexts/UserContext";

export type AppRole =
  | "owner"
  | "assistant"
  | "khalil_hybrid"
  | "it"
  | "garage_manager"
  | "garage_staff"
  | "sales_ops";

export const PAGE_PERMISSIONS: Record<
  | "dashboard"
  | "assistant_dashboard"
  | "requests"
  | "cars"
  | "accessories"
  | "test_drive"
  | "installments"
  | "parts"
  | "customers"
  | "garage"
  | "garage_history"
  | "documents"
  | "settings",
  AppRole[]
> = {
  dashboard: ["owner"],
  assistant_dashboard: ["owner", "assistant"],
  requests: [
    "owner",
    "assistant",
    "khalil_hybrid",
    "it",
    "garage_manager",
    "garage_staff",
    "sales_ops",
  ],
  cars: ["owner", "assistant", "khalil_hybrid", "it", "sales_ops"],
  accessories: ["owner", "assistant", "khalil_hybrid", "it", "sales_ops"],
  test_drive: ["owner", "assistant", "khalil_hybrid", "it", "sales_ops"],
  installments: ["owner", "assistant", "sales_ops"],
  parts: [
    "owner",
    "assistant",
    "khalil_hybrid",
    "it",
    "garage_manager",
    "garage_staff",
  ],
  customers: ["owner", "assistant", "sales_ops"],
  garage: ["owner", "assistant", "garage_manager", "garage_staff"],
  garage_history: ["owner", "assistant", "garage_manager", "sales_ops"],
  documents: [
    "owner",
    "assistant",
    "khalil_hybrid",
    "it",
    "garage_manager",
    "sales_ops",
  ],
  settings: ["owner"],
};

export const CRUD_PERMISSIONS = {
  cars: {
    create: ["owner", "sales_ops"] as AppRole[],
    edit: ["owner", "sales_ops"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: ["owner", "assistant", "khalil_hybrid", "it", "sales_ops"] as AppRole[],
  },
  parts: {
    create: ["owner", "garage_manager"] as AppRole[],
    edit: ["owner", "khalil_hybrid", "garage_manager"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: [
      "owner",
      "assistant",
      "khalil_hybrid",
      "it",
      "garage_manager",
      "garage_staff",
    ] as AppRole[],
  },
  customers: {
    create: ["owner", "sales_ops"] as AppRole[],
    edit: ["owner", "sales_ops"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: ["owner", "assistant", "sales_ops"] as AppRole[],
  },
  garage_jobs: {
    create: ["owner", "garage_manager"] as AppRole[],
    edit: ["owner", "garage_manager"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: ["owner", "assistant", "garage_manager", "garage_staff"] as AppRole[],
  },
  installments: {
    create: ["owner", "assistant", "sales_ops"] as AppRole[],
    edit: ["owner", "assistant"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: ["owner", "assistant", "sales_ops"] as AppRole[],
    mark_paid: ["owner", "assistant", "sales_ops"] as AppRole[],
  },
} as const;

export type CrudEntity = keyof typeof CRUD_PERMISSIONS;
export type CrudAction =
  | keyof (typeof CRUD_PERMISSIONS)["cars"]
  | keyof (typeof CRUD_PERMISSIONS)["installments"];

export function getAppRoleFromProfile(profile: UserProfile | null): AppRole | null {
  if (!profile) return null;
  if (profile.user_role) return profile.user_role;

  // Fallback mapping from legacy role field
  switch (profile.role) {
    case "owner":
      return "owner";
    case "garage_manager":
      return "garage_manager";
    case "sales":
      return "sales_ops";
    case "assistant":
      return "assistant";
    default:
      return null;
  }
}

export function canAccessPage(page: keyof typeof PAGE_PERMISSIONS, role: AppRole | null): boolean {
  if (!role) return false;
  return PAGE_PERMISSIONS[page].includes(role);
}

export function canPerform(
  entity: CrudEntity,
  action: CrudAction,
  role: AppRole | null
): boolean {
  if (!role) return false;
  const perms = CRUD_PERMISSIONS[entity] as Record<string, AppRole[]>;
  const allowed = perms[action as string] ?? [];
  return allowed.includes(role);
}

