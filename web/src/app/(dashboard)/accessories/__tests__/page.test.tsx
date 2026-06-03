/**
 * Regression tests for the Accessories page bug fixes:
 *
 *   - Bug 1: negative qty silently coerced to a positive integer
 *   - Bug 2: no maximum qty (9-digit numbers polluted summary totals)
 *   - Bug 4: linked plate field accepted any free-form text without feedback
 *
 * The page talks to Supabase on mount, so the entire client is mocked with a
 * thin chainable stub. The supabase mock is hoisted so we can mutate the
 * fetched rows between tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { AccessoryInventoryRow } from "@/types/accessories";

const { toastSpy, supabaseState } = vi.hoisted(() => {
  const toastSpy = {
    error: vi.fn(),
    success: vi.fn(),
  };
  const supabaseState = {
    rows: [] as AccessoryInventoryRow[],
  };
  return { toastSpy, supabaseState };
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), toastSpy),
}));

// Thin builder that mimics enough of the supabase-js fluent API for what the
// page actually calls during the tests below.
function buildClient() {
  return {
    from(_table: string) {
      void _table;
      return {
        select(_cols?: string) {
          void _cols;
          return {
            limit: async (_n: number) => {
              void _n;
              return { data: supabaseState.rows, error: null };
            },
          };
        },
        upsert: async () => ({ error: null }),
        insert(_payload: unknown) {
          void _payload;
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: `new-${Math.random().toString(36).slice(2)}`,
                  category: "cushion",
                  label: "",
                  quantity: 1,
                  note: "",
                  linked_plate: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as AccessoryInventoryRow,
                error: null,
              }),
            }),
          };
        },
        delete() {
          return {
            eq: async (_col: string, _val: string) => {
              void _col;
              void _val;
              return { error: null };
            },
          };
        },
      };
    },
  };
}

vi.mock("@/lib/supabase", () => ({
  createClient: () => buildClient(),
}));

// The custom-collections widget hits its own Supabase tables + user context.
// We don't exercise it in these tests, so a stub keeps the render clean.
vi.mock("@/components/accessories/CustomAccessoryCollections", () => ({
  CustomAccessoryCollections: () => null,
}));

// The Excel export button pulls in dynamic-imported deps that puff the test
// runtime up; nothing in these tests exercises it.
vi.mock("@/components/ExportButton", () => ({
  ExportButton: () => null,
}));

import AccessoriesPage from "@/app/(dashboard)/accessories/page";

function makeRow(over: Partial<AccessoryInventoryRow>): AccessoryInventoryRow {
  return {
    id: "r1",
    category: "cushion",
    label: "Test cushion",
    quantity: 3,
    note: "",
    linked_plate: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...over,
  };
}

describe("AccessoriesPage", () => {
  beforeEach(() => {
    toastSpy.error.mockReset();
    toastSpy.success.mockReset();
    supabaseState.rows = [];
    cleanup();
  });

  describe("quantity input", () => {
    it("Bug 1: rejects a negative quantity, clamps to MIN_QTY, and shows a toast", async () => {
      supabaseState.rows = [makeRow({ id: "r1", quantity: 5 })];

      render(<AccessoriesPage />);

      // Wait for the page to hydrate — the qty input only renders after the
      // initial fetch resolves.
      const qtyInput = await screen.findByDisplayValue("5");
      // Sanity check that we grabbed the qty cell, not some other "5".
      expect((qtyInput as HTMLInputElement).type).toBe("number");

      fireEvent.change(qtyInput, { target: { value: "-5" } });

      await waitFor(() => {
        expect(toastSpy.error).toHaveBeenCalled();
      });
      const msg = toastSpy.error.mock.calls.map((c) => c[0]).join(" | ");
      expect(msg).toMatch(/at least 1/i);

      // Value is clamped back to MIN_QTY (1), not silently coerced to 5.
      expect((qtyInput as HTMLInputElement).value).toBe("1");
    });

    it("accepts a legal positive integer without complaint", async () => {
      supabaseState.rows = [makeRow({ id: "r1", quantity: 3 })];

      render(<AccessoriesPage />);

      const qtyInput = await screen.findByDisplayValue("3");
      fireEvent.change(qtyInput, { target: { value: "7" } });

      expect((qtyInput as HTMLInputElement).value).toBe("7");
      expect(toastSpy.error).not.toHaveBeenCalled();
    });

    it("Bug 2: rejects a quantity over MAX_QTY and clamps to the cap", async () => {
      supabaseState.rows = [makeRow({ id: "r1", quantity: 1 })];

      render(<AccessoriesPage />);

      const qtyInput = await screen.findByDisplayValue("1");
      fireEvent.change(qtyInput, { target: { value: "999999999" } });

      await waitFor(() => {
        expect(toastSpy.error).toHaveBeenCalled();
      });
      const msg = toastSpy.error.mock.calls.map((c) => c[0]).join(" | ");
      expect(msg).toMatch(/99,?999|or less/i);

      // Clamped to MAX_QTY (99999), never the raw 9-digit input.
      expect((qtyInput as HTMLInputElement).value).toBe("99999");
    });

    it("accepts a value at the cap (99999)", async () => {
      supabaseState.rows = [makeRow({ id: "r1", quantity: 1 })];

      render(<AccessoriesPage />);

      const qtyInput = await screen.findByDisplayValue("1");
      fireEvent.change(qtyInput, { target: { value: "99999" } });

      expect((qtyInput as HTMLInputElement).value).toBe("99999");
      expect(toastSpy.error).not.toHaveBeenCalled();
    });
  });

  describe("linked plate input (Bug 4)", () => {
    it("shows an inline error when the value doesn't match a known plate", async () => {
      // A plate row defines the canonical list; the cushion row carries the
      // linked-plate field we're validating.
      supabaseState.rows = [
        makeRow({
          id: "p1",
          category: "plates",
          label: "ABC-123",
          linked_plate: "ABC-123",
        }),
        makeRow({ id: "c1", category: "cushion", label: "Front" }),
      ];

      render(<AccessoriesPage />);

      // Wait for hydration via a row label we know is on screen.
      await screen.findByDisplayValue("Front");

      // The linked-plate input is the one with placeholder "Optional" inside
      // the cushion row.
      const inputs = screen.getAllByPlaceholderText("Optional");
      // The first "Optional" placeholder belongs to the note column; the
      // second is the linked-plate column. Filter by the column's max-width
      // class so the test stays specific even if columns are reordered.
      const linkedPlateInput = inputs.find((el) =>
        el.className.includes("max-w-xs")
      ) as HTMLInputElement | undefined;
      expect(linkedPlateInput).toBeDefined();
      if (!linkedPlateInput) return;

      fireEvent.change(linkedPlateInput, { target: { value: "CUSTOM_PLATE_123" } });
      fireEvent.blur(linkedPlateInput);

      // The error message lands as a role=alert sibling beneath the input.
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/match an existing plate/i);

      // aria-invalid is wired up for assistive tech.
      expect(linkedPlateInput.getAttribute("aria-invalid")).toBe("true");
    });

    it("clears the error once the user enters a matching plate", async () => {
      supabaseState.rows = [
        makeRow({
          id: "p1",
          category: "plates",
          label: "ABC-123",
          linked_plate: "ABC-123",
        }),
        makeRow({ id: "c1", category: "cushion", label: "Front" }),
      ];

      render(<AccessoriesPage />);
      await screen.findByDisplayValue("Front");

      const linkedPlateInput = screen
        .getAllByPlaceholderText("Optional")
        .find((el) => el.className.includes("max-w-xs")) as HTMLInputElement;

      // First enter an invalid value to surface the error.
      fireEvent.change(linkedPlateInput, { target: { value: "WRONG" } });
      fireEvent.blur(linkedPlateInput);
      await screen.findByRole("alert");

      // Then correct it to a known plate (case-insensitive match).
      fireEvent.change(linkedPlateInput, { target: { value: "abc-123" } });
      fireEvent.blur(linkedPlateInput);

      await waitFor(() => {
        expect(screen.queryByRole("alert")).toBeNull();
      });
      expect(linkedPlateInput.getAttribute("aria-invalid")).toBe("false");
    });

    it("does not show an error when the field is left empty", async () => {
      supabaseState.rows = [
        makeRow({ id: "c1", category: "cushion", label: "Front" }),
      ];

      render(<AccessoriesPage />);
      await screen.findByDisplayValue("Front");

      const linkedPlateInput = screen
        .getAllByPlaceholderText("Optional")
        .find((el) => el.className.includes("max-w-xs")) as HTMLInputElement;

      fireEvent.change(linkedPlateInput, { target: { value: "" } });
      fireEvent.blur(linkedPlateInput);

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
