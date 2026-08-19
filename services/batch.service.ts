// services/batch.service.ts

import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { getErrorMessage } from "@/lib/error-handler";

export interface BatchItem {
  project_id: string;
  workbook_id: string;
  workbook_name?: string;
}

export interface WorkbookInfo {
  project_id: string;
  workbook_id: string;
  workbook_name?: string;
  project_name?: string;
}

export interface InvokeBatchPayload {
  email: string;
  tableau_server_url: string;
  tableau_site_name: string;
  tableau_token_name?: string;
  site_id?: string;
  source_type?: string;
  connection_id?: string;
  items: BatchItem[];
  group_id?: string;
  workspace_id?: string;
  folder_name?: string;
  onelake_token?: string;
  fabric_access_token?: string;
  lakehouse_id?: string;
  scope?: string;
}

export interface ProcessSitePayload {
  email: string;
  tableau_server_url: string;
  tableau_site_name: string;
  tableau_token_name?: string;
  site_id?: string;
  source_type?: string;
  connection_id?: string;
  project_id?: string[];                // array of project IDs
  group_id?: string;
  workspace_id?: string;
  folder_name?: string;
  onelake_token?: string;
  fabric_access_token?: string;
  lakehouse_id?: string;
  scope?: string;
}

const FIXED_TOKEN_NAME = "TableauToken";

export type MigrationPayload = InvokeBatchPayload | ProcessSitePayload;

export interface MigrationResponse {
  success: boolean;
  message: string;
  run_id: string;
  runId?: string;               // backward compat
  processed_count?: number;
  workbooks?: WorkbookInfo[];   // ← authoritative list from backend
  [key: string]: any;
}

class BatchService {
  /**
   * Fire a single process-site call for ONE project ID (or no project_id for site scope).
   */
  private async callProcessSite(
    email: string,
    tableauServerUrl: string,
    tableauSiteName: string,
    projectIds?: string[],
    groupId?: string,
    folderName?: string,
    siteId?: string,
    sourceType?: string,
    tokenName?: string,
    fabricAccessToken?: string,
    lakehouseId?: string,
    connectionId?: string,
    scope?: string
  ): Promise<MigrationResponse> {
    const body: Record<string, any> = {
      email,
      tableau_server_url: tableauServerUrl,
      tableau_site_name: tableauSiteName,
      tableau_token_name: tokenName || FIXED_TOKEN_NAME,
      scope: scope
    };

    if (fabricAccessToken) {
      body.fabric_access_token = fabricAccessToken;
    }

    if (projectIds && projectIds.length > 0) {
      body.project_id = projectIds;
    }

    if (groupId) {
      body.group_id = groupId;
      body.workspace_id = groupId; // Also set workspace_id for compatibility
    }

    if (folderName) {
      body.folder_name = folderName;
    }

    if (siteId) {
      body.site_id = siteId;
    }

    if (sourceType) {
      body.source_type = sourceType;
    }

    if (lakehouseId !== undefined) {
      body.lakehouse_id = lakehouseId.trim();
    }

    if (connectionId) {
      body.connection_id = connectionId;
    }

    console.log(`[BatchService] callProcessSite (scope: ${scope}) payload:`, JSON.stringify({ ...body, tableau_token_value: "***", tcm_token_secret: "***", fabric_access_token: "***" }));

    const response = await fetchWithAuth<MigrationResponse>("/api/migration/process-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.success || !response.run_id) {
      throw new Error(response.message || "Migration start failed – missing run_id");
    }

    return response;
  }

