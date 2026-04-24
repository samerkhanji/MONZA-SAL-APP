import { test, expect } from "@playwright/test";
import { captureAppProblems } from "./lib/console-errors";

// Pages the owner role should be able to reach without a redirect
// or a visible error. Keep this list in sync with the owner nav in
// web/src/components/dashboard-shell.tsx.
const OWNER_PAGES = [
  "/requests",
  "/requests/pending",
  "/cars",
  "/customers",
  "/installments",
  "/sales-orders",
  "/accessories",
  "/test-drive",
  "/documents",
  "/data-health",
  "/dashboard",
  "/dashboard/overview",
  "/garage",
  "/garage/tasks",
  "/garage/inventory",
  "/garage/history",
  "/garage/settings",
  "/settings",
];

test.describe("navigation (owner)", () => {
  for (const path of OWNER_PAGES) {
    test(`${path} loads without redirecting to login/change-password`, async ({ page }, info) => {
      const finish = captureAppProblems(page, info);

      const resp = await page.goto(path);
      // Allow dev-mode 304s; fail only on 5xx responses.
      if (resp && resp.status() >= 500) {
        throw new Error(`${path} returned ${resp.status()}`);
      }

      // Hard guardrails on redirects
      await expect(page, `redirected to login from ${path}`).not.toHaveURL(/\/login(\?|$)/);
      await expect(page, `redirected to change-password from ${path}`).not.toHaveURL(/\/change-password/);

      // Sanity: the page body rendered something
      await expect(page.locator("body")).toBeVisible();

      // Collect diagnostics
      const { consoleErrors, failedRequests } = await finish();

      // Surface noisy failures instead of letting the test pass green
      expect(
        failedRequests.filter((r) => !r.includes("/auth/v1/")),
        `4xx/5xx responses:\n${failedRequests.join("\n")}`
      ).toHaveLength(0);

      expect(
        consoleErrors,
        `Console errors on ${path}:\n${consoleErrors.join("\n")}`
      ).toHaveLength(0);
    });
  }

  test("sidebar link sweep from /requests clicks every visible nav item without hard crash", async ({
    page,
  }, info) => {
    const finish = captureAppProblems(page, info);
    await page.goto("/requests");

    // Pull every top-level anchor that the sidebar exposes, then click them
    // in sequence. Using role=link keeps the sidebar buttons out.
    const links = page.getByRole("link");
    const hrefs = new Set<string>();
    for (const link of await links.all()) {
      const href = await link.getAttribute("href");
      if (!href || !href.startsWith("/")) continue;
      if (href.includes("#") || href.startsWith("/api")) continue;
      hrefs.add(href);
    }

    for (const href of hrefs) {
      const resp = await page.goto(href);
      if (resp && resp.status() >= 500) {
        throw new Error(`${href} returned ${resp.status()}`);
      }
      await expect(page.locator("body"), `${href} body blank`).toBeVisible();
    }

    const { consoleErrors, failedRequests } = await finish();
    expect(
      failedRequests.filter((r) => !r.includes("/auth/v1/")),
      `Failed requests during sweep:\n${failedRequests.join("\n")}`
    ).toHaveLength(0);
    expect(
      consoleErrors.length,
      `Console errors during sweep:\n${consoleErrors.join("\n")}`
    ).toBeLessThan(3); // small tolerance for Next dev overlays
  });
});
