// stores/agent.store.ts
import { create } from 'zustand'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { useParsingStore } from '@/stores/parsing.store'
import { useDatalayerStore } from '@/stores/datalayer.store'
import { useMappingStore } from '@/stores/mapping.store'
import { useValidationStore } from '@/stores/validation.store'
import { useGenerationStore } from '@/stores/generation.store'
import { useDashboardStore } from '@/stores/dashboard.store'
import { useUIStore } from '@/stores/ui.store'
import { AGENT_NAME_VARIANTS, matchesAgent } from '@/lib/agentNames'
import { isLiteMode } from '@/lib/config'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface Activity {
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

export interface AssessmentData {
  workbook_id: string
  status: string
  payload?: any
  workbook_name?: string
  connection_type?: string
  [key: string]: any
}

interface AgentStore {
  // ── State ──
  currentRunId: string | null
  currentProjectId: string | null
  currentWorkbookIds: string[]
  workbookProjectMap: Record<string, string>
  assessmentData: Record<string, Record<string, AssessmentData>>
  activities: Record<string, Record<string, Activity[]>>
  agents: Record<string, any>
  isLoading: boolean
  error: string | null
  isPolling: boolean
  migrationStarted: boolean
  lastStatsFetchTime: number

  // ── Per-stage activity-done flags (exposed for UI) ──
  assessmentActivitiesDone: Record<string, boolean>
  parsingActivitiesDone: Record<string, boolean>
  datalayerActivitiesDone: Record<string, boolean>
  mappingActivitiesDone: Record<string, boolean>
  generationActivitiesDone: Record<string, boolean>
  validationActivitiesDone: Record<string, boolean>
  manualValidationStarted: Record<string, boolean>
  isBulkValidationLoading: boolean

  // ── Per-stage API-triggered flags (set the instant the network request fires) ──
  parsingTriggered: Record<string, boolean>
  datalayerTriggered: Record<string, boolean>
  mappingTriggered: Record<string, boolean>
  generationTriggered: Record<string, boolean>
  validationTriggered: Record<string, boolean>

  // ── Manual Validation ──
  startValidationForWorkbook: (workbookId: string, overrides?: { runId: string, projectId: string }) => Promise<void>
  startValidationForWorkbooks: (workbookIds: string[], overrides?: { runId: string, projectId: string }) => Promise<void>
  startRevalidationForWorkbooks: (workbookIds: string[], overrides?: { runId: string, projectId: string }) => Promise<void>
  resetValidationForWorkbooks: (workbookIds: string[]) => void

  // ── Actions ──
  setCurrentRunInfo: (runId: string, projectId: string, workbookIds: string[], workbookProjectMap?: Record<string, string>) => void
  setCurrentRunId: (runId: string) => void
  setMigrationStarted: (started: boolean) => void
  setAssessmentData: (runId: string, workbookId: string, data: AssessmentData) => void
  fetchAllAssessmentData: () => Promise<{ allComplete: boolean }>
  fetchWorkbookActivities: (
    projectId: string,
    workbookId: string,
    runId: string,
    agentName: string
  ) => Promise<Activity[]>
  fetchActivitiesForAllWorkbooks: () => Promise<void>

  fetchAssessmentData: (projectId: string, workbookId: string, runId: string) => Promise<void>

  // ── Helpers ──
  getActivitiesForWorkbook: (workbookId: string, runId?: string) => Activity[]
  getAssessmentForWorkbook: (workbookId: string, runId?: string) => AssessmentData | undefined
  getAssessmentByItem: (projectId: string, workbookId: string) => AssessmentData | undefined
  getProjectIdForWorkbook: (workbookId: string) => string

  // ── Polling Control ──
  startPolling: () => void
  stopPolling: () => void
  clearData: () => void

  // ── Business Logic ──
  shouldSkipDataLayer: (workbookId: string) => boolean
}

// ─────────────────────────────────────────────
// Helper: map API response → store shape
// ─────────────────────────────────────────────

export function mapAssessmentResponseToStore(raw: any): AssessmentData {
  return {
    workbook_id: raw.workbook_id ?? '',
    status: raw.status ?? 'unknown',
    payload: raw.payload ?? raw,
    workbook_name: raw.workbook_name ?? raw.payload?.workbook_name ?? '',
    connection_type: raw.connection_type ?? raw.payload?.connection_type ?? '',
    ...raw,
  }
}

// ─────────────────────────────────────────────
// Module-level trackers
// ─────────────────────────────────────────────
const TERMINAL = ['completed', 'success', 'failed', 'error', 'cancelled']

const _fullyDone = new Set<string>()
const _lastCount = new Map<string, number>()

// ★ Data-fetched trackers (result data is available)
const _assessmentFetched = new Set<string>()
const _parsingFetched = new Set<string>()
const _datalayerFetched = new Set<string>()
const _mappingFetched = new Set<string>()
const _generationFetched = new Set<string>()
const _validationFetched = new Set<string>()

// ★ Activity-done trackers (agent activities have reached terminal status)
const _assessmentActivitiesDone = new Set<string>()
const _parsingActivitiesDone = new Set<string>()
const _datalayerActivitiesDone = new Set<string>()
const _mappingActivitiesDone = new Set<string>()
const _generationActivitiesDone = new Set<string>()
const _validationActivitiesDone = new Set<string>()

// ★ Triggered trackers (agent fetching has started)
const _parsingTriggered = new Set<string>()
const _datalayerTriggered = new Set<string>()
const _mappingTriggered = new Set<string>()
const _generationTriggered = new Set<string>()
const _validationTriggered = new Set<string>()

// ★ Error tracking — stop polling after too many consecutive failures
let _consecutiveErrors = 0
const MAX_CONSECUTIVE_ERRORS = Number.MAX_SAFE_INTEGER // Unlimited polls - never stop due to error count

// ★ Timeout tracking — skip agent if backend never produces results
const _datalayer404Count = new Map<string, number>()
const _mapping404Count = new Map<string, number>()
const _generation404Count = new Map<string, number>()
const _mappingEmptyActsCount = new Map<string, number>()
const _generationEmptyActsCount = new Map<string, number>()

const MAX_DATALAYER_404_RETRIES = 38 // ~5 minutes at 8s polling interval
const MAX_EMPTY_ACTS_RETRIES = 38 // ~5 minutes timeout for missing/stuck activities
const MAX_404_RETRIES = 38 // ~5 minutes timeout for endpoints being stuck at 404

function agentKey(runId: string, wbId: string, agent: string) {
  return `${runId}:${wbId}:${agent}`
}
function wbKey(runId: string, wbId: string) {
  return `${runId}:${wbId}`
}

// ★ Helper: check if activities list contains a terminal status
function hasTerminalActivity(activities: Activity[]): boolean {
  return activities.some(a => TERMINAL.includes((a.status || '').toLowerCase()))
}

function resetTrackers() {
  _fullyDone.clear()
  _lastCount.clear()
  _assessmentFetched.clear()
  _parsingFetched.clear()
  _datalayerFetched.clear()
  _mappingFetched.clear()
  _validationFetched.clear()
  _generationFetched.clear()
  _assessmentActivitiesDone.clear()
  _parsingActivitiesDone.clear()
  _datalayerActivitiesDone.clear()
  _mappingActivitiesDone.clear()
  _generationActivitiesDone.clear()
  _validationActivitiesDone.clear()
  _parsingTriggered.clear()
  _datalayerTriggered.clear()
  _mappingTriggered.clear()
  _generationTriggered.clear()
  _validationTriggered.clear()
  _consecutiveErrors = 0
  _datalayer404Count.clear()
  _mapping404Count.clear()
  _generation404Count.clear()
  _mappingEmptyActsCount.clear()
  _generationEmptyActsCount.clear()
}

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useAgentStore = create<AgentStore>((set, get) => ({
  currentRunId: null,
  currentProjectId: null,
  currentWorkbookIds: [],
  workbookProjectMap: {},
  assessmentData: {},
  activities: {},
  agents: {},
  isLoading: false,
  error: null,
  isPolling: false,
  migrationStarted: false,
  lastStatsFetchTime: 0,

  // ── Per-stage activity-done flags (exposed for UI) ──
  assessmentActivitiesDone: {},
  parsingActivitiesDone: {},
  datalayerActivitiesDone: {},
  mappingActivitiesDone: {},
  generationActivitiesDone: {},
  validationActivitiesDone: {},
  manualValidationStarted: {},
  isBulkValidationLoading: false,

  // ── Per-stage triggered flags ──
  parsingTriggered: {},
  datalayerTriggered: {},
  mappingTriggered: {},
  generationTriggered: {},
  validationTriggered: {},

  setCurrentRunInfo: (runId, projectId, workbookIds, workbookProjectMap) => {
    get().stopPolling()
    resetTrackers()

    // Clear sub-stores to avoid stale data from previous runs
    useParsingStore.getState().reset()
    useDatalayerStore.getState().reset()
    useMappingStore.getState().reset()
    useValidationStore.getState().clearValidationData()
    useGenerationStore.getState().clearGenerationData()

    const finalMap: Record<string, string> = workbookProjectMap || {}
    if (!workbookProjectMap) {
      workbookIds.forEach(wbId => { finalMap[wbId] = projectId })
    }

    set({
      currentRunId: runId,
      currentProjectId: projectId,
      currentWorkbookIds: workbookIds,
      workbookProjectMap: finalMap,
      error: null,
      assessmentData: {},
      activities: {},
      migrationStarted: true,
      lastStatsFetchTime: 0,
      assessmentActivitiesDone: {},
      parsingActivitiesDone: {},
      datalayerActivitiesDone: {},
      mappingActivitiesDone: {},
      generationActivitiesDone: {},
      validationActivitiesDone: {},
      manualValidationStarted: {},
      isBulkValidationLoading: false,
      parsingTriggered: {},
      datalayerTriggered: {},
      mappingTriggered: {},
      generationTriggered: {},
      validationTriggered: {},
    })
    setTimeout(() => get().startPolling(), 5000)
  },

  setCurrentRunId: (runId) => set({ currentRunId: runId }),

  startValidationForWorkbook: async (workbookId: string, overrides?: { runId: string, projectId: string }) => {
    const { currentRunId, getProjectIdForWorkbook } = get()
    const activeRunId = overrides?.runId || currentRunId
    if (!activeRunId) return

    const projectId = overrides?.projectId || getProjectIdForWorkbook(workbookId)

    // Mark as manually started
    const key = overrides ? `${overrides.runId}_${workbookId}` : workbookId
    set((state) => ({ manualValidationStarted: { ...state.manualValidationStarted, [key]: true } }))
    try { localStorage.setItem(`auth_val_${activeRunId}_${workbookId}`, "true") } catch(e) {}

    // Reset local state before triggering re-run to avoid stale data
    get().resetValidationForWorkbooks([workbookId]);

    try {
      const email = (await import("@/stores/auth.store")).useAuthStore.getState().user?.email || "";

      // ── Single workbook: call /run-single-validation endpoint ──
      const response = await import("@/stores/validation.store").then(m =>
        m.useValidationStore.getState().triggerSingleValidation(email, activeRunId, projectId, workbookId)
      )
      
      const data = response?.data || response;
      if (data?.failed_count > 0 && Array.isArray(data?.workbook_statuses)) {
          const failedStatus = data.workbook_statuses.find((s: any) => s.workbook_id === workbookId && s.status === 'failed') || data.workbook_statuses.find((s: any) => s.status === 'failed');
          if (failedStatus && failedStatus.error_message) {
              throw new Error(`SYNC_REQUIRED:${failedStatus.error_message}`);
          }
      }
      
      if (data?.project_workbooks_status) {
          for (const pid in data.project_workbooks_status) {
              const statuses = data.project_workbooks_status[pid];
              if (Array.isArray(statuses)) {
                  const failedStatus = statuses.find((s: any) => s.workbook_id === workbookId && (s.validation_status === 'failed' || s.overall_status === 'failed')) || 
                                       statuses.find((s: any) => s.validation_status === 'failed' || s.overall_status === 'failed');
                  if (failedStatus && failedStatus.status_message) {
                      throw new Error(`SYNC_REQUIRED:${failedStatus.status_message}`);
                  }
              }
          }
      }

      // Start polling to pick up results
      get().startPolling()
      return response;
    } catch (e: any) {
      // Revert UI state
      set((state) => {
        const newManual = { ...state.manualValidationStarted }
        delete newManual[key]
        return { manualValidationStarted: newManual }
      })
      try { localStorage.removeItem(`auth_val_${activeRunId}_${workbookId}`) } catch(e2){}
      const errorMsg = e.message || String(e)
      if (errorMsg.startsWith("SYNC_REQUIRED:")) {
          throw e;
      }
      alert("Failed to start validation: " + errorMsg)
      throw e;
    }
  },

  startValidationForWorkbooks: async (workbookIds: string[], overrides?: { runId: string, projectId: string }) => {
    const { currentRunId, startPolling, assessmentData } = get()
    const activeRunId = overrides?.runId || currentRunId
    if (!activeRunId) return
    
    const runIdsToTrigger = new Set<string>();
    
    // Always include the main run ID (e.g. batch_id)
    runIdsToTrigger.add(activeRunId);

    workbookIds.forEach(wbId => {
      // For historical runs, we use a prefixed key to avoid corrupting the active run's state
      const key = overrides ? `${overrides.runId}_${wbId}` : wbId;
      set((state) => ({ manualValidationStarted: { ...state.manualValidationStarted, [key]: true } }))
      
      try {
        localStorage.setItem(`auth_val_${activeRunId}_${wbId}`, "true")
      } catch(e) {}

      // Collect workbook-specific run IDs from assessment payloads
      const payload = assessmentData[activeRunId]?.[wbId]?.payload;
      if (payload?.run_id) runIdsToTrigger.add(payload.run_id);
      if (payload?.runId) runIdsToTrigger.add(payload.runId);
      
      const raw = assessmentData[activeRunId]?.[wbId];
      if (raw?.run_id) runIdsToTrigger.add(raw.run_id);
      if (raw?.runId) runIdsToTrigger.add(raw.runId);
    });

    set({ isBulkValidationLoading: true })

    const finalRunIds = Array.from(runIdsToTrigger);
    console.log(`[Validation Trigger] Bulk triggering validation for runs:`, finalRunIds)

    let syncRequiredError: Error | null = null;

    try {
      const email = (await import("@/stores/auth.store")).useAuthStore.getState().user?.email || "";
      
      const response = await import("@/stores/validation.store").then(m => m.useValidationStore.getState().triggerValidation(email, finalRunIds as any))
      
      const data = response?.data || response;
      let globalErrorMsg: string | null = null;
      let hasAnyFailure = false;
      const failedWorkbookIds: string[] = [];
      const validationStore = (await import("@/stores/validation.store")).useValidationStore.getState();

      const processStatuses = (statuses: any[]) => {
          statuses.forEach(s => {
              if (s.status === 'failed' || s.validation_status === 'failed' || s.overall_status === 'failed') {
                  const msg = s.error_message || s.status_message || "Validation failed";
                  validationStore.setValidationError(s.workbook_id, msg);
                  failedWorkbookIds.push(s.workbook_id);
                  hasAnyFailure = true;
                  globalErrorMsg = msg;
              }
          });
      };

      if (data?.workbook_statuses && Array.isArray(data.workbook_statuses)) {
          processStatuses(data.workbook_statuses);
      }
      
      if (data?.project_workbooks_status) {
          for (const pid in data.project_workbooks_status) {
              const statuses = data.project_workbooks_status[pid];
              if (Array.isArray(statuses)) {
                  processStatuses(statuses);
              }
          }
      }

      // Revert manualValidationStarted ONLY for the failed workbooks
      if (failedWorkbookIds.length > 0) {
          set((state) => {
              const newManual = { ...state.manualValidationStarted };
              failedWorkbookIds.forEach(wbId => {
                  const key = overrides ? `${overrides.runId}_${wbId}` : wbId;
                  delete newManual[key];
                  try { localStorage.removeItem(`auth_val_${activeRunId}_${wbId}`); } catch(e){}
              });
              return { manualValidationStarted: newManual };
          });
      }

      // Always start polling — successful workbooks will get their results
      startPolling();

      if (hasAnyFailure) {
          syncRequiredError = new Error(`SYNC_REQUIRED:${globalErrorMsg}`);
          set({ isBulkValidationLoading: false })
      }
    } catch (e: any) {
      set({ isBulkValidationLoading: false })
      // Only real network/API errors reach here — revert ALL workbooks
      set((state) => {
        const newManual = { ...state.manualValidationStarted }
        workbookIds.forEach(wbId => {
          const key = overrides ? `${overrides.runId}_${wbId}` : wbId;
          delete newManual[key]
        })
        return { manualValidationStarted: newManual }
      })
      workbookIds.forEach(wbId => {
        try { localStorage.removeItem(`auth_val_${activeRunId}_${wbId}`) } catch(e){}
      })
      
      throw e;
    }

    // Throw AFTER startPolling so successful workbooks still get polled
    if (syncRequiredError) {
      throw syncRequiredError;
    }
  },

  startRevalidationForWorkbooks: async (workbookIds: string[], overrides?: { runId: string, projectId: string }) => {
    const { currentRunId, startPolling, assessmentData, resetValidationForWorkbooks } = get()
    const activeRunId = overrides?.runId || currentRunId
    if (!activeRunId) return
    
    const runIdsToTrigger = new Set<string>();
    runIdsToTrigger.add(activeRunId);

    workbookIds.forEach(wbId => {
      // Collect workbook-specific run IDs from assessment payloads
      const payload = assessmentData[activeRunId]?.[wbId]?.payload;
      if (payload?.run_id) runIdsToTrigger.add(payload.run_id);
      if (payload?.runId) runIdsToTrigger.add(payload.runId);
      
      const raw = assessmentData[activeRunId]?.[wbId];
      if (raw?.run_id) runIdsToTrigger.add(raw.run_id);
      if (raw?.runId) runIdsToTrigger.add(raw.runId);
    });

    set({ isBulkValidationLoading: true })

    // Reset local state before triggering re-run to avoid stale data
    resetValidationForWorkbooks(workbookIds);

    const finalRunIds = Array.from(runIdsToTrigger);
    console.log(`[Validation Trigger] Bulk triggering revalidation for runs:`, finalRunIds)

    let syncRequiredError: Error | null = null;

    try {
      const email = (await import("@/stores/auth.store")).useAuthStore.getState().user?.email || "";
      
      const response = await import("@/stores/validation.store").then(m => m.useValidationStore.getState().triggerRevalidationAll(email, finalRunIds as any))
      
      const data = response?.data || response;
      let globalErrorMsg: string | null = null;
      let hasAnyFailure = false;
      const failedWorkbookIds: string[] = [];
      const validationStore = (await import("@/stores/validation.store")).useValidationStore.getState();

      const processStatuses = (statuses: any[]) => {
          statuses.forEach(s => {
              if (s.status === 'failed' || s.validation_status === 'failed' || s.overall_status === 'failed') {
                  const msg = s.error_message || s.status_message || "Validation failed";
                  validationStore.setValidationError(s.workbook_id, msg);
                  failedWorkbookIds.push(s.workbook_id);
                  hasAnyFailure = true;
                  globalErrorMsg = msg;
              }
          });
      };

      if (data?.workbook_statuses && Array.isArray(data.workbook_statuses)) {
          processStatuses(data.workbook_statuses);
      }
      
      if (data?.project_workbooks_status) {
          for (const pid in data.project_workbooks_status) {
              const statuses = data.project_workbooks_status[pid];
              if (Array.isArray(statuses)) {
                  processStatuses(statuses);
              }
          }
      }

      // Always start polling — successful workbooks will get their results
      startPolling();

      if (hasAnyFailure) {
          syncRequiredError = new Error(`SYNC_REQUIRED:${globalErrorMsg}`);
          set({ isBulkValidationLoading: false })
      }
    } catch (e: any) {
      set({ isBulkValidationLoading: false })
      // Real network/API error — propagate
      throw e;
    }

    // Throw AFTER startPolling so successful workbooks still get polled
    if (syncRequiredError) {
      throw syncRequiredError;
    }
  },

  resetValidationForWorkbooks: (workbookIds: string[]) => {
    const { currentRunId } = get();
    if (!currentRunId) return;

    workbookIds.forEach(wbId => {
      const key = wbKey(currentRunId, wbId);
      _validationFetched.delete(key);
      _validationActivitiesDone.delete(key);
      _validationTriggered.delete(key);
    });

    set((state) => {
      const newDone = { ...state.validationActivitiesDone };
      const newManual = { ...state.manualValidationStarted };
      const newTriggered = { ...state.validationTriggered };
      workbookIds.forEach(id => {
        delete newDone[id];
        delete newTriggered[id];
        newManual[id] = true;
      });
      return { 
        validationActivitiesDone: newDone, 
        manualValidationStarted: newManual,
        validationTriggered: newTriggered
      };
    });

    useValidationStore.setState(state => {
      const newValidationData = { ...state.validationData };
      workbookIds.forEach(id => delete newValidationData[id]);
      return { validationData: newValidationData };
    });
  },

  setMigrationStarted: (started) => set({ migrationStarted: started }),

  setAssessmentData: (runId, workbookId, data) => {
    set((state) => ({
      assessmentData: {
        ...state.assessmentData,
        [runId]: {
          ...state.assessmentData[runId],
          [workbookId]: data,
        },
      },
    }))
  },

  getProjectIdForWorkbook: (workbookId) => {
    const { workbookProjectMap, currentProjectId } = get()
    return workbookProjectMap[workbookId] || currentProjectId || "unknown"
  },

  // ──────────────────────────────────────────
  // fetchAssessmentData
  // ──────────────────────────────────────────
  fetchAssessmentData: async (projectId, workbookId, runId) => {
    try {
      console.log(`[Assessment GET] Fetching historical assessment for ${workbookId} (run: ${runId})`)
      const query = `project_id=${projectId}&workbook_id=${workbookId}&run_id=${runId}`
      const data = await fetchWithAuth<any>(`/api/assessment?${query}`)
      if (data && (data.status === 'completed' || data.status === 'success' || data.payload)) {
        set((state) => ({
          assessmentData: {
            ...state.assessmentData,
            [runId]: {
              ...state.assessmentData[runId],
              [workbookId]: data,
            },
          },
        }))
      }
    } catch (err: any) {
      console.error(`[Assessment GET] Error fetching historical assessment for ${workbookId}:`, err)
    }
  },

  shouldSkipDataLayer: (workbookId: string) => {
    const { currentRunId, assessmentData } = get()
    if (!currentRunId) return false
    
    // Look up the assessment for this specific workbook
    const assessment = assessmentData[currentRunId]?.[workbookId]
    // ★ FIX: Explicit guard - if assessment is not loaded, we cannot reliably determine skip status
    // Return false (don't skip) as a safe default when assessment is missing
    // This is accompanied by a check in the caller to wait for _assessmentFetched
    if (!assessment) {
      console.warn(`[shouldSkipDataLayer] Assessment missing for ${workbookId} - deferring decision`)
      return false
    }

    const payload = assessment.payload || {}
    
    // 1. Check top-level connection_type variants across common payload paths
    const connType = (
      assessment.connection_type || 
      payload.connection_type || 
      payload.workbook_info?.connection_type ||
      payload.info?.connection_type ||
      assessment.connection_mode ||
      payload.connection_mode ||
      ""
    ).toLowerCase()
    
    // Rule 1: If connection is "Live", "Direct", or "Live Connection", always skip Data Layer
    if (connType.includes("live") || connType.includes("direct")) {
      console.log(`[shouldSkipDataLayer] ✅ Skipping DL - Live/Direct connection detected for ${workbookId}`)
      return true
    }
    
    // 2. Check data_source_type if available (specifically for Medisphere style payloads)
    const dsType = (payload.data_source_type || assessment.data_source_type || "").toLowerCase()
    if (dsType.includes("live") || dsType.includes("direct")) {
      console.log(`[shouldSkipDataLayer] ✅ Skipping DL - Live/Direct data_source_type detected for ${workbookId}`)
      return true
    }

    // 3. Deep check: Check if any individual connection is live in the detailed_connections list
    const detailedConns = payload.detailed_connections || []
    if (Array.isArray(detailedConns) && detailedConns.length > 0) {
      const hasLiveConn = detailedConns.some((c: any) => {
        const type = (c.type || c.Type || c.connection_type || c.Mode || c.mode || "").toLowerCase()
        return type.includes("live") || type.includes("direct")
      })
      if (hasLiveConn) {
        console.log(`[shouldSkipDataLayer] ✅ Skipping DL - Live/Direct found in detailed_connections for ${workbookId}`)
        return true
      }
    }

    // Rule 2: If connection is "Extract", respect the global Data Layer toggle
    const dlEnabled = useUIStore.getState().dataLayerEnabled
    if (!dlEnabled) {
      console.log(`[shouldSkipDataLayer] ✅ Skipping DL - Data Layer toggle disabled for ${workbookId}`)
    }
    return !dlEnabled
  },

  // ──────────────────────────────────────────
  // fetchWorkbookActivities
  // ★ Silently catches errors — returns empty array, never throws
  // ──────────────────────────────────────────
  fetchWorkbookActivities: async (projectId, workbookId, runId, agentName) => {
    const key = agentKey(runId, workbookId, agentName)
    // Removed early return on _fullyDone. Activities keep polling until data is fetched.

    try {
      // ★ FIX: Paginate the activities endpoint to ensure ALL activities are fetched
      // even when the backend returns results in pages (e.g. page_size=20).
      const PAGE_SIZE = 100
      let allActivities: Activity[] = []
      let offset = 0
      let hasMore = true

      while (hasMore) {
        const params = new URLSearchParams({
          project_id: projectId,
          workbook_id: workbookId,
          run_id: runId,
          agent_name: agentName,
          limit: String(PAGE_SIZE),
          offset: String(offset),
        })

        const data = await fetchWithAuth<Activity[] | any>(`/api/activities?${params.toString()}`)
        const page: Activity[] = Array.isArray(data) ? data : []
        allActivities = [...allActivities, ...page]

        // If the page returned fewer items than PAGE_SIZE, we've reached the end
        if (page.length < PAGE_SIZE) {
          hasMore = false
        } else {
          offset += PAGE_SIZE
        }
      }

      // ★ Success — reset error counter
      _consecutiveErrors = 0

      const sorted = allActivities.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      // ★ Determine the canonical key for this agent so we can filter ALL its variants
      const canonicalKey = Object.keys(AGENT_NAME_VARIANTS).find(k =>
        AGENT_NAME_VARIANTS[k].includes(agentName)
      ) || ''

      // ★ CRITICAL: Only update the store with new activities if this fetch actually
      // returned results. If a variant (e.g. "Parser Agent") returns 0 activities,
      // we must NOT wipe the existing activities that a sibling variant
      // (e.g. "Parsing Agent") already stored. An empty result means the backend
      // simply doesn't use this name variant — keep what we have.
      if (sorted.length > 0) {
        set((state) => {
          const runMap = state.activities[runId] || {}
          const currentList = runMap[workbookId] || []
          // Only remove existing activities for ALL canonical variants and replace
          // them with this fresh fetch when we actually have fresh results.
          const canonicalVariants = canonicalKey ? new Set(AGENT_NAME_VARIANTS[canonicalKey]) : new Set([agentName])
          const otherAgentActs = currentList.filter(a => !canonicalVariants.has(a.agent_name))
          // ★ Deduplicate sorted results by activity ID
          const seenIds = new Set<string>()
          const dedupedSorted = sorted.filter(a => {
            if (a.id && seenIds.has(a.id)) return false
            if (a.id) seenIds.add(a.id)
            return true
          })
          const combined = [...otherAgentActs, ...dedupedSorted]

          return {
            activities: {
              ...state.activities,
              [runId]: {
                ...runMap,
                [workbookId]: combined,
              },
            },
          }
        })
      }

      const isTerminal = (status: string) => TERMINAL.includes(status?.toLowerCase())
      const hasTerminal = sorted.some(a => isTerminal(a.status))
      const prevCount = _lastCount.get(key) ?? -1
      const currentCount = sorted.length
      _lastCount.set(key, currentCount)

        const uiState = useUIStore.getState()
        const isSelected = workbookId === uiState.selectedWorkbookId

        if (isSelected || (hasTerminal && currentCount === prevCount && currentCount > 0)) {
          if (hasTerminal && currentCount === prevCount && currentCount > 0) {
             _fullyDone.add(key)
          }
          
          if (isSelected || hasTerminal) {
            console.log(`\n════════ [${isSelected ? "SELECTED" : "AGENT"}] ══════════`)
            console.log(`📝 ${agentName} — ${currentCount} activities for ${workbookId}`)
            sorted.forEach((act, i) => {
              console.log(`  [${i + 1}] ${act.activity_summary || act.type || "—"} (${act.status})`)
            })
            console.log(`══════════════════════════════════════════\n`)
          }
        }

      return sorted
    } catch (err: any) {
      // ★ Silently handle errors — just log once, don't throw
      _consecutiveErrors++
      if (_consecutiveErrors <= 3) {
        console.warn(`[Activities] ${agentName} for ${workbookId}: ${err.message?.slice(0, 80) || "error"} (attempt ${_consecutiveErrors})`)
      }
      return []
    }
  },

  // ──────────────────────────────────────────
  // fetchActivitiesForAllWorkbooks
  // ★ STRICT SEQUENTIAL: Each stage's activities are only polled
  //    after the PREVIOUS stage's DATA has been fetched.
  //    Within a stage: activities are polled until terminal,
  //    then marked done so data-fetching can begin.
  // ──────────────────────────────────────────
  fetchActivitiesForAllWorkbooks: async () => {
    const { currentRunId, currentWorkbookIds, fetchWorkbookActivities, getProjectIdForWorkbook } = get()
    if (!currentRunId || currentWorkbookIds.length === 0) return

    const uiState = useUIStore.getState()
    const selectedWorkbookId = uiState.selectedWorkbookId

    // ── PRIORITIZE: Move selected workbook (the one user is watching) to front ──
    const sortedWbIds = [...currentWorkbookIds].sort((a, b) => {
      if (a === selectedWorkbookId) return -1
      if (b === selectedWorkbookId) return 1
      return 0
    })

    for (const wbId of sortedWbIds) {
      const projectId = getProjectIdForWorkbook(wbId)
      const key = wbKey(currentRunId, wbId)
      const isPausedInSingleMode = uiState.mode === 'single' && !uiState.hasContinued
      const isSelected = wbId === selectedWorkbookId

      // ── STAGE 1: Assessment Agent ──
      if (isSelected || !_assessmentFetched.has(key)) {
        const variants = AGENT_NAME_VARIANTS.assessment
        let allActs: Activity[] = []
        for (const v of variants) {
          const acts = await fetchWorkbookActivities(projectId, wbId, currentRunId, v)
          allActs = [...allActs, ...acts]
        }
        if (allActs.length > 0 && hasTerminalActivity(allActs)) {
          _assessmentActivitiesDone.add(key)
          set((state) => ({ assessmentActivitiesDone: { ...state.assessmentActivitiesDone, [wbId]: true } }))
        } else if (get().assessmentData[currentRunId]?.[wbId]) {
          // ★ Fallback: if data exists, auto-resolve activities so we don't poll forever
          _assessmentActivitiesDone.add(key)
          set((state) => ({ assessmentActivitiesDone: { ...state.assessmentActivitiesDone, [wbId]: true } }))
          console.log(`[Assessment] ✅ Activities auto-resolved for ${wbId} (data available)`)
        }
      }

      // ── STAGE 2: Parsing Agent ──
      if (_assessmentFetched.has(key) && (isSelected || !_parsingFetched.has(key))) {
        _parsingTriggered.add(key)
        set((state) => ({ parsingTriggered: { ...state.parsingTriggered, [wbId]: true } }))
        
        const variants = AGENT_NAME_VARIANTS.parsing
        let allActs: Activity[] = []
        const seenIds = new Set<string>()
        for (const v of variants) {
          const acts = await fetchWorkbookActivities(projectId, wbId, currentRunId, v)
          for (const a of acts) {
            if (a.id && seenIds.has(a.id)) continue
            if (a.id) seenIds.add(a.id)
            allActs.push(a)
          }
        }
        if (allActs.length > 0 && hasTerminalActivity(allActs)) {
          _parsingActivitiesDone.add(key)
          set((state) => ({ parsingActivitiesDone: { ...state.parsingActivitiesDone, [wbId]: true } }))
        } else if (useParsingStore.getState().parsingData[wbId]) {
          // ★ Fallback: if data exists, auto-resolve activities so we don't poll forever
          _parsingActivitiesDone.add(key)
          set((state) => ({ parsingActivitiesDone: { ...state.parsingActivitiesDone, [wbId]: true } }))
          console.log(`[Parsing] ✅ Activities auto-resolved for ${wbId} (data available)`)
        }
      }

      // If we are in Lite Mode, stop activity polling right after Parsing is done
      if (isLiteMode()) {
        continue;
      }

      // ── STAGE 3: Mapping Agent ──
      // ★ REORDERED: Mapping now runs BEFORE Data Layer
      // Gate: parsing data must be fetched (always, regardless of data layer toggle)
      const skipDataLayer = get().shouldSkipDataLayer(wbId)
      if (!isPausedInSingleMode && _parsingFetched.has(key) && (isSelected || !_mappingFetched.has(key))) {
        _mappingTriggered.add(key)
        if (!get().mappingTriggered[wbId]) {
          set((state) => ({ mappingTriggered: { ...state.mappingTriggered, [wbId]: true } }))
        }
        
        const variants = AGENT_NAME_VARIANTS.mapping
        let allActs: Activity[] = []
        const seenIds = new Set<string>()
        for (const v of variants) {
          const acts = await fetchWorkbookActivities(projectId, wbId, currentRunId, v)
          for (const a of acts) {
            if (a.id && seenIds.has(a.id)) continue
            if (a.id) seenIds.add(a.id)
            allActs.push(a)
          }
        }
        if (allActs.length > 0 && hasTerminalActivity(allActs)) {
          _mappingEmptyActsCount.delete(key)
          _mappingActivitiesDone.add(key)
          set((state) => ({ mappingActivitiesDone: { ...state.mappingActivitiesDone, [wbId]: true } }))
        } else if (useMappingStore.getState().mappingData[wbId]) {
          // ★ Fallback: if data exists, auto-resolve activities so we don't poll forever
          _mappingEmptyActsCount.delete(key)
          _mappingActivitiesDone.add(key)
          set((state) => ({ mappingActivitiesDone: { ...state.mappingActivitiesDone, [wbId]: true } }))
          console.log(`[Mapping] ✅ Activities auto-resolved for ${wbId} (data available)`)
        } else {
          const count = (_mappingEmptyActsCount.get(key) || 0) + 1
          _mappingEmptyActsCount.set(key, count)
        }
      }

      // ── STAGE 3.5: Data Layer Agent ──
      // ★ REORDERED: Data Layer now runs AFTER Mapping and BEFORE Generation
      // Gate: mapping data must be fetched
      const isDLDone = _datalayerActivitiesDone.has(key)
      const isDLTriggered = _datalayerTriggered.has(key)
      
      // ★ FIX: Added _assessmentFetched gate to prevent race condition
      // Stop polling once Generation is triggered
      // CRITICAL: Assessment must be loaded before checking skipDataLayer() to avoid intermittent triggering
      if (!isPausedInSingleMode && _assessmentFetched.has(key) && !skipDataLayer && _mappingFetched.has(key) && (isSelected || !_datalayerFetched.has(key))) {
        _datalayerTriggered.add(key)
        if (!isDLTriggered) {
          set((state) => ({ datalayerTriggered: { ...state.datalayerTriggered, [wbId]: true } }))
        }
        
        const variants = AGENT_NAME_VARIANTS.datalayer
        let allActs: Activity[] = []
        const seenIds = new Set<string>()
        for (const v of variants) {
          const acts = await fetchWorkbookActivities(projectId, wbId, currentRunId, v)
          for (const a of acts) {
            if (a.id && seenIds.has(a.id)) continue
            if (a.id) seenIds.add(a.id)
            allActs.push(a)
          }
        }

        // ★ [SYNTHETIC LOGIC] If no real activities but data exists, create a sequence of detailed ones
        const dlData = useDatalayerStore.getState().datalayerData[wbId]
        if (allActs.length === 0 && dlData) {
          const isErr = !!dlData.error || dlData.status === 'failed'
          const syntheticActs: Activity[] = []
          
          if (isErr) {
            syntheticActs.push({
              id: `synth-dl-error-${wbId}`,
              project_name: "", run_id: currentRunId, status: 'failed', created_at: new Date().toISOString(),
              payload: dlData, agent_name: "DataLayerAgent",
              activity_summary: `Data Layer processing encountered an issue: ${dlData.error || 'Connection error'}`,
              project_id: projectId, workbook_id: wbId, type: "synthetic"
            })
          } else {
            // Success sequence
            if (dlData.pipeline_summary?.hyper_files_found > 0) {
              syntheticActs.push({
                id: `synth-dl-hyper-${wbId}`,
                project_name: "", run_id: currentRunId, status: 'completed', created_at: new Date(Date.now() - 5000).toISOString(),
                payload: dlData, agent_name: "DataLayerAgent",
                activity_summary: `Source Analysis: Found ${dlData.pipeline_summary.hyper_files_found} Hyper files in the workbook metadata.`,
                project_id: projectId, workbook_id: wbId, type: "synthetic"
              })
            }
            if (dlData.pipeline_summary?.parquet_files_created > 0) {
              syntheticActs.push({
                id: `synth-dl-parquet-${wbId}`,
                project_name: "", run_id: currentRunId, status: 'completed', created_at: new Date(Date.now() - 3000).toISOString(),
                payload: dlData, agent_name: "DataLayerAgent",
                activity_summary: `Extraction: Successfully created ${dlData.pipeline_summary.parquet_files_created} Parquet files for medallion processing.`,
                project_id: projectId, workbook_id: wbId, type: "synthetic"
              })
            }
            if (dlData.lakehouse?.name) {
              syntheticActs.push({
                id: `synth-dl-lh-${wbId}`,
                project_name: "", run_id: currentRunId, status: 'completed', created_at: new Date(Date.now() - 1000).toISOString(),
                payload: dlData, agent_name: "DataLayerAgent",
                activity_summary: `Environment: Verified target Fabric Lakehouse "${dlData.lakehouse.name}".`,
                project_id: projectId, workbook_id: wbId, type: "synthetic"
              })
            }
            syntheticActs.push({
              id: `synth-dl-final-${wbId}`,
              project_name: "", run_id: currentRunId, status: 'completed', created_at: new Date().toISOString(),
              payload: dlData, agent_name: "DataLayerAgent",
              activity_summary: "Data Layer processing complete. OneLake assets are ready for Generation.",
              project_id: projectId, workbook_id: wbId, type: "synthetic"
            })
          }
          
          allActs = syntheticActs
          
          // Inject into state
          set((state) => {
            const runMap = state.activities[currentRunId] || {}
            const currentList = runMap[wbId] || []
            return {
              activities: {
                ...state.activities,
                [currentRunId]: { 
                  ...runMap, 
                  [wbId]: [...currentList.filter(a => !matchesAgent(a.agent_name, 'datalayer')), ...syntheticActs] 
                }
              }
            }
          })
        }

        if (allActs.length > 0 && hasTerminalActivity(allActs)) {
          _datalayerActivitiesDone.add(key)
          set((state) => ({ datalayerActivitiesDone: { ...state.datalayerActivitiesDone, [wbId]: true } }))
        } else if (useDatalayerStore.getState().datalayerData[wbId]) {
          // Data arrived but no terminal activities — mark activities as done
          _datalayerActivitiesDone.add(key)
          set((state) => ({ datalayerActivitiesDone: { ...state.datalayerActivitiesDone, [wbId]: true } }))
          console.log(`[DataLayer] ✅ Activities auto-resolved for ${wbId} (data available)`)
        }
      }

      // ── STAGE 4: Generation Agent ──
      // ★ Gate: when DL enabled, gate on datalayer data; when DL disabled, gate on mapping data
      const generationGateReady = skipDataLayer ? _mappingFetched.has(key) : _datalayerFetched.has(key)
      // Stop polling once Validation is triggered
      if (!isPausedInSingleMode && generationGateReady && (isSelected || !_generationFetched.has(key))) {
        _generationTriggered.add(key)
        if (!get().generationTriggered[wbId]) {
          set((state) => ({ generationTriggered: { ...state.generationTriggered, [wbId]: true } }))
        }
        
        const variants = AGENT_NAME_VARIANTS.generation
        let allActs: Activity[] = []
        const seenIds = new Set<string>()
        for (const v of variants) {
          const acts = await fetchWorkbookActivities(projectId, wbId, currentRunId, v)
          for (const a of acts) {
            if (a.id && seenIds.has(a.id)) continue
            if (a.id) seenIds.add(a.id)
            allActs.push(a)
          }
        }

        // ★ [SYNTHETIC LOGIC] If no real activities but data exists, create a sequence of detailed ones
        const genData = useGenerationStore.getState().generationData[wbId]
        if (allActs.length === 0 && genData) {
          const isErr = genData.status === 'failed' || !!get().error
          const syntheticActs: Activity[] = []
          
          if (isErr) {
            syntheticActs.push({
              id: `synth-gen-error-${wbId}`,
              project_name: "", run_id: currentRunId, status: 'failed', created_at: new Date().toISOString(),
              payload: genData, agent_name: "GenerationAgent",
              activity_summary: `Report Generation encountered an issue: ${genData.message || 'Processing error'}`,
              project_id: projectId, workbook_id: wbId, type: "synthetic"
            })
          } else {
            // Success sequence
            if (genData.summary?.tables_processed > 0) {
              syntheticActs.push({
                id: `synth-gen-tables-${wbId}`,
                project_name: "", run_id: currentRunId, status: 'completed', created_at: new Date(Date.now() - 5000).toISOString(),
                payload: genData, agent_name: "GenerationAgent",
                activity_summary: `Semantic Model: Successfully processed ${genData.summary.tables_processed} tables and ${genData.summary.measures_created || 0} measures.`,
                project_id: projectId, workbook_id: wbId, type: "synthetic"
              })
            }
            if (genData.summary?.visuals_generated > 0) {
              syntheticActs.push({
                id: `synth-gen-visuals-${wbId}`,
                project_name: "", run_id: currentRunId, status: 'completed', created_at: new Date(Date.now() - 3000).toISOString(),
                payload: genData, agent_name: "GenerationAgent",
                activity_summary: `Visual Assets: Generated ${genData.summary.visuals_generated} visuals across ${genData.summary.pages_generated} report pages.`,
                project_id: projectId, workbook_id: wbId, type: "synthetic"
              })
            }
            syntheticActs.push({
              id: `synth-gen-final-${wbId}`,
              project_name: "", run_id: currentRunId, status: 'completed', created_at: new Date().toISOString(),
              payload: genData, agent_name: "GenerationAgent",
              activity_summary: "Report Generation complete. Fabric Power BI report is now available for Validation.",
              project_id: projectId, workbook_id: wbId, type: "synthetic"
            })
          }
          
          allActs = syntheticActs
          
          // Inject into state
          set((state) => {
            const runMap = state.activities[currentRunId] || {}
            const currentList = runMap[wbId] || []
            return {
              activities: {
                ...state.activities,
                [currentRunId]: { 
                  ...runMap, 
                  [wbId]: [...currentList.filter(a => !matchesAgent(a.agent_name, 'generation')), ...syntheticActs] 
                }
              }
            }
          })
        }

        if (allActs.length > 0 && hasTerminalActivity(allActs)) {
          const isFail = allActs.some(a => ['failed', 'error'].includes(a.status?.toLowerCase()))
          if (isFail) {
            console.log(`[Generation] ❌ Failed response detected for ${wbId}`)
            console.log(`[Generation] 🛑 Migration halted due to generation failure for ${wbId}`)
          }
          _generationActivitiesDone.add(key)
          set((state) => ({ generationActivitiesDone: { ...state.generationActivitiesDone, [wbId]: true } }))
        } else if (useGenerationStore.getState().generationData[wbId]) {
          _generationEmptyActsCount.delete(key)
          _generationActivitiesDone.add(key)
          set((state) => ({ generationActivitiesDone: { ...state.generationActivitiesDone, [wbId]: true } }))
          console.log(`[Generation] ✅ Activities auto-resolved for ${wbId} (data available)`)
        } else {
          const count = (_generationEmptyActsCount.get(key) || 0) + 1
          _generationEmptyActsCount.set(key, count)
        }
      }

      // ── STAGE 5: Validation Agent ──
      if (!isPausedInSingleMode && get().manualValidationStarted[wbId] && _generationFetched.has(key) && (isSelected || !_validationFetched.has(key))) {
        _validationTriggered.add(key)
        if (!get().validationTriggered[wbId]) {
          set((state) => ({ validationTriggered: { ...state.validationTriggered, [wbId]: true } }))
        }
        
        const variants = AGENT_NAME_VARIANTS.validation
        let allActs: Activity[] = []
        const seenIds = new Set<string>()
        for (const v of variants) {
          const acts = await fetchWorkbookActivities(projectId, wbId, currentRunId, v)
          for (const a of acts) {
            if (a.id && seenIds.has(a.id)) continue
            if (a.id) seenIds.add(a.id)
            allActs.push(a)
          }
        }
        if (allActs.length > 0 && hasTerminalActivity(allActs)) {
          _validationActivitiesDone.add(key)
          set((state) => ({ validationActivitiesDone: { ...state.validationActivitiesDone, [wbId]: true } }))
        }
      }
    }
  },

  // ──────────────────────────────────────────
  // fetchAllAssessmentData
  // ★ Silently catches errors — never throws
  // ──────────────────────────────────────────
  fetchAllAssessmentData: async () => {
    const { currentRunId, currentWorkbookIds, assessmentData, getProjectIdForWorkbook } = get()
    if (!currentRunId || !currentWorkbookIds.length) return { allComplete: false }

    let allComplete = true

    for (const wb of currentWorkbookIds) {
      const key = wbKey(currentRunId, wb)
      if (_assessmentFetched.has(key)) continue
      // Do not block assessment polling based on activities

      const projectId = getProjectIdForWorkbook(wb)

      try {
        console.log(`[Assessment GET] Fetching for ${wb} (project: ${projectId})`)
        const query = `project_id=${projectId}&workbook_id=${wb}&run_id=${currentRunId}`
        const data = await fetchWithAuth<any>(`/api/assessment?${query}`)

        if (data && (data.status === 'completed' || data.status === 'success' || data.payload)) {
          _assessmentFetched.add(key)
          _consecutiveErrors = 0
          const cached = assessmentData[currentRunId]?.[wb]
          if (JSON.stringify(cached) !== JSON.stringify(data)) {
            set((state) => ({
              assessmentData: {
                ...state.assessmentData,
                [currentRunId]: {
                  ...state.assessmentData[currentRunId],
                  [wb]: data,
                },
              },
            }))
          }
          console.log(`[Assessment GET] ✅ Done for ${wb}`)
        } else {
          allComplete = false
        }
      } catch (err: any) {
        if (!err.message?.includes("404")) _consecutiveErrors++
        if (_consecutiveErrors <= 3 && !err.message?.includes("404")) {
          console.warn(`[Assessment GET] ${wb}: ${err.message?.slice(0, 80) || "error"}`)
        }
        allComplete = false
      }
    }

    return { allComplete }
  },

  // ── Helpers ──

  getActivitiesForWorkbook: (workbookId, runId) => {
    const { currentRunId, activities } = get()
    const targetRunId = runId || currentRunId
    if (!targetRunId) return []
    return activities[targetRunId]?.[workbookId] || []
  },

  getAssessmentForWorkbook: (wb, runId) => {
    const { currentRunId, assessmentData } = get()
    const targetRunId = runId || currentRunId
    return targetRunId ? assessmentData[targetRunId]?.[wb] : undefined
  },

  getAssessmentByItem: (_projectId, workbookId) => {
    const { currentRunId, assessmentData } = get()
    if (!currentRunId) return undefined
    return assessmentData[currentRunId]?.[workbookId]
  },

  // ──────────────────────────────────────────
  // POLLING
  // ★ Entire poll wrapped in try/catch — never crashes
  // ★ Stops after MAX_CONSECUTIVE_ERRORS (10) failures
  // ★ Sets isLoading=false on error cap so spinner disappears
  // ──────────────────────────────────────────

  startPolling: () => {
    if (get().isPolling) return
    set({ isPolling: true, isLoading: true })

    const poll = async () => {
      if (!get().migrationStarted) return get().stopPolling()

      const { currentRunId, currentWorkbookIds, getProjectIdForWorkbook } = get()
      if (!currentRunId || !currentWorkbookIds.length) return

      // ★ Helper to conditionally fetch stats
      const triggerStatsFetch = async () => {
        const now = Date.now()
        // Throttle to 10 seconds (10000ms)
        if (now - get().lastStatsFetchTime > 10000) {
          set({ lastStatsFetchTime: now })
          const email = (await import("@/stores/auth.store")).useAuthStore.getState().user?.email || ""
          if (email) {
            const dashStore = (await import("@/stores/dashboard.store")).useDashboardStore.getState()
            dashStore.fetchActiveRunStats(currentRunId, email)
          }
        }
      }

      // ★ Check if too many errors → stop polling, remove spinner
      if (_consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.warn(`[Polling] ⚠️ Too many errors (${_consecutiveErrors}). Stopping polling. Backend may be down.`)
        set({ isLoading: false, error: "Backend is not responding. Please try again later." })
        get().stopPolling()
        return
      }

      try {
        // Step 1: Fetch activities
        await get().fetchActivitiesForAllWorkbooks()

        // Step 2: Fetch assessment data (only after assessment activities are done)
        // ★ Gate: Assessment data is polled regardless (activities may arrive after data)
        await get().fetchAllAssessmentData()

        // Step 3: Fetch parsing data
        // ★ STRICT GATE: assessment DATA must be fetched AND parsing activities must be done
        for (const wbId of currentWorkbookIds) {
          const key = wbKey(currentRunId, wbId)
          if (useParsingStore.getState().parsingData[wbId]) {
            _parsingFetched.add(key)
          }
          if (_parsingFetched.has(key)) continue
          if (!_assessmentFetched.has(key)) continue
          if (!_parsingTriggered.has(key)) {
            console.log(`[Parsing GET] ⏳ Skipping ${wbId} — parsing agent not yet triggered`)
            continue
          }

          const projectId = getProjectIdForWorkbook(wbId)
          console.log(`[Parsing GET] Fetching for ${wbId} (project: ${projectId})`)
          try {
            await useParsingStore.getState().fetchParsingResult(projectId, wbId, currentRunId)

            const hasData = !!useParsingStore.getState().parsingData[wbId]

            if (hasData) {
              _parsingFetched.add(key)
              console.log(`[Parsing GET] ✅ Done for ${wbId}`)
              _consecutiveErrors = 0
            } else {
              console.log(`[Parsing GET] ⏳ Data not ready yet for ${wbId}, will retry`)
            }
          } catch (err: any) {
            console.warn(`[Parsing GET] ${wbId}: ${err.message?.slice(0, 80) || "error"}`)
            _parsingFetched.delete(key)
            if (!err.message?.includes("404")) _consecutiveErrors++
          }
        }

        // --- LITE MODE PAUSE GATE ---
        if (isLiteMode()) {
           // Check if Parsing is completely fetched for all selected workbooks
           const hasAllParsingData = currentWorkbookIds.every(id => {
             const key = wbKey(currentRunId, id)
             return _parsingFetched.has(key)
           });
           
           if (hasAllParsingData) {
              console.log("⏹️ Lite Mode parsing complete. Finalizing run and stopping polling.")
              set({ isLoading: false })

              try {
                const apps = useDashboardStore.getState().applications
                const assessData = get().assessmentData
                const processedItems = currentWorkbookIds.map(wbId => {
                  const assessment = assessData[currentRunId]?.[wbId]
                  const app = apps.find((a) => a.workbookId === wbId)
                  return {
                    workbook_id: wbId,
                    workbook_name: assessment?.workbook_name || assessment?.payload?.workbook_name || app?.workbookName || wbId,
                    project_id: getProjectIdForWorkbook(wbId),
                    project_name: app?.projectName || "",
                    final_status: "SUCCESS",
                    steps: { assessment: "completed", parsing: "completed" },
                  }
                })

                const partialRun = {
                  run_id: currentRunId,
                  created_at: new Date().toISOString(),
                  status: "SUCCESS",
                  execution_level: "partial",
                  payload: {
                    run_no: assessData[currentRunId]?.[currentWorkbookIds[0]]?.run_no || assessData[currentRunId]?.[currentWorkbookIds[0]]?.payload?.run_no || "",
                    timestamp: new Date().toISOString(),
                    processed_items: processedItems,
                  },
                }

                const existing = JSON.parse(localStorage.getItem("vl_partial_runs") || "[]")
                if (!existing.some((r: any) => r.run_id === currentRunId)) {
                  existing.unshift(partialRun)
                  localStorage.setItem("vl_partial_runs", JSON.stringify(existing.slice(0, 50)))
                }
              } catch (e) {}

              useDashboardStore.getState().finalizeRun()
              get().stopPolling()
           }
        }

        // --- INTERACTIVE MODE PAUSE GATE ---
        const uiState = useUIStore.getState()
        if (uiState.mode === 'single' && !uiState.hasContinued) {
           console.log("⛔ Paused after Parsing (Interactive Mode)")

           // --- Cleanup ghost triggered flags for SUBSEQUENT stages ---
           if (Object.keys(get().mappingTriggered).length > 0 || Object.keys(get().datalayerTriggered).length > 0) {
              set({ 
                mappingTriggered: {}, datalayerTriggered: {}, 
                generationTriggered: {}, validationTriggered: {} 
              })
              _mappingTriggered.clear()
              _datalayerTriggered.clear()
              _generationTriggered.clear()
              _validationTriggered.clear()
           }
           
           // Check if Parsing is completely fetched for all selected workbooks
           const hasAllParsingData = currentWorkbookIds.every(id => {
             const key = wbKey(currentRunId, id)
             return _parsingFetched.has(key)
           });
           
           if (hasAllParsingData) {
              console.log("⏹️ Parsing data complete. Stopping polling until user continues.")
              set({ isLoading: false })

              // ★ Save partial run to localStorage for Run History (now including parsing step)
              try {
                const apps = useDashboardStore.getState().applications
                const assessData = get().assessmentData
                const processedItems = currentWorkbookIds.map(wbId => {
                  const assessment = assessData[currentRunId]?.[wbId]
                  const app = apps.find((a) => a.workbookId === wbId)
                  return {
                    workbook_id: wbId,
                    workbook_name: assessment?.workbook_name || assessment?.payload?.workbook_name || app?.workbookName || wbId,
                    project_id: getProjectIdForWorkbook(wbId),
                    project_name: app?.projectName || "",
                    final_status: "SUCCESS",
                    steps: { assessment: "completed", parsing: "completed" },
                  }
                })

                const partialRun = {
                  run_id: currentRunId,
                  created_at: new Date().toISOString(),
                  status: "SUCCESS",
                  execution_level: "partial",
                  payload: {
                    run_no: assessData[currentRunId]?.[currentWorkbookIds[0]]?.run_no || assessData[currentRunId]?.[currentWorkbookIds[0]]?.payload?.run_no || "",
                    timestamp: new Date().toISOString(),
                    processed_items: processedItems,
                  },
                }

                const existing = JSON.parse(localStorage.getItem("vl_partial_runs") || "[]")
                if (!existing.some((r: any) => r.run_id === currentRunId)) {
                  existing.unshift(partialRun)
                  localStorage.setItem("vl_partial_runs", JSON.stringify(existing.slice(0, 50)))
                }
              } catch (e) {}

              // In lite mode, finalize the run completely so that the dashboard knows it is done.
              if (isLiteMode()) {
                useDashboardStore.getState().finalizeRun()
              }

           }
        }

        // Step 3.25: Fetch mapping data
        // ★ REORDERED: Mapping now fetches BEFORE Data Layer
        // ★ Gate: parsing DATA must be fetched AND mapping activities must be done
        for (const wbId of currentWorkbookIds) {
          const key = wbKey(currentRunId, wbId)
          if (useMappingStore.getState().mappingData[wbId]) {
            _mappingFetched.add(key)
          }
          if (_mappingFetched.has(key)) continue
          if (!_parsingFetched.has(key)) {
            console.log(`[Mapping GET] ⏳ Skipping ${wbId} — parsing data not yet available`)
            continue
          }
          if (!_mappingTriggered.has(key)) {
            console.log(`[Mapping GET] ⏳ Skipping ${wbId} — mapping agent not yet triggered`)
            continue
          }

          const projectId = getProjectIdForWorkbook(wbId)
          console.log(`[Mapping GET] Fetching for ${wbId} (project: ${projectId})`)
          try {
            await useMappingStore.getState().fetchMappingResult(projectId, wbId, currentRunId)

            const hasData = !!useMappingStore.getState().mappingData[wbId]

            if (hasData) {
              _mappingFetched.add(key)
              _mapping404Count.delete(key)
              console.log(`[Mapping GET] ✅ Done for ${wbId}`)
              _consecutiveErrors = 0
            } else {
              const count = (_mapping404Count.get(key) || 0) + 1
              _mapping404Count.set(key, count)
              console.log(`[Mapping GET] ⏳ Data not ready yet for ${wbId}, will retry (attempt ${count})`)
            }
          } catch (err: any) {
            const is404 = err.message?.includes('404')
            if (is404) {
              const count = (_mapping404Count.get(key) || 0) + 1
              _mapping404Count.set(key, count)
              console.log(`[Mapping GET] ⏳ 404 for ${wbId} (attempt ${count})`)
            }
            console.warn(`[Mapping GET] ${wbId}: ${err.message?.slice(0, 80) || "error"}`)
            if (!is404) _mappingFetched.delete(key)
            if (!is404) _consecutiveErrors++
          }
        }

        // Step 3.5: Fetch data layer data
        // ★ REORDERED: Data Layer now fetches AFTER Mapping
        // ★ STRICT GATE: mapping DATA must be fetched AND datalayer activities must be done
        // ★ SKIP entirely based on connection type or toggle
        // ★ FIX: Added _assessmentFetched validation to prevent premature triggering
        for (const wbId of currentWorkbookIds) {
          const key = wbKey(currentRunId, wbId)
          
          if (useDatalayerStore.getState().datalayerData[wbId]) {
            _datalayerFetched.add(key)
          }
          
          // CRITICAL: Ensure assessment is loaded before proceeding
          if (!_assessmentFetched.has(key)) {
            console.log(`[DataLayer GET] ⏳ Skipping ${wbId} — assessment data not yet available`)
            continue
          }
          
          const skipDL = get().shouldSkipDataLayer(wbId)
          if (skipDL) continue
          
          if (_datalayerFetched.has(key)) continue
          if (!_mappingFetched.has(key)) {
            console.log(`[DataLayer GET] ⏳ Skipping ${wbId} — mapping data not yet available`)
            continue
          }
          if (!_datalayerTriggered.has(key)) {
            console.log(`[DataLayer GET] ⏳ Skipping ${wbId} — datalayer agent not yet triggered`)
            continue
          }

          const projectId = getProjectIdForWorkbook(wbId)
          console.log(`[DataLayer GET] Fetching for ${wbId} (project: ${projectId})`)
          try {
            await useDatalayerStore.getState().fetchDataLayerResult(projectId, wbId, currentRunId)

            const hasData = !!useDatalayerStore.getState().datalayerData[wbId]

            if (hasData) {
              _datalayerFetched.add(key)
              _datalayer404Count.delete(key) // Reset on success
              console.log(`[DataLayer GET] ✅ Done for ${wbId}`)
              _consecutiveErrors = 0
            } else {
              // Track consecutive 404/empty responses
              const count = (_datalayer404Count.get(key) || 0) + 1
              _datalayer404Count.set(key, count)
              console.log(`[DataLayer GET] ⏳ Data not ready yet for ${wbId}, will retry (attempt ${count})`)
            }
          } catch (err: any) {
            const is404 = err.message?.includes('404')
            if (is404) {
              const count = (_datalayer404Count.get(key) || 0) + 1
              _datalayer404Count.set(key, count)
              console.log(`[DataLayer GET] ⏳ 404 for ${wbId} (attempt ${count})`)
            }
            console.warn(`[DataLayer GET] ${wbId}: ${err.message?.slice(0, 80) || "error"}`)
            _datalayerFetched.delete(key)
            if (!err.message?.includes("404")) _consecutiveErrors++
          }
        }

        // Step 4: Fetch generation data
        // ★ Gate: when DL enabled, gate on datalayer DATA; when DL disabled, gate on mapping DATA
        for (const wbId of currentWorkbookIds) {
          const key = wbKey(currentRunId, wbId)
          if (useGenerationStore.getState().generationData[wbId]) {
            _generationFetched.add(key)
          }
          if (_generationFetched.has(key)) continue
          
          const skipDL = get().shouldSkipDataLayer(wbId)
          const generationGateOk = skipDL ? _mappingFetched.has(key) : _datalayerFetched.has(key)
          
          if (!generationGateOk) {
            console.log(`[Generation GET] ⏳ Skipping ${wbId} — ${skipDL ? 'mapping' : 'datalayer'} data not yet available`)
            continue
          }
          if (!_generationTriggered.has(key)) {
            console.log(`[Generation GET] ⏳ Skipping ${wbId} — generation agent not yet triggered`)
            continue
          }

          const projectId = getProjectIdForWorkbook(wbId)
          console.log(`[Generation GET] Fetching for ${wbId} (project: ${projectId})`)
          try {
            await useGenerationStore.getState().fetchGenerationResult(projectId, wbId, currentRunId)

            const hasData = !!useGenerationStore.getState().generationData[wbId]

            if (hasData) {
              const genData = useGenerationStore.getState().generationData[wbId]
              const status = (genData?.status || "").toLowerCase()
              const isFail = status === 'failed' || status === 'error'

              if (isFail) {
                console.log(`[Generation] ❌ Failed response detected for ${wbId}`)
                console.log(`[Generation] 🛑 Migration halted due to generation failure for ${wbId}`)
                console.log(`[Validation] ⏩ Skipped because generation failed for ${wbId}`)
                _generationFetched.add(key)
                _consecutiveErrors = 0
                continue; // Stop processing this workbook further, but allow others
              }

              _generationFetched.add(key)
              _generation404Count.delete(key)
              console.log(`[Generation GET] ✅ Done for ${wbId}`)
              _consecutiveErrors = 0
            } else {
              const count = (_generation404Count.get(key) || 0) + 1
              _generation404Count.set(key, count)
              console.log(`[Generation GET] ⏳ Data not ready yet for ${wbId}, will retry (attempt ${count})`)
            }
          } catch (err: any) {
            const is404 = err.message?.includes('404')
            if (is404) {
              const count = (_generation404Count.get(key) || 0) + 1
              _generation404Count.set(key, count)
              console.log(`[Generation GET] ⏳ 404 for ${wbId} (attempt ${count})`)
            }
            console.warn(`[Generation GET] ${wbId}: ${err.message?.slice(0, 80) || "error"}`)
            if (!is404) _generationFetched.delete(key)
            if (!is404) _consecutiveErrors++
          }
        }

        // Step 5: Fetch validation data
        // ★ STRICT GATE: generation DATA must be fetched AND validation activities must be done
        for (const wbId of currentWorkbookIds) {
          const key = wbKey(currentRunId, wbId)
          if (useValidationStore.getState().validationData[wbId]) {
            const data = useValidationStore.getState().validationData[wbId]
            const status = (data?.status || "").toLowerCase()
            const TERMINAL_RESULTS = ["completed", "failed", "success", "error", "partial", "pass", "fail"]
            if (TERMINAL_RESULTS.includes(status)) {
              _validationFetched.add(key)
            }
          }
          if (_validationFetched.has(key)) continue
          if (!get().manualValidationStarted[wbId]) continue
          if (!_generationFetched.has(key)) {
            console.log(`[Validation GET] ⏳ Skipping ${wbId} — generation data not yet available`)
            continue
          }
          if (!_validationTriggered.has(key)) {
            console.log(`[Validation GET] ⏳ Skipping ${wbId} — validation agent not yet triggered`)
            continue
          }

          const projectId = getProjectIdForWorkbook(wbId)
          console.log(`[Validation GET] Fetching for ${wbId} (project: ${projectId})`)
          try {
            await useValidationStore.getState().fetchValidationResult(projectId, wbId, currentRunId)

            const data = useValidationStore.getState().validationData[wbId]
            const hasData = !!data
            
            const status = (data?.status || "").toLowerCase()
            const TERMINAL_RESULTS = ["completed", "failed", "success", "error", "partial", "pass", "fail"]
            const isFinished = TERMINAL_RESULTS.includes(status)

            if (hasData && isFinished) {
              _validationFetched.add(key)
              console.log(`[Validation GET] ✅ Terminal (${status}) for ${wbId}`)
              _consecutiveErrors = 0
            } else if (hasData) {
              console.log(`[Validation GET] ⏳ Data received (status: ${status || 'unknown'}), continuing polling for ${wbId}...`)
            } else {
              console.log(`[Validation GET] ⏳ Data not ready yet for ${wbId}, will retry`)
            }
          } catch (err: any) {
            console.warn(`[Validation GET] ${wbId}: ${err.message?.slice(0, 80) || "error"}`)
            _validationFetched.delete(key)
            if (!err.message?.includes("404")) _consecutiveErrors++
          }
        }

        // Step 4: All done? Stop polling only when ALL DATA has been fetched.
        // Don't stop just because agents completed — data takes time to appear in cosmos.
        // ★ When data layer is disabled, skip _datalayerFetched from the check
        const allDataFetchedUpToGeneration = currentWorkbookIds.every(id => {
          const key = wbKey(currentRunId, id)
          const skipDL = get().shouldSkipDataLayer(id)
          return _assessmentFetched.has(key) &&
            _parsingFetched.has(key) &&
            (skipDL ? true : _datalayerFetched.has(key)) &&
            _mappingFetched.has(key) &&
            _generationFetched.has(key)
        })

        if (allDataFetchedUpToGeneration) {
           const anyValidationStarted = currentWorkbookIds.some(id => get().manualValidationStarted[id])
           const allValidationFetched = currentWorkbookIds.every(id => {
             return _validationFetched.has(wbKey(currentRunId, id))
           })
           
           if (!anyValidationStarted) {
             console.log("⏹️ Generation data complete. Pausing polling until user triggers Validation manually.")
             
             // ★ Save partial run to localStorage for Run History
             try {
                const apps = useDashboardStore.getState().applications
                const assessData = get().assessmentData
                const processedItems = currentWorkbookIds.map(wbId => {
                  const assessment = assessData[currentRunId]?.[wbId]
                  const app = apps.find((a) => a.workbookId === wbId)
                  return {
                    workbook_id: wbId,
                    workbook_name: assessment?.workbook_name || assessment?.payload?.workbook_name || app?.workbookName || wbId,
                    project_id: getProjectIdForWorkbook(wbId),
                    project_name: app?.projectName || "",
                    final_status: "PARTIAL",
                    steps: { assessment: "completed", parsing: "completed", mapping: "completed", generation: "completed" },
                  }
                })
                
                const dashRunNo = useDashboardStore.getState().runNo || assessData[currentRunId]?.[currentWorkbookIds[0]]?.payload?.run_no || "";

                const partialRun = {
                  run_id: currentRunId,
                  created_at: new Date().toISOString(),
                  status: "PARTIAL",
                  execution_level: "partial",
                  payload: {
                    run_no: dashRunNo,
                    timestamp: new Date().toISOString(),
                    processed_items: processedItems,
                  },
                }

                const existing = JSON.parse(localStorage.getItem("vl_partial_runs") || "[]")
                const existingIndex = existing.findIndex((r: any) => r.run_id === currentRunId)
                if (existingIndex !== -1) {
                  existing[existingIndex] = partialRun
                } else {
                  existing.unshift(partialRun)
                }
                localStorage.setItem("vl_partial_runs", JSON.stringify(existing.slice(0, 50)))
                console.log("[Partial Run] Validation paused, saved to localStorage: " + currentRunId)
             } catch (e) {
                console.warn("[Partial Run] Failed to save to localStorage:", e)
             }

             set({ isLoading: false })
             get().stopPolling()
             return;
           }

           if (allValidationFetched) {
              console.log("\n🎉 ALL DATA FETCHED — Stopping polling.\n")
              set({ isLoading: false, isBulkValidationLoading: false })
              get().stopPolling()
             useDashboardStore.getState().finalizeRun()
           }
        }

        // Always trigger stats fetch to ensure the dashboard remains up to date
        // as workbooks progress through different phases at different times.
        triggerStatsFetch()

      } catch (err: any) {
        // ★ Catch-all: never let poll crash
        _consecutiveErrors++
        console.warn(`[Polling] Error (${_consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err.message?.slice(0, 80) || "unknown"}`)
      } finally {
        // Schedule the next poll only if we are still polling
        if (get().isPolling && (typeof document === "undefined" || !document.hidden)) {
          const timeout = setTimeout(poll, 8000)
            ; (get() as any)._timeout = timeout
        }
      }
    }

    const visibilityHandler = () => {
      if (document.hidden || !get().isPolling) return
      const timeout = (get() as any)._timeout
      if (timeout) clearTimeout(timeout)
      ; (get() as any)._timeout = undefined
      poll()
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", visibilityHandler)
      ; (get() as any)._visibilityHandler = visibilityHandler
    }

    poll()
  },

  stopPolling: () => {
    const timeout = (get() as any)._timeout
    if (timeout) clearTimeout(timeout)
    const visibilityHandler = (get() as any)._visibilityHandler
    if (visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", visibilityHandler)
    }
    ; (get() as any)._timeout = undefined
    ; (get() as any)._visibilityHandler = undefined
    set({ isPolling: false })
  },

  clearData: () => {
    get().stopPolling()
    resetTrackers()
    set({
      currentRunId: null,
      currentProjectId: null,
      currentWorkbookIds: [],
      workbookProjectMap: {},
      assessmentData: {},
      activities: {},
      agents: {},
      isLoading: false,
      error: null,
      migrationStarted: false,
      lastStatsFetchTime: 0,
      assessmentActivitiesDone: {},
      parsingActivitiesDone: {},
      datalayerActivitiesDone: {},
      mappingActivitiesDone: {},
      generationActivitiesDone: {},
      validationActivitiesDone: {},
      isBulkValidationLoading: false,
      parsingTriggered: {},
      datalayerTriggered: {},
      mappingTriggered: {},
      generationTriggered: {},
      validationTriggered: {},
    })
  },
}))
