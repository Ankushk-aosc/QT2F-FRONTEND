import { create } from "zustand"
import { useAuthStore } from "./auth.store"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { ApplicationError } from "@/lib/error-handler"
import { useDashboardStore } from "./dashboard.store"
import { ValidationPayload, mapValidationPayload } from "@/app/Mapper/validationMapper"

interface ValidationState {
    validationData: Record<string, ValidationPayload | null> // Keyed by workbookId
    isLoading: Record<string, boolean>
    error: Record<string, string | null>

    isTriggered: Record<string, boolean>

    // Methods
    fetchValidationResult: (projectId: string, workbookId: string, runId: string) => Promise<void>
    triggerValidation: (email: string, runId: string | string[]) => Promise<any>
    triggerRevalidationAll: (email: string, runId: string | string[]) => Promise<any>
    triggerSingleValidation: (email: string, runId: string, projectId: string, workbookId: string) => Promise<any>
    setTriggered: (workbookId: string) => void
    setValidationError: (workbookId: string, errorMessage: string | null) => void
    clearValidationData: () => void
}

export const useValidationStore = create<ValidationState>((set, get) => ({
    validationData: {},
    isLoading: {},
    error: {},
    isTriggered: {},

    setTriggered: (workbookId: string) => set((state) => ({
        isTriggered: { ...state.isTriggered, [workbookId]: true }
    })),

    setValidationError: (workbookId: string, errorMessage: string | null) => set((state) => ({
        error: { ...state.error, [workbookId]: errorMessage }
    })),

    fetchValidationResult: async (projectId: string, workbookId: string, runId: string) => {
        try {
            set((state) => ({
                isLoading: { ...state.isLoading, [workbookId]: true },
                error: { ...state.error, [workbookId]: null }
            }))
            const { user } = useAuthStore.getState()

            const response = await fetchWithAuth<any>(`/api/validation?project_id=${projectId}&workbook_id=${workbookId}&run_id=${runId}`)

            const data = response.data || response;
            console.log("[ValidationStore] Raw API response:", JSON.stringify(data, null, 2));

            if (!data || (Array.isArray(data) && data.length === 0)) {
                throw new Error("404 Validation data not generated yet");
            }

            const mapped = mapValidationPayload(data);
            mapped.run_id = runId; // Inject run_id so components know which run this data belongs to
            console.log("[ValidationStore] Mapped validation payload:", JSON.stringify(mapped, null, 2));

            // Update global store
            set((state) => ({
                validationData: {
                    ...state.validationData,
                    [workbookId]: mapped,
                },
            }))
        } catch (error: any) {
            const errMessage = error instanceof ApplicationError ? error.message : error.message || "Failed to load validation data";

            // If it's a 404 or backend returned 404, it just means the worker hasn't finished yet or the document doesn't exist.
            if (errMessage.includes("404") || errMessage.toLowerCase().includes("not found")) {
                console.log(`[ValidationStore] Waiting for validation data for ${workbookId}...`)
                set((state) => ({
                    error: { ...state.error, [workbookId]: null },
                    validationData: { ...state.validationData, [workbookId]: null }
                }))
                return;
            }

            console.error("[ValidationStore] Error fetching validation:", error);
            set((state) => ({ error: { ...state.error, [workbookId]: errMessage } }));
        } finally {
            set((state) => ({ isLoading: { ...state.isLoading, [workbookId]: false } }))
        }
    },

    triggerValidation: async (email: string, runId: string | string[]) => {
        try {
            // ── Force-refresh ALL tokens so run-validation never reuses cached invoke-batch tokens ──
            let fabricToken: string | undefined;

            try {
                const { getFabricToken, getActiveToken } = await import("@/components/providers/MsalProviderWrapper");
                fabricToken = await getFabricToken(true);
                await getActiveToken(true);
            } catch (tokenErr) {
                fabricToken = sessionStorage.getItem("fabric_access_token") ?? undefined;
            }

            const body = {
                email,
                run_id: Array.isArray(runId) ? runId : [runId],
                ...(fabricToken ? { fabric_access_token: fabricToken } : {}),
            };

            const response = await fetchWithAuth<any>("/api/run-validation", {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            console.log("[ValidationStore] Validation job triggered successfully for run:", runId);
            return response;
        } catch (error: any) {
            console.error("[ValidationStore] Failed to trigger validation:", error.message);
            throw error;
        }
    },

    triggerRevalidationAll: async (email: string, runId: string | string[]) => {
        try {
            let fabricToken: string | undefined;

            try {
                const { getFabricToken, getActiveToken } = await import("@/components/providers/MsalProviderWrapper");
                fabricToken = await getFabricToken(true);
                await getActiveToken(true);
            } catch (tokenErr) {
                fabricToken = sessionStorage.getItem("fabric_access_token") ?? undefined;
            }

            const body = {
                email,
                run_id: Array.isArray(runId) ? runId : [runId],
                ...(fabricToken ? { fabric_access_token: fabricToken } : {}),
            };

            const response = await fetchWithAuth<any>("/api/revalidate", {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            console.log("[ValidationStore] Revalidation job triggered successfully for run:", runId);
            return response;
        } catch (error: any) {
            console.error("[ValidationStore] Failed to trigger revalidation:", error.message);
            throw error;
        }
    },

    triggerSingleValidation: async (email: string, runId: string, projectId: string, workbookId: string) => {
        try {
            let fabricToken: string | undefined;
            try {
                const { getFabricToken } = await import("@/components/providers/MsalProviderWrapper");
                fabricToken = await getFabricToken(true);
            } catch (tokenErr) {
                fabricToken = sessionStorage.getItem("fabric_access_token") ?? undefined;
            }

            const body = {
                email,
                run_id: runId,
                project_id: projectId,
                workbook_id: workbookId,
                fabric_access_token: fabricToken || "",
            };

            const response = await fetchWithAuth("/api/run-single-validation", {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    "Content-Type": "application/json"
                }
            });

            console.log("[ValidationStore] Single validation triggered for:", workbookId);
            return response;
        } catch (error: any) {
            console.error("[ValidationStore] Failed to trigger single validation:", error.message);
            throw error;
        }
    },

    clearValidationData: () => {
        set({ validationData: {}, error: {}, isLoading: {} })
    }
}))
