import { test, expect } from "@playwright/test";

test.describe("Sign-in page", () => {
  test("shows only Microsoft sign-in — no email/password, no dev bypass", async ({ page }) => {
    await page.goto("/signin");

    await expect(page.getByRole("button", { name: /sign in with microsoft/i })).toBeVisible();

    // The things explicitly requested to be removed must not exist at all,
    // not just be hidden — a regression that re-adds them (even behind a
    // dev-only guard) should fail this test.
    await expect(page.getByLabel(/email address/i)).toHaveCount(0);
    await expect(page.getByLabel(/^password$/i)).toHaveCount(0);
    await expect(page.getByText(/forgot password/i)).toHaveCount(0);
    await expect(page.getByText(/remember me/i)).toHaveCount(0);
    await expect(page.getByText(/contact administrator/i)).toHaveCount(0);
    await expect(page.getByText(/dev bypass/i)).toHaveCount(0);
  });

  test("Microsoft button starts an MSAL redirect", async ({ page }) => {
    await page.goto("/signin");

    const button = page.getByRole("button", { name: /sign in with microsoft/i });
    await button.click();

    // loginRedirect() takes the browser to login.microsoftonline.com; we
    // don't have credentials to complete that flow, so the assertion is just
    // that it actually starts — the button enters its loading state and/or
    // the page begins navigating away from /signin.
    await expect(async () => {
      const url = page.url();
      const stillLoading = await button.isDisabled().catch(() => false);
      expect(url.includes("login.microsoftonline.com") || stillLoading).toBeTruthy();
    }).toPass({ timeout: 10_000 });
  });

  test("marketing panel renders the four feature highlights", async ({ page }) => {
    await page.goto("/signin");
    for (const label of ["AI-Driven Migration", "Real-time Monitoring", "End-to-End Validation", "Enterprise Security"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });
});
