import "server-only";

/**
 * Orchestration for connector operations.
 *
 * The routes under `app/api/settings/integrations` are deliberately thin; this
 * module owns the sequences, so save-then-discover behaves identically however
 * it is triggered.
 *
 * The sequence that matters most is `saveConnector`, which implements the
 * product rule that an administrator configures a connector *once*:
 *
 *     validate → store secrets → persist config → authenticate
 *       → discover metadata → cache → report
 *
 * Discovery is part of saving rather than a second button the user has to find.
 * Everything downstream — the migration wizard's pickers especially — then
 * reads the cache instead of asking the administrator to load anything.
 *
 * One judgement call runs through all of it: **a discovery failure does not
 * fail a save.** Credentials that authenticate are worth keeping even when the
 * tenant is slow or a downstream endpoint is down. The connector is marked
 * degraded and the administrator can re-sync, rather than losing configuration
 * they just entered.
 */

import { getAdapter } from "./discovery";
import { getConnector, getSecretFields, type ConnectorDefinition } from "./registry";
import {
  disconnectConnector,
  getConnectorState,
  isMetadataStale,
  recordSyncFailure,
  recordTestResult,
  saveConnection,
  saveMetadata,
} from "./repository";
import { deleteSecrets, resolveSecrets, writeSecrets } from "./secrets";
import {
  createEmptyConnection,
  createLogEntry,
  sanitiseValues,
  splitSecrets,
  validateSave,
} from "./validation";
import { decodeToken } from "@/lib/token-validation";
import type {
  ConnectorActionResponse,
  ConnectorId,
  ConnectorState,
} from "@/types/connectors";

import type { DiscoveryContext } from "./discovery";

/** Caller identity and tokens, assembled once by the route. */
export interface RequestIdentity {
  authHeader: string;
  /** Connector-audienced token, when the client supplied one. */
  resourceAuthHeader?: string;
}

