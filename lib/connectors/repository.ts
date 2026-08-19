import "server-only";

/**
 * Server-side persistence for connector configuration, discovered metadata and
 * activity logs.
 *
 * Deliberately a separate document from `.data/settings.json`. Connector state
 * is written by the *server* — health, version, connected identity and the
 * metadata cache are all results of a test or a sync, not values an
 * administrator typed — whereas the settings document is a client patch target.
 * Mixing them would mean a settings PUT could clobber a sync result, and would
 * grow the settings document by the size of a tenant's metadata.
 *
 * Follows the same durability rules as `lib/settings/repository.ts`: atomic
 * writes via temp-file-and-rename, serialised in-process so concurrent requests
 * cannot read-modify-write over each other, and a corrupt document degrades to
 * empty rather than taking the Administration Center down.
 *
 * Secrets are absent by construction — they live in `./secrets.ts`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { getConnector, getSecretFields, isConnectorId } from "./registry";
import { appendLog, sanitiseConnection, sanitiseLogs } from "./validation";
import type {
  ConnectorConnection,
  ConnectorId,
  ConnectorLogEntry,
  ConnectorMetadata,
  ConnectorState,
  MetadataCollection,
} from "@/types/connectors";

const STORE_PATH =
  process.env.CONNECTOR_STORE_PATH || path.join(process.cwd(), ".data", "connectors.json");

/**
 * How long a metadata snapshot is considered fresh.
 *
 * Past this the Integrations page shows the cache as stale and the background
 * refresh will re-sync it. It is not an expiry: stale cached metadata is still
 * served, because a migration should not be blocked by a connector that happens
 * to be briefly unreachable.
 */
export const METADATA_TTL_MS = 60 * 60 * 1000;

interface ConnectorRecord {
  connection: ConnectorConnection;
  metadata: ConnectorMetadata | null;
  logs: ConnectorLogEntry[];
}

interface StoreDocument {
  connectors: Partial<Record<ConnectorId, ConnectorRecord>>;
}

const EMPTY_DOCUMENT: StoreDocument = { connectors: {} };

let writeQueue: Promise<unknown> = Promise.resolve();

// ---------------------------------------------------------------------------
// Storage primitives — the only two functions that touch the filesystem
// ---------------------------------------------------------------------------

function sanitiseMetadata(raw: unknown, connectorId: ConnectorId): ConnectorMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<ConnectorMetadata>;
  if (!Array.isArray(candidate.collections)) return null;

  const syncedAt =
    typeof candidate.syncedAt === "string" && !Number.isNaN(Date.parse(candidate.syncedAt))
      ? candidate.syncedAt
      : null;
  if (!syncedAt) return null;

  const collections: MetadataCollection[] = candidate.collections
    .filter((entry): entry is MetadataCollection => !!entry && typeof entry === "object")
    .map((entry) => ({
      kind: String(entry.kind ?? ""),
      label: String(entry.label ?? entry.kind ?? ""),
      supported: entry.supported !== false,
      note: typeof entry.note === "string" ? entry.note : undefined,
      items: Array.isArray(entry.items)
        ? entry.items
            .filter((item): item is NonNullable<typeof item> => !!item && typeof item === "object")
            .map((item) => ({
              id: String(item.id ?? ""),
              name: String(item.name ?? item.id ?? ""),
              parentId: item.parentId ? String(item.parentId) : undefined,
              detail: item.detail ? String(item.detail) : undefined,
            }))
        : [],
    }))
    .filter((collection) => collection.kind !== "");

  return { connectorId, syncedAt, collections };
}

async function loadDocument(): Promise<StoreDocument> {
  try {
    const contents = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(contents) as Partial<StoreDocument>;

    const connectors: StoreDocument["connectors"] = {};
    for (const [key, value] of Object.entries(parsed.connectors ?? {})) {
      if (!isConnectorId(key)) continue;
      const definition = getConnector(key);
      if (!definition) continue;

      const record = (value ?? {}) as Partial<ConnectorRecord>;
      connectors[key] = {
        connection: sanitiseConnection(definition, record.connection),
        metadata: sanitiseMetadata(record.metadata, key),
        logs: sanitiseLogs(record.logs),
      };
    }

    return { connectors };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      console.error("[ConnectorRepository] Failed to read the connector document:", error);
    }
    return EMPTY_DOCUMENT;
  }
}

