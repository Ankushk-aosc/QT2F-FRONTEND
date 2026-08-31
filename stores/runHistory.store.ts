import { create } from "zustand"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { getTimeframeBoundaries } from "@/lib/utils"
import { RUN_STATUS_POLL_INTERVAL_MS, DEFAULT_PAGE_SIZE } from "@/lib/constants"
import { useUIStore } from "./ui.store"

export interface RunHistoryItem {
  run_id: string
  project_id: string
  project_name: string
  workbook_id: string
  workbook_name: string
  created_at: string
  overall_status: string
  assessment_status: string
  parsing_status: string
  datalayer_status: string
  mapping_status: string
  generation_status: string
  validation_status: string
  error?: string
  processed_items?: any[]
  execution_level?: string
  project_type?: string
  workbook_type?: string
  site_type?: string
  raw_timestamp?: string
  run_no?: string
  connection_id?: string
  server_url?: string
}

interface RunHistoryPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface RunHistoryFilters {
  status?: string
  search?: string
  timeframe?: string
}

interface RunHistoryFetchOptions {
  page?: number
  pageSize?: number
  silent?: boolean
  force?: boolean
  filters?: RunHistoryFilters
}

interface RunHistoryState {
  runHistory: RunHistoryItem[]
  currentPageRunHistory: RunHistoryItem[]
  pagination: RunHistoryPagination
  lastEmail: string | null
  lastFilters: RunHistoryFilters | null
  isLoading: boolean
  hasFetched: boolean
  error: string | null
  fetchRunHistory: (email: string, options?: RunHistoryFetchOptions) => Promise<void>

  // Navigation and UI state to preserve across tab switches
  selectedHistoricalRunId: string
  setSelectedHistoricalRunId: (id: string) => void
  historyLevel: "runs" | "workbooks"
  setHistoryLevel: (level: "runs" | "workbooks") => void
  timeframe: string
  setTimeframe: (timeframe: string) => void
  statusFilter: string
  setStatusFilter: (filter: string) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  currentPage: number
  setCurrentPage: (page: number | ((prev: number) => number)) => void

  // Active polling methods
  startPolling: (email: string, runId: string) => void
  stopPolling: (runId: string) => void
  stopAllPolling: () => void
}

// Registry for active polling timers. Stored outside Zustand to prevent re-renders on timer updates.
const activePolls: Record<string, NodeJS.Timeout> = {}

