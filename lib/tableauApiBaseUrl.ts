/**
 * Base URL of the Tableau base API: connections, workbooks, XML extraction.
 * Same pattern as getQlikApiBaseUrl/getRecordsApiBaseUrl -- bracket notation
 * so Next's SWC can't inline this away at build time in Docker.
 *
 * httpClient.ts used to read `env.TABLEAU_BASE_API_URL` directly, a field
 * that was never declared on the Env type -- since getEnv() is reached
 * through an untyped `require()` in httpClient.ts, that mistake compiled
 * clean and always fell through to the hardcoded literal fallback,
 * regardless of what TABLEAU_API_URL/TABLEAU_BASE_API_URL was actually set
 * to. Routed through a real Env field now (see lib/env.ts) instead.
 */
function readEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
}

export function getTableauApiBaseUrl(): string {
  const url =
    readEnv("NEXT_PUBLIC_TABLEAU_API_BASE_URL") ||
    readEnv("TABLEAU_BASE_API_URL") ||
    readEnv("NEXT_PUBLIC_TABLEAU_API_URL") ||
    readEnv("TABLEAU_API_URL") ||
    "https://tableaue-base-api.onrender.com";

  return url.trim().replace(/\/+$/, "");
}
