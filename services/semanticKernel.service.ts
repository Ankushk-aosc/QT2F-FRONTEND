import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { ApplicationError } from "@/lib/error-handler";

/**
 * The browser's single entry point to the Semantic Kernel orchestrator.
 *
 * Every method calls a same-origin `/api/*` route, which forwards to the
 * orchestrator server-side. The backend's host lives only in
 * `SEMANTIC_KERNEL_URL` (server-only) and never reaches this bundle, so it
 * cannot leak through devtools, and the requests stay same-origin — no CORS
 * workarounds needed.
 *
 * This service does not sequence agents. Ordering (assessment → parsing →
 * migration → Fabric) is the orchestrator's job; the frontend starts a run and
 * then reads status.
 */



export interface TokenPreflightInput {
  fabric_access_token?: string
  onelake_token?: string
  group_id?: string
}

export interface TokenPreflightResult {
  ok: boolean
  [key: string]: unknown
}

export interface ProcessQlikSpaceInput {
  email: string
  /** Qlik environment, e.g. "cloud". */
  source_type: string
  /** Space ids from the user's current selection. */
  workspace_id: string[]
  deployment_type: string
  fabric_group_id?: string
  model?: string
  connection_id?: string
  items?: Array<{
    app_id: string
    app_name?: string
    workspace_id: string
    workspace_name?: string
  }>
}

export interface InvokeBatchInput {
  email: string;
  source_type: string;
  deployment_type: string;
  fabric_group_id?: string;
  fabric_access_token?: string;
  connection_id?: string;
  run_validation?: boolean;
  model?: string;
  department_repo?: string;
  site_id?: string | null;
  items: Array<{
    workspace_id?: string;
    workspace_name?: string;
    app_id?: string;
    app_name?: string;
    project_id?: string;
    project_name?: string;
    workbook_id?: string;
    workbook_name?: string;
  }>;
}

class SemanticKernelService {
  /**
   * Pings the backend to check if the migration service is healthy.
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetchWithAuth<{ status: string }>("/api/migration/health", { method: "GET" });
      return response?.status === "healthy";
    } catch {
      return false;
    }
  }

  /**
   * Verifies the tokens a run will need, before starting it.
   *
   * The refresh token is deliberately absent from the input: the server route
   * supplies it from an httpOnly cookie, so it never passes through browser
   * JavaScript.
   */
  async tokenPreflight(input: TokenPreflightInput = {}): Promise<TokenPreflightResult> {
    const result = await fetchWithAuth<TokenPreflightResult>("/api/token-preflight", {
      method: "POST",
      body: JSON.stringify(input),
    })
    return { ...result, ok: result?.ok === true }
  }

  /** Hands an entire Qlik space to the orchestrator. */
  async processQlikSpace(input: ProcessQlikSpaceInput): Promise<{ run_id?: string; message?: string }> {
    const spaceIds = (input.workspace_id ?? []).filter((id) => id?.trim())
    if (spaceIds.length === 0) {
      throw new ApplicationError("Select at least one Qlik space.", "NO_SPACE_SELECTED", 400)
    }
    if (!input.email?.trim()) {
      throw new ApplicationError("Missing the signed-in user's email.", "NO_EMAIL", 400)
    }

    return fetchWithAuth("/api/qlik/process-space", {
      method: "POST",
      body: JSON.stringify({ ...input, workspace_id: spaceIds }),
    })
  }

  async invokeBatch(input: InvokeBatchInput): Promise<{ run_id?: string; runId?: string; message?: string }> {
    return fetchWithAuth("/api/migration/invoke-batch", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}

export const semanticKernelService = new SemanticKernelService()
