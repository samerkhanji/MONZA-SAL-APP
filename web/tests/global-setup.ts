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

    // DIAGNOSTIC: dump page state on any login-step failure so we can see what
    // the page actually looked like instead of just "selector timed out".
    async function dumpDiagnostics(label: string) {
      try {
        const url = page.url();
        const title = await page.title().catch(() => "<no title>");
        const inputs = await page.$$eval("input", (els) =>
          els.map((e) => ({
            type: (e as HTMLInputElement).type,
            id: e.id,
            name: (e as HTMLInputElement).name,
            visible: !!(e as HTMLElement).offsetParent,
            ariaHidden: e.getAttribute("aria-hidden"),
          }))
        );
        const html = await page.content();
        fs.writeFileSync(path.join(authDir, "diag-page.html"), html);
        await page.screenshot({ path: path.join(authDir, "diag-page.png"), fullPage: true });
        const report = [
          `=== DIAG: ${label} ===`,
          `url: ${url}`,
          `title: ${title}`,
          `input count: ${inputs.length}`,
          ...inputs.map((i, n) => `  [${n}] type=${i.type} id=${i.id} name=${i.name} visible=${i.visible} aria-hidden=${i.ariaHidden}`),
          `screenshot: tests/.auth/diag-page.png`,
          `html:       tests/.auth/diag-page.html`,
        ].join("\n");
        fs.writeFileSync(path.join(authDir, "diag.txt"), report);
        console.error("\n" + report + "\n");
      } catch (e) {
        console.error("[diag] failed to capture:", e);
      }
    }

    try {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
    } catch (err) {
      await dumpDiagnostics("fill/click failed");
      throw err;
    }

    // Either we land on /requests (post-login default) or /change-password.
    // The latter means the reset flag wasn't cleared → fail the run early.
    // Predicate: success = navigated to any path that isn't /login and isn't bare "/".
    await page.waitForURL(
      (url) => !url.pathname.startsWith("/login") && url.pathname !== "/",
      { timeout: 20_000 }
    ).catch(async () => {
      const current = page.url();
      if (current.includes("/change-password")) {
        await dumpDiagnostics("landed on /change-password");
        throw new Error(
          `Login landed on /change-password. Expected flag to be cleared — check global-setup step 1.`
        );
      }
      await dumpDiagnostics("login did not navigate");
      // Also save the legacy login-failure.html for backwards compat.
      const html = await page.content();
      fs.writeFileSync(path.join(authDir, "login-failure.html"), html);
      throw new Error(
        `Login did not navigate away from /login or /. Current URL: ${current}. See tests/.auth/diag.txt + diag-page.png.`
      );
    });

    await context.storageState({ path: authFile });
    console.log(`[global-setup] wrote auth state → ${authFile}`);
  } finally {
    await browser.close();
  }
}
