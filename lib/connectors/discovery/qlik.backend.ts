import "server-only";

/**
 * Qlik discovery via the existing migration backend.
 *
 * Delegates to the same `QLIK_URL` microservice the Qlik migration dashboard
 * already uses, so credentials continue to live in the backend's Key Vault and
 * this application never handles a Qlik API key.
 *
 * That reuse sets the ceiling on what can be discovered. The microservice
 * exposes spaces and the applications within them; sheets, variables, measures,
 * data connections and reload tasks have no endpoint behind them today, so they
 * are reported as unsupported with the reason rather than as empty results.
 * A native adapter reaching Qlik Cloud directly would fill these in without any
 * change above the `DiscoveryAdapter` interface.
 */

import { httpClient } from "@/lib/api/httpClient";
import type { MetadataCollection, MetadataItem } from "@/types/connectors";

import {
  mapWithConcurrency,
  supported,
  toErrorMessage,
  unsupported,
  type ConnectionTestResult,
  type DiscoveryAdapter,
  type DiscoveryContext,
} from "./types";

/** Reason attached to every category the migration backend does not expose. */
const NOT_EXPOSED =
  "The migration backend does not expose this category. It appears once a native Qlik Cloud adapter is wired.";

/** Spaces queried in parallel for their applications. */
const APP_FETCH_CONCURRENCY = 4;

interface QlikSpace {
  id?: string;
  name?: string;
  type?: string;
  ownerId?: string;
}

interface QlikApp {
  id?: string;
  name?: string;
  owner?: string;
  ownerId?: string;
  modifiedDate?: string;
  spaceId?: string;
}

function authHeaders(context: DiscoveryContext): Record<string, string> {
  return { Authorization: context.authHeader };
}

/** The backend returns either a bare array or an envelope, depending on route. */
function asArray<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const nested = (payload as Record<string, unknown>)[key];
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

async function fetchSpaces(context: DiscoveryContext): Promise<QlikSpace[]> {
  const data = await httpClient.get<unknown>("/getSpaces", {
    apiType: "qlik",
    headers: authHeaders(context),
  });
  return asArray<QlikSpace>(data, "spaces");
}

async function fetchApps(context: DiscoveryContext, spaceId: string): Promise<QlikApp[]> {
  const data = await httpClient.get<unknown>(`/getApps/${encodeURIComponent(spaceId)}`, {
    apiType: "qlik",
    headers: authHeaders(context),
  });
  return asArray<QlikApp>(data, "apps");
}

/**
 * Publishes the configured tenant URL to the backend's Qlik settings record.
 *
 * The migration backend keeps the customer's Qlik Cloud URL in its own store,
 * and until this connector existed the *only* thing that wrote it was a URL
 * form on the migration dashboard. Removing that form left the backend with no
 * writer, so the connector has to take the job over — otherwise "configure once
 * in Settings" would configure only half of what a migration needs.
 *
 * Best-effort by design: a connector whose credentials work should not be
 * reported as broken because this bookkeeping call failed. It is retried on
 * every test and sync, so a transient failure corrects itself.
 *
 * `/qlik` lives on the Qlik migration store (`QLIK_MONGO_DB_URL`), not on the
 * async records API. This previously used `apiType: "sql"`, which resolved to
 * `SQL_BASE_URL` and 404'd on every call — and because the failure is swallowed
 * below, it did so silently, leaving the tenant URL never actually published.
 */
async function publishCloudUrl(context: DiscoveryContext): Promise<void> {
  const cloudUrl = String(context.connection.values.cloudUrl ?? "");
  if (!cloudUrl) return;

  try {
    await httpClient.post("/qlik", { server_url: cloudUrl }, { apiType: "qlik-mongo" });
  } catch (error) {
    // Names the target so the next silent failure is greppable rather than a
    // bare "could not publish" with no indication of where it went.
    console.warn(
      "[QlikAdapter] Could not publish the cloud URL to POST {QLIK_MONGO_DB_URL}/qlik:",
      toErrorMessage(error, "unknown"),
    );
  }
}

