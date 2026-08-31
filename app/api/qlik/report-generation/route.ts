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
  // The real Fabric workspace ID (a GUID), distinct from `workspace_id` above
  // which is the Qlik space. Required for the real /tmdl deploy step.
  const fabricGroupId = body.fabric_group_id;

  let reportGenData: any;
  try {
    reportGenData = await httpClient.post<any>(
      "/qlik/report-generation",
      {
        app_id: appId,
        run_id: runId,
        folder_name: folderName,
        workspace_id: spaceId,
        fabric_group_id: fabricGroupId,
        deployment_type: body.deployment_type,
        fabric_access_token: body.fabric_access_token,
        connection_id: connectionId,
      },
      {
        apiType: "semantic",
        headers: { Authorization: authHeader! },
      }
    );
  } catch (err: any) {
    return errorResponse(`Report generation failed: ${err.message}`, err.status || 502);
  }

  try {
    await httpClient.post<any>(
      "/report-generation",
      {
        folder_name: folderName,
        app_id: appId,
        space_id: spaceId,
        app_name: appName,
        run_id: runId,
        connection_id: connectionId,
        report_result: reportGenData,
      },
      {
        apiType: "qlik-mongo",
        headers: { Authorization: authHeader! },
      }
    );
  } catch (err: any) {
    console.warn("[API /api/qlik/report-generation] MongoDB upsert warning:", err.message);
  }

  try {
    await httpClient.patch<any>(
      `/run-history/${encodeURIComponent(folderName)}`,
      {
        folder_name: folderName,
        app_name: appName,
        app_id: appId,
        space_id: spaceId,
        run_id: runId,
        connection_id: connectionId,
        parsing_status: "completed",
        parsing_message: "Parsing successful",
        mapping_status: "completed",
        mapping_message: "Mapping successful",
        assessment_status: "completed",
        assessment_message: "Assessment completed",
        report_generation_status: "completed",
        report_generation_message: "Report generated successfully",
      },
      {
        apiType: "qlik-mongo",
        headers: { Authorization: authHeader! },
      }
    );
  } catch (err: any) {
    console.warn("[API /api/qlik/report-generation] MongoDB run-history patch warning:", err.message);
  }

  await updateSemanticKernelState(runId, "completed", "completed", authHeader);

  return successResponse({
    report_id: `pbi-${folderName}`,
    status: "completed",
    ...reportGenData,
  });
}
