import { fetchWithAuth } from "@/lib/fetchWithAuth";

import type {
  ConnectorActionResponse,
  ConnectorId,
  ConnectorListResponse,
  ConnectorSavePayload,
  ConnectorState,
} from "@/types/connectors";

/**
 * Client-side access to connector configuration.
 *
 * Follows the existing service conventions: a thin class exported as a
 * singleton, talking to Next.js routes through `fetchWithAuth` so the bearer
 * token and its refresh-on-401 behaviour are handled in one place.
 *
 * The one thing this service adds beyond plumbing is the Fabric token. Fabric
 * is reached directly rather than through a migration microservice and rejects
 * a token issued for this platform's own API, so the separately-acquired
 * `fabric_access_token` is forwarded in a header. Connectors that delegate to a
 * backend need none of this, which is why it is keyed off the connector rather
 * than applied to every request.
 */

/** Session storage key holding the Fabric-audienced token. */
const FABRIC_TOKEN_KEY = "fabric_access_token";

/** Header the API routes read a connector-audienced token from. */
const RESOURCE_TOKEN_HEADER = "x-connector-token";

class ConnectorsService {
  /**
   * Extra headers for connectors that need a token this platform's own API
   * token cannot stand in for.
   */
  private resourceHeaders(connectorId: ConnectorId): Record<string, string> {
    if (connectorId !== "fabric") return {};
    if (typeof window === "undefined") return {};

    const token = sessionStorage.getItem(FABRIC_TOKEN_KEY);
    return token ? { [RESOURCE_TOKEN_HEADER]: `Bearer ${token}` } : {};
  }

  private basePath(connectorId: ConnectorId): string {
    return `/api/settings/integrations/${encodeURIComponent(connectorId)}`;
  }

  /** Every configured connector, for the Integrations grid. */
  async listConnectors(): Promise<ConnectorListResponse> {
    try {
      return await fetchWithAuth<ConnectorListResponse>("/api/settings/integrations");
    } catch (error) {
      console.error("[ConnectorsService] listConnectors error:", error);
      throw error;
    }
  }

  async getConnector(connectorId: ConnectorId): Promise<ConnectorState> {
    try {
      return await fetchWithAuth<ConnectorState>(this.basePath(connectorId));
    } catch (error) {
      console.error(`[ConnectorsService] getConnector(${connectorId}) error:`, error);
      throw error;
    }
  }

  /**
   * Saves a connector. The server authenticates and discovers metadata as part
   * of the same call, so a successful response already has a warm cache.
   *
   * Secrets go in `payload.secrets` and are never returned by any endpoint.
   */
  async saveConnector(
    connectorId: ConnectorId,
    payload: ConnectorSavePayload,
  ): Promise<ConnectorActionResponse & { fieldErrors?: Record<string, string> }> {
    try {
      return await fetchWithAuth(this.basePath(connectorId), {
        method: "PUT",
        headers: this.resourceHeaders(connectorId),
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error(`[ConnectorsService] saveConnector(${connectorId}) error:`, error);
      throw error;
    }
  }

  async testConnector(connectorId: ConnectorId): Promise<ConnectorActionResponse> {
    try {
      return await fetchWithAuth<ConnectorActionResponse>(`${this.basePath(connectorId)}/test`, {
        method: "POST",
        headers: this.resourceHeaders(connectorId),
      });
    } catch (error) {
      console.error(`[ConnectorsService] testConnector(${connectorId}) error:`, error);
      throw error;
    }
  }

  /**
   * Re-reads metadata into the cache.
   *
   * `ifStale` makes it conditional on the cached snapshot having aged out —
   * the form used by background refresh, where a warm cache should cost
   * nothing.
   */
  async syncConnector(connectorId: ConnectorId, ifStale = false): Promise<ConnectorActionResponse> {
    const query = ifStale ? "?ifStale=true" : "";
    try {
      return await fetchWithAuth<ConnectorActionResponse>(
        `${this.basePath(connectorId)}/sync${query}`,
        { method: "POST", headers: this.resourceHeaders(connectorId) },
      );
    } catch (error) {
      console.error(`[ConnectorsService] syncConnector(${connectorId}) error:`, error);
      throw error;
    }
  }

  /** Disconnects and destroys the stored credentials, keeping the configuration. */
  async disconnectConnector(connectorId: ConnectorId): Promise<ConnectorActionResponse> {
    try {
      return await fetchWithAuth<ConnectorActionResponse>(this.basePath(connectorId), {
        method: "DELETE",
      });
    } catch (error) {
      console.error(`[ConnectorsService] disconnectConnector(${connectorId}) error:`, error);
      throw error;
    }
  }
}

export const connectorsService = new ConnectorsService();
