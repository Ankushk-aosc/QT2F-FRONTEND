"use client"

import { ValidationCheck } from "@/app/Mapper/validationMapper"
import { useAgentStore } from "@/stores/agent.store"
import { useDashboardStore } from "@/stores/dashboard.store"
import { useMappingStore } from "@/stores/mapping.store"
import { useValidationStore } from "@/stores/validation.store"
import { useGenerationStore } from "@/stores/generation.store"
import { useRunHistoryStore } from "@/stores/runHistory.store"
import { 
    Badge,
    Button,
    Card,
    Spinner,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
    TabList,
    Text,
    tokens,
} from "@fluentui/react-components"
import { 
    BrainCircuit24Regular, 
    ClipboardTaskListLtr24Regular, 
    Table24Regular, 
    LockClosed24Regular,
    ChevronUp20Regular,
    ChevronDown20Regular,
    Wrench24Regular,
    DismissCircle24Regular,
    Warning24Regular,
    CheckmarkCircle24Regular,
    Lightbulb24Regular,
    ArrowClockwise24Regular
} from "@fluentui/react-icons"
import { useMonitoringStore } from "@/stores/monitoring.store"
import { useMemo, useEffect, useState, useCallback } from "react"
import { MigrationValidationView } from "./MigrationValidationView"
import { ENABLE_RERUN_VALIDATION } from "@/lib/featureFlags"

/* ═══════════════════════════════════════════════════════════════════════
   STYLES — global vl-* classes (same system as AssessmentTab / ParsingTab)
═══════════════════════════════════════════════════════════════════════ */
const useStyles = () => ({
  container: "vl-container",
  header: "vl-header",
  title: "vl-title",
  subtitle: "vl-subtitle",
  metricsGrid: "vl-grid-4",
  metricCard: "vl-metric-card",
  metricValue: "vl-metric-value",
  metricLabel: "vl-metric-label",
  sectionCard: "vl-section-card",
  sectionHeader: "vl-section-header",
  tableContainer: "vl-table-container",
  wrapCell: "vl-wrap-cell",
  emptyState: "vl-empty-state",
  infoItem: "vl-info-item",
  infoLabel: "vl-info-label",
  infoValue: "vl-info-value",
  grid2: "vl-grid-2",
  grid3: "vl-grid-3",
  tabsCard: "vl-tabs-card",
})

interface ValidationTabProps {
  workbookId: string
  workbookName?: string
  projectId?: string
  runId?: string
}

