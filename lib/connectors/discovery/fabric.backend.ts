import "server-only";

/**
 * Microsoft Fabric discovery.
 *
 * `FABRIC_API_BASE_URL` points at the Fabric REST API's workspaces collection,
 * so this adapter talks to Fabric directly rather than through a migration
 * microservice — there is no intermediary to reuse.
 *
 * Fabric authenticates with Microsoft Entra ID, which means there is no
 * credential for an administrator to enter and none for this application to
 * store. It does mean the token must be audienced for Fabric rather than for
 * this platform's own API, which is why the context carries an optional
 * `resourceAuthHeader`: the client holds a separate `fabric_access_token` and
 * passes it alongside the request. Without it the adapter reports the specific
 * problem instead of a generic 401.
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

/** Workspaces queried in parallel for their storage items. */
const ITEM_FETCH_CONCURRENCY = 4;

interface FabricWorkspace {
  id?: string;
  name?: string;
  displayName?: string;
  type?: string;
  capacityId?: string;
}

interface FabricItem {
  id?: string;
  displayName?: string;
  description?: string;
}

/**
 * Fabric rejects a token issued for another audience, so prefer the
 * Fabric-scoped one when the client supplied it.
 */
function fabricAuth(context: DiscoveryContext): Record<string, string> {
  return { Authorization: context.resourceAuthHeader || context.authHeader };
}

function asValueArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const value = (payload as Record<string, unknown>).value;
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

async function fetchWorkspaces(context: DiscoveryContext): Promise<FabricWorkspace[]> {
  const data = await httpClient.get<unknown>("", {
    apiType: "fabric",
    headers: fabricAuth(context),
  });
  return asValueArray<FabricWorkspace>(data);
}

async function fetchItems(
  context: DiscoveryContext,
  workspaceId: string,
  itemType: "lakehouses" | "warehouses",
): Promise<FabricItem[]> {
  const data = await httpClient.get<unknown>(
    `/${encodeURIComponent(workspaceId)}/${itemType}`,
    { apiType: "fabric", headers: fabricAuth(context) },
  );
  return asValueArray<FabricItem>(data);
}

function workspaceName(workspace: FabricWorkspace): string {
  return String(workspace.displayName ?? workspace.name ?? workspace.id ?? "Unnamed workspace");
}

export const fabricBackendAdapter: DiscoveryAdapter = {
  connectorId: "fabric",

  async test(context: DiscoveryContext): Promise<ConnectionTestResult> {
    if (!context.resourceAuthHeader) {
      return {
        ok: false,
        message:
          "No Fabric access token was supplied. Sign in again so the platform can acquire a Fabric-scoped token, then test the connection.",
      };
    }

    try {
      const workspaces = await fetchWorkspaces(context);
      const configured = String(context.connection.values.workspace ?? "");

      // Resolve the configured workspace name to its id, so the administrator
      // does not have to paste a GUID they can look up here.
      const match = workspaces.find(
        (workspace) => workspaceName(workspace).toLowerCase() === configured.toLowerCase(),
      );

      if (configured && !match) {
        return {
          ok: false,
          message: `Signed in to Fabric, but no workspace named “${configured}” is visible to this account.`,
          connectedUser: context.userEmail,
        };
      }

      return {
        ok: true,
        message: `Connected to Microsoft Fabric. ${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"} visible.`,
        connectedUser: context.userEmail,
        connectedWorkspace: match ? workspaceName(match) : "",
        version: "Fabric REST v1",
      };
    } catch (error) {
      return {
        ok: false,
        message: toErrorMessage(error, "Could not reach Microsoft Fabric."),
      };
    }
  },

  async discover(context: DiscoveryContext): Promise<MetadataCollection[]> {
    const workspaces = await fetchWorkspaces(context);

    const workspaceItems: MetadataItem[] = workspaces.map((workspace) => ({
      id: String(workspace.id ?? ""),
      name: workspaceName(workspace),
      detail: workspace.capacityId ? `Capacity ${workspace.capacityId}` : undefined,
    }));

    // Enumerating storage items for every workspace in a large tenant is slow
    // and mostly wasted — the migration only ever writes to the configured
    // workspace. Scope the deeper read to it, and fall back to all workspaces
    // only when none is configured yet.
    const configured = String(context.connection.values.workspace ?? "").toLowerCase();
    const targets = configured
      ? workspaceItems.filter((workspace) => workspace.name.toLowerCase() === configured)
      : workspaceItems;

    const results = await mapWithConcurrency(
      targets.filter((workspace) => workspace.id !== ""),
      ITEM_FETCH_CONCURRENCY,
      async (workspace) => {
        const [lakehouses, warehouses] = await Promise.all([
          fetchItems(context, workspace.id, "lakehouses").catch(() => [] as FabricItem[]),
          fetchItems(context, workspace.id, "warehouses").catch(() => [] as FabricItem[]),
        ]);
        return { workspaceId: workspace.id, lakehouses, warehouses };
      },
    );

    const toItems = (
      source: readonly { workspaceId: string; lakehouses: FabricItem[]; warehouses: FabricItem[] }[],
      key: "lakehouses" | "warehouses",
    ): MetadataItem[] =>
      source.flatMap((result) =>
        result[key]
          .filter((item) => item.id)
          .map((item) => ({
            id: String(item.id),
            name: String(item.displayName ?? item.id),
            parentId: result.workspaceId,
            detail: item.description || undefined,
          })),
      );

    const scopeNote = configured
      ? `Scoped to the configured workspace “${context.connection.values.workspace}”.`
      : undefined;

    // Capacities live outside the workspaces collection this base URL points at,
    // so they cannot be read without a second, differently-rooted endpoint.
    const capacityIds = new Set(
      workspaces.map((workspace) => workspace.capacityId).filter((id): id is string => !!id),
    );

    return [
      supported("workspaces", "Workspaces", workspaceItems),
      supported("lakehouses", "Lakehouses", toItems(results, "lakehouses"), scopeNote),
      supported("warehouses", "Warehouses", toItems(results, "warehouses"), scopeNote),
      capacityIds.size > 0
        ? supported(
            "capacities",
            "Capacities",
            [...capacityIds].map((id) => ({ id, name: id })),
            "Capacity identifiers referenced by visible workspaces. Names require the capacities endpoint.",
          )
        : unsupported(
            "capacities",
            "Capacities",
            "The configured Fabric base URL addresses the workspaces collection, which does not expose capacities.",
          ),
    ];
  },
};
