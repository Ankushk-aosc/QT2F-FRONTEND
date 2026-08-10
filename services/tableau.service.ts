
// Updated file: services/tableau.service.ts
// Now uses /api/tableau/connections for credential management


import { ApplicationError } from "@/lib/error-handler";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export interface TableauCredentials {
  CONNECTION_NAME?: string;
  TABLEAU_SERVER_URL: string;
  TABLEAU_SITE_NAME: string;
  TABLEAU_TOKEN_NAME: string;
  TABLEAU_TOKEN_VALUE?: string;
  TCM_BASE_URL?: string;
  TCM_TOKEN_SECRET?: string;
  PROJECT_ID?: string;
  connection_id?: string;  // NEW: Key Vault connection identifier
}

export interface Project {
  id: string;
  name: string;
  description?: string;
}

export interface Site {
  id: string;
  name: string;
}

export interface Workbook {
  id: string;
  name: string;
  project_id: string;
}

export interface TableauDetailsPayload {
  tableau_server_url: string;
  tableau_site_name: string;
  tableau_token_name?: string;
  email: string;
}

export interface GetWorkbooksPayload {
  tableau_server_url: string;
  tableau_site_name: string;
  tableau_token_name?: string;
  project_id: string | string[];
  email: string;
}
 
class TableauService {
  private siteName: string = "";
  private tokenName: string = "TableauToken";
  private projectId: string = "";

  setCredentials(siteName: string, tokenName: string, projectId: string = "") {
    this.siteName = siteName;
    this.tokenName = tokenName;
    this.projectId = projectId;
  }

  /**
   * Fetch all saved connections for the given environment.
   * Returns an array of credential metadata (no secrets).
   */
  async initializeConnection(env: "cloud" | "server" | "cloud_trial" = "cloud"): Promise<TableauCredentials[]> {
    // Try new connections endpoint first
    try {
      const connections = await fetchWithAuth<any[]>(`/api/tableau/connections?env_type=${env}`);
      if (connections && connections.length > 0) {
        const mapped = connections.map((c: any) => ({
          CONNECTION_NAME: c.connection_name || c.CONNECTION_NAME || "",
          TABLEAU_SERVER_URL: c.tableau_server_url || c.TABLEAU_SERVER_URL || "",
          TABLEAU_SITE_NAME: c.tableau_site_name || c.TABLEAU_SITE_NAME || "",
          TABLEAU_TOKEN_NAME: c.tableau_token_name || c.TABLEAU_TOKEN_NAME || "TableauToken",
          TCM_BASE_URL: c.tcm_base_url || c.TCM_BASE_URL || "",
          connection_id: c.id || c.connection_id || "",
        }));
        if (mapped.length > 0) {
          const first = mapped[0];
          this.siteName = first.TABLEAU_SITE_NAME || "";
          this.tokenName = first.TABLEAU_TOKEN_NAME || "TableauToken";
        }
        return mapped;
      }
    } catch (e) {
      console.warn("[TableauService] Connections endpoint failed, falling back to legacy:", e);
    }

    // Fallback to legacy endpoint
    const creds = await fetchWithAuth<TableauCredentials[]>("/api/tableau/get-tableau-url", {
      headers: { "x-tableau-environment": env }
    });
    if (creds && creds.length > 0) {
      const first = creds[0];
      this.siteName = first.TABLEAU_SITE_NAME || "";
      this.tokenName = first.TABLEAU_TOKEN_NAME || "TableauToken";
    }
    return creds;
  }

  async getSites(tcmBaseUrl: string, env: "cloud" | "server" | "cloud_trial" = "cloud", creds?: TableauCredentials): Promise<Site[]> {
    // Cloud Trial: no TCM, no site listing — user provides site name directly
    if (env === "cloud_trial") {
      return []; // No sites to list; user enters site name manually
    }

    const endpoint = env === "server" ? "/api/tableau/server-sites" : "/api/tableau/get-all-tenant-sites";
    const method = "POST";
    
    const isCloudURL = creds?.TABLEAU_SERVER_URL?.includes("online.tableau.com") || creds?.TABLEAU_SERVER_URL?.includes("tableau.com");
    
    const body: any = env === "server" ? {
      TABLEAU_SERVER_URL: (!isCloudURL && creds?.TABLEAU_SERVER_URL) ? creds.TABLEAU_SERVER_URL : "",
      TABLEAU_SITE_NAME: creds?.TABLEAU_SITE_NAME || "",
      action: "get_sites"
    } : { 
      tcm_base_url: tcmBaseUrl
    };

    if (creds?.connection_id) {
      body.connection_id = creds.connection_id;
    } else {
      if (env === "server") {
        body.TABLEAU_TOKEN_NAME = creds?.TABLEAU_TOKEN_NAME || "TableauToken";
        body.TABLEAU_TOKEN_VALUE = creds?.TABLEAU_TOKEN_VALUE || "";
      } else {
        body.tcm_token_secret = creds?.TCM_TOKEN_SECRET || "";
      }
    }
    const data = await fetchWithAuth<any>(endpoint, {
      method,
      headers: { "x-tableau-environment": env },
      body: JSON.stringify(body)
    });
    
    const sitesArr = data.sites || (Array.isArray(data) ? data : []);
    return sitesArr.map((s: any) => ({
      id: s.id || s.site_id || s.siteId || "",
      name: s.name || s.site_name || s.contentUrl || ""
    }));
  }

