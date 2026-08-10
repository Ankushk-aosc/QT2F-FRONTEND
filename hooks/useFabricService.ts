import { useApiClient } from "@/hooks/useApiClient";

export interface FabricCredentials {
    tenantId: string;
    workspaceId: string;
    isConnected: boolean;
    connectionTime?: string;
}

export interface FabricWorkspace {
    id: string;
    name: string;
    displayName?: string; // API often returns 'displayName'
    type: string;
    capacityId?: string;
}

export function useFabricService() {
    const apiClient = useApiClient();

    const initializeConnection = async (): Promise<FabricCredentials> => {
        // User requested explicit POST /api/fabric/connect
        // And strict use of apiClient
        const creds = await apiClient.post<FabricCredentials>("/api/fabric/connect", {});
        // The API route returns partial credentials, we ensure consistent shape
        return {
            ...creds,
            isConnected: true,
            connectionTime: new Date().toISOString()
        };
    }

    const getWorkspaces = async (): Promise<FabricWorkspace[]> => {
        // API route /api/fabric/workspaces
        // Wait, does /api/fabric/workspaces exist? 
        // The previous service called `${this.baseUrl}/workspaces` where baseUrl=/api/fabric
        // So yes /api/fabric/workspaces.
        // We should double check if I need to change that too. 
        // The user instruction was specific about /connect and /get-tableau-url logic.
        // But said "Refactor THEM [frontend callers]"
        // I will refactor getWorkspaces to use apiClient too to be consistent.
        const data = await apiClient.get<any>("/api/fabric/workspaces");
        return Array.isArray(data) ? data : (data.workspaces || []);
    }

    const selectWorkspace = async (workspaceId: string): Promise<void> => {
        // Previous service had this as placeholder.
        // We can implement if needed or keep no-op.
        // But using apiClient ensures we don't have unused vars if we were to call backend.
    }

    return {
        initializeConnection,
        getWorkspaces,
        selectWorkspace
    };
}
