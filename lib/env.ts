import "server-only";
import { MIGRATION_MODE } from "./constants";
import { getQlikApiBaseUrl } from "./qlikApiBaseUrl";
import { getRecordsApiBaseUrl } from "./recordsApiBaseUrl";
import { getTableauApiBaseUrl } from "./tableauApiBaseUrl";

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

    // App Base URL. Optional on purpose: when unset, resolveBaseUrl() derives it
    // from the request's forwarded/Host headers, so no environment-specific URL
    // is baked into the source.
    APP_URL?: string;

    // Backend Services.
    // QLIK_API_URL is sourced from NEXT_PUBLIC_QLIK_API_BASE_URL, the single
    // place the Qlik base API host is configured (the API routes under
    // app/api/get-spaces, get-apps and qlik-unbuild read that same variable).
    QLIK_API_URL: string;
    // Same pattern as QLIK_API_URL: sourced through getTableauApiBaseUrl()
    // so httpClient.ts's "tableau" apiType actually honours
    // TABLEAU_API_URL/TABLEAU_BASE_API_URL instead of always falling back
    // to a hardcoded default (see lib/tableauApiBaseUrl.ts for why).
    TABLEAU_API_URL: string;
    SEMANTIC_KERNEL_URL: string;
    FABRIC_API_BASE_URL: string;
    // The Cosmos-backed records host: /api/records/* routes, the run-log reads
    // behind httpClient's "logs" apiType, and (client-side) run history, agent
    // actions and per-run results. Sourced from NEXT_PUBLIC_RECORDS_API_BASE_URL
    // -- the single name for that host -- because the browser needs it too and
    // can only read NEXT_PUBLIC_* vars.
    API_BASE_URL: string;
    QLIK_URL?: string;
    AGENTVARIABLE?: string;
    // Interim, opt-in switch for stages beyond Assessment/Parsing (Mapping and
    // onward) while they are still being built out. Unset/anything other than
    // "1" must resolve to "off" -- see the safety note on isPartialProcessing
    // in lib/config.ts for why this cannot default the other way. Once every
    // deployment (client included) is ready for the full pipeline, this
    // variable and isPartialProcessing() itself go away in favour of
    // isLiteMode() alone, matching T2F. See PROCESSING_MODE.md.
    ENABLE_FULL_PROCESSING?: string;

    // Azure OpenAI (AI-generated portfolio insights) - optional, feature is
    // disabled at the route level until all four are configured.
    AZURE_OPENAI_API_KEY?: string;
    AZURE_OPENAI_ENDPOINT?: string;
    AZURE_OPENAI_DEPLOYMENT_NAME?: string;
    AZURE_OPENAI_API_VERSION?: string;
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

    // Required variables have no fallback: a missing one throws immediately,
    // so a misconfigured deployment fails loudly at request time instead of
    // silently running against a baked-in value meant for another environment.
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

        // App Base URL - no default: see resolveBaseUrl() in lib/auth/serverAuth.ts
        APP_URL: get("APP_URL"),

        // Backend Services
        QLIK_API_URL: getQlikApiBaseUrl(),
        TABLEAU_API_URL: getTableauApiBaseUrl(),
        SEMANTIC_KERNEL_URL: requireEnv("SEMANTIC_KERNEL_URL"),
        FABRIC_API_BASE_URL: requireEnv("FABRIC_API_BASE_URL"),
        // Through the helper, like QLIK_API_URL above: it accepts the same
        // variable plus its aliases and falls back to the deployed records host,
        // so a container missing the name serves requests instead of throwing
        // out of getEnv() and taking down every route that shares it.
        API_BASE_URL: getRecordsApiBaseUrl(),
        QLIK_URL: get("QLIK_URL"),
        AGENTVARIABLE: get("AGENTVARIABLE") || MIGRATION_MODE.STANDARD,
        ENABLE_FULL_PROCESSING: get("ENABLE_FULL_PROCESSING"),

        AZURE_OPENAI_API_KEY: get("AZURE_OPENAI_API_KEY"),
        // AZURE_OPENAI_API_BASE is the older Azure OpenAI spelling and is what
        // the current .env.local uses; AZURE_OPENAI_ENDPOINT is the name the
        // current SDK documents. Accepting both means an environment set up
        // with either one works, instead of /api/generate-insights reporting
        // "not configured" while three of the four values are present.
        AZURE_OPENAI_ENDPOINT:
            get("AZURE_OPENAI_ENDPOINT") || get("AZURE_OPENAI_API_BASE"),
        AZURE_OPENAI_DEPLOYMENT_NAME: get("AZURE_OPENAI_DEPLOYMENT_NAME"),
        AZURE_OPENAI_API_VERSION: get("AZURE_OPENAI_API_VERSION"),
    };

    // Cache and return
    envCache = env;
    return env;
}

