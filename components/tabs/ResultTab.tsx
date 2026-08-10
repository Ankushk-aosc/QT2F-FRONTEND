"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Badge,
  Card,
  Tab,
  TabList,
  makeStyles,
  mergeClasses,
  tokens,
  Text,
  Dropdown,
  Option,
  Spinner,
  Button,
  shorthands,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  useToastController,
  Toaster,
  Toast,
  ToastTitle,
  ToastBody,
  ProgressBar,
} from "@fluentui/react-components"
import { 
  CheckmarkCircle24Filled, 
  DocumentDatabase24Regular, 
  DatabaseSearch24Regular, 
  Layer24Regular, 
  DataTrending24Regular, 
  Settings24Regular,
  ArrowRight24Regular,
  BrainCircuit24Regular,
  Pulse24Regular,
  Clock24Regular,
  Table24Regular,
  ArrowClockwise24Regular,
  Dismiss24Regular
} from "@fluentui/react-icons"
import { useAgentStore } from "@/stores/agent.store"

import { AssessmentTab } from "@/components/tabs/AssessmentTab"
import { ParsingTab } from "@/components/tabs/ParsingTab"
import MappingTab from "@/components/tabs/MappingTab"
import { DataLayerTab } from "@/components/tabs/DataLayerTab"
import { ValidationTab } from "@/components/tabs/ValidationTab"
import { ReportGenerationTab } from "@/components/tabs/ReportGenerationTab"


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

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "var(--background)",
  },
  header: {
    ...shorthands.padding("16px", "24px"),
    backgroundColor: "var(--background)",
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  title: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    "@media (max-width: 600px)": {
      fontSize: "24px",
    },
  },
  backgroundStatus: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    opacity: 0.7,
    color: tokens.colorNeutralForeground2,
  },
  controlsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "32px",
    rowGap: "16px",
  },
  projectDisplay: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: "200px",
  },
  selector: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: "300px",
    "@media (max-width: 768px)": {
      minWidth: "100%",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "8px",
    },
  },
  label: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    whiteSpace: "nowrap",
  },
  projectValue: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground1,
  },
  tabList: {
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    paddingLeft: "24px",
    marginTop: "16px",
    backgroundColor: "var(--background)",
  },
  tabContent: {
    flex: 1,
    overflow: "auto",
    backgroundColor: "var(--background)",
    position: "relative",
    minHeight: "500px", // Safely ensure content area has height for absolute spinners
  },
  centerLoading: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
    ...shorthands.padding("0", "20px"),
    textAlign: "center",
    wordBreak: "break-word",
  },
  // --- New Premium Hero Styles ---
  resultsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    padding: "32px",
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: "100%",
  },
  heroBanner: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: "16px",
    padding: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    position: "relative",
    marginBottom: "32px",
    overflow: "hidden",
    boxShadow: tokens.shadow4,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  statusBadge: {
    height: "10px",
    width: "10px",
    borderRadius: "50%",
    position: "relative",
    "&::after": {
      content: '""',
      position: "absolute",
      top: "-4px",
      left: "-4px",
      right: "-4px",
      bottom: "-4px",
      borderRadius: "50%",
      border: "1px solid currentColor",
      opacity: 0.4,
    }
  },
  roadmapContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
    padding: "0 20px",
  },
  intelligenceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
    width: "100%",
  },
  tileIcon: {
    fontSize: "24px",
    color: tokens.colorBrandForeground1,
  },
  sparkline: {
    height: "4px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: "2px",
    marginTop: "12px",
    overflow: "hidden",
  },
  sparklineBar: {
    height: "100%",
    backgroundColor: tokens.colorBrandBackground,
    borderRadius: "2px",
    transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  stepIndicator: {
    height: "24px",
    width: "24px",
    borderRadius: "50%",
    backgroundColor: tokens.colorNeutralStroke2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    transition: "all 0.3s ease",
    "&.active": {
      backgroundColor: tokens.colorBrandBackground,
      color: "#fff",
    },
    "&.done": {
      backgroundColor: tokens.colorPaletteGreenBackground3,
      color: "#fff",
    }
  },
  stepLine: {
    position: "absolute",
    top: "8px",
    left: "50%",
    width: "100%",
    height: "2px",
    backgroundColor: tokens.colorNeutralStroke2,
    zIndex: 2,
    "@media (max-width: 900px)": {
      display: "none",
    },
    "&.done": {
      backgroundColor: tokens.colorPaletteGreenBackground3,
    }
  },
  stepLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground3,
    transition: "all 0.3s ease",
    "&.active": {
      color: tokens.colorBrandForeground1,
    },
    "&.done": {
      color: tokens.colorNeutralForeground1,
    }
  },
  heroStatusLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "12px 32px",
    borderRadius: tokens.borderRadiusCircular,
    width: "fit-content",
    margin: "0 auto",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  heroTitleRow: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "24px",
  },
  heroSubtitle: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground3,
  },
  heroActionArea: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    marginBottom: "32px",
  },
  roadmapTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: tokens.colorNeutralForeground4,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    textAlign: "center",
  },
  roadmapStep: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    position: "relative",
    flex: 1,
  },
})

