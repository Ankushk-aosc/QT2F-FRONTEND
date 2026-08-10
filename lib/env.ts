import "server-only";
import { MIGRATION_MODE } from "./constants";

export type Env = {
    // Node Environment
    NODE_ENV: "development" | "production" | "test";

    // Authentication (MSAL) - Server Side Only
    MSAL_CLIENT_ID: string;
    MSAL_TENANT_ID: string;
    MSAL_AUTHORITY: string;
    API_SCOPE: string;
    // Confidential-client secret for the server-side auth-code flow (refresh_token seeding).
    // Optional so existing deploys still boot; required only for /api/auth/seed-rt.
    MSAL_CLIENT_SECRET?: string;

    // App Base URL
    APP_URL: string;

    // Backend Services
    TABLEAU_API_URL: string;
    SEMANTIC_KERNEL_URL: string;
    LOGS_API_BASE: string;
    FABRIC_API_BASE_URL: string;
    API_BASE_URL?: string;
    QLIK_URL?: string;
    SQL_BASE_URL?: string;
    ASSESSMENT_API?: string;
    PARSING_API?: string;
    MAPPING_API?: string;
    REPORT_GENERATION_API?: string;
    AGENTVARIABLE?: string;
    DEFAULT_CONNECTION_ID?: string;
};

// Cache the environment parsing result
let envCache: Env | undefined;

export function getEnv(): Env {
    // Return cached value if available
    if (envCache) {
        return envCache;
    }

    // Helper to safely access process.env at runtime
    // This prevents build-time replacement and ensures Docker compatibility
    const get = (key: string): string | undefined => process.env[key];

    // Helper to validate required variables
    const requireEnv = (key: string): string => {
        const value = get(key);
        if (!value) {
            throw new Error(`[Env] Missing required environment variable: ${key}`);
        }
        return value;
    };

    // Construct the environment object
    const env: Env = {
        NODE_ENV: (get("NODE_ENV") as Env["NODE_ENV"]) || "development",

        // Authentication
        MSAL_CLIENT_ID: requireEnv("MSAL_CLIENT_ID"),
        MSAL_TENANT_ID: requireEnv("MSAL_TENANT_ID"),
        MSAL_AUTHORITY: requireEnv("MSAL_AUTHORITY"),
        API_SCOPE: requireEnv("API_SCOPE"),
        MSAL_CLIENT_SECRET: get("MSAL_CLIENT_SECRET"),

        // App Base URL - Default to localhost if not set (for local dev)
        APP_URL: get("APP_URL") || "http://localhost:3000",

        // Backend Services
        TABLEAU_API_URL: requireEnv("TABLEAU_API_URL"),
        SEMANTIC_KERNEL_URL: requireEnv("SEMANTIC_KERNEL_URL"),
        LOGS_API_BASE: requireEnv("LOGS_API_BASE"),
        FABRIC_API_BASE_URL: requireEnv("FABRIC_API_BASE_URL"),
        API_BASE_URL: get("API_BASE_URL"),
        QLIK_URL: get("QLIK_URL"),
        SQL_BASE_URL: get("SQL_BASE_URL") || get("NEXT_PUBLIC_SQL_BASE_URL"),
        ASSESSMENT_API: get("ASSESSMENT_API") || get("NEXT_PUBLIC_ASSESSMENT_API"),
        PARSING_API: get("PARSING_API") || get("NEXT_PUBLIC_PARSING_API"),
        MAPPING_API: get("MAPPING_API") || get("NEXT_PUBLIC_MAPPING_API"),
        REPORT_GENERATION_API: get("REPORT_GENERATION_API") || get("NEXT_PUBLIC_REPORT_GENERATION_API"),
        AGENTVARIABLE: get("AGENTVARIABLE") || MIGRATION_MODE.STANDARD,
        DEFAULT_CONNECTION_ID: get("DEFAULT_CONNECTION_ID"),
    };

    // Cache and return
    envCache = env;
    return env;
}