  async getProjects(serverUrl: string, email: string, siteName: string, env: "cloud" | "server" | "cloud_trial" = "cloud", creds?: TableauCredentials, siteId?: string, folderName?: string, groupId?: string): Promise<Project[]> {
    const effectiveEnv = env === "cloud_trial" ? "cloud" : env;
    const endpoint = effectiveEnv === "server" ? "/api/tableau/server-projects" : "/api/tableau/propagate-tableau-details";
    const isCloudURL = creds?.TABLEAU_SERVER_URL?.includes("online.tableau.com") || creds?.TABLEAU_SERVER_URL?.includes("tableau.com");

    const payload: any = effectiveEnv === "server" ? {
      TABLEAU_SERVER_URL: isCloudURL ? "" : serverUrl,
      site_id: siteId || ""
    } : {
      tableau_server_url: serverUrl,
      tableau_site_name: siteName,
      email: email,
      site_id: siteId || "",
      source_type: "cloud",
      project_id: creds?.PROJECT_ID || "",
      folder_name: folderName || "",
      group_id: groupId || ""
    };

    if (creds?.connection_id) {
      payload.connection_id = creds.connection_id;
    } else {
      const tName = creds?.TABLEAU_TOKEN_NAME || "TableauToken";
      const tValue = creds?.TABLEAU_TOKEN_VALUE;
      if (effectiveEnv === "server") {
        payload.TABLEAU_TOKEN_NAME = tName;
        if (tValue) payload.TABLEAU_TOKEN_VALUE = tValue;
      } else {
        payload.tableau_token_name = tName;
        if (tValue) payload.tableau_token_value = tValue;
      }
    }

    const data = await fetchWithAuth<any>(endpoint, {
      method: "POST",
      headers: { "x-tableau-environment": effectiveEnv },
      body: JSON.stringify(payload)
    });
    const projectsArr = data.projects || data.data?.projects || (Array.isArray(data) ? data : []);
    return projectsArr.map((p: any) => ({
      id: p.id || p.project_id || "",
      name: p.name || p.project_name || "",
      description: p.description
    }));
  }

  async getWorkbooksForProject(serverUrl: string, projectId: string, email: string, siteName: string, env: "cloud" | "server" | "cloud_trial" = "cloud", creds?: TableauCredentials, siteId?: string): Promise<Workbook[]> {
    const effectiveEnv = env === "cloud_trial" ? "cloud" : env;
    const endpoint = effectiveEnv === "server" ? "/api/tableau/server-workbooks" : "/api/tableau/workbooks";
    const isCloudURL = creds?.TABLEAU_SERVER_URL?.includes("online.tableau.com") || creds?.TABLEAU_SERVER_URL?.includes("tableau.com");

    const payload: any = effectiveEnv === "server" ? {
      TABLEAU_SERVER_URL: isCloudURL ? "" : serverUrl,
      site_id: siteId || "",
      project_id: projectId
    } : {
      tableau_server_url: serverUrl,
      tableau_site_name: siteName,
      project_id: projectId,
      email: email
    };

    if (creds?.connection_id) {
      payload.connection_id = creds.connection_id;
    } else {
      const tName = creds?.TABLEAU_TOKEN_NAME || "TableauToken";
      const tValue = creds?.TABLEAU_TOKEN_VALUE;
      if (effectiveEnv === "server") {
        payload.TABLEAU_TOKEN_NAME = tName;
        if (tValue) payload.TABLEAU_TOKEN_VALUE = tValue;
      } else {
        payload.tableau_token_name = tName;
        if (tValue) payload.tableau_token_value = tValue;
      }
    }

    const data = await fetchWithAuth<any>(endpoint, {
      method: "POST",
      headers: { "x-tableau-environment": effectiveEnv },
      body: JSON.stringify(payload)
    });
    const workbooksArr = data.workbooks || data.data?.workbooks || (Array.isArray(data) ? data : []);
    return workbooksArr.map((w: any) => ({
      id: w.id || w.workbook_id || "",
      name: w.name || w.workbook_name || "",
      project_id: w.project_id || projectId
    }));
  }

  /**
   * Save/update a connection — secrets go to Key Vault via backend.
   * Uses the new /connections endpoint.
   */
  async storeTableauUrl(creds: TableauCredentials, env?: "cloud" | "server" | "cloud_trial"): Promise<void> {
    // Map frontend credential format to backend connection format
    let envType = env;
    if (!envType) {
      const isCloudURL = creds.TABLEAU_SERVER_URL?.includes("online.tableau.com") || creds.TABLEAU_SERVER_URL?.includes("tableau.com");
      envType = (creds.TCM_BASE_URL || isCloudURL) ? "cloud" : "server";
    }

    const payload = {
      env_type: envType,
      connection_name: creds.CONNECTION_NAME || "",
      tableau_server_url: creds.TABLEAU_SERVER_URL,
      tableau_site_name: creds.TABLEAU_SITE_NAME || "",
      tableau_token_name: creds.TABLEAU_TOKEN_NAME || "TableauToken",
      tableau_token_value: creds.TABLEAU_TOKEN_VALUE || "",    // → Key Vault
      tcm_base_url: creds.TCM_BASE_URL || "",
      tcm_token_secret: creds.TCM_TOKEN_SECRET || "",          // → Key Vault
      server_token_secret: "",                                  // Server env: populated separately
    };

    if (creds.connection_id) {
      await fetchWithAuth(`/api/tableau/connections/${creds.connection_id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    } else {
      await fetchWithAuth("/api/tableau/connections", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }
  }

  /**
   * Delete a saved connection and its Key Vault secrets.
   */
  async deleteConnection(connectionId: string): Promise<void> {
    await fetchWithAuth(`/api/tableau/connections/${connectionId}`, {
      method: "DELETE"
    });
  }
}

export const tableauService = new TableauService(); 