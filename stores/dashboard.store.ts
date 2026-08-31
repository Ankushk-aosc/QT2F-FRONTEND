// stores/dashboard.store.ts
"use client"

import { create } from "zustand"
import type { Application, LogEntry, AgentResult, RunHistoryItem, AgentType, AppStatus } from "./store.types"
import { migrationService } from "@/services/migration.service"
import { useAuthStore } from "@/stores/auth.store"
import { useRunHistoryStore } from "@/stores/runHistory.store"
import { DEFAULT_PAGE_SIZE } from "@/lib/constants"

interface DashboardStore {
  selectedSite: string
  selectedProject: string
  selectedProjectName: string
  selectedProjects: string[]
  selectedProjectNames: Record<string, string>
  selectedWorkbooks: string[]
  selectedWorkspaceId: string
  selectedWorkspaceName: string
  tableauSiteName: string
  setSelectedSite: (site: string) => void
  setSelectedProject: (projectId: string, projectName: string) => void
  setSelectedProjects: (projects: { id: string; name: string }[]) => void
  setSelectedWorkbooks: (workbooks: string[]) => void
  setSelectedWorkspace: (id: string, name: string) => void
  setTableauSiteName: (name: string) => void
  isProcessing: boolean
  applications: Application[]
  logs: LogEntry[]
  agentResults: Record<string, AgentResult>
  runId: string | null
  runNo: string | null
  runHistory: RunHistoryItem[]
  errorPopup: { message: string; show: boolean }
  hasShownResultSection: boolean

  // ─── NEW ────────────────────────────────────────
  migrationPhase: 'idle' | 'starting' | 'processing' | 'completed'
  setMigrationPhase: (phase: DashboardStore['migrationPhase']) => void
  activeRunStats: {
    total_workbooks: number
    total_migrated: number
    total_failed: number
    total_cancelled: number
    total_pending: number
    total_generation_completed: number
  } | null
  fetchActiveRunStats: (runId: string, emailId: string) => Promise<void>
  // ────────────────────────────────────────────────

  setErrorPopup: (message: string) => void
  startProcessing: () => Promise<void>
  stopProcessing: () => void
  addLog: (log: Omit<LogEntry, "id" | "timestamp">) => void
  updateApplicationStatus: (appId: string, status: AppStatus, agent: AgentType | null) => void
  setAgentResult: (workbookName: string, agentType: AgentType, result: any) => void
  finalizeRun: () => void
  addToRunHistory: (item: RunHistoryItem) => void
  getCounters: () => { total: number; running: number; success: number; failed: number }
  pollRunStatus: () => void
  checkSystemHealth: () => Promise<void>
  setHasShownResultSection: (shown: boolean) => void
}

let pollAttempt = 0

