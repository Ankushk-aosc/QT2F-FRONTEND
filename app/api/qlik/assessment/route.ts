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

  // No engine_data pre-fetch here: vl-q2f-assessment fetches Qlik app data
  // itself (QLIK_DATASOURCES_API_URL, server-side) and its request schema
  // has no field to accept caller-supplied data anyway -- confirmed a
  // caller-supplied payload would be silently ignored. connection_id is
  // passed through as-is; if omitted, the semantic-kernel pipeline endpoint
  // resolves a default connection itself.
  const connectionId = body.connection_id;

  // Real assessment: proxied through semantic-kernel, which calls the actual
  // Groq/Azure-powered vl-q2f-assessment agent. No values are synthesized here.
  let assessmentData: any;
  try {
    assessmentData = await httpClient.post<any>(
      "/qlik/assessment",
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
    return errorResponse(`Assessment failed: ${err.message}`, err.status || 502);
  }

  // No separate Mongo write here: vl-q2f-assessment already persists its own
  // result (store_assessment_response, called with the same app_id/
  // workspace_id/run_id vl-q2f-assessment received). A second, independent
  // write from this route used a copy of those same identifiers that could
  // drift from the backend's -- e.g. any normalization the backend applies
  // before storing -- which silently created two divergent records per run
  // instead of one, and was the direct cause of a later mapping-stage
  // lookup finding no precise match and falling back to every historical
  // parsing record for the app (see az-repo-mongodb-vl's find_by_identifier
  // fallback fix). Single writer per stage now.

  await updateSemanticKernelState(runId, "assessment", "in_progress", authHeader);

  return successResponse({
    report_name: appName,
    folder_name: folderName,
    ...assessmentData,
    status: assessmentData?.status === "error" ? "failed" : "completed",
  });
}
