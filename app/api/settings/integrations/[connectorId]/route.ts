import { NextRequest, NextResponse } from "next/server";

import { errorResponse, requireAuth, successResponse } from "@/lib/api/routeHelpers";
import { isConnectorId } from "@/lib/connectors/registry";
import { getConnectorState } from "@/lib/connectors/repository";
import { disconnect, saveConnector } from "@/lib/connectors/service";

/**
 * One connector's configuration.
 *
 * GET    — stored configuration, health and cached metadata.
 * PUT    — save; automatically authenticates and discovers metadata.
 * DELETE — disconnect and destroy the stored credentials.
 *
 * The PUT is the endpoint behind "configure once": a single call validates,
 * stores the credential, authenticates, discovers every reachable metadata
 * category and caches it. The client does not orchestrate that sequence and
 * cannot skip a step in it.
 *
 * A secret submitted here travels in the `secrets` object and is separated out
 * before anything is persisted. Nothing in any response on this route can
 * contain a credential.
 */

export const dynamic = "force-dynamic";

/** Header carrying a connector-audienced token, when one is needed. */
const RESOURCE_TOKEN_HEADER = "x-connector-token";

type RouteContext = { params: Promise<{ connectorId: string }> };

/** Validates the path segment before it reaches anything that trusts it. */
async function resolveConnectorId(context: RouteContext) {
  const { connectorId } = await context.params;
  return isConnectorId(connectorId) ? connectorId : null;
}

function identityFrom(request: NextRequest) {
  return {
    authHeader: request.headers.get("Authorization") ?? "",
    resourceAuthHeader: request.headers.get(RESOURCE_TOKEN_HEADER) ?? undefined,
  };
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const unauthorized = requireAuth(request.headers.get("Authorization"));
  if (unauthorized) return unauthorized;

  const connectorId = await resolveConnectorId(context);
  if (!connectorId) return errorResponse("Unknown connector", 404);

  try {
    return successResponse(await getConnectorState(connectorId));
  } catch (error) {
    console.error("[API integrations] GET failed:", error);
    return errorResponse("Failed to load connector configuration");
  }
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const unauthorized = requireAuth(request.headers.get("Authorization"));
  if (unauthorized) return unauthorized;

  const connectorId = await resolveConnectorId(context);
  if (!connectorId) return errorResponse("Unknown connector", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("Request body must be a connector configuration object", 400);
  }

  try {
    // Always 200, including for a rejected payload. The outcome carries `ok`
    // and `fieldErrors`, and the client's fetch helper throws away the body of
    // a non-2xx response — returning 400 here would surface "Request failed"
    // instead of telling the administrator which field needs attention.
    return successResponse(await saveConnector(connectorId, body, identityFrom(request)));
  } catch (error) {
    console.error("[API integrations] PUT failed:", error);
    return errorResponse("Failed to save connector configuration");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const unauthorized = requireAuth(request.headers.get("Authorization"));
  if (unauthorized) return unauthorized;

  const connectorId = await resolveConnectorId(context);
  if (!connectorId) return errorResponse("Unknown connector", 404);

  try {
    return successResponse(await disconnect(connectorId));
  } catch (error) {
    console.error("[API integrations] DELETE failed:", error);
    return errorResponse("Failed to disconnect connector");
  }
}
