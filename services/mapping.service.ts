
import { ApplicationError } from "@/lib/error-handler";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

// Types
export interface MappingResult {
  workbook_id: string;
  workbook_name: string;
  project_id: string;
  run_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  [key: string]: any;
}

export interface MappingRunStatus {
  run_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  total_workbooks: number;
  completed_workbooks: number;
  failed_workbooks: number;
  progress_percentage: number;
  results: MappingResult[];
  started_at: string;
  completed_at?: string;
  error?: string;
}



class MappingService {
  async startBatchMapping(
    workbooks: Array<{ project_id: string; workbook_id: string }>,
    userEmail: string
  ): Promise<{ run_id: string }> {
    if (!userEmail?.trim() || !userEmail.includes("@")) {
      throw new ApplicationError("Valid email is required", "VALIDATION_ERROR", 400);
    }

    if (!workbooks?.length) {
      throw new ApplicationError("At least one workbook is required", "VALIDATION_ERROR", 400);
    }

    return await fetchWithAuth<{ run_id: string }>("/api/mapping", {
      method: "POST",
      body: JSON.stringify({ items: workbooks, user_email: userEmail })
    });
  }

  async getRunStatus(runId: string): Promise<MappingRunStatus> {
    if (!runId?.trim()) {
      throw new ApplicationError("Run ID is required", "VALIDATION_ERROR", 400);
    }

    const params = new URLSearchParams({ run_id: runId });
    const response = await fetchWithAuth<any>(`/api/mapping?${params.toString()}`);

    const logs = response.data || response;

    const results = Array.isArray(logs)
      ? logs.map(transformLogToResult).filter((r): r is MappingResult => !!r)
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
  ): Promise<MappingResult | null> {
    const params = new URLSearchParams({
      project_id: projectId,
      workbook_id: workbookId,
      run_id: runId,
    });

    const response = await fetchWithAuth<any>(`/api/mapping?${params.toString()}`);
    const data = response.data || response;

    if (!data) return null;
    
    // Always attempt transformation rather than prematurely returning null
    const result = Array.isArray(data) && data.length > 0 ? transformLogToResult(data[0]) : transformLogToResult(data);
    
    // Fallback: If transform logic still struggled, but data exists, force it through
    if (!result && Object.keys(data).length > 0) {
      return { ...data, workbook_id: workbookId, status: "completed" };
    }
    
    return result;
  }

  async cancelRun(runId: string): Promise<{ success: boolean; message: string }> {
    return await fetchWithAuth<{ success: boolean; message: string }>(
      `/api/mapping/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ run_id: runId })
      }
    );
  }
}

export const mappingService = new MappingService();

// Helpers
function transformLogToResult(log: any): MappingResult | null {
  if (!log) return null;
  const payload = log.payload || log.data || log;
  
  // We cannot reject entirely if workbook_id is missing, since raw Mapping results might not have it at the top level
  if (Object.keys(payload).length === 0) return null;
  
  return {
    ...payload,
    workbook_id: payload.workbook_id || payload.workbook || log.workbook_id || "unknown",
    status: payload.status || log.status || "completed"
  };
}

function determineOverallStatus(c: number, f: number, t: number): MappingRunStatus["status"] {
  if (c + f === 0) return "pending";
  if (c + f < t) return "processing";
  if (f > 0 && c === 0) return "failed";
  return "completed";
}