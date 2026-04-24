import { test, expect } from "@playwright/test";
import { captureAppProblems } from "./lib/console-errors";

test.describe("dashboard integrity", () => {
  test("/dashboard renders with empty/partial data and no visible errors", async ({ page }, info) => {
    const finish = captureAppProblems(page, info);

    await page.goto("/dashboard");

    // Body up, no route bounce
    await expect(page.locator("body")).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/change-password/);

    // Nothing rendered should contain either the generic Next error overlay
    // or the app's red-toast error border.
    const nextOverlay = page.locator("nextjs-portal");
    await expect(nextOverlay).toHaveCount(0);

    const visibleErrorCopy = page.getByText(/Something went wrong|Unexpected error/i);
    await expect(visibleErrorCopy).toHaveCount(0);

    const { failedRequests, consoleErrors } = await finish();

    expect(
      failedRequests.filter((r) => !r.includes("/auth/v1/")),
      `4xx/5xx while loading /dashboard:\n${failedRequests.join("\n")}`
    ).toHaveLength(0);

    expect(
      consoleErrors,
      `Console errors on /dashboard:\n${consoleErrors.join("\n")}`
    ).toHaveLength(0);
  });

  test("/requests shows either a list or a valid empty state (no spinner lock)", async ({ page }, info) => {
    const finish = captureAppProblems(page, info);
    await page.goto("/requests");

    // Wait until either we see a table/empty state OR the "loading" indicator
    // is gone. A permanent loading state means the list query threw silently.
    await expect
      .poll(
        async () => {
          const loadingCopy = await page.getByText(/Loading/i).count();
          return loadingCopy;
        },
        { timeout: 10_000 }
      )
      .toBe(0);

    await finish();
  });
});
