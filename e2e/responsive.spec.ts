import { test, expect } from "@playwright/test";

/**
 * Sign-in is the one screen reachable without auth, so it's the only place
 * this suite can actually check responsive behavior end-to-end. It's also
 * the screen a fresh visitor always sees first, which is why it's worth
 * covering across the full viewport range rather than just default desktop.
 */
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "ultrawide", width: 1920, height: 1080 },
];

test.describe("Sign-in responsive layout", () => {
  for (const vp of VIEWPORTS) {
    test(`renders without horizontal overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/signin");

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      // A couple of px of slack for scrollbar-gutter rounding.
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

      await expect(page.getByRole("button", { name: /sign in with microsoft/i })).toBeVisible();
    });
  }

  test("card stays inside a bounded container at ultrawide instead of stretching edge to edge", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/signin");

    const cardBox = await page.locator(".rounded-3xl").first().boundingBox();
    expect(cardBox).not.toBeNull();
    // The whole sign-in panel is capped at max-w-[1240px]; at 1920px viewport
    // it must not have grown past that, which is exactly the "stretches into
    // huge empty space" bug this was fixed for.
    expect(cardBox!.width).toBeLessThanOrEqual(1240 + 4);
  });

  test("marketing panel hides below the lg breakpoint, Microsoft button stays reachable", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/signin");

    await expect(page.getByText("Unified Migration")).toBeHidden();
    await expect(page.getByRole("button", { name: /sign in with microsoft/i })).toBeVisible();
  });
});
