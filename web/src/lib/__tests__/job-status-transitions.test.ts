import { describe, it, expect } from "vitest";
import {
  JOB_STATUS_TRANSITIONS,
  JOB_STATUS_LABELS,
} from "@/lib/constants/jobs";
import type { JobStatus } from "@/types/database";

/**
 * Garage job status machine.
 *
 * The transition graph in JOB_STATUS_TRANSITIONS is what the UI uses to
 * render the "Change status" dropdown. Bugs here either expose a forbidden
 * transition to users (e.g. delivered → pending, which corrupts the audit
 * trail) or hide a valid one (jobs get stuck and need DB intervention).
 */

const ALL_JOB_STATUSES: JobStatus[] = [
  "pending",
  "in_progress",
  "waiting_parts",
  "done",
  "delivered",
  "cancelled",
];

function canTransition(from: JobStatus, to: JobStatus): boolean {
  return (JOB_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

describe("JOB_STATUS_TRANSITIONS — valid transitions", () => {
  it("pending → in_progress", () => {
    expect(canTransition("pending", "in_progress")).toBe(true);
  });

  it("pending → cancelled", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
  });

  it("in_progress → waiting_parts", () => {
    expect(canTransition("in_progress", "waiting_parts")).toBe(true);
  });

  it("in_progress → done", () => {
    expect(canTransition("in_progress", "done")).toBe(true);
  });

  it("in_progress → cancelled", () => {
    expect(canTransition("in_progress", "cancelled")).toBe(true);
  });

  it("waiting_parts → in_progress (parts arrived)", () => {
    expect(canTransition("waiting_parts", "in_progress")).toBe(true);
  });

  it("waiting_parts → cancelled", () => {
    expect(canTransition("waiting_parts", "cancelled")).toBe(true);
  });

  it("done → delivered (customer pickup)", () => {
    expect(canTransition("done", "delivered")).toBe(true);
  });
});

describe("JOB_STATUS_TRANSITIONS — terminal states reject all moves", () => {
  it("delivered is terminal — cannot move to any other status", () => {
    for (const to of ALL_JOB_STATUSES) {
      expect(canTransition("delivered", to)).toBe(false);
    }
  });

  it("cancelled is terminal — cannot move to any other status", () => {
    for (const to of ALL_JOB_STATUSES) {
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });
});

describe("JOB_STATUS_TRANSITIONS — illegal jumps are rejected", () => {
  it("pending cannot jump straight to done (must go through in_progress)", () => {
    expect(canTransition("pending", "done")).toBe(false);
  });

  it("pending cannot jump straight to delivered", () => {
    expect(canTransition("pending", "delivered")).toBe(false);
  });

  it("pending cannot jump to waiting_parts (no job in flight yet)", () => {
    expect(canTransition("pending", "waiting_parts")).toBe(false);
  });

  it("in_progress cannot jump to delivered (must mark done first)", () => {
    expect(canTransition("in_progress", "delivered")).toBe(false);
  });

  it("waiting_parts cannot jump to done (must resume work first)", () => {
    expect(canTransition("waiting_parts", "done")).toBe(false);
  });

  it("waiting_parts cannot jump to delivered", () => {
    expect(canTransition("waiting_parts", "delivered")).toBe(false);
  });

  it("done cannot move back to in_progress (re-open requires new job)", () => {
    expect(canTransition("done", "in_progress")).toBe(false);
  });

  it("done cannot be cancelled (use return / refund flow instead)", () => {
    expect(canTransition("done", "cancelled")).toBe(false);
  });

  it("a status cannot self-transition (UI hides the current option)", () => {
    for (const s of ALL_JOB_STATUSES) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});

describe("JOB_STATUS_TRANSITIONS — label/transition contract", () => {
  it("every status used in transitions has a human label", () => {
    const allKeys = new Set<string>([
      ...Object.keys(JOB_STATUS_TRANSITIONS),
      ...Object.values(JOB_STATUS_TRANSITIONS).flat(),
    ]);
    for (const k of allKeys) {
      expect(JOB_STATUS_LABELS[k]).toBeDefined();
      expect(JOB_STATUS_LABELS[k]).not.toBe("");
    }
  });

  it("every transition target is itself a known status (no typos)", () => {
    const known = new Set<string>(Object.keys(JOB_STATUS_TRANSITIONS));
    for (const targets of Object.values(JOB_STATUS_TRANSITIONS)) {
      for (const t of targets) {
        expect(known.has(t)).toBe(true);
      }
    }
  });
});
