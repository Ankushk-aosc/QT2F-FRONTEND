// app/api/tableau/connect/route.ts
// GET /api/tableau/connect â€” get Tableau credentials
// Rule 3: Uses centralized httpClient.
// Forwards Authorization header from client request to backend.

import { NextRequest, NextResponse } from "next/server";
import { httpGet, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Extract and forward the Authorization header (fixes 401)
    const authHeader = req.headers.get("Authorization");
    const forwardHeaders: Record<string, string> = {};
    if (authHeader) {
      forwardHeaders["Authorization"] = authHeader;
    }

    const result = await httpGet<unknown>("tableau", "/get-tableau-url", forwardHeaders);
    return NextResponse.json(result.data, { status: 200 });
  } catch (err: unknown) {
    console.error("[API /api/tableau/connect] Error:", err);
    const { body, status } = errorResponse(err, "Failed to connect to Tableau");
    return NextResponse.json(body, { status });
  }
}
