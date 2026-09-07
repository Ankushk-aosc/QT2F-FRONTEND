import { create } from 'zustand';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { mappingService, MappingResult } from '@/services/mapping.service';
import { mapMappingPayload } from '@/app/Mapper/mappingMapper';

export interface MappingPayload {
    workbook_name: string;
    tables?: any[];
    lods: any[]; // To be mapped properly inside the component or here
    parameters: any[];
    sets: any[];
    visuals: any[];
    custom_sql: any[];
    datasources?: any[];
    relationships?: any[];
    dashboard_layouts?: any;
    mapping_table?: any[];
    [key: string]: any;
}


interface MappingStore {
    mappingRaw: Record<string, any>;
    mappingData: Record<string, MappingPayload>;
    mappingCache: Record<string, MappingPayload>;
    isLoading: Record<string, boolean>;
    error: Record<string, string | null>;

    activeTab: string;
    setActiveTab: (tab: string) => void;
    selectedTable: string | null;
    setSelectedTable: (table: string | null) => void;
    currentPage: number;
    setCurrentPage: (page: number | ((prev: number) => number)) => void;

    fetchMappingResult: (projectId: string, workbookId: string, runId: string) => Promise<void>;
    triggerMapping: (projectId: string, workbookIds: string[], userEmail: string, runId: string) => Promise<void>;
    reset: () => void;
}

export const useMappingStore = create<MappingStore>((set, get) => ({
    mappingRaw: {},
    mappingData: {},
    mappingCache: {},
    isLoading: {},
    error: {},
    activeTab: "Tables/Fields",
    setActiveTab: (tab) => set({ activeTab: tab, currentPage: 1 }),
    selectedTable: null,
    setSelectedTable: (table) => set({ selectedTable: table, currentPage: 1 }),
    currentPage: 1,
    setCurrentPage: (page) =>
        set((state) => ({
            currentPage: typeof page === "function" ? page(state.currentPage) : page,
        })),

    fetchMappingResult: async (projectId, workbookId, runId) => {
        const cacheKey = `${runId}_${workbookId}`;
        const cached = get().mappingCache[cacheKey];
        if (cached) {
            set((state) => ({
                mappingData: { ...state.mappingData, [workbookId]: cached }
            }));
            return;
        }

        if (!get().mappingData[workbookId]) {
            set((state) => ({
                isLoading: { ...state.isLoading, [workbookId]: true },
                error: { ...state.error, [workbookId]: null }
            }));
        }

        try {
            const result = await mappingService.getWorkbookResult(projectId, workbookId, runId);

            // If Cosmos DB returns an empty array, it means data isn't ready yet.
            // Throwing an error here triggers the 404/retry logic in the catch block.
            if (Array.isArray(result) && result.length === 0) {
                throw new Error("404 Mapping data not generated yet");
            }

            if (result && result.detail && result.detail.toLowerCase().includes("not found")) {
                set((state) => ({ error: { ...state.error, [workbookId]: null } }));
                return;
            }

            set((state) => ({ mappingRaw: { ...state.mappingRaw, [workbookId]: result } }));

            if (result) {
                const mapped = mapMappingPayload(result);
                set((state) => ({
                    mappingCache: { ...state.mappingCache, [cacheKey]: mapped },
                    mappingData: { ...state.mappingData, [workbookId]: mapped },
                    error: { ...state.error, [workbookId]: null }
                }));
            }
        } catch (err: any) {
            if (err.message?.includes("404") || err.message?.toLowerCase().includes("not found")) {
                console.warn(`[MappingStore] Waiting for mapping data for ${workbookId}...`);
                set((state) => ({ error: { ...state.error, [workbookId]: null } }));
            } else {
                set((state) => ({ error: { ...state.error, [workbookId]: err.message || "Failed to fetch mapping results" } }));
            }
        } finally {
            set((state) => ({ isLoading: { ...state.isLoading, [workbookId]: false } }));
        }
    },

    triggerMapping: async (projectId, workbookIds, userEmail, runId) => {
        try {
            // Build the items array matching what the API route expects
            const items = workbookIds.map(id => ({
                project_id: projectId,
                workbook_id: id,
            }));

            const response = await fetchWithAuth('/api/mapping', {
                method: 'POST',
                body: JSON.stringify({
                    user_email: userEmail,
                    run_id: runId,
                    items,
                })
            });

            console.log("[MappingStore] Mapping job triggered successfully for", workbookIds.length, "workbook(s).");
            return response;
        } catch (err: any) {
            // ★ Silently handle 404 (backend endpoint not available yet) and other non-critical errors
            if (err.message?.includes("404") || err.message?.toLowerCase().includes("not found")) {
                console.warn("[MappingStore] Mapping endpoint not available yet (404) — mapping may be handled by backend automatically.");
            } else {
                console.warn("[MappingStore] Failed to trigger mapping (non-critical):", err.message);
            }
        }
    },

    reset: () => set({ mappingRaw: {}, mappingData: {}, isLoading: {}, error: {} })
}));