export const useRunHistoryStore = create<RunHistoryState>((set, get) => ({
  runHistory: [],
  currentPageRunHistory: [],
  pagination: {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  },
  lastEmail: null,
  lastFilters: null,
  isLoading: false,
  hasFetched: false,
  error: null,

  // Navigation and UI state initial values and setters
  selectedHistoricalRunId: "",
  setSelectedHistoricalRunId: (id) => set({ selectedHistoricalRunId: id }),
  historyLevel: "runs",
  setHistoryLevel: (level) => set({ historyLevel: level }),
  timeframe: "All",
  setTimeframe: (timeframe) => set({ timeframe }),
  statusFilter: "All",
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  currentPage: 1,
  setCurrentPage: (page) =>
    set((state) => ({
      currentPage: typeof page === "function" ? page(state.currentPage) : page,
    })),

  startPolling: (email: string, runId: string) => {
    if (activePolls[runId]) return // Prevent duplicate polling loops

    const poll = async () => {
      try {
        const response = await fetchWithAuth<any>(`/api/record/semantic-kernel?run_id=${runId}`)
        
        let item = response
        if (Array.isArray(response) && response.length > 0) {
           item = response[0]
        } else if (response?.data && Array.isArray(response.data)) {
           item = response.data[0]
        } else if (response?.items && Array.isArray(response.items)) {
           item = response.items[0]
        } else if (response?.records && Array.isArray(response.records)) {
           item = response.records[0]
        } else if (response?.runs && Array.isArray(response.runs)) {
           item = response.runs[0]
        }

        if (!item || !item.status) {
           activePolls[runId] = setTimeout(poll, RUN_STATUS_POLL_INTERVAL_MS)
           return
        }

        const mappedItem = mapRunHistoryItem(item, false)

        set((state) => {
           const updateList = (list: RunHistoryItem[]) => {
              const newList = [...list]
              const idx = newList.findIndex(r => r.run_id === runId)
              if (idx !== -1) {
                  newList[idx] = mappedItem
              } else {
                  newList.unshift(mappedItem)
              }
              return newList
           }

           return {
              runHistory: updateList(state.runHistory),
              currentPageRunHistory: updateList(state.currentPageRunHistory)
           }
        })

        const status = (mappedItem.overall_status || "").toLowerCase()
        const terminalStates = ['completed', 'failed', 'cancelled', 'error', 'success', 'pass', 'fail', 'partial', 'validation_failed', 'full_migration_completed', 'lite_migration_completed']
        
        if (terminalStates.includes(status)) {
            get().stopPolling(runId)
            get().fetchRunHistory(email, { force: true, silent: true })
            return
        }

        let delay = RUN_STATUS_POLL_INTERVAL_MS
        if (typeof document !== 'undefined' && document.hidden) {
            delay = 60000
        } else {
            const createdAt = new Date(mappedItem.created_at || mappedItem.raw_timestamp || Date.now()).getTime()
            const elapsed = Date.now() - createdAt
            if (elapsed < 2 * 60 * 1000) delay = RUN_STATUS_POLL_INTERVAL_MS
            else if (elapsed < 10 * 60 * 1000) delay = 10000
            else delay = 20000
        }
        
        activePolls[runId] = setTimeout(poll, delay)
      } catch (err) {
        console.error(`[RunHistory] Polling failed for run_id ${runId}:`, err)
        let delay = RUN_STATUS_POLL_INTERVAL_MS
        if (typeof document !== 'undefined' && document.hidden) delay = 60000
        activePolls[runId] = setTimeout(poll, delay)
      }
    }

    activePolls[runId] = setTimeout(poll, 0)
  },

  stopPolling: (runId: string) => {
    if (activePolls[runId]) {
      clearTimeout(activePolls[runId])
      delete activePolls[runId]
    }
  },

  stopAllPolling: () => {
    Object.keys(activePolls).forEach(runId => {
      clearTimeout(activePolls[runId])
      delete activePolls[runId]
    })
  },

  fetchRunHistory: async (email: string, options?: RunHistoryFetchOptions) => {
    if (!email) return

    const page = Math.max(1, options?.page ?? 1)
    const pageSize = Math.max(1, options?.pageSize ?? DEFAULT_PAGE_SIZE)
    const silent = options?.silent ?? false
    const force = options?.force ?? false
    const filters = options?.filters ?? {}
    const state = get()

    const filtersMatch = JSON.stringify(state.lastFilters) === JSON.stringify(filters)

    if (
      !force &&
      state.hasFetched &&
      state.lastEmail === email &&
      state.pagination.page === page &&
      state.pagination.pageSize === pageSize &&
      filtersMatch &&
      state.currentPageRunHistory.length > 0
    ) {
      return
    }

    if (state.isLoading) return
    if (!silent) set({ isLoading: true, error: null })

    try {
      const query = new URLSearchParams({
        email_id: email,
        page: String(page),
        page_size: String(pageSize),
      })

      const timeZone = useUIStore.getState().timezone || "UTC"
      applyRunHistoryFilters(query, filters, timeZone)

      const responseData = await fetchWithAuth<any>(`/api/record/semantic-kernel?${query.toString()}`)
      const apiItems = extractArray(responseData)
      const mappedData = apiItems.map((item: any) => mapRunHistoryItem(item, false))

      // Merge locally-saved partial runs so validation and detail views keep seeing them.
      let localPartials: any[] = []
      try {
        localPartials = JSON.parse(localStorage.getItem("vl_partial_runs") || "[]")
      } catch {
        localPartials = []
      }

      const apiRunIds = new Set(mappedData.map((run: RunHistoryItem) => run.run_id))
      const remainingPartials = localPartials.filter((partial: any) => !apiRunIds.has(partial.run_id))

      if (remainingPartials.length !== localPartials.length) {
        try {
          localStorage.setItem("vl_partial_runs", JSON.stringify(remainingPartials))
        } catch {
          // Ignore storage failures.
        }
      }

      const mappedPartials = remainingPartials.map((item: any) => mapRunHistoryItem(item, true))
      const currentPageRunHistory = sortByCreatedAtDesc(
        page === 1 ? [...mappedPartials, ...mappedData] : mappedData
      ).slice(0, pageSize)

      const mergedRunHistory = mergeRunHistoryCache(state.runHistory, mappedData, mappedPartials)
      const pagination = extractPaginationMeta(responseData, page, pageSize, mappedData.length)
      const hasActiveFilters = hasRunHistoryFilters(filters)
      const gotFullPage = mappedData.length >= pageSize
      const needsAuthoritativeTotal = hasActiveFilters || (gotFullPage && pagination.totalPages <= 1 && pagination.total <= pageSize)

      if (needsAuthoritativeTotal) {
        try {
          const summaryQuery = new URLSearchParams({ email_id: email })
          const timeZone = useUIStore.getState().timezone || "UTC"
          applyRunHistoryFilters(summaryQuery, filters, timeZone)

          const summaryResponse = await fetchWithAuth<any>(`/api/monitoring-summary?${summaryQuery.toString()}`)
          const summaryTotal = Number(summaryResponse?.total_runs ?? summaryResponse?.totalRuns ?? 0)

          if (summaryTotal > 0 || hasActiveFilters) {
            pagination.total = summaryTotal
            pagination.totalPages = Math.max(1, Math.ceil(summaryTotal / pageSize))
            pagination.page = Math.min(page, Math.max(1, pagination.totalPages))
          } else if (gotFullPage) {
            pagination.totalPages = Math.max(2, pagination.totalPages)
          }
        } catch {
          if (gotFullPage) {
            pagination.totalPages = Math.max(2, pagination.totalPages)
          }
        }
      }

      set({
        runHistory: mergedRunHistory,
        currentPageRunHistory,
        pagination,
        lastEmail: email,
        lastFilters: filters,
        isLoading: false,
        hasFetched: true,
      })
    } catch (err: any) {
      set({ error: err.message, isLoading: false, hasFetched: true })
    }
  },
}))

