import { NextRequest, NextResponse } from "next/server";

import { errorResponse, requireAuth, successResponse } from "@/lib/api/routeHelpers";
import { isConnectorId } from "@/lib/connectors/registry";
import { testConnector } from "@/lib/connectors/service";

/**
 * Verifies a connector's stored credentials without touching its metadata.
 *
 * Separate from sync because the two answer different questions. Test asks "do
 * these credentials still work", and is cheap enough to run whenever an
 * administrator wants reassurance. Sync re-reads the tenant, which on a large
 * one is not cheap.
 *
 * A failed test is a 200 with `ok: false`, not an HTTP error: the request was
 * handled correctly, and the answer happens to be that the connector is
 * unhealthy. Reserving non-2xx for genuine route failures keeps the client's
 * error handling meaningful.
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

  try {
    const result = await testConnector(connectorId, {
      authHeader: request.headers.get("Authorization") ?? "",
      resourceAuthHeader: request.headers.get(RESOURCE_TOKEN_HEADER) ?? undefined,
    });
    return successResponse(result);
  } catch (error) {
    console.error("[API integrations] test failed:", error);
    return errorResponse("Failed to test connector");
  }
}
