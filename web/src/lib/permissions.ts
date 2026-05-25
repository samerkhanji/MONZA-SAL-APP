import type { UserProfile } from "@/lib/contexts/UserContext";

export type AppRole =
  | "owner"
  | "assistant"
  | "hybrid"
  | "khalil_hybrid"
  | "it"
  | "garage_manager"
  | "garage_staff"
  | "sales_ops"
  | "sales";

const ALL_ROLES: AppRole[] = [
  "owner",
  "assistant",
  "hybrid",
  "khalil_hybrid",
  "it",
  "garage_manager",
  "garage_staff",
  "sales_ops",
  "sales",
];

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
  | "settings"
  | "garage_settings"
  | "dashboard_overview"
  | "cash"
  | "company_costs"
  | "data_health"
  | "notifications"
  | "ordered_cars"
  | "ordered_parts"
  | "recall_center"
  | "reports"
  | "sales_orders"
  | "trade_ins",
  AppRole[]
> = {
  dashboard: ["owner"],
  dashboard_overview: ["owner"],
  assistant_dashboard: ["owner", "assistant", "hybrid", "khalil_hybrid"],
  requests: [
    "owner",
    "assistant",
    "hybrid",
    "khalil_hybrid",
    "it",
    "garage_manager",
    "garage_staff",
    "sales_ops",
    "sales",
  ],
  cars: [
    "owner",
    "assistant",
    "hybrid",
    "khalil_hybrid",
    "it",
    "sales_ops",
    "sales",
  ],
  accessories: [
    "owner",
    "assistant",
    "hybrid",
    "khalil_hybrid",
    "it",
    "sales_ops",
    "sales",
  ],
  test_drive: [
    "owner",
    "assistant",
    "hybrid",
    "khalil_hybrid",
    "it",
    "sales_ops",
    "sales",
  ],
  installments: ["owner", "assistant", "hybrid", "khalil_hybrid", "sales_ops", "sales"],
  parts: [
    "owner",
    "assistant",
    "hybrid",
    "khalil_hybrid",
    "it",
    "garage_manager",
    "garage_staff",
  ],
  customers: ["owner", "assistant", "hybrid", "khalil_hybrid", "sales_ops", "sales"],
  garage: ["owner", "assistant", "garage_manager", "garage_staff"],
  garage_history: [
    "owner",
    "assistant",
    "garage_manager",
    "sales_ops",
    "sales",
  ],
  documents: [
    "owner",
    "assistant",
    "hybrid",
    "khalil_hybrid",
    "it",
    "garage_manager",
    "sales_ops",
    "sales",
  ],
  settings: ["owner"],
  garage_settings: ["owner", "garage_manager", "hybrid", "khalil_hybrid"],
  // Capability-gated pages: any role may hold the underlying capability, so the
  // role gate is permissive and the page's own hasCapability() check is the
  // effective gate. PAGE_CAPABILITY_FALLBACK covers single-capability cases.
  cash: ALL_ROLES,
  company_costs: ALL_ROLES,
  reports: ALL_ROLES,
  trade_ins: ALL_ROLES,
  // Per-user inbox: every authenticated user sees only their own rows.
  notifications: ALL_ROLES,
  data_health: [
    "owner",
    "assistant",
    "sales_ops",
    "sales",
    "garage_manager",
    "garage_staff",
    "it",
    "hybrid",
    "khalil_hybrid",
  ],
  ordered_cars: [
    "owner",
    "assistant",
    "hybrid",
    "khalil_hybrid",
    "it",
    "sales_ops",
    "sales",
  ],
  recall_center: [
    "owner",
    "assistant",
    "hybrid",
    "khalil_hybrid",
    "it",
    "sales_ops",
    "sales",
  ],
  ordered_parts: ALL_ROLES,
  sales_orders: ["owner", "assistant", "sales_ops"],
};

