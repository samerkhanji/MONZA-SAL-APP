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

  it("falls back from legacy role field when user_role is missing", () => {
    const owner = { role: "owner" } as any;
    const garageManager = { role: "garage_manager" } as any;
    const sales = { role: "sales" } as any;
    const assistant = { role: "assistant" } as any;
    const unknown = { role: "something_else" } as any;

    expect(getAppRoleFromProfile(owner)).toBe("owner");
    expect(getAppRoleFromProfile(garageManager)).toBe("garage_manager");
    expect(getAppRoleFromProfile(sales)).toBe("sales_ops");
    expect(getAppRoleFromProfile(assistant)).toBe("assistant");
    expect(getAppRoleFromProfile(unknown)).toBeNull();
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

