import { NextRequest } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { requireAuth, successResponse, errorResponse } from "@/lib/api/routeHelpers";
import { updateSemanticKernelState } from "@/lib/qlikExtractionHelper";

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

  const appName = body.app_name || "Qlik Application";
  const folderName = body.folder_name || body.run_id || `${appName.replace(/\s+/g, "_")}_run`;
  const appId = body.app_id || "app-1";
  const spaceId = body.workspace_id || body.space_id || "personal";
  const runId = body.run_id || folderName;
  const connectionId = body.connection_id;

  // Real mapping: proxied through semantic-kernel to the actual vl-q2f-mapping
  // agent. vl-q2f-mapping re-fetches the parsing output it needs by
  // app_id/workspace_id/run_id itself, so the parsing stage must have
  // completed and been stored before this call.
  let mappedData: any;
  try {
    mappedData = await httpClient.post<any>(
      "/qlik/mapping",
      {
        app_id: appId,
        run_id: runId,
        workspace_id: spaceId,
        connection_id: connectionId,
      },
      {
        apiType: "semantic",
        headers: { Authorization: authHeader! },
      }
    );
  } catch (err: any) {
    return errorResponse(`Mapping failed: ${err.message}`, err.status || 502);
  }

  // No separate Mongo write here: vl-q2f-mapping already persists its own
  // result (store_mapping_response). Same reasoning as assessment/parsing --
  // a second independent writer using a copy of the identifiers risked
  // diverging from the backend's own record instead of matching it exactly.

  await updateSemanticKernelState(runId, "mapping", "in_progress", authHeader);

  return successResponse({
    status: mappedData?.status || "success",
    ...mappedData,
  });
}
