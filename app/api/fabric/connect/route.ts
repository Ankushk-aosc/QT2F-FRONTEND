// app/api/fabric/connect/route.ts
// POST /api/fabric/connect â€” test connection to Fabric
// Rule 3: Uses centralized httpClient.
// Rule 4: No hardcoded URLs (uses FABRIC_API_BASE_URL from env).

import { NextRequest, NextResponse } from "next/server";
import { httpGet, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log("[API] /api/fabric/connect called");

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      console.error("[API] Missing authorization header");
      return NextResponse.json(
        { error: "Unauthorized", code: "MISSING_AUTH_HEADER" },
        { status: 401 }
      );
    }

    // Forward Authorization header
    // Using httpGet ("fabric", "") sends GET to base url with headers
    // If the intention is to use POST on backend, we should use httpPost("fabric", "/connect", ...) if supported.
    // However, existing code used httpGet directly on fabric base URL seemingly just to check connectivity.
    // I will preserve the logic of checking connectivity but ensure headers are forwarded correctly.
    // If the goal is "connect", maybe GET /workspaces is enough as a check?
    // The previous implementation did httpGet("fabric", "", { Authorization: ... }).

    // I will use httpGet("fabric", "", ...) as it seems to be the intention to just list/check access.
    // Wait, the user prompt showed an example: const result = await httpPost("fabric", "/connect", body, { Authorization: ... });
    // This implies I should use httpPost. But I don't have a body here really.
    // And I don't know if the backend supports POST /connect on Fabric API.
    // Given Fabric API Base URL is .../workspaces, POST /connect on that would be .../workspaces/connect.
    // This looks unlikely for standard Fabric API.
    // However, the user might be referring to an intermediate backend service if applicable.
    // BUT environment variable FABRIC_API_BASE_URL points to https://api.fabric.microsoft.com/v1/workspaces directly.
    // So this API route is acting as a proxy to Fabric API.
    // GET /workspaces (base url) IS a valid operation to check connection.
    // So httpGet("fabric", "") is correct for "connecting" (verifying token).
    // I will stick to httpGet but ensure error handling is strict as requested.

    const result = await httpGet<unknown>("fabric", "", {
      headers: { "Authorization": authHeader }
    });

    console.log("[API] Connection successful, status:", result.status);

    return NextResponse.json({
      tenantId: "connected",
      workspaceId: "",
      isConnected: true,
      connectionTime: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[API] /api/fabric/connect error:", err);
    if ((err as any).status === 401) {
      return NextResponse.json(
        { error: "Unauthorized", code: "INVALID_TOKEN" },
        { status: 401 }
      );
    }
    const { body, status } = errorResponse(err, "Failed to connect to Fabric");
    return NextResponse.json(body, { status });
  }
}
