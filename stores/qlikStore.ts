import { create } from "zustand";
import { QlikApp, AppProcessState, AssessmentData, ParsedData, MappedData, ReportGenerationData } from "@/types/assessment";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export interface ApiResult {
  appId: string;
  appName: string;
  folderName?: string;
  assessmentData?: AssessmentData;
  parsedData?: ParsedData;
  mappedData?: MappedData;
  reportGenData?: ReportGenerationData;
}

interface QlikSpace {
  id: string;
  name: string;
}

interface QlikStore {
  spaces: QlikSpace[];
  selectedSpaceId: string;
  apps: QlikApp[];
  selectedApps: string[];
  processStates: AppProcessState;
  isProcessing: boolean;
  isProcessCompleted: boolean;
  isFetchingApps: boolean;
  apiResults: ApiResult[];
  activities: Record<string, Record<string, any[]>>; // appId -> agentName -> logs

  setSpaces: (spaces: QlikSpace[]) => void;
  setSelectedSpaceId: (spaceId: string) => void;
  setApps: (apps: QlikApp[]) => void;
  setSelectedApps: (apps: string[]) => void;
  addSelectedApp: (appId: string) => void;
  removeSelectedApp: (appId: string) => void;
  setProcessStates: (states: AppProcessState) => void;
  updateProcessState: (appId: string, step: string, status: any) => void;
  setIsProcessing: (processing: boolean) => void;
  setIsProcessCompleted: (completed: boolean) => void;
  setIsFetchingApps: (fetching: boolean) => void;
  setApiResults: (results: ApiResult[]) => void;
  setActivities: (appId: string, agentName: string, logs: any[]) => void;
  fetchAgentActions: (appId: string, folderName: string, agentName: string) => Promise<void>;
  resetMigrationState: () => void;
}

export const useQlikStore = create<QlikStore>((set, get) => ({
  spaces: [],
  selectedSpaceId: "",
  apps: [],
  selectedApps: [],
  processStates: {},
  isProcessing: false,
  isProcessCompleted: false,
  isFetchingApps: false,
  apiResults: [],
  activities: {},

  setSpaces: (spaces) => set({ spaces }),
  setSelectedSpaceId: (selectedSpaceId) => set({ selectedSpaceId }),
  setApps: (apps) => set({ apps }),
  setSelectedApps: (selectedApps) => set({ selectedApps }),
  addSelectedApp: (appId) => {
    const { selectedApps } = get();
    if (!selectedApps.includes(appId)) {
      set({ selectedApps: [...selectedApps, appId] });
    }
  },
  removeSelectedApp: (appId) => {
    const { selectedApps } = get();
    set({ selectedApps: selectedApps.filter((id) => id !== appId) });
  },
  setProcessStates: (processStates) => set({ processStates }),
  updateProcessState: (appId, step, status) => {
    set((state) => {
      const appState = state.processStates[appId] || {
        assessment: { status: "pending" },
        parsing: { status: "pending", step: 1 },
        mapping: { status: "pending", step: 1 },
        reportGeneration: { status: "pending" },
        validation: { status: "pending" },
      };
      return {
        processStates: {
          ...state.processStates,
          [appId]: {
            ...appState,
            [step]: {
              ...appState[step as keyof typeof appState],
              ...status,
            },
          },
        },
      };
    });
  },
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setIsProcessCompleted: (isProcessCompleted) => set({ isProcessCompleted }),
  setIsFetchingApps: (isFetchingApps) => set({ isFetchingApps }),
  setApiResults: (apiResults) => set({ apiResults }),
  setActivities: (appId, agentName, logs) => set((state) => ({
    activities: {
      ...state.activities,
      [appId]: {
        ...(state.activities[appId] || {}),
        [agentName]: logs
      }
    }
  })),
  fetchAgentActions: async (appId, folderName, agentName) => {
    try {
      const storageKey = `migrateiq:qlik-agent-actions:${appId}:${folderName}:${agentName}`;
      const current = get().activities[appId]?.[agentName] || [];

      // Restore the last known snapshot after a tab or route remount. This is
      // display continuity only; the API response remains the source of truth.
      if (current.length === 0 && typeof window !== "undefined") {
        try {
          const cached = JSON.parse(localStorage.getItem(storageKey) || "null");
          if (Array.isArray(cached) && cached.length > 0) {
            get().setActivities(appId, agentName, cached);
          }
        } catch {
          // Ignore malformed local cache and continue with the API request.
        }
      }

      const data = await fetchWithAuth<any>(
        `/api/qlik/agent-actions?folderName=${encodeURIComponent(folderName)}&agentName=${encodeURIComponent(agentName)}`
      );
      const actions = Array.isArray(data) ? data : [];

      // A temporarily empty poll must not erase actions already displayed.
      // This is especially important when the backend writes the final action
      // asynchronously after the stage endpoint has returned.
      if (actions.length > 0 || current.length === 0) {
        get().setActivities(appId, agentName, actions);
        if (actions.length > 0 && typeof window !== "undefined") {
          try {
            localStorage.setItem(storageKey, JSON.stringify(actions));
          } catch {
            // Storage quota/private-mode errors must not break polling.
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch actions:", e);
    }
  },
  resetMigrationState: () =>
    set({
      selectedApps: [],
      processStates: {},
      isProcessing: false,
      isProcessCompleted: false,
      apiResults: [],
      activities: {}
    }),
}));
