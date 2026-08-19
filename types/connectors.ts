/**
 * Domain model for platform connectors.
 *
 * A "connector" is an external platform the migration pipeline reads from or
 * writes to — Qlik, Tableau, Microsoft Fabric today, and a long tail of data
 * platforms after that.
 *
 * The design goal is that adding the fourteenth connector is a *data* change,
 * not a UI change. Everything the Administration Center renders for a connector
 * — the card, the configuration form, the metadata viewer — is driven by the
 * declarative `ConnectorDefinition` in `lib/connectors/registry.ts`. No section
 * component knows that Qlik has a tenant and Tableau has a site.
 *
 * Secrets are the one thing that never lives in this model's persisted half.
 * `ConnectorConnection.values` holds non-secret configuration only; a field
 * marked `secret` is write-only from the client and is recorded here as nothing
 * more than its presence in `secretsPresent`.
 */

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * Stable identifier for a connector. Persisted in the settings document and
 * used in API route paths, so these strings are part of the contract.
 */
export type ConnectorId =
  // Supported today
  | "qlik"
  | "tableau"
  | "fabric"
  // Planned
  | "power-bi"
  | "snowflake"
  | "databricks"
  | "oracle"
  | "sql-server"
  | "sap"
  | "looker"
  | "postgresql"
  | "mysql"
  | "bigquery";

/** Whether the connector can be configured yet. */
export type ConnectorAvailability = "available" | "coming-soon";

/**
 * What role a connector plays in a migration. Drives which connectors the
 * migration wizard offers as a source versus a target.
 */
export type ConnectorRole = "source" | "target";

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

/**
 * Lifecycle of a single connector's configuration.
 *
 * `error` is distinct from `disconnected`: disconnected is a deliberate
 * administrator action, error means the last verification failed. Conflating
 * them would hide a broken credential behind what looks like a choice.
 */
export type ConnectionStatus = "not-configured" | "connected" | "disconnected" | "error";

/**
 * Result of the most recent health probe. `unknown` is the honest state before
 * a connector has ever been tested — it is not the same as healthy.
 */
export type HealthState = "healthy" | "degraded" | "unhealthy" | "unknown";

/** How the platform proves its identity to the connector. */
export type AuthMethod =
  | "api-key"
  | "basic"
  | "certificate"
  | "pat"
  | "oauth"
  | "entra-id"
  | "service-principal";

// ---------------------------------------------------------------------------
// Field schema — drives the generic connection form
// ---------------------------------------------------------------------------

export type ConnectorFieldType =
  | "text"
  | "password"
  | "url"
  | "number"
  | "boolean"
  | "select";

export interface ConnectorFieldOption {
  value: string;
  label: string;
}

/**
 * One input in a connector's configuration form.
 *
 * `ConnectorForm` renders this generically, which is why a new connector needs
 * no new form component.
 */
export interface ConnectorField {
  key: string;
  label: string;
  type: ConnectorFieldType;
  /** Blocks Save while empty, and marks the field in the UI. */
  required?: boolean;
  /**
   * Write-only. Never persisted to the settings document, never returned by the
   * API, never populated into the input on load.
   */
  secret?: boolean;
  placeholder?: string;
  hint?: string;
  /** Required when `type` is "select". */
  options?: readonly ConnectorFieldOption[];
  min?: number;
  max?: number;
  maxLength?: number;
  defaultValue?: string | number | boolean;
  /**
   * Show this field only when another field holds one of the listed values.
   * Keeps authentication forms honest: a certificate path is meaningless when
   * the administrator picked API key authentication.
   */
  visibleWhen?: {
    field: string;
    equals: readonly string[];
  };
}

