import { describe, it, expect, beforeEach } from "vitest";
import {
  EMAIL_BUCKET_SIZE,
  IP_BUCKET_SIZE,
  REFILL_WINDOW_MS,
  checkEmailFlowLimit,
  getRequestIp,
  __resetEmailFlowLimiter,
} from "@/lib/rate-limit/email-flow-limiter";

describe("checkEmailFlowLimit", () => {
  beforeEach(() => {
    __resetEmailFlowLimiter();
  });

  it("allows up to EMAIL_BUCKET_SIZE requests for one email", () => {
    const email = "alice@example.com";
    for (let i = 0; i < EMAIL_BUCKET_SIZE; i++) {
      const r = checkEmailFlowLimit({ email, ip: `10.0.0.${i}` });
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks the 4th request for the same email with a 429-style result", () => {
    const email = "alice@example.com";
    for (let i = 0; i < EMAIL_BUCKET_SIZE; i++) {
      checkEmailFlowLimit({ email, ip: `10.0.0.${i}` });
    }
    const blocked = checkEmailFlowLimit({ email, ip: "10.0.0.99" });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toBe("email");
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("treats email case-insensitively", () => {
    checkEmailFlowLimit({ email: "Bob@Example.com", ip: "10.0.0.1" });
    checkEmailFlowLimit({ email: "BOB@example.com", ip: "10.0.0.2" });
    checkEmailFlowLimit({ email: "bob@example.com", ip: "10.0.0.3" });
    const fourth = checkEmailFlowLimit({ email: "bob@EXAMPLE.com", ip: "10.0.0.4" });
    expect(fourth.allowed).toBe(false);
  });

  it("keeps separate buckets for different emails", () => {
    for (let i = 0; i < EMAIL_BUCKET_SIZE; i++) {
      checkEmailFlowLimit({ email: "alice@example.com", ip: `10.0.0.${i}` });
    }
    // Different email, still has full quota even though IPs were used.
    const r = checkEmailFlowLimit({ email: "carol@example.com", ip: "10.0.0.50" });
    expect(r.allowed).toBe(true);
  });

  it("enforces the IP bucket across distinct emails", () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < IP_BUCKET_SIZE; i++) {
      const r = checkEmailFlowLimit({ email: `user${i}@example.com`, ip });
      expect(r.allowed).toBe(true);
    }
    const blocked = checkEmailFlowLimit({ email: "another@example.com", ip });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toBe("ip");
    }
  });

  it("refills both buckets after the time window elapses", () => {
    const email = "alice@example.com";
    const ip = "10.0.0.1";
    const start = 1_700_000_000_000;
    for (let i = 0; i < EMAIL_BUCKET_SIZE; i++) {
      checkEmailFlowLimit({ email, ip, now: start + i });
    }
    const blocked = checkEmailFlowLimit({ email, ip, now: start + 1000 });
    expect(blocked.allowed).toBe(false);

    const afterWindow = checkEmailFlowLimit({
      email,
      ip,
      now: start + REFILL_WINDOW_MS + 1,
    });
    expect(afterWindow.allowed).toBe(true);
  });
});

describe("getRequestIp", () => {
  it("prefers the first entry in x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.1, 10.0.0.1, 172.16.0.1",
    });
    expect(getRequestIp(headers)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip then 'unknown'", () => {
    expect(getRequestIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7"
    );
    expect(getRequestIp(new Headers())).toBe("unknown");
  });
});
