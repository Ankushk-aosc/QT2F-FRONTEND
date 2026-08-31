/**
 * The connector catalogue — the single source of truth for every external
 * platform the Administration Center can configure.
 *
 * This file is deliberately data and nothing else. A connector's card, its
 * configuration form, its validation rules and its metadata viewer are all
 * generated from the definition below, which is what makes the framework
 * reusable: adding Snowflake means adding a `ConnectorDefinition`, not writing
 * a Snowflake form component.
 *
 * Two rules keep it that way:
 *
 *  1. No connector-specific branching outside this file and the discovery
 *     adapters in `./discovery`. If a component needs to ask "is this Qlik?",
 *     the answer belongs in a field on the definition instead.
 *  2. Every field an administrator can type into is declared here, including
 *     which ones are secret. `lib/connectors/validation.ts` derives its rules
 *     from these declarations, so a field cannot be rendered without also being
 *     validated.
 */

import type {
  AuthMethod,
  ConnectorAvailability,
  ConnectorField,
  ConnectorFieldGroup,
  ConnectorFieldOption,
  ConnectorId,
  ConnectorRole,
  MetadataKind,
} from "@/types/connectors";
import { DEFAULT_TABLEAU_TOKEN_NAME } from "@/lib/constants";

export interface ConnectorDefinition {
  id: ConnectorId;
  /** Display name, e.g. "Microsoft Fabric". */
  name: string;
  vendor: string;
  /** One line shown on the connector card. */
  description: string;
  availability: ConnectorAvailability;
  roles: readonly ConnectorRole[];
  /**
   * Two-letter monogram rendered in the card's logo tile.
   *
   * Deliberately not an image: bundling vendor logos raises trademark
   * questions, and a missing remote image is a worse card than a clean
   * monogram. Swap `ConnectorLogo` for real marks when the assets are cleared.
   */
  monogram: string;
  /** Brand-ish accent for the logo tile. Cosmetic only. */
  accent: string;
  /** Authentication methods offered, in preference order. Empty when planned. */
  authMethods: readonly AuthMethod[];
  fieldGroups: readonly ConnectorFieldGroup[];
  /** Categories this connector discovers, in the order the viewer shows them. */
  metadataKinds: readonly MetadataKind[];
  /**
   * Value keys written by the server rather than typed by an administrator.
   *
   * They are not form fields — nobody should see or edit them — but they must
   * survive a save, so `sanitiseValues` carries them across instead of dropping
   * them as undeclared input. Tableau's Key Vault `connectionId` is the case
   * this exists for: it is resolved during a connection test, and losing it on
   * the next save would silently unlink the connector from its credential.
   */
  serverManagedValues?: readonly string[];
  /** Shown on the "coming soon" card to set expectations honestly. */
  plannedNote?: string;
}

// ---------------------------------------------------------------------------
// Shared field fragments
// ---------------------------------------------------------------------------

/**
 * Transport options every connector shares. Declared once so timeout, SSL and
 * proxy behave identically everywhere rather than drifting per connector.
 */
function advancedGroup(defaultTimeout = 60): ConnectorFieldGroup {
  return {
    title: "Advanced",
    description: "Transport settings. The defaults suit most deployments.",
    fields: [
      {
        key: "timeoutSeconds",
        label: "Timeout",
        type: "number",
        min: 5,
        max: 600,
        defaultValue: defaultTimeout,
        hint: "Seconds to wait for the platform before giving up.",
      },
      {
        key: "verifySsl",
        label: "Verify SSL certificate",
        type: "boolean",
        defaultValue: true,
        hint: "Disable only for a server using a self-signed certificate on a trusted network.",
      },
      {
        key: "proxyUrl",
        label: "Proxy URL",
        type: "url",
        placeholder: "http://proxy.internal:8080",
        hint: "Leave empty to connect directly.",
      },
    ],
  };
}

const QLIK_AUTH_OPTIONS: readonly ConnectorFieldOption[] = [
  { value: "api-key", label: "API key" },
  { value: "basic", label: "Username and password" },
  { value: "certificate", label: "Certificate" },
] as const;

/**
 * Mirrors the `x-tableau-environment` values the migration backend switches on.
 * These strings are part of that contract, not display labels.
 */
const TABLEAU_ENV_OPTIONS: readonly ConnectorFieldOption[] = [
  { value: "cloud", label: "Tableau Cloud" },
  { value: "cloud_trial", label: "Tableau Cloud Trial" },
  { value: "server", label: "Tableau Server" },
] as const;

// ---------------------------------------------------------------------------
// Qlik Sense
// ---------------------------------------------------------------------------