/** A titled set of related fields, rendered as one card in the form. */
export interface ConnectorFieldGroup {
  title: string;
  description?: string;
  fields: readonly ConnectorField[];
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * A category of object discovered from a connector — Qlik spaces, Tableau
 * projects, and so on. Declared per connector so the metadata viewer can render
 * a heading and an empty state without knowing the platform.
 */
export interface MetadataKind {
  /** Stable key, e.g. "spaces". Matches `MetadataCollection.kind`. */
  key: string;
  /** Plural label shown in the metadata viewer, e.g. "Spaces". */
  label: string;
  /**
   * Whether the migration wizard offers this collection as a selectable scope.
   * Qlik apps and Tableau workbooks are selectable; reload history is not.
   */
  selectable?: boolean;
}

/** A single discovered object. Deliberately shallow — the cache is not a mirror. */
export interface MetadataItem {
  id: string;
  name: string;
  /** Links a child to its parent, e.g. a workbook to its project. */
  parentId?: string;
  /** Secondary line in the viewer — owner, type, modified date. */
  detail?: string;
}

/**
 * One discovered category.
 *
 * `supported: false` is the honest representation of a category the wired
 * discovery adapter cannot supply. The viewer shows it as unavailable with the
 * reason, rather than as an empty result — an empty list and "this endpoint
 * does not expose it" mean very different things to an administrator.
 */
export interface MetadataCollection {
  kind: string;
  label: string;
  items: MetadataItem[];
  supported: boolean;
  /** Why the collection is unsupported, or a note about partial results. */
  note?: string;
}

/** Everything discovered from one connector at one point in time. */
export interface ConnectorMetadata {
  connectorId: ConnectorId;
  /** ISO timestamp of the sync that produced this snapshot. */
  syncedAt: string;
  collections: MetadataCollection[];
}

// ---------------------------------------------------------------------------
// Persisted connection
// ---------------------------------------------------------------------------

/**
 * An administrator's saved configuration for one connector.
 *
 * This is what lands in the settings document, so it holds no secret. The
 * discovered facts (`connectedUser`, `version`, `health`) are recorded by the
 * server after a successful test or sync rather than typed by the user.
 */
export interface ConnectorConnection {
  connectorId: ConnectorId;
  connectionName: string;
  /** Non-secret field values, keyed by `ConnectorField.key`. */
  values: Record<string, string | number | boolean>;
  /**
   * Keys of secret fields that have a stored value. Lets the UI render
   * "configured — enter a new value only when rotating" without ever handling
   * the secret itself.
   */
  secretsPresent: string[];
  status: ConnectionStatus;
  health: HealthState;
  /** Human-readable explanation of the current health, or "". */
  healthMessage: string;
  /** Reported by the platform on connect, e.g. a Tableau REST API version. */
  version: string;
  /** Identity the platform authenticated as, e.g. a Qlik tenant user. */
  connectedUser: string;
  /** Default space / site / workspace resolved at connect time. */
  connectedWorkspace: string;
  /** ISO timestamps, or null when the action has never run. */
  lastSyncAt: string | null;
  lastTestAt: string | null;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export type ConnectorLogLevel = "info" | "warn" | "error";

/**
 * One entry in a connector's activity log. Written by the server on every
 * save, test, sync and disconnect, so an administrator can see why a connector
 * is unhealthy without reading application logs.
 */
export interface ConnectorLogEntry {
  id: string;
  at: string;
  level: ConnectorLogLevel;
  /** Short machine-ish label: "test", "sync", "save", "disconnect". */
  event: string;
  message: string;
}

// ---------------------------------------------------------------------------
// API payloads
// ---------------------------------------------------------------------------

/** Everything the Integrations page needs for one connector, in one object. */
export interface ConnectorState {
  connectorId: ConnectorId;
  connection: ConnectorConnection | null;
  metadata: ConnectorMetadata | null;
  logs: ConnectorLogEntry[];
}

export interface ConnectorListResponse {
  connectors: ConnectorState[];
}

/** Result of a save, test or sync. */
export interface ConnectorActionResponse {
  connectorId: ConnectorId;
  ok: boolean;
  /** Message suitable for a success or error banner. */
  message: string;
  connection: ConnectorConnection | null;
  metadata: ConnectorMetadata | null;
  logs: ConnectorLogEntry[];
}

/**
 * What the client sends when saving a connector.
 *
 * Secrets travel in `secrets` and are separated from `values` by the server
 * before anything is written to the settings document. An omitted secret means
 * "leave the stored one alone"; an empty string means "clear it".
 */
export interface ConnectorSavePayload {
  connectionName: string;
  values: Record<string, string | number | boolean>;
  secrets?: Record<string, string>;
}
