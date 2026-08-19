/**
 * Pure validation for connector configuration.
 *
 * Free of I/O and of `server-only`, so the rules governing untrusted connector
 * input are directly unit testable — the same choice made for
 * `lib/settings/validation.ts`, and for the same reason.
 *
 * Everything here is derived from the `ConnectorDefinition` rather than
 * hardcoded per connector. A field cannot be added to the registry without
 * automatically gaining coercion and a required-field check, which is what
 * stops the form and the server disagreeing about what a valid payload is.
 */

import {
  getConnectorFields,
  isFieldApplicable,
  type ConnectorDefinition,
} from "./registry";
import { pickBoolean, pickString } from "@/lib/settings/validation";
import type {
  ConnectionStatus,
  ConnectorConnection,
  ConnectorField,
  ConnectorId,
  ConnectorLogEntry,
  ConnectorLogLevel,
  ConnectorSavePayload,
  HealthState,
} from "@/types/connectors";

export const CONNECTION_STATUSES = [
  "not-configured",
  "connected",
  "disconnected",
  "error",
] as const;

export const HEALTH_STATES = ["healthy", "degraded", "unhealthy", "unknown"] as const;

export const LOG_LEVELS = ["info", "warn", "error"] as const;

/** Longest value accepted for any single text field. */
export const MAX_FIELD_LENGTH = 2048;

/** How many log entries are retained per connector. */
export const MAX_LOG_ENTRIES = 50;

// ---------------------------------------------------------------------------
// Field coercion
// ---------------------------------------------------------------------------

/**
 * Coerces one submitted value to the type its field declares.
 *
 * Returns `undefined` when the value cannot be represented at all, so the
 * caller can fall back to the stored value rather than writing a nonsense one.
 */
export function coerceFieldValue(
  field: ConnectorField,
  value: unknown,
): string | number | boolean | undefined {
  switch (field.type) {
    case "boolean":
      return typeof value === "boolean" ? value : undefined;

    case "number": {
      const numeric =
        typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
      if (!Number.isFinite(numeric)) return undefined;
      // Clamp rather than reject: an out-of-range timeout is a slider dragged
      // too far, not an attack, and clamping keeps the connector usable.
      const lower = field.min ?? Number.NEGATIVE_INFINITY;
      const upper = field.max ?? Number.POSITIVE_INFINITY;
      return Math.min(Math.max(Math.trunc(numeric), lower), upper);
    }

    case "select": {
      if (typeof value !== "string") return undefined;
      const allowed = field.options?.some((option) => option.value === value);
      return allowed ? value : undefined;
    }

    case "url": {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      if (trimmed === "") return "";
      // Only http(s). A connector URL is fetched server-side, so permitting
      // file: or a custom scheme would turn a config field into an SSRF vector
      // against schemes the fetch layer was never meant to reach.
      return /^https?:\/\/\S+$/i.test(trimmed) && trimmed.length <= MAX_FIELD_LENGTH
        ? trimmed
        : undefined;
    }

    case "text":
    case "password":
    default: {
      if (typeof value !== "string") return undefined;
      return pickString(value, "", field.maxLength ?? MAX_FIELD_LENGTH);
    }
  }
}

/**
 * Validates and normalises the non-secret half of a save payload.
 *
 * Fields that do not apply under the current values (an API key when
 * certificate auth is selected) are dropped rather than stored, so switching
 * authentication method cannot leave stale configuration behind.
 */
