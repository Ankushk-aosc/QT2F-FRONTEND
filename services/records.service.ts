import { fetchWithAuth } from "@/lib/fetchWithAuth";

export interface InteractiveStatus {
  status: boolean;
  id?: string;
  [key: string]: any;
}

export interface RecordsSettings {
  settings?: {
    timezone?: string;
    [key: string]: any;
  };
  timezone?: string;
  [key: string]: any;
}

export interface AzureDevOpsDeploymentSettings {
  id?: string;
  azure_devops_org: string;
  azure_devops_project: string;
  azure_devops_repo: string;
  azure_devops_branch?: string;
  azure_devops_pat?: string;
  token_id?: string;
  updated_at?: string;
}

export interface GitDeploymentSettings {
  id?: string;
  git_org: string;
  git_repo: string;
  git_branch?: string;
  git_pat?: string;
  token_id?: string;
  updated_at?: string;
}

type ApiPayload<T> = T | T[] | { data?: T | T[] };

function normalizeApiPayload<T>(payload: ApiPayload<T> | null | undefined): T {
  if (!payload) {
    return {} as T;
  }

  if (Array.isArray(payload)) {
    return (payload[0] || {}) as T;
  }

  if (typeof payload === "object" && "data" in payload) {
    const nested = payload.data;
    if (Array.isArray(nested)) {
      return (nested[0] || {}) as T;
    }
    return (nested || {}) as T;
  }

  return payload as T;
}

