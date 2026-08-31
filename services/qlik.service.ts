import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  AssessmentData,
  MappedData,
  ParsedData,
  ReportGenerationData,
} from "@/types/assessment";

export interface QlikCredentials {
  CONNECTION_NAME?: string;
  QLIK_TENANT_URL: string;
  QLIK_API_KEY?: string;
  ENV_TYPE?: string;
  connection_id?: string;
}

export type QLIKCredentials = QlikCredentials;

export class QlikService {
  async initializeConnection(env: string = "cloud"): Promise<QlikCredentials[]> {
    try {
      const query = env ? `?env_type=${encodeURIComponent(env)}` : "";
      const response = await fetchWithAuth<any>(`/api/qlik/connections${query}`);
      const connections: any[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.connections)
          ? response.connections
          : Array.isArray(response?.data)
            ? response.data
            : [];

      return connections.map((c: any) => ({
        CONNECTION_NAME: c.connection_name || c.CONNECTION_NAME || "",
        QLIK_TENANT_URL: c.qlik_tenant_url || c.QLIK_TENANT_URL || c.server_url || "",
        QLIK_API_KEY: c.api_key || c.API_KEY || "",
        ENV_TYPE: c.env_type || c.ENV_TYPE || env,
        connection_id: c.id || c.connection_id || "",
      }));
    } catch (e) {
      console.warn("[QlikService] Connections endpoint failed:", e);
    }
    return [];
  }

  async storeQlikUrl(creds: QlikCredentials, env?: string): Promise<void> {
    const payload: Record<string, string> = {
      env_type: env || creds.ENV_TYPE || "cloud",
      connection_name: creds.CONNECTION_NAME || "",
      qlik_tenant_url: creds.QLIK_TENANT_URL,
    };
    if (creds.QLIK_API_KEY) {
      payload.api_key = creds.QLIK_API_KEY;
    }

    if (creds.connection_id) {
      await fetchWithAuth(`/api/qlik/connections/${creds.connection_id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await fetchWithAuth("/api/qlik/connections", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
  }

  async storeQLIKUrl(creds: QlikCredentials, env?: string): Promise<void> {
    return this.storeQlikUrl(creds, env);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    await fetchWithAuth(`/api/qlik/connections/${connectionId}`, {
      method: "DELETE",
    });
  }

  static async getSpaces(connectionId?: string): Promise<any[]> {
    const query = connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : "";
    return fetchWithAuth<any[]>(`/api/qlik/spaces${query}`);
  }

  static async getApps(spaceId: string, connectionId?: string): Promise<any[]> {
    const query = new URLSearchParams({ spaceId });
    if (connectionId) query.set("connection_id", connectionId);
    return fetchWithAuth<any[]>(`/api/qlik/apps?${query.toString()}`);
  }

  static async runAssessment(
    appId: string,
    runId: string,
    workspaceId: string,
    appName?: string,
    connectionId?: string
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
        connection_id: connectionId,
      }),
    });
  }

  static async runParsing(
    appId: string,
    runId: string,
    workspaceId: string,
    appName?: string,
    connectionId?: string
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
        connection_id: connectionId,
      }),
    });
  }

  static async runMapping(
    appId: string,
    runId: string,
    workspaceId: string,
    appName?: string,
    connectionId?: string
  ): Promise<MappedData> {
    return fetchWithAuth<MappedData>("/api/qlik/mapping", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        run_id: runId,
        folder_name: runId,
        workspace_id: workspaceId,
        source_type: "qlik",
        app_name: appName || "Qlik App",
        connection_id: connectionId,
      }),
    });
  }

  static async runReportGeneration(
    appId: string,
    runId: string,
    workspaceId: string,
    appName?: string,
    connectionId?: string,
    fabricGroupId?: string,
    deploymentType?: string
  ): Promise<ReportGenerationData> {
    return fetchWithAuth<ReportGenerationData>("/api/qlik/report-generation", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        run_id: runId,
        folder_name: runId,
        workspace_id: workspaceId,
        source_type: "qlik",
        app_name: appName || "Qlik App",
        connection_id: connectionId,
        fabric_group_id: fabricGroupId,
        deployment_type: deploymentType,
      }),
    });
  }

  static async runValidation(
    appId: string,
    runId: string,
    workspaceId: string,
    lakehouseId: string,
    connectionId?: string
  ): Promise<any> {
    return fetchWithAuth<any>("/api/qlik/validation", {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        run_id: runId,
        workspace_id: workspaceId,
        lakehouse_id: lakehouseId,
        connection_id: connectionId,
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

export const qlikService = new QlikService();
export const QLIKServiceInstance = qlikService;
