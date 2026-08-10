import { create } from "zustand"
import { useAuthStore } from "./auth.store"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { ApplicationError } from "@/lib/error-handler"
import { generationService } from "@/services/generation.service"
import { mapGenerationPayload } from "@/app/Mapper/generationMapper"

export interface GenerationPayload {
    status: string;
    message: string;
    project: {
        name: string;
        destination_path: string;
        repository: string;
        branch: string;
        fabric_url: string;
        deployment_type?: string;
        workspace_name?: string;
    };
    summary: {
        pages_generated: number;
        tables_processed: number;
        custom_sql_tables: number;
        measures_created: number;
        measures_identified?: number;
        visuals_generated: number;
        parameters_generated: number;
    };
    datasource?: string;
    connection_type?: string;
}

interface GenerationState {
    generationRaw: Record<string, any> // Keyed by workbookId
    generationData: Record<string, GenerationPayload> // Keyed by workbookId
    isLoading: Record<string, boolean>
    error: Record<string, string | null>

    // Methods
    fetchGenerationResult: (projectId: string, workbookId: string, runId: string) => Promise<void>
    triggerGeneration: (runId: string, items: Array<{ project_id: string, workbook_id: string }>, folderName: string, groupId: string) => Promise<void>
    clearGenerationData: () => void
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
    generationRaw: {},
    generationData: {},
    isLoading: {},
    error: {},

    fetchGenerationResult: async (projectId: string, workbookId: string, runId: string) => {
        // Skip if already loading or if we already have data (unless we want to force refresh)
        if (get().isLoading[workbookId]) return;

        set((state) => ({
            isLoading: { ...state.isLoading, [workbookId]: true },
            error: { ...state.error, [workbookId]: null }
        }))

        try {
            // CENTRALIZED: Use the service which handles auth, array-unwrapping, and 404s
            const result = await generationService.getWorkbookResult(projectId, workbookId, runId);

            if (!result) {
                // Service returns null for 404 or empty data, meaning "not ready"
                set((state) => ({ isLoading: { ...state.isLoading, [workbookId]: false } }));
                return;
            }

            // Check for duplicate data to avoid unnecessary re-renders
            if (JSON.stringify(get().generationRaw[workbookId]) === JSON.stringify(result)) {
                set((state) => ({ isLoading: { ...state.isLoading, [workbookId]: false } }));
                return;
            }

            set((state) => ({ generationRaw: { ...state.generationRaw, [workbookId]: result } }));

            // TRANSFORM: result is already unwrapped by the service, but we use the mapper for the final interface
            const transformedPayload = mapGenerationPayload(result);

            set((state) => ({
                generationData: {
                    ...state.generationData,
                    [workbookId]: transformedPayload,
                },
                error: { ...state.error, [workbookId]: null }
            }))
        } catch (error: any) {
            console.error("[GenerationStore] Error fetching generation:", error);
            const errMessage = error.message || "Failed to load generation data";
            set((state) => ({ error: { ...state.error, [workbookId]: errMessage } }));
        } finally {
            set((state) => ({ isLoading: { ...state.isLoading, [workbookId]: false } }))
        }
    },

    triggerGeneration: async (runId: string, items: Array<{ project_id: string, workbook_id: string }>, folderName: string, groupId: string) => {
        try {
            const body = {
                run_id: runId,
                items,
                folder_name: folderName,
                group_id: groupId
            };

            await fetchWithAuth<any>("/api/migration/generation", {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            console.log("[GenerationStore] Generation job triggered successfully for", items.length, "workbook(s).");
        } catch (error: any) {
            console.warn("[GenerationStore] Failed to trigger generation (non-critical):", error.message);
        }
    },

    clearGenerationData: () => {
        set({ generationRaw: {}, generationData: {}, error: {}, isLoading: {} })
    }
}))
