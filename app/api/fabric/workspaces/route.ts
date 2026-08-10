// app/api/fabric/workspaces/route.ts
// GET /api/fabric/workspaces â€” fetch Fabric workspaces
// Rule 3: Uses centralized httpClient.
// Rule 4: No hardcoded URLs (uses FABRIC_API_BASE_URL from env).

import { NextRequest, NextResponse } from "next/server";
import { httpGet, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

interface FabricWorkspacesResponse {
  value: Array<{
    id: string;
    name: string;
    type: string;
    capacityId?: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    console.log("[API] /api/fabric/workspaces called");

    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[API] Missing or invalid authorization header");
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    console.log("[API] Fetching workspaces from Fabric API...");

    const result = await httpGet<FabricWorkspacesResponse>("fabric", "", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    console.log("[API] Workspaces fetched successfully:", result.data.value?.length || 0, "workspaces");

    return NextResponse.json({
      workspaces: result.data.value || [],
    });
  } catch (err: unknown) {
    console.error("[API] /api/fabric/workspaces error:", err);
    const { body, status } = errorResponse(err, "Failed to fetch Fabric workspaces");
    return NextResponse.json(body, { status });
  }
}
