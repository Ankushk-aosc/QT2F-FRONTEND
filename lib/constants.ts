/**
 * Default Tableau personal-access-token name used across the app (service
 * fallbacks, UI form defaults, connector registry, migration payloads).
 *
 * Kept separate from DISCOVERY_TABLEAU_TOKEN_NAME below: the discovery
 * adapter (lib/connectors/discovery/tableau.backend.ts) intentionally
 * defaults to a different value as of a deliberate, recent fix. Previously
 * both defaults were scattered as duplicate string literals across 15+
 * call sites with no indication the difference was intentional -- these two
 * named constants are the single source of truth for each, so a future
 * change to either only has to happen in one place.
 */
export const DEFAULT_TABLEAU_TOKEN_NAME = "TableauToken";

/** See DEFAULT_TABLEAU_TOKEN_NAME above -- used only by the discovery adapter. */
export const DISCOVERY_TABLEAU_TOKEN_NAME = "token";

/**
 * Default bound for outbound requests to our own API routes and their
 * upstream backends. 60s accommodates Render's ~50s free tier cold starts --
 * see lib/fetchWithAuth.ts and lib/api/httpClient.ts, which both used to
 * define this same value independently.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 60000;

/**
 * Baseline interval for polling a run/agent's status while it's active.
 * Reimplemented as the same literal independently in stores/runHistory.store.ts,
 * stores/agent.store.ts, components/tabs/ParsingTab.tsx and
 * components/qlik/QlikMigrationTab.tsx -- this is the one shared source.
 * Backoff tiers beyond this baseline (e.g. runHistory.store.ts's adaptive
 * 10s/20s/60s steps for long-running or backgrounded polls) are specific to
 * that call site and stay local.
 */
export const RUN_STATUS_POLL_INTERVAL_MS = 5000;

/**
 * Default page size for the "historical runs" list, shared by
 * stores/runHistory.store.ts, stores/monitoring.store.ts,
 * services/monitoring.service.ts and stores/dashboard.store.ts -- these
 * previously each declared their own "10" independently. Other page sizes in
 * the monitoring subsystem (e.g. the active-runs list, or a single run's
 * full log fetch) serve different endpoints with deliberately different
 * sizes and are commented locally rather than unified here.
 */
export const DEFAULT_PAGE_SIZE = 10;

export const MIGRATION_MODE = {
  LITE: "0",
  STANDARD: "1",
} as const;

export type MigrationMode = typeof MIGRATION_MODE[keyof typeof MIGRATION_MODE];

/**
 * Canonical deployment-target keys. These are the values written back by
 * PATCH /api/records/deployment_type and the `value` of each dropdown Option,
 * so they are the only forms the Settings drawer can match against.
 */
export const DEPLOYMENT_TYPES = ["GIT", "DIRECT_FABRIC", "AZURE_DEVOPS"] as const;

export type DeploymentType = typeof DEPLOYMENT_TYPES[number];

/**
 * Coerce a stored deployment type into one of DEPLOYMENT_TYPES.
 *
 * The records API does not persist a canonical form. When no settings row
 * exists it synthesises the *display* string -- GET /api/records/deployment_type
 * returns `{"deployment_type":"Azure DevOps"}` -- while every write from this
 * app sends the underscore key (e.g. DIRECT_FABRIC). A plain `.toUpperCase()`
 * therefore yields "AZURE DEVOPS", which matches no Option value: the dropdown
 * renders that raw string and every `deploymentType === "AZURE_DEVOPS"` branch
 * stays false. The OpenAPI examples also list "GitHub", which must map to GIT.
 *
 * Normalising on read collapses display strings, underscore keys, and
 * hyphenated/lowercase variants onto the same Option value. Anything still
 * unrecognised is passed through untouched rather than guessed at.
 */
export function normalizeDeploymentType(value: string | null | undefined): string {
  if (!value) return "";

  const canonical = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (canonical === "GITHUB") return "GIT";
  return (DEPLOYMENT_TYPES as readonly string[]).includes(canonical) ? canonical : value.trim();
}

export const SUPPORTED_TIMEZONES = [
  "UTC",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];
