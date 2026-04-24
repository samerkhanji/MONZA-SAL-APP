import { test, expect } from "@playwright/test";
import { captureAppProblems } from "./lib/console-errors";
import { hasAdmin, supabaseAdmin, qaLabel, QA_PREFIX } from "./lib/supabase-admin";

test.describe("forms & DB round-trip", () => {
  test.skip(!hasAdmin, "SUPABASE_SERVICE_ROLE_KEY missing — DB-verify test skipped");

  // Clean up anything we created across previous runs that might still be
  // lying around (e.g. CI killed mid-test).
  test.afterAll(async () => {
    if (!hasAdmin) return;
    await supabaseAdmin
      .from("customers")
      .delete()
      .ilike("first_name", `${QA_PREFIX}%`);
  });

  test("create customer via /customers/add and verify row landed in DB", async ({ page }, info) => {
    const finish = captureAppProblems(page, info);

    const firstName = qaLabel();
    const lastName = "Playwright";
    const phone = "+96100000000";

    await page.goto("/customers/add");
    await expect(page).toHaveURL(/\/customers\/add/);

    // Field names may vary across the app — we grab by label first then
    // fall back to `name` attributes. Whichever is there first wins.
    await page
      .getByLabel(/first name/i)
      .or(page.locator('input[name="first_name"]'))
      .first()
      .fill(firstName);
    await page
      .getByLabel(/last name/i)
      .or(page.locator('input[name="last_name"]'))
      .first()
      .fill(lastName);
    await page
      .getByLabel(/primary phone|phone/i)
      .or(page.locator('input[name="phone_primary"]'))
      .first()
      .fill(phone);

    // Wait for the insert response in parallel with clicking the submit button.
    const [insertResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/rest/v1/customers") && res.request().method() === "POST",
        { timeout: 15_000 }
      ),
      page.getByRole("button", { name: /save|create|add customer/i }).first().click(),
    ]);

    expect(insertResponse.ok(), `Insert returned ${insertResponse.status()}`).toBeTruthy();

    // Verify server-side via service role.
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, phone_primary")
      .eq("first_name", firstName)
      .limit(1)
      .maybeSingle();

    expect(error?.message ?? "", `DB lookup error: ${error?.message}`).toBe("");
    expect(data, `No row inserted for ${firstName}`).not.toBeNull();
    expect(data?.last_name).toBe(lastName);

    // Cleanup the single row we just created.
    if (data?.id) {
      await supabaseAdmin.from("customers").delete().eq("id", data.id);
    }

    await finish();
  });
});
