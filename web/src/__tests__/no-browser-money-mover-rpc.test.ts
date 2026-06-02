/**
 * Launch security Decision 2 enforcement test.
 *
 * The 7 money-mover RPCs are now Server-Action-only. The migration
 * (168_revoke_money_mover_rpc_authenticated.sql) revokes EXECUTE on these
 * RPCs from `authenticated` — so the browser physically cannot call them
 * even if a reintroduced supabase.rpc("...") line slips through code review.
 *
 * This test is the static / grep-time safety net: it walks every .ts/.tsx
 * file under web/src and fails if any client/browser code references one
 * of the seven RPC names inside a `supabase.rpc("...")` call.
 *
 * Files explicitly exempted:
 *   - lib/server/actions/money-mover.ts — the Server Actions themselves
 *     (they call the `_srv_<name>` wrappers, not the originals).
 *   - This test file (matches by name on the strings).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const SRC_ROOT = join(__dirname, "..");

const FORBIDDEN_RPCS = [
  "record_manual_cash_movement",
  "submit_purchase_order",
  "approve_refund",
  "reject_refund",
  "void_sales_order",
  "gdpr_anonymize_customer",
  "apply_installment_payment",
];

const SCAN_EXTS = new Set([".ts", ".tsx"]);

const EXEMPT_PATH_FRAGMENTS = [
  // The Server Actions themselves intentionally reference the wrapper names,
  // not the originals, but we exempt the file for clarity.
  join("lib", "server", "actions", "money-mover.ts"),
  // The wrapper test file uses the RPC names as test fixtures.
  join("lib", "server", "actions", "__tests__", "money-mover.test.ts"),
  // This file lists them as expected forbidden strings.
  join("__tests__", "no-browser-money-mover-rpc.test.ts"),
];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const out: string[] = [];
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (st.isFile()) {
      const dot = name.lastIndexOf(".");
      if (dot < 0) continue;
      const ext = name.slice(dot);
      if (SCAN_EXTS.has(ext)) out.push(full);
    }
  }
  return out;
}

function isExempt(filePath: string): boolean {
  return EXEMPT_PATH_FRAGMENTS.some((frag) => filePath.endsWith(frag) || filePath.includes(`${sep}${frag}`));
}

describe("no browser-side supabase.rpc() calls for money-mover RPCs", () => {
  it("contains no `supabase.rpc(\"<rpc>\"` references in client code", () => {
    const files = walk(SRC_ROOT);
    const offenders: { file: string; line: number; text: string; rpc: string }[] = [];

    for (const file of files) {
      if (isExempt(file)) continue;
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes("supabase.rpc(")) continue;
        for (const rpc of FORBIDDEN_RPCS) {
          // Match the RPC name as a quoted literal in the same line.
          if (
            line.includes(`"${rpc}"`) ||
            line.includes(`'${rpc}'`) ||
            line.includes(`\`${rpc}\``)
          ) {
            offenders.push({ file, line: i + 1, text: line.trim(), rpc });
          }
        }
      }
    }

    if (offenders.length > 0) {
      const report = offenders
        .map(
          (o) =>
            `  ${o.file}:${o.line} → supabase.rpc("${o.rpc}") — must use Server Action from @/lib/server/actions/money-mover instead`
        )
        .join("\n");
      throw new Error(
        `Found ${offenders.length} direct browser RPC call(s) for money-mover RPCs:\n${report}`
      );
    }

    expect(offenders).toEqual([]);
  });
});
