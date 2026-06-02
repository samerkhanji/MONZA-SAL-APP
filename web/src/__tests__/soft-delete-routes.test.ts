import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- mock helpers ----
// The DELETE handlers under test call requireCrud() to gate access and
// supabase.rpc() to invoke the soft-delete migration-165 functions. We
// stub those out so the tests focus on the route's input/output contract:
//   * a missing/invalid id returns 400
//   * a forbidden gate returns its own response (we pass through gate.response)
//   * a missing body is tolerated and reason becomes undefined
//   * an RPC error with code 42501 maps to 403
//   * an RPC error with code 23503 maps to 409 (customer-only)
//   * an RPC error with code P0002 maps to 404
//   * a successful RPC returns 200 { ok: true }

type RpcArgs = { p_id: string; p_reason?: string };

interface MockGate {
  ok: true;
  supabase: { rpc: (fn: string, args: RpcArgs) => Promise<{ error: { code: string; message: string } | null }> };
}

let mockGate: MockGate | { ok: false; response: Response } = {
  ok: true,
  supabase: {
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
};

vi.mock("@/lib/server/require-crud", () => ({
  requireCrud: vi.fn(async () => mockGate),
}));

vi.mock("@/lib/server/api-error", () => ({
  toPublicApiError: (e: unknown) =>
    e && typeof e === "object" && "message" in e ? (e as { message: string }).message : String(e),
}));

vi.mock("@/lib/validation/uuid", () => ({
  isUuid: (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
}));

import { DELETE as deleteCustomer } from "@/app/api/customers/[id]/route";
import { DELETE as deleteGarageJob } from "@/app/api/garage/jobs/[id]/route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mkReq(body?: unknown) {
  // Minimal Request-like with a json() method.
  return {
    json: async () => {
      if (body === undefined) throw new Error("no body");
      return body;
    },
  } as unknown as Request;
}

const VALID_ID = "11111111-1111-1111-1111-111111111111";

function setRpcResponse(error: { code: string; message: string } | null) {
  const rpc = vi.fn().mockResolvedValue({ error });
  mockGate = { ok: true, supabase: { rpc } };
  return rpc;
}

describe("soft-delete API routes (migration 165)", () => {
  beforeEach(() => {
    setRpcResponse(null);
  });

  describe("DELETE /api/customers/[id]", () => {
    it("rejects an invalid uuid with 400", async () => {
      const res = await deleteCustomer(mkReq(), ctx("not-a-uuid"));
      expect(res.status).toBe(400);
    });

    it("calls soft_delete_customers with no reason when no body is sent", async () => {
      const rpc = setRpcResponse(null);
      const res = await deleteCustomer(mkReq(), ctx(VALID_ID));
      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("soft_delete_customers", {
        p_id: VALID_ID,
        p_reason: undefined,
      });
    });

    it("passes a trimmed reason through to the RPC", async () => {
      const rpc = setRpcResponse(null);
      const res = await deleteCustomer(mkReq({ reason: "  duplicate record  " }), ctx(VALID_ID));
      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("soft_delete_customers", {
        p_id: VALID_ID,
        p_reason: "duplicate record",
      });
    });

    it("maps 42501 (insufficient privileges) to 403", async () => {
      setRpcResponse({ code: "42501", message: "insufficient privileges" });
      const res = await deleteCustomer(mkReq(), ctx(VALID_ID));
      expect(res.status).toBe(403);
    });

    it("maps 23503 (active orders FK block) to 409", async () => {
      setRpcResponse({ code: "23503", message: "customer has active orders" });
      const res = await deleteCustomer(mkReq(), ctx(VALID_ID));
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("customer has active orders");
    });

    it("maps P0002 (row not found or already deleted) to 404", async () => {
      setRpcResponse({ code: "P0002", message: "row not found or already deleted" });
      const res = await deleteCustomer(mkReq(), ctx(VALID_ID));
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/garage/jobs/[id]", () => {
    it("rejects an invalid uuid with 400", async () => {
      const res = await deleteGarageJob(mkReq(), ctx("bad-id"));
      expect(res.status).toBe(400);
    });

    it("calls soft_delete_garage_jobs with no reason when no body is sent", async () => {
      const rpc = setRpcResponse(null);
      const res = await deleteGarageJob(mkReq(), ctx(VALID_ID));
      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("soft_delete_garage_jobs", {
        p_id: VALID_ID,
        p_reason: undefined,
      });
    });

    it("passes a trimmed reason through to the RPC", async () => {
      const rpc = setRpcResponse(null);
      const res = await deleteGarageJob(mkReq({ reason: "  wrong intake  " }), ctx(VALID_ID));
      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("soft_delete_garage_jobs", {
        p_id: VALID_ID,
        p_reason: "wrong intake",
      });
    });

    it("maps 42501 to 403", async () => {
      setRpcResponse({ code: "42501", message: "insufficient privileges" });
      const res = await deleteGarageJob(mkReq(), ctx(VALID_ID));
      expect(res.status).toBe(403);
    });

    it("maps P0002 to 404", async () => {
      setRpcResponse({ code: "P0002", message: "row not found or already deleted" });
      const res = await deleteGarageJob(mkReq(), ctx(VALID_ID));
      expect(res.status).toBe(404);
    });
  });

  it("ignores non-string and empty reason values", async () => {
    const rpc = setRpcResponse(null);
    await deleteCustomer(mkReq({ reason: "" }), ctx(VALID_ID));
    await deleteCustomer(mkReq({ reason: 123 }), ctx(VALID_ID));
    await deleteCustomer(mkReq({}), ctx(VALID_ID));
    expect(rpc).toHaveBeenCalledTimes(3);
    for (const call of rpc.mock.calls) {
      expect((call[1] as RpcArgs).p_reason).toBeUndefined();
    }
  });
});