const AGENTS: AgentType[] = [
  "Assessment",
  "Parsing",
  "Mapping",
  "Data Layer",
  "Generation",
  "Validation",
]

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  selectedSite: "",
  selectedProject: "",
  selectedProjectName: "",
  selectedProjects: [],
  selectedProjectNames: {},
  selectedWorkbooks: [],
  selectedWorkspaceId: "",
  selectedWorkspaceName: "",
  tableauSiteName: "",
  isProcessing: false,
  applications: [],
  logs: [],
  agentResults: {},
  runId: null,
  runNo: null,
  runHistory: [],
  errorPopup: { message: "", show: false },
  hasShownResultSection: false,

  // ─── NEW ────────────────────────────────────────
  migrationPhase: 'idle',
  setMigrationPhase: (phase) => set({ migrationPhase: phase }),
  activeRunStats: null,
  fetchActiveRunStats: async (runId: string, emailId: string) => {
    try {
      const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
      const url = `/api/record/semantic-kernel?email_id=${encodeURIComponent(emailId)}&run_id=${encodeURIComponent(runId)}`;
      const response = await fetchWithAuth<any>(url);
      
      const items = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.items)
            ? response.items
            : Array.isArray(response?.records)
              ? response.records
              : Array.isArray(response?.runs)
                ? response.runs
                : [];

      if (items && items.length > 0) {
        const item = items[0];
        if (item && item.total_workbooks !== undefined) {
          set({
            activeRunStats: {
              total_workbooks: item.total_workbooks || 0,
              total_migrated: item.total_migrated || 0,
              total_failed: item.total_failed || 0,
              total_cancelled: item.total_cancelled || 0,
              total_pending: item.total_pending || 0,
              total_generation_completed: item.total_generation_completed || 0,
            }
          });
        }
      }
    } catch (e) {
      console.error("[DashboardStore] Failed to fetch active run stats:", e);
    }
  },
  // ────────────────────────────────────────────────

  setSelectedSite: (site) => set({ selectedSite: site }),
  setSelectedWorkspace: (id, name) => set({ selectedWorkspaceId: id, selectedWorkspaceName: name }),
  setTableauSiteName: (name) => set({ tableauSiteName: name }),

  setSelectedProject: (projectId: string, projectName: string) =>
    set({
      selectedProject: projectId,
      selectedProjectName: projectName || projectId,
    }),

  setSelectedProjects: (projects) => {
    const ids = projects.map(p => p.id)
    const names: Record<string, string> = {}
    projects.forEach(p => { names[p.id] = p.name })
    set({ selectedProjects: ids, selectedProjectNames: names })
  },

  setSelectedWorkbooks: (workbooks) => set({ selectedWorkbooks: workbooks }),

  setHasShownResultSection: (shown) => set({ hasShownResultSection: shown }),

  setErrorPopup: (message: string) => set({ errorPopup: { message, show: !!message } }),

  checkSystemHealth: async () => {
    const { addLog } = get()
    try {
      const health = await migrationService.checkHealth()
      addLog({
        siteName: "",
        workbookName: "",
        agent: "Health Check",
        message: `System health: ${health.status}${health.message ? ` - ${health.message}` : ""}`,
        severity: health.status === "healthy" ? "Success" : "Warning",
      })
    } catch (err: any) {
      addLog({
        siteName: "",
        workbookName: "",
        agent: "Health Check",
        message: `Health check failed: ${err.message}. Proceeding anyway.`,
        severity: "Warning",
      })
    }
  },

  addLog: (log) => {
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...log,
    }
    set((state) => ({ logs: [...state.logs, newLog] }))
  },

  updateApplicationStatus: (appId: string, status: AppStatus, agent: AgentType | null) => {
    set((state) => ({
      applications: state.applications.map((app) =>
        app.id === appId ? { ...app, status, currentAgent: agent || app.currentAgent } : app
      ),
    }))
  },

  setAgentResult: (workbookName: string, agentType: AgentType, result: any) => {
    set((state) => {
      const key = workbookName
      const existing = state.agentResults[key] || {}
      return {
        agentResults: {
          ...state.agentResults,
          [key]: {
            ...existing,
            [agentType]: result,
          },
        },
      }
    })
  },

  getCounters: () => {
    const apps = get().applications
    return {
      total: apps.length,
      running: apps.filter((a) => a.status === "Running").length,
      success: apps.filter((a) => a.status === "Success").length,
      failed: apps.filter((a) => a.status === "Failed").length,
    }
  },

  addToRunHistory: (item: RunHistoryItem) => {
    set((state) => ({ runHistory: [item, ...state.runHistory] }))
  },

  finalizeRun: () => {
    const state = get()
    const runItem: RunHistoryItem = {
      id: `run-${Date.now()}`,
      runDate: new Date(),
      siteName: state.selectedSite,
      projectName: state.selectedProjectName || state.selectedProject,
      applications: state.applications.map((app) => ({ ...app, endTime: new Date() })),
      overallStatus: state.applications.every((a) => a.status === "Success")
        ? "Success"
        : state.applications.some((a) => a.status === "Success")
          ? "Partial"
          : "Failed",
    }
    state.addToRunHistory(runItem)
    set({
      isProcessing: false,
      runId: null,
      runNo: null,
      migrationPhase: 'completed'           // ← added here too (backup)
    })

    // Auto-refresh the run history via the runHistory API
    const user = useAuthStore.getState().user;
    if (user?.email) {
      useRunHistoryStore.getState().fetchRunHistory(user.email, { page: 1, pageSize: DEFAULT_PAGE_SIZE, force: true, silent: true });
    }
  },

  stopProcessing: () => {
    const { addLog, runId } = get()
    addLog({
      siteName: "",
      workbookName: "",
      agent: "System",
      message: `Migration processing stopped manually`,
      severity: "Warning",
    })
    set({
      isProcessing: false,
      runId: null,
      runNo: null,
      migrationPhase: 'idle'                // ← added
    })
  },

  startProcessing: async () => {
    const state = get()

    // If we already have applications & runId from MigrationTab → just poll
    if (state.applications.length > 0 && state.runId) {
      state.addLog({
        siteName: "",
        workbookName: "",
        agent: "System",
        message: `Resuming polling for run ${state.runId}`,
        severity: "Info",
      })
      set({ isProcessing: true })
      state.pollRunStatus()
      return
    }

    const { selectedSite, selectedProject, selectedProjectName, selectedWorkbooks } = state

    if (!selectedProject || selectedWorkbooks.length === 0) {
      state.setErrorPopup("Please select a project and at least one workbook.")
      return
    }

    const { user } = useAuthStore.getState()

    if (!user?.email) {
      const errorMsg = "User email is required. Please log out and log in again."
      state.setErrorPopup(errorMsg)
      state.addLog({
        siteName: selectedSite,
        workbookName: "",
        agent: "System",
        message: errorMsg,
        severity: "Error",
      })
      return
    }

    const userEmail = user.email.trim()

    if (!userEmail) {
      const errorMsg = "User email is empty. Please log out and log in again."
      state.setErrorPopup(errorMsg)
      return
    }

    await state.checkSystemHealth()

    state.addLog({
      siteName: selectedSite,
      workbookName: selectedWorkbooks.join(", "),
      agent: "Initialization",
      message: `Starting migration batch for ${selectedWorkbooks.length} workbook(s)`,
      severity: "Info",
    })

    const newApps = selectedWorkbooks.map((workbook) => ({
      id: crypto.randomUUID(),
      workbookId: workbook,
      siteName: state.tableauSiteName || selectedSite,
      projectName: selectedProjectName || selectedProject,
      projectId: selectedProject,
      workbookName: workbook,
      status: "Running" as AppStatus,
      currentAgent: "Assessment" as AgentType,
      startTime: new Date(),
    }))

    set({ isProcessing: true, applications: newApps, logs: [], agentResults: {}, runId: null, runNo: null, activeRunStats: null })
    pollAttempt = 0

    try {
      const items = selectedWorkbooks.map((wbId) => ({
        project_id: selectedProject,
        workbook_id: wbId,
      }))

      const result = await migrationService.invokeBatch(items, userEmail)

      console.log("[Store] ✅ Migration started:", result)

      if (!result.run_id) {
        throw new Error("No run_id returned from backend")
      }

      set({
        runId: result.run_id,
        runNo: result.run_no ? String(result.run_no) : null,
        hasShownResultSection: true
      })

      state.addLog({
        siteName: selectedSite,
        workbookName: selectedWorkbooks.join(", "),
        agent: "Batch Invoke",
        message: `Batch started successfully.`,
        severity: "Success",
      })

      // Fetch initial active run stats
      state.fetchActiveRunStats(result.run_id, userEmail)

      state.pollRunStatus()
    } catch (err: any) {
      const message = err.message.includes("timeout")
        ? "Migration is taking longer than expected. The backend is still processing — check Run History later."
        : err.message.includes("400")
          ? "Backend rejected the request — check payload or authentication"
          : err.message || "Unknown error starting migration"

      state.addLog({
        siteName: selectedSite,
        workbookName: selectedWorkbooks.join(", "),
        agent: "Batch Invoke",
        message: `Batch start failed: ${message}`,
        severity: "Error",
      })

      state.setErrorPopup(message)
      console.error("[Store] ❌ Detailed start error:", err)
      set({ isProcessing: false })
    }
  },

  pollRunStatus: async () => {
    // Deprecated: polling is now entirely driven by agent.store.ts
  },
}))