const QLIK: ConnectorDefinition = {
  id: "qlik",
  name: "Qlik Sense",
  vendor: "Qlik",
  description: "Qlik Cloud tenant, spaces, applications and reload tasks.",
  availability: "available",
  roles: ["source"],
  monogram: "QS",
  accent: "#009845",
  authMethods: ["api-key", "basic", "certificate"],
  fieldGroups: [
    {
      title: "Connection",
      fields: [
        {
          key: "cloudUrl",
          label: "Cloud URL",
          type: "url",
          required: true,
          placeholder: "https://your-tenant.ap.qlikcloud.com",
          hint: "The base URL of your Qlik Cloud tenant.",
        },
        {
          key: "tenant",
          label: "Tenant",
          type: "text",
          placeholder: "your-tenant",
          hint: "Detected automatically on connect when left empty.",
        },
      ],
    },
    {
      title: "Authentication",
      fields: [
        {
          key: "authMethod",
          label: "Authentication",
          type: "select",
          required: true,
          options: QLIK_AUTH_OPTIONS,
          defaultValue: "api-key",
        },
        {
          key: "apiKey",
          label: "API key",
          type: "password",
          secret: true,
          required: true,
          visibleWhen: { field: "authMethod", equals: ["api-key"] },
          hint: "Generated in the Qlik Cloud management console.",
        },
        {
          key: "username",
          label: "Username",
          type: "text",
          required: true,
          visibleWhen: { field: "authMethod", equals: ["basic"] },
        },
        {
          key: "password",
          label: "Password",
          type: "password",
          secret: true,
          required: true,
          visibleWhen: { field: "authMethod", equals: ["basic"] },
        },
        {
          key: "certificate",
          label: "Certificate",
          type: "password",
          secret: true,
          required: true,
          visibleWhen: { field: "authMethod", equals: ["certificate"] },
          hint: "PEM-encoded client certificate.",
        },
        {
          key: "privateKey",
          label: "Private key",
          type: "password",
          secret: true,
          required: true,
          visibleWhen: { field: "authMethod", equals: ["certificate"] },
          hint: "PEM-encoded private key for the certificate above.",
        },
      ],
    },
    {
      title: "Defaults",
      description: "Pre-selected in the migration wizard. Both can be changed per migration.",
      fields: [
        {
          key: "defaultSpace",
          label: "Default space",
          type: "text",
          hint: "Populated from discovered spaces after the first sync.",
        },
        {
          key: "defaultApp",
          label: "Default application",
          type: "text",
          hint: "Populated from discovered applications after the first sync.",
        },
      ],
    },
    advancedGroup(60),
  ],
  metadataKinds: [
    { key: "spaces", label: "Spaces", selectable: true },
    { key: "apps", label: "Applications", selectable: true },
    { key: "sheets", label: "Sheets" },
    { key: "variables", label: "Variables" },
    { key: "measures", label: "Measures" },
    { key: "dataConnections", label: "Data connections" },
    { key: "reloadTasks", label: "Reload tasks" },
    { key: "owners", label: "Owners" },
    { key: "reloadHistory", label: "Reload history" },
    { key: "scripts", label: "Scripts" },
    { key: "objects", label: "Objects" },
  ],
};

// ---------------------------------------------------------------------------
// Tableau
// ---------------------------------------------------------------------------

