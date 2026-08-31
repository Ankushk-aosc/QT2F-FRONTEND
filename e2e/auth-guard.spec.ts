import { test, expect } from "@playwright/test";

/**
 * The core promise from this session's auth work: no protected content is
 * ever visible before a real MSAL session exists, for any protected route,
 * on a cold unauthenticated visit.
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/migrations",
  "/migrations/qlik",
  "/migrations/tableau",
  "/monitoring",
  "/run-history",
  "/settings",
];

test.describe("AuthGuard blocks unauthenticated access", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to /signin instead of rendering`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.ok()).toBeTruthy();

      await page.waitForURL(/\/signin/, { timeout: 15_000 });
      expect(page.url()).toContain("/signin");
      expect(page.url()).toContain(`redirect=${encodeURIComponent(route)}`);

      // Belt-and-suspenders: nothing from the protected shell should have
      // painted at any point, not just "eventually redirected".
      await expect(page.getByRole("button", { name: /sign in with microsoft/i })).toBeVisible();
    });
  }

  test("root ('/') redirects through /dashboard to /signin, not a standalone picker", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/signin\?redirect=%2Fdashboard/, { timeout: 15_000 });
    expect(page.url()).toContain("redirect=%2Fdashboard");
  });
});