export function sanitiseValues(
  definition: ConnectorDefinition,
  submitted: Record<string, unknown>,
  current: Record<string, string | number | boolean> = {},
): Record<string, string | number | boolean> {
  const fields = getConnectorFields(definition);

  // Resolve the values that gate `visibleWhen` first, using the submitted value
  // where present, so applicability is judged against what is being saved.
  const resolved: Record<string, unknown> = { ...current, ...submitted };

  const result: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    if (field.secret) continue;
    if (!isFieldApplicable(field, resolved)) continue;

    const coerced = coerceFieldValue(field, submitted[field.key]);
    if (coerced !== undefined) {
      result[field.key] = coerced;
    } else if (current[field.key] !== undefined) {
      result[field.key] = current[field.key];
    } else if (field.defaultValue !== undefined) {
      result[field.key] = field.defaultValue;
    }
  }

  // Server-managed values are not fields, so the loop above never sees them.
  // They are carried across from the stored connection and are deliberately not
  // read from `submitted` — a client must not be able to set them.
  for (const key of definition.serverManagedValues ?? []) {
    if (current[key] !== undefined) {
      result[key] = current[key];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Required-field checking
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  /** Field key to human-readable problem. Empty when `ok`. */
  errors: Record<string, string>;
}

/**
 * Checks that every applicable required field has a value.
 *
 * `secretsAlreadyStored` lets a required secret pass when it was saved
 * previously and the administrator is editing something else — the form leaves
 * secret inputs blank by design, so treating blank as missing would make every
 * connector impossible to edit after the first save.
 */
export function validateSave(
  definition: ConnectorDefinition,
  payload: ConnectorSavePayload,
  secretsAlreadyStored: readonly string[] = [],
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!payload.connectionName || !payload.connectionName.trim()) {
    errors.connectionName = "Give this connection a name.";
  }

  const values = payload.values ?? {};
  const secrets = payload.secrets ?? {};
  const stored = new Set(secretsAlreadyStored);

  for (const field of getConnectorFields(definition)) {
    if (!isFieldApplicable(field, values)) continue;
    if (!field.required) continue;

    if (field.secret) {
      const submitted = secrets[field.key];
      const hasSubmitted = typeof submitted === "string" && submitted.length > 0;
      if (!hasSubmitted && !stored.has(field.key)) {
        errors[field.key] = `${field.label} is required.`;
      }
      continue;
    }

    const raw = values[field.key];
    const coerced = coerceFieldValue(field, raw);

    if (coerced === undefined) {
      errors[field.key] = `${field.label} is not valid.`;
    } else if (typeof coerced === "string" && coerced.trim() === "") {
      errors[field.key] = `${field.label} is required.`;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Splits a raw request body into non-secret values and secrets.
 *
 * The server calls this before anything is written, which is the single point
 * where a secret is prevented from reaching the settings document. Secrets with
 * an empty string are preserved: an empty value means "clear this credential"
 * and must be distinguishable from an omitted key meaning "leave it alone".
 */
export function splitSecrets(
  definition: ConnectorDefinition,
  body: unknown,
): ConnectorSavePayload {
  const source = (body ?? {}) as Partial<ConnectorSavePayload>;
  const submittedValues = (source.values ?? {}) as Record<string, unknown>;
  const submittedSecrets = (source.secrets ?? {}) as Record<string, unknown>;

  const secrets: Record<string, string> = {};
  for (const field of getConnectorFields(definition)) {
    if (!field.secret) continue;

    // A secret may arrive in either bag; accept both, so a client that puts a
    // password in `values` still cannot get it persisted as a value.
    const candidate = submittedSecrets[field.key] ?? submittedValues[field.key];
    if (typeof candidate === "string") {
      secrets[field.key] = candidate.slice(0, MAX_FIELD_LENGTH);
    }
  }

  const values: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(submittedValues)) {
    if (secrets[key] !== undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values[key] = value;
    }
  }

  return {
    connectionName: pickString(source.connectionName, "", 120),
    values,
    secrets,
  };
}

// ---------------------------------------------------------------------------
// Stored connection
// ---------------------------------------------------------------------------

function pickEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function pickIsoTimestamp(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

export function createEmptyConnection(
  connectorId: ConnectorId,
  connectionName = "",
): ConnectorConnection {
  return {
    connectorId,
    connectionName,
    values: {},
    secretsPresent: [],
    status: "not-configured",
    health: "unknown",
    healthMessage: "",
    version: "",
    connectedUser: "",
    connectedWorkspace: "",
    lastSyncAt: null,
    lastTestAt: null,
    updatedAt: null,
  };
}

/**
 * Normalises a connection read back from storage.
 *
 * A document written by an older build, or hand-edited, must not be able to put
 * the admin centre into an impossible state — so every field is re-checked on
 * the way in, not only on the way out.
 */
export function sanitiseConnection(
  definition: ConnectorDefinition,
  raw: unknown,
): ConnectorConnection {
  const candidate = (raw ?? {}) as Partial<ConnectorConnection>;
  const empty = createEmptyConnection(definition.id);

  const secretFieldKeys = new Set(
    getConnectorFields(definition)
      .filter((field) => field.secret)
      .map((field) => field.key),
  );

  const secretsPresent = Array.isArray(candidate.secretsPresent)
    ? candidate.secretsPresent.filter(
        (key): key is string => typeof key === "string" && secretFieldKeys.has(key),
      )
    : [];

  return {
    connectorId: definition.id,
    connectionName: pickString(candidate.connectionName, empty.connectionName, 120),
    // Re-run field coercion so a value that is no longer valid for its field —
    // because the registry changed — is dropped rather than trusted.
    values: sanitiseValues(definition, (candidate.values ?? {}) as Record<string, unknown>),
    secretsPresent,
    status: pickEnumValue<ConnectionStatus>(candidate.status, CONNECTION_STATUSES, empty.status),
    health: pickEnumValue<HealthState>(candidate.health, HEALTH_STATES, empty.health),
    healthMessage: pickString(candidate.healthMessage, "", 500),
    version: pickString(candidate.version, "", 60),
    connectedUser: pickString(candidate.connectedUser, "", 200),
    connectedWorkspace: pickString(candidate.connectedWorkspace, "", 200),
    lastSyncAt: pickIsoTimestamp(candidate.lastSyncAt, null),
    lastTestAt: pickIsoTimestamp(candidate.lastTestAt, null),
    updatedAt: pickIsoTimestamp(candidate.updatedAt, null),
  };
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export function createLogEntry(
  level: ConnectorLogLevel,
  event: string,
  message: string,
): ConnectorLogEntry {
  return {
    // Timestamp plus randomness: two entries written in the same millisecond
    // still need distinct React keys.
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    level,
    event: pickString(event, "event", 40),
    message: pickString(message, "", 500),
  };
}

/** Newest first, capped, so the log cannot grow without bound in storage. */
export function appendLog(
  existing: readonly ConnectorLogEntry[],
  entry: ConnectorLogEntry,
): ConnectorLogEntry[] {
  return [entry, ...existing].slice(0, MAX_LOG_ENTRIES);
}

export function sanitiseLogs(raw: unknown): ConnectorLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .slice(0, MAX_LOG_ENTRIES)
    .map((entry) => ({
      id: pickString(entry.id, "", 60) || createLogEntry("info", "event", "").id,
      at: pickIsoTimestamp(entry.at, null) ?? new Date(0).toISOString(),
      level: pickEnumValue<ConnectorLogLevel>(entry.level, LOG_LEVELS, "info"),
      event: pickString(entry.event, "event", 40),
      message: pickString(entry.message, "", 500),
    }));
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

/**
 * Whether a connector is usable by the migration wizard without sending the
 * administrator back to Settings.
 *
 * Requires a successful connection *and* a metadata sync: a connector that
 * authenticates but has never been discovered has nothing for the wizard to
 * offer, and dropping the user into an empty picker is worse than redirecting.
 */
export function isConnectorReady(connection: ConnectorConnection | null): boolean {
  if (!connection) return false;
  return connection.status === "connected" && connection.lastSyncAt !== null;
}

/** Reduces a connection to the single word shown on its card. */
export function describeStatus(connection: ConnectorConnection | null): string {
  if (!connection || connection.status === "not-configured") return "Not configured";
  switch (connection.status) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

export function pickBooleanValue(value: unknown, fallback: boolean): boolean {
  return pickBoolean(value, fallback);
}
