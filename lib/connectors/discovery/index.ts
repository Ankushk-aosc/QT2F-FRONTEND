import "server-only";

/**
 * Adapter resolution — the one place that decides *how* a connector is reached.
 *
 * To move a connector from backend delegation to native REST access, change its
 * entry here. Nothing above this file needs to know: the Integrations UI, the
 * metadata cache and the migration wizard all work against `DiscoveryAdapter`.
 *
 * A connector with no adapter is not configurable, which is exactly the state
 * every "coming soon" connector is in. `getAdapter` returning undefined is the
 * single check that keeps the planned connectors honest — there is no way to
 * save a Snowflake connection while there is no Snowflake adapter to verify it.
 */

import type { ConnectorId } from "@/types/connectors";

import { fabricBackendAdapter } from "./fabric.backend";
import { qlikBackendAdapter } from "./qlik.backend";
import { tableauBackendAdapter } from "./tableau.backend";
import type { DiscoveryAdapter } from "./types";

const ADAPTERS: Partial<Record<ConnectorId, DiscoveryAdapter>> = {
  qlik: qlikBackendAdapter,
  tableau: tableauBackendAdapter,
  fabric: fabricBackendAdapter,
};

export function getAdapter(connectorId: ConnectorId): DiscoveryAdapter | undefined {
  return ADAPTERS[connectorId];
}

/** Whether a connector can be verified and discovered at all. */
export function hasAdapter(connectorId: ConnectorId): boolean {
  return ADAPTERS[connectorId] !== undefined;
}

export type { ConnectionTestResult, DiscoveryAdapter, DiscoveryContext } from "./types";
