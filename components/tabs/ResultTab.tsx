"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectItem } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Toaster, toast } from "@/components/ui/toaster"
import { RefreshCw, X } from "lucide-react"
import { useAgentStore } from "@/stores/agent.store"

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ")
}

const styles = {
  container: "rt-container",
  controlsRow: "rt-controlsRow",
  selector: "rt-selector",
  label: "rt-label",
  projectValue: "rt-projectValue",
  tabList: "rt-tabList",
  tabContent: "rt-tabContent",
  centerLoading: "rt-centerLoading",
  tileIcon: "rt-tileIcon",
  sparkline: "rt-sparkline",
  sparklineBar: "rt-sparklineBar",
}

import { MigrationTabSkeleton } from "@/components/ui/Skeletons"

const AssessmentTab = dynamic(() => import("@/components/tabs/AssessmentTab").then(m => ({ default: m.AssessmentTab })), { ssr: false, loading: () => <MigrationTabSkeleton /> })
const ParsingTab = dynamic(() => import("@/components/tabs/ParsingTab").then(m => ({ default: m.ParsingTab })), { ssr: false, loading: () => <MigrationTabSkeleton /> })
const MappingTab = dynamic(() => import("@/components/tabs/MappingTab"), { ssr: false, loading: () => <MigrationTabSkeleton /> })
const DataLayerTab = dynamic(() => import("@/components/tabs/DataLayerTab").then(m => ({ default: m.DataLayerTab })), { ssr: false, loading: () => <MigrationTabSkeleton /> })
const ValidationTab = dynamic(() => import("@/components/tabs/ValidationTab").then(m => ({ default: m.ValidationTab })), { ssr: false, loading: () => <MigrationTabSkeleton /> })
const ReportGenerationTab = dynamic(() => import("@/components/tabs/ReportGenerationTab").then(m => ({ default: m.ReportGenerationTab })), { ssr: false, loading: () => <MigrationTabSkeleton /> })


import { useDashboardStore } from "@/stores/dashboard.store"
import { useParsingStore } from "@/stores/parsing.store"
import { useDatalayerStore } from "@/stores/datalayer.store"
import { useMappingStore } from "@/stores/mapping.store"
import { useValidationStore } from "@/stores/validation.store"
import { useGenerationStore } from "@/stores/generation.store"
import { useAuthStore } from "@/stores/auth.store"
import { useUIStore } from "@/stores/ui.store"
import { useMonitoringStore } from "@/stores/monitoring.store"
import { recordsService } from "@/services/records.service"
import { isLiteMode } from "@/lib/config"


type TabValue = "assessment" | "parsing" | "datalayer" | "mapping" | "validation" | "generation"

