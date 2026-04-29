import { describe, it, expect } from "vitest";
import {
  type AppRole,
  PAGE_PERMISSIONS,
  CRUD_PERMISSIONS,
  getAppRoleFromProfile,
  canAccessPage,
  canPerform,
} from "@/lib/permissions";

describe("getAppRoleFromProfile", () => {
  it("returns null when profile is null", () => {
    expect(getAppRoleFromProfile(null)).toBeNull();
  });

  it("prefers user_role when present", () => {
    const profile = {
      id: "u1",
      user_role: "owner" as AppRole,
      role: "sales",
    } as any;
    expect(getAppRoleFromProfile(profile)).toBe("owner");
  });

  it("returns null when user_role is missing (legacy `role` column was dropped)", () => {
    // The legacy `profiles.role` column was dropped in
    // 20260420141019_drop_profiles_role_v2_20260420.sql, so the old
    // fallback from `profile.role` was removed from
    // getAppRoleFromProfile. Profiles without user_role now resolve
    // to null and are denied at canAccessPage.
    expect(getAppRoleFromProfile({ role: "owner" } as any)).toBeNull();
    expect(getAppRoleFromProfile({} as any)).toBeNull();
  });
});

describe("canAccessPage", () => {
  it("denies access when role is null", () => {
    expect(canAccessPage("dashboard", null)).toBe(false);
  });

  it("matches PAGE_PERMISSIONS exactly", () => {
    (Object.keys(PAGE_PERMISSIONS) as Array<keyof typeof PAGE_PERMISSIONS>).forEach(
      (page) => {
        const allowed = new Set<AppRole>(PAGE_PERMISSIONS[page]);

        const allRoles: AppRole[] = [
          "owner",
          "assistant",
          "hybrid",
          "it",
          "garage_manager",
          "garage_staff",
          "sales_ops",
        ];

        for (const role of allRoles) {
          const result = canAccessPage(page, role);
          if (allowed.has(role)) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }
      }
    );
  });
});

describe("canPerform", () => {
  it("denies when role is null", () => {
    expect(canPerform("cars", "create", null)).toBe(false);
  });

  it("respects CRUD_PERMISSIONS for cars", () => {
    const roles: AppRole[] = [
      "owner",
      "assistant",
      "hybrid",
      "it",
      "garage_manager",
      "garage_staff",
      "sales_ops",
    ];

    roles.forEach((role) => {
      const perms = CRUD_PERMISSIONS.cars;

      const canCreate = perms.create.includes(role);
      const canEdit = perms.edit.includes(role);
      const canDelete = perms.delete.includes(role);
      const canView = perms.view.includes(role);

      expect(canPerform("cars", "create", role)).toBe(canCreate);
      expect(canPerform("cars", "edit", role)).toBe(canEdit);
      expect(canPerform("cars", "delete", role)).toBe(canDelete);
      expect(canPerform("cars", "view", role)).toBe(canView);
    });
  });

  it("respects CRUD_PERMISSIONS for parts", () => {
    const roles: AppRole[] = [
      "owner",
      "assistant",
      "hybrid",
      "it",
      "garage_manager",
      "garage_staff",
      "sales_ops",
    ];

    roles.forEach((role) => {
      const perms = CRUD_PERMISSIONS.parts;

      const canCreate = perms.create.includes(role);
      const canEdit = perms.edit.includes(role);
      const canDelete = perms.delete.includes(role);
      const canView = perms.view.includes(role);

      // CrudAction type only includes cars/installments keys, but implementation
      // uses a string index, so we can still exercise parts here by casting.
      expect(canPerform("parts", "create" as any, role)).toBe(canCreate);
      expect(canPerform("parts", "edit" as any, role)).toBe(canEdit);
      expect(canPerform("parts", "delete" as any, role)).toBe(canDelete);
      expect(canPerform("parts", "view" as any, role)).toBe(canView);
    });
  });

  it("respects CRUD_PERMISSIONS for installments (including mark_paid)", () => {
    const roles: AppRole[] = [
      "owner",
      "assistant",
      "hybrid",
      "it",
      "garage_manager",
      "garage_staff",
      "sales_ops",
    ];

    roles.forEach((role) => {
      const perms = CRUD_PERMISSIONS.installments;

      const canCreate = perms.create.includes(role);
      const canEdit = perms.edit.includes(role);
      const canDelete = perms.delete.includes(role);
      const canView = perms.view.includes(role);
      const canMarkPaid = perms.mark_paid.includes(role);

      expect(canPerform("installments", "create", role)).toBe(canCreate);
      expect(canPerform("installments", "edit", role)).toBe(canEdit);
      expect(canPerform("installments", "delete", role)).toBe(canDelete);
      expect(canPerform("installments", "view", role)).toBe(canView);
      expect(canPerform("installments", "mark_paid", role)).toBe(canMarkPaid);
    });
  });

  it("respects CRUD_PERMISSIONS for requests (delete owner-only)", () => {
    const roles: AppRole[] = [
      "owner",
      "assistant",
      "hybrid",
      "it",
      "garage_manager",
      "garage_staff",
      "sales_ops",
    ];
    roles.forEach((role) => {
      const perms = CRUD_PERMISSIONS.requests;
      expect(canPerform("requests", "delete", role)).toBe(perms.delete.includes(role));
      expect(canPerform("requests", "create", role)).toBe(perms.create.includes(role));
      expect(canPerform("requests", "edit", role)).toBe(perms.edit.includes(role));
      expect(canPerform("requests", "view", role)).toBe(perms.view.includes(role));
    });
  });
});


