import { headers } from "next/headers";
import "server-only";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/lib/constants";

export type ApiType =
    | "QLIK"
    | "qlik"
    | "TABLEAU"
    | "tableau"
    | "semantic"
    | "logs"
    | "records"
    | "qlik-mongo"
    | "fabric";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface RequestOptions extends RequestInit {
    apiType?: ApiType;
    forwardHeaders?: boolean; // If true, forwards Authorization header from incoming request
    QLIKEnv?: "cloud" | "server";
    skipPayloadIntercept?: boolean;
    /** Milliseconds before the request is aborted. Default 15000. */
    timeoutMs?: number;
}

// Every call through this client used to be a bare fetch() with no signal --
// a backend that's down in a way that hangs instead of refusing (agent
// process alive but stuck, a black-holed port, cold start) blocked the
// Next.js route handler indefinitely, which is what made components stall
// on screen with no error and no way to recover short of a page reload.
// Set to 60s to accommodate Render's ~50s free tier cold starts.
const DEFAULT_TIMEOUT_MS = DEFAULT_REQUEST_TIMEOUT_MS;

// Internal helper to perform the request
async function request<T>(endpoint: string, method: HttpMethod, options: RequestOptions = {}): Promise<T> {
    // Lazy load env inside function as per rules
    // eslint-disable-next-line
    const { getEnv } = require("@/lib/env");
    const env = getEnv();

    const { apiType = "QLIK", forwardHeaders = true, headers: customHeaders, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = options;
    let QLIKEnv = options.QLIKEnv;

    // Try to get environment from headers if not provided
    if (!QLIKEnv) {
        try {
            const headerStore = await headers();
            const envHeader = headerStore.get("x-QLIK-environment");
            if (envHeader === "server" || envHeader === "cloud") {
                QLIKEnv = envHeader as "cloud" | "server";
            }
        } catch (e) {
            // Not in request context
        }
    }

    // Determine Base URL. Every branch below reads a real, typed field off
    // Env (lib/env.ts) -- each of those fields is resolved through its own
    // dedicated helper (getQlikApiBaseUrl/getTableauApiBaseUrl/
    // getRecordsApiBaseUrl) that checks every known spelling of that
    // service's env var before falling back to a hardcoded default. This
    // used to read several fields (QLIK_BASE_API_URL, TABLEAU_BASE_API_URL,
    // MONGO_API_URL, ASSESSMENT_API_URL, etc.) that were never declared on
    // Env -- since getEnv() is reached through an untyped require() a few
    // lines up, TypeScript never caught it, and those branches always fell
    // straight to their literal fallback regardless of any env var actually
    // set. The "assessment"/"parsing"/"mapping"/"report-generation"/
    // "validation" branches that existed here are gone entirely: they were
    // never reachable (not part of the ApiType union, zero real callers --
    // confirmed via search) and duplicated URLs that now live in one place,
    // vl-q2f-semantic-kernel's routers, which is what the frontend calls
    // for those stages today.
    let baseUrl = "";
    const normalizedType = String(apiType || "records").toLowerCase();
    switch (normalizedType) {
        case "qlik":
            baseUrl = env.QLIK_API_URL;
            break;
        case "tableau":
            baseUrl = env.TABLEAU_API_URL;
            break;
        case "semantic":
            baseUrl = env.SEMANTIC_KERNEL_URL;
            break;
        case "logs":
        case "records":
        case "qlik-mongo":
            baseUrl = env.API_BASE_URL;
            break;
        case "fabric":
            baseUrl = env.FABRIC_API_BASE_URL;
            break;
        default:
            baseUrl = env.API_BASE_URL;
            break;
    }


    // Construct URL
    const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

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

    // Execute Fetch, bounded so a hung upstream fails fast instead of
    // blocking this route handler (and therefore the UI) indefinitely.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            signal: controller.signal,
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
        if (error?.name === "AbortError") {
            console.error(`[HttpClient] Request timed out after ${timeoutMs}ms: ${url}`);
            const timeoutError = new Error(`Request to ${apiType} timed out after ${timeoutMs}ms`);
            (timeoutError as any).status = 504;
            throw timeoutError;
        }
        console.error("[HttpClient] Request failed", error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function interceptPayload(body: any) {
    if (!body || typeof body !== "object") return body;
    // Clone body to avoid mutating the original object passed by reference.
    // These legacy raw-URL fields are stripped because the backend now
    // resolves the Qlik server URL itself from connection_id (see
    // vl-q2f-semantic-kernel/plugins/queue_handler.py) -- a raw URL sent
    // here would be stale/unverified. We do NOT substitute a fake
    // connection_id when one is missing: a request with no real connection
    // selected should fail loudly (the caller is expected to supply
    // connection_id explicitly), not get silently mislabeled with someone
    // else's connection.
    const newBody = { ...body };
    delete newBody.QLIK_SERVER_URL;
    delete newBody.QLIK_server_url;
    return newBody;
}

// Exported methods
export const httpClient = {
    get: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, "GET", options),
    post: <T>(endpoint: string, body: any, options?: RequestOptions) =>
        request<T>(endpoint, "POST", { ...options, body: JSON.stringify(options?.skipPayloadIntercept ? body : interceptPayload(body)) }),
    put: <T>(endpoint: string, body: any, options?: RequestOptions) =>
        request<T>(endpoint, "PUT", { ...options, body: JSON.stringify(options?.skipPayloadIntercept ? body : interceptPayload(body)) }),
    patch: <T>(endpoint: string, body: any, options?: RequestOptions) =>
        request<T>(endpoint, "PATCH", { ...options, body: JSON.stringify(options?.skipPayloadIntercept ? body : interceptPayload(body)) }),
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
    const data = await httpClient.post<T>(endpoint, body, {
        apiType: apiType as ApiType,
        ...options
    });
    return { data, status: 200 };
}

export function errorResponse(error: any, defaultMessage: string) {
    const message = error?.message || defaultMessage;
    const status = error?.status || 500;
    return { body: { error: message }, status };
}

