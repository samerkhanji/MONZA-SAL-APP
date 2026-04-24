// Runs ONCE before any test. It:
//   1. Ensures the test owner account is in a sane state (must_change_password=false,
//      is_active=true). This prevents FirstLoginGuard from looping us to
//      /change-password during the test run.
//   2. Signs the test owner in via Playwright and persists the auth state to
//      `tests/.auth/owner.json` so every spec can start already-authenticated.

import { chromium, FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { supabaseAdmin, hasAdmin } from "./lib/supabase-admin";

export default async function globalSetup(config: FullConfig) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "TEST_EMAIL / TEST_PASSWORD missing — copy .env.test.example → .env.test and fill them in."
    );
  }

  // 1) Put the test user in a non-loop state.
  if (hasAdmin) {
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, user_role, must_change_password, is_active")
      .eq("email", email.toLowerCase())
      .limit(1);

    if (error) {
      console.warn("[global-setup] profile lookup failed:", error.message);
    } else if (!profiles || profiles.length === 0) {
      console.warn(
        `[global-setup] no profile row for ${email} — tests will still try to sign in.`
      );
    } else {
      const p = profiles[0] as { id: string; must_change_password: boolean; is_active: boolean };
      if (p.must_change_password !== false || p.is_active !== true) {
        await supabaseAdmin
          .from("profiles")
          .update({ must_change_password: false, is_active: true })
          .eq("id", p.id);
        console.log(
          `[global-setup] reset must_change_password + is_active for ${email}.`
        );
      }
    }
  }

  // 2) Persist an authenticated browser state.
  const baseURL =
    (config.projects[0]?.use as { baseURL?: string })?.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://127.0.0.1:3000";

  const authDir = path.resolve(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });
  const authFile = path.join(authDir, "owner.json");

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Either we land on /requests (post-login default) or /change-password.
    // The latter means the reset flag wasn't cleared → fail the run early.
    await page.waitForURL(
      (url) =>
        !url.pathname.startsWith("/login") && !url.pathname.startsWith("/"),
      { timeout: 20_000 }
    ).catch(async () => {
      const current = page.url();
      if (current.includes("/change-password")) {
        throw new Error(
          `Login landed on /change-password. Expected flag to be cleared — check global-setup step 1.`
        );
      }
      // else: we're still on /login or /, likely wrong password. Dump for debugging.
      const html = await page.content();
      fs.writeFileSync(path.join(authDir, "login-failure.html"), html);
      throw new Error(
        `Login did not navigate away from /login or /. See tests/.auth/login-failure.html.`
      );
    });

    await context.storageState({ path: authFile });
    console.log(`[global-setup] wrote auth state → ${authFile}`);
  } finally {
    await browser.close();
  }
}
