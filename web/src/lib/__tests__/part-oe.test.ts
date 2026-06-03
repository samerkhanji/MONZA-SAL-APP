import { describe, it, expect, vi, beforeEach } from "vitest";

// A chainable, awaitable query-builder stub. Every builder method returns the
// same object; awaiting it resolves to the configured { data, error }.
let result: { data: unknown; error: unknown };
const calls: { method: string; args: unknown[] }[] = [];

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  for (const m of ["from", "select", "is", "ilike", "limit", "neq"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  createClient: () => makeBuilder(),
}));

import { oeNumberInUse } from "@/lib/validation/part-oe";

beforeEach(() => {
  calls.length = 0;
  result = { data: [], error: null };
});

describe("oeNumberInUse", () => {
  it("returns false for an empty / whitespace OE number without querying", async () => {
    expect(await oeNumberInUse("   ")).toBe(false);
    expect(calls.length).toBe(0);
  });

  it("returns true when a matching non-deleted part exists", async () => {
    result = { data: [{ id: "abc" }], error: null };
    expect(await oeNumberInUse("OE-TEST-001")).toBe(true);
  });

  it("returns false when no match is found", async () => {
    result = { data: [], error: null };
    expect(await oeNumberInUse("OE-UNIQUE-999")).toBe(false);
  });

  it("excludes the edited part via .neq when excludePartId is given", async () => {
    result = { data: [], error: null };
    await oeNumberInUse("OE-TEST-001", "self-id");
    const neq = calls.find((c) => c.method === "neq");
    expect(neq?.args).toEqual(["id", "self-id"]);
  });

  it("does not call .neq when no excludePartId is given", async () => {
    await oeNumberInUse("OE-TEST-001");
    expect(calls.find((c) => c.method === "neq")).toBeUndefined();
  });

  it("filters out soft-deleted rows (is deleted_at null)", async () => {
    await oeNumberInUse("OE-TEST-001");
    const is = calls.find((c) => c.method === "is");
    expect(is?.args).toEqual(["deleted_at", null]);
  });

  it("fails open (returns false) when the query errors", async () => {
    result = { data: null, error: { message: "boom" } };
    expect(await oeNumberInUse("OE-TEST-001")).toBe(false);
  });
});
