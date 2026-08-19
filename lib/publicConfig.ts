/**
 * Browser-visible configuration.
 *
 * Only values that are safe for anyone to read belong here. `NEXT_PUBLIC_*`
 * variables are inlined into the client bundle at build time, so anything named
 * here is effectively published.
 *
 * ## Why this module exists
 *
 * Three components each derived the run-history API base URL inline, and two of
 * them fell back to a hardcoded literal:
 *
 *     process.env.NEXT_PUBLIC_SQL_BASE_URL ||
 *       "https://az-wa-sql-db-vl-....australiaeast-01.azurewebsites.net"
 *
 * That address is one particular environment's database service, compiled into
 * every deployment's JavaScript. Any installation that had not set
 * `NEXT_PUBLIC_SQL_BASE_URL` sent its users' run-history queries — with their
 * bearer tokens attached — to that host. The fallback is removed: an
 * unconfigured deployment now degrades visibly instead of quietly talking to
 * somebody else's backend.
 */

/**
 * Base URL of the run-history service, or "" when not configured.
 *
 * Callers must treat "" as "this feature is unavailable" rather than joining it
 * onto a path, which would produce a same-origin request to a route that does
 * not exist.
 */
export function getSqlBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SQL_BASE_URL ?? "").replace(/\/$/, "");
}

/** True when the run-history service has been configured for this deployment. */
export function hasSqlBaseUrl(): boolean {
  return getSqlBaseUrl() !== "";
}

/** One consistent warning, so an unconfigured deployment is obvious in the console. */
export function warnSqlBaseUrlMissing(feature: string): void {
  console.warn(
    `[config] NEXT_PUBLIC_SQL_BASE_URL is not set, so ${feature} is unavailable. ` +
      "Set it to this environment's run-history service.",
  );
}