class RecordsService {
  async getInteractiveStatus(): Promise<InteractiveStatus> {
    try {
      const data = await fetchWithAuth<any>("/api/records/interactive-status");
      // Handle array or single object
      if (Array.isArray(data)) {
        return data[0] || { status: false };
      }
      return data;
    } catch (error) {
      // The backend answers 404 "Interactive status not found" when no record
      // has been written yet. That is the not-configured state, not a failure,
      // so report it as the documented default instead of throwing — otherwise
      // it aborts the whole settings load alongside it.
      if (error instanceof Error && /\[404\b/.test(error.message)) {
        console.info("[RecordsService] No interactive status record yet; defaulting to disabled.");
        return { status: false };
      }
      console.error("[RecordsService] getInteractiveStatus error:", error);
      throw error;
    }
  }

  async updateInteractiveStatus(status: boolean): Promise<InteractiveStatus> {
    try {
      const data = await fetchWithAuth<InteractiveStatus>("/api/records/interactive-status", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      return data;
    } catch (error) {
      console.error("[RecordsService] updateInteractiveStatus error:", error);
      throw error;
    }
  }

  async getDataLayerStatus(): Promise<{ status: boolean }> {
    try {
      const data = await fetchWithAuth<any>("/api/records/data-layer-toggle");
      if (Array.isArray(data)) {
        return data[0] || { status: false };
      }
      return data;
    } catch (error) {
      // As with the interactive status, the backend answers 404 ("Running
      // Status not found") until a record exists. That is the default-off
      // state, not a failure.
      if (error instanceof Error && /\[404\b/.test(error.message)) {
        console.info("[RecordsService] No data layer record yet; defaulting to disabled.");
        return { status: false };
      }
      console.error("[RecordsService] getDataLayerStatus error:", error);
      throw error;
    }
  }

  async updateDataLayerStatus(status: boolean): Promise<any> {
    try {
      const data = await fetchWithAuth<any>("/api/records/data-layer-toggle", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      return data;
    } catch (error) {
      console.error("[RecordsService] updateDataLayerStatus error:", error);
      throw error;
    }
  }

  async getDeploymentType(): Promise<{ deployment_type: string }> {
    try {
      const data = await fetchWithAuth<any>("/api/records/deployment_type");
      if (Array.isArray(data)) {
        return data[0] || { deployment_type: "" };
      }
      return data;
    } catch (error) {
      console.error("[RecordsService] getDeploymentType error:", error);
      throw error;
    }
  }

  async updateDeploymentType(type: string): Promise<any> {
    try {
      const data = await fetchWithAuth<any>("/api/records/deployment_type", {
        method: "PATCH",
        body: JSON.stringify({ deployment_type: type }),
      });
      return data;
    } catch (error) {
      console.error("[RecordsService] updateDeploymentType error:", error);
      throw error;
    }
  }

  async getAzureDevOpsDeploymentSettings(): Promise<AzureDevOpsDeploymentSettings> {
    try {
      const data = await fetchWithAuth<ApiPayload<AzureDevOpsDeploymentSettings>>("/api/records/deployment/azure-devops");
      return normalizeApiPayload<AzureDevOpsDeploymentSettings>(data);
    } catch (error) {
      console.error("[RecordsService] getAzureDevOpsDeploymentSettings error:", error);
      throw error;
    }
  }

  async saveAzureDevOpsDeploymentSettings(settings: AzureDevOpsDeploymentSettings): Promise<AzureDevOpsDeploymentSettings> {
    try {
      const data = await fetchWithAuth<AzureDevOpsDeploymentSettings>("/api/records/deployment/azure-devops", {
        method: "POST",
        body: JSON.stringify(settings),
      });
      return data;
    } catch (error) {
      console.error("[RecordsService] saveAzureDevOpsDeploymentSettings error:", error);
      throw error;
    }
  }

  async getGitDeploymentSettings(): Promise<GitDeploymentSettings> {
    try {
      const data = await fetchWithAuth<ApiPayload<GitDeploymentSettings>>("/api/records/deployment/git");
      return normalizeApiPayload<GitDeploymentSettings>(data);
    } catch (error) {
      console.error("[RecordsService] getGitDeploymentSettings error:", error);
      throw error;
    }
  }

  async saveGitDeploymentSettings(settings: GitDeploymentSettings): Promise<GitDeploymentSettings> {
    try {
      const data = await fetchWithAuth<GitDeploymentSettings>("/api/records/deployment/git", {
        method: "POST",
        body: JSON.stringify(settings),
      });
      return data;
    } catch (error) {
      console.error("[RecordsService] saveGitDeploymentSettings error:", error);
      throw error;
    }
  }

  async getSettings(): Promise<RecordsSettings> {
    try {
      const data = await fetchWithAuth<any>("/api/records/settings");
      if (Array.isArray(data)) {
        return data[0] || {};
      }
      return data || {};
    } catch (error) {
      console.error("[RecordsService] getSettings error:", error);
      throw error;
    }
  }

  async updateTimezone(timezone: string): Promise<RecordsSettings> {
    try {
      const data = await fetchWithAuth<RecordsSettings>("/api/records/settings/timezone", {
        method: "PATCH",
        body: JSON.stringify({ timezone }),
      });
      return data;
    } catch (error) {
      console.error("[RecordsService] updateTimezone error:", error);
      throw error;
    }
  }

  async resumeMigration(runId: string): Promise<any> {
    try {
      // ── Force-refresh ALL three tokens so resume-run never reuses cached invoke-batch tokens ──
      let fabricToken: string | undefined;

      try {
        const { getFabricToken, getActiveToken } = await import(
          "@/components/providers/MsalProviderWrapper"
        );
        // forceRefresh=true bypasses MSAL cache and always gets a brand-new token from Azure AD
        [fabricToken] = await Promise.all([
          getFabricToken(true),
        ]);
        // Also force-refresh the bearer token so the Authorization header is a new JWT too
        await getActiveToken(true);
        console.log("[RecordsService] All tokens force-refreshed for resume-run (bearer, fabric)");
      } catch (tokenErr) {
        console.warn("[RecordsService] Token force-refresh failed, falling back to sessionStorage", tokenErr);
        fabricToken = sessionStorage.getItem("fabric_access_token") ?? undefined;
      }

      const data = await fetchWithAuth<any>("/api/migration/resume", {
        method: "POST",
        body: JSON.stringify({
          run_id: runId,
          fabric_access_token: fabricToken,
        }),
      });
      return data;
    } catch (error) {
      console.error("[RecordsService] resumeMigration error:", error);
      throw error;
    }
  }
}

export const recordsService = new RecordsService();
