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

  const appId = body.app_id || "app-1";
  const spaceId = body.workspace_id || body.space_id || "personal";
  const runId = body.run_id;
  const connectionId = body.connection_id;
  const lakehouseId = body.lakehouse_id;

  if (!lakehouseId) {
    return errorResponse(
      "lakehouse_id is required to validate the migrated data against a Fabric Lakehouse.",
      400
    );
  }

  let validationData: any;
  try {
    validationData = await httpClient.post<any>(
      "/qlik/validation",
      {
        app_id: appId,
        run_id: runId,
        workspace_id: spaceId,
        lakehouse_id: lakehouseId,
        connection_id: connectionId,
      },
      {
        apiType: "semantic",
        headers: { Authorization: authHeader! },
      }
    );
  } catch (err: any) {
    return errorResponse(`Validation failed: ${err.message}`, err.status || 502);
  }

  try {
    await httpClient.post<any>(
      "/validation",
      {
        app_id: appId,
        space_id: spaceId,
        run_id: runId,
        connection_id: connectionId,
        validation_result: validationData,
      },
      {
        apiType: "qlik-mongo",
        headers: { Authorization: authHeader! },
      }
    );
  } catch (err: any) {
    console.warn("[API /api/qlik/validation] MongoDB upsert warning:", err.message);
  }

  return successResponse({
    status: validationData?.status || "success",
    ...validationData,
  });
}
