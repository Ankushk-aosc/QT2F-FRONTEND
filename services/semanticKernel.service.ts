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

export interface AiModelOption {
  /** Backend key, e.g. "azure_openai" or "auto" — sent as `model` when starting a run. */
  id: string
  /** Human label supplied by the backend, e.g. "Azure OpenAI". */
  name: string
  /** False when the provider has no credentials configured on the backend. */
  configured: boolean
}

/**
 * The live backend returns `{ models: [{ id, name, available }] }`.
 * Earlier documentation described a keyed object (`{ azure_openai: { name,
 * configured } }`), so both are accepted and normalised to `AiModelOption` —
 * whichever shape arrives, callers see one contract.
 */
function normaliseModels(raw: unknown): AiModelOption[] {
  if (!raw || typeof raw !== "object") return []

  const list = (raw as { models?: unknown }).models
  if (Array.isArray(list)) {
    return list
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      .map((m) => ({
        id: String(m.id ?? ""),
        name: String(m.name ?? m.id ?? ""),
        configured: m.available === true || m.configured === true,
      }))
      .filter((m) => m.id !== "")
  }

  return Object.entries(raw as Record<string, { name?: string; configured?: boolean; available?: boolean }>)
    .filter(([, value]) => !!value && typeof value === "object")
    .map(([id, value]) => ({
      id,
      name: value?.name || id,
      configured: value?.configured === true || value?.available === true,
    }))
}

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
}

class SemanticKernelService {
  /**
   * Providers the backend has configured, for a model picker.
   *
   * Returned as a list rather than the backend's keyed object so callers can
   * render it directly. Provider names are never hardcoded on the client — an
   * empty list means the backend reported none, which callers should surface
   * rather than silently falling back to a default provider.
   */
  async getAvailableModels(): Promise<AiModelOption[]> {
    const raw = await fetchWithAuth<unknown>("/api/models")
    return normaliseModels(raw)
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
}

export const semanticKernelService = new SemanticKernelService()