const TABLEAU: ConnectorDefinition = {
  id: "tableau",
  name: "Tableau",
  vendor: "Salesforce",
  description: "Tableau Server or Cloud site, projects, workbooks and data sources.",
  availability: "available",
  roles: ["source"],
  monogram: "TB",
  accent: "#e8762d",
  authMethods: ["pat"],
  fieldGroups: [
    {
      title: "Connection",
      fields: [
        {
          key: "envType",
          label: "Environment",
          type: "select",
          required: true,
          options: TABLEAU_ENV_OPTIONS,
          defaultValue: "cloud",
          hint: "Cloud Trial has no Tableau Cloud Manager; Server hosts a single site.",
        },
        {
          key: "serverUrl",
          label: "Server URL",
          type: "url",
          required: true,
          placeholder: "https://10ay.online.tableau.com",
          hint: "Tableau Cloud pod URL, or your Tableau Server hostname.",
        },
        {
          key: "site",
          label: "Site",
          type: "text",
          required: true,
          placeholder: "your-site",
          hint: "The site content URL. Use the default site name for Tableau Server.",
        },
      ],
    },
    {
      title: "Authentication",
      description: "Tableau authenticates with a personal access token.",
      fields: [
        {
          key: "patName",
          label: "Token name",
          type: "text",
          required: true,
          defaultValue: DEFAULT_TABLEAU_TOKEN_NAME,
          hint: "The name given to the personal access token in Tableau.",
        },
        {
          key: "patSecret",
          label: "Token secret",
          type: "password",
          secret: true,
          required: true,
          hint: "Shown once by Tableau when the token is created.",
        },
      ],
    },
    {
      title: "Tableau Cloud Manager",
      description:
        "Only for Tableau Cloud. Required to list the sites in a tenant; leave empty for Cloud Trial and Server.",
      fields: [
        {
          key: "tcmBaseUrl",
          label: "TCM base URL",
          type: "url",
          placeholder: "https://cloudmanager.tableau.com",
          visibleWhen: { field: "envType", equals: ["cloud"] },
        },
        {
          key: "tcmTokenSecret",
          label: "TCM token secret",
          type: "password",
          secret: true,
          visibleWhen: { field: "envType", equals: ["cloud"] },
          hint: "Stored in the migration backend's Key Vault, never returned to this app.",
        },
      ],
    },
    {
      title: "Defaults",
      description: "Pre-selected in the migration wizard. Both can be changed per migration.",
      fields: [
        {
          key: "defaultProject",
          label: "Default project",
          type: "text",
          hint: "Populated from discovered projects after the first sync.",
        },
        {
          key: "defaultWorkbook",
          label: "Default workbook",
          type: "text",
          hint: "Populated from discovered workbooks after the first sync.",
        },
      ],
    },
    advancedGroup(90),
  ],
  // Resolved by the discovery adapter when it registers the credential with the
  // migration backend's Key Vault. The migration screen reads it to reuse this
  // connection without asking for the token again.
  serverManagedValues: ["connectionId"],
  metadataKinds: [
    { key: "sites", label: "Sites", selectable: true },
    { key: "projects", label: "Projects", selectable: true },
    { key: "workbooks", label: "Workbooks", selectable: true },
    { key: "datasources", label: "Data sources" },
    { key: "flows", label: "Flows" },
    { key: "schedules", label: "Schedules" },
    { key: "permissions", label: "Permissions" },
    { key: "users", label: "Users" },
    { key: "owners", label: "Owners" },
  ],
};

// ---------------------------------------------------------------------------
// Microsoft Fabric
// ---------------------------------------------------------------------------

const FABRIC: ConnectorDefinition = {
  id: "fabric",
  name: "Microsoft Fabric",
  vendor: "Microsoft",
  description: "Fabric workspace, capacity, lakehouse, warehouse and OneLake.",
  availability: "available",
  roles: ["target"],
  monogram: "MF",
  accent: "#0f6cbd",
  authMethods: ["entra-id"],
  fieldGroups: [
    {
      title: "Connection",
      description:
        "Fabric authenticates with your Microsoft Entra ID sign-in — there is no separate credential to enter.",
      fields: [
        {
          key: "tenant",
          label: "Tenant",
          type: "text",
          hint: "Detected from your Entra ID sign-in when left empty.",
        },
        {
          key: "workspace",
          label: "Workspace",
          type: "text",
          required: true,
          hint: "Display name of the target Fabric workspace.",
        },
        {
          key: "workspaceId",
          label: "Workspace ID",
          type: "text",
          placeholder: "00000000-0000-0000-0000-000000000000",
          hint: "Resolved automatically from the workspace name on connect.",
        },
        {
          key: "capacity",
          label: "Capacity",
          type: "text",
          hint: "The Fabric capacity backing the workspace.",
        },
      ],
    },
    {
      title: "Storage targets",
      description: "Where generated assets are written.",
      fields: [
        {
          key: "lakehouse",
          label: "Lakehouse",
          type: "text",
          hint: "Populated from discovered lakehouses after the first sync.",
        },
        {
          key: "warehouse",
          label: "Warehouse",
          type: "text",
        },
        {
          key: "oneLakePath",
          label: "OneLake path",
          type: "text",
          placeholder: "abfss://workspace@onelake.dfs.fabric.microsoft.com/",
        },
      ],
    },
    advancedGroup(120),
  ],
  metadataKinds: [
    { key: "workspaces", label: "Workspaces", selectable: true },
    { key: "lakehouses", label: "Lakehouses", selectable: true },
    { key: "warehouses", label: "Warehouses" },
    { key: "capacities", label: "Capacities" },
  ],
};

// ---------------------------------------------------------------------------
// Planned connectors
// ---------------------------------------------------------------------------

/**
 * Planned connectors carry no field schema on purpose.
 *
 * Publishing a form for a connector with no discovery adapter behind it would
 * let an administrator "configure" something that can never connect. The card
 * shows what it will be and says plainly that it is not available yet.
 */
