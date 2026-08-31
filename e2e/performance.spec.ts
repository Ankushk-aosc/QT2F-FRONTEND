import { test, expect } from "@playwright/test";

/**
 * Coarse load-time budgets, not a full Lighthouse audit. The point is a
 * regression alarm: if a future change reintroduces something like the
 * Fluent UI bundle (removed this session — see CHANGELOG) or a blocking
 * network call before first paint, these fail loudly instead of the app
 * just quietly getting slower again.
 *
 * Numbers here are generous for `next dev` (unminified, unbundled compile),
 * specifically to allow the FIRST hit of a route (cold Next.js compile) —
 * see `first hit compiles` below for the split between cold and warm.
 * Production (`next build && next start`) will be substantially faster than
 * either number; if you wire this suite into CI against a build, tighten
 * both.
 */
test.describe("Sign-in load performance", () => {
  test("warm navigation completes and paints the sign-in form quickly", async ({ page }) => {
    // First hit primes the dev-server compile cache; not timed.
    await page.goto("/signin");
    await expect(page.getByRole("button", { name: /sign in with microsoft/i })).toBeVisible();

    const start = Date.now();
    await page.reload();
    await expect(page.getByRole("button", { name: /sign in with microsoft/i })).toBeVisible();
    const elapsedMs = Date.now() - start;

    // eslint-disable-next-line no-console
    console.log(`[perf] warm /signin reload: ${elapsedMs}ms`);
    expect(elapsedMs).toBeLessThan(5_000);
  });

  test("no client-side JS errors during initial load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/signin");
    await expect(page.getByRole("button", { name: /sign in with microsoft/i })).toBeVisible();
    await page.waitForTimeout(1000);

    const meaningful = errors.filter(
      (e) => !/favicon|ResizeObserver loop|Download the React DevTools/i.test(e)
    );
    expect(meaningful, `Console/page errors on load:\n${meaningful.join("\n")}`).toEqual([]);
  });

  test("total transferred bytes for /signin stay within a sane budget", async ({ page }) => {
    let totalBytes = 0;
    page.on("response", async (res) => {
      try {
        const headers = res.headers();
        const len = headers["content-length"];
        if (len) totalBytes += parseInt(len, 10);
      } catch {
        // ignore
      }
    });

    await page.goto("/signin");
    await expect(page.getByRole("button", { name: /sign in with microsoft/i })).toBeVisible();

    // eslint-disable-next-line no-console
    console.log(`[perf] /signin transferred ~${(totalBytes / 1024 / 1024).toFixed(2)}MB (dev build, unminified)`);
    // Generous dev-mode ceiling — Fluent UI alone used to push this well past
    // 10MB of unminified JS on this route. Tightening this number as the
    // production bundle size is confirmed is worth doing.
    expect(totalBytes).toBeLessThan(30 * 1024 * 1024);
  });
});
