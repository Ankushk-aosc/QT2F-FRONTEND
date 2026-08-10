import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { QlikApp, AssessmentData, ParsedData, MappedData, ReportGenerationData } from "@/types/assessment";

export class QlikService {
  static async getQlikUrl(): Promise<{ server_url: string }> {
    return fetchWithAuth<{ server_url: string }>("/api/qlik/qlik-url");
  }

  static async saveQlikUrl(serverUrl: string): Promise<any> {
    return fetchWithAuth<any>("/api/qlik/qlik-url", {
      method: "POST",
      body: JSON.stringify({ server_url: serverUrl }),
    });
  }

  static async getSpaces(): Promise<{ id: string; name: string }[]> {
    return fetchWithAuth<{ id: string; name: string }[]>("/api/qlik/spaces");
  }

  static async getApps(spaceId: string): Promise<QlikApp[]> {
    return fetchWithAuth<QlikApp[]>(`/api/qlik/apps?spaceId=${encodeURIComponent(spaceId)}`);
  }

  static async unbuild(appId: string, appName: string): Promise<any> {
    return fetchWithAuth<any>("/api/qlik/unbuild", {
      method: "POST",
      body: JSON.stringify({ appId, appName }),
    });
  }

  static async runAssessment(folderName: string): Promise<AssessmentData> {
    return fetchWithAuth<AssessmentData>("/api/qlik/assessment", {
      method: "POST",
      body: JSON.stringify({ folder_name: folderName }),
    });
  }

  static async runParsing(folderName: string): Promise<ParsedData> {
    return fetchWithAuth<ParsedData>("/api/qlik/parsing", {
      method: "POST",
      body: JSON.stringify({ folder_name: folderName }),
    });
  }

  static async runMapping(appId: string, folderName: string): Promise<MappedData> {
    return fetchWithAuth<MappedData>("/api/qlik/mapping", {
      method: "POST",
      body: JSON.stringify({ app_id: appId, folder_name: folderName }),
    });
  }

  static async runReportGeneration(
    appId: string,
    folderName: string,
    workspaceName: string
  ): Promise<ReportGenerationData> {
    return fetchWithAuth<ReportGenerationData>("/api/qlik/report-generation", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        folder_name: folderName,
        workspace_name: workspaceName,
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

  static async getHistoryResults(type: string, folder: string): Promise<any> {
    return fetchWithAuth<any>(
      `/api/qlik/history-results?type=${encodeURIComponent(type)}&folder=${encodeURIComponent(folder)}`
    );
  }
}
