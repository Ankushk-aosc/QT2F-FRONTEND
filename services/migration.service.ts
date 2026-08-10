import { ApplicationError, parseError, logError } from "@/lib/error-handler";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

// Types
export interface MigrationItem {
  project_id: string;
  workbook_id: string;
}

export interface InvokeBatchResponse {
  run_id: string;
  message: string;
  assessment_summary?: string;
  run_no?: string | number;
}

export interface MigrationStatus {
  run_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  total_items: number;
  completed_items: number;
  failed_items: number;
  progress_percentage: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}



class MigrationService {

  async checkHealth(): Promise<{ status: string; message?: string }> {
    try {
      return await fetchWithAuth<{ status: string; message?: string }>("/api/migration/health");
    } catch (error: unknown) {
      const parsed = parseError(error);
      throw new ApplicationError(parsed.message, parsed.code, parsed.status);
    }
  }

  async invokeBatch(
    items: MigrationItem[],
    userEmail: string
  ): Promise<InvokeBatchResponse> {
    try {
      if (!userEmail || !userEmail.trim()) {
        throw new ApplicationError("User email is required", "VALIDATION_ERROR", 400);
      }
      if (!items || items.length === 0) {
        throw new ApplicationError("At least one workbook must be selected", "VALIDATION_ERROR", 400);
      }

      return await fetchWithAuth<InvokeBatchResponse>("/api/migration/invoke-batch", {
        method: "POST",
        body: JSON.stringify({ email: userEmail, items })
      });

    } catch (error: any) {
      const parsed = parseError(error);
      logError('Migration Service - Invoke Batch', parsed);
      throw new ApplicationError(parsed.message, parsed.code, parsed.status, parsed.details);
    }
  }

  async getStatus(runId: string): Promise<MigrationStatus> {
    try {
      if (!runId) throw new ApplicationError("Run ID is required", "VALIDATION_ERROR", 400);
      return await fetchWithAuth<MigrationStatus>(`/api/migration/status/${runId}`);
    } catch (error: unknown) {
      const parsed = parseError(error);
      throw new ApplicationError(parsed.message, parsed.code, parsed.status);
    }
  }

  async getResults(runId: string): Promise<any> {
    try {
      if (!runId) throw new ApplicationError("Run ID is required", "VALIDATION_ERROR", 400);
      return await fetchWithAuth<any>(`/api/migration/results/${runId}`);
    } catch (error: unknown) {
      const parsed = parseError(error);
      throw new ApplicationError(parsed.message, parsed.code, parsed.status);
    }
  }

  async cancelRun(runId: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!runId) throw new ApplicationError("Run ID is required", "VALIDATION_ERROR", 400);
      return await fetchWithAuth<{ success: boolean; message: string }>(`/api/migration/cancel/${runId}`, {
        method: "POST"
      });
    } catch (error: unknown) {
      const parsed = parseError(error);
      throw new ApplicationError(parsed.message, parsed.code, parsed.status);
    }
  }
}

export const migrationService = new MigrationService();

export function isStatusActive(status: MigrationStatus["status"]): boolean {
  return status === "pending" || status === "processing";
}

export function isStatusComplete(status: MigrationStatus["status"]): boolean {
  return ["completed", "failed", "cancelled"].includes(status);
}