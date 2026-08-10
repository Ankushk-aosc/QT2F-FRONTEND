// Updated file: hooks/usetableauservice.ts
// Changes: Aligned with service changes (initializeConnection returns array).

import { useApiClient } from "@/hooks/useApiClient";

export interface TableauCredentials {
    TABLEAU_SERVER_URL: string;
    TABLEAU_SITE_NAME: string;
    TABLEAU_TOKEN_NAME: string;
    TABLEAU_TOKEN_VALUE: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
}

export interface Workbook {
    id: string;
    name: string;
    project_id: string;
    created_at?: string;
    updated_at?: string;
    size?: number;
    webpage_url?: string;
}

interface TableauDetailsPayload {
    TABLEAU_SERVER_URL: string;
    TABLEAU_SITE_NAME: string;
    site_id?: string;
    source_type?: string;
    project_id?: string;
    folder_name?: string;
    group_id?: string;
}

interface GetWorkbooksPayload {
    TABLEAU_SERVER_URL: string;
    TABLEAU_SITE_NAME: string;
    PROJECT_ID: string[];
}

const DEFAULT_SITE_NAME = "";

export function useTableauService() {
    const apiClient = useApiClient();

    const initializeConnection = async (): Promise<TableauCredentials[]> => {  // Updated to array
        return apiClient.get<TableauCredentials[]>("/api/tableau/get-tableau-url");
    }

    const getProjects = async (serverUrl: string, siteId?: string): Promise<Project[]> => {
        const payload: TableauDetailsPayload = {
            TABLEAU_SERVER_URL: serverUrl,
            TABLEAU_SITE_NAME: DEFAULT_SITE_NAME,
            site_id: siteId,
            source_type: "cloud",
        };

        const data = await apiClient.post<{ projects: Project[] }>("/api/tableau/propagate-tableau-details", payload);
        return data.projects || [];
    }

    const getWorkbooksForProject = async (serverUrl: string, projectId: string): Promise<Workbook[]> => {
        const payload: GetWorkbooksPayload = {
            TABLEAU_SERVER_URL: serverUrl,
            TABLEAU_SITE_NAME: DEFAULT_SITE_NAME,
            PROJECT_ID: [projectId],
        };

        const data = await apiClient.post<{ workbooks: Workbook[] }>("/api/tableau/workbooks", payload);
        return data.workbooks || [];
    }

    // New method aligned with service
    const storeTableauUrl = async (url: string): Promise<void> => {
        await apiClient.post("/api/tableau/post-tableau-url", { tableau_server_url: url });
    };

    return {
        initializeConnection,
        getProjects,
        getWorkbooksForProject,
        storeTableauUrl
    };
}