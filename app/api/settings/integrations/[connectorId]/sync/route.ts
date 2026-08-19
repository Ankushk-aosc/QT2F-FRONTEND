import { NextRequest, NextResponse } from "next/server";

import { errorResponse, requireAuth, successResponse } from "@/lib/api/routeHelpers";
import { isConnectorId } from "@/lib/connectors/registry";
import { getConnectorState } from "@/lib/connectors/repository";
import { syncConnector, syncIfStale } from "@/lib/connectors/service";

/**
 * Re-reads a connector's metadata into the cache.
 *
 * `?ifStale=true` makes the sync conditional on the cached snapshot having aged
 * past its freshness window. This is the background-refresh path: the
 * Administration Center and the migration wizard both call it on open, and it
 * costs nothing when the cache is warm.
 *
 * The conditional form is also what stops a refresh loop from hammering a
 * broken connector — `syncIfStale` declines to retry anything that is not
 * currently connected, so a bad credential surfaces as an error the
 * administrator fixes rather than as silent retries.
 */

export const dynamic = "force-dynamic";

const RESOURCE_TOKEN_HEADER = "x-connector-token";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ connectorId: string }> },
): Promise<NextResponse> {
  const unauthorized = requireAuth(request.headers.get("Authorization"));
  if (unauthorized) return unauthorized;

  const { connectorId } = await context.params;
  if (!isConnectorId(connectorId)) return errorResponse("Unknown connector", 404);

  const identity = {
    authHeader: request.headers.get("Authorization") ?? "",
    resourceAuthHeader: request.headers.get(RESOURCE_TOKEN_HEADER) ?? undefined,
  };

  const conditional = new URL(request.url).searchParams.get("ifStale") === "true";

  try {
    if (conditional) {
      const result = await syncIfStale(connectorId, identity);
      if (result) return successResponse(result);

      // Nothing to do. Return current state so the client can settle its UI
      // without a second request.
      const state = await getConnectorState(connectorId);
      return successResponse({
        connectorId,
        ok: true,
        message: "Cached metadata is still fresh.",
        connection: state.connection,
        metadata: state.metadata,
        logs: state.logs,
      });
    }

    return successResponse(await syncConnector(connectorId, identity));
  } catch (error) {
    console.error("[API integrations] sync failed:", error);
    return errorResponse("Failed to sync connector metadata");
  }
}