  async startMigration(
    email: string,
    tableauServerUrl: string,
    tableauSiteName: string = "",
    scope: "selected" | "project" | "site" | "entire",
    projectId?: string | string[],
    items: BatchItem[] = [],
    groupId?: string,
    folderName?: string,
    siteId?: string,
    sourceType: string = "cloud",
    tokenName?: string,
    fabricAccessToken?: string,
    lakehouseId?: string,
    connectionId?: string
  ): Promise<MigrationResponse> {
    const trimmedEmail = email.trim();
    const trimmedUrl = tableauServerUrl.trim();
    const trimmedSite = tableauSiteName.trim();

    if (!trimmedEmail) throw new Error("Email is required");
    if (!trimmedUrl) throw new Error("Tableau server URL is required");

    // ─── "selected" scope → invoke-batch with items ──────────────
    if (scope === "selected") {
      if (items.length === 0) {
        throw new Error("At least one workbook must be selected for 'selected' scope");
      }

      const payload: InvokeBatchPayload = {
        email: trimmedEmail,
        tableau_server_url: trimmedUrl,
        tableau_site_name: trimmedSite,
        tableau_token_name: tokenName || FIXED_TOKEN_NAME,
        site_id: siteId,
        source_type: sourceType,
        items: items.map(item => ({
          project_id: item.project_id.trim(),
          workbook_id: item.workbook_id.trim(),
          workbook_name: item.workbook_name?.trim(),
        })),
        group_id: groupId,
        workspace_id: groupId, // Also set workspace_id for compatibility
        folder_name: folderName,
        fabric_access_token: fabricAccessToken,
        connection_id: connectionId,
        scope: "selected",
        ...(lakehouseId !== undefined ? { lakehouse_id: lakehouseId.trim() } : {}),
      };

      try {
        const response = await fetchWithAuth<MigrationResponse>("/api/migration/invoke-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.success || !response.run_id) {
          throw new Error(response.message || "Migration start failed – missing run_id");
        }
        return response;
      } catch (err: unknown) {
        const message = getErrorMessage(err) || "Failed to start migration";
        console.error(`[BatchService] startMigration failed (selected):`, err);
        throw new Error(message);
      }
    }

    // ─── "project" scope → one API call PER project ID ───────────
    if (scope === "project") {
      let projectIds: string[] = [];

      if (Array.isArray(projectId)) {
        projectIds = projectId
          .filter(id => typeof id === "string" && id.trim())
          .map(id => id.trim());
      } else if (typeof projectId === "string" && projectId.trim()) {
        projectIds = [projectId.trim()];
      }

      if (projectIds.length === 0) {
        throw new Error("At least one valid project ID required for project scope");
      }

      try {
        // Single API call with all project IDs in the array
        console.log(`[BatchService] Processing ${projectIds.length} project(s) in single call (scope: project)`);
        const response = await this.callProcessSite(trimmedEmail, trimmedUrl, trimmedSite, projectIds, groupId, folderName, siteId, sourceType, tokenName, fabricAccessToken, lakehouseId, connectionId, "project");
        return response;
      } catch (err: unknown) {
        const message = getErrorMessage(err) || "Failed to start migration";
        console.error(`[BatchService] startMigration failed (project):`, err);
        throw new Error(message);
      }
    }

    // ─── "site" / "entire" scope → single call, no project_id ────
    try {
      return await this.callProcessSite(trimmedEmail, trimmedUrl, trimmedSite, undefined, groupId, folderName, siteId, sourceType, tokenName, fabricAccessToken, lakehouseId, connectionId, scope);
    } catch (err: unknown) {
      const message = getErrorMessage(err) || "Failed to start migration";
      console.error(`[BatchService] startMigration failed (${scope}):`, err);
      throw new Error(message);
    }
  }

  // Updated helper – now supports multiple projects and workbook names
  buildBatchItems(projectIds: string | string[], selectedWorkbooks: string[], workbookList: any[] = []): BatchItem[] {
    const ids = Array.isArray(projectIds) ? projectIds : [projectIds];

    if (ids.length === 0 || ids.some(id => !id?.trim())) {
      throw new Error("Valid project ID(s) required");
    }

    // Lookup table for names
    const workbookMap = new Map<string, string>();
    workbookList.forEach(wb => {
      const id = wb.id || wb.workbook_id;
      const name = wb.name || wb.workbook_name;
      if (id && name) workbookMap.set(id, name);
    });

    const allItems: BatchItem[] = [];

    for (const projectId of ids.map(id => id.trim())) {
      for (const workbookId of selectedWorkbooks) {
        const id = workbookId.trim();
        allItems.push({
          project_id: projectId,
          workbook_id: id,
          workbook_name: workbookMap.get(id) || id,
        });
      }
    }

    return allItems;
  }

  // Legacy single-project helper (keep for compatibility)
  buildBatchItemsForProject(projectId: string, workbooks: Array<{ id: string }>): BatchItem[] {
    if (!projectId?.trim()) throw new Error("Project ID required");
    return workbooks.map(wb => ({
      project_id: projectId.trim(),
      workbook_id: wb.id.trim(),
    }));
  }

  async invokeBatch(payload: InvokeBatchPayload): Promise<MigrationResponse> {
    return this.startMigration(
      payload.email,
      payload.tableau_server_url,
      payload.tableau_site_name,
      "selected",
      undefined,
      payload.items
    );
  }
}

export const batchService = new BatchService();