function extractArray(response: any): any[] {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.items)) return response.items
  if (Array.isArray(response?.records)) return response.records
  if (Array.isArray(response?.result)) return response.result
  if (Array.isArray(response?.runs)) return response.runs
  return []
}

function hasRunHistoryFilters(filters: RunHistoryFilters): boolean {
  return Boolean(
    (filters.status && filters.status !== "All") ||
      filters.search ||
      (filters.timeframe && filters.timeframe !== "All")
  )
}

function applyRunHistoryFilters(query: URLSearchParams, filters: RunHistoryFilters, timeZone: string) {
  if (filters.status && filters.status !== "All") {
    query.set("status", filters.status.toLowerCase())
  }

  if (filters.search) {
    query.set("search", filters.search)
  }

  if (!filters.timeframe || filters.timeframe === "All") {
    return
  }

  const { start, end } = getTimeframeBoundaries(filters.timeframe, timeZone)

  const createdFrom = start.toISOString().replace(".000", "")
  const createdTo = end.toISOString().replace(".000", "")

  query.set("created_from", createdFrom)
  query.set("created_to", createdTo)

}

function extractPaginationMeta(response: any, page: number, pageSize: number, currentCount: number): RunHistoryPagination {
  const total = Number(
    response?.total ??
      response?.total_count ??
      response?.count ??
      response?.pagination?.total ??
      response?.pagination?.total_count ??
      currentCount
  ) || currentCount

  const resolvedPageSize = pageSize
  const resolvedPage = Number(response?.page ?? response?.pagination?.page ?? page) || page
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, resolvedPageSize)))

  return {
    page: resolvedPage,
    pageSize: resolvedPageSize,
    total,
    totalPages,
  }
}

function mergeRunHistoryCache(existing: RunHistoryItem[], ...groups: RunHistoryItem[][]): RunHistoryItem[] {
  const cache = new Map<string, RunHistoryItem>()

  existing.forEach((item) => {
    if (item?.run_id) cache.set(item.run_id, item)
  })

  groups.flat().forEach((item) => {
    if (item?.run_id) cache.set(item.run_id, item)
  })

  return sortByCreatedAtDesc(Array.from(cache.values()))
}

