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
