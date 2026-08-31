// app/api/qlik/process-space/route.ts
import { NextRequest } from "next/server";
import { RT_COOKIE } from "@/lib/auth/serverAuth";
import { requireAuth, successResponse, errorResponse } from "@/lib/api/routeHelpers";
import { getRecordsApiBaseUrl } from "@/lib/recordsApiBaseUrl";

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
  connection_id?: string;
  items?: Array<{
    app_id: string;
    app_name?: string;
    workspace_id: string;
    workspace_name?: string;
  }>;
}

/**
 * Resolves the server_url for a given connection_id by looking it up from the
 * records API (/qlik endpoint). The process-space backend requires this field.
 */
async function resolveServerUrl(connectionId: string, authHeader: string): Promise<string | null> {
  try {
    const base = getRecordsApiBaseUrl();
    const res = await fetch(`${base}/qlik`, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
    });
    if (!res.ok) return null;
    const connections: any[] = await res.json();
    if (!Array.isArray(connections)) return null;
    const match = connections.find(
      (c: any) => c.id === connectionId || c.connection_id === connectionId
    );
    return match?.server_url || null;
  } catch (err) {
    console.warn("[process-space] Could not resolve server_url for connection:", connectionId, err);
    return null;
  }
}

/**
 * Runs an entire Qlik space through the records API orchestrator.
 *
 * Proxies `POST {API_BASE_URL}/qlik/process-space`. The endpoint requires
 * both `connection_id` and `server_url` — the latter is resolved here from
 * the saved connection record so callers only need to pass `connection_id`.
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

  // Resolve server_url from the saved connection so we can include it in the
  // payload — the backend requires this field even when connection_id is present.
  let serverUrl: string | null = null;
  if (body.connection_id) {
    serverUrl = await resolveServerUrl(body.connection_id, authHeader!);
  }

  // Seed the server-held refresh token so long runs can renew Fabric/OneLake
  // tokens; never trust one sent by the client.
  const seededRt = req.cookies.get(RT_COOKIE)?.value;
  const payload: Record<string, any> = {
    department_repo: "Qlik_Migrated",
    deployment_type: body.deployment_type || "DIRECT_FABRIC",
    source_type: "qlik",
    site_id: null,
    model: body.model,
    connection_id: body.connection_id,
    ...(serverUrl ? { server_url: serverUrl } : {}),
    ...(Array.isArray(body.items) && body.items.length ? { items: body.items } : {}),
    email: body.email,
    workspace_id: spaceIds,
    ...(body.fabric_group_id ? { fabric_group_id: body.fabric_group_id } : {}),
    ...(seededRt ? { refresh_token: seededRt } : {}),
  };

  try {
    const base = getRecordsApiBaseUrl();
    const res = await fetch(`${base}/qlik/process-space`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader! },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText };
    }

    if (!res.ok) {
      console.error("[API /api/qlik/process-space] Backend error:", res.status, responseText);
      return errorResponse(
        data?.detail || data?.message || "Unable to start the Qlik space migration. Please check your connection and try again.",
        res.status || 502,
      );
    }

    return successResponse(data);
  } catch (err: any) {
    console.error("[API /api/qlik/process-space] Failed:", err?.message ?? err);
    return errorResponse(
      "Unable to start the Qlik space migration. Please check your connection and try again.",
      502,
    );
  }
}