// ============================================================================
// Phase 3 — capability-based permission tests
// ============================================================================

import {
  type AppCapability,
  APP_CAPABILITIES,
  MODULE_CAPABILITY,
  getCapabilitiesFromProfile,
  hasCapability,
  hasAnyCapability,
  hasAllCapabilities,
  canAccessModule,
} from "@/lib/permissions";

describe("getCapabilitiesFromProfile", () => {
  it("returns empty array when profile is null", () => {
    expect(getCapabilitiesFromProfile(null)).toEqual([]);
  });

  it("returns empty array when capabilities is missing", () => {
    expect(getCapabilitiesFromProfile({ id: "x" } as any)).toEqual([]);
  });

  it("returns the array as-is when present", () => {
    const profile = { id: "x", capabilities: ["garage", "sales"] } as any;
    expect(getCapabilitiesFromProfile(profile)).toEqual(["garage", "sales"]);
  });
});

describe("hasCapability", () => {
  it("returns false for null profile", () => {
    expect(hasCapability(null, "garage")).toBe(false);
  });

  it("returns true when capability is present", () => {
    const profile = { id: "x", capabilities: ["garage"] } as any;
    expect(hasCapability(profile, "garage")).toBe(true);
  });

  it("returns false when capability is absent", () => {
    const profile = { id: "x", capabilities: ["sales"] } as any;
    expect(hasCapability(profile, "garage")).toBe(false);
  });
});

describe("hasAnyCapability", () => {
  it("returns false for empty caps list", () => {
    const profile = { id: "x", capabilities: ["garage"] } as any;
    expect(hasAnyCapability(profile, [])).toBe(false);
  });

  it("returns true when any cap matches", () => {
    const profile = { id: "x", capabilities: ["garage"] } as any;
    expect(hasAnyCapability(profile, ["sales", "garage"])).toBe(true);
  });

  it("returns false when none match", () => {
    const profile = { id: "x", capabilities: ["garage"] } as any;
    expect(hasAnyCapability(profile, ["sales", "data_health"])).toBe(false);
  });
});

describe("hasAllCapabilities", () => {
  it("returns true when all caps present", () => {
    const profile = { id: "x", capabilities: ["garage", "sales", "inventory"] } as any;
    expect(hasAllCapabilities(profile, ["garage", "sales"])).toBe(true);
  });

  it("returns false when one is missing", () => {
    const profile = { id: "x", capabilities: ["garage"] } as any;
    expect(hasAllCapabilities(profile, ["garage", "sales"])).toBe(false);
  });

  it("returns true for empty caps (vacuously)", () => {
    const profile = { id: "x", capabilities: [] } as any;
    expect(hasAllCapabilities(profile, [])).toBe(true);
  });
});

describe("canAccessModule", () => {
  it("grants access when user has the module's capability", () => {
    const profile = { id: "x", capabilities: ["garage"], user_role: "garage_staff" } as any;
    expect(canAccessModule(profile, "garage_jobs")).toBe(true);
  });

  it("grants access via fallback role even without capability", () => {
    const profile = { id: "x", capabilities: [], user_role: "owner" } as any;
    expect(canAccessModule(profile, "garage_jobs", ["owner"])).toBe(true);
  });

  it("denies when neither capability nor fallback role matches", () => {
    const profile = { id: "x", capabilities: ["sales"], user_role: "sales_ops" } as any;
    expect(canAccessModule(profile, "garage_jobs", ["owner", "garage_manager"])).toBe(false);
  });

  it("returns false for null profile", () => {
    expect(canAccessModule(null, "cars")).toBe(false);
  });
});

describe("APP_CAPABILITIES + MODULE_CAPABILITY contracts", () => {
  it("APP_CAPABILITIES has 11 entries (mirrors DB enum)", () => {
    expect(APP_CAPABILITIES).toHaveLength(11);
  });

  it("MODULE_CAPABILITY values are all valid AppCapability", () => {
    const caps = new Set<string>(APP_CAPABILITIES);
    for (const [mod, cap] of Object.entries(MODULE_CAPABILITY)) {
      expect(caps.has(cap)).toBe(true);
    }
  });
});
