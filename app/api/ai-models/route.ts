import { NextRequest } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { requireAuth, successResponse, errorResponse } from "@/lib/api/routeHelpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const authError = requireAuth(authHeader);
  if (authError) return authError;

  try {
    const data = await httpClient.get<unknown>("/ai-models", {
      apiType: "semantic",
      headers: { Authorization: authHeader! },
    });
    return successResponse(data);
  } catch (err: any) {
    console.error("[API /api/ai-models] GET Error:", err?.message);
    return errorResponse("Unable to load AI models.", err?.status || 502);
  }
}

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const authError = requireAuth(authHeader);
  if (authError) return authError;

  try {
    const body = await req.json();
    const id = body.id;
    if (!id) {
      return errorResponse("Model ID is required.", 400);
    }
    
    // Pass the rest of the body to the PATCH backend
    const { id: _, _id, ...updates } = body;
    
    const data = await httpClient.patch<unknown>(`/ai-models/${id}`, updates, {
      apiType: "semantic",
      headers: { Authorization: authHeader! },
      skipPayloadIntercept: true
    });
    return successResponse(data);
  } catch (err: any) {
    console.error("[API /api/ai-models] PATCH Error:", err?.message);
    return errorResponse("Unable to update AI model.", err?.status || 502);
  }
}
