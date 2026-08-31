"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectItem } from "@/components/ui/select";
import {
    RefreshCw,
    BookText,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Clock,
    Cpu,
    XCircle,
    Folder,
    History,
    Info,
    Play,
    AlertTriangle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDBTimestamp, formatDuration } from "@/lib/utils";
import { normalizeLogEntry } from "@/services/monitoring.service";
import { DurationTimer } from "@/components/common/DurationTimer";

import { useAuthStore } from "@/stores/auth.store";
import { useDashboardStore } from "@/stores/dashboard.store";
import { useMonitoringStore } from "@/stores/monitoring.store";
import { useAgentStore } from "@/stores/agent.store";
import { useParsingStore } from "@/stores/parsing.store";
import { useMappingStore } from "@/stores/mapping.store";
import { useGenerationStore } from "@/stores/generation.store";
import { useValidationStore } from "@/stores/validation.store";
import { useUIStore } from "@/stores/ui.store";
import { useTimestamp } from "@/hooks/useTimestamp";
import { isLiteMode } from "@/lib/config";

// ─── Constants ───────────────────────────────────────────────────────────

type DrillLevel = "workbooks" | "logs";

const AGENT_ORDER = [
    "Assessment Agent",
    "Parsing Agent",
    "Mapping Agent",
    "DataLayerAgent",
    "Generation Agent",
    "Validation Agent",
    "ValidationAgent"
];

const LOG_TABS = [
    { value: "All", label: "All" },
    { value: "Assessment Agent", label: "Assessment" },
    { value: "Parsing Agent", label: "Parsing" },
    { value: "Mapping Agent", label: "Mapping" },
    { value: "DataLayerAgent", label: "Data Layer" },
    { value: "Generation Agent", label: "Report Generation" },
    { value: "Validation Agent", label: "Validation" }
];

const getNormalizedAgentName = (agentName?: string): string => {
    if (!agentName) return "Orchestrator";
    const lower = agentName.toLowerCase();
    if (lower === "orchestrator") return "Orchestrator";

    if (lower.includes("datalayer") || (lower.includes("data") && lower.includes("layer"))) {
        return "DataLayerAgent";
    } else if (lower.includes("parsing") || lower.includes("parser")) {
        return "Parsing Agent";
    } else if (lower.includes("mapping") || lower.includes("mapper")) {
        return "Mapping Agent";
    } else if (lower.includes("generation")) {
        return "Generation Agent";
    } else if (lower.includes("validation")) {
        return "Validation Agent";
    } else if (lower.includes("assessment")) {
        return "Assessment Agent";
    }
    return agentName;
};

// ─── Styles — global vl-* CSS (matches MappingTab / AssessmentTab) ────────

const useStyles = () => ({
    container: "vl-container",
    header: "vl-header",
    title: "vl-title",
    subtitle: "vl-subtitle",
    metricsGrid: "vl-metrics-grid",
    metricCard: "vl-metric-card",
    metricValue: "vl-metric-value",
    metricLabel: "vl-metric-label",
    sectionCard: "vl-section-card",
    tableContainer: "vl-table-container",
    tableHeaderCell: "vl-table-header-cell",
    emptyState: "vl-empty-state",
});

// ─── Helper Functions ─────────────────────────────────────────────────────

const parseDurationStr = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.includes(':')) {
        const parts = val.split(':');
        if (parts.length === 3) {
            const h = parseInt(parts[0], 10) || 0;
            const m = parseInt(parts[1], 10) || 0;
            const s = parseFloat(parts[2]) || 0;
            return (h * 3600) + (m * 60) + s;
        }
    }
    return val;
};

const parseRawStatus = (rawStatus: string): string => {
    if (!rawStatus) return "completed";
    let status = rawStatus.toLowerCase();
    if (status.startsWith("(")) {
        const match = status.match(/^\(([^)]+)\)/);
        if (match) return match[1].toLowerCase();
    } else if (rawStatus.includes("Total Workbooks:")) {
        const isCompletedText = rawStatus.includes("Migration Complete") || rawStatus.includes("Migration Completed");
        const failedMatch = rawStatus.match(/Failed:\s*([1-9]\d*)/i);
        const cancelledMatch = rawStatus.match(/Cancelled:\s*([1-9]\d*)/i);
        const pendingMatch = rawStatus.match(/Pending:\s*([1-9]\d*)/i);

        if (failedMatch) return "failed";
        if (cancelledMatch) return "cancelled";
        if (pendingMatch) return "pending";
        if (isCompletedText) return "completed";
        return "completed";
    }
    return status;
};

const getWorkbookStatus = (app: any): string => {
    let s = (app?.final_status || app?.status || "").toLowerCase();
    if (s.startsWith("(")) {
        const match = s.match(/^\(([^)]+)\)/);
        if (match) {
            s = match[1].toLowerCase();
        }
    }
    if (s.includes("completed") || s === "success" || s === "done") return "completed";
    if (s.includes("failed") || s.includes("error")) return "failed";
    if (s === "cancelled" || s === "stopped" || s === "halted") return s;
    if (s.includes("paused") || s.includes("parsing")) return s;
    if (s === "running" || s === "processing") return "processing";
    // If it's a historical workbook and still shows as pending, it's effectively paused or stalled
    return "pending";
};

const isStepActive = (status: any): boolean => {
    if (!status) return false;
    const s = (typeof status === 'string' ? status : (status.status || "")).toLowerCase();
    return s !== "" &&
        s !== "pending" &&
        s !== "unknown" &&
        s !== "not_run" &&
        s !== "not-run" &&
        s !== "not_started" &&
        s !== "not-started" &&
        !s.includes("skipped");
};

const formatStatusText = (status: string): string => {
    let s = (status || "").toLowerCase();
    if (s.startsWith("(")) {
        const match = s.match(/^\(([^)]+)\)/);
        if (match) {
            s = match[1].toLowerCase();
        }
    }
    if (s === "stopped") return "Stopped";
    if (s === "cancelled") return "Cancelled";
    if (s === "halted") return "Halted";
    if (s === "lite_migration_completed") {
        return "Extraction Completed";
    }
    if (s === "full_migration_completed") {
        return "Migration Completed";
    }
    if (s === "generation_completed" || s === "generation_done") {
        return "Validation Pending";
    }
    if (s === "validation_failed") {
        return "Validation Failed";
    }
    if (s === "parsing_completed") return "Parsing Completed";
    if (s === "mapping_completed") return "Mapping Completed";
    if (s === "datalayer_completed") return "Data Layer Completed";
    if (s === "assessment_completed") return "Assessment Completed";
    if (s.includes("paused") || (s.includes("parsing") && s !== "parsing_completed")) {
        return "Paused";
    }
    if (s === "completed" || s === "success" || s === "done") {
        return "Migration Completed";
    }
    return (status || "pending").split(/[_\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const statusBadgeColor = (s: string): "success" | "default" | "destructive" | "secondary" => {
    let val = s.toLowerCase();
    if (val.startsWith("(")) {
        const match = val.match(/^\(([^)]+)\)/);
        if (match) {
            val = match[1].toLowerCase();
        }
    }
    if (val === "stopped" || val === "cancelled" || val === "halted") return "destructive";
    if (val === "parsing_completed" || val === "mapping_completed" || val === "datalayer_completed" || val === "assessment_completed") return "default";
    if (val.includes("paused") || (val.includes("parsing") && val !== "parsing_completed")) return "success";
    if (val === "generation_completed" || val === "generation_done" || val === "validation_pending") return "secondary";
    if (val === "validation_failed") return "destructive";
    if (val.includes("completed") || val.includes("success") || val.includes("done")) return "success";
    if (val === "processing" || val === "running") return "default";
    if (val === "failed" || val === "error") return "destructive";
    return "secondary";
};

const getStatusIcon = (s: string) => {
    let val = s.toLowerCase();
    if (val.startsWith("(")) {
        const match = val.match(/^\(([^)]+)\)/);
        if (match) {
            val = match[1].toLowerCase();
        }
    }
    if (val === "stopped" || val === "cancelled" || val === "halted") return <XCircle size={20} style={{ color: "var(--danger)" }} />;
    if (val.includes("paused") || val.includes("parsing")) return <CheckCircle2 size={20} style={{ color: "var(--success)" }} />;
    if (val.includes("completed") || val.includes("success") || val.includes("done")) return <CheckCircle2 size={20} style={{ color: "var(--success)" }} />;
    if (val === "processing" || val === "running") return <Play size={20} style={{ color: "var(--primary)" }} />;
    if (val === "failed" || val === "error") return <XCircle size={20} style={{ color: "var(--danger)" }} />;
    return <Clock size={20} style={{ color: "var(--text-muted)" }} />;
};

const getLogBadgeColor = (s: string): "success" | "destructive" | "warning" | "secondary" => {
    const val = s.toLowerCase();
    if (val === "success") return "success";
    if (val === "error") return "destructive";
    if (val === "warn") return "warning";
    return "secondary";
};

const getLogStatusIcon = (s: string) => {
    const val = s.toLowerCase();
    if (val === "success") return <CheckCircle2 size={16} style={{ color: "var(--success)" }} />;
    if (val === "error") return <XCircle size={16} style={{ color: "var(--danger)" }} />;
    if (val === "warn") return <AlertTriangle size={16} style={{ color: "var(--warning)" }} />;
    return <Info size={16} style={{ color: "var(--primary)" }} />;
};