export const CRUD_PERMISSIONS = {
  cars: {
    create: ["owner", "sales_ops", "sales"] as AppRole[],
    edit: ["owner", "sales_ops", "sales"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: [
      "owner",
      "assistant",
      "hybrid",
      "khalil_hybrid",
      "it",
      "sales_ops",
      "sales",
    ] as AppRole[],
  },
  parts: {
    create: ["owner", "garage_manager"] as AppRole[],
    edit: ["owner", "hybrid", "khalil_hybrid", "garage_manager"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: [
      "owner",
      "assistant",
      "hybrid",
      "khalil_hybrid",
      "it",
      "garage_manager",
      "garage_staff",
    ] as AppRole[],
  },
  customers: {
    create: ["owner", "hybrid", "khalil_hybrid", "sales_ops", "sales"] as AppRole[],
    edit: ["owner", "hybrid", "khalil_hybrid", "sales_ops", "sales"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: ["owner", "assistant", "hybrid", "khalil_hybrid", "sales_ops", "sales"] as AppRole[],
  },
  garage_jobs: {
    create: ["owner", "garage_manager"] as AppRole[],
    edit: ["owner", "garage_manager"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: ["owner", "assistant", "garage_manager", "garage_staff"] as AppRole[],
  },
  installments: {
    create: ["owner", "assistant", "hybrid", "khalil_hybrid", "sales_ops", "sales"] as AppRole[],
    edit: ["owner", "assistant"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: ["owner", "assistant", "hybrid", "khalil_hybrid", "sales_ops", "sales"] as AppRole[],
    mark_paid: ["owner", "assistant", "hybrid", "khalil_hybrid", "sales_ops", "sales"] as AppRole[],
  },
  requests: {
    create: [
      "owner",
      "assistant",
      "hybrid",
      "khalil_hybrid",
      "it",
      "garage_manager",
      "garage_staff",
      "sales_ops",
      "sales",
    ] as AppRole[],
    edit: ["owner", "assistant"] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: [
      "owner",
      "assistant",
      "hybrid",
      "khalil_hybrid",
      "it",
      "garage_manager",
      "garage_staff",
      "sales_ops",
      "sales",
    ] as AppRole[],
  },
  accessory_collections: {
    create: [
      "owner",
      "assistant",
      "hybrid",
      "khalil_hybrid",
      "it",
      "sales_ops",
      "sales",
    ] as AppRole[],
    edit: [
      "owner",
      "assistant",
      "hybrid",
      "khalil_hybrid",
      "it",
      "sales_ops",
      "sales",
    ] as AppRole[],
    delete: ["owner"] as AppRole[],
    view: [
      "owner",
      "assistant",
      "hybrid",
      "khalil_hybrid",
      "it",
      "sales_ops",
      "sales",
    ] as AppRole[],
  },
} as const;

export type CrudEntity = keyof typeof CRUD_PERMISSIONS;
export type CrudAction =
  | "create"
  | "edit"
  | "delete"
  | "view"
  | "mark_paid";

export function getAppRoleFromProfile(profile: UserProfile | null): AppRole | null {
  if (!profile) return null;
  return profile.user_role ?? null;
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

// ============================================================================
// Capability-based permissions (Phase 3 — coexists with role-based above)
//
// Background: profiles.capabilities (user_capability[]) already exists in the
// DB and is checked by some RLS policies (see has_capability() helper). The
// frontend has been ignoring it and gating purely on user_role. This adds
// capability-aware helpers so individual entities can be migrated to read
// capabilities one-at-a-time without breaking the role-based code that
// already works.
//
// Decision (2026-04-29): COARSE capability set. Each capability gates a
// feature MODULE (cars, sales, garage, etc.). Fine-grained per-action
// permissions remain on user_role via CRUD_PERMISSIONS above.
// ============================================================================

/** Mirrors public.user_capability enum (DB-side). */
export type AppCapability =
  | "garage"
  | "vehicle_software"
  | "cashier"
  | "events_ops"
  | "manage_team"
  | "edit_users"
  | "deactivate_users"
  | "view_reports"
  | "inventory"
  | "sales"
  | "data_health"
  | "view_customer_documents";

/** All known capability values (use for type-safe lookups, dropdowns, etc). */
export const APP_CAPABILITIES: readonly AppCapability[] = [
  "garage",
  "vehicle_software",
  "cashier",
  "events_ops",
  "manage_team",
  "edit_users",
  "deactivate_users",
  "view_reports",
  "inventory",
  "sales",
  "data_health",
  "view_customer_documents",
] as const;

/**
 * Module → capability map. The capability that gates ACCESS to this module's
 * pages and entities. Use with `hasCapability(profile, MODULE_CAPABILITY[mod])`.
 *
 * Owners and Garage Managers are "full access" by role, so they bypass these
 * checks via canPerform() / role-based code. These mappings apply when role
 * alone doesn't grant access.
 */
export const MODULE_CAPABILITY: Record<string, AppCapability> = {
  cars: "inventory",
  accessories: "inventory",
  customers: "sales",
  sales_orders: "sales",
  test_drives: "sales",
  installments: "cashier",
  garage_jobs: "garage",
  garage_tasks: "garage",
  parts: "garage",
  garage_history: "garage",
  garage_efficiency: "view_reports",
  data_health: "data_health",
  team_management: "manage_team",
  vehicle_software: "vehicle_software",
  events: "events_ops",
};

/** Pull capabilities from a profile, defaulting to []. */
export function getCapabilitiesFromProfile(
  profile: UserProfile | null
): AppCapability[] {
  return (profile?.capabilities ?? []) as AppCapability[];
}

/**
 * True if profile has the given capability.
 *
 * Owners always return true regardless of their stored capabilities — this
 * mirrors the DB-level `_require_any_capability()` short-circuit so that
 * a UI button gated on `hasCapability('inventory')` (or any other cap)
 * never hides itself from an owner. Migration 133 keeps the
 * `profiles.capabilities` array in sync, but this helper guarantees the
 * invariant even if the DB row is stale.
 */
export function hasCapability(
  profile: UserProfile | null,
  cap: AppCapability
): boolean {
  if (!profile) return false;
  if (profile.user_role === "owner") return true;
  return getCapabilitiesFromProfile(profile).includes(cap);
}

/**
 * True if profile has ANY of the given capabilities.
 * Owners always return true — see {@link hasCapability}.
 */
export function hasAnyCapability(
  profile: UserProfile | null,
  caps: AppCapability[]
): boolean {
  if (!profile || caps.length === 0) return false;
  if (profile.user_role === "owner") return true;
  const userCaps = getCapabilitiesFromProfile(profile);
  return caps.some((cap) => userCaps.includes(cap));
}

/** True if profile has ALL of the given capabilities. */
export function hasAllCapabilities(
  profile: UserProfile | null,
  caps: AppCapability[]
): boolean {
  if (!profile) return false;
  const userCaps = getCapabilitiesFromProfile(profile);
  return caps.every((cap) => userCaps.includes(cap));
}

/**
 * Combined check: passes if EITHER the role grants access (legacy)
 * OR the user has the module's capability (new). Used during the gradual
 * migration so existing UI that gates on role keeps working while
 * capability-aware code can be added in parallel.
 */
export function canAccessModule(
  profile: UserProfile | null,
  module: keyof typeof MODULE_CAPABILITY,
  fallbackRoles: AppRole[] = []
): boolean {
  if (!profile) return false;
  const role = getAppRoleFromProfile(profile);
  if (role && fallbackRoles.includes(role)) return true;
  const cap = MODULE_CAPABILITY[module];
  if (!cap) return false;
  return hasCapability(profile, cap);
}