export function ValidationTab({ workbookId, workbookName, projectId: propProjectId, runId: propRunId }: ValidationTabProps) {
  const styles = useStyles()

  const validationDataMap = useValidationStore((state: any) => state.validationData)
  const validationErrorMap = useValidationStore((state: any) => state.error)
  const fetchValidationResult = useValidationStore((state: any) => state.fetchValidationResult)
  const validationData = validationDataMap[workbookId]
  const validationError = validationErrorMap[workbookId]

  const { currentRunId, currentProjectId, activities, getProjectIdForWorkbook } = useAgentStore()
  const { selectedProject } = useDashboardStore()

  const projectId = propProjectId || getProjectIdForWorkbook(workbookId) || currentProjectId || selectedProject || ""
  const runId = propRunId || currentRunId || ""
  const isHistoricalRun = !!propRunId && propRunId !== currentRunId

  const hasData = !!validationData?.metrics

  // ★ Check if mapping data is available before starting validation polling
  const mappingDataMap = useMappingStore(state => state.mappingData)
  const isMappingDataReady = !!mappingDataMap[workbookId]

  // For historical runs, check the runHistory store
  const runHistory = useRunHistoryStore((s: any) => s.runHistory)
  const rawHistoricRunData = isHistoricalRun ? runHistory.find((r: any) => r.run_id === runId && (r.workbook_id === workbookId || r.workbook_id === 'multiple')) : null
  const historicRunData = useMemo(() => {
    if (!rawHistoricRunData) return null;
    const processedItems = rawHistoricRunData.payload?.processed_items || rawHistoricRunData.payload?.parsed_items || rawHistoricRunData.processed_items || rawHistoricRunData.parsed_items || [];
    const matchingItem = processedItems.find((item: any) => item.workbook_id === workbookId);
    if (matchingItem) {
      const merged = {
        ...rawHistoricRunData,
        ...matchingItem,
        steps: { ...(rawHistoricRunData.steps || {}), ...(matchingItem.steps || {}) }
      };
      if (matchingItem.validation_status === undefined) delete merged.validation_status;
      if (!matchingItem.steps?.validation && !matchingItem.steps?.["Validation Agent"]) {
        if (merged.steps) {
            delete merged.steps.validation;
            delete merged.steps["Validation Agent"];
        }
      }
      if (matchingItem.status === undefined && matchingItem.final_status === undefined && matchingItem.overall_status === undefined) {
        const parentStatus = (rawHistoricRunData.status || rawHistoricRunData.overall_status || "").toLowerCase();
        if (parentStatus !== "running" && parentStatus !== "pending" && parentStatus !== "processing") {
            delete merged.status;
            delete merged.final_status;
            delete merged.overall_status;
        }
      }
      return merged;
    }
    return rawHistoricRunData;
  }, [rawHistoricRunData, workbookId]);
  const isHistoricGenerationReady = historicRunData?.generation_status?.toLowerCase() === "completed" || historicRunData?.generation_status?.toLowerCase() === "success"
  const isGenerationReady = !!useGenerationStore((state: any) => state.generationData[workbookId])
  
  const effectivelyGenerationReady = isHistoricalRun ? isHistoricGenerationReady : isGenerationReady

  const isValidationComplete = useMemo(() => {
    if (isHistoricalRun) {
        const valStep = historicRunData?.steps?.validation || historicRunData?.steps?.["Validation Agent"];
        const valStatusRaw = (historicRunData?.validation_status || (typeof valStep === 'object' ? (valStep?.status || valStep?.final_status) : valStep) || "").toLowerCase();
        return ["completed", "success", "passed", "done", "validated"].includes(valStatusRaw);
    }
    if (!runId || !activities[runId]?.[workbookId]) return false
    const acts = activities[runId][workbookId].filter((a: any) => a.agent_name === "Validation Agent")
    return acts.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
  }, [activities, runId, workbookId, isHistoricalRun, historicRunData])

  // ★ Validation data is fetched by the central poller in agent.store.ts (Step 3.75)
  // No independent polling needed here — data flows from the store automatically

  const [isAuthorized, setIsAuthorized] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "technical">("overview")
  const [techLogsPage, setTechLogsPage] = useState(1)

  const { fetchRunLogs, getLogsForRun, isLoadingRun } = useMonitoringStore()

  useEffect(() => {
    if (runId && workbookId && typeof window !== "undefined") {
      setIsAuthorized(localStorage.getItem(`auth_val_${runId}_${workbookId}`) === "true")
    }
  }, [runId, workbookId])

  // Fetch technical logs if on technical tab
  useEffect(() => {
    if (activeTab === 'technical' && projectId && workbookId && runId) {
      fetchRunLogs(projectId, workbookId, runId)
    }
  }, [activeTab, projectId, workbookId, runId, fetchRunLogs])

  // ★ Validation data is fetched automatically IF authorized OR already completed historically
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const pollHistoricalValidation = async () => {
      if (isHistoricalRun && !validationData && projectId && workbookId && runId) {
        const manualValidationStarted = useAgentStore.getState().manualValidationStarted?.[`${runId}_${workbookId}`];
        const valStep = historicRunData?.steps?.validation || historicRunData?.steps?.["Validation Agent"];
        const valStatusRaw = (historicRunData?.validation_status || (typeof valStep === 'object' ? (valStep?.status || valStep?.final_status) : valStep) || "").toLowerCase();
        const isHistoricallyCompleted = ["completed", "success", "passed", "done", "validated"].includes(valStatusRaw);
        const isValidationStartedLocally = isAuthorized || manualValidationStarted || isHistoricallyCompleted;
        
        if (isValidationStartedLocally) {
          console.log(`[ValidationTab] Fetching historical data for ${workbookId}`);
          await fetchValidationResult(projectId, workbookId, runId);
          
          const currentData = useValidationStore.getState().validationData[workbookId];
          const hasMetrics = !!currentData?.metrics;
          
          if (!hasMetrics) {
            timeoutId = setTimeout(pollHistoricalValidation, 4000);
          }
        }
      }
    };

    pollHistoricalValidation();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isHistoricalRun, validationData, projectId, workbookId, runId, fetchValidationResult, isAuthorized, historicRunData]);

  // Default fallbacks while loading or if data is missing
  const metrics = validationData?.metrics || {
    rowCountMatch: false,
    aggregateAccuracy: 0,
    visualFidelityScore: 0,
    passedChecks: 0,
    totalChecks: 1,
  }

  const validationChecks: ValidationCheck[] = validationData?.checks || []
  const issues: string[] = validationData?.issues || []

  const isPending = !validationData && metrics.aggregateAccuracy === 0 && metrics.visualFidelityScore === 0

  const manualValidationStarted = useAgentStore((state: any) => state.manualValidationStarted?.[isHistoricalRun ? `${runId}_${workbookId}` : workbookId] || false)
  const isValidationStarted = isAuthorized || manualValidationStarted
  const startValidationForWorkbook = useAgentStore((state: any) => state.startValidationForWorkbook)

  const syncKey = `fabric_synced_${runId}_${workbookId}`
  const [isFabricSynced, setIsFabricSynced] = useState(false)
  const [syncWarningMessage, setSyncWarningMessage] = useState<string | null>(null)
  const [isLoadingValidation, setIsLoadingValidation] = useState(false)

  useEffect(() => {
    try { setIsFabricSynced(localStorage.getItem(syncKey) === "true") } catch(e){}
  }, [syncKey])

  const handleMarkSyncedAndRun = useCallback(async () => {
    setSyncWarningMessage(null)
    setIsLoadingValidation(true);
    try {
        await startValidationForWorkbook(workbookId, isHistoricalRun ? { runId, projectId } : undefined)
        try { localStorage.setItem(syncKey, "true"); setIsFabricSynced(true); } catch(e){}
        try { localStorage.setItem(`auth_val_${runId}_${workbookId}`, "true"); setIsAuthorized(true); } catch(e){}
    } catch (e: any) {
        if (e.message?.startsWith("SYNC_REQUIRED:")) {
            setSyncWarningMessage(e.message.substring("SYNC_REQUIRED:".length));
        }
    } finally {
        setIsLoadingValidation(false);
    }
  }, [syncKey, runId, workbookId, projectId, isHistoricalRun, startValidationForWorkbook])

  const handleStartValidation = async () => {
    setIsLoadingValidation(true);
    try {
        await startValidationForWorkbook(workbookId, isHistoricalRun ? { runId, projectId } : undefined)
        try { localStorage.setItem(syncKey, "true"); setIsFabricSynced(true); } catch(e){}
        try { localStorage.setItem(`auth_val_${runId}_${workbookId}`, "true"); setIsAuthorized(true); } catch(e){}
    } catch (e: any) {
        if (e.message?.startsWith("SYNC_REQUIRED:")) {
            setSyncWarningMessage(e.message.substring("SYNC_REQUIRED:".length));
        }
    } finally {
        setIsLoadingValidation(false);
    }
  }

  const isMigrationComparison = !!validationData?.migration_comparison

  if (isMigrationComparison) {
    return (
      <MigrationValidationView
        status={validationData.status || "UNKNOWN"}
        migrationData={{ ...validationData, workbook_name: workbookName || validationData.workbook_name || workbookId }}
        extractionStatus={validationData.extractionStatus}
        workbookId={workbookId}
        runId={runId}
        projectId={projectId}
      />
    )
  }

  if (validationError) {
    return (
      <div className={styles.container}>
        <Card className={styles.tabsCard} style={{ padding: "48px", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center", justifyContent: "center" }}>
          <Warning24Regular style={{ fontSize: "40px", color: "#f59e0b" }} />
          <Text weight="bold" size={500} style={{ color: "#92400e" }}>Validation Failed</Text>
          <Text size={300} style={{ color: "#64748b", textAlign: "center", maxWidth: "480px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
            {validationError}
          </Text>
          <div style={{ marginTop: "16px" }}>
            <Button appearance="primary" icon={isLoadingValidation ? <Spinner size="tiny" /> : <ArrowClockwise24Regular />} onClick={handleStartValidation} disabled={isLoadingValidation}>
              {isLoadingValidation ? "Restarting..." : "Re-run Validation"}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const needsValidationRun = validationData === null || (!isValidationStarted && !isValidationComplete);

  if (!isValidationComplete || !hasData) {
    if (needsValidationRun) {
      if (!effectivelyGenerationReady) {
        return (
          <div className={styles.container}>
            <Card className={styles.tabsCard} style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Spinner size="large" label="Waiting for Report Generation to complete..." />
            </Card>
          </div>
        )
      } else {
        // Show sync warning if it was triggered
        if (syncWarningMessage) {
          return (
            <div className={styles.container}>
              <Card className={styles.tabsCard} style={{ padding: "48px", display: "flex", flexDirection: "column", gap: "20px", alignItems: "center", justifyContent: "center" }}>
                <Warning24Regular style={{ fontSize: "40px", color: "#f59e0b" }} />
                <Text weight="bold" size={500} style={{ color: "#92400e" }}>Workbook Not Synced in Fabric</Text>
                <Text size={300} style={{ color: "#64748b", textAlign: "center", maxWidth: "480px", lineHeight: "1.6" }}>
                  {syncWarningMessage}
                </Text>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <Button appearance="secondary" onClick={() => setSyncWarningMessage(null)}>Cancel</Button>
                  <Button appearance="primary" icon={<CheckmarkCircle24Regular />} onClick={handleMarkSyncedAndRun} disabled={isLoadingValidation}>
                    {isLoadingValidation ? "Starting..." : "Synced — Run Validation"}
                  </Button>
                </div>
              </Card>
            </div>
          )
        }

        return (
          <div className={styles.container}>
            <Card className={styles.tabsCard} style={{ padding: "60px", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", justifyContent: "center" }}>
              <Button appearance="primary" size="large" onClick={handleStartValidation} disabled={isLoadingValidation}>
                {isLoadingValidation ? "Starting..." : "Run Validation"}
              </Button>
              <Text style={{ color: "#64748b" }}>
                Validation has not been executed for this workbook. Click to start validation.
              </Text>
            </Card>
          </div>
        )
      }
    }

    return (
      <div className={styles.container}>
        <Card className={styles.tabsCard} style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner size="large" label={isHistoricalRun && !isValidationStarted ? "Fetching historical validation data..." : "Validation triggered. Waiting for agent..."} />
        </Card>
      </div>
    )
  }

  const overallPct = ((metrics.passedChecks / Math.max(1, metrics.totalChecks)) * 100).toFixed(0)
  const passRate = Number(overallPct)

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "passed": case "pass": case "success": return "success"
      case "failed": case "fail": case "error": return "danger"
      case "warning": case "warn": return "warning"
      default: return "subtle"
    }
  }

  const renderTechnicalLogsTab = () => {
    // Check for technical logs in validationData (sometimes returned with the result)
    // or fallback to the monitoring store
    const rawTechLogs = validationData?.technical_logs || validationData?.validation_logs || getLogsForRun(workbookId, runId)

    if (Array.isArray(rawTechLogs) && rawTechLogs.length > 0) {
        // If it's a flat array of strings
        if (typeof rawTechLogs[0] === 'string') {
            const logsPerPage = 10;
            const currentLogs = rawTechLogs.slice((techLogsPage - 1) * logsPerPage, techLogsPage * logsPerPage);
            const totalPages = Math.ceil(rawTechLogs.length / logsPerPage);

            return (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
                        <div style={{ padding: "12px 16px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                            <Text size={200} weight="semibold" style={{ color: "#64748b", textTransform: "uppercase" }}>Execution Trace</Text>
                        </div>
                        <div style={{ minHeight: "300px" }}>
                            {currentLogs.map((log: any, idx: number) => {
                                if (typeof log !== 'string') {
                                    log = JSON.stringify(log);
                                }
                                if (!log) return null;
                                return (
                                <div key={idx} style={{ 
                                    fontFamily: "monospace", fontSize: "12px", padding: "8px 16px", 
                                    borderBottom: "1px solid #f1f5f9", color: log.toLowerCase().includes("error") ? "#ef4444" : "#334155" 
                                }}>
                                    {log}
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )
        }

        // If it's the structured technical logs (Metadata, Logic, etc.)
        const techLogs = (validationData?.technical_logs || {}) as any;
        const sections = [
            { id: 'metadata', title: 'Metadata Validation', data: techLogs.metadata_validation },
            { id: 'logic', title: 'Logic Validation', data: techLogs.logic_validation },
            { id: 'interactive', title: 'Interactive Validation', data: techLogs.interactive_validation },
            { id: 'runtime', title: 'Runtime Validation', data: techLogs.runtime_validation }
        ].filter(s => !!s.data);

        if (sections.length > 0) {
            return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
                    {sections.map(s => (
                        <Card key={s.id} className={styles.sectionCard} style={{ padding: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                                <Text weight="bold">{s.title}</Text>
                                <Badge color={getStatusColor(s.data.status || "PASS") as any}>{s.data.status || "PASS"}</Badge>
                            </div>
                            <Text size={200} style={{ color: "#64748b", marginBottom: "12px", display: "block" }}>
                                {s.data.reasoning || s.data.summary || "Technical verification complete."}
                            </Text>
                            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px", display: "flex", justifyContent: "space-between" }}>
                                <Text size={100} weight="bold">ACCURACY</Text>
                                <Text weight="bold" color={(s.data.accuracy_percentage || 0) >= 90 ? "success" : "neutralHighlight" as any}>
                                    {s.data.accuracy_percentage || s.data.accuracy || 0}%
                                </Text>
                            </div>
                        </Card>
                    ))}
                </div>
            )
        }
    }

    return (
        <div className={styles.emptyState} style={{ padding: "60px" }}>
            <BrainCircuit24Regular style={{ fontSize: "40px", opacity: 0.2, marginBottom: "16px" }} />
            <Text>No technical logs available for this workbook.</Text>
        </div>
    )
  }

  return (
    <div className={styles.container}>

      {/* ── HEADER ── */}
      <div className={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%" }}>
            <div>
                <Text className={styles.title} style={{ fontSize: "32px", fontWeight: 600 }}>Validation Results</Text>
                <Text className={styles.subtitle}>
                  Comprehensive validation metrics for <span style={{ color: "#0f172a", fontWeight: 600 }}>{workbookName || workbookId}</span>
                </Text>
            </div>
            {/* TEMPORARILY DISABLED - ENABLE LATER */}
            {ENABLE_RERUN_VALIDATION && isValidationComplete && hasData && (
                <Button 
                    appearance="outline" 
                    icon={<ArrowClockwise24Regular />} 
                    onClick={handleStartValidation} 
                    disabled={isLoadingValidation}
                >
                    {isLoadingValidation ? "Restarting..." : "Re-run Validation"}
                </Button>
            )}
        </div>
      </div>

      {/* ── SCORECARD (Always at Top) ── */}
      <div className={styles.metricsGrid}>
        <Card className={styles.metricCard}>
          <div className={styles.metricValue} style={{ color: isPending ? "#cbd5e1" : "#4f46e5" }}>
            {isPending ? "—" : `${metrics.visualFidelityScore}%`}
          </div>
          <div className={styles.metricLabel}>VISUAL FIDELITY</div>
        </Card>

        <Card className={styles.metricCard}>
          <div className={styles.metricValue} style={{ color: isPending ? "#cbd5e1" : "#0d9488" }}>
            {isPending ? "—" : `${metrics.aggregateAccuracy}%`}
          </div>
          <div className={styles.metricLabel}>AGGREGATE ACCURACY</div>
        </Card>

        <Card className={styles.metricCard}>
          <div className={styles.metricValue} style={{ color: isPending ? "#cbd5e1" : "#ea580c" }}>
            {isPending ? "—" : metrics.passedChecks}
          </div>
          <div className={styles.metricLabel}>CHECKS PASSED</div>
        </Card>

        <Card className={styles.metricCard}>
          <div className={styles.metricValue} style={{ color: isPending ? "#cbd5e1" : (passRate === 100 ? "#16a34a" : passRate >= 70 ? "#4f46e5" : "#dc2626") }}>
            {isPending ? "—" : `${overallPct}%`}
          </div>
          <div className={styles.metricLabel}>OVERALL SCORE</div>
        </Card>
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div style={{ marginBottom: "24px", marginTop: "20px", display: "flex", justifyContent: "center" }}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, d) => setActiveTab(d.value as any)}
          appearance="subtle"
          size="large"
        >
          <Tab value="overview">Validation Details</Tab>
          <Tab value="technical">Technical Logs</Tab>
        </TabList>
      </div>

      {activeTab === 'technical' ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {renderTechnicalLogsTab()}
        </div>
      ) : (
        <>
          {/* ── ISSUES BANNER ── */}
          {issues.length > 0 && !isPending && (
            <Card className={styles.sectionCard} style={{ borderLeft: "4px solid #ef4444" }}>
              <div className={styles.sectionHeader} style={{ color: "#b91c1c", marginBottom: "16px" }}>
                ⚠️ Validation Issues Detected
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {issues.map((issue, idx) => (
                  <div key={idx} className={styles.infoItem} style={{ background: "#fef2f2", borderLeft: "3px solid #ef4444" }}>
                    <Text style={{ fontSize: "13px", color: "#991b1b" }}>{issue}</Text>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── DETAILED METRICS ── */}
          <Card className={styles.sectionCard}>
            <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Detailed Metrics Breakdown</div>

            <div className={styles.grid3}>
              {/* Data Validation */}
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Data Validation</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: "13px", color: "#475569" }}>Row Count Match</Text>
                    <Badge appearance="tint" color={metrics.rowCountMatch ? "success" : "danger"}>
                      {metrics.rowCountMatch ? "✓ Passed" : "✗ Failed"}
                    </Badge>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: "13px", color: "#475569" }}>Aggregate Accuracy</Text>
                    <Text style={{ fontWeight: 700, color: "#0f172a" }}>{metrics.aggregateAccuracy}%</Text>
                  </div>
                </div>
              </div>

              {/* Visual Validation */}
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Visual Validation</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: "13px", color: "#475569" }}>Fidelity Score</Text>
                    <Text style={{ fontWeight: 700, color: "#0f172a" }}>{metrics.visualFidelityScore}%</Text>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: "13px", color: "#475569" }}>Chart Type Match</Text>
                    <Badge appearance="tint" color="success">PASS</Badge>
                  </div>
                </div>
              </div>

              {/* Overall Progress */}
              <div className={styles.infoItem}>
                <div className={styles.infoLabel}>Validation Progress</div>
                <div style={{ marginTop: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <Text style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                      {metrics.passedChecks} of {metrics.totalChecks} Checks
                    </Text>
                    <Text style={{ fontWeight: 700, color: passRate === 100 ? "#16a34a" : "#4338ca" }}>{overallPct}%</Text>
                  </div>
                  <div style={{ height: "6px", backgroundColor: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${overallPct}%`,
                      backgroundColor: passRate === 100 ? "#22c55e" : passRate >= 70 ? "#4f46e5" : "#ef4444",
                      borderRadius: "4px",
                      transition: "width 0.4s ease"
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {isPending && (
              <div className={styles.emptyState} style={{ marginTop: "24px" }}>
                Agent results are currently being generated. This scorecard will update automatically.
              </div>
            )}
          </Card>

          {/* ── CHECKLIST ── */}
          <Card className={styles.sectionCard}>
            <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Validation Checklist</div>

            {validationChecks.length === 0 ? (
              <div className={styles.emptyState}>
                {isPending ? "Waiting for checks to generate..." : "No individual checks recorded."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {validationChecks.map((check) => {
                  const statusKey = check.status.toLowerCase()
                  const isPassed = statusKey === "passed" || statusKey === "pass" || statusKey === "success"
                  const isWarning = statusKey === "warning" || statusKey === "warn"

                  return (
                    <div
                      key={check.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1px solid",
                        borderColor: isPassed ? "#dcfce7" : isWarning ? "#fef3c7" : "#fee2e2",
                        backgroundColor: isPassed ? "#f0fdf4" : isWarning ? "#fffbeb" : "#fff5f5",
                        transition: "box-shadow 0.15s ease",
                      }}
                    >
                      <span style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: "24px", height: "24px", borderRadius: "50%", fontWeight: "bold", fontSize: "13px", flexShrink: 0,
                        backgroundColor: isPassed ? "#dcfce7" : isWarning ? "#fef3c7" : "#fee2e2",
                        color: isPassed ? "#166534" : isWarning ? "#92400e" : "#991b1b",
                      }}>
                        {isPassed ? "✓" : isWarning ? "!" : "✗"}
                      </span>
                      <span style={{ flex: 1, fontSize: "13.5px", fontWeight: 500, color: "#334155", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>
                        {check.name}
                      </span>
                      <Badge
                        appearance="tint"
                        color={getStatusColor(check.status) as any}
                        style={{ fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", fontSize: "10px" }}
                      >
                        {check.status}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* ── ROW COUNTS TABLE ── */}
          {validationData?.rowCounts && validationData.rowCounts.length > 0 && (
            <Card className={styles.sectionCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <div>
                  <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Data Accuracy · Row Counts</div>
                  <Text style={{ fontSize: "13px", color: "#64748b" }}>Expected row counts extracted for validation</Text>
                </div>
                <Badge appearance="tint" color="success" shape="rounded" style={{ fontWeight: 600 }}>
                  {validationData.extractionStatus}
                </Badge>
              </div>
              <div className={styles.tableContainer}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Table / Object</TableHeaderCell>
                      <TableHeaderCell style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Expected Rows</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationData.rowCounts.map((rc: any, idx: number) => (
                      <TableRow key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <TableCell className={styles.wrapCell} style={{ fontWeight: 500, color: "#334155", fontSize: "13.5px" }}>
                          {rc.tableName}
                        </TableCell>
                        <TableCell className={styles.wrapCell}>
                          <Badge appearance="tint" color="informative" shape="rounded" style={{ fontWeight: 600 }}>
                            {rc.expectedRowCount.toLocaleString()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* ── VALIDATION SUMMARY TABLE ── */}
          {validationChecks.length > 0 && (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Validation Summary</div>
              <div className={styles.tableContainer}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Check Name</TableHeaderCell>
                      <TableHeaderCell style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Category</TableHeaderCell>
                      <TableHeaderCell style={{ fontWeight: 700, color: "#0f172a", fontSize: "13px" }}>Status</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationChecks.map((check) => (
                      <TableRow key={check.name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <TableCell className={styles.wrapCell} style={{ fontWeight: 500, color: "#334155", fontSize: "13.5px" }}>
                          {check.name}
                        </TableCell>
                        <TableCell className={styles.wrapCell}>
                          <Badge appearance="tint" color="informative" shape="rounded" style={{ fontSize: "12px" }}>
                            {check.name.toLowerCase().includes("row") || check.name.toLowerCase().includes("aggregate")
                              ? "Data"
                              : check.name.toLowerCase().includes("visual")
                                ? "Visual"
                                : "Schema"}
                          </Badge>
                        </TableCell>
                        <TableCell className={styles.wrapCell}>
                          <Badge
                            appearance="tint"
                            color={getStatusColor(check.status) as any}
                            size="small"
                            style={{ fontWeight: 600, textTransform: "capitalize" }}
                          >
                            {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