// run_no is stored as a string like "R-42" -- comparing it as a string sorts
// "R-10" before "R-9" lexically, which reads as "not ordered by run number"
// even though a sort was technically happening (by created_at). Parse the
// numeric suffix and compare numerically; fall back to created_at when
// either side has no parseable run_no, so unnumbered/partial entries don't
// get sorted to an arbitrary end.
function parseRunNo(runNo: string | undefined): number | null {
  if (!runNo) return null
  const match = String(runNo).match(/(\d+)/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

function sortByCreatedAtDesc(items: RunHistoryItem[]): RunHistoryItem[] {
  return [...items].sort((a, b) => {
    const aNo = parseRunNo(a.run_no)
    const bNo = parseRunNo(b.run_no)
    if (aNo !== null && bNo !== null && aNo !== bNo) {
      return bNo - aNo
    }
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })
}

export function mapRunHistoryItem(item: any, isPartial: boolean): RunHistoryItem {
  const processed = item.payload?.processed_items || item.payload?.parsed_items || item.processed_items || item.parsed_items || []
  const first = processed[0] || {}

  let displayWorkbookName =
    first.workbook_name ||
    first.app_name ||
    item.workbook_name ||
    item.app_name ||
    item.payload?.workbook_name ||
    item.payload?.app_name ||
    item.payload?.workbookName ||
    ""
  let displayWorkbookId =
    first.workbook_id ||
    first.app_id ||
    item.workbook_id ||
    item.app_id ||
    item.payload?.workbook_id ||
    item.payload?.app_id ||
    item.payload?.workbookId ||
    ""

  const totalCount = item.total_apps || item.total_workbooks || (processed.length > 0 ? processed.length : 0)
  if (totalCount > 1 || processed.length > 1) {
    displayWorkbookName = `${totalCount || processed.length} Items`
    displayWorkbookId = "multiple"
  }

  const displayProjectName =
    first.project_name ||
    first.space_name ||
    first.workspace_name ||
    item.project_name ||
    item.space_name ||
    item.workspace_name ||
    item.payload?.project_name ||
    item.payload?.space_name ||
    item.payload?.workspace_name ||
    (item.workspace_id ? `Space (${item.workspace_id})` : "") ||
    ""
  const displayProjectId =
    first.project_id ||
    first.space_id ||
    first.workspace_id ||
    item.project_id ||
    item.space_id ||
    item.workspace_id ||
    item.payload?.project_id ||
    item.payload?.workspace_id ||
    ""

  const createdAt =
    item.created_at ||
    item.start_date_time ||
    item.timestamp ||
    item.payload?.timestamp ||
    item.raw_timestamp ||
    new Date().toISOString()

  let rawStatus = item.status || ""
  let parsedStatus = rawStatus
  const match = rawStatus.match(/^\(([^)]+)\)/)
  if (match) {
    parsedStatus = match[1]
  }

  if (typeof parsedStatus === "string" && (parsedStatus.includes("Total Workbooks:") || parsedStatus.includes("Total Apps:"))) {
    const isCompletedText = parsedStatus.includes("Migration Complete") || parsedStatus.includes("Migration Completed")
    const failedMatch = parsedStatus.match(/Failed:\s*([1-9]\d*)/i)
    const cancelledMatch = parsedStatus.match(/Cancelled:\s*([1-9]\d*)/i)
    const pendingMatch = parsedStatus.match(/Pending:\s*([1-9]\d*)/i)

    if (failedMatch) {
      parsedStatus = "failed"
    } else if (cancelledMatch) {
      parsedStatus = "cancelled"
    } else if (pendingMatch) {
      parsedStatus = "pending"
    } else if (isCompletedText) {
      parsedStatus = "completed"
    } else {
      parsedStatus = "completed"
    }
  }

  const parentStatus = parsedStatus.toLowerCase()
  const isParentTerminalState = ["cancelled", "stopped", "failed", "error"].includes(parentStatus)

  return {
    ...item,
    status: parsedStatus,
    run_id: item.run_id,
    project_id: displayProjectId,
    project_name: displayProjectName,
    workbook_id: displayWorkbookId,
    workbook_name: displayWorkbookName,
    created_at: createdAt,
    overall_status: isPartial
      ? "SUCCESS"
      : isParentTerminalState
      ? parsedStatus
      : first.final_status || parsedStatus || "UNKNOWN",
    assessment_status: first.steps?.assessment || item.assessment_status || "",
    parsing_status: first.steps?.parsing || first.steps?.["Parsing Agent"] || item.parsing_status || "",
    datalayer_status:
      first.steps?.datalayer ||
      first.steps?.data_layer ||
      first.steps?.["Data Layer"] ||
      first.steps?.datalayer_agent ||
      "",
    mapping_status: first.steps?.mapping || first.steps?.["Mapping Agent"] || item.mapping_status || "",
    generation_status:
      first.steps?.generation ||
      first.steps?.report_generation ||
      first.steps?.generation_agent ||
      first.steps?.["Generation Agent"] ||
      first.steps?.["Report Generation"] ||
      item.report_generation_status ||
      "",
    validation_status: first.steps?.validation || first.steps?.["Validation Agent"] || item.validation_status || "",
    run_no: item.run_no
      ? String(item.run_no)
      : item.payload?.run_no
      ? String(item.payload.run_no)
      : item.runNo
      ? String(item.runNo)
      : "",
    processed_items: processed,
    execution_level: item.execution_level || (isPartial ? "partial" : ""),
    project_type: item.project_type || item.workspace_type || "",
    workbook_type: item.workbook_type || item.app_type || "",
    site_type: item.site_type || "",
    raw_timestamp: item.payload?.timestamp || item.start_date_time || item.created_at || createdAt,
    connection_id: first.connection_id || item.connection_id || item.payload?.connection_id || undefined,
    server_url: first.server_url || item.server_url || item.payload?.server_url || undefined,
  }
}