type TabValue = "assessment" | "parsing" | "datalayer" | "mapping" | "validation" | "generation"

export function ResultTab() {
  const styles = useStyles()
  const [selectedTab, setSelectedTab] = useState<TabValue>("assessment")

  const { selectedProject, selectedProjectName, applications } = useDashboardStore()
  const { user } = useAuthStore()
  const { mode, hasContinued, setHasContinued, dataLayerEnabled, selectedWorkbookId, setSelectedWorkbookId } = useUIStore()

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

  const toasterId = "result-tab-toaster"
  const { dispatchToast } = useToastController(toasterId)
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

  const handleTabSelect = (_: any, data: any) => {
    setSelectedTab(data.value as TabValue)
  }

  // ★ Clear global validation error when switching workbooks or projects
  useEffect(() => {
    if (globalValidationError) {
      setGlobalValidationError(null);
    }
  }, [selectedWorkbookId, selectedProjectFilter]);

  const handleProjectChange = (_: any, data: any) => {
    setSelectedProjectFilter(data.optionValue as string)
    setSelectedWorkbookId("")
  }

  const handleWorkbookChange = (_: any, data: any) => {
    setSelectedWorkbookId(data.optionValue as string)
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

      // Measures and Dimensions (Intelligent selection: use parsing if it's more comprehensive, fallback to assessment)
      const parsingMeasures = pData?.fields?.measures?.length || 0;
      const parsingDimensions = pData?.fields?.dimensions?.length || 0;
      
      if (parsingMeasures > 0 || parsingDimensions > 0) {
         metrics.measures += parsingMeasures;
         metrics.dimensions += parsingDimensions;
      } else if (payload.calculation_stats) {
         const stats = payload.calculation_stats;
         const total = stats.total_calculations || 0;
         const measures = stats.num_measures ?? Math.round((stats.pct_basic / 100) * total);
         const dimensions = stats.num_dimensions ?? (total - measures);
         
         metrics.measures += Math.max(0, measures);
         metrics.dimensions += Math.max(0, dimensions);
      }
    });

    return metrics;
  }, [currentWorkbookIds, assessmentData, parsingDataMap, currentRunId]);

  // ★ Check if parsing data is actually available for the selected workbook
  const isParsingDataReady = !!parsingDataMap[selectedWorkbookId]

  // --- INTERNAL INTELLIGENCE TILE COMPONENT ---
  const IntelligenceTile = ({ 
    label, 
    value, 
    icon, 
    percentage = 100, 
    color = tokens.colorBrandBackground 
  }: { 
    label: string; 
    value: string | number; 
    icon: React.ReactNode; 
    percentage?: number; 
    color?: string;
  }) => {
    return (
      <Card className="vl-metric-card" style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div className="vl-metric-label">{label}</div>
          <div className={styles.tileIcon}>{icon}</div>
        </div>
        
        <div className="vl-metric-value" style={{ marginBottom: "8px" }}>
          {value}
        </div>
  
        <div className={styles.sparkline}>
          <div 
            className={styles.sparklineBar} 
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
        
        <div style={{ marginTop: "4px", fontSize: "11px", color: tokens.colorNeutralForeground4, fontWeight: 600 }}>
          {percentage}% SYNCED
        </div>
      </Card>
    );
  };

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
       dispatchToast(
         <Toast>
           <ToastTitle>Success</ToastTitle>
           <ToastBody>Assessment completed for selected workbook</ToastBody>
         </Toast>,
         { intent: "success" }
       );
       toastShownRef.current = true;
    }
  }, [mode, hasContinued, hasAnyAssessment, dispatchToast]);

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
          <Dismiss24Regular style={{ fontSize: "48px", color: tokens.colorPaletteRedForeground1 }} />
          <Text weight="semibold" style={{ fontSize: "16px", color: tokens.colorNeutralForeground1, marginTop: 12 }}>
            Migration Stopped
          </Text>
          <Text style={{ color: tokens.colorNeutralForeground3, fontSize: "13px", marginTop: 4 }}>
            This migration run was terminated. {stageName} results for <strong>{wbName}</strong> are not available.
          </Text>
        </div>
      )
    }

    // ★ Show error if backend is down
    if (storeError && !hasAnyAssessment) {
      return (
        <div className={styles.centerLoading}>
          <MessageBar intent="warning" style={{ maxWidth: 500 }}>
            <MessageBarBody>
              <MessageBarTitle>Waiting for backend</MessageBarTitle>
              <Text>{storeError}</Text>
            </MessageBarBody>
          </MessageBar>
        </div>
      )
    }

    if (!hasAnyAssessment) {
      if (isRunStopped) {
        return (
          <div className={styles.centerLoading}>
            <Dismiss24Regular style={{ fontSize: "48px", color: tokens.colorPaletteRedForeground1 }} />
            <Text weight="semibold" style={{ fontSize: "16px", color: tokens.colorNeutralForeground1, marginTop: 12 }}>
              Migration Stopped
            </Text>
            <Text style={{ color: tokens.colorNeutralForeground3, fontSize: "13px", marginTop: 4 }}>
              This migration run was terminated.
            </Text>
          </div>
        )
      }

      return (
        <div className={styles.centerLoading}>
          <Spinner size="huge" label="Waiting for results..." />
          {hasAnyWorkbooks && (
            <Text style={{ color: tokens.colorNeutralForeground3, fontSize: "13px", marginTop: 8 }}>
              {completedWorkbooks.length} workbook(s) processing...
            </Text>
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
            <Spinner size="huge" />
            <Text weight="semibold" style={{ fontSize: "16px", color: tokens.colorNeutralForeground1, marginTop: 12 }}>
              Fetching parsing data for <strong>{wbName}</strong>...
            </Text>
            <Text style={{ color: tokens.colorNeutralForeground3, fontSize: "13px", marginTop: 4 }}>
              This may take a moment. Results will appear automatically.
            </Text>
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
            <Spinner size="huge" />
            <Text weight="semibold" style={{ fontSize: "16px", color: tokens.colorNeutralForeground1, marginTop: 12 }}>
              Fetching data layer results for <strong>{wbName}</strong>...
            </Text>
            <Text style={{ color: tokens.colorNeutralForeground3, fontSize: "13px", marginTop: 4 }}>
              This may take a moment. Results will appear automatically.
            </Text>
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
            <Spinner size="huge" />
            <Text weight="semibold" style={{ fontSize: "16px", color: tokens.colorNeutralForeground1, marginTop: 12 }}>
              Fetching mapping data for <strong>{wbName}</strong>...
            </Text>
            <Text style={{ color: tokens.colorNeutralForeground3, fontSize: "13px", marginTop: 4 }}>
              This may take a moment. Results will appear automatically.
            </Text>
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
            <Spinner size="huge" />
            <Text weight="semibold" style={{ fontSize: "16px", color: tokens.colorNeutralForeground1, marginTop: 12 }}>
              Fetching report generation data for <strong>{wbName}</strong>...
            </Text>
            <Text style={{ color: tokens.colorNeutralForeground3, fontSize: "13px", marginTop: 4 }}>
              This may take a moment. Results will appear automatically.
            </Text>
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
      <Toaster toasterId={toasterId} />

      <div className="vl-header">
        <div className="vl-title">Processed Results</div>
      </div>

      <div className={styles.controlsRow}>
          {/* ── Project selector / display ── */}
          <div className={styles.selector}>
            <Text className={styles.label}>Project:</Text>

            {hasMultipleProjects ? (
              <Dropdown
                placeholder="Select project"
                value={
                  uniqueProjects.find(p => p.id === selectedProjectFilter)?.name ?? ""
                }
                selectedOptions={selectedProjectFilter ? [selectedProjectFilter] : []}
                onOptionSelect={handleProjectChange}
                style={{ minWidth: 280 }}
              >
                {uniqueProjects.map(proj => (
                  <Option key={proj.id} value={proj.id} text={proj.name}>
                    {proj.name}
                  </Option>
                ))}
              </Dropdown>
            ) : (
              <Text className={styles.projectValue}>
                {uniqueProjects[0]?.name || selectedProjectName || "Processing..."}
              </Text>
            )}
          </div>

          {/* ── Workbook selector ── */}
          <div className={styles.selector}>
            <Text className={styles.label}>Workbook:</Text>

            {!hasAnyAssessment ? (
              <Text style={{ color: tokens.colorNeutralForeground3, fontStyle: "italic" }}>
                Waiting for data...
              </Text>
            ) : (
              <Dropdown
                placeholder="Select workbook"
                value={
                  viewableWorkbooks.find((w) => w.id === selectedWorkbookId)?.name ?? ""
                }
                selectedOptions={selectedWorkbookId ? [selectedWorkbookId] : []}
                onOptionSelect={handleWorkbookChange}
                style={{ minWidth: 280, width: "100%" }}
              >
                {viewableWorkbooks.map((wb) => (
                  <Option key={wb.id} value={wb.id} text={wb.name}>
                    {wb.name}
                  </Option>
                ))}
              </Dropdown>
            )}
          </div>

          {/* ── Run Validation / Re-run Validation for All (Disabled per client requirements) ── */}
          {false && isAllGenerationDone && !hasAnyGenerationFailure && currentWorkbookIds.length > 1 && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
              {showSyncWarningAll && (
                <div style={{
                  position: "fixed", inset: 0, zIndex: 1000,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <div style={{
                    background: "#fff", borderRadius: "14px", padding: "40px 48px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.18)", maxWidth: "560px", width: "90%",
                    display: "flex", flexDirection: "column", gap: "20px", alignItems: "center", textAlign: "center"
                  }}>
                    <div style={{ fontSize: "48px", lineHeight: 1 }}>⚠️</div>
                    <Text weight="bold" size={500} style={{ color: "#92400e" }}>Workbooks Not Synced in Fabric</Text>

                    {syncModalErrors.length === 0 ? (
                      <Text size={300} style={{ color: "#64748b", lineHeight: "1.7" }}>
                        Before running validation, please go to <strong>Microsoft Fabric</strong> and sync all your workbooks.
                        Once the sync is complete, click <strong>&quot;I&apos;ve Synced All — Run Validation&quot;</strong> to proceed.
                      </Text>
                    ) : (
                      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px", textAlign: "left" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                          {syncModalErrors.map((msg, i) => (
                            <div key={i} style={{
                              backgroundColor: "#fef2f2",
                              border: "1px solid #fca5a5",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px"
                            }}>
                              <span style={{ color: "#dc2626", fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>✗</span>
                              <Text size={200} style={{ color: "#991b1b", lineHeight: "1.5" }}>{msg}</Text>
                            </div>
                          ))}
                        </div>
                        <Text size={200} style={{ color: "#64748b", textAlign: "center", marginTop: "4px" }}>
                          Please refresh those workbooks in Microsoft Fabric and click the button below to retry.
                        </Text>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "12px", marginTop: "8px", width: "100%", justifyContent: "center" }}>
                      <Button appearance="secondary" onClick={() => { setShowSyncWarningAll(false); setSyncModalErrors([]); }}>Cancel</Button>
                      <Button
                        appearance="primary"
                        size="large"
                        disabled={isSyncModalLoading}
                        onClick={async () => {
                          setSyncModalErrors([]);
                          setGlobalValidationError(null);
                          setIsSyncModalLoading(true);
                          const idsToStart = currentWorkbookIds.filter(id => !(manualValidationStarted?.[id] || validationActivitiesDone[id]));
                          if (idsToStart.length > 0) {
                            try {
                              await startValidationForWorkbooks(idsToStart);
                              // Success — all workbooks passed
                              currentWorkbookIds.forEach(id => {
                                try { localStorage.setItem(`fabric_synced_${currentRunId}_${id}`, "true"); } catch(e){}
                              });
                              setShowSyncWarningAll(false);
                              setSyncModalErrors([]);
                              setSelectedTab("validation");
                            } catch (e: any) {
                              const errorMsg = e.message || String(e);
                              const cleanMsg = errorMsg.startsWith("SYNC_REQUIRED:") ? errorMsg.replace("SYNC_REQUIRED:", "") : errorMsg;
                              // Collect per-workbook errors from the store error map
                              const { useValidationStore } = await import("@/stores/validation.store");
                              const errMap = useValidationStore.getState().error;
                              const perWorkbookErrors = currentWorkbookIds
                                .map(id => errMap[id])
                                .filter((msg): msg is string => !!msg);
                              setSyncModalErrors(perWorkbookErrors.length > 0 ? [...new Set(perWorkbookErrors)] : [cleanMsg]);
                            } finally {
                              setIsSyncModalLoading(false);
                            }
                          } else {
                            setIsSyncModalLoading(false);
                            setShowSyncWarningAll(false);
                            setSyncModalErrors([]);
                            setSelectedTab("validation");
                          }
                        }}
                      >
                        {isSyncModalLoading ? (
                          <><Spinner size="tiny" style={{ marginRight: "8px" }} />Validating...</>
                        ) : (
                          syncModalErrors.length > 0 ? "I\u2019ve Synced \u2014 Retry Validation" : "I\u2019ve Synced All \u2014 Run Validation"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isAllValidationDone ? (
                <Button
                  appearance="primary"
                  size="large"
                  icon={<ArrowClockwise24Regular />}
                  disabled={isBulkValidationLoading || isSyncModalLoading}
                  onClick={async () => {
                    const confirmed = window.confirm("This will trigger a fresh validation run for ALL workbooks in this batch. This might take several minutes. Proceed?")
                    if (!confirmed) return
                    
                    setGlobalValidationError(null);
                    try {
                      useAgentStore.getState().resetValidationForWorkbooks(currentWorkbookIds);
                      await useAgentStore.getState().startRevalidationForWorkbooks(currentWorkbookIds);
                      setSelectedTab("validation");
                    } catch (e: any) {
                      const errorMsg = e.message || String(e);
                      if (errorMsg.startsWith("SYNC_REQUIRED:")) {
                          setGlobalValidationError(errorMsg.replace("SYNC_REQUIRED:", ""));
                      } else {
                          setGlobalValidationError("Failed to re-run validation: " + errorMsg);
                      }
                      console.error(e);
                    }
                  }}
                >
                  {isBulkValidationLoading ? (
                    <>
                      <Spinner size="tiny" style={{ marginRight: "8px" }} />
                      Processing...
                    </>
                  ) : (
                    "Re-run Validation for All"
                  )}
                </Button>
              ) : (
                isBulkValidationLoading ? (
                  <Button appearance="primary" size="large" disabled>
                    <Spinner size="tiny" style={{ marginRight: "8px" }} />
                    Processing...
                  </Button>
                ) : (
                  <Button
                    appearance="primary"
                    size="large"
                    onClick={async () => {
                      setGlobalValidationError(null);
                      // Check if all workbooks are synced
                      const unsynced = currentWorkbookIds.filter(id => {
                        try { return localStorage.getItem(`fabric_synced_${currentRunId}_${id}`) !== "true"; } catch(e){ return true; }
                      });
                      if (unsynced.length > 0) {
                        setShowSyncWarningAll(true);
                        return;
                      }
                      const idsToStart = currentWorkbookIds.filter(id => !(manualValidationStarted?.[id] || validationActivitiesDone[id]));
                      if (idsToStart.length > 0) {
                        try {
                          await startValidationForWorkbooks(idsToStart);
                          setSelectedTab("validation");
                        } catch (e: any) {
                          const errorMsg = e.message || String(e);
                          if (errorMsg.startsWith("SYNC_REQUIRED:")) {
                            setGlobalValidationError(errorMsg.replace("SYNC_REQUIRED:", ""));
                          } else {
                            setGlobalValidationError("Failed to start validation: " + errorMsg);
                          }
                        }
                      } else {
                        setSelectedTab("validation");
                      }
                    }}
                  >
                    Run Validation for All
                  </Button>
                )
              )}
            </div>
          )}
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
                <Text size={300} style={{ color: "#991b1b", lineHeight: "1.5" }}>
                  {globalValidationError}
                </Text>
              </div>
            </div>
          )}
        </div>

      <div style={{ overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none", msOverflowStyle: "none", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, backgroundColor: "var(--background)" }}>
        <style>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>
        <TabList
          className={mergeClasses(styles.tabList, "hide-scrollbar")}
          style={{ borderBottom: "none", marginTop: 0 }}
          selectedValue={selectedTab}
          onTabSelect={handleTabSelect}
          disabled={!hasAnyAssessment}
        >
          <Tab value="assessment">Assessment</Tab>
          {isAssessmentCompleteForSelected && (
            <Tab value="parsing">Parsing</Tab>
          )}
          {!isLiteMode() && !(mode === 'single' && !hasContinued) && isParsingDataReady && (
            <Tab value="mapping">Mapping</Tab>
          )}
          {!isLiteMode() && !(mode === 'single' && !hasContinued) && !shouldSkipDataLayer(selectedWorkbookId) && isMappingDataReady && (
            <Tab value="datalayer">Data Layer</Tab>
          )}
          {!isLiteMode() && !(mode === 'single' && !hasContinued) && 
            (shouldSkipDataLayer(selectedWorkbookId) ? isMappingDataReady : isDatalayerDataReady) && (
            <Tab value="generation">Report Generation</Tab>
          )}
          {!isLiteMode() && !(mode === 'single' && !hasContinued) && isGenerationDataReady && !hasGenerationFailed && (
            <Tab value="validation">Validation</Tab>
          )}
        </TabList>
      </div>

      <div className={styles.tabContent}>
        {renderCurrentTab()}
      </div>
    </div>
  )
}