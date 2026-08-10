
import { GenerationPayload } from "@/stores/generation.store";

/**
 * Mapper for Generation Results
 * Transforms raw API responses into UI-ready GenerationPayload
 */
export function mapGenerationPayload(rawDoc: any): GenerationPayload {
    if (!rawDoc) return createEmptyPayload();

    // Handle array response (pick first item)
    let raw = rawDoc;
    if (Array.isArray(rawDoc) && rawDoc.length > 0) {
        raw = rawDoc[0];
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
        message: data.message || data.error || raw.message || data.error_message || data.failure_info || data.failure_response || "",
        project: {
            name: data.project?.name || "—",
            destination_path: data.project?.destination_path || "—",
            repository: data.project?.repository || "—",
            branch: data.project?.branch || "—",
            fabric_url: data.project?.fabric_url || "",
            deployment_type: data.project?.deployment_type || data.deployment_type,
            workspace_name: data.project?.workspace_name || data.workspace_name || (data.project?.destination_path ? data.project.destination_path.split('/')[1] : undefined),
        },
        summary: {
            pages_generated: data.summary?.pages_generated || 0,
            tables_processed: data.summary?.tables_processed || 0,
            custom_sql_tables: data.summary?.custom_sql_tables || 0,
            measures_created: data.summary?.measures_created || 0,
            measures_identified: data.summary?.measures || data.summary?.calculated_fields_injected || data.summary?.total_measures || 0,
            visuals_generated: data.summary?.visuals_generated || 0,
            parameters_generated: data.summary?.parameters_generated ?? data.summary?.parameters ?? 0,
        },
        datasource: data.datasource || data.connection_type || data.project?.datasource || raw.datasource || "Standard Connector",
        connection_type: data.connection_mode || data.mode || data.project?.connection_type || "Live"
    };
}

function createEmptyPayload(): GenerationPayload {
    return {
        status: "Unknown",
        message: "",
        project: {
            name: "—",
            destination_path: "—",
            repository: "—",
            branch: "—",
            fabric_url: "",
            deployment_type: undefined,
            workspace_name: undefined,
        },
        summary: {
            pages_generated: 0,
            tables_processed: 0,
            custom_sql_tables: 0,
            measures_created: 0,
            measures_identified: 0,
            visuals_generated: 0,
            parameters_generated: 0,
        }
    };
}
