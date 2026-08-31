/**
 * Base URL of the Qlik base API (NEXT_PUBLIC_QLIK_API_BASE_URL):
 * spaces, apps, unbuild, connections.
 *
 * Checks runtime environment variables in order:
 * 1. process.env["NEXT_PUBLIC_QLIK_API_BASE_URL"]
 * 2. process.env["QLIK_API_BASE_URL"]
 * 3. process.env["NEXT_PUBLIC_QLIK_API_URL"]
 * 4. process.env["QLIK_API_URL"]
 * 5. process.env["VL_Q2F_NEXT_PUBLIC_QLIK_API_BASE_URL_SV"]
 * 6. Default Azure Container Apps URL fallback:
 *    "https://vl-q2f-qlik-base-api-ca-dev.yellowsea-4a43ecd7.australiaeast.azurecontainerapps.io"
 *
 * Bracket notation (process.env["..."]) prevents Next.js SWC from inlining
 * undefined at build time in Docker, allowing live runtime lookups in Azure.
 */
function readEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
}

export function getQlikApiBaseUrl(): string {
  const url =
    readEnv("NEXT_PUBLIC_QLIK_API_BASE_URL") ||
    readEnv("QLIK_API_BASE_URL") ||
    readEnv("NEXT_PUBLIC_QLIK_API_URL") ||
    readEnv("QLIK_API_URL") ||
    readEnv("VL_Q2F_NEXT_PUBLIC_QLIK_API_BASE_URL_SV") ||
    readEnv("vl-q2f-next-public-qlik-api-base-url-sv") ||
    "https://vl-q2f-qlik-base-api-ca-dev.yellowsea-4a43ecd7.australiaeast.azurecontainerapps.io";

  return url.trim().replace(/\/+$/, "");
}