export function ResultTab() {
  const [selectedTab, setSelectedTab] = useState<TabValue>("assessment")

  const { selectedProject, selectedProjectName, applications } = useDashboardStore()
  const { mode, hasContinued, setHasContinued, dataLayerEnabled, selectedWorkbookId, setSelectedWorkbookId, workspace } = useUIStore()
  const isQlik = workspace === "qlik"

  const [isResuming, setIsResuming] = useState(false)
  const [showSyncWarningAll, setShowSyncWarningAll] = useState(false)
  const [isRevalidatingAll, setIsRevalidatingAll] = useState(false)
  const [globalValidationError, setGlobalValidationError] = useState<string | null>(null)
  const [syncModalErrors, setSyncModalErrors] = useState<string[]>([])
  const [isSyncModalLoading, setIsSyncModalLoading] = useState(false)
  
  const {
    currentRunId,
    assessmentData,
    currentWorkbookIds,
    isLoading,
    error: storeError,
    startPolling,
    shouldSkipDataLayer,
    assessmentActivitiesDone,
    parsingActivitiesDone,
    mappingActivitiesDone,
    datalayerActivitiesDone,
    generationActivitiesDone,
    validationActivitiesDone,
    startValidationForWorkbook,
    startValidationForWorkbooks,
    manualValidationStarted,
    isBulkValidationLoading
  } = useAgentStore()

  // ★ Sub-store selections moved to top to prevent ReferenceErrors in subsequent hooks
  const parsingDataMap = useParsingStore(state => state.parsingData)
  const parsingErrorMap = useParsingStore(state => state.error)
  const datalayerDataMap = useDatalayerStore(state => state.datalayerData)
  const datalayerErrorMap = useDatalayerStore(state => state.error)
  const mappingDataMap = useMappingStore(state => state.mappingData)
  const mappingErrorMap = useMappingStore(state => state.error)
  const validationDataMap = useValidationStore(state => state.validationData)
  const validationErrorMap = useValidationStore(state => state.error)
  const generationDataMap = useGenerationStore(state => state.generationData)
  const generationErrorMap = useGenerationStore(state => state.error)

  const stoppedRunIds = useMonitoringStore(s => s.stoppedRunIds) || []
  const isRunStopped = currentRunId ? stoppedRunIds.includes(currentRunId) : false

  const handleResumeClick = async () => {
    if (!currentRunId) return
    
    setIsResuming(true)
    try {
      const { assessmentData, currentWorkbookIds } = useAgentStore.getState()
      const runIdsToResume = new Set<string>();
      
      // Always include the main run ID (e.g. batch_id)
      runIdsToResume.add(currentRunId);

      // Collect all child run IDs from assessment payloads for project migrations
      currentWorkbookIds.forEach(wbId => {
        const payload = assessmentData[currentRunId]?.[wbId]?.payload;
        if (payload?.run_id) runIdsToResume.add(payload.run_id);
        if (payload?.runId) runIdsToResume.add(payload.runId);
        
        const raw = assessmentData[currentRunId]?.[wbId];
        if (raw?.run_id) runIdsToResume.add(raw.run_id);
        if (raw?.runId) runIdsToResume.add(raw.runId);
      });

      const finalRunIds = Array.from(runIdsToResume);
      console.log(`[Resume] Triggering resume for runs:`, finalRunIds)
      
      await recordsService.resumeMigration(finalRunIds as any)
      
      // Update UI state to unlock other tabs
      setHasContinued(true)
      
      // Restart polling to fetch subsequent stage results
      startPolling()
      
      console.log(`[Resume] ✅ Resume triggered successfully. Polling restarted.`)
    } catch (err) {
      console.error("[Resume] Error resuming migration:", err)
    } finally {
      setIsResuming(false)
    }
  }

  const toastShownRef = useRef(false)

  useEffect(() => {
    console.log("Mode switched:", mode)
  }, [mode])

  // 2. Build workbook list from applications (always available)
  //    + enrich with assessment data when it arrives
  const completedWorkbooks = useMemo(() => {
    // ★ FIRST: build from applications (available immediately from POST response)
    if (!currentRunId) return []

    const assessmentMap = assessmentData[currentRunId] || {}

    return currentWorkbookIds
      .map((id) => {
        // Try assessment data first (most accurate once available)
        const assessment = assessmentMap[id]
        // Fall back to application info (always available from startMigration response)
        const app = applications.find(a => a.workbookId === id)

        // For "all workbooks" view: show every workbook, even before assessment data arrives
        const name = assessment?.payload?.workbook_name
          || assessment?.workbook_name
          || app?.workbookName
          || id

        const projectId = assessment?.payload?.project_id
          || app?.projectId
          || selectedProject
          || "unknown"

        const projectName = assessment?.payload?.project_name
          || app?.projectName
          || selectedProjectName
          || "Unknown Project"

        return { id, name, projectId, projectName, hasAssessment: !!assessment }
      })
  }, [currentWorkbookIds, assessmentData, currentRunId, selectedProject, selectedProjectName, applications])

  // 3. Extract unique projects (from ALL workbooks, not just assessed ones)
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>()
    completedWorkbooks.forEach(wb => {
      if (!map.has(wb.projectId)) {
        map.set(wb.projectId, wb.projectName)
      }
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        const isDevA = nameA.includes("dev");
        const isDevB = nameB.includes("dev");
        if (isDevA && !isDevB) return -1;
        if (!isDevA && isDevB) return 1;
        const isTestA = nameA.includes("test");
        const isTestB = nameB.includes("test");
        if (!isTestA && isTestB) return -1;
        if (isTestA && !isTestB) return 1;
        return (a.name || "").localeCompare(b.name || "");
      })
  }, [completedWorkbooks])

  const hasMultipleProjects = uniqueProjects.length > 1

  // 4. Project selection state
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("")

  useEffect(() => {
    if (!selectedProjectFilter && uniqueProjects.length > 0) {
      setSelectedProjectFilter(uniqueProjects[0].id)
    }
  }, [uniqueProjects, selectedProjectFilter])

  // 5. Filter workbooks by selected project
  const filteredWorkbooks = useMemo(() => {
    if (!hasMultipleProjects) return completedWorkbooks
    if (!selectedProjectFilter) return completedWorkbooks
    return completedWorkbooks.filter(wb => wb.projectId === selectedProjectFilter)
  }, [completedWorkbooks, selectedProjectFilter, hasMultipleProjects])

  // ★ Only workbooks with assessment data can be viewed in detail
  const viewableWorkbooks = useMemo(() => {
    return filteredWorkbooks
      .filter(wb => wb.hasAssessment)
      .sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        const isDevA = nameA.includes("dev");
        const isDevB = nameB.includes("dev");
        if (isDevA && !isDevB) return -1;
        if (!isDevA && isDevB) return 1;
        const isTestA = nameA.includes("test");
        const isTestB = nameB.includes("test");
        if (!isTestA && isTestB) return -1;
        if (isTestA && !isTestB) return 1;
        return (a.name || "").localeCompare(b.name || "");
      })
  }, [filteredWorkbooks])

  useEffect(() => {
    if (viewableWorkbooks.length > 0) {
      const currentStillValid = viewableWorkbooks.some(wb => wb.id === selectedWorkbookId)
      if (!currentStillValid) {
        setSelectedWorkbookId(viewableWorkbooks[0].id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewableWorkbooks, selectedWorkbookId])

  // ★ Ensure the selected tab is valid for the current workbook context
  // If we're on Data Layer but the new workbook is Live, jump to Assessment
  useEffect(() => {
    if (selectedTab === "datalayer" && shouldSkipDataLayer(selectedWorkbookId)) {
      setSelectedTab("assessment")
    }
  }, [selectedTab, selectedWorkbookId, shouldSkipDataLayer])

  const userHasManuallySwitchedTabRef = useRef(false);

  const handleTabSelect = (value: string) => {
    userHasManuallySwitchedTabRef.current = true;
    setSelectedTab(value as TabValue);
  }

  // ★ Clear global validation error when switching workbooks or projects
  useEffect(() => {
    if (globalValidationError) {
      setGlobalValidationError(null);
    }
  }, [selectedWorkbookId, selectedProjectFilter]);

  const handleProjectChange = (value: string) => {
    setSelectedProjectFilter(value)
    setSelectedWorkbookId("")
  }

  const handleWorkbookChange = (value: string) => {
    setSelectedWorkbookId(value)
  }

  const hasAnyAssessment = viewableWorkbooks.length > 0
  const hasAnyWorkbooks = completedWorkbooks.length > 0

  // ★ Global Assessment Done check
  const isAllAssessmentDone = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(id => !!assessmentActivitiesDone?.[id] || !!assessmentData[currentRunId]?.[id]);
  }, [currentWorkbookIds, assessmentActivitiesDone, assessmentData, currentRunId]);

  // ★ Global Parsing Done check
  const isAllParsingDone = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(id => !!parsingDataMap?.[id] || !!parsingErrorMap?.[id]);
  }, [currentWorkbookIds, parsingDataMap, parsingErrorMap, currentRunId]);

  const assessmentProgress = useMemo(() => {
    if (!currentRunId) return { total: 0, completed: 0, pct: 0 };
    const total = currentWorkbookIds.length;
    const completed = currentWorkbookIds.filter(id => !!assessmentActivitiesDone[id] || !!assessmentData[currentRunId]?.[id]).length;
    return { total, completed, pct: total > 0 ? (completed / total) * 100 : 0 };
  }, [currentWorkbookIds, assessmentActivitiesDone, assessmentData, currentRunId]);

  // ★ Stage Completion Checks
  const isAllMappingDone = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(id => !!mappingDataMap?.[id] || !!mappingErrorMap?.[id]);
  }, [currentWorkbookIds, mappingDataMap, mappingErrorMap, currentRunId]);

  const isAllDatalayerDone = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(id => shouldSkipDataLayer(id) || !!(datalayerDataMap as any)?.[id] || !!(datalayerErrorMap as any)?.[id]);
  }, [currentRunId, currentWorkbookIds, shouldSkipDataLayer, datalayerDataMap, datalayerErrorMap]);

  const isAllGenerationDone = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(id => !!generationDataMap?.[id] || !!generationErrorMap?.[id]);
  }, [currentRunId, currentWorkbookIds, generationDataMap, generationErrorMap]);

  const isAllValidationDone = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(id => !!validationDataMap?.[id] || !!validationErrorMap?.[id]);
  }, [currentWorkbookIds, validationDataMap, validationErrorMap, currentRunId]);

  // ★ Auto-advance selectedTab as each stage's activities & results finish for the selected workbook
  const activeStageName = useMemo(() => {
    if (!isAllAssessmentDone) return "assessment";
    if (!isAllParsingDone) return "parsing";
    if (hasContinued && !isAllMappingDone) return "mapping";
    if (isAllMappingDone && !isAllGenerationDone) return "generation";
    if (isAllGenerationDone && !isAllValidationDone) return "validation";
    return null;
  }, [isAllAssessmentDone, isAllParsingDone, hasContinued, isAllMappingDone, isAllGenerationDone, isAllValidationDone]);

  useEffect(() => {
    if (activeStageName && !userHasManuallySwitchedTabRef.current) {
      setSelectedTab(activeStageName as TabValue);
    }
  }, [activeStageName]);

  const stages = isLiteMode()
    ? [
        { label: "Assessment", isDone: isAllAssessmentDone, isActive: !isAllAssessmentDone },
        { label: "Parsing", isDone: isAllParsingDone, isActive: isAllAssessmentDone && !isAllParsingDone },
      ]
    : [
        { label: "Assessment", isDone: isAllAssessmentDone, isActive: !isAllAssessmentDone },
        { label: "Parsing", isDone: isAllParsingDone, isActive: isAllAssessmentDone && !isAllParsingDone },
        { label: "Mapping", isDone: isAllMappingDone, isActive: isAllParsingDone && hasContinued && !isAllMappingDone },
      ];

  if (!isLiteMode() && dataLayerEnabled) {
    stages.push({
      label: "Data Layer",
      isDone: isAllDatalayerDone,
      isActive: isAllMappingDone && !isAllDatalayerDone
    });
  }

  const prevStepDone = dataLayerEnabled ? isAllDatalayerDone : isAllMappingDone;

  const selectedGenStatus = (generationDataMap[selectedWorkbookId]?.status || "").toLowerCase()
  const hasGenerationFailed = selectedGenStatus === 'failed' || selectedGenStatus === 'error'

  // ★ True if ANY workbook in the current batch has a failed/error generation status
  const hasAnyGenerationFailure = currentWorkbookIds.some(id => {
    const s = (generationDataMap?.[id]?.status || "").toLowerCase()
    return s === 'failed' || s === 'error'
  })

  if (!isLiteMode()) {
    stages.push(
      { label: "Generation", isDone: isAllGenerationDone && !hasGenerationFailed, isActive: prevStepDone && !isAllGenerationDone && !hasGenerationFailed },
      { label: "Validation", isDone: isAllValidationDone && !hasGenerationFailed, isActive: isAllGenerationDone && !isAllValidationDone && !hasGenerationFailed }
    );
  }

  const currentStageIndex = stages.findIndex(s => s.isActive);
  const displayStage = stages[currentStageIndex] || (isAllValidationDone ? stages[stages.length - 1] : stages[0]);

  const parsingProgress = useMemo(() => {
    if (!currentRunId) return { total: 0, completed: 0, pct: 0 };
    const total = currentWorkbookIds.length;
    const completed = currentWorkbookIds.filter(id => !!parsingActivitiesDone[id] || !!parsingDataMap[id]).length;
    return { total, completed, pct: total > 0 ? (completed / total) * 100 : 0 };
  }, [currentWorkbookIds, parsingActivitiesDone, parsingDataMap, currentRunId]);

  // ★ Aggregate project-wide metrics from all assessed workbooks
  const projectMetrics = useMemo(() => {
    const metrics = { workbooks: 0, datasources: 0, tables: 0, measures: 0, lods: 0, dimensions: 0 };
    if (!currentRunId) return metrics;

    metrics.workbooks = currentWorkbookIds.length;

    currentWorkbookIds.forEach(id => {
      const payload = assessmentData[currentRunId]?.[id]?.payload || {};
      
      // Data source counts
      metrics.datasources += (payload.logical_datasources?.length || 0);
      
      // Table counts (Try parsing results first, then assessment fallback)
      const pData = parsingDataMap[id];
      if (pData?.tables && Array.isArray(pData.tables)) {
         metrics.tables += pData.tables.length;
      } else {
         const assessmentTables = (payload.tables_analysis?.total_tables || payload.tables_analysis?.total_count || 0);
         if (assessmentTables > 0) {
            metrics.tables += assessmentTables;
         } else if (payload.logical_datasources) {
            payload.logical_datasources.forEach((ds: any) => {
               metrics.tables += (ds.tables?.length || ds.tableCount || 0);
            });
         }
      }
      
      // LOD counts (Prefer parsing counts if available)
      const parsingLods = pData?.calculations?.filter((c: any) => c.is_lod).length || 0;
      const assessmentLods = payload.lods_analysis?.total_count || 0;
      metrics.lods += Math.max(parsingLods, assessmentLods);

      // Measures and Dimensions (Intelligent selection: use parsing if available, fallback to assessment)
      const parsingMeasures = (typeof pData?.measures === "number" ? pData.measures : pData?.fields?.measures?.length) || 0;
      const parsingDimensions = (typeof pData?.dimensions === "number" ? pData.dimensions : pData?.fields?.dimensions?.length) || 0;
      
      if (parsingMeasures > 0 || parsingDimensions > 0) {
         metrics.measures += parsingMeasures;
         metrics.dimensions += parsingDimensions;
      } else if (payload.calculation_stats || payload.calculations_analysis || payload.metrics) {
         const stats = payload.calculation_stats || payload.calculations_analysis || {};
         const total = stats.total_calculations || stats.total_count || 0;
         const measures = stats.num_measures ?? (payload.metrics?.measures || 0);
         const dimensions = stats.num_dimensions ?? (payload.metrics?.dimensions || (total - measures));
         
         metrics.measures += Math.max(0, measures);
         metrics.dimensions += Math.max(0, dimensions);
      }
    });

    return metrics;
  }, [currentWorkbookIds, assessmentData, parsingDataMap, currentRunId]);

  // ★ Check if parsing data is actually available for the selected workbook
  const isParsingDataReady = !!parsingDataMap[selectedWorkbookId]

  // ★ Detect if the SELECTED workbook has assessment data (fallback for missing activities)
  const isAssessmentDataReady = useMemo(() => {
    return viewableWorkbooks.some(wb => wb.id === selectedWorkbookId)
  }, [viewableWorkbooks, selectedWorkbookId])

  // ★ Detect if the SELECTED workbook's assessment activities are complete
  const isAssessmentCompleteForSelected = !!assessmentActivitiesDone[selectedWorkbookId] || isAssessmentDataReady

  // ★ Parsing data is fetched by the central poller in agent.store.ts (Step 3)
  // No independent polling needed here — data flows from the store automatically

  // ★ Detect if the SELECTED workbook's parsing activities are complete
  const isParsingCompleteForSelected = !!parsingActivitiesDone[selectedWorkbookId]

  // ★ Check if datalayer data is actually available for the selected workbook
  const isDatalayerDataReady = !!datalayerDataMap[selectedWorkbookId]

  // ★ Detect if the SELECTED workbook's datalayer activities are complete
  const isDatalayerCompleteForSelected = !!datalayerActivitiesDone[selectedWorkbookId]



  // ★ Check if mapping data is actually available for the selected workbook
  const isMappingDataReady = !!mappingDataMap[selectedWorkbookId]



  // ★ Detect if the SELECTED workbook's mapping activities are complete
  const isMappingCompleteForSelected = !!mappingActivitiesDone[selectedWorkbookId]

  // ★ Mapping data is fetched by the central poller in agent.store.ts (Step 3.5)
  // No independent polling needed here — data flows from the store automatically

  useEffect(() => {
    if (mode === 'single' && !hasContinued && hasAnyAssessment && !toastShownRef.current) {
       toast("success", "Assessment completed for selected workbook");
       toastShownRef.current = true;
    }
  }, [mode, hasContinued, hasAnyAssessment]);

  useEffect(() => {
    if (!hasAnyAssessment) {
       toastShownRef.current = false;
    }
  }, [hasAnyAssessment]);

  // ★ Check if validation data is actually available for the selected workbook
  const isValidationDataReady = !!validationDataMap[selectedWorkbookId]



  // ★ Validation data is fetched by the central poller in agent.store.ts (Step 3.75)
  // No independent polling needed here — data flows from the store automatically

  // ★ Detect if the SELECTED workbook's validation activities are complete
  const isValidationCompleteForSelected = !!validationActivitiesDone[selectedWorkbookId]

  // ★ Detect if the SELECTED workbook's generation activities are complete
  const isGenerationCompleteForSelected = !!generationActivitiesDone[selectedWorkbookId]

  // ★ Check if generation data is actually available for the selected workbook
  const isGenerationDataReady = !!generationDataMap[selectedWorkbookId]

  // ★ No longer force-switch to assessment — instead we show a loading state inside the parsing tab

  // Memoized AssessmentTab
  const memoizedAssessmentTab = useMemo(() => {
    if (!selectedWorkbookId) return null;
    return <AssessmentTab selectedWorkbookId={selectedWorkbookId} />;
  }, [selectedWorkbookId]);

  const renderCurrentTab = () => {
    const renderStoppedMessage = (stageName: string, wbName: string) => {
      return (
        <div className={styles.centerLoading}>
          <X style={{ fontSize: "48px", width: 48, height: 48, color: "var(--danger)" }} />
          <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)", marginTop: 12 }}>
            Migration Stopped
          </span>
          <span style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: 4 }}>
            This migration run was terminated. {stageName} results for <strong>{wbName}</strong> are not available.
          </span>
        </div>
      )
    }

    // ★ Show error if backend is down
    if (storeError && !hasAnyAssessment) {
      return (
        <div className={styles.centerLoading}>
          <Alert variant="default" style={{ maxWidth: 500 }}>
            <AlertTitle>Waiting for backend</AlertTitle>
            <AlertDescription>{storeError}</AlertDescription>
          </Alert>
        </div>
      )
    }

    if (!hasAnyAssessment) {
      if (isRunStopped) {
        return (
          <div className={styles.centerLoading}>
            <X style={{ fontSize: "48px", width: 48, height: 48, color: "var(--danger)" }} />
            <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)", marginTop: 12 }}>
              Migration Stopped
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: 4 }}>
              This migration run was terminated.
            </span>
          </div>
        )
      }

      return (
        <div className={styles.centerLoading}>
          <Spinner size="extra-large" label="Waiting for results..." />
          {hasAnyWorkbooks && (
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: 8 }}>
              {completedWorkbooks.length} workbook(s) processing...
            </span>
          )}
        </div>
      )
    }

    if (selectedTab === 'parsing') {
      // ★ If parsing data isn't ready yet, show a loading message instead of switching tabs
      if (!isParsingDataReady) {
        const wbName = viewableWorkbooks.find(w => w?.id === selectedWorkbookId)?.name || selectedWorkbookId
        if (isRunStopped) {
          return renderStoppedMessage("Parsing", wbName)
        }
        return (
          <div className={styles.centerLoading}>
            <Spinner size="extra-large" />
            <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)", marginTop: 12 }}>
              Fetching parsing data for <strong>{wbName}</strong>...
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: 4 }}>
              This may take a moment. Results will appear automatically.
            </span>
          </div>
        )
      }
      const wb = viewableWorkbooks.find(w => w?.id === selectedWorkbookId)
      return (
        <ParsingTab
          workbookId={selectedWorkbookId}
          projectId={wb?.projectId || selectedProject || ""}
        />
      )
    }

    if (selectedTab === 'datalayer') {
      // ★ If datalayer data isn't ready yet, show a loading message or skipped message
      if (!isDatalayerDataReady) {
        const wbName = viewableWorkbooks.find(w => w?.id === selectedWorkbookId)?.name || selectedWorkbookId
        if (isRunStopped) {
          return renderStoppedMessage("Data Layer", wbName)
        }
        // Data layer will show the loading spinner until data is explicitly loaded or an error is explicitly triggered.
        return (
          <div className={styles.centerLoading}>
            <Spinner size="extra-large" />
            <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)", marginTop: 12 }}>
              Fetching data layer results for <strong>{wbName}</strong>...
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: 4 }}>
              This may take a moment. Results will appear automatically.
            </span>
          </div>
        )
      }
      const wb = viewableWorkbooks.find(w => w?.id === selectedWorkbookId)
      return (
        <DataLayerTab
          workbookId={selectedWorkbookId}
          projectId={wb?.projectId || selectedProject || ""}
        />
      )
    }

    if (selectedTab === 'mapping') {
      // ★ If mapping data isn't ready yet, show a loading message
      if (!isMappingDataReady) {
        const wbName = viewableWorkbooks.find(w => w?.id === selectedWorkbookId)?.name || selectedWorkbookId
        if (isRunStopped) {
          return renderStoppedMessage("Mapping", wbName)
        }
        return (
          <div className={styles.centerLoading}>
            <Spinner size="extra-large" />
            <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)", marginTop: 12 }}>
              Fetching mapping data for <strong>{wbName}</strong>...
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: 4 }}>
              This may take a moment. Results will appear automatically.
            </span>
          </div>
        )
      }
      const wb = viewableWorkbooks.find(w => w?.id === selectedWorkbookId)
      return (
        <MappingTab
          workbookId={selectedWorkbookId}
          projectId={wb?.projectId || selectedProject || ""}
        />
      )
    }

    if (selectedTab === 'generation') {
      // ★ If generation data isn't ready yet, show a loading message
      if (!isGenerationDataReady) {
        const wbName = viewableWorkbooks.find(w => w?.id === selectedWorkbookId)?.name || selectedWorkbookId
        if (isRunStopped) {
          return renderStoppedMessage("Report Generation", wbName)
        }
        return (
          <div className={styles.centerLoading}>
            <Spinner size="extra-large" />
            <span style={{ fontWeight: 600, fontSize: "16px", color: "var(--text)", marginTop: 12 }}>
              Fetching report generation data for <strong>{wbName}</strong>...
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: 4 }}>
              This may take a moment. Results will appear automatically.
            </span>
          </div>
        )
      }
      return <ReportGenerationTab workbookId={selectedWorkbookId} workbookName={viewableWorkbooks.find(w => w?.id === selectedWorkbookId)?.name} />
    }

    if (selectedTab === 'validation') {
      return <ValidationTab 
        workbookId={selectedWorkbookId} 
        workbookName={viewableWorkbooks.find(w => w?.id === selectedWorkbookId)?.name} 
      />
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          {memoizedAssessmentTab}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Toaster />

      <div className="vl-header">
        <div className="vl-title">Processed Results</div>
      </div>

      <div className={styles.controlsRow}>
          {/* ── Project / Space selector / display ── */}
          <div className={styles.selector}>
            <span className={styles.label}>{isQlik ? "Space:" : "Project:"}</span>

            {hasMultipleProjects ? (
              <Select
                value={selectedProjectFilter}
                onValueChange={handleProjectChange}
                style={{ minWidth: 280, width: "auto" }}
              >
                {uniqueProjects.map(proj => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.name || (isQlik ? "Personal Space" : "Default Project")}
                  </SelectItem>
                ))}
              </Select>
            ) : (
              <span className={styles.projectValue}>
                {uniqueProjects[0]?.name || selectedProjectName || (isQlik ? "Personal Space" : "Default Project")}
              </span>
            )}
          </div>

          {/* ── Workbook / Application selector ── */}
          <div className={styles.selector}>
            <span className={styles.label}>{isQlik ? "Application:" : "Workbook:"}</span>

            {!hasAnyAssessment ? (
              <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
                Waiting for data...
              </span>
            ) : (
              <Select
                value={selectedWorkbookId}
                onValueChange={handleWorkbookChange}
                style={{ minWidth: 280, width: "100%" }}
              >
                {viewableWorkbooks.map((wb) => (
                  <SelectItem key={wb.id} value={wb.id}>
                    {wb.name || wb.id || (isQlik ? "Unnamed Application" : "Unnamed Workbook")}
                  </SelectItem>
                ))}
              </Select>
            )}
          </div>

          {globalValidationError && selectedTab === 'validation' && (
            <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
              <div style={{ 
                backgroundColor: "#fef2f2", 
                border: "1px solid #f87171", 
                borderRadius: "8px", 
                padding: "12px 16px", 
                maxWidth: "600px", 
                display: "flex", 
                alignItems: "flex-start", 
                gap: "12px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
              }}>
                <span style={{ fontSize: "20px", lineHeight: 1 }}>⚠️</span>
                <span style={{ fontSize: "13px", color: "#991b1b", lineHeight: "1.5" }}>
                  {globalValidationError}
                </span>
              </div>
            </div>
          )}
        </div>

      <div style={{ overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none", msOverflowStyle: "none", borderBottom: `1px solid var(--border)`, backgroundColor: "var(--background)" }}>
        <style>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>
        <Tabs value={selectedTab} onValueChange={handleTabSelect}>
          <TabsList className={cx(styles.tabList, "hide-scrollbar")} style={{ borderBottom: "none", marginTop: 0 }}>
            <TabsTrigger value="assessment" disabled={!hasAnyAssessment}>Assessment</TabsTrigger>
            {isAssessmentCompleteForSelected && (
              <TabsTrigger value="parsing" disabled={!hasAnyAssessment}>Parsing</TabsTrigger>
            )}
            {!isLiteMode() && !(mode === 'single' && !hasContinued) && isParsingDataReady && (
              <TabsTrigger value="mapping" disabled={!hasAnyAssessment}>Mapping</TabsTrigger>
            )}
            {!isLiteMode() && !(mode === 'single' && !hasContinued) && !shouldSkipDataLayer(selectedWorkbookId) && isMappingDataReady && (
              <TabsTrigger value="datalayer" disabled={!hasAnyAssessment}>Data Layer</TabsTrigger>
            )}
            {!isLiteMode() && !(mode === 'single' && !hasContinued) &&
              (shouldSkipDataLayer(selectedWorkbookId) ? isMappingDataReady : isDatalayerDataReady) && (
              <TabsTrigger value="generation" disabled={!hasAnyAssessment}>Report Generation</TabsTrigger>
            )}
            {!isLiteMode() && !(mode === 'single' && !hasContinued) && isGenerationDataReady && !hasGenerationFailed && (
              <TabsTrigger value="validation" disabled={!hasAnyAssessment}>Validation</TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      <div className={styles.tabContent}>
        {renderCurrentTab()}
      </div>
    </div>
  )
}
