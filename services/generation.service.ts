
import { ApplicationError } from "@/lib/error-handler";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export interface GenerationResult {
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
        visuals_generated: number;
        parameters_generated: number;
        // Optional fields that might be present in raw response
        calculated_fields_injected?: number;
        measures?: number;
        total_measures?: number;
    };
}

class GenerationService {
    async getWorkbookResult(
        projectId: string,
        workbookId: string,
        runId: string
    ): Promise<GenerationResult | null> {
        if (!projectId || !workbookId || !runId) {
            console.warn("[GenerationService] Missing required parameters:", { projectId, workbookId, runId });
            return null;
        }

        const params = new URLSearchParams({
            project_id: projectId,
            workbook_id: workbookId,
            run_id: runId,
        });

        try {
            const response = await fetchWithAuth<any>(`/api/generation?${params.toString()}`);
            const data = response.data || response;

            if (!data || (Array.isArray(data) && data.length === 0)) {
                return null;
            }

            // Consistency with other services: transform log to result
            return this.transformLogToResult(data);
        } catch (error: any) {
            // Handle 404 silently as it means "not ready"
            if (error?.message?.includes("404") || error?.status === 404) {
                return null;
            }
            throw error;
        }
    }

    private transformLogToResult(log: any): GenerationResult | null {
        if (!log) return null;

        // Handle array response (pick first item)
        let raw = log;
        if (Array.isArray(log) && log.length > 0) {
            raw = log[0];
        }

        // Recursively unwrap final_response or payload if they exist
        let data = raw;
        while (data && (data.final_response || data.payload)) {
            data = data.final_response || data.payload;
        }

        // Final safety check if unwrapping didn't yield an object
        if (!data || typeof data !== 'object') {
            data = raw;
        }

        return {
            status: data.status || raw.status || "Unknown",
            message: data.message || raw.message || "",
            project: {
                name: data.project?.name || "",
                destination_path: data.project?.destination_path || "",
                repository: data.project?.repository || "",
                branch: data.project?.branch || "",
                fabric_url: data.project?.fabric_url || "",
                deployment_type: data.project?.deployment_type || data.deployment_type,
                workspace_name: data.project?.workspace_name || data.workspace_name,
            },
            summary: {
                pages_generated: data.summary?.pages_generated || 0,
                tables_processed: data.summary?.tables_processed || 0,
                custom_sql_tables: data.summary?.custom_sql_tables || 0,
                measures_created: data.summary?.measures_created || 0,
                visuals_generated: data.summary?.visuals_generated || 0,
                parameters_generated: data.summary?.parameters_generated || 0,
                calculated_fields_injected: data.summary?.calculated_fields_injected,
                measures: data.summary?.measures,
                total_measures: data.summary?.total_measures,
            }
        };
    }
}

export const generationService = new GenerationService();