const formatTimestamp = (ts?: any) => {
    if (!ts) return "—";
    if (typeof ts === 'string') return formatDBTimestamp(ts, true);
    return formatDBTimestamp(new Date(ts).toISOString(), true);
};

    const renderStatusBadges = (app: any, wbStatus: string, storeHighestCompleted?: string) => {
        const steps = app.steps || app._raw?.steps || {};
        const badges = [];

        let failedStepName = "";
        let processingStepName = "";
        let highestCompleted = "";

        if (Object.keys(steps).length > 0) {
            let lastCompletedName = "";
            for (const [key, val] of Object.entries(steps)) {
                const statusStr = typeof val === 'string' ? val : ((val as any)?.status || (val as any)?.final_status || "");
                if (!statusStr) continue;

                let formattedKey = key;
                if (key.toLowerCase().includes("agent")) {
                    formattedKey = key.replace(/Agent/i, "").trim();
                }
                formattedKey = formattedKey.split(/[_\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

                const upperStatus = statusStr.toUpperCase();
                if (upperStatus === "COMPLETED") {
                    lastCompletedName = formattedKey;
                } else if (upperStatus === "FAILED" || upperStatus === "ERROR" || upperStatus === "FAIL") {
                    failedStepName = formattedKey;
                } else if (upperStatus === "RUNNING" || upperStatus === "PROCESSING") {
                    processingStepName = formattedKey;
                }
            }
            if (lastCompletedName) {
                highestCompleted = lastCompletedName;
            }
        }

        const getStepStatus = (stepNameVariants: string[]) => {
            for (const stepName of stepNameVariants) {
                const s = steps[stepName];
                if (s) {
                    const statusStr = typeof s === 'string' ? s : (s.status || s.final_status || "");
                    if (statusStr) return statusStr.toUpperCase();
                }
            }
            for (const stepName of stepNameVariants) {
                const key = stepName.toLowerCase().replace(/ /g, '_') + '_status';
                const s = app[key] || app._raw?.[key];
                if (s) {
                    const statusStr = typeof s === 'string' ? s : (s.status || s.final_status || "");
                    if (statusStr) return statusStr.toUpperCase();
                }
            }
            return null;
        };

        const assessment = getStepStatus(["assessment", "Assessment Agent", "Assessment"]);
        const parsing = getStepStatus(["parsing", "Parsing Agent", "Parsing"]);
        const mapping = getStepStatus(["mapping", "Mapping Agent", "Mapping"]);
        const datalayer = getStepStatus(["datalayer", "Data Layer Agent", "Data Layer", "DataLayerAgent"]);
        const report_generation = getStepStatus(["generation", "report_generation", "Generation Agent", "Report Generation"]);
        const validation = getStepStatus(["validation", "Validation Agent", "Validation"]);

        let tempHighest = "";
        if (validation === "COMPLETED") tempHighest = "Validation";
        else if (report_generation === "COMPLETED") tempHighest = "Generation";
        else if (datalayer === "COMPLETED") tempHighest = "Data Layer";
        else if (mapping === "COMPLETED") tempHighest = "Mapping";
        else if (parsing === "COMPLETED") tempHighest = "Parsing";
        else if (assessment === "COMPLETED") tempHighest = "Assessment";

        if (tempHighest && !highestCompleted) highestCompleted = tempHighest;

        if (storeHighestCompleted) {
            const order = ["", "Assessment", "Parsing", "Mapping", "Data Layer", "Generation", "Validation"];
            if (order.indexOf(storeHighestCompleted) > order.indexOf(highestCompleted)) {
                highestCompleted = storeHighestCompleted;
            }
        }

        if (highestCompleted) {
            badges.push(<Badge key="highest" variant="success">{highestCompleted} Completed</Badge>);
        }

        if (wbStatus === "failed" || wbStatus === "error") {
            if (failedStepName) {
                badges.push(<Badge key="fail" variant="destructive">{failedStepName} Failed</Badge>);
            } else {
                badges.push(<Badge key="fail" variant="destructive">Failed</Badge>);
            }
        } else if (wbStatus === "stopped" || wbStatus === "cancelled" || wbStatus === "halted") {
            badges.push(<Badge key="cancel" variant="destructive">Cancelled</Badge>);
        } else if (wbStatus === "processing" || wbStatus === "running" || wbStatus === "pending") {
            if (processingStepName && processingStepName !== highestCompleted) {
                badges.push(<Badge key="proc" variant="default">{processingStepName} Processing</Badge>);
            } else {
                badges.push(<Badge key="proc" variant="default">Processing</Badge>);
            }
        } else if (highestCompleted === "Generation" || highestCompleted === "Validation" || highestCompleted === "Data Layer" || highestCompleted === "Mapping") {
            if (highestCompleted !== "Validation") {
                if (validation === "PENDING") {
                    badges.push(<Badge key="val" variant="secondary">Validation Pending</Badge>);
                } else if (validation && validation !== "COMPLETED" && validation !== "SKIPPED") {
                    const vText = validation.charAt(0) + validation.slice(1).toLowerCase();
                    badges.push(<Badge key="val" variant="secondary">Validation {vText}</Badge>);
                }
            }
        }

        if (badges.length === 0) {
            badges.push(
                <Badge key="fallback" variant={statusBadgeColor(wbStatus)}>
                    {formatStatusText(wbStatus)}
                </Badge>
            );
        }

        return (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {badges}
            </div>
        );
    };


// ─── Component ────────────────────────────────────────────────────────────

export function MonitoringTab() {
    const styles = useStyles();
    const { format: formatTime } = useTimestamp();
    const logsRef = useRef<HTMLDivElement>(null);
    const contentAreaRef = useRef<HTMLDivElement>(null);
    const HISTORY_PAGE_SIZE = 10;

    const { applications, runId: dashboardRunId, runNo: dashboardRunNo, selectedProject } = useDashboardStore();
    const { user } = useAuthStore();
    const {
        fetchRunLogs,
        getLogsForRun,
        isLoadingRun,
        getErrorForRun,
        historicalRuns,
        loadingRuns,
        loadingSummary,
        summary,
        fetchMonitoringSummary,
        fetchHistoricalRuns,
        logs,
        historicalRunsPagination,
        activeRuns: storeActiveRuns,
        fetchActiveRuns,
        loadingActiveRuns,
        stoppedRunIds = []
    } = useMonitoringStore();

    const { mode, hasContinued, activeTab, dataLayerEnabled } = useUIStore();
    const { currentRunId: agentRunId, assessmentData, manualValidationStarted, getActivitiesForWorkbook } = useAgentStore();
    const runId = dashboardRunId || agentRunId;
    const parsingData = useParsingStore((s: any) => s.parsingData);
    const mappingData = useMappingStore((s: any) => s.mappingData);
    const generationData = useGenerationStore((s: any) => s.generationData);
    const generationRaw = useGenerationStore((s: any) => s.generationRaw);
    const validationData = useValidationStore((s: any) => s.validationData);

    const [level, setLevel] = useState<DrillLevel>("workbooks");
    const [viewMode, setViewMode] = useState<"active" | "history">("active");
    const [selectedHistoricalRunId, setSelectedHistoricalRunId] = useState<string>("");
    const [selectedActiveRunId, setSelectedActiveRunId] = useState<string>("");
    const [historicalRunsPage, setHistoricalRunsPage] = useState<number>(1);
    const [historyPageInput, setHistoryPageInput] = useState<string>("1");
    const [historyLevel, setHistoryLevel] = useState<"runs" | "workbooks">("runs");
    const [isLogDialogOpen, setIsLogDialogOpen] = useState<boolean>(false);
    const [collapsedRuns, setCollapsedRuns] = useState<Record<string, boolean>>({});

    const [confirmStopRunId, setConfirmStopRunId] = useState<string | null>(null);
    const [confirmStopRunNo, setConfirmStopRunNo] = useState<string | null>(null);
    const [showStopSuccessMessage, setShowStopSuccessMessage] = useState<string | null>(null);
    const [alertMessage, setAlertMessage] = useState<{ title: string; message: string } | null>(null);

    const [selectedWorkbookId, setSelectedWorkbookId] = useState<string>("");
    const [selectedWorkbookName, setSelectedWorkbookName] = useState<string>("");
    const [selectedAgentTab, setSelectedAgentTab] = useState<string>("All");
    const [statusFilter, setStatusFilter] = useState("All");

    const activeRunNo = useMemo(() => {
        if (!runId) return dashboardRunNo;
        if (dashboardRunNo) return dashboardRunNo;
        const hr = historicalRuns.find(r => r.run_id === runId);
        if (hr?.run_no) return hr.run_no;
        if (hr?.payload?.run_no) return hr.payload.run_no;
        const assessForRun = assessmentData[runId];
        if (assessForRun) {
            const firstWb = Object.keys(assessForRun)[0];
            if (firstWb) {
                const data = assessForRun[firstWb];
                return data?.run_no || data?.payload?.run_no || undefined;
            }
        }
        return undefined;
    }, [runId, dashboardRunNo, assessmentData, historicalRuns]);

    // Keep a stable timestamp for the local active run so it doesn't reset on every render
    const localRunStartTime = useRef<string>(new Date().toISOString());
    useEffect(() => {
        if (dashboardRunId && !storeActiveRuns.some(r => r.run_id === dashboardRunId)) {
            // Only update if it's a completely new run that hasn't been tracked
            const hist = historicalRuns.find(r => r.run_id === dashboardRunId);
            if (!hist) {
                // Ensure we don't overwrite if it's already set for the current run
                // Actually, the ref persists for the component lifecycle.
            }
        }
    }, [dashboardRunId, storeActiveRuns, historicalRuns]);

    const activeRuns = useMemo(() => {
        const backendActive = storeActiveRuns || [];
        const localActiveId = dashboardRunId || agentRunId;

        // Try to resolve the run number dynamically from multiple sources to show it immediately
        const getRunNo = (rid: string) => {
            if (rid === dashboardRunId && dashboardRunNo) return dashboardRunNo;

            // Try assessment data
            const assessForRun = assessmentData[rid];
            if (assessForRun) {
                const firstWb = Object.keys(assessForRun)[0];
                if (firstWb) {
                    const data = assessForRun[firstWb];
                    const num = data?.run_no || data?.payload?.run_no || data?.runNo || data?.payload?.runNo;
                    if (num) return String(num);
                }
            }

            // Try historical runs
            const hr = historicalRuns.find(r => r.run_id === rid);
            if (hr?.run_no) return String(hr.run_no);
            if (hr?.payload?.run_no) return String(hr.payload.run_no);
            if (hr?.runNo) return String(hr.runNo);

            // Try backend active runs
            const ba = backendActive.find(r => r.run_id === rid);
            const num = ba?.run_no || ba?.runNo || ba?.payload?.run_no || ba?.payload?.runNo;
            if (num) return String(num);

            return undefined;
        };

        // Pre-fill run numbers for active runs to prevent GUID displaying
        const updatedBackendActive = backendActive.map(r => {
            const rid = r.run_id || r.runId;
            const existingNo = r.run_no || r.runNo || r.payload?.run_no || r.payload?.runNo;
            if (!existingNo) {
                const resolved = getRunNo(rid);
                if (resolved) {
                    return {
                        ...r,
                        run_no: resolved
                    };
                }
            }
            return r;
        });

        if (localActiveId) {
            const alreadyExists = updatedBackendActive.some(r => r.run_id === localActiveId);
            if (!alreadyExists) {
                const historicalRun = historicalRuns.find(r => r.run_id === localActiveId);
                if (historicalRun) {
                    return [historicalRun, ...updatedBackendActive];
                }

                const localRun = {
                    run_id: localActiveId,
                    run_no: getRunNo(localActiveId) || undefined,
                    status: "running",
                    created_at: localRunStartTime.current,
                    payload: {
                        processed_items: (applications ?? []).map(app => ({
                            workbook_id: app.workbookId,
                            workbook_name: app.workbookName,
                            project_id: app.projectId,
                            project_name: app.projectName,
                            status: app.status
                        }))
                    }
                };
                return [localRun, ...updatedBackendActive];
            }
        }
        return updatedBackendActive;
    }, [storeActiveRuns, dashboardRunId, agentRunId, dashboardRunNo, applications, assessmentData, historicalRuns]);

    const extractWorkbooksFromRun = useCallback((r: any): any[] => {
        if (!r) return [] as any[];
        const payload = r.payload || {};
        const processedItems: any[] = payload.processed_items || payload.parsed_items || r.processed_items || r.parsed_items || [];

        const seen = new Set<string>();
        const wbs: any[] = [];

        const payloadWorkbooks =
            payload.workbooks ||
            payload.selectedWorkbooks ||
            payload.selected_workbooks ||
            payload.inputWorkbooks ||
            payload.input_workbooks ||
            payload.input_params?.workbook_list ||
            payload.input_params?.workbooks ||
            payload.workbook_list ||
            payload.items ||
            [];

        if (processedItems.length > 0) {
            processedItems.forEach((item: any) => {
                const wid = item.workbook_id || item.workbookId || "Unknown";
                if (!seen.has(wid)) {
                    seen.add(wid);
                    let computedStatus = parseRawStatus(item.final_status || item.status || r.status || "completed");

                    if (computedStatus.toLowerCase() === "pending" || computedStatus.toLowerCase() === "unknown") {
                        if (r.status && r.status.toLowerCase().includes("paused")) {
                            computedStatus = r.status;
                        } else if (item.steps && Object.values(item.steps).some((st: any) => typeof st === 'string' && st.toLowerCase().includes("complete"))) {
                            computedStatus = "processing";
                        }
                    }

                    wbs.push({
                        workbookId: wid,
                        workbookName: item.workbook_name || item.workbookName || wid,
                        projectId: item.project_id || r.project_id || r.project_name || "Unknown Project",
                        projectName: item.project_name || r.project_name || item.project_id || r.project_id || "Unknown Project",
                        status: computedStatus,
                        timestamp: item.start_time || item.created_at || r.timestamp || r.time || (r.payload && (r.payload.timestamp || r.payload.time)) || r.created_at,
                        endTime: item.end_time || item.completed_at || item.finished_at,
                        totalDuration: parseDurationStr(item.time_duration || item.time_elapsed || item.duration_seconds || item.duration || item.elapsed_seconds || item.elapsed),
                        _raw: item
                    });
                }
            });
        } else if (Array.isArray(payloadWorkbooks) && payloadWorkbooks.length > 0) {
            payloadWorkbooks.forEach((wbRef: any) => {
                const wid = typeof wbRef === 'string' ? wbRef : (wbRef.id || wbRef.workbook_id || wbRef.workbookId || "Unknown");
                const wname = typeof wbRef === 'string' ? wbRef : (wbRef.name || wbRef.workbook_name || wbRef.workbookName || wid);

                if (!seen.has(wid)) {
                    seen.add(wid);
                    let computedStatus = parseRawStatus(r.status || "completed");
                    wbs.push({
                        workbookId: wid,
                        workbookName: wname,
                        projectId: r.project_id || r.project_name || "Unknown Project",
                        projectName: r.project_name || r.project_id || "Unknown Project",
                        status: computedStatus,
                        timestamp: r.created_at || r.timestamp || r.time || (r.payload && (r.payload.timestamp || r.payload.time)) || r.created_at,
                        endTime: wbRef?.end_time || wbRef?.completed_at || wbRef?.finished_at,
                        totalDuration: parseDurationStr(wbRef?.time_duration || wbRef?.time_elapsed || wbRef?.duration_seconds || wbRef?.duration),
                        _raw: wbRef
                    });
                }
            });
        } else {
            const wid = r.workbook_id || payload.workbook_id || payload.workbookId || "Unknown";
            if (!seen.has(wid)) {
                seen.add(wid);
                let computedStatus = parseRawStatus(r.status || "completed");
                wbs.push({
                    workbookId: wid,
                    workbookName: r.workbook_name || r.workbookName || payload.workbook_name || payload.workbookName || wid,
                    projectId: r.project_id || r.project_name || "Unknown Project",
                    projectName: r.project_name || r.project_id || "Unknown Project",
                    status: computedStatus,
                    timestamp: r.created_at || r.timestamp || r.time || (r.payload && (r.payload.timestamp || r.payload.time)) || r.created_at,
                    endTime: undefined,
                    totalDuration: undefined,
                    _raw: r
                });
            }
        }
        return wbs;
    }, []);

    useEffect(() => {
        if (!user?.email) return;
        fetchMonitoringSummary(user.email);
    }, [fetchMonitoringSummary, user?.email]);

    useEffect(() => {
        if (!user?.email) return;
        fetchHistoricalRuns(undefined, user.email, {
            page: historicalRunsPage,
            pageSize: HISTORY_PAGE_SIZE,
        });
    }, [fetchHistoricalRuns, user?.email, historicalRunsPage]);

    // Fetch active runs on load by default
    useEffect(() => {
        if (user?.email) {
            fetchActiveRuns(user.email);
        }
    }, [user?.email, fetchActiveRuns]);

    // Periodically refresh active runs list when active view is focused
    useEffect(() => {
        if (!user?.email || activeTab !== "Monitoring" || viewMode !== "active") return;

        const interval = setInterval(() => {
            fetchActiveRuns(user.email);
        }, 20000); // Poll active runs list every 20s

        return () => clearInterval(interval);
    }, [user?.email, activeTab, viewMode, fetchActiveRuns]);

    useEffect(() => {
        if (loadingRuns) return;
        const totalPages = Math.max(1, historicalRunsPagination.totalPages || 1);
        if (historicalRunsPage > totalPages) {
            setHistoricalRunsPage(totalPages);
        }
    }, [historicalRunsPagination.totalPages, historicalRunsPage, loadingRuns]);

    useEffect(() => {
        setHistoryPageInput(String(historicalRunsPage));
    }, [historicalRunsPage]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.localStorage.getItem("vl_trace_monitoring_pagination") !== "1") return;
        console.debug("[MonitoringPagination][ui-state]", {
            selectedPage: historicalRunsPage,
            storePage: historicalRunsPagination.page,
            storeTotalPages: historicalRunsPagination.totalPages,
            visibleRuns: historicalRuns.length,
            loadingRuns,
            viewMode,
            historyLevel,
        });
    }, [historicalRunsPage, historicalRunsPagination.page, historicalRunsPagination.totalPages, historicalRuns.length, loadingRuns, viewMode, historyLevel]);

    const activeWorkbooks = useMemo(() => {
        const seen = new Set<string>();
        return (applications ?? []).filter((app) => {
            if (seen.has(app.workbookId)) return false;
            seen.add(app.workbookId);
            return true;
        });
    }, [applications]);

    const historicalWorkbooks = useMemo(() => {
        if (!selectedHistoricalRunId) return [];
        const runsForId = historicalRuns.filter(r => r.run_id === selectedHistoricalRunId);

        const seen = new Set<string>();
        const wbs: any[] = [];

        runsForId.forEach(r => {
            const payload = r.payload || {};
            const processedItems: any[] = payload.processed_items || payload.parsed_items || [];

            // Extract workbook list from various possible keys
            const payloadWorkbooks =
                payload.workbooks ||
                payload.selectedWorkbooks ||
                payload.selected_workbooks ||
                payload.inputWorkbooks ||
                payload.input_workbooks ||
                payload.input_params?.workbook_list ||
                payload.input_params?.workbooks ||
                payload.workbook_list ||
                payload.items ||
                [];

            if (processedItems.length > 0) {
                processedItems.forEach((item: any) => {
                    const wid = item.workbook_id || item.workbookId || "Unknown";
                    if (!seen.has(wid)) {
                        seen.add(wid);
                        let computedStatus = parseRawStatus(item.final_status || item.status || r.status || "completed");

                        if (computedStatus.toLowerCase() === "pending" || computedStatus.toLowerCase() === "unknown") {
                            if (r.status && r.status.toLowerCase().includes("paused")) {
                                computedStatus = r.status;
                            } else if (item.steps && Object.values(item.steps).some((st: any) => typeof st === 'string' && st.toLowerCase().includes("complete"))) {
                                computedStatus = "processing";
                            }
                        }

                        wbs.push({
                            workbookId: wid,
                            workbookName: item.workbook_name || item.workbookName || wid,
                            projectId: item.project_id || r.project_id || r.project_name || "Unknown Project",
                            projectName: item.project_name || r.project_name || item.project_id || r.project_id || "Unknown Project",
                            status: computedStatus,
                            timestamp: item.start_time || item.created_at || r.timestamp || r.time || (r.payload && (r.payload.timestamp || r.payload.time)),
                            endTime: item.end_time || item.completed_at || item.finished_at,
                            totalDuration: parseDurationStr(item.time_duration || item.time_elapsed || item.duration_seconds || item.duration || item.elapsed_seconds || item.elapsed),
                            _raw: item
                        });
                    }
                });
            } else if (Array.isArray(payloadWorkbooks) && payloadWorkbooks.length > 0) {
                // Handle case where items aren't processed but list is known in payload
                payloadWorkbooks.forEach((wbRef: any) => {
                    const wid = typeof wbRef === 'string' ? wbRef : (wbRef.id || wbRef.workbook_id || wbRef.workbookId || "Unknown");
                    const wname = typeof wbRef === 'string' ? wbRef : (wbRef.name || wbRef.workbook_name || wbRef.workbookName || wid);

                    if (!seen.has(wid)) {
                        seen.add(wid);
                        let computedStatus = parseRawStatus(r.status || "completed");

                        wbs.push({
                            workbookId: wid,
                            workbookName: wname,
                            projectId: r.project_id || r.project_name || "Unknown Project",
                            projectName: r.project_name || r.project_id || "Unknown Project",
                            status: computedStatus,
                            timestamp: r.created_at || r.timestamp || r.time || (r.payload && (r.payload.timestamp || r.payload.time)),
                            endTime: wbRef?.end_time || wbRef?.completed_at || wbRef?.finished_at,
                            totalDuration: parseDurationStr(wbRef?.time_duration || wbRef?.time_elapsed || wbRef?.duration_seconds || wbRef?.duration),
                            _raw: wbRef
                        });
                    }
                });
            } else {
                // Fallback for cases like PAUSED_AT_PARSING where processed_items might be empty but metadata is in payload
                const wid = r.workbook_id || payload.workbook_id || payload.workbookId || "Unknown";
                if (!seen.has(wid)) {
                    seen.add(wid);
                    let computedStatus = parseRawStatus(r.status || "completed");
                    wbs.push({
                        workbookId: wid,
                        workbookName: r.workbook_name || r.workbookName || payload.workbook_name || payload.workbookName || wid,
                        projectId: r.project_id || r.project_id || r.project_name || "Unknown Project",
                        projectName: r.project_name || r.project_name || r.project_id || "Unknown Project",
                        status: computedStatus,
                        timestamp: r.created_at || r.timestamp || r.time || (r.payload && (r.payload.timestamp || r.payload.time)),
                        endTime: r.completed_at || r.finished_at || r.updated_at || (r.payload && (r.payload.completed_at || r.payload.finished_at || r.payload.updated_at)),
                        totalDuration: undefined,
                        _raw: r
                    });
                }
            }
        });
        return wbs;
    }, [historicalRuns, selectedHistoricalRunId]);

    // Add robust status computing helper scoped with access to the stores
    const getComputedStatus = useCallback((app: any, targetRunId: string | null) => {
        const baseStatus = getWorkbookStatus(app);

        // Fetch run status from active runs list or historical runs list
        const activeRunsList = useMonitoringStore.getState().activeRuns || [];
        const historicalRunsList = useMonitoringStore.getState().historicalRuns || [];
        const stoppedRunIdsList = useMonitoringStore.getState().stoppedRunIds || [];
        const runObj = activeRunsList.find(r => r.run_id === targetRunId) || historicalRunsList.find(r => r.run_id === targetRunId);
        let runStatus = (runObj?.status || "").toLowerCase();
        if (runStatus.startsWith("(")) {
            const match = runStatus.match(/^\(([^)]+)\)/);
            if (match) {
                runStatus = match[1].toLowerCase();
            }
        }
        const isRunStopped = targetRunId ? stoppedRunIdsList.includes(targetRunId) : false;

        const isHalted =
            baseStatus === "cancelled" ||
            baseStatus === "stopped" ||
            baseStatus === "halted" ||
            runStatus === "cancelled" ||
            runStatus === "stopped" ||
            runStatus === "halted" ||
            isRunStopped;

        if (isHalted) {
            if (baseStatus === "cancelled" || baseStatus === "stopped" || baseStatus === "halted") {
                return baseStatus;
            }
            if (runStatus === "cancelled" || runStatus === "stopped" || runStatus === "halted") {
                return runStatus;
            }
            return "stopped";
        }

        const isSinglePreContinue = mode === 'single' && !hasContinued;
        const hasParsing = !!parsingData[app.workbookId];
        const hasMapping = !!mappingData[app.workbookId];
        const hasGeneration = !!generationData[app.workbookId];
        const hasValidation = !!validationData[app.workbookId];
        const hasAllResults = hasParsing && hasMapping && hasGeneration && hasValidation;
        const hasAssessmentResult = !!(targetRunId && assessmentData[targetRunId]?.[app.workbookId]);
        const isPausedWaitingForValidation = hasGeneration && !manualValidationStarted[app.workbookId];

        const steps = app.steps || app._raw?.steps || {};
        const stepValues = Object.entries(steps);

        const hasFailedStep = stepValues.some(([key, step]: [string, any]) => {
            if (!step || typeof step !== 'object') {
                const s = String(step).toLowerCase();
                return s === "failed" || s === "error" || s === "fail";
            }
            const stepStatus = (step.status || step.final_status || "").toLowerCase();
            return stepStatus === "failed" || stepStatus === "error" || stepStatus === "fail" || !!step.error;
        });

        const generationEntry = generationData[app.workbookId];
        const generationRawEntry = generationRaw ? generationRaw[app.workbookId] : null;

        const hasGenerationFailed = (() => {
            const mappedStatus = (generationEntry?.status || "").toLowerCase();
            const rawOuterStatus = (generationRawEntry?.status || "").toLowerCase();
            const rawFinalStatus = (generationRawEntry?.payload?.final_response?.status ||
                generationRawEntry?.final_response?.status || "").toLowerCase();
            return (
                mappedStatus === 'failed' || mappedStatus === 'error' ||
                rawOuterStatus === 'failed' || rawOuterStatus === 'error' ||
                rawFinalStatus === 'failed' || rawFinalStatus === 'error'
            );
        })();

        const hasAnyFailure =
            hasFailedStep ||
            hasGenerationFailed ||
            (validationData[app.workbookId]?.status?.toLowerCase() === 'failed') ||
            (app.status?.toLowerCase() === 'failed');

        if (hasAnyFailure) return "failed";

        const logsForWb = targetRunId ? getLogsForRun(app.workbookId, targetRunId) : [];

        const hasValidationHistorical = isStepActive(app.validation_status || app._raw?.validation_status || steps.validation || steps["Validation Agent"]);
        const hasGenerationHistorical = isStepActive(app.generation_status || app._raw?.generation_status || steps.generation || steps.report_generation || steps["Generation Agent"] || steps["Report Generation"]);
        const hasMappingHistorical = isStepActive(app.mapping_status || app._raw?.mapping_status || steps.mapping || steps["Mapping Agent"]);
        const hasDatalayerHistorical = isStepActive(app.datalayer_status || app._raw?.datalayer_status || steps.datalayer || steps["Data Layer Agent"] || steps["Data Layer"]);

        const hasValidationLog = hasValidation || hasValidationHistorical || logsForWb.some(log => {
            const agent = (log.agent_name || (log as any)._raw?.agent_name || "").toLowerCase();
            return agent.includes("validation");
        });
        const hasGenerationLog = hasGeneration || hasGenerationHistorical || logsForWb.some(log => {
            const agent = (log.agent_name || (log as any)._raw?.agent_name || "").toLowerCase();
            return agent.includes("generation");
        });
        const hasMappingLog = hasMapping || hasMappingHistorical || logsForWb.some(log => {
            const agent = (log.agent_name || (log as any)._raw?.agent_name || "").toLowerCase();
            return agent.includes("mapping");
        });
        const hasDatalayerLog = hasDatalayerHistorical || logsForWb.some(log => {
            const agent = (log.agent_name || (log as any)._raw?.agent_name || "").toLowerCase();
            return agent.includes("datalayer") || agent.includes("data layer") || agent.includes("data_layer");
        });

        const hasDownstream = hasValidationLog || hasGenerationLog || hasMappingLog || hasDatalayerLog;

        // Check base completed / success status as well
        const isBaseCompleted = baseStatus === "completed" || baseStatus === "success" || baseStatus === "done";

        const hasRunningStep = stepValues.some(([key, step]: [string, any]) => {
            if (!step || typeof step !== 'object') {
                const s = String(step).toLowerCase();
                return s === "running" || s === "processing" || s === "pending";
            }
            const stepStatus = (step.status || step.final_status || "").toLowerCase();
            return stepStatus === "running" || stepStatus === "processing" || stepStatus === "pending";
        });

        if (hasRunningStep) {
            return "processing";
        }

        const checkStepCompleted = (step: any) => {
            if (!step) return false;
            const s = (typeof step === 'string' ? step : (step.status || step.final_status || "")).toLowerCase();
            return s === "completed" || s === "success" || s === "done";
        };

        const isParsingDone = hasParsing || checkStepCompleted(steps.parsing) || checkStepCompleted(steps["Parsing Agent"]) || checkStepCompleted(app.parsing_status) || checkStepCompleted(app._raw?.parsing_status) || baseStatus.includes("paused");

        if (!hasDownstream) {
            if (isParsingDone || isBaseCompleted) {
                return "lite_migration_completed";
            }
        }

        if (hasAllResults || hasValidationLog || checkStepCompleted(steps.validation) || checkStepCompleted(steps["Validation Agent"])) {
            return "full_migration_completed";
        }
        if (isPausedWaitingForValidation || hasGenerationLog || checkStepCompleted(steps.generation) || checkStepCompleted(steps["Generation Agent"]) || checkStepCompleted(steps.report_generation)) {
            return "generation_completed";
        }

        if (baseStatus === "running" || baseStatus === "processing" || baseStatus === "pending") {
            return "processing";
        }

        if (isSinglePreContinue && hasAssessmentResult) {
            return "lite_migration_completed";
        }

        if (isBaseCompleted) {
            return hasDownstream ? "full_migration_completed" : "lite_migration_completed";
        }

        if (baseStatus.includes("paused")) {
            return "paused_at_parsing";
        }

        return baseStatus;
    }, [mode, hasContinued, parsingData, mappingData, generationData, generationRaw, validationData, assessmentData, manualValidationStarted, getLogsForRun]);

    const effectiveRunId = viewMode === "active" ? (selectedActiveRunId || runId) : selectedHistoricalRunId;

    const displayWorkbooks = useMemo(() => {
        if (viewMode === "active") {
            const selectedActiveRun = activeRuns.find(r => r.run_id === effectiveRunId);
            return extractWorkbooksFromRun(selectedActiveRun);
        }
        return historicalWorkbooks;
    }, [viewMode, activeRuns, effectiveRunId, extractWorkbooksFromRun, historicalWorkbooks]);

    // Background log-fetching has been removed to fetch logs strictly on demand when details are viewed.

    const stats = useMemo(() => {
        const completed = summary?.completed ?? 0;
        const failed = summary?.failed ?? 0;
        const inProgress = summary?.in_progress ?? 0;
        const pending = summary?.pending ?? 0;
        const totalWorkbooks = summary?.total_workbooks ?? 0;

        return {
            totalRuns: summary?.total_runs ?? 0,
            totalWorkbooks,
            completed,
            failed,
            inProgress,
            pending,
        };
    }, [summary]);

    const selectedProjectId = useMemo(() => {
        if (viewMode === "active") {
            const activeWbs = displayWorkbooks;
            const app = activeWbs.find((a) => a.workbookId === selectedWorkbookId);
            return app?.projectId ?? selectedProject ?? "";
        } else {
            const wb = historicalWorkbooks.find(w => w.workbookId === selectedWorkbookId);
            return wb?.projectId ?? "";
        }
    }, [displayWorkbooks, historicalWorkbooks, selectedWorkbookId, viewMode, selectedProject]);

    useEffect(() => {
        if (!selectedWorkbookId || !selectedProjectId || !effectiveRunId || activeTab !== "Monitoring") return;

        // Initial fetch
        fetchRunLogs(selectedProjectId, selectedWorkbookId, effectiveRunId, true);

        let interval: NodeJS.Timeout | null = null;

        // Continuously poll the backend for freshly normalized logs during an active run
        if (viewMode === "active") {
            interval = setInterval(() => {
                fetchRunLogs(selectedProjectId, selectedWorkbookId, effectiveRunId, true, true);
            }, 5000); // 5s polling interval for real-time monitoring
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [selectedWorkbookId, selectedProjectId, effectiveRunId, fetchRunLogs, viewMode, activeTab]);

    const currentLogs = useMemo(() => {
        if (!selectedWorkbookId) return [];
        const backendLogs = getLogsForRun(selectedWorkbookId, effectiveRunId ?? "");

        // Merge with local activities for active runs to show synthetic logs (like Data Layer) immediately
        if (viewMode === "active") {
            const localActivities = getActivitiesForWorkbook(selectedWorkbookId, effectiveRunId ?? "");
            const combined = [...backendLogs];

            // Avoid duplicates by checking IDs
            const seenIds = new Set(backendLogs.map(l => l.id || (l as any)._raw?.id));
            localActivities.forEach(act => {
                if (!seenIds.has(act.id)) {
                    combined.push(normalizeLogEntry(act));
                }
            });
            return combined;
        }

        return backendLogs;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWorkbookId, getLogsForRun, effectiveRunId, logs, viewMode, getActivitiesForWorkbook]);

    const isLoadingLogs = selectedWorkbookId
        ? isLoadingRun(selectedWorkbookId, effectiveRunId ?? "")
        : false;
    const logsError = selectedWorkbookId
        ? getErrorForRun(selectedWorkbookId, effectiveRunId ?? "")
        : null;

    const availableAgents = useMemo(() => {
        const agents = new Set<string>();
        currentLogs.forEach(log => {
            const agentName = log.agent_name || (log as any)._raw?.agent_name;
            const normalized = getNormalizedAgentName(agentName);
            if (normalized !== "Orchestrator") {
                if (isLiteMode()) {
                    if (normalized === "Assessment Agent" || normalized === "Parsing Agent") {
                        agents.add(normalized);
                    }
                } else {
                    agents.add(normalized);
                }
            }
        });

        return Array.from(agents).sort((a, b) => {
            const indexA = AGENT_ORDER.indexOf(a);
            const indexB = AGENT_ORDER.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Assessment -> Validation
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [currentLogs]);

    const filteredLogs = useMemo(() => {
        let logs = selectedAgentTab === "All"
            ? currentLogs.filter(log => {
                const agentName = log.agent_name || (log as any)._raw?.agent_name;
                const isOrchestrator = agentName?.toLowerCase() === "orchestrator";

                if (isLiteMode() && !isOrchestrator) {
                    const normalized = getNormalizedAgentName(agentName);
                    if (normalized !== "Assessment Agent" && normalized !== "Parsing Agent") return false;
                }

                // If workbook is Unknown, we want to see orchestrator logs to understand why it's stuck
                if (selectedWorkbookId === "Unknown" || selectedWorkbookId === "") return true;
                return !isOrchestrator;
            })
            : currentLogs.filter(log => {
                const agentName = log.agent_name || (log as any)._raw?.agent_name;
                if (!agentName) return false;

                // Flexible string matching logic for filtered tabs
                const lowerAgent = agentName.toLowerCase();
                const lowerTab = selectedAgentTab.toLowerCase();

                if (selectedAgentTab === "DataLayerAgent" || selectedAgentTab === "Data Layer") {
                    return lowerAgent.includes("datalayer") || (lowerAgent.includes("data") && lowerAgent.includes("layer"));
                }

                if (selectedAgentTab === "Parsing Agent" || selectedAgentTab === "Parsing") {
                    return lowerAgent.includes("parsing") || lowerAgent.includes("parser");
                }

                if (selectedAgentTab === "Mapping Agent" || selectedAgentTab === "Mapping") {
                    return lowerAgent.includes("mapping") || lowerAgent.includes("mapper");
                }

                if (selectedAgentTab === "Generation Agent" || selectedAgentTab === "Report Generation") {
                    return lowerAgent.includes("generation");
                }

                if (selectedAgentTab === "Validation Agent" || selectedAgentTab === "Validation") {
                    return lowerAgent.includes("validation");
                }

                return agentName === selectedAgentTab || lowerAgent === lowerTab;
            });

        if (statusFilter !== "All") {
            const lowerFilter = statusFilter.toLowerCase();
            logs = logs.filter(log => {
                const s = (log.status || "info").toLowerCase();
                if (lowerFilter === "success" && (s === "success" || s === "completed" || s === "done")) return true;
                if (lowerFilter === "error" && (s === "error" || s === "failed" || s === "fail")) return true;
                if (lowerFilter === "warning" && (s === "warn" || s === "warning")) return true;
                if (lowerFilter === "info" && (s === "info" || s === "processing" || s === "running" || s === "pending")) return true;
                return s === lowerFilter;
            });
        }

        return [...logs].sort((a, b) => {
            const nameA = getNormalizedAgentName(a.agent_name || (a as any)._raw?.agent_name);
            const nameB = getNormalizedAgentName(b.agent_name || (b as any)._raw?.agent_name);

            const indexA = AGENT_ORDER.indexOf(nameA);
            const indexB = AGENT_ORDER.indexOf(nameB);
            // Primary sort: Stage Index (Descending: Validation -> Assessment)
            if (indexA !== indexB) {
                return indexB - indexA;
            }

            // Secondary sort: Timestamp (Descending: Newest -> Oldest)
            // Handle multiple potential timestamp formats and ensure numeric comparison
            const getTs = (entry: any) => {
                const raw = entry.timestamp || entry.time || 0;
                if (!raw) return 0;
                const d = new Date(raw);
                return isNaN(d.getTime()) ? 0 : d.getTime();
            };

            const timeA = getTs(a);
            const timeB = getTs(b);

            // If timestamps are identical, maintain stable sort or fall back to log message length/content if needed
            // But usually timeB - timeA is sufficient for newest-first.
            return timeB - timeA;
        });
    }, [currentLogs, selectedAgentTab, selectedWorkbookId, statusFilter]);

    const runStartTime = useMemo(() => {
        if (currentLogs.length === 0) return 0;
        return Math.min(...currentLogs.map(l => new Date(l.timestamp || l.time || 0).getTime()).filter(t => t > 0));
    }, [currentLogs]);

    const goToWorkbooks = useCallback(() => {
        setLevel("workbooks");
        setSelectedWorkbookId("");
        setSelectedWorkbookName("");
        setSelectedAgentTab("All");
    }, []);

    const goToLogs = useCallback((workbookId: string, workbookName: string) => {
        setSelectedWorkbookId(workbookId);
        setSelectedWorkbookName(workbookName);
        setSelectedAgentTab("All");
        if (viewMode === "history") {
            setIsLogDialogOpen(true);
        } else {
            setLevel("logs");
        }
    }, [viewMode]);

    // Auto-scroll to workbook details when a past run is selected on small screens
    useEffect(() => {
        if (selectedHistoricalRunId && window.innerWidth <= 1100) {
            contentAreaRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
        }
    }, [selectedHistoricalRunId]);

    const handleRefresh = useCallback(() => {
        if (!selectedWorkbookId || !selectedProjectId || !effectiveRunId) return;
        fetchRunLogs(selectedProjectId, selectedWorkbookId, effectiveRunId, true);
    }, [selectedWorkbookId, selectedProjectId, effectiveRunId, fetchRunLogs]);

    const formatTimestampFunc = useCallback((ts?: any) => {
        return formatTime(ts, true);
    }, [formatTime]);

    const uniqueHistoricalRuns = useMemo(() => {
        const seen = new Set<string>();

        // Filter out active runs so they don't duplicate in the history tab
        storeActiveRuns?.forEach(r => {
            if (r.run_id) seen.add(r.run_id);
            if (r.runId) seen.add(r.runId);
        });

        const runs: any[] = [];
        historicalRuns.forEach(r => {
            if (r.run_id && !seen.has(r.run_id)) {
                seen.add(r.run_id);
                const tsStr = r.timestamp || r.time || r.created_at || (r.payload && (r.payload.timestamp || r.payload.time));
                let ts = 0;
                if (tsStr) {
                    const d = new Date(tsStr);
                    if (!isNaN(d.getTime())) ts = d.getTime();
                }
                let rawStatus = r.status || "completed";
                let runStatus = parseRawStatus(rawStatus);

                let isStandard = false;
                const processedItems = r.payload?.processed_items || r.processed_items || [];

                if (processedItems.length > 0) {
                    const hasValidation = processedItems.some((i: any) => {
                        const steps = i.steps || {};
                        return isStepActive(steps.validation) || isStepActive(steps["Validation Agent"]) || isStepActive(i.validation_status) || isStepActive(i._raw?.validation_status);
                    });
                    const hasGeneration = processedItems.some((i: any) => {
                        const steps = i.steps || {};
                        return isStepActive(steps.generation) || isStepActive(steps.report_generation) || isStepActive(steps["Generation Agent"]) || isStepActive(steps["Report Generation"]) || isStepActive(i.generation_status) || isStepActive(i._raw?.generation_status);
                    });
                    const hasMapping = processedItems.some((i: any) => {
                        const steps = i.steps || {};
                        return isStepActive(steps.mapping) || isStepActive(steps["Mapping Agent"]) || isStepActive(i.mapping_status) || isStepActive(i._raw?.mapping_status);
                    });
                    const hasDatalayer = processedItems.some((i: any) => {
                        const steps = i.steps || {};
                        return isStepActive(steps.datalayer) || isStepActive(steps["Data Layer Agent"]) || isStepActive(steps["Data Layer"]) || isStepActive(i.datalayer_status) || isStepActive(i._raw?.datalayer_status);
                    });

                    if (hasValidation || hasGeneration || hasMapping || hasDatalayer) {
                        isStandard = true;
                    }

                    const hasFailed = processedItems.some((i: any) => {
                        let s = (i.final_status || i.status || "").toLowerCase();
                        if (s.startsWith("(")) {
                            const match = s.match(/^\(([^)]+)\)/);
                            if (match) {
                                s = match[1].toLowerCase();
                            }
                        }
                        return s === "failed" || s === "error" || s === "fail" || s === "cancelled" || s === "stopped" || s === "halted";
                    });
                    const hasPartial = processedItems.some((i: any) => {
                        let s = (i.final_status || i.status || "").toLowerCase();
                        if (s.startsWith("(")) {
                            const match = s.match(/^\(([^)]+)\)/);
                            if (match) {
                                s = match[1].toLowerCase();
                            }
                        }
                        return s === "partial" || s === "warning";
                    });
                    if (hasFailed) {
                        let lowStatus = (r.status || "").toLowerCase();
                        if (lowStatus.startsWith("(")) {
                            const match = lowStatus.match(/^\(([^)]+)\)/);
                            if (match) {
                                lowStatus = match[1].toLowerCase();
                            }
                        }
                        if (lowStatus === "cancelled" || lowStatus === "stopped" || lowStatus === "halted") {
                            runStatus = lowStatus;
                        } else {
                            runStatus = "failed";
                        }
                    } else if (hasPartial && runStatus !== "failed" && runStatus !== "cancelled" && runStatus !== "stopped" && runStatus !== "halted") {
                        runStatus = "partial";
                    } else {
                        const hasValidation = processedItems.some((i: any) => {
                            const steps = i.steps || {};
                            return isStepActive(steps.validation) || isStepActive(steps["Validation Agent"]) || isStepActive(i.validation_status) || isStepActive(i._raw?.validation_status);
                        });
                        const hasGeneration = processedItems.some((i: any) => {
                            const steps = i.steps || {};
                            return isStepActive(steps.generation) || isStepActive(steps.report_generation) || isStepActive(steps["Generation Agent"]) || isStepActive(steps["Report Generation"]) || isStepActive(i.generation_status) || isStepActive(i._raw?.generation_status);
                        });
                        const hasMapping = processedItems.some((i: any) => {
                            const steps = i.steps || {};
                            return isStepActive(steps.mapping) || isStepActive(steps["Mapping Agent"]) || isStepActive(i.mapping_status) || isStepActive(i._raw?.mapping_status);
                        });
                        const hasDatalayer = processedItems.some((i: any) => {
                            const steps = i.steps || {};
                            return isStepActive(steps.datalayer) || isStepActive(steps["Data Layer Agent"]) || isStepActive(steps["Data Layer"]) || isStepActive(i.datalayer_status) || isStepActive(i._raw?.datalayer_status);
                        });

                        if (hasValidation || hasMapping || hasDatalayer) {
                            runStatus = "full_migration_completed";
                        } else if (hasGeneration) {
                            runStatus = "generation_completed";
                        } else {
                            if (runStatus === "completed" || runStatus === "success" || runStatus === "done") {
                                runStatus = "lite_migration_completed";
                            } else if (runStatus === "pending" || runStatus === "processing" || runStatus === "running") {
                                if (processedItems.length === 1) {
                                    const steps = processedItems[0].steps || {};
                                    const getStepStatus = (names: string[]) => {
                                        for (const name of names) {
                                            const s = steps[name];
                                            if (s) return typeof s === 'string' ? s.toUpperCase() : (s.status || s.final_status || "").toUpperCase();
                                        }
                                        return null;
                                    };

                                    const val = getStepStatus(["validation", "Validation Agent", "Validation"]);
                                    const gen = getStepStatus(["generation", "report_generation", "Generation Agent", "Report Generation"]);
                                    const map = getStepStatus(["mapping", "Mapping Agent", "Mapping"]);
                                    const dat = getStepStatus(["datalayer", "Data Layer Agent", "Data Layer", "DataLayerAgent", "data_layer"]);
                                    const par = getStepStatus(["parsing", "Parsing Agent", "Parsing"]);
                                    const ass = getStepStatus(["assessment", "Assessment Agent", "Assessment"]);

                                    if (val === "COMPLETED") runStatus = "validation_completed";
                                    else if (gen === "COMPLETED") runStatus = "generation_completed";
                                    else if (map === "COMPLETED") runStatus = "mapping_completed";
                                    else if (dat === "COMPLETED") runStatus = "datalayer_completed";
                                    else if (par === "COMPLETED") runStatus = "parsing_completed";
                                    else if (ass === "COMPLETED") runStatus = "assessment_completed";
                                }
                            }
                        }
                    }
                } else {
                    const steps = r.steps || {};
                    const hasValidation = isStepActive(steps.validation) || isStepActive(steps["Validation Agent"]) || isStepActive(r.validation_status) || isStepActive(r.payload?.validation_status);
                    const hasGeneration = isStepActive(steps.generation) || isStepActive(steps.report_generation) || isStepActive(steps["Generation Agent"]) || isStepActive(steps["Report Generation"]) || isStepActive(r.generation_status) || isStepActive(r.payload?.generation_status);
                    const hasMapping = isStepActive(steps.mapping) || isStepActive(steps["Mapping Agent"]) || isStepActive(r.mapping_status) || isStepActive(r.payload?.mapping_status);
                    const hasDatalayer = isStepActive(steps.datalayer) || isStepActive(steps["Data Layer Agent"]) || isStepActive(steps["Data Layer"]) || isStepActive(r.datalayer_status) || isStepActive(r.payload?.datalayer_status);

                    if (hasValidation || hasGeneration || hasMapping || hasDatalayer) {
                        isStandard = true;
                    }
                }

                if (isLiteMode() && isStandard) return;

                runs.push({
                    runId: r.run_id,
                    timestamp: ts,
                    rawTimestamp: tsStr,
                    runNo: r.run_no ? String(r.run_no) : (r.payload?.run_no ? String(r.payload.run_no) : (r.runNo ? String(r.runNo) : r.payload?.runNo ? String(r.payload.runNo) : "")),
                    status: runStatus,
                    execution_level: r.execution_level,
                    project_type: r.project_type,
                    workbook_type: r.workbook_type,
                    site_type: r.site_type
                });
            }
        });
        runs.sort((a, b) => {
            const noA = parseInt((a.runNo || "").replace(/\D/g, '')) || 0;
            const noB = parseInt((b.runNo || "").replace(/\D/g, '')) || 0;
            if (noA !== 0 && noB !== 0) return noB - noA;
            return b.timestamp - a.timestamp;
        });
        return runs;
    }, [historicalRuns, storeActiveRuns]);

    const totalHistoryPages = useMemo(() => {
        const totalRunsCount = historicalRunsPagination.total || summary?.total_runs || 0;
        return Math.max(1, historicalRunsPagination.totalPages || Math.ceil(Math.max(1, totalRunsCount) / HISTORY_PAGE_SIZE));
    }, [historicalRunsPagination.total, historicalRunsPagination.totalPages, summary?.total_runs]);

    const isHistoryPageTransitionLoading =
        viewMode === "history" &&
        historyLevel === "runs" &&
        loadingRuns &&
        historicalRunsPagination.page !== historicalRunsPage;

    const handleHistoryPageJump = useCallback(() => {
        const raw = Number.parseInt(historyPageInput, 10);
        if (Number.isNaN(raw)) {
            setHistoryPageInput(String(historicalRunsPage));
            return;
        }

        const nextPage = Math.min(Math.max(1, raw), totalHistoryPages);
        setHistoricalRunsPage(nextPage);
        setHistoryPageInput(String(nextPage));
    }, [historyPageInput, historicalRunsPage, totalHistoryPages]);

    const renderRunSelectionSidebar = () => {
        if (viewMode !== "history") return null;
        const totalRunsCount = historicalRunsPagination.total || summary?.total_runs || 0;
        const totalPages = totalHistoryPages;
        const visibleRuns = isHistoryPageTransitionLoading ? [] : uniqueHistoricalRuns;

        // Show pager if we have multiple pages OR if we got a full page (indicating more might exist)
        const showPagination = totalPages > 1 || historicalRunsPage > 1 || (visibleRuns.length >= HISTORY_PAGE_SIZE);

        return (
            <div className="vl-section-card" style={{ display: "flex", flexDirection: "column", gap: "16px", flexGrow: 1, padding: "20px 24px", minHeight: "500px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
                        Past Runs <span style={{ color: "var(--text-muted)" }}>({totalRunsCount || uniqueHistoricalRuns.length})</span>
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setHistoricalRunsPage(1);
                            fetchHistoricalRuns(undefined, user?.email || undefined, {
                                page: 1,
                                pageSize: HISTORY_PAGE_SIZE,
                                force: true,
                            });
                        }}
                        disabled={loadingRuns}
                        title="Refresh Run History"
                    >
                        <RefreshCw size={20} />
                    </Button>
                </div>

                <div
                    onClick={() => {
                        setHistoricalRunsPage(1);
                        fetchHistoricalRuns(undefined, user?.email || undefined, {
                            page: 1,
                            pageSize: HISTORY_PAGE_SIZE,
                            force: true,
                        });
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        backgroundColor: "var(--surface-subtle)",
                        border: "1px solid var(--border)",
                        borderLeft: "4px solid var(--primary)",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        boxShadow: "var(--shadow-sm)",
                    }}
                    title="Click to refresh history"
                >
                    <Info size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                    <span style={{ lineHeight: "1.4" }}>
                        <strong>Click here</strong> or use the refresh button above to see the logs of the latest migration process.
                    </span>
                </div>

                {showPagination && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "40px 1fr auto 40px",
                            alignItems: "center",
                            gap: "16px",
                            padding: "14px 16px",
                            border: "1px solid var(--border)",
                            borderRadius: "12px",
                            background: "var(--surface-subtle)",
                        }}
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={historicalRunsPage <= 1}
                            onClick={() => setHistoricalRunsPage((p) => Math.max(1, p - 1))}
                            aria-label="Go to previous history page"
                        >
                            <ChevronLeft size={20} />
                        </Button>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", minWidth: 0 }}>
                            <span style={{ fontSize: "14px", color: "var(--text)", fontWeight: 600 }}>
                                {historicalRunsPage} of {totalPages}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                {`${totalRunsCount} runs`}
                            </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Input
                                value={historyPageInput}
                                onChange={(e) => setHistoryPageInput(e.target.value.replace(/[^0-9]/g, ""))}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleHistoryPageJump();
                                }}
                                style={{ width: "112px", height: "30px" }}
                                aria-label="Jump to history page"
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleHistoryPageJump}
                                disabled={loadingRuns}
                                aria-label="Go to selected history page"
                            >
                                Go
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={historicalRunsPage >= totalPages}
                            onClick={() => setHistoricalRunsPage((p) => Math.min(totalPages, p + 1))}
                            aria-label="Go to next history page"
                        >
                            <ChevronRight size={20} />
                        </Button>
                    </div>
                )}

                {isHistoryPageTransitionLoading && (
                    <div style={{ padding: "24px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", color: "var(--text-muted)" }}>
                        <Spinner size="tiny" />
                        <span style={{ fontSize: "13px" }}>Loading page {historicalRunsPage}...</span>
                    </div>
                )}

                {loadingRuns && !isHistoryPageTransitionLoading && uniqueHistoricalRuns.length === 0 && (
                    <div style={{ padding: "20px", display: "flex", justifyContent: "center" }}>
                        <Spinner size="small" />
                    </div>
                )}

                {!loadingRuns && !isHistoryPageTransitionLoading && uniqueHistoricalRuns.length === 0 && (
                    <div className="vl-empty-state">
                        <History size={28} style={{ opacity: 0.3 }} />
                        <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>No historical runs found.</span>
                    </div>
                )}

                {visibleRuns.length > 0 && (
                    <div className="vl-table-container" style={{ border: "none", borderRadius: 0, marginTop: "12px", borderTop: "1px solid var(--border)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th className="vl-table-header-cell" style={{ textAlign: "left" }}>Run Details</th>
                                    <th className="vl-table-header-cell" style={{ textAlign: "left" }}>Migration Scope</th>
                                    <th className="vl-table-header-cell" style={{ textAlign: "left" }}>Status</th>
                                    <th className="vl-table-header-cell" style={{ width: "40px" }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRuns.map(run => (
                                    <tr
                                        key={run.runId}
                                        style={{ cursor: "pointer", borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                                        onClick={() => {
                                            setSelectedHistoricalRunId(run.runId);
                                            setHistoryLevel("workbooks");
                                            setLevel("workbooks");
                                        }}
                                    >
                                        <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                                            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                                                <Folder size={20} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "2px" }} />
                                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                    <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)" }}>
                                                        {run.runNo ? `Run #${run.runNo}` : run.runId}
                                                    </span>
                                                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                        {formatTime(run.rawTimestamp || run.timestamp.toString(), true)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                                {run.execution_level && <Badge variant="secondary" style={{ fontSize: "10px", padding: "2px 6px" }}>EX: {run.execution_level}</Badge>}
                                                {run.project_type && <Badge variant="secondary" style={{ fontSize: "10px", padding: "2px 6px" }}>PR: {run.project_type}</Badge>}
                                                {run.workbook_type && <Badge variant="secondary" style={{ fontSize: "10px", padding: "2px 6px" }}>WB: {run.workbook_type}</Badge>}
                                                {run.site_type && <Badge variant="secondary" style={{ fontSize: "10px", padding: "2px 6px" }}>SI: {run.site_type}</Badge>}
                                                {!run.execution_level && !run.project_type && !run.workbook_type && !run.site_type && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: "14px 16px", verticalAlign: "top" }}>
                                            <Badge variant={statusBadgeColor(run.status)}>
                                                {formatStatusText(run.status)}
                                            </Badge>
                                        </td>
                                        <td style={{ padding: "14px 16px", textAlign: "right", verticalAlign: "top" }}>
                                            <ChevronRight size={20} style={{ color: "var(--text-muted)" }} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>
        );
    };

    const renderActiveRunContainer = (run: any) => {
        const runId = run.run_id || run.runId;
        const runNo = run.run_no || run.runNo || run.payload?.run_no || "";
        const workbooksForRun = extractWorkbooksFromRun(run);
        const isCollapsed = collapsedRuns[runId] || false;
        const isStopped = stoppedRunIds.includes(runId);

        // In active mode, show all workbooks in the active run.
        // We respect lite mode if active, but we don't filter out completed/failed workbooks.
        const filteredWbs = workbooksForRun.filter(app => {
            if (isLiteMode()) {
                const hasMapping = !!mappingData[app.workbookId];
                const hasGeneration = !!generationData[app.workbookId];
                const hasValidation = !!validationData[app.workbookId];
                if (hasMapping || hasGeneration || hasValidation) return false;
            }
            return true;
        });

        // Compute overall status of the run container dynamically
        const computedRunStatus = (() => {
            if (isStopped) return "stopped";
            if (filteredWbs.length === 0) return "completed";

            const wbStatuses = filteredWbs.map(app => getComputedStatus(app, runId).toLowerCase());

            // Check if there are any active (non-final) workbooks
            const isAnyActive = wbStatuses.some(status =>
                status === "running" ||
                status === "processing" ||
                status === "pending" ||
                status === "parsing"
            );

            if (isAnyActive) return "processing";

            // If any workbook is paused, the run is paused
            if (wbStatuses.some(status => status.includes("paused"))) {
                return "paused";
            }

            // If all are final:
            if (wbStatuses.some(status => status === "failed" || status === "error")) {
                return "failed";
            }
            if (wbStatuses.some(status => status === "stopped" || status === "cancelled" || status === "halted")) {
                return "stopped";
            }
            return "completed";
        })();

        return (
            <div key={runId} className={styles.sectionCard} style={{ display: "flex", flexDirection: "column", padding: 0, marginBottom: "20px" }}>
                <div
                    style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: isCollapsed ? "none" : "1px solid var(--border)", backgroundColor: "var(--surface-subtle)", flexShrink: 0, cursor: "pointer", userSelect: "none" }}
                    onClick={() => setCollapsedRuns(prev => ({ ...prev, [runId]: !isCollapsed }))}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {isCollapsed ? <ChevronRight size={20} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={20} style={{ color: "var(--text-muted)" }} />}
                        <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)" }}>
                            Active Run: {runNo ? `Run #${runNo}` : runId}
                        </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }} onClick={(e) => e.stopPropagation()}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{filteredWbs.length} workbooks</span>
                        <Badge variant={statusBadgeColor(computedRunStatus)}>
                            {formatStatusText(computedRunStatus)}
                        </Badge>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                fetchActiveRuns(user?.email || "");
                            }}
                            title="Refresh Active Run"
                        >
                            <RefreshCw size={20} />
                        </Button>
                        {computedRunStatus === "processing" && (
                            <Button
                                size="sm"
                                style={{
                                    backgroundColor: "var(--danger)",
                                    color: "var(--text-on-primary)",
                                    borderColor: "var(--danger)"
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmStopRunId(runId);
                                    setConfirmStopRunNo(runNo ? String(runNo) : "");
                                }}
                            >
                                Stop Run
                            </Button>
                        )}
                    </div>
                </div>
                {!isCollapsed && (
                    <div className={styles.tableContainer}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th className={styles.tableHeaderCell} style={{ textAlign: "left" }}>Workbook Details</th>
                                    <th className={styles.tableHeaderCell} style={{ textAlign: "left" }}>Project</th>
                                    <th className={styles.tableHeaderCell} style={{ textAlign: "left" }}>Status</th>
                                    <th className={styles.tableHeaderCell} style={{ textAlign: "left" }}>Duration</th>
                                    <th className={styles.tableHeaderCell} style={{ textAlign: "center", width: "100px" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWbs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                                            No workbooks found for this active run.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWbs.map((app) => {
                                        const wbStatus = isStopped ? "stopped" : getComputedStatus(app, runId);

                                        return (
                                            <tr key={app.workbookId} style={{ cursor: "pointer", borderBottom: "1px solid var(--border)", transition: "background 0.15s" }} onClick={() => { setSelectedActiveRunId(runId); goToLogs(app.workbookId, app.workbookName || app.workbookId); }}>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                        {getStatusIcon(wbStatus)}
                                                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                                <span style={{ fontWeight: 600, wordBreak: "break-all", overflowWrap: "break-word", display: "inline-block", color: "var(--primary)", fontSize: "14px" }}>
                                                                    {app.workbookName || app.workbookId || "Unknown Workbook"}
                                                                </span>
                                                            </div>
                                                            {app.timestamp && (
                                                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                                    {formatTime(app.timestamp, true)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "14px" }}>
                                                        {app.projectName || app.projectId || "—"}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "14px 16px", whiteSpace: "nowrap", minWidth: "120px" }}>
                                                    {(() => {
                                                        const hasParsing = !!useParsingStore.getState().parsingData[app.workbookId];
                                                        const hasMapping = !!useMappingStore.getState().mappingData[app.workbookId];
                                                        const hasGeneration = !!useGenerationStore.getState().generationData[app.workbookId];
                                                        const hasValidation = !!useValidationStore.getState().validationData[app.workbookId];
                                                        const hasAssessment = !!(runId && useAgentStore.getState().assessmentData[runId]?.[app.workbookId]);

                                                        let storeHighest = "";
                                                        if (hasValidation) storeHighest = "Validation";
                                                        else if (hasGeneration) storeHighest = "Generation";
                                                        else if (hasMapping) storeHighest = "Mapping";
                                                        else if (hasParsing) storeHighest = "Parsing";
                                                        else if (hasAssessment) storeHighest = "Assessment";

                                                        return renderStatusBadges(app, wbStatus, storeHighest);
                                                    })()}
                                                </td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <DurationTimer
                                                        startTime={app.timestamp}
                                                        status={wbStatus}
                                                        endTime={app.endTime}
                                                        totalDuration={app.totalDuration}
                                                        activities={getLogsForRun(app.workbookId, runId)}
                                                        isLoading={isLoadingRun(app.workbookId, runId)}
                                                        runId={runId}
                                                        workbookId={app.workbookId}
                                                    />
                                                </td>
                                                <td style={{ padding: "14px 16px", textAlign: "center", width: "120px" }}>
                                                    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                                                        <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedActiveRunId(runId); goToLogs(app.workbookId, app.workbookName || app.workbookId); }}>Details</Button>
                                                        {(wbStatus === "completed" || wbStatus === "failed") && (
                                                            <Button
                                                                size="sm"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    const projectId = app.projectId || selectedProject || "";
                                                                    try {
                                                                        await useAgentStore.getState().startValidationForWorkbook(app.workbookId, { runId, projectId });
                                                                    } catch (err: any) {
                                                                        alert("Failed to trigger re-validation: " + err.message);
                                                                    }
                                                                }}
                                                                title="Re-run Validation"
                                                            >
                                                                <RefreshCw size={16} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const renderWorkbookList = () => {
        if (viewMode === "active") {
            if (loadingActiveRuns && activeRuns.length === 0) {
                return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px", gap: "12px", width: "100%" }}>
                        <Spinner size="medium" label="Checking for active runs..." />
                    </div>
                );
            }

            const activeRunsList = activeRuns;
            if (activeRunsList.length === 0) {
                return (
                    <div className="vl-empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                        <Cpu size={40} style={{ opacity: 0.3 }} />
                        <span style={{ fontWeight: 700, color: "var(--text)", fontSize: "15px" }}>No active migration run</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>Start a migration from the Migration tab to monitor agent logs here.</span>
                    </div>
                );
            }

            const containers = activeRunsList.map(run => renderActiveRunContainer(run)).filter(c => c !== null);
            if (containers.length === 0) {
                return (
                    <div className="vl-empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                        <Cpu size={40} style={{ opacity: 0.3 }} />
                        <span style={{ fontWeight: 700, color: "var(--text)", fontSize: "15px" }}>No active workbooks processing</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>All active runs have finished processing workbooks.</span>
                    </div>
                );
            }
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
                    <div
                        onClick={() => {
                            fetchActiveRuns(user?.email || "");
                        }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 14px",
                            backgroundColor: "var(--surface-subtle)",
                            border: "1px solid var(--border)",
                            borderLeft: "4px solid var(--primary)",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            boxShadow: "var(--shadow-sm)",
                        }}
                        title="Click to refresh active runs"
                    >
                        <Info size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                        <span style={{ lineHeight: "1.4" }}>
                            <strong>Click here</strong> or use the refresh button above to see the logs of the latest migration process.
                        </span>
                    </div>
                    {containers}
                </div>
            );
        }

        if (viewMode === "history" && !effectiveRunId) {
            return (
                <div className="vl-empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <Folder size={40} style={{ opacity: 0.3 }} />
                    <span style={{ fontWeight: 700, color: "var(--text)", fontSize: "15px" }}>Select a historical run</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>Choose a run from the sidebar to view its workbooks and projects.</span>
                </div>
            );
        }

        if (displayWorkbooks.length === 0) {
            return (
                <div className="vl-empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <BookText size={36} style={{ opacity: 0.35 }} />
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>No workbooks found for the selected run.</span>
                </div>
            );
        }

        return (
            <div className={styles.sectionCard} style={{ display: "flex", flexDirection: "column", padding: 0 }}>
                {viewMode === "history" && (
                    <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-subtle)", flexShrink: 0 }}>
                        <Button variant="ghost" onClick={() => setHistoryLevel("runs")}>
                            <ChevronLeft size={20} />
                            Back to Runs
                        </Button>
                        <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)" }}>Historical Run Details</span>
                    </div>
                )}
                <div className={styles.tableContainer} style={{ border: "none", borderRadius: viewMode === "history" ? "0 0 8px 8px" : undefined }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                <th className={styles.tableHeaderCell} style={{ textAlign: "left" }}>Workbook Details</th>
                                <th className={styles.tableHeaderCell} style={{ textAlign: "left" }}>Project</th>
                                <th className={styles.tableHeaderCell} style={{ textAlign: "left" }}>Status</th>
                                <th className={styles.tableHeaderCell} style={{ textAlign: "left" }}>Duration</th>
                                <th className={styles.tableHeaderCell} style={{ textAlign: "center", width: "100px" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayWorkbooks.map((app) => {
                                const wbStatus = getComputedStatus(app, effectiveRunId);

                                return (
                                    <tr key={app.workbookId} style={{ cursor: "pointer", borderBottom: "1px solid var(--border)", transition: "background 0.15s" }} onClick={() => goToLogs(app.workbookId, app.workbookName || app.workbookId)}>
                                        <td style={{ padding: "14px 16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                {getStatusIcon(wbStatus)}
                                                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <span style={{ fontWeight: 600, wordBreak: "break-all", overflowWrap: "break-word", display: "inline-block", color: "var(--primary)", fontSize: "14px" }}>
                                                            {app.workbookName || app.workbookId || "Unknown Workbook"}
                                                        </span>
                                                        {(app as any).workbookId === "Unknown" && (app as any)._raw && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                style={{ padding: 0, height: "20px", minWidth: "20px" }}
                                                                title="View raw data from Cosmo"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    alert("Cosmo Data (Raw Payload):\n\n" + JSON.stringify((app as any)._raw, null, 2).slice(0, 1000) + "...");
                                                                    console.log("Full COSMO Data:", (app as any)._raw);
                                                                }}
                                                            >
                                                                <Info size={16} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                    {(app as any).timestamp && (
                                                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                                            {formatTime((app as any).timestamp, true)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "14px" }}>
                                                {app.projectName || app.projectId || "—"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap", minWidth: "120px" }}>
                                            {renderStatusBadges(app, wbStatus)}
                                        </td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <DurationTimer
                                                startTime={app.timestamp || app.startTime}
                                                status={wbStatus}
                                                endTime={(app as any).endTime}
                                                totalDuration={(app as any).totalDuration}
                                                activities={getLogsForRun(app.workbookId, effectiveRunId ?? "")}
                                                isLoading={isLoadingRun(app.workbookId, effectiveRunId ?? "")}
                                                runId={effectiveRunId ?? undefined}
                                                workbookId={app.workbookId}
                                            />
                                        </td>
                                        <td style={{ padding: "14px 16px", textAlign: "center", width: "120px" }}>
                                            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                                                <Button size="sm" onClick={(e) => { e.stopPropagation(); goToLogs(app.workbookId, app.workbookName || app.workbookId); }}>Details</Button>
                                                {(wbStatus === "completed" || wbStatus === "failed") && (
                                                    <Button
                                                        size="sm"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const projectId = app.projectId || selectedProject || "";
                                                            try {
                                                                await useAgentStore.getState().startValidationForWorkbook(app.workbookId, viewMode === "history" ? { runId: effectiveRunId!, projectId } : undefined);
                                                            } catch (err: any) {
                                                                alert("Failed to trigger re-validation: " + err.message);
                                                            }
                                                        }}
                                                        title="Re-run Validation"
                                                    >
                                                        <RefreshCw size={16} />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderLogsView = () => (
        <div ref={logsRef} className="vl-section-card" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", height: viewMode === "history" ? "80vh" : "auto", minHeight: "600px" }}>
            <div style={{ flexShrink: 0, padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "var(--surface-subtle)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {viewMode === "active" && (
                        <Button variant="ghost" onClick={goToWorkbooks}>
                            <ChevronLeft size={20} />
                            Back
                        </Button>
                    )}
                    <span style={{ fontWeight: 700, fontSize: "16px", color: "var(--text)" }}>Execution Logs</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {!isLoadingLogs && (
                        <div style={{ display: "flex", gap: "8px" }}>
                            <Badge variant={currentLogs.length > 0 ? "success" : "secondary"}>
                                {currentLogs.length} total events
                            </Badge>
                            {selectedAgentTab !== "All" && (
                                <Badge variant="default">
                                    {filteredLogs.length} {selectedAgentTab.replace(/Agent/gi, "").trim()}
                                </Badge>
                            )}
                        </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoadingLogs}>
                        <RefreshCw size={20} />
                        Refresh Logs
                    </Button>
                </div>
            </div>

            <div style={{ flexShrink: 0, padding: "0 20px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-subtle)", overflowX: "auto", scrollbarWidth: "none" }}>
                <style>{`
                    .vl-monitoring-tabs::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Tabs value={selectedAgentTab} onValueChange={setSelectedAgentTab}>
                        <TabsList className="vl-monitoring-tabs" style={{ minWidth: "max-content", border: "none" }}>
                            {LOG_TABS.filter(tab => dataLayerEnabled ? true : tab.value !== "DataLayerAgent").map(tab => (
                                <TabsTrigger key={tab.value} value={tab.value}>
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", paddingRight: "4px", paddingBottom: "4px", paddingTop: "4px" }}>
                        <Select
                            value={statusFilter}
                            onValueChange={(value: string) => setStatusFilter(value)}
                            style={{ minWidth: "150px" }}
                        >
                            <SelectItem value="All">All</SelectItem>
                            <SelectItem value="success">Success</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="scroll-container" style={{ flexGrow: 1, minHeight: "400px", maxHeight: "600px", backgroundColor: "var(--surface)" }}>
                {logsError && (
                    <div style={{ padding: "20px" }}>
                        <Alert variant="destructive">
                            <AlertTitle>Failed to load logs</AlertTitle>
                            <AlertDescription>{logsError}</AlertDescription>
                        </Alert>
                    </div>
                )}

                {isLoadingLogs && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "200px", gap: "12px", flexDirection: "column", color: "var(--text-muted)", fontSize: "14px" }}>
                        <Spinner size="large" />
                        <span>Fetching execution logs...</span>
                    </div>
                )}

                {!isLoadingLogs && !logsError && filteredLogs.length === 0 && (
                    <div className="vl-empty-state" style={{ margin: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                        <Cpu size={40} style={{ opacity: 0.3 }} />
                        <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>{currentLogs.length === 0 ? "No logs found." : `No logs found for ${selectedAgentTab}.`}</span>
                    </div>
                )}

                {!isLoadingLogs && !logsError && filteredLogs.length > 0 && (
                    <div className="vl-table-container" style={{ border: "none", borderRadius: 0 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                            <thead>
                                <tr>
                                    <th className="vl-table-header-cell" style={{ width: "180px", textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}>Time</th>
                                    <th className="vl-table-header-cell" style={{ width: "120px", textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}>Status</th>
                                    <th className="vl-table-header-cell" style={{ width: "100px", textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}>Elapsed</th>
                                    <th className="vl-table-header-cell" style={{ width: "180px", textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}>Agent</th>
                                    <th className="vl-table-header-cell" style={{ textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}>Message</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log, idx) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "14px 16px", fontFamily: "'Cascadia Code','Fira Code',Consolas,monospace", whiteSpace: "pre-wrap", fontSize: "12px", color: "var(--text-muted)" }}>
                                            {formatTimestampFunc(log.timestamp || log.time)}
                                        </td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                {getLogStatusIcon(log.status ?? "info")}
                                                <Badge variant={getLogBadgeColor(log.status ?? "info")}>
                                                    {(log.status ?? "INFO").toUpperCase()}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: "12px", color: "var(--primary)", fontWeight: 600 }}>
                                            {(() => {
                                                const currentTs = log.timestamp || log.time;
                                                if (!runStartTime || !currentTs) return "0s";

                                                const current = new Date(currentTs).getTime();

                                                if (isNaN(runStartTime) || isNaN(current) || current <= runStartTime) return "0s";
                                                return `+${formatDuration(current - runStartTime)}`;
                                            })()}
                                        </td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <Badge
                                                style={{
                                                    fontSize: "11px",
                                                    fontWeight: 600,
                                                    backgroundColor: (() => {
                                                        const agent = (log.agent_name || "Orchestrator").toLowerCase();
                                                        if (agent.includes("parsing")) return "#e0e7ff"; // Indigo
                                                        if (agent.includes("mapping")) return "#fef3c7"; // Amber
                                                        if (agent.includes("datalayer")) return "#ffedd5"; // Orange
                                                        if (agent.includes("generation")) return "#dcfce7"; // Green
                                                        if (agent.includes("validation")) return "#fae8ff"; // Fuchsia
                                                        if (agent.includes("assessment")) return "#f1f5f9"; // Slate
                                                        return "#f1f5f9";
                                                    })(),
                                                    color: (() => {
                                                        const agent = (log.agent_name || "Orchestrator").toLowerCase();
                                                        if (agent.includes("parsing")) return "#4338ca";
                                                        if (agent.includes("mapping")) return "#b45309";
                                                        if (agent.includes("datalayer")) return "#c2410c";
                                                        if (agent.includes("generation")) return "#15803d";
                                                        if (agent.includes("validation")) return "#a21caf";
                                                        return "#475569";
                                                    })()
                                                }}
                                            >
                                                {(log.agent_name || "Orchestrator")
                                                    .replace(/DataLayerAgent/gi, "Data Layer")
                                                    .replace(/Agent/gi, "")
                                                    .replace(/Generation/gi, "Report Generation")
                                                    .trim()}
                                            </Badge>
                                        </td>
                                        <td style={{ padding: "14px 16px", color: "var(--text)", fontSize: "13px", lineHeight: "1.5", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                            {log.message || log.msg || JSON.stringify(log._raw)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="vl-container">
            <div className="vl-header">
                <div>
                    <h1 className="vl-title" style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0 }}>
                        <Cpu size={28} style={{ color: "var(--primary)" }} />
                        Monitoring Details
                    </h1>
                    <p className="vl-subtitle" style={{ display: "block", marginTop: "8px" }}>
                        View real-time Monitoring agent execution logs for the current or past runs.
                    </p>
                </div>

                {level === "logs" && (
                    <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-sm)" }}>
                        <button type="button" onClick={goToWorkbooks} style={{ background: "none", border: "none", padding: 0, color: "var(--primary)", cursor: "pointer", fontSize: "inherit" }}>
                            Workbooks
                        </button>
                        <span style={{ color: "var(--text-muted)" }}>/</span>
                        <span style={{ color: "var(--text)", fontWeight: 600 }}>{selectedWorkbookName}</span>
                    </nav>
                )}

                {stats.totalWorkbooks > 0 && (
                    <div className="vl-metrics-grid">
                        <div className="vl-metric-card">
                            <span className="vl-metric-value">{stats.totalRuns}</span>
                            <span className="vl-metric-label">TOTAL RUNS</span>
                        </div>
                        <div className="vl-metric-card">
                            <span className="vl-metric-value">{stats.totalWorkbooks}</span>
                            <span className="vl-metric-label">TOTAL WORKBOOKS</span>
                        </div>
                        <div className="vl-metric-card">
                            <span className="vl-metric-value">{stats.completed}</span>
                            <span className="vl-metric-label">COMPLETED</span>
                        </div>
                        <div className="vl-metric-card">
                            <span className="vl-metric-value">{stats.failed}</span>
                            <span className="vl-metric-label">FAILED</span>
                        </div>
                        <div className="vl-metric-card">
                            <span className="vl-metric-value">{stats.inProgress}</span>
                            <span className="vl-metric-label">IN PROGRESS</span>
                        </div>
                        {stats.pending > 0 && (
                            <div className="vl-metric-card">
                                <span className="vl-metric-value">{stats.pending}</span>
                                <span className="vl-metric-label">PENDING</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                    <Button variant={viewMode === "active" ? "default" : "outline"} onClick={() => { setViewMode("active"); setLevel("workbooks"); }}>Active Run</Button>
                    <Button variant={viewMode === "history" ? "default" : "outline"} onClick={() => { setViewMode("history"); setHistoryLevel("runs"); setLevel("workbooks"); setHistoricalRunsPage(1); }}>History</Button>
                </div>
                {viewMode === "active" && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            if (user?.email) {
                                fetchActiveRuns(user.email);
                            }
                        }}
                        disabled={loadingActiveRuns}
                        title="Refresh Active Runs"
                    >
                        <RefreshCw size={20} />
                        Refresh
                    </Button>
                )}
            </div>

            <div className="vl-monitoring-layout" style={{ display: "flex", gap: "24px" }}>
                {viewMode === "history" && historyLevel === "runs" ? (
                    renderRunSelectionSidebar()
                ) : viewMode === "history" && historyLevel === "workbooks" ? (
                    <div ref={contentAreaRef} style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "24px", minWidth: 0, width: "100%" }}>
                        {renderWorkbookList()}
                    </div>
                ) : (
                    <div ref={contentAreaRef} style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "24px", minWidth: 0, width: "100%" }}>
                        {level === "workbooks" ? renderWorkbookList() : renderLogsView()}
                    </div>
                )}
            </div>

            {viewMode === "history" && (
                <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
                    <DialogContent className="monitoring-log-dialog">
                        {isLogDialogOpen && renderLogsView()}
                    </DialogContent>
                </Dialog>
            )}

            {/* Custom Dialog: Confirm Stop Run */}
            <Dialog open={confirmStopRunId !== null} onOpenChange={() => setConfirmStopRunId(null)}>
                <DialogContent style={{ maxWidth: "450px" }}>
                    <DialogTitle>Confirm Stop Run</DialogTitle>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        Are you sure you want to stop active {confirmStopRunNo ? `Run #${confirmStopRunNo}` : `Run ${confirmStopRunId}`}?
                    </p>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setConfirmStopRunId(null)}>Cancel</Button>
                        <Button
                            style={{ backgroundColor: "var(--danger)", color: "var(--text-on-primary)", borderColor: "var(--danger)" }}
                            onClick={async () => {
                                const runIdToStop = confirmStopRunId!;
                                const runNoToStop = confirmStopRunNo;
                                setConfirmStopRunId(null);
                                setConfirmStopRunNo(null);
                                try {
                                    await useMonitoringStore.getState().stopRun(runIdToStop);
                                    setShowStopSuccessMessage(`processing stopped for this run`);
                                } catch (err: any) {
                                    setAlertMessage({
                                        title: "Failed to Stop Run",
                                        message: err.message || String(err)
                                    });
                                }
                            }}
                        >
                            Stop Run
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Custom Dialog: Stop Success Message */}
            <Dialog open={showStopSuccessMessage !== null} onOpenChange={() => setShowStopSuccessMessage(null)}>
                <DialogContent style={{ maxWidth: "400px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", paddingTop: "20px" }}>
                        <CheckCircle2 size={48} style={{ color: "var(--success)" }} />
                        <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--text)", textAlign: "center" }}>
                            {showStopSuccessMessage}
                        </span>
                    </div>
                    <DialogFooter style={{ justifyContent: "center", paddingBottom: "12px" }}>
                        <Button onClick={() => setShowStopSuccessMessage(null)}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Custom Dialog: Alert Message */}
            <Dialog open={alertMessage !== null} onOpenChange={() => setAlertMessage(null)}>
                <DialogContent style={{ maxWidth: "450px" }}>
                    <DialogTitle>{alertMessage?.title}</DialogTitle>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        {alertMessage?.message}
                    </p>
                    <DialogFooter>
                        <Button onClick={() => setAlertMessage(null)}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