function planned(
  id: ConnectorId,
  name: string,
  vendor: string,
  description: string,
  monogram: string,
  accent: string,
  roles: readonly ConnectorRole[],
): ConnectorDefinition {
  return {
    id,
    name,
    vendor,
    description,
    availability: "coming-soon",
    roles,
    monogram,
    accent,
    authMethods: [],
    fieldGroups: [],
    metadataKinds: [],
    plannedNote: "Configuration opens once the discovery adapter for this platform ships.",
  };
}

const PLANNED_CONNECTORS: readonly ConnectorDefinition[] = [
  planned("power-bi", "Power BI", "Microsoft", "Power BI workspaces, reports and datasets.", "PB", "#f2c811", ["source", "target"]),
  planned("snowflake", "Snowflake", "Snowflake", "Snowflake databases, schemas and warehouses.", "SF", "#29b5e8", ["source", "target"]),
  planned("databricks", "Databricks", "Databricks", "Databricks workspaces, catalogs and notebooks.", "DB", "#ff3621", ["source", "target"]),
  planned("oracle", "Oracle", "Oracle", "Oracle Database schemas and analytics content.", "OR", "#c74634", ["source"]),
  planned("sql-server", "SQL Server", "Microsoft", "SQL Server databases and Reporting Services content.", "MS", "#a4373a", ["source", "target"]),
  planned("sap", "SAP", "SAP", "SAP BusinessObjects universes and reports.", "SP", "#0faaff", ["source"]),
  planned("looker", "Looker", "Google", "Looker models, explores and dashboards.", "LK", "#4285f4", ["source"]),
  planned("postgresql", "PostgreSQL", "PostgreSQL", "PostgreSQL databases and schemas.", "PG", "#336791", ["source", "target"]),
  planned("mysql", "MySQL", "Oracle", "MySQL databases and schemas.", "MY", "#00758f", ["source", "target"]),
  planned("bigquery", "BigQuery", "Google", "BigQuery projects, datasets and tables.", "BQ", "#669df6", ["source", "target"]),
] as const;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CONNECTORS: readonly ConnectorDefinition[] = [
  QLIK,
  TABLEAU,
  FABRIC,
  ...PLANNED_CONNECTORS,
] as const;

const CONNECTORS_BY_ID = new Map<string, ConnectorDefinition>(
  CONNECTORS.map((connector) => [connector.id, connector]),
);

export function getConnector(id: string): ConnectorDefinition | undefined {
  return CONNECTORS_BY_ID.get(id);
}

/** Narrowing guard for untrusted route parameters. */
export function isConnectorId(value: unknown): value is ConnectorId {
  return typeof value === "string" && CONNECTORS_BY_ID.has(value);
}

/** Connectors an administrator can configure today. */
export function getAvailableConnectors(): ConnectorDefinition[] {
  return CONNECTORS.filter((connector) => connector.availability === "available");
}

export function getPlannedConnectors(): ConnectorDefinition[] {
  return CONNECTORS.filter((connector) => connector.availability === "coming-soon");
}

/** Configurable connectors that can act in the given role. */
export function getConnectorsForRole(role: ConnectorRole): ConnectorDefinition[] {
  return getAvailableConnectors().filter((connector) => connector.roles.includes(role));
}

/** Flattens a definition's groups into a single ordered field list. */
export function getConnectorFields(definition: ConnectorDefinition): ConnectorField[] {
  return definition.fieldGroups.flatMap((group) => [...group.fields]);
}

export function getSecretFields(definition: ConnectorDefinition): ConnectorField[] {
  return getConnectorFields(definition).filter((field) => field.secret === true);
}

/**
 * Whether a field applies given the current form values.
 *
 * Used by the form to decide what to render and by validation to decide what to
 * require — sharing one implementation is what stops the UI hiding a field that
 * the server then rejects as missing.
 */
export function isFieldApplicable(
  field: ConnectorField,
  values: Record<string, unknown>,
): boolean {
  if (!field.visibleWhen) return true;
  const actual = values[field.visibleWhen.field];
  return typeof actual === "string" && field.visibleWhen.equals.includes(actual);
}

/** Default values for every non-secret field, used to seed a new connection. */
export function getDefaultValues(
  definition: ConnectorDefinition,
): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const field of getConnectorFields(definition)) {
    if (field.secret) continue;
    if (field.defaultValue !== undefined) {
      values[field.key] = field.defaultValue;
    } else if (field.type === "boolean") {
      values[field.key] = false;
    } else if (field.type === "number") {
      values[field.key] = field.min ?? 0;
    } else {
      values[field.key] = "";
    }
  }
  return values;
}
