// app/api/qlik/process-space/route.ts
import { NextRequest } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { RT_COOKIE } from "@/lib/auth/serverAuth";
import { requireAuth, successResponse, errorResponse } from "@/lib/api/routeHelpers";

export const dynamic = "force-dynamic";

export interface ProcessQlikSpaceRequest {
  email: string;
  /** The Qlik environment, e.g. "cloud". */
  source_type: string;
  /** One or more Qlik space ids, always sent as an array. */
  workspace_id: string[];
  deployment_type: string;
  fabric_group_id?: string;
  model?: string;
}

/**
 * Runs an entire Qlik space through the Semantic Kernel orchestrator.
 *
 * Proxies `POST {SEMANTIC_KERNEL_URL}/qlik/process-space`. This is the
 * server-orchestrated equivalent of the per-app sequence that
 * `QlikMigrationTab` currently drives from the browser: one call hands the
 * whole space to the backend, which owns the agent ordering.
 *
 * Space ids come from the caller's current selection; nothing is defaulted.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const authError = requireAuth(authHeader);
  if (authError) return authError;

  let body: ProcessQlikSpaceRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const spaceIds = Array.isArray(body?.workspace_id)
    ? body.workspace_id.filter((id) => typeof id === "string" && id.trim() !== "")
    : [];

  if (spaceIds.length === 0) {
    return errorResponse("Select at least one Qlik space before starting.", 400);
  }
  if (!body?.email?.trim()) {
    return errorResponse("Missing the signed-in user's email.", 400);
  }

  // Seed the server-held refresh token so long runs can renew Fabric/OneLake
  // tokens; never trust one sent by the client.
  const seededRt = req.cookies.get(RT_COOKIE)?.value;
  const payload = {
    ...body,
    workspace_id: spaceIds,
    ...(seededRt ? { refresh_token: seededRt } : {}),
  };

  try {
    const data = await httpClient.post<{ run_id?: string; message?: string }>(
      "/qlik/process-space",
      payload,
      { apiType: "semantic", headers: { Authorization: authHeader! } },
    );
    return successResponse(data);
  } catch (err: any) {
    console.error("[API /api/qlik/process-space] Failed with status:", err?.status ?? "unknown");
    return errorResponse(
      "Unable to start the Qlik space migration. Please check your connection and try again.",
      err?.status || 502,
    );
  }
}
