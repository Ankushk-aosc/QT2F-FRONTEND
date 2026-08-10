// stores/monitoring.store.ts
import { monitoringService, type LogEntry, type MonitoringSummary } from "@/services/monitoring.service";
import { create } from "zustand";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useAuthStore } from "@/stores/auth.store";

// ── Types ─────────────────────────────────────────────────────────────────

interface MonitoringState {
    /** Logs keyed by "<agentName>|<workbookId>|<runId>" for cache-safe lookup */
    logs: Record<string, LogEntry[]>;
    /** Agents currently loading */
    loadingAgents: Set<string>;
    /** Historical runs loading state */
    loadingRuns: boolean;
    /** Active runs loading state */
    loadingActiveRuns: boolean;
    /** Summary cards data */
    summary: MonitoringSummary | null;
    /** Summary loading state */
    loadingSummary: boolean;
    /** Historical runs from Cosmos DB */
    historicalRuns: any[]; // Or use HistoricalRun from service
    /** Last history query key used to populate the cache */
    historicalRunsQueryKey: string | null;
    /** Last summary query key used to populate summary cache */
    summaryQueryKey: string | null;
    /** Pagination metadata for historical runs */
    historicalRunsPagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
    /** Per-agent errors keyed by the same cache key */
    errors: Record<string, string | null>;
    /** Active runs currently processing */
    activeRuns: any[];
    /** List of manually stopped run IDs */
    stoppedRunIds: string[];

    // Actions
    fetchRunLogs: (
        projectId: string,
        workbookId: string,
        runId: string,
        force?: boolean,
        silent?: boolean
    ) => Promise<void>;

    fetchMonitoringSummary: (email?: string, projectId?: string, force?: boolean, silent?: boolean) => Promise<void>;

    fetchHistoricalRuns: (
        projectId?: string,
        email?: string,
        options?: { page?: number; pageSize?: number; force?: boolean; silent?: boolean }
    ) => Promise<void>;

    fetchActiveRuns: (email?: string) => Promise<void>;

    clearLogsForRun: (runId: string) => void;
    getLogsForRun: (workbookId: string, runId: string) => LogEntry[];
    isLoadingRun: (workbookId: string, runId: string) => boolean;
    getErrorForRun: (workbookId: string, runId: string) => string | null;
    stopRun: (runId: string) => Promise<any>;
}

// ── Cache key helper ──────────────────────────────────────────────────────

function cacheKey(workbookId: string, runId: string) {
    return `${workbookId}|${runId}`;
}

let latestHistoricalRunsRequestId = 0;

function getPageSizeFromSummary(state: MonitoringState) {
    return state.historicalRunsPagination.pageSize || 10;
}

