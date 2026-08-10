// services/monitoring.service.ts
import { fetchWithAuth } from "@/lib/fetchWithAuth";

// ── Types ─────────────────────────────────────────────────────────────────

export interface LogEntry {
    timestamp?: string;
    time?: string;
    status?: string;
    level?: string;
    message?: string;
    msg?: string;
    agent_name?: string; // Added to strictly type the agent
    [key: string]: any;
}

export interface HistoricalRun {
    run_id: string;
    project_id?: string;
    workbook_id?: string;
    timestamp?: string;
    status?: string;
    [key: string]: any;
}

export interface MonitoringLogsParams {
    projectId: string;
    workbookId: string;
    runId: string;
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface MonitoringSummary {
    email_id?: string;
    filters_applied?: {
        project_id?: string | null;
        workbook_id?: string | null;
        run_id?: string | null;
        run_no?: string | null;
        created_from?: string | null;
        created_to?: string | null;
    };
    total_runs: number;
    total_workbooks: number;
    completed: number;
    failed: number;
    in_progress: number;
    pending: number;
    [key: string]: any;
}

// ── Service ───────────────────────────────────────────────────────────────

class MonitoringService {
    async fetchMonitoringSummary(email?: string, projectId?: string): Promise<MonitoringSummary> {
        const query = new URLSearchParams();
        if (email) query.append("email_id", email);
        if (projectId) query.append("project_id", projectId);

        const response = await fetchWithAuth<any>(`/api/monitoring-summary?${query.toString()}`);

        return {
            email_id: response?.email_id,
            filters_applied: response?.filters_applied,
            total_runs: Number(response?.total_runs ?? response?.totalRuns ?? 0),
            total_workbooks: Number(response?.total_workbooks ?? response?.totalWorkbooks ?? 0),
            completed: Number(response?.completed ?? 0),
            failed: Number(response?.failed ?? 0),
            in_progress: Number(response?.in_progress ?? response?.inProgress ?? 0),
            pending: Number(response?.pending ?? 0),
            ...response,
        };
    }

    async fetchLogs(params: MonitoringLogsParams): Promise<LogEntry[]> {
        const { projectId, workbookId, runId } = params;

        const query = new URLSearchParams({
            project_id: projectId,
            workbook_id: workbookId,
            run_id: runId,
            limit: "1000",
            page_size: "1000"
        });

        const response = await fetchWithAuth<any>(`/api/monitoring-logs?${query.toString()}`);

        const raw: any[] = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : Array.isArray(response?.logs)
                    ? response.logs
                    : Array.isArray(response?.actions)
                        ? response.actions
                        : Array.isArray(response?.activities)
                            ? response.activities
                            : Array.isArray(response?.result)
                                ? response.result
                                : Array.isArray(response?.items)
                                    ? response.items
                                    : [];

        return raw.map(normalizeLogEntry);
    }