async function persistDocument(document: StoreDocument): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  const tempPath = `${STORE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(document, null, 2), "utf8");
  await fs.rename(tempPath, STORE_PATH);
}

/** Serialises read-modify-write cycles across concurrent requests. */
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(operation);
  writeQueue = run.catch(() => undefined);
  return run;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getConnectorState(connectorId: ConnectorId): Promise<ConnectorState> {
  const document = await loadDocument();
  const record = document.connectors[connectorId];
  return {
    connectorId,
    connection: record?.connection ?? null,
    metadata: record?.metadata ?? null,
    logs: record?.logs ?? [],
  };
}

/** Every connector's state, including those never configured. */
export async function getAllConnectorStates(): Promise<ConnectorState[]> {
  const document = await loadDocument();
  return Object.entries(document.connectors)
    .filter((entry): entry is [ConnectorId, ConnectorRecord] => isConnectorId(entry[0]) && !!entry[1])
    .map(([connectorId, record]) => ({
      connectorId,
      connection: record.connection,
      metadata: record.metadata,
      logs: record.logs,
    }));
}

/** Whether a snapshot is older than the freshness window. */
export function isMetadataStale(metadata: ConnectorMetadata | null): boolean {
  if (!metadata) return true;
  const age = Date.now() - Date.parse(metadata.syncedAt);
  return !Number.isFinite(age) || age > METADATA_TTL_MS;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function emptyRecord(connectorId: ConnectorId): ConnectorRecord {
  const definition = getConnector(connectorId);
  return {
    connection: sanitiseConnection(definition!, { connectorId }),
    metadata: null,
    logs: [],
  };
}

/**
 * Applies `mutate` to a connector's record and persists the result.
 *
 * Every write goes through here so that no caller can accidentally skip the
 * serialisation queue or forget to persist.
 */
async function mutateRecord(
  connectorId: ConnectorId,
  mutate: (record: ConnectorRecord) => ConnectorRecord,
): Promise<ConnectorState> {
  return enqueue(async () => {
    const document = await loadDocument();
    const existing = document.connectors[connectorId] ?? emptyRecord(connectorId);
    const next = mutate(existing);

    const updated: StoreDocument = {
      connectors: { ...document.connectors, [connectorId]: next },
    };
    await persistDocument(updated);

    return {
      connectorId,
      connection: next.connection,
      metadata: next.metadata,
      logs: next.logs,
    };
  });
}

/** Persists an administrator's saved configuration. Secrets are handled separately. */
export async function saveConnection(
  connectorId: ConnectorId,
  connection: Omit<ConnectorConnection, "updatedAt">,
  log: ConnectorLogEntry,
): Promise<ConnectorState> {
  return mutateRecord(connectorId, (record) => ({
    ...record,
    connection: { ...connection, updatedAt: new Date().toISOString() },
    logs: appendLog(record.logs, log),
  }));
}

/** Records the outcome of a connection test against the stored connection. */
export async function recordTestResult(
  connectorId: ConnectorId,
  result: {
    ok: boolean;
    message: string;
    version?: string;
    connectedUser?: string;
    connectedWorkspace?: string;
    /** Non-secret values the adapter resolved, merged over the stored ones. */
    values?: Record<string, string>;
  },
  log: ConnectorLogEntry,
): Promise<ConnectorState> {
  return mutateRecord(connectorId, (record) => ({
    ...record,
    connection: {
      ...record.connection,
      // Adapter-resolved values win over what was typed, because they are what
      // the platform actually confirmed (a Key Vault connection id, say).
      values: result.values
        ? { ...record.connection.values, ...result.values }
        : record.connection.values,
      status: result.ok ? "connected" : "error",
      health: result.ok ? "healthy" : "unhealthy",
      healthMessage: result.message,
      // Keep the previously discovered identity when a test fails: it is still
      // the last thing known to be true, and blanking it loses information.
      version: result.version ?? record.connection.version,
      connectedUser: result.connectedUser ?? record.connection.connectedUser,
      connectedWorkspace: result.connectedWorkspace ?? record.connection.connectedWorkspace,
      lastTestAt: new Date().toISOString(),
    },
    logs: appendLog(record.logs, log),
  }));
}

/** Stores a metadata snapshot and marks the connector synced. */
export async function saveMetadata(
  connectorId: ConnectorId,
  collections: MetadataCollection[],
  log: ConnectorLogEntry,
): Promise<ConnectorState> {
  const syncedAt = new Date().toISOString();
  return mutateRecord(connectorId, (record) => ({
    ...record,
    connection: {
      ...record.connection,
      status: "connected",
      health: "healthy",
      lastSyncAt: syncedAt,
    },
    metadata: { connectorId, syncedAt, collections },
    logs: appendLog(record.logs, log),
  }));
}

/**
 * Marks a sync as failed without discarding the previous snapshot.
 *
 * Cached metadata from an earlier successful sync stays usable — a transient
 * outage should degrade the connector to "stale", not to "unusable".
 */
export async function recordSyncFailure(
  connectorId: ConnectorId,
  message: string,
  log: ConnectorLogEntry,
): Promise<ConnectorState> {
  return mutateRecord(connectorId, (record) => ({
    ...record,
    connection: {
      ...record.connection,
      // Degraded, not unhealthy: credentials may be fine and only discovery
      // failed, and there is still cached metadata to migrate against.
      health: record.metadata ? "degraded" : "unhealthy",
      healthMessage: message,
    },
    logs: appendLog(record.logs, log),
  }));
}

/**
 * Disconnects a connector: clears the discovered state and the metadata cache,
 * keeps the configuration so reconnecting does not mean retyping it.
 *
 * Secrets are deleted separately by the route, via `secrets.deleteSecrets`.
 */
export async function disconnectConnector(
  connectorId: ConnectorId,
  log: ConnectorLogEntry,
): Promise<ConnectorState> {
  const definition = getConnector(connectorId);
  const secretFields = definition ? getSecretFields(definition).map((field) => field.key) : [];

  return mutateRecord(connectorId, (record) => ({
    ...record,
    connection: {
      ...record.connection,
      status: "disconnected",
      health: "unknown",
      healthMessage: "",
      connectedUser: "",
      connectedWorkspace: "",
      version: "",
      lastSyncAt: null,
      // The secrets are gone, so the connection must not claim to hold them.
      secretsPresent: record.connection.secretsPresent.filter(
        (key) => !secretFields.includes(key),
      ),
      updatedAt: new Date().toISOString(),
    },
    metadata: null,
    logs: appendLog(record.logs, log),
  }));
}

/** Removes a connector's record entirely. */
export async function deleteConnector(connectorId: ConnectorId): Promise<void> {
  await enqueue(async () => {
    const document = await loadDocument();
    if (!document.connectors[connectorId]) return;

    const connectors = { ...document.connectors };
    delete connectors[connectorId];
    await persistDocument({ connectors });
  });
}