function shouldTraceMonitoringPagination() {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("vl_trace_monitoring_pagination") === "1";
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
    logs: {},
    loadingAgents: new Set(),
    loadingRuns: false,
    loadingActiveRuns: false,
    loadingSummary: false,
    summary: null,
    historicalRuns: [],
    historicalRunsQueryKey: null,
    summaryQueryKey: null,
    historicalRunsPagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
    },
    errors: {},
    activeRuns: [],
    stoppedRunIds: [],

    fetchHistoricalRuns: async (projectId?: string, email?: string, options?: { page?: number; pageSize?: number; force?: boolean; silent?: boolean }) => {
        const state = get();
        const page = Math.max(1, options?.page ?? 1);
        const pageSize = Math.max(1, options?.pageSize ?? 10);
        const force = options?.force ?? false;
        const silent = options?.silent ?? false;
        const queryKey = `${projectId || ""}|${email || ""}|${page}|${pageSize}`;
        const requestId = ++latestHistoricalRunsRequestId;
        const trace = shouldTraceMonitoringPagination();

        if (trace) {
            console.debug("[MonitoringPagination][request:start]", {
                requestId,
                page,
                pageSize,
                force,
                silent,
                queryKey,
                currentStorePage: state.historicalRunsPagination.page,
                currentStoreQueryKey: state.historicalRunsQueryKey,
            });
        }

        if (!force && state.historicalRunsQueryKey === queryKey && state.historicalRuns.length > 0) {
            if (trace) {
                console.debug("[MonitoringPagination][request:skip-cache-hit]", {
                    requestId,
                    queryKey,
                    cachedItems: state.historicalRuns.length,
                });
            }
            return;
        }

        if (!silent) set({ loadingRuns: true });
        try {
            const result = await monitoringService.fetchHistoricalRuns(projectId, email, page, pageSize);
            // Re-read fresh state after await — summary may have loaded in the meantime
            const freshState = get();
            // Prioritize summary total_runs as authoritative; only fall back to API result if summary not available
            const summaryTotal = freshState.summary?.total_runs;
            const total = summaryTotal || result.total || result.items.length;
            // Always recalculate totalPages from the authoritative total rather than trusting the API's totalPages,
            // because the API may return totalPages: 1 based only on its own limited result set
            let totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
            
            // Heuristic: if we got a full page of results with no summary yet, assume there might be more
            const gotFullPage = result.items.length === result.pageSize;
            if (gotFullPage && !summaryTotal && page === 1) {
                totalPages = Math.max(2, totalPages);
            }

            if (trace) {
                console.debug("[MonitoringPagination][request:response]", {
                    requestId,
                    requestedPage: page,
                    resolvedPage: result.page,
                    resultCount: result.items.length,
                    total,
                    totalPages,
                    latestHistoricalRunsRequestId,
                });
            }

            if (requestId !== latestHistoricalRunsRequestId) {
                if (trace) {
                    console.debug("[MonitoringPagination][request:stale-drop]", {
                        requestId,
                        latestHistoricalRunsRequestId,
                        droppedPage: result.page,
                    });
                }
                return;
            }

            set({
                loadingRuns: false,
                historicalRuns: result.items.slice(0, pageSize),
                historicalRunsQueryKey: queryKey,
                historicalRunsPagination: {
                    page: result.page,
                    pageSize: pageSize,
                    total,
                    totalPages,
                },
            });

            if (trace) {
                console.debug("[MonitoringPagination][store:applied]", {
                    requestId,
                    appliedPage: result.page,
                    appliedItems: result.items.length,
                    queryKey,
                });
            }
        } catch (err: any) {
            console.error("Failed to fetch historical runs for monitoring:", err);
            // Fallback: we won't show an aggressive error, just log it.
            set({ loadingRuns: false });

            if (trace) {
                console.debug("[MonitoringPagination][request:error]", {
                    requestId,
                    page,
                    queryKey,
                    message: err?.message,
                });
            }
        }
    },

    fetchMonitoringSummary: async (email?: string, projectId?: string, force = false, silent = false) => {
        const state = get();
        const queryKey = `${projectId || ""}|${email || ""}`;

        if (!force && state.summary && state.summaryQueryKey === queryKey) return;
        if (state.loadingSummary) return;

        if (!silent) set({ loadingSummary: true });
        try {
            const summary = await monitoringService.fetchMonitoringSummary(email, projectId);
            const pageSize = state.historicalRunsPagination.pageSize || 10;
            const totalPages = Math.max(1, Math.ceil(summary.total_runs / Math.max(1, pageSize)));
            
            set({
                loadingSummary: false,
                summary,
                summaryQueryKey: queryKey,
                // Update pagination totals to reflect the summary's authoritative count
                historicalRunsPagination: {
                    page: Math.min(state.historicalRunsPagination.page, totalPages),
                    pageSize: state.historicalRunsPagination.pageSize,
                    total: summary.total_runs,
                    totalPages,
                },
            });
        } catch (err: any) {
            console.error("Failed to fetch monitoring summary:", err);
            set({ loadingSummary: false });
        }
    },

    fetchRunLogs: async (projectId, workbookId, runId, force = false, silent = false) => {
        const isValidId = (value?: string) => !!value && value !== "Unknown" && value !== "Unknown Project";
        
        // runId is essential. workbookId is highly desired, but if it's "Unknown", 
        // we might still want to try if we have a valid runId and projectId.
        if (!isValidId(runId)) return;
        
        // If workbookId is "Unknown", we still try to fetch logs using the runId. 
        // Some backend implementations might return logs for the entire run.
        const effectiveWorkbookId = workbookId === "Unknown" ? "" : workbookId;

        const key = cacheKey(workbookId, runId);
        const state = get();

        // Skip if already cached and not forcing a refresh
        if (!force && state.logs[key]) return;

        // Skip if already loading
        if (state.loadingAgents.has(key)) return;

        console.debug(`[MonitoringStore] Fetching logs for: Project=${projectId}, Workbook=${workbookId} (effective=${effectiveWorkbookId}), Run=${runId}`);

        if (!silent) {
            set((s) => {
                const loading = new Set(s.loadingAgents);
                loading.add(key);
                return { loadingAgents: loading, errors: { ...s.errors, [key]: null } };
            });
        }

        try {
            const entries = await monitoringService.fetchLogs({
                projectId,
                workbookId: effectiveWorkbookId,
                runId,
            });

            set((s) => {
                const loading = new Set(s.loadingAgents);
                if (!silent) loading.delete(key);
                return {
                    loadingAgents: loading,
                    logs: { ...s.logs, [key]: entries },
                    errors: { ...s.errors, [key]: null },
                };
            });
        } catch (err: any) {
            const msg =
                err?.message || "Failed to fetch logs";
            set((s) => {
                const loading = new Set(s.loadingAgents);
                if (!silent) loading.delete(key);
                return {
                    loadingAgents: loading,
                    errors: { ...s.errors, [key]: msg },
                };
            });
        }
    },

    clearLogsForRun: (runId) => {
        set((s) => {
            const nextLogs = { ...s.logs };
            const nextErrors = { ...s.errors };
            for (const k of Object.keys(nextLogs)) {
                if (k.endsWith(`|${runId}`)) {
                    delete nextLogs[k];
                    delete nextErrors[k];
                }
            }
            return { logs: nextLogs, errors: nextErrors };
        });
    },

    fetchActiveRuns: async (email) => {
        if (!email) return;
        if (get().loadingActiveRuns) return;

        set({ loadingActiveRuns: true });
        try {
            const query = new URLSearchParams({
                email_id: email,
                page: "1",
                page_size: "50",
            });
            const response = await fetchWithAuth<any>(`/api/record/semantic-kernel?${query.toString()}`);
            
            // Extract items safely inline
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
            const activeStatuses = ["running", "processing", "pending", "paused"];
            const active = items.filter((item: any) => {
                const status = (item.status || item.overall_status || "").toLowerCase();
                return activeStatuses.includes(status);
            });

            set((state) => {
                if (JSON.stringify(state.activeRuns) !== JSON.stringify(active)) {
                    return { activeRuns: active };
                }
                return {};
            });
        } catch (err) {
            console.error("Failed to fetch active runs in monitoring store:", err);
        } finally {
            set({ loadingActiveRuns: false });
        }
    },

    stopRun: async (runId: string) => {
        try {
            const res = await fetchWithAuth<any>(`/api/monitoring/stop-run`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ run_id: runId }),
            });
            
            // Add runId to stoppedRunIds
            set((state) => ({
                stoppedRunIds: [...(state.stoppedRunIds || []), runId]
            }));

            // Stop polling / active processing if the stopped run is the current active run
            try {
                const dashboardStore = (await import("@/stores/dashboard.store")).useDashboardStore.getState();
                const agentStore = (await import("@/stores/agent.store")).useAgentStore;
                const agentStoreState = agentStore.getState();
                
                if (dashboardStore.runId === runId || agentStoreState.currentRunId === runId) {
                    dashboardStore.stopProcessing();
                    dashboardStore.setMigrationPhase('idle');
                    
                    agentStoreState.stopPolling();
                    agentStore.setState({ isLoading: false });
                }
            } catch (e) {
                console.error("Failed to stop dashboard/agent store polling upon run stop:", e);
            }

            // After successfully stopping, refresh the active runs and the summary
            const email = useAuthStore.getState().user?.email;
            if (email) {
                get().fetchActiveRuns(email);
                
                // Fetch the stats for this specific run to update the "Cancelled" count immediately
                try {
                    const dashboardStore = (await import("@/stores/dashboard.store")).useDashboardStore.getState();
                    // Small delay to allow backend to update the stats in DB
                    setTimeout(() => {
                        dashboardStore.fetchActiveRunStats(runId, email);
                        get().fetchMonitoringSummary(email, undefined, true);
                    }, 1000);
                } catch (e) {
                    console.error("Failed to fetch active run stats after stopping:", e);
                }
            }
            return res;
        } catch (err) {
            console.error("Failed to stop run:", err);
            throw err;
        }
    },

    getLogsForRun: (workbookId, runId) => {
        const key = cacheKey(workbookId, runId);
        return get().logs[key] ?? [];
    },

    isLoadingRun: (workbookId, runId) => {
        const key = cacheKey(workbookId, runId);
        return get().loadingAgents.has(key);
    },

    getErrorForRun: (workbookId, runId) => {
        const key = cacheKey(workbookId, runId);
        return get().errors[key] ?? null;
    },
}));
