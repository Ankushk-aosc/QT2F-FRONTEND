/**
 * The discovery seam.
 *
 * Everything above this interface — the Integrations UI, the metadata cache,
 * the migration wizard's readiness check — is written against `DiscoveryAdapter`
 * and knows nothing about how a connector is actually reached.
 *
 * Two implementations are anticipated per connector:
 *
 *  - **backend** (wired today): delegates to the existing microservices behind
 *    `lib/api/httpClient`, which already own credential storage in Key Vault and
 *    already speak Qlik and Tableau. Reuses what exists, at the cost of only
 *    discovering what those endpoints expose.
 *  - **native** (drop-in): calls the vendor REST API directly for full metadata
 *    coverage, at the cost of this application holding the credentials.
 *
 * Swapping one for the other is a change in `./index.ts` and nothing else. An
 * adapter reports what it cannot supply via `MetadataCollection.supported`,
 * so a partial adapter degrades visibly rather than silently.
 */

import type {
  ConnectorConnection,
  ConnectorId,
  MetadataCollection,
} from "@/types/connectors";

/**
 * Everything an adapter needs to reach a platform, assembled server-side.
 *
 * `secrets` is resolved from the secret store immediately before the call and
 * is never serialised anywhere — it exists only for the duration of one request.
 */
export interface DiscoveryContext {
  connection: ConnectorConnection;
  /** Resolved secret field values, keyed by field key. */
  secrets: Record<string, string>;
  /** The caller's bearer token, forwarded to downstream microservices. */
  authHeader: string;
  /**
   * A bearer token audienced for the connector's own resource, when the
   * connector needs one distinct from this platform's API token.
   *
   * Microsoft Fabric is the case that forces this: it is reached directly and
   * rejects a token issued for another audience, so the client acquires a
   * Fabric-scoped token and passes it alongside the request. Adapters that
   * delegate to a migration microservice ignore this and use `authHeader`.
   */
  resourceAuthHeader?: string;
  /** Signed-in user's email. Several backend endpoints require it. */
  userEmail: string;
}

/**
 * Outcome of a connection test.
 *
 * The identity fields are optional because not every platform reports them.
 * An adapter returns what it learned and omits the rest rather than inventing
 * placeholder values — a card showing a made-up tenant is worse than a blank.
 */
export interface ConnectionTestResult {
  ok: boolean;
  /** Shown verbatim in the success or error banner. */
  message: string;
  version?: string;
  connectedUser?: string;
  connectedWorkspace?: string;
  /**
   * Non-secret values the adapter resolved and that belong in the saved
   * connection, merged over what the administrator typed.
   *
   * Tableau is the case that needs it: its credentials live in the migration
   * backend's Key Vault, which hands back a `connection_id`. Recording that id
   * here is what lets the migration screen reuse the connection configured in
   * Settings instead of asking for the token a second time.
   *
   * Must never carry a secret — this lands in the settings document.
   */
  values?: Record<string, string>;
}

export interface DiscoveryAdapter {
  connectorId: ConnectorId;

  /**
   * Verifies credentials and reports what the platform says about itself.
   *
   * Must not throw for an ordinary authentication or network failure — those
   * are results, not exceptions, and the caller renders them as an unhealthy
   * connector rather than a 500.
   */
  test(context: DiscoveryContext): Promise<ConnectionTestResult>;

  /**
   * Reads every metadata category this adapter can supply.
   *
   * Returns one collection per kind declared on the connector definition,
   * including unsupported ones, so the viewer can show the full shape of what
   * the platform offers and which parts this adapter reaches.
   */
  discover(context: DiscoveryContext): Promise<MetadataCollection[]>;
}

// ---------------------------------------------------------------------------
// Helpers shared by adapters
// ---------------------------------------------------------------------------

/**
 * Builds a collection for a category this adapter cannot reach.
 *
 * Used liberally by the backend adapters: the migration microservices expose
 * spaces, apps, sites, projects and workbooks, and nothing deeper. Marking the
 * rest unsupported with a reason is the honest representation — an empty array
 * would read as "your tenant has no reload tasks".
 */
export function unsupported(kind: string, label: string, note: string): MetadataCollection {
  return { kind, label, items: [], supported: false, note };
}

export function supported(
  kind: string,
  label: string,
  items: MetadataCollection["items"],
  note?: string,
): MetadataCollection {
  return { kind, label, items, supported: true, note };
}

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    // Backend errors arrive as "API Error 401: Unauthorized - {json}" or "API Error 500: Internal Server Error - {json}".
    const parts = error.message.split(" - ");
    if (parts.length > 1) {
      const jsonPart = parts.slice(1).join(" - ").trim();
      try {
        const parsed = JSON.parse(jsonPart);
        if (parsed.detail) {
          const detailStr = String(parsed.detail);
          const detailParts = detailStr.split(" - ");
          if (detailParts.length > 1) {
            try {
              const nestedJson = JSON.parse(detailParts.slice(1).join(" - "));
              if (nestedJson.error?.detail) {
                return `${detailParts[0]}: ${nestedJson.error.detail}`;
              }
            } catch {
              // Ignore nested parse error
            }
          }
          return detailStr;
        } else if (parsed.error && typeof parsed.error === "string") {
          return parsed.error;
        } else if (parsed.message) {
          return parsed.message;
        }
      } catch {
        // Not valid JSON, ignore
      }
    }
    // Keep the leading, human-meaningful part and drop the raw payload if parsing failed.
    return parts[0].slice(0, 300);
  }
  return fallback;
}

/**
 * Runs `task` over `items` with bounded concurrency.
 *
 * Discovery fans out — one call per Qlik space, one per Tableau project — and
 * an unbounded `Promise.all` over a large tenant would open hundreds of sockets
 * against the backend at once.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}
