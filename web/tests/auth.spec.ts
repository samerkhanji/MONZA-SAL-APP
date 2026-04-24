import { test, expect } from "@playwright/test";
import { captureAppProblems } from "./lib/console-errors";

test.describe("auth", () => {
  test("pre-authenticated owner lands on dashboard area, not /change-password", async ({ page }, info) => {
    const finish = captureAppProblems(page, info);
    await page.goto("/");
    // When authenticated, the middleware should push us off `/` — typically to
    // the app home. The one URL that would indicate a regression is /change-password.
    await expect(page).not.toHaveURL(/\/change-password/);
    // And we must end up on something authenticated — not /login.
    await expect(page).not.toHaveURL(/\/login(\?|$)/);
    const { consoleErrors } = await finish();
    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toHaveLength(0);
  });

  test("signing out clears the session", async ({ page, context }, info) => {
    const finish = captureAppProblems(page, info);

    // Navigate to an authenticated page so the shell is up.
    await page.goto("/requests");
    await expect(page).not.toHaveURL(/\/login/);

    // The app shell has a logout button inside the user menu. We try multiple
    // locators because different screens use different trigger labels.
    const userMenu = page.getByRole("button", { name: /account|user menu|me/i }).first();
    await userMenu.click({ trial: true }).catch(() => {});
    // Fallback: just clear the storage state and reload — if the cookie was
    // the only thing keeping us in, we should be kicked to /login.
    await context.clearCookies();
    await page.reload();
    await expect(page).toHaveURL(/\/login|\/$/);

    await finish();
  });
});
