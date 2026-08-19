import { httpClient } from "@/lib/api/httpClient";

export interface QlikExtractedData {
  appId?: string;
  metadata?: any;
  tables?: Record<string, any>;
  dimensions?: any[];
  measures?: any[];
  sheets?: any[];
  connections?: any[];
  relationships?: any[];
  script?: any;
}

/**
 * Fetches real extraction data from Qlik Base Engine if not already provided in the request body.
 */
export async function resolveQlikEngineData(
  appId: string,
  providedEngineData?: any,
  authHeader?: string | null
): Promise<QlikExtractedData> {
  if (
    providedEngineData &&
    (providedEngineData.tables || providedEngineData.metadata || providedEngineData.sheets)
  ) {
    return providedEngineData;
  }

  if (providedEngineData?.data && (providedEngineData.data.tables || providedEngineData.data.metadata)) {
    return providedEngineData.data;
  }

  if (!appId) return {};

  try {
    const res = await httpClient.get<any>(
      `/all/${encodeURIComponent(appId)}?includeRaw=false`,
      {
        apiType: "qlik",
        headers: authHeader ? { Authorization: authHeader } : undefined,
      }
    );
    return res?.data || res || {};
  } catch (err: any) {
    console.warn(`[QlikExtractionHelper] Engine fetch fallback for ${appId}:`, err.message);
    return {};
  }
}

/**
 * Update Semantic Kernel state in MongoDB for unified monitoring.
 */
export async function updateSemanticKernelState(
  runId: string,
  stage: "assessment" | "parsing" | "mapping" | "report_generation" | "completed",
  status: "in_progress" | "completed" | "failed",
  authHeader?: string | null
) {
  try {
    await httpClient.post<any>(
      "/api/records/semantic-kernel",
      {
        run_id: runId,
        type: "semantic_kernel_result",
        status: status,
        total_apps: 1,
        total_migrated: status === "completed" ? 1 : 0,
        total_failed: status === "failed" ? 1 : 0,
        payload: {
          current_stage: stage,
          timestamp: new Date().toISOString(),
        },
      },
      {
        apiType: "qlik-mongo",
        headers: authHeader ? { Authorization: authHeader } : undefined,
      }
    );
  } catch (e) {
    // Non-blocking telemetry
  }
}
