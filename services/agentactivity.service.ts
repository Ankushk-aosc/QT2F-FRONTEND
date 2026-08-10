// services/agentactivity.service.ts

import { ApplicationError } from "@/lib/error-handler"
import { fetchWithAuth } from "@/lib/fetchWithAuth"

export interface AgentAction {
  id: string
  project_name: string
  run_id: string
  status: string
  created_at: string
  payload: any
  agent_name: string
  activity_summary: string
  project_id: string
  workbook_id: string
  type: string
}

export interface AgentActivityResponse {
  actions: AgentAction[]
  total_count?: number
  next_page_token?: string
}

class AgentActivityService {
  /**
   * Fetch agent activities / actions for a specific workbook + run + agent
   * Supports incremental fetching using from_timestamp
   */
  async getAgentActions(
    projectId: string,
    workbookId: string,
    runId: string,
    agentName: string,
    options: {
      limit?: number
      fromTimestamp?: string
      toTimestamp?: string
    } = {}
  ): Promise<AgentAction[]> {
    if (!projectId?.trim()) {
      throw new ApplicationError("Project ID is required", "VALIDATION_ERROR", 400)
    }
    if (!workbookId?.trim()) {
      throw new ApplicationError("Workbook ID is required", "VALIDATION_ERROR", 400)
    }
    if (!runId?.trim()) {
      throw new ApplicationError("Run ID is required", "VALIDATION_ERROR", 400)
    }
    if (!agentName?.trim()) {
      throw new ApplicationError("Agent name is required", "VALIDATION_ERROR", 400)
    }

    const params = new URLSearchParams({
      project_id: projectId,
      workbook_id: workbookId,
      run_id: runId,
      agent_name: agentName,
    })

    if (options.limit) {
      params.append("limit", options.limit.toString())
    }
    if (options.fromTimestamp) {
      params.append("from_timestamp", options.fromTimestamp)
    }
    if (options.toTimestamp) {
      params.append("to_timestamp", options.toTimestamp)
    }

    try {
      // We are calling your /api/activities route
      const response = await fetchWithAuth<AgentAction[] | AgentActivityResponse>(
        `/api/activities?${params.toString()}`
      )

      let actions: AgentAction[] = []

      // Handle different possible response shapes
      if (Array.isArray(response)) {
        actions = response
      } else if (response && "actions" in response && Array.isArray(response.actions)) {
        actions = response.actions
      } else if (response && typeof response === "object" && "id" in response) {
        // single object case — unlikely but possible
        actions = [response as any]
      }

      return actions
    } catch (err: any) {
      console.error("[AgentActivityService] Failed to fetch actions:", err)
      if (err.status === 404) {
        return [] // not found = no actions yet → normal during polling
      }
      throw err
    }
  }

  /**
   * Get the most recent action (useful for checking last timestamp)
   */
  async getLatestAgentAction(
    projectId: string,
    workbookId: string,
    runId: string,
    agentName: string
  ): Promise<AgentAction | null> {
    const actions = await this.getAgentActions(projectId, workbookId, runId, agentName, {
      limit: 1,
    })
    return actions.length > 0 ? actions[0] : null
  }

  /**
   * Check if there is at least one action for this combination
   */
  async hasAgentActions(
    projectId: string,
    workbookId: string,
    runId: string,
    agentName: string
  ): Promise<boolean> {
    const actions = await this.getAgentActions(projectId, workbookId, runId, agentName, {
      limit: 1,
    })
    return actions.length > 0
  }
}

export const agentActivityService = new AgentActivityService()