import { NextResponse } from "next/server";

import { errorResponse, requireAuth, successResponse } from "@/lib/api/routeHelpers";
import { getAllConnectorStates } from "@/lib/connectors/repository";
import type { ConnectorListResponse } from "@/types/connectors";

/**
 * Every configured connector's state, in one request.
 *
 * The Integrations page needs status, health and cache freshness for all
 * connectors at once to render its grid. Fetching them individually would mean
 * a request per card and a grid that fills in raggedly.
 *
 * Connectors that have never been configured are simply absent from the
 * response; the client fills the grid from the registry and treats a missing
 * entry as "not configured". That keeps the payload proportional to what an
 * administrator has actually set up rather than to the size of the catalogue.
 *
 * No secret is reachable here — the response is assembled from the connector
 * document, which by construction contains none.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = requireAuth(request.headers.get("Authorization"));
  if (unauthorized) return unauthorized;

  try {
    const connectors = await getAllConnectorStates();
    const payload: ConnectorListResponse = { connectors };
    return successResponse(payload);
  } catch (error) {
    console.error("[API integrations] GET failed:", error);
    return errorResponse("Failed to load connector configuration");
  }
}
