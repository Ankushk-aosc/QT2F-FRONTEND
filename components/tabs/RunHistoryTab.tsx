"use client"

import { useAuthStore } from "@/stores/auth.store"
import { useRunHistoryStore, mapRunHistoryItem } from "@/stores/runHistory.store"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectItem } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Folder,
    History,
    Search,
    XCircle,
} from "lucide-react"
import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { formatDuration, getTimeframeBoundaries, parseDBTimestamp } from "@/lib/utils"
import { useTimestamp } from "@/hooks/useTimestamp"
import { RunDetailsModal } from "../modals/RunDetailsModal"
import { useMonitoringStore } from "@/stores/monitoring.store"
import { useAgentStore } from "@/stores/agent.store"
import { useUIStore } from "@/stores/ui.store"
import { useValidationStore } from "@/stores/validation.store"
import { DurationTimer } from "@/components/common/DurationTimer"
import { isLiteMode } from "@/lib/config"

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

export function RunHistoryTab() {
    const [selectedModalRun, setSelectedModalRun] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const {
        currentPageRunHistory,
        runHistory,
        pagination,
        isLoading,
        hasFetched,
        error,
        fetchRunHistory,
        selectedHistoricalRunId,
        setSelectedHistoricalRunId,
        historyLevel,
        setHistoryLevel,
        timeframe,
        setTimeframe,
        statusFilter,
        setStatusFilter,
        searchQuery,
        setSearchQuery,
        currentPage,
        setCurrentPage,
        startPolling,
        stopAllPolling
    } = useRunHistoryStore();

    const [pageInput, setPageInput] = useState<string>(String(currentPage));
    const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
    const validationDataMap = useValidationStore((state: any) => state.validationData);
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstRender = useRef(true);
    const pageSize = 10;

    const { user } = useAuthStore();
    const { fetchRunLogs, getLogsForRun } = useMonitoringStore();
    const { activeTab } = useUIStore();
    const workbookDetailsRef = useRef<HTMLDivElement>(null);
    const cachedWorkbooksRef = useRef<any[]>([]);
    const { format: formatTs, timezone } = useTimestamp();

    const backendStatus = useMemo(() => {
        if (statusFilter === "Failed") return "Failed";
        return "All";
    }, [statusFilter]);

    const isStandardRun = (wb: any): boolean => {
        const steps = wb.steps || {};
        const hasValidation = isStepActive(steps.validation) || isStepActive(steps["Validation Agent"]) || isStepActive(wb.validation_status);
        const hasGeneration = isStepActive(steps.generation) || isStepActive(steps.report_generation) || isStepActive(steps["Generation Agent"]) || isStepActive(steps["Report Generation"]) || isStepActive(wb.generation_status);
        const hasMapping = isStepActive(steps.mapping) || isStepActive(steps["Mapping Agent"]) || isStepActive(wb.mapping_status);
        const hasDatalayer = isStepActive(steps.datalayer) || isStepActive(steps["Data Layer Agent"]) || isStepActive(steps["Data Layer"]) || isStepActive(wb.datalayer_status);
        return hasValidation || hasGeneration || hasMapping || hasDatalayer;
    };

    const getWorkbookStatusForHistory = (wb: any): string => {
        let parentStatus = (wb.parent_status || "").toLowerCase();
        if (parentStatus.startsWith("(")) {
            const match = parentStatus.match(/^\(([^)]+)\)/);
            if (match) {
                parentStatus = match[1].toLowerCase();
            }
        }
        if (parentStatus === "cancelled" || parentStatus === "stopped") {
            const baseStatus = (wb.final_status || wb.status || wb.overall_status || "completed").toLowerCase();
            if (baseStatus === "completed" || baseStatus === "success" || baseStatus === "done" || baseStatus === "full_migration_completed" || baseStatus === "lite_migration_completed") {
                return baseStatus;
            }
            if (baseStatus === "failed" || baseStatus === "error" || baseStatus === "fail" || !!wb.error || !!wb.error_message || !!wb.generation_error) {
                return "failed";
            }
            return parentStatus;
        }
        if (parentStatus === "failed" || parentStatus === "error") {
            const baseStatus = (wb.final_status || wb.status || wb.overall_status || "completed").toLowerCase();
            if (baseStatus === "completed" || baseStatus === "success" || baseStatus === "done" || baseStatus === "full_migration_completed" || baseStatus === "lite_migration_completed") {
                return baseStatus;
            }
            return "failed";
        }

        const baseStatus = (wb.final_status || wb.status || wb.overall_status || "completed").toLowerCase();

        // If the migration is still actively processing, return the last completed step
        if (baseStatus === "running" || baseStatus === "pending" || baseStatus === "processing") {
            const steps = wb.steps || {};
            const getStepStatus = (names: string[]) => {
                for (const name of names) {
                    const s = steps[name];
                    if (s) {
                        return typeof s === 'string' ? s.toUpperCase() : (s.status || s.final_status || "").toUpperCase();
                    }
                }
                return null;
            };

            const val = getStepStatus(["validation", "Validation Agent", "Validation"]);
            const gen = getStepStatus(["generation", "report_generation", "Generation Agent", "Report Generation"]);
            const map = getStepStatus(["mapping", "Mapping Agent", "Mapping"]);
            const dat = getStepStatus(["datalayer", "Data Layer Agent", "Data Layer", "DataLayerAgent", "data_layer"]);
            const par = getStepStatus(["parsing", "Parsing Agent", "Parsing"]);
            const ass = getStepStatus(["assessment", "Assessment Agent", "Assessment"]);

            if (val === "COMPLETED") return "validation_completed";
            if (gen === "COMPLETED") return "generation_completed";
            if (map === "COMPLETED") return "mapping_completed";
            if (dat === "COMPLETED") return "datalayer_completed";
            if (par === "COMPLETED") return "parsing_completed";
            if (ass === "COMPLETED") return "assessment_completed";

            return "processing";
        }

        if (baseStatus === "failed" || baseStatus === "error" || baseStatus === "fail" || !!wb.error || !!wb.error_message || !!wb.generation_error) {
            return "failed";
        }
        const steps = wb.steps || {};
        const hasValidation = isStepActive(steps.validation) || isStepActive(steps["Validation Agent"]) || isStepActive(wb.validation_status);
        const hasGeneration = isStepActive(steps.generation) || isStepActive(steps.report_generation) || isStepActive(steps["Generation Agent"]) || isStepActive(steps["Report Generation"]) || isStepActive(wb.generation_status);
        const hasMapping = isStepActive(steps.mapping) || isStepActive(steps["Mapping Agent"]) || isStepActive(wb.mapping_status);
        const hasDatalayer = isStepActive(steps.datalayer) || isStepActive(steps["Data Layer Agent"]) || isStepActive(steps["Data Layer"]) || isStepActive(wb.datalayer_status);
        const hasDownstream = hasValidation || hasGeneration || hasMapping || hasDatalayer;

        // Check if any step explicitly failed (excluding validation — handled separately)
        const stepValues = Object.entries(steps);
        const hasFailedStep = stepValues.some(([key, step]: [string, any]) => {
            if (!step || typeof step !== 'object') return false;
            // Skip validation step — we handle it separately for validation_failed status
            const keyLower = key.toLowerCase();
            if (keyLower === 'validation' || keyLower === 'validation agent') return false;
            const stepStatus = (step.status || step.final_status || "").toLowerCase();
            return stepStatus === "failed" || stepStatus === "error" || stepStatus === "fail" || !!step.error;
        });
        if (hasFailedStep) {
            return "failed";
        }

        const isParsingDone = !!(steps.parsing || steps["Parsing Agent"] || wb.parsing_status || baseStatus.includes("paused") || baseStatus.includes("parsing"));
        if (!hasDownstream) {
            if (isParsingDone || baseStatus === "completed" || baseStatus === "success" || baseStatus === "done") {
                return "lite_migration_completed";
            }
        }

        if (baseStatus.includes("paused") || baseStatus.includes("parsing")) {
            return "paused_at_parsing";
        }

        // Check generation_status field directly for failure
        if (wb.generation_status) {
            const genStatus = (typeof wb.generation_status === 'string' ? wb.generation_status : (wb.generation_status.status || "")).toLowerCase();
            if (genStatus === "failed" || genStatus === "error" || genStatus === "fail" || genStatus.includes("fail") || genStatus.includes("error")) {
                return "failed";
            }
        }

        if (hasValidation) {
            // Check if validation explicitly failed
            const valStep = steps.validation || steps["Validation Agent"];
            const valStatusRaw = wb.validation_status || (typeof valStep === 'object' ? (valStep.status || valStep.final_status) : valStep) || "";
            const valStatus = (typeof valStatusRaw === 'string' ? valStatusRaw : "").toLowerCase();
            if (valStatus === "failed" || valStatus === "error" || valStatus === "fail" || valStatus.includes("fail")) {
                return "validation_failed";
            }
            return "full_migration_completed";
        }
        if (hasGeneration) {
            return "generation_completed";
        }
        if (baseStatus === "completed" || baseStatus === "success" || baseStatus === "done") {
            return "full_migration_completed";
        }
        return baseStatus;
    };

    // Hydrate timezone from backend on mount
    useEffect(() => {
        useUIStore.getState().fetchTimezone();
    }, []);

    // Debounce search input (500ms)
    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [searchQuery]);



    useEffect(() => {
        if (selectedHistoricalRunId && workbookDetailsRef.current) {
            workbookDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [selectedHistoricalRunId]);

    useEffect(() => {
        if (!user?.email || activeTab !== "History") return;

        fetchRunHistory(user.email, {
            page: currentPage,
            pageSize,
            filters: { status: backendStatus, search: debouncedSearch, timeframe },
        });
    }, [user?.email, fetchRunHistory, activeTab, currentPage, timeframe, backendStatus, debouncedSearch, timezone]);

    useEffect(() => {
        if (pagination.page && pagination.page !== currentPage) {
            setCurrentPage(pagination.page);
        }
    }, [pagination.page, currentPage]);

    useEffect(() => {
        if (isFirstRender.current) return;
        setCurrentPage(1);
    }, [timeframe, debouncedSearch, statusFilter]);

    useEffect(() => {
        if (isFirstRender.current) return;
        setSelectedHistoricalRunId("");
        setHistoryLevel("runs");
    }, [timeframe, debouncedSearch, statusFilter]);

    useEffect(() => {
        isFirstRender.current = false;
    }, []);

    const mergeRunAndWorkbook = useCallback((run: any, item: any) => {
        const merged = {
            ...run,
            ...item,
            parent_status: run.status || run.overall_status || "",
            steps: { ...(run.steps || {}), ...(item.steps || {}) }
        };

        // ONLY prevent validation status bleed from parent run to child item.
        // Parsing, mapping, and generation are batch steps and SHOULD be inherited.
        if (item.validation_status === undefined) delete merged.validation_status;

        // Also strip validation from steps if it's inherited from the parent
        if (!item.steps?.validation && !item.steps?.["Validation Agent"]) {
            delete merged.steps.validation;
            delete merged.steps["Validation Agent"];
        }

        // Prevent overall migration completion status bleed, but allow active states to inherit
        if (item.status === undefined && item.final_status === undefined && item.overall_status === undefined) {
            const parentStatus = (run.status || run.overall_status || "").toLowerCase();
            if (parentStatus !== "running" && parentStatus !== "pending" && parentStatus !== "processing") {
                delete merged.status;
                delete merged.final_status;
                delete merged.overall_status;
            }
        }
        return merged;
    }, []);

    // Sync selected modal run if it updates
    useEffect(() => {
        if (isModalOpen && selectedModalRun) {
            const updatedRun = currentPageRunHistory.find(r => r.run_id === selectedModalRun.run_id);
            if (updatedRun) {
                const originalWorkbookId = selectedModalRun.workbook_id;
                let nextModalRun = updatedRun;
                if (originalWorkbookId && originalWorkbookId !== "multiple") {
                    const processedItems = (updatedRun as any).payload?.processed_items || (updatedRun as any).payload?.parsed_items || updatedRun.processed_items || (updatedRun as any).parsed_items || [];
                    const matchingItem = processedItems.find((item: any) => item.workbook_id === originalWorkbookId);
                    if (matchingItem) {
                        nextModalRun = mergeRunAndWorkbook(updatedRun, matchingItem);
                    }
                }
                if (JSON.stringify(nextModalRun) !== JSON.stringify(selectedModalRun)) {
                    setSelectedModalRun(nextModalRun);
                }
            }
        }
    }, [currentPageRunHistory, isModalOpen, selectedModalRun, mergeRunAndWorkbook]);

    // Discover active runs and start polling
    useEffect(() => {
        if (!user?.email || activeTab !== "History") {
            stopAllPolling();
            return;
        }
        const activeStatuses = ["running", "processing", "pending"];

        currentPageRunHistory.forEach(run => {
            const status = (run.overall_status || "").toLowerCase();
            if (activeStatuses.includes(status)) {
                startPolling(user.email, run.run_id);
            }
        });
    }, [currentPageRunHistory, user?.email, startPolling, activeTab, stopAllPolling]);

    // Cleanup all polling on unmount
    useEffect(() => {
        return () => {
            stopAllPolling();
        };
    }, [stopAllPolling]);

    const handleViewDetails = (run: any) => {
        setSelectedModalRun(run);
        setIsModalOpen(true);
    };

    const filterRunHistoryItems = useCallback((historyArray: any[]) => {
        const mapped = historyArray.map(run => {
            const r = run as any;
            const processedItems = r.payload?.processed_items || r.payload?.parsed_items || r.processed_items || r.parsed_items || [];
            let runStatus = "pending";
            let isStandard = false;
            let counts: any = null;

            if (processedItems.length > 0) {
                const wbStatuses = processedItems.map((item: any) => {
                    const wb = mergeRunAndWorkbook(r, item);
                    if (isStandardRun(wb)) isStandard = true;
                    return getWorkbookStatusForHistory(wb);
                });

                const completedCount = wbStatuses.filter((s: string) => s === "full_migration_completed" || s === "completed" || s === "success" || s === "done").length;
                const failedCount = wbStatuses.filter((s: string) => s === "failed" || s === "validation_failed" || s === "error" || s === "fail").length;
                const pendingCount = wbStatuses.filter((s: string) => s === "generation_completed" || s === "generation_done").length;

                counts = { completed: completedCount, failed: failedCount, pending: pendingCount, total: processedItems.length };

                const hasValidationFailed = wbStatuses.some((status: any) => status === "validation_failed");
                const hasLiteCompleted = wbStatuses.some((status: any) => status === "lite_migration_completed");
                const hasPaused = wbStatuses.some((status: any) => status === "paused_at_parsing");

                let parentStatus = (r.status || r.overall_status || "").toLowerCase();
                if (parentStatus.startsWith("(")) {
                    const match = parentStatus.match(/^\(([^)]+)\)/);
                    if (match) {
                        parentStatus = match[1].toLowerCase();
                    }
                }
                if (parentStatus === "cancelled" || parentStatus === "stopped") {
                    runStatus = parentStatus;
                } else if (parentStatus === "failed" || parentStatus === "error") {
                    runStatus = "failed";
                } else if (completedCount > 0 && completedCount >= failedCount) {
                    runStatus = "full_migration_completed";
                } else if (failedCount > 0) {
                    const hasHardFailure = wbStatuses.some((status: any) => status === "failed" || status === "error" || status === "fail");
                    runStatus = hasHardFailure ? "failed" : "validation_failed";
                } else if (pendingCount > 0) {
                    runStatus = "generation_completed";
                } else if (hasLiteCompleted) {
                    runStatus = "lite_migration_completed";
                } else if (hasPaused) {
                    runStatus = "paused_at_parsing";
                } else {
                    if (processedItems.length === 1 && ["parsing_completed", "mapping_completed", "datalayer_completed", "assessment_completed", "validation_completed", "generation_completed"].includes(wbStatuses[0])) {
                        runStatus = wbStatuses[0];
                    } else {
                        runStatus = (r.overall_status || "").toLowerCase() === "running" ? "running" : "pending";
                    }
                }
            } else {
                if (isStandardRun(r)) isStandard = true;
                runStatus = getWorkbookStatusForHistory(r);
            }
            return { ...run, overall_status: runStatus, isStandard, counts };
        });

        return mapped.filter(run => {
            if (isLiteMode() && run.isStandard) return false;

            if (debouncedSearch) {
                const searchLower = debouncedSearch.toLowerCase();
                const runId = String(run.run_id || "").toLowerCase();
                const runNo = String(run.run_no || "").toLowerCase();
                const prName = String(run.project_name || run.project_id || "").toLowerCase();
                const wbName = String(run.workbook_name || run.workbook_id || "").toLowerCase();
                if (!runId.includes(searchLower) && !runNo.includes(searchLower) && !prName.includes(searchLower) && !wbName.includes(searchLower)) {
                    return false;
                }
            }

            if (timeframe !== "All") {
                const runDate = parseDBTimestamp(run.created_at);
                if (!isNaN(runDate.getTime())) {
                    const { start, end } = getTimeframeBoundaries(timeframe, timezone);
                    const runMs = runDate.getTime();
                    if (runMs < start.getTime() || runMs > end.getTime()) {
                        return false;
                    }
                }
            }

            if (statusFilter === "All") return true;

            const runStatus = run.overall_status.toLowerCase();

            if (statusFilter === "Extraction Completed") {
                return runStatus.includes("paused") || runStatus.includes("parsing") || runStatus === "lite_migration_completed";
            }
            if (statusFilter === "Validation Pending") {
                if (run.counts && run.counts.pending > 0) return true;
                return runStatus === "generation_completed" || runStatus === "generation_done";
            }
            if (statusFilter === "Migration Completed") {
                if (run.counts && run.counts.completed > 0) return true;
                return runStatus === "full_migration_completed" || runStatus === "completed" || runStatus === "success" || runStatus === "done";
            }
            if (statusFilter === "Failed") {
                if (run.counts && run.counts.failed > 0) return true;
                if (["failed", "error", "fail"].some(s => runStatus.includes(s)) || runStatus === "validation_failed") return true;
                return false;
            }
            return true;
        });
    }, [statusFilter, timeframe, timezone, debouncedSearch]);

    const filteredRuns = useMemo(() => {
        const filtered = filterRunHistoryItems(currentPageRunHistory);
        return filtered.sort((a, b) => new Date((b as any).created_at).getTime() - new Date((a as any).created_at).getTime());
    }, [currentPageRunHistory, filterRunHistoryItems]);

    const allFilteredRuns = useMemo(() => {
        return filterRunHistoryItems(runHistory);
    }, [runHistory, filterRunHistoryItems]);


    const totalPages = Math.max(1, pagination.totalPages || 1);
    const totalPagesResolved = Math.max(1, totalPages);

    const isLocalStatusFilter = statusFilter !== "All" && statusFilter !== "Failed";
    const [exactLocalCount, setExactLocalCount] = useState<number | null>(null);

    useEffect(() => {
        if (!user?.email || !isLocalStatusFilter) {
            setExactLocalCount(null);
            return;
        }

        let isMounted = true;
        const fetchExactCount = async () => {
            try {
                const query = new URLSearchParams({
                    email_id: user.email,
                    page: "1",
                    page_size: "1000",
                });

                if (debouncedSearch) query.set("search", debouncedSearch);
                if (timeframe !== "All") {
                    const { start, end } = getTimeframeBoundaries(timeframe, timezone);
                    query.set("created_from", start.toISOString().replace(".000", ""));
                    query.set("created_to", end.toISOString().replace(".000", ""));
                }

                const res = await fetchWithAuth<any>(`/api/record/semantic-kernel?${query.toString()}`);
                if (!isMounted) return;

                let items = [];
                if (Array.isArray(res)) items = res;
                else if (Array.isArray(res?.data)) items = res.data;
                else if (Array.isArray(res?.items)) items = res.items;
                else if (Array.isArray(res?.records)) items = res.records;
                else if (Array.isArray(res?.result)) items = res.result;
                else if (Array.isArray(res?.runs)) items = res.runs;

                const mapped = items.map((item: any) => mapRunHistoryItem(item, false));
                const count = filterRunHistoryItems(mapped).length;
                setExactLocalCount(count);
            } catch (e) {
                console.error("Failed to fetch exact background count", e);
            }
        };

        fetchExactCount();
        return () => { isMounted = false; };
    }, [user?.email, isLocalStatusFilter, timeframe, timezone, debouncedSearch, statusFilter, filterRunHistoryItems]);

    const totalRunsCount = isLocalStatusFilter
        ? (exactLocalCount !== null ? exactLocalCount : allFilteredRuns.length)
        : (pagination.total || allFilteredRuns.length);
    const isPageTransitionLoading = isLoading && pagination.page !== currentPage;

    useEffect(() => { setPageInput(String(currentPage)); }, [currentPage]);

    const visibleRuns = isPageTransitionLoading ? [] : filteredRuns;

    const displayWorkbooks = useMemo(() => {
        const run = filteredRuns.find(r => r.run_id === selectedHistoricalRunId) || null;
        if (!run) {
            // filteredRuns is temporarily empty (refetch in progress) — serve cache
            return selectedHistoricalRunId ? cachedWorkbooksRef.current : [];
        }
        const items = run.processed_items || (run as any).payload?.processed_items || (run as any).payload?.parsed_items || [];
        const result = items.length > 0 ? items.map((i: any) => mergeRunAndWorkbook(run, i)) : [run];
        cachedWorkbooksRef.current = result; // keep cache up to date
        return result;
    }, [filteredRuns, selectedHistoricalRunId]);

    // Background log-fetching has been removed to reduce API calls for large numbers of files.

    const handlePageJump = useCallback(() => {
        const raw = Number.parseInt(pageInput || "", 10);
        if (Number.isNaN(raw)) { setPageInput(String(currentPage)); return; }
        const next = Math.min(Math.max(1, raw), totalPages);
        setCurrentPage(next);
        setPageInput(String(next));
    }, [pageInput, currentPage, totalPages]);

    const formatStatusText = (status: string): string => {
        const s = (status || "").toLowerCase();
        if (s === "pending" || s === "running" || s === "processing") {
            return "Processing";
        }
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
            return "Extraction Completed";
        }
        if (s === "completed" || s === "success" || s === "done") {
            return "Migration Completed";
        }
        return (status || "processing").split(/[_\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const statusBadgeColor = (s: string): "success" | "destructive" | "warning" | "secondary" | "default" => {
        const val = (s || "").toLowerCase();
        if (val === "pending" || val === "running" || val === "processing") return "default";
        if (val === "parsing_completed" || val === "mapping_completed" || val === "datalayer_completed" || val === "assessment_completed") return "default";
        if (val.includes("paused") || (val.includes("parsing") && val !== "parsing_completed")) return "success";
        if (val === "generation_completed" || val === "generation_done" || val === "validation_pending") return "warning";
        if (val === "validation_failed") return "destructive";
        if (val === "cancelled" || val === "stopped") return "destructive";
        if (val.includes("completed") || val.includes("success") || val.includes("done")) return "success";
        if (val.includes("failed") || val.includes("error")) return "destructive";
        return "secondary";
    };

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

    const renderStatusBadges = (app: any, wbStatus: string) => {
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

    const { summaryText, emptyStateText } = useMemo(() => {
        const timeText = timeframe === "All" ? "in total" : timeframe.toLowerCase();
        const countText = totalRunsCount;
        let summary = "";
        let empty = "";
        if (statusFilter === "All") {
            if (timeframe === "All") {
                summary = `Showing all ${countText.toLocaleString()} migration run(s).`;
            } else {
                summary = `${countText.toLocaleString()} migration run(s) found ${timeText}.`;
            }
        } else if (statusFilter === "Failed") {
            summary = `${countText.toLocaleString()} failed migration(s) found ${timeText}.`;
        } else if (statusFilter === "Migration Completed") {
            summary = `${countText.toLocaleString()} completed migration(s) found ${timeText}.`;
        } else if (statusFilter === "Validation Pending") {
            summary = `${countText.toLocaleString()} migration(s) pending validation ${timeText}.`;
        } else if (statusFilter === "Extraction Completed") {
            summary = `${countText.toLocaleString()} extraction-completed migration(s) found ${timeText}.`;
        } else {
            summary = `${countText.toLocaleString()} migration(s) found for ${statusFilter} ${timeText}.`;
        }

        if (totalRunsCount > 0) {
            empty = "No results found on this page. Please navigate to a different page.";
        } else if (statusFilter === "All") {
            if (timeframe === "All") {
                empty = `No migration history is available.`;
            } else {
                empty = `No migration runs were found ${timeText}.`;
            }
        } else if (statusFilter === "Failed") {
            empty = `No migrations failed ${timeText}.`;
        } else if (statusFilter === "Migration Completed") {
            empty = `No migrations were completed ${timeText}.`;
        } else if (statusFilter === "Validation Pending") {
            empty = `No migrations are currently pending validation ${timeText}.`;
        } else if (statusFilter === "Extraction Completed") {
            empty = `No extraction-completed migrations were found ${timeText}.`;
        } else {
            empty = `No migrations found for ${statusFilter} ${timeText}.`;
        }

        return { summaryText: summary, emptyStateText: empty };
    }, [statusFilter, timeframe, totalRunsCount]);

    const renderSidebar = () => (
        <div className="rh-sidebar">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: 600, fontSize: "var(--text-lg)" }}>Past Runs ({totalRunsCount})</span>
                {isLoading && <Spinner size="tiny" />}
            </div>
            <div className="rh-filter-container">
                <div className="rh-filter-search">
                    <Search size={16} className="integrations-search-icon" />
                    <Input
                        placeholder="Search by run ID or number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: "100%", paddingLeft: "32px" }}
                    />
                </div>
                <Select value={timeframe} onValueChange={(v: string) => setTimeframe(v)} style={{ width: "100%" }}>
                    <SelectItem value="All">All Time</SelectItem>
                    <SelectItem value="Today">Today</SelectItem>
                    <SelectItem value="Yesterday">Yesterday</SelectItem>
                    <SelectItem value="This Week">This Week</SelectItem>
                </Select>
                <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v)} style={{ width: "100%" }}>
                    <SelectItem value="All">All Status</SelectItem>
                    <SelectItem value="Extraction Completed">Extraction Completed</SelectItem>
                    {!isLiteMode() && <SelectItem value="Validation Pending">Validation Pending</SelectItem>}
                    {!isLiteMode() && <SelectItem value="Migration Completed">Migration Completed</SelectItem>}
                    <SelectItem value="Failed">Failed</SelectItem>
                </Select>
            </div>

            {totalRunsCount > 0 && (
                <div style={{ padding: "12px 16px", backgroundColor: "var(--surface-subtle)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500, margin: "4px 0 12px 0", borderRadius: "8px" }}>
                    {summaryText}
                </div>
            )}

            <div className="rh-table-container">
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                    <thead>
                        <tr>
                            <th className="rh-table-header-cell" style={{ minWidth: "200px" }}>Run Details</th>
                            <th className="rh-table-header-cell" style={{ minWidth: "150px" }}>Migration Scope</th>
                            <th className="rh-table-header-cell" style={{ minWidth: "100px" }}>Status</th>
                            <th className="rh-table-header-cell" style={{ width: "40px", minWidth: "40px" }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRuns.length > 0 ? visibleRuns.map(run => (
                            <tr key={run.run_id} className="rh-table-row" onClick={() => { setSelectedHistoricalRunId(run.run_id); setHistoryLevel("workbooks"); }}>
                                <td className="rh-table-cell">
                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <Folder size={20} style={{ color: "var(--text-muted)", minWidth: "20px" }} />
                                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                            <span style={{ fontWeight: 600, wordBreak: "break-word" }}>{run.run_no || run.run_id}</span>
                                            <span style={{ fontSize: "12px", color: "var(--text-muted)", wordBreak: "break-word" }}>{formatTs(run.created_at, false)}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="rh-table-cell">
                                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                        {run.execution_level && <Badge variant="secondary">EX: {run.execution_level}</Badge>}
                                        {run.project_type && <Badge variant="secondary">PR: {run.project_type}</Badge>}
                                    </div>
                                </td>
                                <td className="rh-table-cell">
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
                                        {(() => {
                                            if (!run.counts || run.counts.total <= 1) {
                                                return <Badge variant={statusBadgeColor(run.overall_status)}>{formatStatusText(run.overall_status)}</Badge>;
                                            }
                                            const { completed, failed, pending, total } = run.counts;

                                            const activeCategories = [completed, failed, pending].filter(c => c > 0).length;
                                            if (activeCategories === 1) {
                                                if (completed > 0) return <Badge variant="success">Migration Completed ({completed})</Badge>;
                                                if (failed > 0) return <Badge variant="destructive">Failed ({failed})</Badge>;
                                                if (pending > 0) return <Badge variant="warning">Validation Pending ({pending})</Badge>;
                                            }

                                            const parts = [];
                                            if (completed > 0) parts.push(<Badge key="comp" variant="success">Migration Completed ({completed}/{total})</Badge>);
                                            if (failed > 0) parts.push(<Badge key="fail" variant="destructive">Failed ({failed}/{total})</Badge>);
                                            if (pending > 0) parts.push(<Badge key="pend" variant="warning">Validation Pending ({pending}/{total})</Badge>);

                                            return parts.length > 0 ? parts : <Badge variant={statusBadgeColor(run.overall_status)}>{formatStatusText(run.overall_status)}</Badge>;
                                        })()}
                                    </div>
                                </td>
                                <td className="rh-table-cell" style={{ textAlign: "center" }}><ChevronRight size={20} /></td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} style={{ padding: 0 }}>
                                    <div className="rh-empty-state">
                                        <History size={32} style={{ color: "var(--text-muted)" }} />
                                        <span style={{ fontSize: "16px", fontWeight: 600 }}>{emptyStateText}</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* Pagination */}
            {(totalPages > 1 || currentPage > 1 || visibleRuns.length >= pageSize) && (
                <div className="rh-pagination">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        aria-label="Go to previous run history page"
                    >
                        <ChevronLeft size={20} />
                    </Button>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", minWidth: 0, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                            {currentPage} of {totalPages}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {pagination.total} runs
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                        <Input
                            value={pageInput}
                            onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ""))}
                            onKeyDown={(e) => { if (e.key === "Enter") handlePageJump(); }}
                            style={{ width: "100px", height: "30px" }}
                            aria-label="Jump to page"
                        />
                        <Button variant="ghost" size="sm" onClick={handlePageJump} disabled={isLoading}>Go</Button>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        aria-label="Go to next run history page"
                    >
                        <ChevronRight size={20} />
                    </Button>
                </div>
            )}

            {isPageTransitionLoading && (
                <div style={{ padding: "24px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", color: "var(--text-muted)" }}>
                    <Spinner size="tiny" />
                    <span style={{ fontSize: "13px" }}>Loading page {currentPage}...</span>
                </div>
            )}
        </div>
    );

    const getValidationDisplayStatus = (wb: any, wbStatus: string): { label: string; color: "success" | "destructive" | "warning" | "secondary" } | null => {
        const valStep = wb.steps?.validation || wb.steps?.["Validation Agent"];
        const valStatusRaw = (wb.validation_status || (typeof valStep === 'object' ? (valStep.status || valStep.final_status) : valStep) || "").toLowerCase();

        if (valStatusRaw === "completed" || valStatusRaw === "passed" || valStatusRaw === "success") {
            return { label: "Passed", color: "success" };
        }
        if (valStatusRaw === "failed" || valStatusRaw === "error" || wbStatus === "validation_failed") {
            return { label: "Failed", color: "destructive" };
        }
        if (valStatusRaw === "running" || valStatusRaw === "in_progress" || valStatusRaw === "processing") {
            return { label: "Running", color: "warning" };
        }
        if (wbStatus === "generation_completed" || wbStatus === "generation_done" || wbStatus === "full_migration_completed" || valStatusRaw === "pending") {
            return { label: "Pending", color: "warning" };
        }
        return null;
    };

    const renderWorkbooksTable = () => (
        <div className="rh-section-card" ref={workbookDetailsRef}>
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => setHistoryLevel("runs")}>
                    <ChevronLeft size={20} />
                    Back
                </Button>
                <span style={{ fontWeight: 600 }}>Run Workbooks</span>
            </div>
            {isLoading && displayWorkbooks.length === 0 ? (
                <div style={{ padding: "48px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <Spinner size="medium" label="Loading workbooks..." />
                </div>
            ) : (
            <div className="rh-table-container">
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "650px" }}>
                    <thead>
                        <tr>
                            <th className="rh-table-header-cell" style={{ minWidth: "180px", textAlign: "left" }}>Workbook</th>
                            <th className="rh-table-header-cell" style={{ minWidth: "100px", textAlign: "left" }}>Status</th>
                            {!isLiteMode() && <th className="rh-table-header-cell" style={{ minWidth: "90px", textAlign: "left" }}>Validation</th>}

                            <th className="rh-table-header-cell" style={{ minWidth: "120px", textAlign: "center" }}>Duration</th>
                            <th className="rh-table-header-cell" style={{ minWidth: "120px", textAlign: "center" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayWorkbooks.map((wb: any, idx: number) => {
                            const wbStatus = getWorkbookStatusForHistory(wb);
                            const validationDisplay = getValidationDisplayStatus(wb, wbStatus);
                            const isValidationPending = validationDisplay?.label === "Pending";
                            const wbId = wb.workbook_id || wb.workbook_id;
                            return (
                                <tr key={idx} className="rh-table-row" onClick={() => handleViewDetails(wb)}>
                                    <td className="rh-table-cell" style={{ wordBreak: "break-word" }}>{wb.workbook_name || wb.workbook_id || "Unknown Workbook"}</td>
                                    <td className="rh-table-cell">
                                        {renderStatusBadges(wb, wbStatus)}
                                    </td>
                                    {!isLiteMode() && (
                                        <td className="rh-table-cell">
                                            {validationDisplay ? (
                                                <Badge variant={validationDisplay.color}>{validationDisplay.label}</Badge>
                                            ) : (
                                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>
                                            )}
                                        </td>
                                    )}
                                    <td className="rh-table-cell" style={{ textAlign: "center" }}>
                                        <DurationTimer
                                            startTime={wb.start_time || wb.created_at || (wb.payload && wb.payload.timestamp)}
                                            status={wbStatus}
                                            endTime={wb.end_time || wb.updated_at || (wb.payload && wb.payload.completed_at)}
                                            totalDuration={parseDurationStr(wb.time_duration || wb.time_elapsed || wb.duration_seconds || wb.duration || wb.elapsed_seconds || wb.elapsed || wb.payload?.time_duration || wb.payload?.duration_seconds)}
                                            activities={getLogsForRun(wb.workbook_id, selectedHistoricalRunId)}
                                            runId={selectedHistoricalRunId}
                                            workbookId={wb.workbook_id}
                                        />
                                    </td>
                                    <td className="rh-table-cell" style={{ textAlign: "center" }}>
                                        <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetails(wb); }}>Details</Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            )}
        </div>
    );

    return (
        <div className="rh-container">
            <div className="rh-header">
                <div>
                    <h1 className="vl-title" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <History size={24} style={{ minWidth: "24px" }} />
                        <span>Run History</span>
                    </h1>
                    <p className="vl-subtitle">Review previous migration runs and their detailed logs.</p>
                </div>
                <Button
                    onClick={() => user?.email && fetchRunHistory(user.email, { page: currentPage, pageSize, force: true, filters: { status: backendStatus, search: debouncedSearch, timeframe } })}
                    disabled={isLoading}
                    style={{ whiteSpace: "nowrap", minWidth: "fit-content" }}
                >
                    Refresh
                </Button>
            </div>
            <div className="rh-main-layout">
                {(!hasFetched && isLoading) ? (
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", minHeight: "400px", backgroundColor: "var(--surface)", borderRadius: "16px", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
                        <Spinner size="large" label="Fetching run history..." />
                    </div>
                ) : historyLevel === "runs" ? renderSidebar() : <div className="rh-content-area">{renderWorkbooksTable()}</div>}
            </div>
            <RunDetailsModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} runData={selectedModalRun} />
        </div>
    );
}
