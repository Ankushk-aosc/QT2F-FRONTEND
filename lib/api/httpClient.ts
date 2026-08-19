import { headers } from "next/headers";
import "server-only";

import { interceptTableauPayload } from "./tableauPayload";

/**
 * `qlik-mongo` is the Qlik migration store (QLIK_MONGO_DB_URL) holding mapping,
 * parsing, assessment, report-generation and agent-action records. It is a
 * different service from `logs`/`sql` (the async records API) — the two were
 * previously conflated, which sent every mapping lookup to a host that has no
 * such route.
 */
type ApiType = "tableau" | "semantic" | "logs" | "fabric" | "qlik" | "qlik-mongo" | "sql" | "qlik-assessment" | "qlik-parsing";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions extends RequestInit {
    apiType?: ApiType;
    forwardHeaders?: boolean; // If true, forwards Authorization header from incoming request
    tableauEnv?: "cloud" | "server";
    /**
     * Sends the body exactly as given, skipping `interceptPayload`.
     *
     * Required by connection-management calls. `interceptPayload` rewrites any
     * body carrying a Tableau server URL into "use the default connection
     * instead" — correct for discovery calls that must run against a stored
     * connection, catastrophic for `/connections` itself, where the server URL
     * *is* the payload and injecting a `connection_id` turns a create into an
     * update of somebody else's connection.
     */
    skipPayloadIntercept?: boolean;
}

// Internal helper to perform the request
async function request<T>(endpoint: string, method: HttpMethod, options: RequestOptions = {}): Promise<T> {
    // Lazy load env inside function as per rules
    // eslint-disable-next-line
    const { getEnv } = require("@/lib/env");
    const env = getEnv();

    const { apiType = "tableau", forwardHeaders = true, headers: customHeaders, ...rest } = options;
    let tableauEnv = options.tableauEnv;

    // Try to get environment from headers if not provided
    if (!tableauEnv) {
        try {
            const headerStore = await headers();
            const envHeader = headerStore.get("x-tableau-environment");
            if (envHeader === "server" || envHeader === "cloud") {
                tableauEnv = envHeader as "cloud" | "server";
            }
        } catch (e) {
            // Not in request context
        }
    }

    // Determine Base URL
    let baseUrl = "";
    switch (apiType) {
        case "tableau":
            baseUrl = env.TABLEAU_API_URL;
            break;
        case "semantic":
            baseUrl = env.SEMANTIC_KERNEL_URL;
            break;
        case "logs":
            baseUrl = env.LOGS_API_BASE;
            break;
        case "fabric":
            baseUrl = env.FABRIC_API_BASE_URL;
            break;
        case "qlik":
            baseUrl = env.QLIK_URL || "";
            break;
        case "qlik-mongo":
            baseUrl = env.QLIK_MONGO_DB_URL || "";
            break;
        case "sql":
            baseUrl = env.SQL_BASE_URL || "";
            break;
        case "qlik-assessment":
            baseUrl = env.ASSESSMENT_API || "";
            break;
        case "qlik-parsing":
            baseUrl = env.PARSING_API || "";
            break;
        default:
            throw new Error(`[HttpClient] Unknown API type: ${apiType}`);
    }

    // A missing base URL used to produce a relative fetch that failed with an
    // opaque parse error. Name the misconfigured variable instead.
    if (!baseUrl) {
        const error = new Error(
            `[HttpClient] No base URL configured for apiType "${apiType}". Check the corresponding environment variable.`
        );
        (error as any).status = 500;
        throw error;
    }

    // Construct URL
    const url = `${baseUrl.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    // Handle Headers & Authorization
    const requestHeaders: HeadersInit = {
        "Content-Type": "application/json",
        ...customHeaders,
    };

    let authHeaderFound = false;

    // Forward Authorization header if requested
    if (forwardHeaders) {
        try {
            const headerStore = await headers();
            const authHeader = headerStore.get("authorization");
            if (authHeader) {
                (requestHeaders as any)["Authorization"] = authHeader;
                authHeaderFound = true;
            }
        } catch (error) {
            console.warn("[HttpClient] Failed to retrieve headers (likely not in a request context)", error);
        }
    }

    // Explicit override if passed in options (e.g. from httpGet wrapper)
    // This fixes the issue where manually passed headers in httpGet were not taking precedence or being merged correctly if forwardHeaders logic failed or differed.
    if (customHeaders && (customHeaders as any)["Authorization"]) {
        (requestHeaders as any)["Authorization"] = (customHeaders as any)["Authorization"];
        authHeaderFound = true;
    }

    // The Qlik engine authenticates against Qlik Cloud, not Entra — forwarding the
    // caller's Entra token is meaningless to it. When a Qlik key is configured,
    // swap it in. It is read server-side only and never reaches the browser.
    if (apiType === "qlik" && env.QLIK_API_KEY) {
        (requestHeaders as any)["Authorization"] = `Bearer ${env.QLIK_API_KEY}`;
        authHeaderFound = true;
    }

    // Start Logging
    console.log(`[HttpClient] ${method} ${url}`);
    console.log(`[HttpClient] Auth Header Present: ${authHeaderFound}`);

    // Execute Fetch
    try {
        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            ...rest,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[HttpClient] Error ${response.status}: ${errorText}`);
            // Throw an error object that preserves status for downstream handling
            const error = new Error(`API Error ${response.status}: ${response.statusText} - ${errorText}`);
            (error as any).status = response.status;
            throw error;
        }

        // Return JSON
        return await response.json() as T;

    } catch (error: any) {
        // Distinguish network failures from HTTP errors for meaningful diagnostics
        if (error?.message?.startsWith("API Error")) {
            // Already formatted by the !response.ok block above — rethrow as-is
            throw error;
        }

        // Network-level failure: ECONNREFUSED, ENOTFOUND, ETIMEDOUT, etc.
        const cause = error?.cause;
        const causeCode = cause?.code ?? (cause?.errors?.[0]?.code) ?? "";
        let diagnostic = `[HttpClient] Network error on ${method} ${url}`;

        if (causeCode === "ECONNREFUSED") {
            diagnostic += ` — Connection refused. The backend at ${url} is not reachable.`;
        } else if (causeCode === "ENOTFOUND") {
            diagnostic += ` — DNS lookup failed. The hostname could not be resolved.`;
        } else if (causeCode === "ETIMEDOUT") {
            diagnostic += ` — Connection timed out.`;
        } else if (causeCode === "ECONNRESET") {
            diagnostic += ` — Connection was reset by the remote server.`;
        } else {
            diagnostic += ` — ${error.message || "Unknown network error"}`;
        }

        console.error(diagnostic);

        const enriched = new Error(diagnostic);
        (enriched as any).status = error.status || 503;
        (enriched as any).cause = cause;
        throw enriched;
    }
}

