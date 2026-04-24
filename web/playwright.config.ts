import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

// Load env.test first (optional), then .env.local as fallback
dotenv.config({ path: path.resolve(__dirname, ".env.test") });
dotenv.config({ path: path.resolve(__dirname, ".env.local"), override: false });

/**
 * BASE URL selection
 *   `PLAYWRIGHT_BASE_URL=https://monzacrm.vercel.app` → run against production
 *   otherwise: boot `next dev` on :3000 via webServer below
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const RUN_LOCAL_SERVER = BASE_URL.includes("127.0.0.1") || BASE_URL.includes("localhost");

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  globalSetup: require.resolve("./tests/global-setup"),

  timeout: 45_000,
  expect: { timeout: 8_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    // Reuse an authenticated state produced by global-setup
    storageState: "tests/.auth/owner.json",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Optional mobile sweep — keeps the dev loop fast by opting in via --project=mobile.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    // Production-only project used by `npm run test:e2e:prod`
    {
      name: "chromium-prod",
      use: { ...devices["Desktop Chrome"], baseURL: process.env.PLAYWRIGHT_BASE_URL },
    },
  ],

  webServer: RUN_LOCAL_SERVER
    ? {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
