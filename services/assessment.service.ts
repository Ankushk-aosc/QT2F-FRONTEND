
import { ApplicationError, logError, parseError } from "@/lib/error-handler";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

// Types
export interface AssessmentResult {
  workbook_id: string;
  workbook_name: string;
  project_id: string;
  run_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at?: string;
  last_modified_at?: string;
  message?: string;
  error?: string;
  [key: string]: any;
}

export interface RunStatus {
  run_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  total_workbooks: number;
  completed_workbooks: number;
  failed_workbooks: number;
  progress_percentage: number;
  results: AssessmentResult[];
  started_at: string;
  completed_at?: string;
  error?: string;
}



class AssessmentService {
  async getRunStatus(runId: string): Promise<RunStatus> {
    if (!runId?.trim()) {
      throw new ApplicationError("Run ID is required", "VALIDATION_ERROR", 400);
    }

    const params = new URLSearchParams({ run_id: runId });
    const response = await fetchWithAuth<any>(`/api/assessment?${params.toString()}`);

    // Transform logs to result if needed
    const logs = response.data || response; // Handle wrapped or unwrapped

    // If response is already in RunStatus format:
    if (logs.status && logs.results) return logs as RunStatus;

    // Manual transform if backend returns raw logs (assuming legacy behavior support)
    const results = Array.isArray(logs)
      ? logs.map(transformLogToResult).filter((r): r is AssessmentResult => !!r)
      : [];

    const completed = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const total = results.length;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    return {
      run_id: runId,
      status: determineOverallStatus(completed, failed, total),
      total_workbooks: total,
      completed_workbooks: completed,
      failed_workbooks: failed,
      progress_percentage: Math.round(progress),
      results,
      started_at: results[0]?.created_at || new Date().toISOString(),
      completed_at: completed === total ? new Date().toISOString() : undefined,
    };
  }

  async getWorkbookResult(
    projectId: string,
    workbookId: string,
    runId: string
  ): Promise<AssessmentResult | null> {
    const params = new URLSearchParams({
      project_id: projectId,
      workbook_id: workbookId,
      run_id: runId,
    });

    // The endpoint might return a list of logs or a specific result
    const response = await fetchWithAuth<any>(`/api/assessment?${params.toString()}`);
    const data = response.data || response;

    if (Array.isArray(data) && data.length > 0) return transformLogToResult(data[0]);
    if (data?.payload) return transformLogToResult(data);
    return null;
  }

  async cancelRun(runId: string): Promise<{ success: boolean; message: string }> {
    return await fetchWithAuth<{ success: boolean; message: string }>(
      `/api/assessment/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ run_id: runId })
      }
    );
  }
}

export const assessmentService = new AssessmentService();

// Helpers
function transformLogToResult(log: any): AssessmentResult | null {
  const payload = log?.payload || log?.data || log || {};
  if (!payload.workbook_id) return null;
  // Basic transform, expanded properties can be added if needed
  return {
    ...payload,
    workbook_id: payload.workbook_id,
    status: payload.status || "completed"
  };
}

function determineOverallStatus(c: number, f: number, t: number): RunStatus["status"] {
  if (c + f === 0) return "pending";
  if (c + f < t) return "processing";
  if (f > 0 && c === 0) return "failed";
  return "completed";
}