import { httpClient } from "@/lib/api/httpClient";

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