/** Applies the Tableau payload rewrite unless the caller opted out. */
function maybeIntercept(body: any, options?: RequestOptions) {
    if (options?.skipPayloadIntercept) return body;

    // eslint-disable-next-line
    const { getEnv } = require("@/lib/env");
    return interceptTableauPayload(body, {
        defaultConnectionId: getEnv().DEFAULT_CONNECTION_ID,
    });
}

// Exported methods
export const httpClient = {
    get: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, "GET", options),
    post: <T>(endpoint: string, body: any, options?: RequestOptions) => request<T>(endpoint, "POST", { ...options, body: JSON.stringify(maybeIntercept(body, options)) }),
    put: <T>(endpoint: string, body: any, options?: RequestOptions) => request<T>(endpoint, "PUT", { ...options, body: JSON.stringify(maybeIntercept(body, options)) }),
    // PATCH is what the backend's /connections endpoint expects for an update;
    // POST there creates a second connection instead of amending the first.
    patch: <T>(endpoint: string, body: any, options?: RequestOptions) => request<T>(endpoint, "PATCH", { ...options, body: JSON.stringify(maybeIntercept(body, options)) }),
    delete: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, "DELETE", options),
};

// ============================================================================
// COMPATIBILITY LAYER (To support existing codebase without massive refactor)
// ============================================================================

export async function httpGet<T>(apiType: string, endpoint: string, options: RequestOptions = {}): Promise<{ data: T; status: number }> {
    try {
        const data = await httpClient.get<T>(endpoint, {
            apiType: apiType as ApiType,
            ...options
        });
        return { data, status: 200 };
    } catch (e: any) {
        // If the error has a status attached (from request function), use it
        if (e.status) {
            throw e; // Rethrow to be caught by route handler
        }
        throw e;
    }
}

export async function httpPost<T>(apiType: string, endpoint: string, body: any, options: RequestOptions = {}): Promise<{ data: T; status: number }> {
    try {
        const data = await httpClient.post<T>(endpoint, body, {
            apiType: apiType as ApiType,
            ...options
        });
        return { data, status: 200 };
    } catch (e: any) {
        throw e;
    }
}

export function errorResponse(error: any, defaultMessage: string) {
    const message = error?.message || defaultMessage;
    const status = error?.status || 500;
    return { body: { error: message }, status };
}
