import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for the parts of the app reachable without a real Microsoft
 * account: sign-in, unauthenticated route guarding, and load-time
 * measurement against the dev server. Everything behind `AuthGuard` (the
 * actual migration workspace, dashboard, monitoring, etc.) needs a real MSAL
 * session — this project intentionally has no auth bypass to test against
 * (removed on request; see stores/auth.store.ts), so those flows aren't
 * covered here. Point `baseURL` at a session where you've signed in by hand
 * and add specs under e2e/authenticated/ to extend coverage once you have a
 * test account.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Single worker: `next dev` compiles routes on demand from one Node
  // process, so N parallel workers hitting N different uncompiled routes at
  // once queue up behind that single compiler rather than actually running
  // concurrently — which is what turned every test into a 30s timeout the
  // first time this suite ran. Serial execution avoids that pile-up; it does
  // not reflect a real per-request slowdown (a production build handles
  // concurrent requests fine, since there's no on-demand compile step).
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL || "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