    async fetchHistoricalRuns(
        projectId?: string,
        email?: string,
        page = 1,
        pageSize = 10
    ): Promise<PaginatedResult<HistoricalRun>> {
        const query = new URLSearchParams();
        if (projectId) query.append("project_id", projectId);
        if (email) query.append("email_id", email);
        query.append("page", String(page));
        query.append("page_size", String(pageSize));
        query.append("pageSize", String(pageSize));

        const response = await fetchWithAuth<any>(`/api/monitoring/semantic-kernel?${query.toString()}`);

        const raw: any[] = extractArray(response);
        const resolvedPage = Number(
            response?.page ??
            response?.current_page ??
            response?.pagination?.page ??
            response?.pagination?.current_page ??
            page
        ) || page;

        const resolvedPageSize = Number(
            response?.page_size ??
            response?.pageSize ??
            response?.per_page ??
            response?.pagination?.page_size ??
            response?.pagination?.pageSize ??
            response?.pagination?.per_page ??
            pageSize
        ) || pageSize;

        const total = Number(
            response?.total ??
            response?.total_count ??
            response?.count ??
            response?.total_records ??
            response?.pagination?.total ??
            response?.pagination?.total_count ??
            response?.pagination?.total_records ??
            raw.length
        ) || raw.length;

        const totalPages = Number(
            response?.total_pages ??
            response?.totalPages ??
            response?.page_count ??
            response?.pagination?.total_pages ??
            response?.pagination?.totalPages ??
            response?.pagination?.page_count ??
            Math.max(1, Math.ceil(total / Math.max(1, resolvedPageSize)))
        ) || 1;

        return {
            items: raw,
            total,
            page: resolvedPage,
            pageSize: resolvedPageSize,
            totalPages,
        };
    }
}

export const monitoringService = new MonitoringService();

// ── Helpers ───────────────────────────────────────────────────────────────

export function normalizeLogEntry(raw: any): LogEntry {
    const payload = raw?.payload || raw?.data || raw || {};

    let message =
        payload?.message ||
        payload?.msg ||
        payload?.activity_summary ||
        raw?.message ||
        raw?.msg ||
        raw?.activity_summary ||
        "";

    if (typeof message === "object") {
        message = JSON.stringify(message);
    }
    const lowerMsg = (message || "").toLowerCase();

    // 1. Infer Agent Name with comprehensive keywords
    let agent_name = raw?.agent_name || payload?.agent_name || raw?.agent || payload?.agent;
    
    // Safety check: Make sure agent_name is one of the recognized ones. If it's some internal worker name, "unknown", or "System", we forcefully override it.
    const isRecognizedAgent = agent_name && (
        agent_name.toLowerCase().includes("agent") || 
        agent_name.toLowerCase().includes("orchestrator") ||
        agent_name.toLowerCase() === "datalayer" ||
        agent_name.toLowerCase() === "parser" ||
        agent_name.toLowerCase() === "mapper"
    );

    if (!agent_name || !isRecognizedAgent || agent_name.toLowerCase().includes("orchestrator") || agent_name.toLowerCase() === "system") {
        if (
            lowerMsg.includes("parser") || 
            lowerMsg.includes("parsing") ||
            (lowerMsg.includes("xml") && !lowerMsg.includes("tmdl")) ||
            lowerMsg.includes("extracting metadata")
        ) {
            agent_name = "Parsing Agent";
        } else if (
            lowerMsg.includes("mapper") || 
            lowerMsg.includes("mapping") ||
            lowerMsg.includes("relationship") ||
            lowerMsg.includes("join") ||
            lowerMsg.includes("calculating lineage")
        ) {
            agent_name = "Mapping Agent";
        } else if (
            lowerMsg.includes("datalayer") || 
            lowerMsg.includes("data layer") || 
            lowerMsg.includes("model creation") ||
            lowerMsg.includes("lakehouse") ||
            lowerMsg.includes("sql") ||
            lowerMsg.includes("delta table")
        ) {
            agent_name = "DataLayerAgent";
        } else if (
            lowerMsg.includes("datavalidator") || 
            lowerMsg.includes("validation") ||
            lowerMsg.includes("validating") ||
            lowerMsg.includes("structural") ||
            lowerMsg.includes("accuracy")
        ) {
            agent_name = "Validation Agent";
        } else if (
            lowerMsg.includes("reporting agent") || 
            lowerMsg.includes("report generation") || 
            lowerMsg.includes("generation agent") || 
            lowerMsg.includes("generation") || 
            lowerMsg.includes("layout") ||
            lowerMsg.includes("tmdl") ||
            lowerMsg.includes("pbip") ||
            lowerMsg.includes("measure") ||
            lowerMsg.includes("calculated field") ||
            lowerMsg.includes("lod") ||
            lowerMsg.includes("deploying") ||
            lowerMsg.includes("theme")
        ) {
            agent_name = "Generation Agent";
        } else if (
            lowerMsg.includes("assessment") || 
            lowerMsg.includes("assessing") ||
            lowerMsg.includes("complexity") ||
            lowerMsg.includes("feasibility")
        ) {
            agent_name = "Assessment Agent";
        } else {
            // Unmatched logs go to Orchestrator (but in case there are none, let's default to Report Generation if there's any file mention to ensure visibility)
            if (lowerMsg.includes("table") || lowerMsg.includes("file") || lowerMsg.includes("workbook")) {
                agent_name = "Parsing Agent"; // Defaulting to Parsing for generic table/file logs as it's the first step
            } else {
                agent_name = "Orchestrator"; 
            }
        }
    }

    // 2. Infer Status
    let rawStatus = payload?.status || payload?.level || raw?.status || raw?.level || raw?.log_level;
    
    // If backend returns "info", we often want to show "success" for routine completed steps to match active runs
    if (!rawStatus || rawStatus.toLowerCase() === "info") {
        if (lowerMsg.includes("failed") || lowerMsg.includes("error") || lowerMsg.includes("exception")) {
            rawStatus = "error";
        } else if (lowerMsg.includes("warning") || lowerMsg.includes("skipping")) {
            rawStatus = "warn";
        } else {
            rawStatus = "success"; // Default normal routine steps to success green checkmark
        }
    }

    const status = normalizeLevel(rawStatus);

    const timestamp =
        payload?.timestamp ||
        payload?.time ||
        payload?.created_at ||
        raw?.timestamp ||
        raw?.time ||
        raw?.created_at ||
        "";

    return {
        ...raw,
        message,
        status,
        timestamp,
        agent_name,
        // Keep original fields accessible
        _raw: raw,
    };
}

function normalizeLevel(level: string): "info" | "success" | "error" | "warn" {
    const l = (level || "").toLowerCase();
    if (l === "success" || l === "completed" || l === "done") return "success";
    if (l === "error" || l === "failed" || l === "failure") return "error";
    if (l === "warn" || l === "warning") return "warn";
    return "info";
}

function extractArray(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.records)) return response.records;
    if (Array.isArray(response?.result)) return response.result;
    if (Array.isArray(response?.runs)) return response.runs;
    return [];
}