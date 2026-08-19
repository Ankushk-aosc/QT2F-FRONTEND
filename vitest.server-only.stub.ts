/**
 * Test stub for the `server-only` package.
 *
 * `server-only` exists to fail the build if a server module is pulled into a
 * client bundle. Vitest is neither, and it cannot resolve the package, so
 * server modules are untestable without this. Aliased in `vitest.config.ts`.
 *
 * This weakens nothing in production: the real package is still imported by the
 * real build, which is where the guard matters.
 */
export {};
