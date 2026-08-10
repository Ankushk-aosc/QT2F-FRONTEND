
import { ApplicationError } from "@/lib/error-handler";
import type { MigrationConfig, MigrationRun, MigrationResults, DashboardStats } from "./dashboard.types";

const fetchWithAuth = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const { getActiveToken } = await import("@/components/providers/MsalProviderWrapper");
  let token: string;
  try {
    token = await getActiveToken();
  } catch (e) {
    throw new ApplicationError("Authentication required.", "AUTH_ERROR", 401);
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status}`;
    try {
      const json = await res.json();
      errMsg = json.error || json.message || errMsg;
    } catch { }
    throw new Error(errMsg);
  }
  return res.json();
}

export class DashboardService {
  async startMigration(config: MigrationConfig): Promise<MigrationRun> {
    return fetchWithAuth<MigrationRun>("/api/migration/start", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async getMigrationStatus(runId: string): Promise<MigrationRun> {
    return fetchWithAuth<MigrationRun>(`/api/migration/status/${runId}`);
  }

  async getMigrationResults(runId: string): Promise<MigrationResults> {
    return fetchWithAuth<MigrationResults>(`/api/migration/results/${runId}`);
  }

  async getMigrationHistory(): Promise<MigrationRun[]> {
    // Assuming /api/migration/history exists, otherwise /api/migration/status
    return fetchWithAuth<MigrationRun[]>("/api/migration/status");
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return fetchWithAuth<DashboardStats>("/api/dashboard/stats");
  }

  async cancelMigration(runId: string): Promise<void> {
    await fetchWithAuth<void>(`/api/migration/status/${runId}/cancel`, {
      method: "POST"
    });
  }
}

export const dashboardService = new DashboardService();