import { test, expect } from "@playwright/test";

// Pages the owner should be able to read without a single 401/403
// from the PostgREST layer. Catches silent RLS regressions (like the one
// that caused the password-reset loop: RESTRICTIVE policies returning 0 rows).
const DATA_PAGES = [
  "/cars",
  "/customers",
  "/sales-orders",
  "/installments",
  "/accessories",
  "/test-drive",
  "/requests",
  "/dashboard/overview",
];

test.describe("RLS sanity (owner)", () => {
  for (const path of DATA_PAGES) {
    test(`${path} issues no 401/403 PostgREST responses`, async ({ page }) => {
      const denials: string[] = [];

      page.on("response", (resp) => {
        const s = resp.status();
        const u = resp.url();
        if (u.includes("/rest/v1/") && (s === 401 || s === 403)) {
          denials.push(`${s} ${resp.request().method()} ${u}`);
        }
      });

      const resp = await page.goto(path);
      if (resp && resp.status() >= 500) {
        throw new Error(`${path} returned HTTP ${resp.status()}`);
      }

      // Give any lazy queries ~2s to fire after hydration.
      await page.waitForTimeout(2_000);

      expect(denials, `Unexpected RLS denials on ${path}:\n${denials.join("\n")}`).toHaveLength(
        0
      );
    });
  }
});
