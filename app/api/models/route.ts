// app/api/models/route.ts
import { NextRequest } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { requireAuth, successResponse, errorResponse } from "@/lib/api/routeHelpers";

export const dynamic = "force-dynamic";

/**
 * The AI models the Semantic Kernel backend has configured.
 *
 * Proxies `GET {SEMANTIC_KERNEL_URL}/models` so the orchestrator's host never
 * reaches the browser. The response only reports which providers are
 * configured — it carries no keys — but it is still fetched server-side so the
 * backend URL stays out of the client bundle.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const authError = requireAuth(authHeader);
  if (authError) return authError;

  try {
    // Shape is normalised client-side in `services/semanticKernel.service.ts`;
    // forwarded unchanged here so the route stays a pure proxy.
    const data = await httpClient.get<unknown>("/models", {
      apiType: "semantic",
      headers: { Authorization: authHeader! },
    });
    return successResponse(data);
  } catch (err: any) {
    // err.message can carry the upstream body; keep it out of the client response.
    console.error("[API /api/models] Error:", err?.message);
    return errorResponse("Unable to load available AI models.", err?.status || 502);
  }
}
