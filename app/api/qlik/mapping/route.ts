import { NextRequest } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { requireAuth, successResponse, errorResponse } from "@/lib/api/routeHelpers";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const authError = requireAuth(authHeader);
  if (authError) return authError;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  try {
    const data = await httpClient.post<any>("", body, {
      apiType: "qlik-mapping",
      headers: { Authorization: authHeader! },
    });
    return successResponse(data);
  } catch (err: any) {
    console.error("[API /api/qlik/mapping] Error:", err.message);
    return errorResponse(err.message || "Failed to execute mapping", err.status || 500);
  }
}
