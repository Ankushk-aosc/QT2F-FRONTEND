
import { ApplicationError } from "@/lib/error-handler";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

// Types
export interface ParsingResult {
  workbook_id: string;
  workbook_name: string;
  project_id: string;
  run_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  [key: string]: any;
}

export interface ParsingRunStatus {
  run_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  total_workbooks: number;
  completed_workbooks: number;
  failed_workbooks: number;
  progress_percentage: number;
  results: ParsingResult[];
  started_at: string;
  completed_at?: string;
  error?: string;
}



class ParsingService {
  async getRunStatus(runId: string): Promise<ParsingRunStatus> {
    if (!runId?.trim()) {
      throw new ApplicationError("Run ID is required", "VALIDATION_ERROR", 400);
    }

    const params = new URLSearchParams({ run_id: runId });
    const response = await fetchWithAuth<any>(`/api/parsing?${params.toString()}`);

    const logs = response.data || response;

    // Transform logs to result if needed
    // Manual transform if backend returns raw logs
    const results = Array.isArray(logs)
      ? logs.map(transformLogToResult).filter((r): r is ParsingResult => !!r)
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
  ): Promise<ParsingResult | null> {
    const params = new URLSearchParams({
      project_id: projectId,
      workbook_id: workbookId,
      run_id: runId,
    });

    const response = await fetchWithAuth<any>(`/api/parsing?${params.toString()}`);
    const data = response.data || response;

    if (Array.isArray(data) && data.length > 0) return transformLogToResult(data[0]);
    if (data?.payload) return transformLogToResult(data);
    return null;
  }

  async cancelRun(runId: string): Promise<{ success: boolean; message: string }> {
    return await fetchWithAuth<{ success: boolean; message: string }>(
      `/api/parsing/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ run_id: runId })
      }
    );
  }
}

export const parsingService = new ParsingService();

// Helpers
function transformLogToResult(log: any): ParsingResult | null {
  if (!log) return null;

  // Potential data containers
  const payload = log.payload || log.data || {};
  const metadata = payload.metadata || log.metadata || {};

  // Try to find workbook_id in various possible locations
  const workbookId =
    payload.workbook_id ||
    metadata.workbook_id ||
    log.workbook_id ||
    log.id; // Fallback to root ID if others missing

  if (!workbookId) return null;

  return {
    ...log,       // Include root fields (project_name, status, etc.)
    ...payload,   // Include payload fields (metadata, sources, etc.)
    workbook_id: workbookId,
    status: payload.status || log.status || "completed"
  };
}

function determineOverallStatus(c: number, f: number, t: number): ParsingRunStatus["status"] {
  if (c + f === 0) return "pending";
  if (c + f < t) return "processing";
  if (f > 0 && c === 0) return "failed";
  return "completed";
}