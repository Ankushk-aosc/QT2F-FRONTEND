/**
 * Base URL of the Cosmos-backed records API: the tenant's Qlik Cloud URL record
 * (`GET /qlik`), run history, settings, agent actions and per-run results.
 *
 * Resolution order, first non-empty wins:
 *   1. process.env["NEXT_PUBLIC_RECORDS_API_BASE_URL"]
 *   2. process.env["RECORDS_API_BASE_URL"]
 *   3. process.env["NEXT_PUBLIC_COSMOS_API_BASE_URL"]
 *   4. process.env["COSMOS_API_BASE_URL"]
 *   5. process.env["VL_Q2F_NEXT_PUBLIC_RECORDS_API_BASE_URL_SV"]
 *   6. RECORDS_API_FALLBACK_BASE_URL below.
 *
 * Two separate reasons this cannot be a plain `process.env.X` read, both of
 * which were live defects:
 *
 * Server side, Next's SWC substitutes `process.env.NEXT_PUBLIC_*` with its
 * BUILD-time value even inside route handlers. .dockerignore keeps .env* out of
 * the build context and the Dockerfile declares these as build args defaulting
 * to "", so an image built without the matching --build-arg compiles the read
 * away to "". app/api/qlik-url then answered every request with its "not set"
 * 500 no matter how the container was configured -- and `next dev`, which reads
 * .env.local in-process, could never reproduce it. Bracket notation is opaque
 * to that substitution, so the lookup happens at REQUEST time against the real
 * process.env and a container setting is honoured without a rebuild.
 *
 * Browser side there is no run-time process.env at all, so an image built
 * without the build arg leaves client components with nothing to read. The
 * fallback is what keeps them working: a known-good default beats fetching
 * "undefined/qlik" and rendering an empty dropdown with no explanation.
 *
 * @see getQlikApiBaseUrl in lib/qlikApiBaseUrl.ts -- same pattern, Qlik base API.
 */

/**
 * Dev Container App for the records API. Verified against the deployed service:
 * `GET {this}/qlik` -> `[{ "id": "1", "server_url": "https://vectorlab.in.qlikcloud.com" }]`.
 *
 * Any other environment overrides it by setting one of the variables above --
 * this constant is only the last resort, never a preference.
 */
function readEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
}

export function getRecordsApiBaseUrl(): string {
  const url =
    // Preferred name, matching the Cosmos->Mongo standardization on the
    // backend side (each vl-q2f-* service now checks MONGO_API_URL first
    // too) -- kept as the top priority here so both sides converge on one
    // name without requiring every deployment's env vars to be renamed at
    // once.
    readEnv("MONGO_API_URL") ||
    readEnv("NEXT_PUBLIC_RECORDS_API_BASE_URL") ||
    readEnv("RECORDS_API_BASE_URL") ||
    readEnv("NEXT_PUBLIC_COSMOS_API_BASE_URL") ||
    readEnv("COSMOS_API_BASE_URL") ||
    readEnv("COSMOSDB_API_URL") ||
    readEnv("VL_Q2F_NEXT_PUBLIC_RECORDS_API_BASE_URL_SV") ||
    readEnv("vl-q2f-next-public-records-api-base-url-sv") ||
    "https://vl-q2f-cosmos-db-api-ca-dev.yellowsea-4a43ecd7.australiaeast.azurecontainerapps.io";

  return url.trim().replace(/\/+$/, "");
}

