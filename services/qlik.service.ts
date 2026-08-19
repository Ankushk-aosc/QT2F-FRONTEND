import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  AssessmentData,
  MappedData,
  ParsedData,
  ReportGenerationData,
} from "@/types/assessment";

export class QlikService {
  static async getSpaces(): Promise<any[]> {
    return fetchWithAuth<any[]>("/api/qlik/spaces");
  }

  static async getApps(spaceId: string): Promise<any[]> {
    return fetchWithAuth<any[]>(`/api/qlik/apps?spaceId=${encodeURIComponent(spaceId)}`);
  }

  static async unbuild(appId: string, appName: string): Promise<any> {
    return fetchWithAuth<any>("/api/qlik/unbuild", {
      method: "POST",
      body: JSON.stringify({ appId, appName }),
    });
  }

  static async runAssessment(
    appId: string,
    runId: string,
    workspaceId: string,
    appName?: string,
    engineData?: any
  ): Promise<AssessmentData> {
    return fetchWithAuth<AssessmentData>("/api/qlik/assessment", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        run_id: runId,
        folder_name: runId,
        workspace_id: workspaceId,
        source_type: "qlik",
        app_name: appName || "Qlik App",
        engine_data: engineData,
      }),
    });
  }

  static async runParsing(
    appId: string,
    runId: string,
    workspaceId: string,
    appName?: string,
    engineData?: any
  ): Promise<ParsedData> {
    return fetchWithAuth<ParsedData>("/api/qlik/parsing", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        run_id: runId,
        folder_name: runId,
        workspace_id: workspaceId,
        source_type: "qlik",
        app_name: appName || "Qlik App",
        engine_data: engineData,
      }),
    });
  }

  static async runMapping(
    appId: string,
    folderName: string,
    workspaceId?: string,
    appName?: string,
    engineData?: any
  ): Promise<MappedData> {
    return fetchWithAuth<MappedData>("/api/qlik/mapping", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        folder_name: folderName,
        run_id: folderName,
        space_id: workspaceId || "personal",
        app_name: appName || "Qlik App",
        engine_data: engineData,
      }),
    });
  }

  static async runReportGeneration(
    appId: string,
    folderName: string,
    workspaceName: string,
    appName?: string,
    engineData?: any
  ): Promise<ReportGenerationData> {
    return fetchWithAuth<ReportGenerationData>("/api/qlik/report-generation", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        folder_name: folderName,
        run_id: folderName,
        workspace_name: workspaceName,
        space_id: "personal",
        app_name: appName || "Qlik App",
        engine_data: engineData,
      }),
    });
  }

  static async getAgentActions(folderName: string, agentName: string): Promise<any[]> {
    return fetchWithAuth<any[]>(
      `/api/qlik/agent-actions?folderName=${encodeURIComponent(folderName)}&agentName=${encodeURIComponent(agentName)}`
    );
  }

  static async getHistory(email: string, page = 1, limit = 10): Promise<any> {
    return fetchWithAuth<any>(
      `/api/qlik/history?email=${encodeURIComponent(email)}&page=${page}&limit=${limit}`
    );
  }

  static async getHistoryByFolder(folderName: string): Promise<any> {
    return fetchWithAuth<any>(
      `/api/qlik/history-by-folder?folder=${encodeURIComponent(folderName)}`
    );
  }
}