export interface SaveOutcome extends ConnectorActionResponse {
  /** Field-level problems, when validation rejected the payload. */
  fieldErrors?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the signed-in user's email from the bearer token.
 *
 * Taken from the token rather than the request body: several backend endpoints
 * key data by email, and a client-supplied value there would let one user read
 * another's content.
 */
function emailFromToken(authHeader: string): string {
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const claims = decodeToken(token);
  if (!claims) return "";

  const candidate = claims.preferred_username ?? claims.upn ?? claims.email ?? claims.unique_name;
  return typeof candidate === "string" ? candidate : "";
}

async function buildContext(
  definition: ConnectorDefinition,
  state: ConnectorState,
  identity: RequestIdentity,
): Promise<DiscoveryContext | null> {
  if (!state.connection) return null;

  const secretFields = getSecretFields(definition).map((field) => field.key);
  return {
    connection: state.connection,
    secrets: await resolveSecrets(definition.id, secretFields),
    authHeader: identity.authHeader,
    resourceAuthHeader: identity.resourceAuthHeader,
    userEmail: emailFromToken(identity.authHeader),
  };
}

function toResponse(
  connectorId: ConnectorId,
  ok: boolean,
  message: string,
  state: ConnectorState,
): ConnectorActionResponse {
  return {
    connectorId,
    ok,
    message,
    connection: state.connection,
    metadata: state.metadata,
    logs: state.logs,
  };
}

// ---------------------------------------------------------------------------
// Save — configure once, discover automatically
// ---------------------------------------------------------------------------

export async function saveConnector(
  connectorId: ConnectorId,
  body: unknown,
  identity: RequestIdentity,
): Promise<SaveOutcome> {
  const definition = getConnector(connectorId);
  if (!definition || definition.availability !== "available") {
    const state = await getConnectorState(connectorId);
    return {
      ...toResponse(connectorId, false, "This connector is not available for configuration yet.", state),
    };
  }

  const existing = await getConnectorState(connectorId);
  const payload = splitSecrets(definition, body);

  // Validate against secrets already held, so editing a URL does not demand the
  // administrator re-enter an API key the form deliberately left blank.
  const alreadyStored = existing.connection?.secretsPresent ?? [];
  const validation = validateSave(definition, payload, alreadyStored);
  if (!validation.ok) {
    return {
      ...toResponse(connectorId, false, "Some required fields need attention.", existing),
      fieldErrors: validation.errors,
    };
  }

  // Secrets first: if this fails, nothing has been written and the connector is
  // left exactly as it was, rather than holding config for a credential that
  // was never stored.
  const secretFields = getSecretFields(definition).map((field) => field.key);
  const secretsPresent = await writeSecrets(connectorId, payload.secrets ?? {}, secretFields);

  const base = existing.connection ?? createEmptyConnection(connectorId);
  const saved = await saveConnection(
    connectorId,
    {
      ...base,
      connectorId,
      connectionName: payload.connectionName || definition.name,
      values: sanitiseValues(definition, payload.values, base.values),
      secretsPresent,
      // Optimistic about nothing: until the test below runs, the connector's
      // status is whatever it was, not "connected".
      status: base.status === "not-configured" ? "disconnected" : base.status,
    },
    createLogEntry("info", "save", `Configuration saved for ${definition.name}.`),
  );

  // Authenticate, then discover. Both are best-effort from the save's point of
  // view — the configuration is already durable.
  return runVerifyAndSync(definition, saved, identity, {
    successPrefix: "Saved.",
    failurePrefix: "Saved, but",
  });
}

/**
 * The shared authenticate-then-discover tail used by save and by sync.
 *
 * Returning a `SaveOutcome` from one place keeps the messages consistent: an
 * administrator who saves and one who re-syncs see the same wording for the
 * same underlying condition.
 */
async function runVerifyAndSync(
  definition: ConnectorDefinition,
  state: ConnectorState,
  identity: RequestIdentity,
  phrasing: { successPrefix: string; failurePrefix: string },
): Promise<SaveOutcome> {
  const adapter = getAdapter(definition.id);
  const context = await buildContext(definition, state, identity);

  if (!adapter || !context) {
    return toResponse(
      definition.id,
      false,
      `${phrasing.failurePrefix} this connector has no discovery adapter wired, so it cannot be verified.`,
      state,
    );
  }

  const test = await adapter.test(context);
  const tested = await recordTestResult(
    definition.id,
    test,
    createLogEntry(
      test.ok ? "info" : "error",
      "test",
      test.message,
    ),
  );

  if (!test.ok) {
    return toResponse(
      definition.id,
      false,
      `${phrasing.failurePrefix} the connection could not be verified. ${test.message}`,
      tested,
    );
  }

  // Discovery runs against the freshly tested connection, so it picks up the
  // identity the test resolved.
  const discoveryContext = await buildContext(definition, tested, identity);
  if (!discoveryContext) return toResponse(definition.id, true, test.message, tested);

  try {
    const collections = await adapter.discover(discoveryContext);
    const discovered = collections.filter((collection) => collection.supported);
    const total = discovered.reduce((sum, collection) => sum + collection.items.length, 0);

    const synced = await saveMetadata(
      definition.id,
      collections,
      createLogEntry(
        "info",
        "sync",
        `Discovered ${total} object${total === 1 ? "" : "s"} across ${discovered.length} categor${discovered.length === 1 ? "y" : "ies"}.`,
      ),
    );

    return toResponse(
      definition.id,
      true,
      `${phrasing.successPrefix} Connected to ${definition.name} and discovered ${total} object${total === 1 ? "" : "s"}.`,
      synced,
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message.split(" - ")[0].slice(0, 300)
        : "Metadata discovery failed.";

    const failed = await recordSyncFailure(
      definition.id,
      message,
      createLogEntry("warn", "sync", message),
    );

    // Still `ok: true` — the credentials work and the configuration is saved.
    // Reporting this as a failure would push the administrator to re-enter
    // settings that are already correct.
    return toResponse(
      definition.id,
      true,
      `${phrasing.successPrefix} Connected to ${definition.name}, but metadata discovery did not complete: ${message}`,
      failed,
    );
  }
}

// ---------------------------------------------------------------------------
// Test, sync, disconnect
// ---------------------------------------------------------------------------

export async function testConnector(
  connectorId: ConnectorId,
  identity: RequestIdentity,
): Promise<ConnectorActionResponse> {
  const definition = getConnector(connectorId);
  const state = await getConnectorState(connectorId);

  if (!definition || !state.connection) {
    return toResponse(connectorId, false, "This connector has not been configured yet.", state);
  }

  const adapter = getAdapter(connectorId);
  const context = await buildContext(definition, state, identity);
  if (!adapter || !context) {
    return toResponse(connectorId, false, "No discovery adapter is wired for this connector.", state);
  }

  const result = await adapter.test(context);
  const updated = await recordTestResult(
    connectorId,
    result,
    createLogEntry(result.ok ? "info" : "error", "test", result.message),
  );

  return toResponse(connectorId, result.ok, result.message, updated);
}

export async function syncConnector(
  connectorId: ConnectorId,
  identity: RequestIdentity,
): Promise<ConnectorActionResponse> {
  const definition = getConnector(connectorId);
  const state = await getConnectorState(connectorId);

  if (!definition || !state.connection) {
    return toResponse(connectorId, false, "Configure this connector before syncing metadata.", state);
  }

  return runVerifyAndSync(definition, state, identity, {
    successPrefix: "Metadata refreshed.",
    failurePrefix: "Sync stopped:",
  });
}

/**
 * Re-syncs only when the cached snapshot has aged past its freshness window.
 *
 * This is what makes the cache self-maintaining: opening the Administration
 * Center or starting a migration nudges stale connectors without an
 * administrator ever pressing Sync.
 */
export async function syncIfStale(
  connectorId: ConnectorId,
  identity: RequestIdentity,
): Promise<ConnectorActionResponse | null> {
  const state = await getConnectorState(connectorId);

  // Only refresh connectors that are already working. A disconnected or broken
  // connector should not be silently retried in the background — that hides a
  // problem the administrator needs to see and act on.
  if (!state.connection || state.connection.status !== "connected") return null;
  if (!isMetadataStale(state.metadata)) return null;

  return syncConnector(connectorId, identity);
}

export async function disconnect(connectorId: ConnectorId): Promise<ConnectorActionResponse> {
  const definition = getConnector(connectorId);
  if (!definition) {
    const state = await getConnectorState(connectorId);
    return toResponse(connectorId, false, "Unknown connector.", state);
  }

  // Secrets go first. If clearing the record succeeded but the credential
  // survived, the platform would be holding a key for a connector the
  // administrator believes is disconnected.
  await deleteSecrets(
    connectorId,
    getSecretFields(definition).map((field) => field.key),
  );

  const state = await disconnectConnector(
    connectorId,
    createLogEntry("info", "disconnect", `${definition.name} disconnected and credentials cleared.`),
  );

  return toResponse(
    connectorId,
    true,
    `${definition.name} disconnected. The configuration was kept so you can reconnect without retyping it.`,
    state,
  );
}