export const qlikBackendAdapter: DiscoveryAdapter = {
  connectorId: "qlik",

  async test(context: DiscoveryContext): Promise<ConnectionTestResult> {
    try {
      await publishCloudUrl(context);
      const spaces = await fetchSpaces(context);

      // The tenant is not returned by the backend, so derive it from the URL the
      // administrator configured rather than leaving the card blank.
      const cloudUrl = String(context.connection.values.cloudUrl ?? "");
      let tenant = String(context.connection.values.tenant ?? "");
      if (!tenant && cloudUrl) {
        try {
          tenant = new URL(cloudUrl).hostname;
        } catch {
          // A malformed URL cannot reach here — the field is validated as a URL
          // before it is stored — but a stored document could predate that.
          tenant = "";
        }
      }

      const defaultSpace = String(context.connection.values.defaultSpace ?? "");
      const resolvedSpace =
        defaultSpace || spaces.find((space) => space.name)?.name || "";

      return {
        ok: true,
        message: `Connected to Qlik. ${spaces.length} space${spaces.length === 1 ? "" : "s"} visible.`,
        connectedUser: context.userEmail,
        connectedWorkspace: resolvedSpace,
        version: tenant ? `Qlik Cloud · ${tenant}` : "Qlik Cloud",
      };
    } catch (error) {
      return {
        ok: false,
        message: toErrorMessage(error, "Could not reach Qlik. Check the cloud URL and credentials."),
      };
    }
  },

  async discover(context: DiscoveryContext): Promise<MetadataCollection[]> {
    const spaces = await fetchSpaces(context);

    const spaceItems: MetadataItem[] = spaces.map((space) => ({
      id: String(space.id ?? ""),
      name: String(space.name ?? space.id ?? "Unnamed space"),
      detail: space.type ? `Type: ${space.type}` : undefined,
    }));

    // One failing space must not lose the whole sync — a shared space the signed
    // in user cannot read is a normal condition in a large tenant.
    const appResults = await mapWithConcurrency(
      spaceItems.filter((space) => space.id !== ""),
      APP_FETCH_CONCURRENCY,
      async (space) => {
        try {
          const apps = await fetchApps(context, space.id);
          return { spaceId: space.id, apps, error: null as string | null };
        } catch (error) {
          return {
            spaceId: space.id,
            apps: [] as QlikApp[],
            error: toErrorMessage(error, "unreadable"),
          };
        }
      },
    );

    // Keyed by app id, not a list: the same app comes back from more than one
    // space query — a published app is visible in both its own space and any
    // space it is shared into — and appending each sighting produced duplicate
    // entries that collided on their React key in the metadata viewer. First
    // sighting wins, so the recorded `parentId` is the app's earliest space in
    // the stable order the spaces were listed in.
    const apps = new Map<string, MetadataItem>();
    const owners = new Map<string, MetadataItem>();

    for (const result of appResults) {
      for (const app of result.apps) {
        const id = String(app.id ?? "");
        if (!id) continue;

        if (!apps.has(id)) {
          apps.set(id, {
            id,
            name: String(app.name ?? id),
            parentId: result.spaceId,
            detail: app.modifiedDate ? `Modified ${app.modifiedDate}` : undefined,
          });
        }

        const ownerId = String(app.ownerId ?? app.owner ?? "");
        if (ownerId && !owners.has(ownerId)) {
          owners.set(ownerId, { id: ownerId, name: String(app.owner ?? ownerId) });
        }
      }
    }

    const failedSpaces = appResults.filter((result) => result.error !== null).length;
    const appNote =
      failedSpaces > 0
        ? `${failedSpaces} space${failedSpaces === 1 ? "" : "s"} could not be read and were skipped.`
        : undefined;

    return [
      supported("spaces", "Spaces", spaceItems),
      supported("apps", "Applications", [...apps.values()], appNote),
      supported(
        "owners",
        "Owners",
        [...owners.values()],
        owners.size === 0 ? "Derived from application ownership; none reported." : "Derived from application ownership.",
      ),
      unsupported("sheets", "Sheets", NOT_EXPOSED),
      unsupported("variables", "Variables", NOT_EXPOSED),
      unsupported("measures", "Measures", NOT_EXPOSED),
      unsupported("dataConnections", "Data connections", NOT_EXPOSED),
      unsupported("reloadTasks", "Reload tasks", NOT_EXPOSED),
      unsupported("reloadHistory", "Reload history", NOT_EXPOSED),
      unsupported("scripts", "Scripts", NOT_EXPOSED),
      unsupported("objects", "Objects", NOT_EXPOSED),
    ];
  },
};
