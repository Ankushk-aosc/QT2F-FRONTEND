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

  // No engine_data pre-fetch: vl-q2f-parsing fetches Qlik app data itself
  // (Config.QLIK_API_URL, server-side) and its request schema has no field
  // for caller-supplied data.
  const connectionId = body.connection_id;

  // Real parsing: proxied through semantic-kernel to the actual vl-q2f-parsing agent.
  let parsedData: any;
  try {
    parsedData = await httpClient.post<any>(
      "/qlik/parsing",
      {
        app_id: appId,
        run_id: runId,
        folder_name: folderName,
        workspace_id: spaceId,
        connection_id: connectionId,
      },
      {
        apiType: "semantic",
        headers: { Authorization: authHeader! },
      }
    );
  } catch (err: any) {
    return errorResponse(`Parsing failed: ${err.message}`, err.status || 502);
  }

  // No separate Mongo write here: vl-q2f-parsing already persists its own
  // result (store_parsing_response) using the same identifiers it received.
  // A second, independent write from this route was a duplicate that could
  // silently diverge from the backend's own record -- exactly what caused a
  // later mapping-stage lookup to find no precise (app_id + workspace_id +
  // run_id) match and fall back to every historical parsing record for the
  // app instead. Single writer per stage now.

  await updateSemanticKernelState(runId, "parsing", "in_progress", authHeader);

  return successResponse({
    file_name: appName,
    folder: folderName,
    parsing_status: "success",
    ...parsedData,
  });
}
