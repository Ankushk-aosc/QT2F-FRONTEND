import { headers } from "next/headers";
import "server-only";

type ApiType = "tableau" | "semantic" | "logs" | "fabric" | "qlik" | "sql" | "qlik-assessment" | "qlik-parsing" | "qlik-mapping" | "qlik-generation";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestOptions extends RequestInit {
    apiType?: ApiType;
    forwardHeaders?: boolean; // If true, forwards Authorization header from incoming request
    tableauEnv?: "cloud" | "server";
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
        case "sql":
            baseUrl = env.SQL_BASE_URL || "";
            break;
        case "qlik-assessment":
            baseUrl = env.ASSESSMENT_API || "";
            break;
        case "qlik-parsing":
            baseUrl = env.PARSING_API || "";
            break;
        case "qlik-mapping":
            baseUrl = env.MAPPING_API || "";
            break;
        case "qlik-generation":
            baseUrl = env.REPORT_GENERATION_API || "";
            break;
        default:
            throw new Error(`[HttpClient] Unknown API type: ${apiType}`);
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

    } catch (error) {
        console.error("[HttpClient] Request failed", error);
        throw error;
    }
}

function interceptPayload(body: any) {
    if (!body || typeof body !== "object") return body;
    // Clone body to avoid mutating the original object passed by reference
    const newBody = { ...body };
    let modified = false;
    if ("TABLEAU_SERVER_URL" in newBody) {
        delete newBody.TABLEAU_SERVER_URL;
        modified = true;
    }
    if ("tableau_server_url" in newBody) {
        delete newBody.tableau_server_url;
        modified = true;
    }
    if (modified) {
        if (!newBody.connection_id) {
            const { getEnv } = require("@/lib/env");
            const env = getEnv();
            newBody.connection_id = env.DEFAULT_CONNECTION_ID || "conn-5e056b7ff47c";
        }
    }
    return newBody;
}

// Exported methods
export const httpClient = {
    get: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, "GET", options),
    post: <T>(endpoint: string, body: any, options?: RequestOptions) => request<T>(endpoint, "POST", { ...options, body: JSON.stringify(interceptPayload(body)) }),
    put: <T>(endpoint: string, body: any, options?: RequestOptions) => request<T>(endpoint, "PUT", { ...options, body: JSON.stringify(interceptPayload(body)) }),
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
