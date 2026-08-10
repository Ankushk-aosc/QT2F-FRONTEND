// app/api/fabric/lakehouses/route.ts
// GET /api/fabric/lakehouses?workspaceId={id} – fetch Fabric Lakehouses for a workspace

import { NextRequest, NextResponse } from "next/server";
import { httpGet, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

interface FabricLakehousesResponse {
  value: Array<{
    id: string;
    displayName: string;
    description?: string;
    type?: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");

    if (!workspaceId?.trim()) {
      return NextResponse.json(
        { error: "workspaceId query parameter is required" },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    console.log(`[API] /api/fabric/lakehouses called for workspace: ${workspaceId}`);

    const result = await httpGet<FabricLakehousesResponse>(
      "fabric",
      `/${workspaceId.trim()}/lakehouses`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );

    const lakehouses = result.data.value || [];
    console.log(`[API] Lakehouses fetched successfully: ${lakehouses.length} lakehouses`);

    return NextResponse.json({ lakehouses });
  } catch (err: unknown) {
    console.error("[API] /api/fabric/lakehouses error:", err);
    const { body, status } = errorResponse(err, "Failed to fetch Fabric lakehouses");
    return NextResponse.json(body, { status });
  }
}
