"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import {
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
  Button,
  Card,
  Spinner,
  Input,
  Label,
  Text,
  Dropdown,
  Combobox,
  Option,
  Radio,
  RadioGroup,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  TabList,
  Tab,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Tooltip,
  Checkbox,
} from "@fluentui/react-components"
import {
  Play24Regular,
  Database24Regular,
  Cloud24Regular,
  ArrowRight24Regular,
  ArrowClockwise24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  Add24Regular,
  Delete24Regular,
  Info16Regular,
  Edit20Regular,
  Dismiss20Regular,
} from "@fluentui/react-icons"
import { debounce } from "lodash"
import { useMsal } from "@azure/msal-react"
import Image from "next/image"

import { useDashboardStore } from "@/stores/dashboard.store"
import { useAgentStore } from "@/stores/agent.store"
import { useAuthStore } from "@/stores/auth.store"
import { useParsingStore } from "@/stores/parsing.store"
import { useMappingStore } from "@/stores/mapping.store"
import { useValidationStore } from "@/stores/validation.store"
import { useGenerationStore } from "@/stores/generation.store"
import { useUIStore } from "@/stores/ui.store"

import { tableauService, type TableauCredentials, type Project, type Workbook, type Site } from "@/services/tableau.service"
import { fabricService, type FabricCredentials, type FabricWorkspace, type FabricLakehouse } from "@/services/fabric.service"

import { getErrorMessage } from "@/lib/error-handler"
import { batchService } from "@/services/batch.service"
import { recordsService } from "@/services/records.service"

import { ResultTab } from "@/components/tabs/ResultTab"
import { MigrationOverview } from "./MigrationOverview"
import ConfigurationsContent from "./ConfigurationsContent"
import { isLiteMode } from "@/lib/config"
import dynamic from "next/dynamic"

// PdfReportRenderer is loaded at MigrationTab level (not MigrationOverview)
// so the minimized widget persists when the user switches sub-tabs.
const PdfReportRenderer = dynamic(
  () => import("@/components/PdfReportRenderer").then(mod => mod.PdfReportRenderer),
  { ssr: false }
)

// const useStyles = makeStyles({
//   root: { ...shorthands.padding("24px", "16px") },
//   errorAlert: { marginBottom: "24px" },
//   successAlert: { marginBottom: "24px", backgroundColor: "#f0fdf4", ...shorthands.border("1px", "solid", "#bbf7d0") },
//   mainGrid: { display: "flex", gap: "32px", alignItems: "stretch", "@media (max-width: 1024px)": { flexDirection: "column", gap: "24px" } },
//   card: { flex: 1, ...shorthands.borderRadius(tokens.borderRadiusMedium), boxShadow: tokens.shadow4, minHeight: "520px", overflow: "hidden" },
//   sourceCard: { backgroundColor: "#eff6ff", ...shorthands.border("1px", "solid", "#bfdbfe") },
//   targetCard: { backgroundColor: "#f0fdf4", ...shorthands.border("1px", "solid", "#bbf7d0") },
//   cardHeader: { ...shorthands.padding("16px", "20px"), ...shorthands.borderBottom("1px", "solid", "#bfdbfe") },
//   sourceHeader: { backgroundColor: "#dbeafe", ...shorthands.borderBottom("1px", "solid", "#bfdbfe") },
//   targetHeader: { backgroundColor: "#dcfce7", ...shorthands.borderBottom("1px", "solid", "#bbf7d0") },
//   header: { marginBottom: "10px", textAlign: "left" },
//   title: { fontSize: tokens.fontSizeHero800, fontWeight: tokens.fontWeightBold, color: tokens.colorNeutralForeground1, marginBottom: "8px" },
//   headerContent: { display: "flex", alignItems: "center", gap: "12px" },
//   icon: { fontSize: "28px" },
//   arrowContainer: { display: "flex", alignItems: "center", justifyContent: "center", fontSize: "56px", color: tokens.colorNeutralStroke2, minWidth: "20px", ...shorthands.padding("0", "8px"), "@media (max-width: 1024px)": { minWidth: "auto", transform: "rotate(90deg)", ...shorthands.padding("16px", "0"), fontSize: "48px" } },
//   configCard: { backgroundColor: "#f8fafc", ...shorthands.border("1px", "solid", "#e2e8f0"), marginTop: "24px", ...shorthands.borderRadius(tokens.borderRadiusMedium) },
//   configHeader: { ...shorthands.padding("12px", "16px"), ...shorthands.borderBottom("1px", "solid", "#e2e8f0"), backgroundColor: "#f1f5f9" },
//   configRow: { display: "flex", justifyContent: "space-between", alignItems: "center", ...shorthands.padding("12px", "16px"), ...shorthands.borderBottom("1px", "solid", "#e2e8f0"), ":last-child": { ...shorthands.borderBottom("none") } },
//   labelText: { color: "#475569", fontSize: tokens.fontSizeBase200 },
//   statusGreen: { color: "#15803d", fontWeight: tokens.fontWeightSemibold },
//   statusYellow: { color: "#a16207", fontWeight: tokens.fontWeightSemibold },
//   statusIndigo: { color: "#4f46e5", fontWeight: tokens.fontWeightSemibold },
//   buttonContainer: { display: "flex", justifyContent: "center", marginTop: "40px", gap: "24px", flexWrap: "wrap", minHeight: "48px" },
//   largeButton: { minWidth: "220px", fontSize: tokens.fontSizeBase400, ...shorthands.padding("12px", "32px") },
//   sectionTitle: { fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold, marginBottom: "8px", display: "block" },
//   cardInnerPadding: { ...shorthands.padding("24px") },
//   subTabsWrapper: { backgroundColor: "#eaf4ff", ...shorthands.borderRadius(tokens.borderRadiusMedium), ...shorthands.margin("32px", "0", "20px", "0"), ...shorthands.padding("6px", "12px"), display: "flex", justifyContent: "center", alignItems: "center", boxShadow: tokens.shadow2, ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2) },
//   subTabList: { display: "grid !important" as any, gridTemplateColumns: "1fr 1fr", columnGap: "24px", alignItems: "center", width: "100%", maxWidth: "400px", "::after": { display: "none !important" }, "::before": { display: "none !important" }, "> div:not([role])": { display: "none !important" } },
//   subTabBase: { width: "100%", boxSizing: "border-box", whiteSpace: "nowrap", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", ...shorthands.padding("0", "12px"), ...shorthands.margin("0"), fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightRegular, color: tokens.colorNeutralForeground1, backgroundColor: "transparent", ...shorthands.borderRadius("8px"), ...shorthands.border("1px", "solid", "transparent"), cursor: "pointer", transitionProperty: "background-color, box-shadow, border-color", transitionDuration: tokens.durationNormal, ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover, boxShadow: tokens.shadow2 }, ":focus": { outlineStyle: "none" }, "& .fui-Tab__content": { overflow: "visible !important" }, "& .fui-Tab__indicator": { display: "none !important" }, "::after": { display: "none !important" } },
//   subTabSelected: { fontWeight: tokens.fontWeightSemibold, boxShadow: tokens.shadow4, ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1), backgroundColor: tokens.colorNeutralBackground1 },
//   subTabDisabled: { color: tokens.colorNeutralForeground3, cursor: "not-allowed", opacity: 0.65, ":hover": { backgroundColor: "transparent", boxShadow: "none" } },
//   inputGroup: { display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" },
//   inputField: { flexGrow: 1 },
//   marginTopSpacing: { marginTop: "24px" },
// })

const useStyles = makeStyles({
  root: { ...shorthands.padding("24px", "16px") },
  errorAlert: { marginBottom: "24px" },
  successAlert: { marginBottom: "24px", backgroundColor: "#f0fdf4", ...shorthands.border("1px", "solid", "#bbf7d0") },
  mainGrid: { display: "flex", gap: "32px", alignItems: "stretch", "@media (max-width: 1200px)": { flexDirection: "column", gap: "24px" } },
  card: { flex: 1, ...shorthands.borderRadius(tokens.borderRadiusMedium), boxShadow: tokens.shadow4, minHeight: "520px", overflow: "hidden" },
  sourceCard: { backgroundColor: "#eff6ff", ...shorthands.border("1px", "solid", "#bfdbfe") },
  targetCard: { backgroundColor: "#f0fdf4", ...shorthands.border("1px", "solid", "#bbf7d0") },
  cardHeader: { ...shorthands.padding("16px", "20px"), ...shorthands.borderBottom("1px", "solid", "#bfdbfe") },
  sourceHeader: { backgroundColor: "#dbeafe", ...shorthands.borderBottom("1px", "solid", "#bfdbfe") },
  targetHeader: { backgroundColor: "#dcfce7", ...shorthands.borderBottom("1px", "solid", "#bbf7d0") },
  header: { marginBottom: "10px", textAlign: "left" },
  title: { fontSize: tokens.fontSizeHero800, fontWeight: tokens.fontWeightBold, color: tokens.colorNeutralForeground1, marginBottom: "8px" },
  headerContent: { display: "flex", alignItems: "center", gap: "12px" },
  icon: { fontSize: "28px" },
  arrowContainer: { display: "flex", alignItems: "center", justifyContent: "center", fontSize: "56px", color: "#64748b", minWidth: "20px", ...shorthands.padding("0", "8px"), "@media (max-width: 1200px)": { minWidth: "auto", transform: "rotate(90deg)", ...shorthands.padding("16px", "0"), fontSize: "48px" } },
  configCard: { backgroundColor: "#f8fafc", ...shorthands.border("1px", "solid", "#e2e8f0"), marginTop: "24px", ...shorthands.borderRadius(tokens.borderRadiusMedium) },
  configHeader: { ...shorthands.padding("12px", "16px"), ...shorthands.borderBottom("1px", "solid", "#e2e8f0"), backgroundColor: "#f1f5f9" },
  configRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderBottom("1px", "solid", "#e2e8f0"),
    ":last-child": { ...shorthands.borderBottom("none") }
  },
  labelText: { color: "#475569", fontSize: tokens.fontSizeBase200 },
  statusGreen: { color: "#15803d", fontWeight: tokens.fontWeightSemibold },
  statusYellow: { color: "#a16207", fontWeight: tokens.fontWeightSemibold },
  statusIndigo: { color: "#4f46e5", fontWeight: tokens.fontWeightSemibold },
  buttonContainer: { display: "flex", justifyContent: "center", marginTop: "40px", gap: "24px", flexWrap: "wrap", minHeight: "48px" },
  largeButton: { minWidth: "220px", fontSize: tokens.fontSizeBase400, ...shorthands.padding("12px", "32px") },
  sectionTitle: { fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold, marginBottom: "8px", display: "block" },
  cardInnerPadding: { ...shorthands.padding("24px") },

  // --- FIXED TAB STYLES START HERE ---
  subTabsWrapper: {
    backgroundColor: "#eaf4ff",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),

    // Restored standard margins so it stretches full width
    marginTop: "32px",
    marginBottom: "20px",
    marginLeft: "0",
    marginRight: "0",
    width: "100%", // Forces the blue background to stretch
    boxSizing: "border-box", // Prevents it from spilling past the page edges

    ...shorthands.padding("6px", "12px"),
    display: "flex",
    justifyContent: "center", // Keeps the buttons grouped in the dead center
    alignItems: "center",
    boxShadow: tokens.shadow2,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    overflowX: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    WebkitOverflowScrolling: "touch",
  },

  subTabList: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px", // Updated to 12px to perfectly match the main navigation gap
    minWidth: "max-content",
  },

  subTabBase: {
    // Copied exactly from page.tsx (tabBase) for identical behavior
    boxSizing: "border-box",
    height: "32px",
    minWidth: "fit-content",
    flex: 1, // Equally balance the tabs
    maxWidth: "200px", // Prevent them from becoming overly wide on huge screens

    paddingTop: "0",
    paddingBottom: "0",
    paddingLeft: "16px",
    paddingRight: "16px",

    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground1,
    backgroundColor: "transparent",

    ...shorthands.borderRadius("8px"),
    ...shorthands.border("1px", "solid", "transparent"),

    cursor: "pointer",
    transition: `background-color ${tokens.durationNormal}, box-shadow ${tokens.durationNormal}, border-color ${tokens.durationNormal}`,

    // Completely hide the blue line
    "& .fui-Tab__indicator": {
      display: "none",
    },

    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      boxShadow: tokens.shadow2, // Added the subtle shadow from page.tsx
    },

    ":focus": {
      outlineStyle: "none"
    }
  },

  subTabSelected: {
    // Copied exactly from page.tsx (selectedTab)
    fontWeight: tokens.fontWeightSemibold,
    boxShadow: tokens.shadow4,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),

    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1,
    }
  },

  subTabDisabled: {
    color: tokens.colorNeutralForeground3,
    cursor: "not-allowed",
    opacity: 0.65,
    ":hover": {
      backgroundColor: "transparent",
      boxShadow: "none"
    }
  },
  // --- FIXED TAB STYLES END HERE ---

  truncateDropdown: {
    "& button": {
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      "& span": {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }
    }
  },

  inputGroup: { display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" },
  inputField: { flexGrow: 1 },
  marginTopSpacing: { marginTop: "24px" },
  pulseButton: {
    boxShadow: `0 0 0 0 ${tokens.colorBrandBackground2}`,
    animationName: {
      from: { boxShadow: `0 0 0 0 ${tokens.colorBrandBackground2}` },
      to: { boxShadow: `0 0 0 10px rgba(0, 120, 212, 0)` },
    },
    animationDuration: "2s",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-out",
  },
})

import { getStorageToken, getFabricToken } from "@/components/providers/MsalProviderWrapper"

type MigrationScope = "selected" | "project" | "site" | "entire"
type SubTab = "configurations" | "overview" | "results"

export function MigrationTab() {
  const styles = useStyles()
  const { instance, accounts } = useMsal()
  const account = accounts[0]
  const { user, isAuthenticated } = useAuthStore()

  const {
    selectedProject, selectedProjectName, selectedWorkbooks, migrationPhase,
    setMigrationPhase, setSelectedProject, setSelectedWorkbooks,
    selectedProjects, setSelectedProjects,
    startProcessing, stopProcessing, isProcessing, hasShownResultSection,
    setTableauSiteName: setStoreTableauSiteName, setSelectedWorkspace: setStoreSelectedWorkspace,
  } = useDashboardStore()

  const locGenerationData = useGenerationStore((s: any) => s.generationData)
  const manualValidationStartedFlag = useAgentStore((s: any) => s.manualValidationStarted)
  const dashboardRunId = useDashboardStore((s: any) => s.runId)
  const isValidationPaused = !!dashboardRunId && (selectedWorkbooks?.length || 0) > 0 &&
    selectedWorkbooks.every(wb => !!locGenerationData[wb]) &&
    !selectedWorkbooks.some(wb => manualValidationStartedFlag[wb]);

  // ★ Detect if ANY workbook's generation has failed — drives the failure UI across the whole tab
  const hasAnyGenerationFailure = (selectedWorkbooks?.length || 0) > 0 &&
    selectedWorkbooks.some(wb => {
      const s = (locGenerationData[wb]?.status || "").toLowerCase()
      return s === 'failed' || s === 'error'
    })

  const { mode, hasContinued, setHasContinued, dataLayerEnabled } = useUIStore()

  const { currentRunId: agentRunId, setCurrentRunInfo, assessmentData, setMigrationStarted, activities, currentWorkbookIds = [], startPolling } = useAgentStore()

  // Hoist store hooks to avoid initialization errors in memos
  const parsingData = useParsingStore(state => state.parsingData)
  const mappingData = useMappingStore(state => state.mappingData)
  const generationData = useGenerationStore(state => state.generationData)
  const validationData = useValidationStore(state => state.validationData)

  const isAllParsingDone = useMemo(() => {
    if (!agentRunId || (currentWorkbookIds?.length || 0) === 0) return false;
    return currentWorkbookIds.every(id => !!parsingData[id]);
  }, [currentWorkbookIds, parsingData, agentRunId]);

  const [isResuming, setIsResuming] = useState(false)

  const handleResumeClick = async () => {
    if (!agentRunId) return
    setIsResuming(true)
    try {
      const runIdsToResume = new Set<string>();
      runIdsToResume.add(agentRunId);

      currentWorkbookIds.forEach(wbId => {
        const payload = assessmentData[agentRunId]?.[wbId]?.payload;
        if (payload?.run_id) runIdsToResume.add(payload.run_id);
        if (payload?.runId) runIdsToResume.add(payload.runId);

        const raw = assessmentData[agentRunId]?.[wbId];
        if (raw?.run_id) runIdsToResume.add(raw.run_id);
        if (raw?.runId) runIdsToResume.add(raw.runId);
      });

      const finalRunIds = Array.from(runIdsToResume);
      console.log(`[MigrationTab] Resuming runs:`, finalRunIds)
      await recordsService.resumeMigration(finalRunIds as any)
      setHasContinued(true)
      startPolling()
    } catch (err) {
      console.error("[MigrationTab] Error resuming migration:", err)
      setError("Failed to continue migration pipeline")
    } finally {
      setIsResuming(false)
    }
  }

  const [scope, setScope] = useState<MigrationScope>("selected")
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("configurations")
  // isGeneratingPdf lives here (not in MigrationOverview) so the floating
  // minimized widget is NOT destroyed when the user switches sub-tabs.
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [tableauCredentials, setTableauCredentials] = useState<TableauCredentials | null>(null)
  const [currentConnectionName, setCurrentConnectionName] = useState("")
  const [projects, setProjects] = useState<Project[]>([])
  const [workbooks, setWorkbooks] = useState<Workbook[]>([])
  const [workbookSearchQuery, setWorkbookSearchQuery] = useState("")

  const filteredWorkbooks = useMemo(() => {
    if (!workbookSearchQuery.trim()) return workbooks
    const query = workbookSearchQuery.toLowerCase()
    return workbooks.filter(w => (w.name || "").toLowerCase().includes(query))
  }, [workbooks, workbookSearchQuery])

  // --- Dialog Workbook Selector State ---
  const [isWorkbookDialogOpen, setIsWorkbookDialogOpen] = useState(false)
  const [dialogSearchQuery, setDialogSearchQuery] = useState("")
  const [draftSelectedWorkbooks, setDraftSelectedWorkbooks] = useState<string[]>([])
  const [workbookCurrentPage, setWorkbookCurrentPage] = useState(1)
  const WORKBOOKS_PER_PAGE = 50

  const dialogFilteredWorkbooks = useMemo(() => {
    if (!dialogSearchQuery.trim()) return workbooks
    const q = dialogSearchQuery.toLowerCase()
    return workbooks.filter(w => (w.name || "").toLowerCase().includes(q))
  }, [workbooks, dialogSearchQuery])

  const paginatedWorkbooks = useMemo(() => {
    const startIndex = (workbookCurrentPage - 1) * WORKBOOKS_PER_PAGE
    return dialogFilteredWorkbooks.slice(startIndex, startIndex + WORKBOOKS_PER_PAGE)
  }, [dialogFilteredWorkbooks, workbookCurrentPage])
  
  const workbookTotalPages = Math.ceil(dialogFilteredWorkbooks.length / WORKBOOKS_PER_PAGE)
  // ---------------------------------------
  const [fabricCredentials, setFabricCredentials] = useState<FabricCredentials | null>(null)
  const [fabricReady, setFabricReady] = useState(false)
  const [fabricWorkspaces, setFabricWorkspaces] = useState<FabricWorkspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("")
  const [loadingTableau, setLoadingTableau] = useState(true)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingWorkbooks, setLoadingWorkbooks] = useState(false)
  const [loadingFabric, setLoadingFabric] = useState(true)
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false)
  const [lakehouses, setLakehouses] = useState<FabricLakehouse[]>([])
  const [selectedLakehouse, setSelectedLakehouse] = useState<string>("")
  const [loadingLakehouses, setLoadingLakehouses] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [migrationStartedLocal, setMigrationStartedLocal] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [tableauEnv, setTableauEnv] = useState<"cloud" | "server" | "cloud_trial">("cloud")
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)

  // Configuration fields for the dialog
  const [selectedConnectionId, setSelectedConnectionId] = useState("")
  const [isConnectionNameEditable, setIsConnectionNameEditable] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error", text: string } | null>(null)
  const [configConnectionName, setConfigConnectionName] = useState("")
  const [configTableauUrl, setConfigTableauUrl] = useState("")
  const [configTcmBaseUrl, setConfigTcmBaseUrl] = useState("")
  const [configTcmTokenSecret, setConfigTcmTokenSecret] = useState("")
  const [configTableauTokenName, setConfigTableauTokenName] = useState("TableauToken")
  const [configTableauTokenValue, setConfigTableauTokenValue] = useState("")

  // Fields for the main page
  const [tableauSiteName, setTableauSiteName] = useState("")
  const [tableauSiteId, setTableauSiteId] = useState("")
  const [configStatus, setConfigStatus] = useState<"idle" | "success" | "error">("idle")

  const [savedCredentials, setSavedCredentials] = useState<TableauCredentials[]>([])
  const hasStartedRef = useRef(false)
  const assessmentTriggeredRef = useRef(false)

  useEffect(() => {
    assessmentTriggeredRef.current = false;
  }, [currentRunId])

  const fetchConfig = async () => {
    setLoadingTableau(true)
    setError(null)
    setConfigStatus("idle")
    try {
      const creds = await tableauService.initializeConnection(tableauEnv)
      const credsArray = Array.isArray(creds) ? creds : (creds ? [creds] : [])
      setSavedCredentials(credsArray)

      // Preserve currently selected connection if it still exists in the fetched list
      let singleCred = null;
      if (selectedConnectionId) {
        singleCred = credsArray.find(c => c.connection_id === selectedConnectionId) || credsArray[0] || null;
      } else {
        singleCred = credsArray[0] ?? null;
      }

      setTableauCredentials(singleCred)
      if (singleCred) {
        if (singleCred.connection_id) {
          setSelectedConnectionId(singleCred.connection_id);
        }
        if (tableauEnv === "server") {
          const isCloudURL = singleCred.TABLEAU_SERVER_URL?.includes("online.tableau.com") || singleCred.TABLEAU_SERVER_URL?.includes("tableau.com");
          const url = (!isCloudURL && singleCred.TABLEAU_SERVER_URL) ? singleCred.TABLEAU_SERVER_URL : "";
          setCurrentConnectionName(singleCred.CONNECTION_NAME || url);
          setConfigConnectionName(singleCred.CONNECTION_NAME || "");
          setConfigTableauUrl(url);
          setConfigTableauTokenName(singleCred.TABLEAU_TOKEN_NAME || "TableauToken");
        } else {
          if (singleCred.TABLEAU_SERVER_URL) {
            setCurrentConnectionName(singleCred.CONNECTION_NAME || singleCred.TABLEAU_SERVER_URL);
            setConfigTableauUrl(singleCred.TABLEAU_SERVER_URL);
          }
          if (singleCred.CONNECTION_NAME) setConfigConnectionName(singleCred.CONNECTION_NAME);
          if (singleCred.TABLEAU_TOKEN_NAME) setConfigTableauTokenName(singleCred.TABLEAU_TOKEN_NAME)
        }
        // Do NOT restore TABLEAU_SITE_NAME from the saved credential.
        // The saved value may be stale (e.g. "vectorlab") and would cause 401 errors.
        // Leave empty so user picks from the freshly fetched sites dropdown.
        if (singleCred.TABLEAU_TOKEN_VALUE) setConfigTableauTokenValue(singleCred.TABLEAU_TOKEN_VALUE);
        setConfigTcmBaseUrl(singleCred.TCM_BASE_URL || "");
        setConfigTcmTokenSecret(singleCred.TCM_TOKEN_SECRET || "");

        setConfigStatus("success")
      } else {
        if (tableauEnv === "server") {
          setCurrentConnectionName("")
          setConfigConnectionName("")
          setConfigTableauUrl("")
          setConfigTableauTokenName("TableauToken")
        }
        setConfigStatus("error")
      }
      setIsConfigDialogOpen(true)
    } catch (err) {
      setError(getErrorMessage(err) || "Failed to fetch configurations")
      setConfigStatus("error")
      setIsConfigDialogOpen(true) // Open to show error status
    }
    finally { setLoadingTableau(false) }
  }

  const handleConnectionSelect = (connectionId: string) => {
    const cred = savedCredentials.find(c => c.connection_id === connectionId);
    setSelectedConnectionId(connectionId || "");
    if (cred) setCurrentConnectionName(cred.CONNECTION_NAME || cred.TABLEAU_SERVER_URL || "");
    if (cred) {
      setTableauCredentials(cred);
      setConfigConnectionName(cred.CONNECTION_NAME || "");
      setConfigTableauUrl(cred.TABLEAU_SERVER_URL || "");
      // Always clear the displayed site name when switching connections.
      // The stored TABLEAU_SITE_NAME may be stale (e.g. "vectorlab" from a
      // previous save) and would cause 401 errors on the new connection.
      // The sites dropdown will re-populate from the fresh API response;
      // the user must explicitly choose the correct site for this connection.
      setTableauSiteName("");
      setTableauSiteId("");
      setConfigTableauTokenName(cred.TABLEAU_TOKEN_NAME || "");
      // Note: TABLEAU_TOKEN_VALUE usually not returned for security if already saved
      setConfigTcmBaseUrl(cred.TCM_BASE_URL || "");
      setConfigTcmTokenSecret(cred.TCM_TOKEN_SECRET || "");

      // Reset dependent data
      setProjects([]);
      setWorkbooks([]);
      setSites([]);
    }
    setConfigStatus("idle");
    setToastMessage(null);
    setIsConnectionNameEditable(false);
  };

  const handleAddNew = () => {
    setSelectedConnectionId("");
    setCurrentConnectionName("");
    setConfigConnectionName("");
    setConfigTableauUrl("");
    setTableauSiteName("");
    setConfigTableauTokenName("TableauToken");
    setConfigTableauTokenValue("");
    setConfigTcmBaseUrl("");
    setConfigTcmTokenSecret("");
    setConfigStatus("idle");
    setToastMessage(null);
    setIsConnectionNameEditable(false);
    setTableauCredentials(null);
  };

  const handleDeleteConnection = async () => {
    const cred = savedCredentials.find(c => c.connection_id === selectedConnectionId);
    if (!cred?.connection_id) {
      setError("No saved connection selected to delete");
      return;
    }
    setLoadingTableau(true);
    setError(null);
    try {
      await tableauService.deleteConnection(cred.connection_id);
      const updatedCreds = await tableauService.initializeConnection(tableauEnv);
      const credsArray = Array.isArray(updatedCreds) ? updatedCreds : (updatedCreds ? [updatedCreds] : []);
      setSavedCredentials(credsArray);
      setToastMessage(null);
      setIsConnectionNameEditable(false);
      handleAddNew();  // Clear form after deletion
      setConfigStatus("idle");
    } catch (err) {
      setError(getErrorMessage(err) || "Failed to delete connection");
    } finally {
      setLoadingTableau(false);
    }
  };

  const handleSave = async () => {
    if (!configConnectionName.trim()) { setError("Please enter a valid Connection Name"); return }
    if (!configTableauUrl.trim()) { setError("Please enter a valid Tableau URL"); return }

    const effectiveConnectionId = selectedConnectionId || tableauCredentials?.connection_id;
    const isNameChanged = effectiveConnectionId && tableauCredentials?.CONNECTION_NAME !== configConnectionName.trim();

    setLoadingTableau(true)
    setError(null)
    setToastMessage(null)

    // 1. Duplicate Name Check
    if (isNameChanged && effectiveConnectionId) {
      const isDuplicate = savedCredentials.some(c => c.CONNECTION_NAME === configConnectionName.trim() && c.connection_id !== effectiveConnectionId);
      if (isDuplicate) {
        setToastMessage({ type: "error", text: "A connection with this name already exists." });
        setConfigConnectionName(tableauCredentials?.CONNECTION_NAME || "");
        setIsConnectionNameEditable(false);
        setLoadingTableau(false);
        return;
      }
    }

    try {
      const creds: TableauCredentials = {
        connection_id: effectiveConnectionId,
        CONNECTION_NAME: configConnectionName.trim(),
        TABLEAU_SERVER_URL: configTableauUrl,
        TABLEAU_SITE_NAME: tableauEnv === "cloud_trial" ? tableauSiteName : tableauSiteName,
        TABLEAU_TOKEN_NAME: configTableauTokenName,
        TABLEAU_TOKEN_VALUE: configTableauTokenValue,
        TCM_BASE_URL: tableauEnv === "cloud" ? configTcmBaseUrl : "",
        TCM_TOKEN_SECRET: tableauEnv === "cloud" ? configTcmTokenSecret : "",
      }
      await tableauService.storeTableauUrl(creds, tableauEnv)

      const updatedCreds = await tableauService.initializeConnection(tableauEnv)
      const credsArray = Array.isArray(updatedCreds) ? updatedCreds : (updatedCreds ? [updatedCreds] : [])
      setSavedCredentials(credsArray)

      const targetId = tableauCredentials?.connection_id || selectedConnectionId;
      const singleCred = credsArray.find(c => targetId ? c.connection_id === targetId : (c.CONNECTION_NAME === configConnectionName || c.TABLEAU_SERVER_URL === configTableauUrl)) || credsArray[0] || null
      // Merge: backend does NOT return TABLEAU_TOKEN_VALUE (it's a secret).
      // Preserve the locally-held token so it isn't wiped.
      if (singleCred) {
        singleCred.TABLEAU_TOKEN_VALUE = configTableauTokenValue || singleCred.TABLEAU_TOKEN_VALUE
        singleCred.TABLEAU_TOKEN_NAME = configTableauTokenName || singleCred.TABLEAU_TOKEN_NAME
      }
      setTableauCredentials(singleCred)
      if (singleCred) {
        setCurrentConnectionName(singleCred.CONNECTION_NAME || singleCred.TABLEAU_SERVER_URL)
      }

      setConfigStatus("success")
      setToastMessage({ type: "success", text: effectiveConnectionId ? "Connection updated successfully." : "Connection created successfully." });
      setIsConnectionNameEditable(false);
      setIsConfigDialogOpen(false)
    } catch (err) { setError(getErrorMessage(err) || "Failed to save configurations") }
    finally { setLoadingTableau(false) }
  }

  const completedCount = useMemo(() => {
    if (!currentRunId || !assessmentData || !assessmentData[currentRunId]) return 0
    return selectedWorkbooks.filter((id) => !!assessmentData[currentRunId][id]).length
  }, [assessmentData, currentRunId, selectedWorkbooks])


  const parsingCompletedCount = useMemo(() => {
    return selectedWorkbooks.filter(id => !!parsingData[id]).length
  }, [parsingData, selectedWorkbooks])

  const mappingCompletedCount = useMemo(() => {
    return selectedWorkbooks.filter(id => !!mappingData[id]).length
  }, [mappingData, selectedWorkbooks])

  const generationCompletedCount = useMemo(() => {
    return selectedWorkbooks.filter(id => !!generationData[id]).length
  }, [generationData, selectedWorkbooks])

  const validationCompletedCount = useMemo(() => {
    return selectedWorkbooks.filter(id => !!validationData[id]).length
  }, [validationData, selectedWorkbooks])

  const totalCount = selectedWorkbooks.length

  const workbooksStr = JSON.stringify(selectedWorkbooks);

  // NOTE: Assessment polling is handled by agent.store.ts via startPolling().
  // No duplicate interval needed here.


  const hasAllParsingData = useMemo(() => {
    if (!currentRunId || selectedWorkbooks.length === 0) return false;
    return selectedWorkbooks.every(id => !!parsingData[id]);
  }, [parsingData, currentRunId, selectedWorkbooks]);

  const isParsingPaused = mode === 'single' && !hasContinued && isProcessing && hasAllParsingData;

  // Mark migration as complete when Assessment + Parsing + Mapping + Validation are done for all workbooks
  // We no longer evaluate termination here based on activities.
  // Instead, rely on agent.store.ts 'finalizeRun' when all DATA is actually fetched properly.
  // useEffect(() => {
  //   if (isProcessing && currentRunId && totalCount > 0) {
  //     const allDone = completedCount >= totalCount &&
  //       parsingCompletedCount >= totalCount &&
  //       mappingCompletedCount >= totalCount &&
  //       validationCompletedCount >= totalCount
  //
  //     if (allDone) {
  //       stopProcessing()
  //       setMigrationStartedLocal(true)
  //       setMigrationStarted(true)
  //       setMigrationPhase('completed')
  //     }
  //   }
  // }, [completedCount, parsingCompletedCount, mappingCompletedCount, validationCompletedCount, totalCount, isProcessing, currentRunId, stopProcessing, setMigrationPhase, setMigrationStarted])

  const handleReload = () => window.location.reload()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!mounted) return
      setLoadingTableau(true)
      setError(null)
      try {
        const creds = await tableauService.initializeConnection(tableauEnv)
        const credsArray = Array.isArray(creds) ? creds : (creds ? [creds] : [])
        if (mounted) {
          setSavedCredentials(credsArray)
          const singleCred = credsArray[0] ?? null
          setTableauCredentials(singleCred)
          if (singleCred) {
            if (tableauEnv === "server") {
              // Strictly override if backend returns Cloud URL for Server env
              const isCloudURL = singleCred.TABLEAU_SERVER_URL?.includes("online.tableau.com") || singleCred.TABLEAU_SERVER_URL?.includes("tableau.com");
              const url = (!isCloudURL && singleCred.TABLEAU_SERVER_URL) ? singleCred.TABLEAU_SERVER_URL : "";
              setCurrentConnectionName(singleCred.CONNECTION_NAME || url);
              setConfigConnectionName(singleCred.CONNECTION_NAME || "");
              setConfigTableauUrl(url);
              setConfigTableauTokenName(singleCred.TABLEAU_TOKEN_NAME || "TableauToken");
            } else {
              if (singleCred.TABLEAU_SERVER_URL) {
                setCurrentConnectionName(singleCred.CONNECTION_NAME || singleCred.TABLEAU_SERVER_URL);
                setConfigTableauUrl(singleCred.TABLEAU_SERVER_URL);
              }
              if (singleCred.CONNECTION_NAME) setConfigConnectionName(singleCred.CONNECTION_NAME);
              if (singleCred.TABLEAU_TOKEN_NAME) setConfigTableauTokenName(singleCred.TABLEAU_TOKEN_NAME)
            }
            // Do NOT restore TABLEAU_SITE_NAME from the saved credential here.
            // The saved site name may be stale (e.g. "vectorlab" saved against a
            // connection that now points to a different site). Leaving it empty
            // forces the user to pick from the freshly fetched sites dropdown,
            // which prevents the 401 "Tableau sign-in failed" error.
            if (singleCred.TABLEAU_TOKEN_VALUE) setConfigTableauTokenValue(singleCred.TABLEAU_TOKEN_VALUE)
            if (singleCred.TCM_BASE_URL) setConfigTcmBaseUrl(singleCred.TCM_BASE_URL)
            if (singleCred.TCM_TOKEN_SECRET) setConfigTcmTokenSecret(singleCred.TCM_TOKEN_SECRET)
          } else {
            if (tableauEnv === "server") {
              setCurrentConnectionName("")
              setConfigConnectionName("")
              setConfigTableauUrl("")
              setConfigTableauTokenName("TableauToken")
            }
          }
        }
      } catch (err) {
        if (mounted) setError(getErrorMessage(err) || "Failed to connect to Tableau")
      } finally {
        if (mounted) setLoadingTableau(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [tableauEnv]) // Reload when environment changes

  useEffect(() => {
    let mounted = true
    const url = tableauCredentials?.TABLEAU_SERVER_URL || configTableauUrl;

    const loadSites = async () => {
      if (!mounted || !url) return
      setLoadingSites(true)
      try {
        const list = await tableauService.getSites(configTcmBaseUrl, tableauEnv, {
          TABLEAU_SERVER_URL: url,
          // For server-mode site listing we need the credential's own TABLEAU_SITE_NAME
          // for authentication — NOT the currently displayed tableauSiteName (which is
          // the user's selection and may be empty while the dropdown is being populated).
          TABLEAU_SITE_NAME: tableauCredentials?.TABLEAU_SITE_NAME || "",
          TABLEAU_TOKEN_NAME: (configTableauTokenName || tableauCredentials?.TABLEAU_TOKEN_NAME) ?? "",
          TABLEAU_TOKEN_VALUE: (configTableauTokenValue || tableauCredentials?.TABLEAU_TOKEN_VALUE) ?? "",
          TCM_TOKEN_SECRET: configTcmTokenSecret,
          connection_id: tableauCredentials?.connection_id
        })
        if (mounted) {
          setSites(list)
        }
      } catch (err) {
        if (mounted) setError("Failed to load sites")
      } finally {
        if (mounted) setLoadingSites(false)
      }
    }
    loadSites()
    return () => { mounted = false }
    // tableauSiteName intentionally excluded: the user's site selection should NOT
    // trigger a re-fetch of the site list. Sites are driven by the connection, not by
    // which site is currently selected in the dropdown.
  }, [tableauCredentials, tableauEnv, currentConnectionName, configTableauUrl, configTableauTokenName, configTableauTokenValue, configTcmBaseUrl, configTcmTokenSecret])

  // Sync site ID if name is set but ID is missing (e.g. on load from saved credentials)
  useEffect(() => {
    if (sites.length > 0 && tableauSiteName && !tableauSiteId) {
      const site = sites.find(s => s.name === tableauSiteName || s.id === tableauSiteName);
      if (site) {
        setTableauSiteId(site.id);
        console.log(`[MigrationTab] Auto-synced site ID for ${tableauSiteName}: ${site.id}`);
      }
    }
  }, [sites, tableauSiteName, tableauSiteId]);

  useEffect(() => {
    if (!account) return
    const acquireFabricToken = async () => {
      try {
        const response = await instance.acquireTokenSilent({ scopes: ["https://api.fabric.microsoft.com/.default"], account })
        sessionStorage.setItem("fabric_access_token", response.accessToken)
        fabricService.initialize(async () => response.accessToken)
        setFabricReady(true)
      } catch (e) {
        setError("Failed to acquire Fabric token")
      }
    }
    acquireFabricToken()
  }, [instance, account])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!mounted || !fabricReady) return
      setLoadingFabric(true)
      setError(null)
      try {
        const creds = await fabricService.initializeConnection()
        if (mounted) setFabricCredentials(creds)
      } catch (err) {
        if (mounted) setError(getErrorMessage(err) || "Failed to connect to Microsoft Fabric")
      } finally {
        if (mounted) setLoadingFabric(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [fabricReady])

  useEffect(() => {
    let mounted = true
    const url = tableauCredentials?.TABLEAU_SERVER_URL || configTableauUrl;
    if (!mounted || !url || !tableauSiteName) return

    const loadProjects = async () => {
      setLoadingProjects(true)
      setError(null)
      try {
        const list = await tableauService.getProjects(url, user?.email || "", tableauSiteName, tableauEnv, {
          TABLEAU_SERVER_URL: url,
          TABLEAU_SITE_NAME: tableauSiteName,
          TABLEAU_TOKEN_NAME: (configTableauTokenName || tableauCredentials?.TABLEAU_TOKEN_NAME) ?? "",
          TABLEAU_TOKEN_VALUE: (configTableauTokenValue || tableauCredentials?.TABLEAU_TOKEN_VALUE) ?? "",
          connection_id: tableauCredentials?.connection_id
        }, tableauSiteId)
        if (mounted) {
          setProjects(list)
        }
      } catch (err) {
        if (mounted) {
          setError(getErrorMessage(err) || "Failed to load projects")
        }
      } finally {
        if (mounted) setLoadingProjects(false)
      }
    }
    loadProjects()
    return () => { mounted = false }
  }, [tableauCredentials, user?.email, tableauEnv, tableauSiteName, tableauSiteId, currentConnectionName, configTableauUrl, configTableauTokenName, configTableauTokenValue])

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    if (!isAuthenticated || !account || !fabricCredentials || !tableauCredentials) return;

    const loadWorkspaces = async () => {
      if (!mounted) return;
      if (retryCount === 0) setLoadingWorkspaces(true);

      try {
        const list = await fabricService.getWorkspaces();
        if (!mounted) return;
        setFabricWorkspaces(list || []);
        setLoadingWorkspaces(false);
      } catch (err) {
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          setLoadingWorkspaces(false);
          setError("Failed to load Fabric workspaces. Please refresh.");
          return;
        }
        timeoutId = setTimeout(loadWorkspaces, 3000);
      }
    };

    loadWorkspaces();
    return () => { mounted = false; if (timeoutId) clearTimeout(timeoutId); };
  }, [isAuthenticated, account, fabricCredentials, tableauCredentials, fabricReady]);

  useEffect(() => {
    let mounted = true
    const url = tableauCredentials?.TABLEAU_SERVER_URL || configTableauUrl;
    if (!mounted || !url || !tableauSiteName || !selectedProject) return

    const loadWorkbooks = async () => {
      setLoadingWorkbooks(true)
      setError(null)
      try {
        const list = await tableauService.getWorkbooksForProject(url, selectedProject, user?.email || "", tableauSiteName, tableauEnv, {
          TABLEAU_SERVER_URL: url,
          TABLEAU_SITE_NAME: tableauSiteName,
          TABLEAU_TOKEN_NAME: (configTableauTokenName || tableauCredentials?.TABLEAU_TOKEN_NAME) ?? "",
          TABLEAU_TOKEN_VALUE: (configTableauTokenValue || tableauCredentials?.TABLEAU_TOKEN_VALUE) ?? "",
          connection_id: tableauCredentials?.connection_id
        }, tableauSiteId)
        if (mounted) {
          setWorkbooks(list)
          // Auto-select disabled: User must manually select workbooks
          // if (list.length > 0 && scope === "selected") {
          //   setSelectedWorkbooks(list.map(w => w.id))
          // }
        }
      } catch (err) {
        if (mounted) {
          setError(getErrorMessage(err) || "Failed to load workbooks");
        }
      } finally {
        if (mounted) setLoadingWorkbooks(false)
      }
    }
    loadWorkbooks()
    return () => { mounted = false }
  }, [selectedProject, tableauCredentials, user?.email, tableauEnv, tableauSiteName, tableauSiteId, currentConnectionName, configTableauUrl, configTableauTokenName, configTableauTokenValue, scope, setSelectedWorkbooks])

  // ── Fetch lakehouses when workspace changes ──
  useEffect(() => {
    if (!selectedWorkspace) {
      setLakehouses([])
      setSelectedLakehouse("")
      return
    }
    let mounted = true
    const loadLakehouses = async () => {
      setLoadingLakehouses(true)
      try {
        const list = await fabricService.getLakehouses(selectedWorkspace)
        if (mounted) {
          setLakehouses(list)
          setSelectedLakehouse("") // default to Create New
        }
      } catch (err) {
        console.warn("[MigrationTab] Failed to load lakehouses:", err)
        if (mounted) {
          setLakehouses([])
          setSelectedLakehouse("")
        }
      } finally {
        if (mounted) setLoadingLakehouses(false)
      }
    }
    loadLakehouses()
    return () => { mounted = false }
  }, [selectedWorkspace])

  const handleStartProcessing = useCallback(async () => {
    if (isProcessing || isStarting || hasStartedRef.current) return
    setMigrationPhase('processing');
    setIsStarting(true)
    setMigrationStartedLocal(false)
    setError(null)

    assessmentTriggeredRef.current = false;

    // --- Reset single run mode continuation flag
    setHasContinued(false);

    let oneLakeToken: string | undefined;
    let fabricToken: string | undefined;

    try {
      const { getActiveToken } = await import("@/components/providers/MsalProviderWrapper");

      // Force-refresh all 3 tokens: bearer, fabric_access_token, onelake_token
      [oneLakeToken, fabricToken] = await Promise.all([
        getStorageToken(true),
        getFabricToken(true)
      ]);
      await getActiveToken(true);
      console.log("[MigrationTab] All 3 tokens force-refreshed for Start Migration");
    } catch (tokenErr) {
      console.warn("[MigrationTab] Failed to force-refresh tokens, proceeding with what is available", tokenErr);
      // Fallback to sessionStorage if acquisition failed
      oneLakeToken = oneLakeToken || sessionStorage.getItem("onelake_token") || undefined;
      fabricToken = fabricToken || sessionStorage.getItem("fabric_access_token") || undefined;
    }

    try {
      if (!isAuthenticated || !user?.email) throw new Error("Please sign in")
      if (!tableauCredentials?.TABLEAU_SERVER_URL) throw new Error("Tableau credentials missing")
      if (!fabricCredentials || (!selectedWorkspace && !isLiteMode())) throw new Error("Fabric workspace not selected")

      if (selectedWorkspace) {
        await fabricService.selectWorkspace(selectedWorkspace)
      }

      let response

      const targetWorkspace = selectedWorkspace ? fabricWorkspaces.find(ws => ws.id === selectedWorkspace) : null;
      const workspaceName = targetWorkspace?.displayName || targetWorkspace?.name || "";
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_workspace_name", workspaceName);
      }

      // Sync the explicit UI selections into the global store immediately before generating the migration request
      setStoreTableauSiteName(tableauSiteName);
      setStoreSelectedWorkspace(selectedWorkspace, workspaceName);

      if (scope === "selected") {
        if (!selectedProject) throw new Error("No project selected")
        if (selectedWorkbooks.length === 0) throw new Error("No workbooks selected")
        const items = batchService.buildBatchItems(selectedProject, selectedWorkbooks, workbooks)
        response = await batchService.startMigration(
          user.email,
          tableauCredentials.TABLEAU_SERVER_URL,
          tableauSiteName,
          "selected",
          undefined,
          items,
          selectedWorkspace,
          workspaceName,
          tableauSiteId,
          tableauEnv,
          tableauCredentials.TABLEAU_TOKEN_NAME || configTableauTokenName,
          oneLakeToken,
          fabricToken,
          dataLayerEnabled ? selectedLakehouse : undefined,
          tableauCredentials.connection_id
        )
      } else if (scope === "project") {
        if (selectedProjects.length === 0) throw new Error("No projects selected")
        response = await batchService.startMigration(
          user.email,
          tableauCredentials.TABLEAU_SERVER_URL,
          tableauSiteName,
          "project",
          selectedProjects,
          [],
          selectedWorkspace,
          workspaceName,
          tableauSiteId,
          tableauEnv,
          tableauCredentials.TABLEAU_TOKEN_NAME || configTableauTokenName,
          oneLakeToken,
          fabricToken,
          dataLayerEnabled ? selectedLakehouse : undefined,
          tableauCredentials.connection_id
        )
      } else if (scope === "site") {
        response = await batchService.startMigration(
          user.email,
          tableauCredentials.TABLEAU_SERVER_URL,
          tableauSiteName,
          "site",
          undefined,
          [],
          selectedWorkspace,
          workspaceName,
          tableauSiteId,
          tableauEnv,
          tableauCredentials.TABLEAU_TOKEN_NAME || configTableauTokenName,
          oneLakeToken,
          fabricToken,
          dataLayerEnabled ? selectedLakehouse : undefined,
          tableauCredentials.connection_id
        )
      } else if (scope === "entire") {
        console.log("[Migration] Starting Entire Environment migration");
        console.log("[Migration] Scope payload: entire");
        response = await batchService.startMigration(
          user.email,
          tableauCredentials.TABLEAU_SERVER_URL,
          tableauSiteName,
          "entire",
          undefined,
          [],
          selectedWorkspace,
          workspaceName,
          tableauSiteId,
          tableauEnv,
          tableauCredentials.TABLEAU_TOKEN_NAME || configTableauTokenName,
          oneLakeToken,
          fabricToken,
          dataLayerEnabled ? selectedLakehouse : undefined,
          tableauCredentials.connection_id
        )
        console.log("[Migration] Entire Environment response received", response);
      } else {
        throw new Error(`Scope "${scope}" not recognized or implemented`);
      }

      const runId = response?.run_id ?? response?.runId ?? `run-${Date.now()}`

      let finalWorkbooks = selectedWorkbooks
      let finalApplications: any[] = []
      let workbookProjectMap: Record<string, string> = {}

      if (response?.workbooks && response.workbooks.length > 0) {
        finalWorkbooks = response.workbooks.map((w: any) => w.workbook_id)

        // ★ Build per-workbook projectId map (critical for site scope)
        response.workbooks.forEach((w: any) => {
          workbookProjectMap[w.workbook_id] = w.project_id || selectedProject || "unknown"
        })

        finalApplications = response.workbooks.map((w: any) => ({
          id: crypto.randomUUID(),
          siteName: "",
          projectName: w.project_name || selectedProjectName || selectedProject || "Unknown",
          workbookName: w.workbook_name || w.workbook_id,
          workbookId: w.workbook_id,
          projectId: w.project_id || selectedProject || "Unknown",
          status: "Running",
          currentAgent: "Assessment Agent" as any,
          startTime: new Date(),
        }))
      } else {
        finalApplications = selectedWorkbooks.map(wbId => ({
          id: crypto.randomUUID(),
          siteName: "",
          projectName: selectedProjectName || selectedProject || "Unknown",
          workbookName: wbId,
          workbookId: wbId,
          projectId: selectedProject || "Unknown",
          status: "Running",
          currentAgent: "Assessment Agent" as any,
          startTime: new Date(),
        }))
        // Single project — all workbooks share the same projectId
        selectedWorkbooks.forEach(wbId => {
          workbookProjectMap[wbId] = selectedProject || "unknown"
        })
      }

      useDashboardStore.setState({
        runId, applications: finalApplications, selectedWorkbooks: finalWorkbooks, isProcessing: true, hasShownResultSection: true, logs: [], agentResults: {},
      })

      // ★ Pass workbookProjectMap so agent store uses correct projectId per workbook
      setCurrentRunInfo(runId, selectedProject ?? "all", finalWorkbooks, workbookProjectMap)
      setCurrentRunId(runId)
      hasStartedRef.current = true
      startProcessing()

      setMigrationStartedLocal(true)
      setMigrationStarted(true)
      setActiveSubTab("overview")

    } catch (err) {
      if (scope === "entire") {
        console.error("[Migration] Entire Environment failed", err);
      }
      setMigrationPhase('idle');
      setError(getErrorMessage(err) || "Failed to start migration")
    } finally {
      setIsStarting(false)
    }
  }, [
    isProcessing, isStarting, isAuthenticated, user, tableauCredentials, fabricCredentials,
    selectedWorkspace, scope, selectedProject, selectedProjects, selectedWorkbooks, startProcessing,
    setCurrentRunInfo, selectedProjectName, setMigrationStarted, setMigrationPhase,
    configTableauTokenName, fabricWorkspaces, setHasContinued, tableauEnv,
    tableauSiteId, tableauSiteName, workbooks, setCurrentRunId,
    setActiveSubTab, selectedLakehouse, dataLayerEnabled
  ])

  const debouncedStart = debounce(handleStartProcessing, 800, { leading: true, trailing: false })

  const handleCancel = () => {
    setCurrentRunId(null); setError(null); hasStartedRef.current = false; setMigrationStartedLocal(false); setMigrationStarted(false); setMigrationPhase('idle'); stopProcessing()
  }

  const isReady = isAuthenticated && !!user?.email && !!tableauCredentials?.TABLEAU_SERVER_URL && !!fabricCredentials && (!!selectedWorkspace || isLiteMode()) && !isProcessing && !isStarting && (scope === "selected" ? !!selectedProject && selectedWorkbooks.length > 0 : scope === "project" ? selectedProjects.length > 0 : true)

  const canAccessResults = hasShownResultSection || isProcessing || !!currentRunId

  let migrationText = "Awaiting"
  let migrationIcon = "⚠️"
  let migrationColorClass = styles.statusYellow

  if (isProcessing || isStarting) {
    if (isParsingPaused) {
      migrationText = "Parsing Done"; migrationIcon = "✓"; migrationColorClass = styles.statusGreen
    } else {
      migrationText = "Processing"; migrationIcon = "…"; migrationColorClass = styles.statusIndigo
    }
  } else if (currentRunId && !isProcessing && migrationStartedLocal) {
    migrationText = "Completed"; migrationIcon = "✓"; migrationColorClass = styles.statusGreen
  }

  const statusText = isReady ? "Ready ✓" : "Awaiting ⚠️"
  const statusClass = isReady ? styles.statusGreen : styles.statusYellow

  if (!isAuthenticated || !user?.email) {
    return (
      <div className={styles.root}>
        <MessageBar intent="warning" className={styles.errorAlert}><MessageBarBody><MessageBarTitle>Please sign in</MessageBarTitle>You need to be signed in to start a migration.</MessageBarBody></MessageBar>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {error && (
        <MessageBar intent="error" className={styles.errorAlert}><MessageBarBody><MessageBarTitle>Error</MessageBarTitle>{error}</MessageBarBody></MessageBar>
      )}


      <div className={styles.mainGrid}>
        <Card className={mergeClasses(styles.card, styles.sourceCard)}>
          <div className={mergeClasses(styles.cardHeader, styles.sourceHeader)}>
            <div className={styles.headerContent}>
              <Image
                src="https://img.icons8.com/?size=100&id=9Kvi1p1F0tUo&format=png&color=000000"
                alt="Tableau"
                width={48}
                height={48}
                style={{ flexShrink: 0 }}
                unoptimized
              />
              <div><Text size={500} weight="semibold" style={{ color: "#1e40af" }}>Source</Text><br /><Text size={200} style={{ color: "#2563eb" }}>Tableau Environment</Text></div>
            </div>
          </div>
          <div className={styles.cardInnerPadding}>
            <div style={{ marginBottom: "20px" }}>
              <TabList
                selectedValue={tableauEnv}
                onTabSelect={(_, d) => {
                  const newEnv = d.value as "cloud" | "server" | "cloud_trial";
                  setTableauEnv(newEnv);
                  setTableauCredentials(null)

                  setSelectedProject("", "");
                  setSelectedWorkbooks([]);
                  setProjects([]);
                  setWorkbooks([]);
                  setSites([]);
                  setTableauSiteId("");
                  setTableauSiteName("");
                  setSelectedConnectionId("");
                  setCurrentConnectionName("");
                  setConfigConnectionName("");
                  setConfigTableauUrl("");
                  setConfigTableauTokenName("TableauToken");
                  setConfigTcmBaseUrl("");
                  setConfigTcmTokenSecret("");
                  setConfigTableauTokenValue("");
                }}
                appearance="subtle"
                size="small"
              >
                <Tab value="cloud">Cloud</Tab>
                <Tab value="cloud_trial">Cloud Trial</Tab>
                <Tab value="server">Server</Tab>
              </TabList>
            </div>
            <div>
              <Label className={styles.sectionTitle} style={{ color: "#1e40af" }}>Connection Name</Label>
              <div className={styles.inputGroup}>
                <Combobox
                  value={currentConnectionName}
                  onChange={(e) => { setCurrentConnectionName(e.target.value); setSelectedConnectionId(""); }}
                  selectedOptions={[selectedConnectionId]}
                  onOptionSelect={(_, d) => handleConnectionSelect(d.optionValue as string)}
                  disabled={isProcessing || isStarting}
                  className={styles.inputField}
                  placeholder="Enter or select a Connection Name"
                  freeform
                >
                  {savedCredentials.map((cred, idx) => (
                    <Option key={cred.connection_id || `temp-${idx}`} value={cred.connection_id || ""}>
                      {cred.CONNECTION_NAME || cred.TABLEAU_SERVER_URL}
                    </Option>
                  ))}
                </Combobox>
                <Dialog open={isConfigDialogOpen} onOpenChange={(_, d) => setIsConfigDialogOpen(d.open)}>
                  <DialogTrigger disableButtonEnhancement>
                    <Button appearance="primary" size="small" onClick={fetchConfig} disabled={isProcessing || isStarting || loadingTableau}>{loadingTableau ? <Spinner size="tiny" /> : "Configure"}</Button>
                  </DialogTrigger>
                  <DialogSurface>
                    <DialogBody>
                      <DialogTitle>Configure Source Connection</DialogTitle>
                      <DialogContent style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", marginBottom: "8px" }}>
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Label weight="semibold" style={{ color: "#1e40af" }}>Saved Connections</Label>
                              <Tooltip content="Select a previously saved Tableau connection configuration or create a new one." relationship="label">
                                <Info16Regular style={{ color: "#64748b", cursor: "help" }} />
                              </Tooltip>
                            </div>
                            <Dropdown
                              style={{ width: "100%", marginTop: "4px" }}
                              placeholder="Production Tableau Cloud Connection"
                              value={savedCredentials.find(c => c.connection_id === selectedConnectionId)?.CONNECTION_NAME || currentConnectionName}
                              selectedOptions={[selectedConnectionId]}
                              onOptionSelect={(_, d) => handleConnectionSelect(d.optionValue as string)}
                            >
                              {savedCredentials.map((c, idx) => (
                                <Option key={c.connection_id || `temp-${idx}`} value={c.connection_id || ""}>
                                  {c.CONNECTION_NAME || c.TABLEAU_SERVER_URL}
                                </Option>
                              ))}
                            </Dropdown>
                          </div>
                          <Button
                            icon={<Add24Regular />}
                            appearance="subtle"
                            title="Add New Connection"
                            onClick={handleAddNew}
                            style={{ height: "32px" }}
                          />
                          <Button
                            icon={<Delete24Regular />}
                            appearance="subtle"
                            title="Delete Selected Connection"
                            onClick={handleDeleteConnection}
                            disabled={!selectedConnectionId || loadingTableau}
                            style={{ height: "32px", color: "#ef4444" }}
                          />
                        </div>

                        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px", paddingBottom: "16px" }}>
                          {toastMessage && (
                            <MessageBar intent={toastMessage.type} style={{ marginBottom: "12px" }}>
                              <MessageBarBody>
                                <MessageBarTitle>{toastMessage.type === "success" ? "Success" : "Error"}</MessageBarTitle>
                                {toastMessage.text}
                              </MessageBarBody>
                            </MessageBar>
                          )}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Label weight="semibold">Connection Name <span style={{ color: "red" }}>*</span></Label>
                              <Tooltip content="A friendly name to identify this connection (e.g., Production, QA, Dotnet)." relationship="label">
                                <Info16Regular style={{ color: "#64748b", cursor: "help" }} />
                              </Tooltip>
                            </div>
                            {tableauCredentials?.connection_id && !isConnectionNameEditable && (
                              <Button
                                icon={<Edit20Regular />}
                                appearance="subtle"
                                onClick={() => setIsConnectionNameEditable(true)}
                                title="Edit Connection Name"
                                size="small"
                              />
                            )}
                            {isConnectionNameEditable && (
                              <Button
                                icon={<Dismiss20Regular />}
                                appearance="subtle"
                                onClick={() => {
                                  setIsConnectionNameEditable(false);
                                  setConfigConnectionName(tableauCredentials?.CONNECTION_NAME || "");
                                }}
                                title="Cancel Edit"
                                size="small"
                              />
                            )}
                          </div>
                          <Input
                            style={{ width: "100%", marginTop: "4px" }}
                            value={configConnectionName}
                            onChange={(e) => setConfigConnectionName(e.target.value)}
                            placeholder="e.g. Production Tableau"
                            disabled={!!tableauCredentials?.connection_id && !isConnectionNameEditable}
                          />
                        </div>

                        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Label weight="semibold">Tableau URL</Label>
                            <Tooltip
                              content={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div><strong>Location:</strong></div>
                                  <div>Tableau Browser URL</div>
                                  <div style={{ marginTop: '4px' }}><strong>Tooltip Content:</strong></div>
                                  <div>“Enter your Tableau Cloud or Tableau Server URL used to access your Tableau environment.”</div>
                                </div>
                              }
                              relationship="label"
                            >
                              <Info16Regular style={{ color: "#64748b", cursor: "help" }} />
                            </Tooltip>
                          </div>
                          <Input
                            style={{ width: "100%", marginTop: "4px" }}
                            value={configTableauUrl}
                            onChange={(e) => setConfigTableauUrl(e.target.value)}
                            placeholder="https://prod-useast-a.online.tableau.com"
                          />
                        </div>

                        {tableauEnv === "cloud" && (
                          <>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Label weight="semibold">TCM Base URL</Label>
                                <Tooltip
                                  content={
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div><strong>Location:</strong></div>
                                      <div>Tableau Cloud Manager (TCM) Portal</div>
                                      <div style={{ marginTop: '4px' }}><strong>Tooltip Content:</strong></div>
                                      <div>“Base URL for Tableau Cloud Manager services used during cloud authentication and workspace access.”</div>
                                    </div>
                                  }
                                  relationship="label"
                                >
                                  <Info16Regular style={{ color: "#64748b", cursor: "help" }} />
                                </Tooltip>
                              </div>
                              <Input
                                style={{ width: "100%", marginTop: "4px" }}
                                value={configTcmBaseUrl}
                                onChange={(e) => setConfigTcmBaseUrl(e.target.value)}
                                placeholder="https://cloudmanager.tableau.com"
                              />
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Label weight="semibold">TCM Token Secret</Label>
                                <Tooltip
                                  content={
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div><strong>Location:</strong></div>
                                      <div>Tableau Cloud Manager → Access / Token Settings</div>
                                      <div style={{ marginTop: '4px' }}><strong>Tooltip Content:</strong></div>
                                      <div>“Secure token secret used for Tableau Cloud Manager authentication.”</div>
                                    </div>
                                  }
                                  relationship="label"
                                >
                                  <Info16Regular style={{ color: "#64748b", cursor: "help" }} />
                                </Tooltip>
                              </div>
                              <Input
                                style={{ width: "100%", marginTop: "4px" }}
                                type="password"
                                value={configTcmTokenSecret}
                                onChange={(e) => setConfigTcmTokenSecret(e.target.value)}
                                placeholder="tcm-secret-token-value"
                                autoComplete="new-password"
                              />
                            </div>
                          </>
                        )}
                        {tableauEnv === "cloud_trial" && (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Label weight="semibold">Site Name (Content URL)</Label>
                              <Tooltip
                                content={
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div><strong>Location:</strong></div>
                                    <div>Tableau Cloud URL → After #/site/</div>
                                    <div style={{ marginTop: '4px' }}><strong>Tooltip Content:</strong></div>
                                    <div>“Enter the Site Content URL from your Tableau Cloud Trial environment.”</div>
                                  </div>
                                }
                                relationship="label"
                              >
                                <Info16Regular style={{ color: "#64748b", cursor: "help" }} />
                              </Tooltip>
                            </div>
                            <Input
                              style={{ width: "100%", marginTop: "4px" }}
                              value={tableauSiteName}
                              onChange={(e) => setTableauSiteName(e.target.value)}
                              placeholder="company-analytics-site"
                            />
                            <Text size={100} style={{ color: "#6b7280", marginTop: "4px" }}>The site content URL from your Tableau Cloud trial. Found in your URL: https://...tableau.com/#/site/&lt;site-name&gt;/...</Text>
                          </div>
                        )}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Label weight="semibold">Tableau Token Name</Label>
                            <Tooltip
                              content={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div><strong>Location:</strong></div>
                                  <div>Tableau → My Account Settings → Personal Access Tokens</div>
                                  <div style={{ marginTop: '4px' }}><strong>Tooltip Content:</strong></div>
                                  <div>“Enter the Personal Access Token (PAT) name created in your Tableau account settings.”</div>
                                </div>
                              }
                              relationship="label"
                            >
                              <Info16Regular style={{ color: "#64748b", cursor: "help" }} />
                            </Tooltip>
                          </div>
                          <Input
                            style={{ width: "100%", marginTop: "4px" }}
                            value={configTableauTokenName}
                            onChange={(e) => setConfigTableauTokenName(e.target.value)}
                            placeholder="tableau-access-token"
                          />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Label weight="semibold">Tableau Token Value</Label>
                            <Tooltip
                              content={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div><strong>Location:</strong></div>
                                  <div>Tableau → My Account Settings → Personal Access Tokens</div>
                                  <div style={{ marginTop: '4px' }}><strong>Tooltip Content:</strong></div>
                                  <div>“Enter the secret value associated with your Tableau Personal Access Token.”</div>
                                </div>
                              }
                              relationship="label"
                            >
                              <Info16Regular style={{ color: "#64748b", cursor: "help" }} />
                            </Tooltip>
                          </div>
                          <Input
                            style={{ width: "100%", marginTop: "4px" }}
                            type="password"
                            value={configTableauTokenValue}
                            onChange={(e) => setConfigTableauTokenValue(e.target.value)}
                            placeholder="pat-secret-token-value"
                          />
                        </div>
                      </DialogContent>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "24px",
                          padding: "16px 24px 24px 24px", // Restored full padding to align with modal edges
                          borderTop: "1px solid #e5e7eb",
                          width: "auto", // Allow it to fill the space naturally within DialogBody
                          gap: "120px", // Increased gap between status and buttons
                        }}
                      >
                        {/* LEFT SIDE → STATUS */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                            minWidth: "0",
                            flexGrow: 1, // Allow status to take available space
                          }}
                        >
                          {configStatus === "success" && (
                            <>
                              <CheckmarkCircle24Regular style={{ color: "#16a34a" }} />
                              <Text
                                size={200}
                                weight="semibold"
                                style={{ color: "#16a34a", whiteSpace: "nowrap" }}
                              >
                                Connection Successful
                              </Text>
                            </>
                          )}

                          {configStatus === "error" && (
                            <>
                              <ErrorCircle24Regular style={{ color: "#ef4444" }} />
                              <Text
                                size={200}
                                weight="semibold"
                                style={{ color: "#ef4444", whiteSpace: "nowrap" }}
                              >
                                Connection Failed
                              </Text>
                            </>
                          )}
                        </div>

                        {/* RIGHT SIDE → BUTTONS */}
                        <DialogActions
                          style={{
                            display: "flex",
                            gap: "12px",
                            justifyContent: "flex-end",
                            alignItems: "center",
                            flexShrink: 0,
                            margin: 0,
                            padding: 0,
                          }}
                        >
                          <DialogTrigger disableButtonEnhancement>
                            <Button
                              appearance="secondary"
                              onClick={() => setIsConfigDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                          </DialogTrigger>

                          <Button
                            appearance="primary"
                            onClick={handleSave}
                            disabled={loadingTableau}
                          >
                            {loadingTableau ? <Spinner size="tiny" /> : "Save"}
                          </Button>
                        </DialogActions>
                      </div>
                    </DialogBody>
                  </DialogSurface>
                </Dialog>
              </div>
            </div>

            <div className={styles.marginTopSpacing}>
              <Label className={styles.sectionTitle} style={{ color: "#1e40af" }}>Tableau Site Name</Label>
              {tableauEnv === "cloud_trial" ? (
                /* Cloud Trial: user manually enters site name — no TCM to list sites */
                <Input
                  value={tableauSiteName}
                  onChange={(e) => setTableauSiteName(e.target.value)}
                  style={{ width: "100%" }}
                  disabled={isProcessing || isStarting || !!tableauCredentials}
                  placeholder="Enter your site content URL (e.g. mysite)"
                />
              ) : (
                <Dropdown
                  value={tableauSiteName}
                  selectedOptions={tableauSiteId ? [tableauSiteId] : []}
                  onOptionSelect={(_, d) => {
                    const id = d.optionValue as string;
                    const site = sites.find(s => s.id === id);
                    setTableauSiteName(site?.name || id);
                    setTableauSiteId(id);
                  }}
                  className={styles.truncateDropdown}
                  style={{ width: "100%" }}
                  disabled={isProcessing || isStarting || loadingSites}
                  placeholder={loadingSites ? "Loading sites..." : "Select a site"}
                >
                  {sites.length === 0 ? (
                    <Option disabled>No sites available</Option>
                  ) : (
                    [...sites].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)
                  )}
                </Dropdown>
              )}
            </div>

            <div className={styles.marginTopSpacing}>
              <Label className={styles.sectionTitle} style={{ color: "#1e40af" }}>Migration Scope</Label>
              <RadioGroup value={scope} onChange={(_, d) => setScope(d.value as MigrationScope)} layout="vertical" disabled={isProcessing || isStarting}>
                <Radio value="selected" label="Selected Workbook" />
                <Radio value="project" label="Project (All Workbooks)" />
                <Radio value="site" label="Site (All Projects)" />
              </RadioGroup>
            </div>
            {(scope === "project" || scope === "selected") && (
              <div className={styles.marginTopSpacing}>
                <Label className={styles.sectionTitle} style={{ color: "#1e40af" }}>
                  {scope === "project" ? "Select Project(s)" : "Select Project"}
                </Label>
                {scope === "project" ? (
                  <Dropdown
                    multiselect
                    className={styles.truncateDropdown}
                    placeholder="Select one or more projects"
                    value={selectedProjects.length > 0 ? `${selectedProjects.length} project(s) selected` : ""}
                    selectedOptions={selectedProjects}
                    onOptionSelect={(_, d) => {
                      const ids = d.selectedOptions as string[]
                      const mapped = ids.map(id => {
                        const proj = projects.find(p => p.id === id)
                        return { id, name: proj?.name || id }
                      })
                      setSelectedProjects(mapped)
                    }}
                    disabled={loadingProjects || !tableauCredentials?.TABLEAU_SERVER_URL || isProcessing || isStarting}
                    style={{ width: "100%" }}
                    positioning="below"
                  >
                    {loadingProjects ? <Option disabled>Loading Projects...</Option> : projects.length === 0 ? <Option disabled>No Projects available</Option> : [...projects].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
                  </Dropdown>
                ) : (
                  <Dropdown
                    className={styles.truncateDropdown}
                    placeholder="Select a Project"
                    value={projects.find(p => p.id === selectedProject)?.name ?? ""}
                    selectedOptions={selectedProject ? [selectedProject] : []}
                    onOptionSelect={(_, d) => { const id = d.optionValue as string; const proj = projects.find(p => p.id === id); setSelectedProject(id, proj?.name || id); if (scope === "selected") setSelectedWorkbooks([]) }}
                    disabled={loadingProjects || !tableauCredentials?.TABLEAU_SERVER_URL || isProcessing || isStarting}
                    style={{ width: "100%" }}
                    positioning="below"
                  >
                    {loadingProjects ? <Option disabled>Loading Projects...</Option> : projects.length === 0 ? <Option disabled>No Projects available</Option> : [...projects].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
                  </Dropdown>
                )}
              </div>
            )}
            {scope === "selected" && (
              <div className={styles.marginTopSpacing}>
                <Label className={styles.sectionTitle} style={{ color: "#1e40af" }}>Select Workbook</Label>
                {workbooks.length > 30 ? (
                  <Dialog open={isWorkbookDialogOpen} onOpenChange={(e, d) => {
                    if (d.open) {
                      setDraftSelectedWorkbooks([...selectedWorkbooks]);
                      setDialogSearchQuery("");
                      setWorkbookCurrentPage(1);
                    }
                    setIsWorkbookDialogOpen(d.open);
                  }}>
                    <DialogTrigger disableButtonEnhancement>
                      <Button 
                        appearance="outline" 
                        style={{ width: "100%", justifyContent: "flex-start", fontWeight: "normal", color: selectedWorkbooks.length > 0 ? "inherit" : "#64748b" }}
                        disabled={!selectedProject || loadingWorkbooks || isProcessing || isStarting}
                      >
                        {loadingWorkbooks ? "Loading Workbooks..." : (
                          selectedWorkbooks.length > 0 
                            ? (selectedWorkbooks.length === workbooks.length ? `All (${selectedWorkbooks.length}) selected` : `${selectedWorkbooks.length} selected`)
                            : "Select Workbook to migrate"
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogSurface style={{ width: "100%", maxWidth: "600px" }}>
                      <DialogBody>
                        <DialogTitle>Select Workbooks to Migrate</DialogTitle>
                        <DialogContent style={{ display: "flex", flexDirection: "column", gap: "16px", height: "550px", maxHeight: "70vh", overflow: "hidden" }}>
                          <Input 
                            placeholder="Search workbooks..." 
                            value={dialogSearchQuery}
                            onChange={(e) => {
                              setDialogSearchQuery(e.target.value);
                              setWorkbookCurrentPage(1);
                            }}
                            style={{ width: "100%" }}
                          />
                          
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
                            <Checkbox 
                              label={`Select All ${dialogFilteredWorkbooks.length > 0 ? `(${dialogFilteredWorkbooks.length} filtered)` : ""}`}
                              checked={dialogFilteredWorkbooks.length > 0 && dialogFilteredWorkbooks.every(w => draftSelectedWorkbooks.includes(w.id)) ? true : (dialogFilteredWorkbooks.some(w => draftSelectedWorkbooks.includes(w.id)) ? "mixed" : false)}
                              onChange={(e, d) => {
                                if (d.checked === true) {
                                  const newSelection = new Set([...draftSelectedWorkbooks, ...dialogFilteredWorkbooks.map(w => w.id)]);
                                  setDraftSelectedWorkbooks(Array.from(newSelection));
                                } else {
                                  const idsToRemove = new Set(dialogFilteredWorkbooks.map(w => w.id));
                                  setDraftSelectedWorkbooks(draftSelectedWorkbooks.filter(id => !idsToRemove.has(id)));
                                }
                              }}
                            />
                            <Text size={200} style={{ color: "#64748b" }}>
                              {draftSelectedWorkbooks.length} selected in total
                            </Text>
                          </div>

                          <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "8px" }}>
                            {paginatedWorkbooks.length === 0 ? (
                              <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>No workbooks found.</div>
                            ) : (
                              paginatedWorkbooks.map(w => (
                                <Checkbox 
                                  key={w.id}
                                  label={w.name}
                                  checked={draftSelectedWorkbooks.includes(w.id)}
                                  onChange={(e, d) => {
                                    if (d.checked) {
                                      setDraftSelectedWorkbooks([...draftSelectedWorkbooks, w.id]);
                                    } else {
                                      setDraftSelectedWorkbooks(draftSelectedWorkbooks.filter(id => id !== w.id));
                                    }
                                  }}
                                />
                              ))
                            )}
                          </div>

                          {workbookTotalPages > 1 && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                              <Button 
                                appearance="subtle" 
                                disabled={workbookCurrentPage <= 1}
                                onClick={() => setWorkbookCurrentPage(p => p - 1)}
                              >
                                Previous
                              </Button>
                              <Text size={200}>Page {workbookCurrentPage} of {workbookTotalPages}</Text>
                              <Button 
                                appearance="subtle" 
                                disabled={workbookCurrentPage >= workbookTotalPages}
                                onClick={() => setWorkbookCurrentPage(p => p + 1)}
                              >
                                Next
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                        <DialogActions>
                          <Button appearance="secondary" onClick={() => setIsWorkbookDialogOpen(false)}>Cancel</Button>
                          <Button appearance="primary" onClick={() => {
                            setSelectedWorkbooks(draftSelectedWorkbooks);
                            setIsWorkbookDialogOpen(false);
                          }}>Apply Selection</Button>
                        </DialogActions>
                      </DialogBody>
                    </DialogSurface>
                  </Dialog>
                ) : (
                  <Combobox
                    multiselect
                    freeform
                    className={styles.truncateDropdown}
                    placeholder="Select Workbook to migrate"
                    value={workbookSearchQuery !== "" ? workbookSearchQuery : (selectedWorkbooks.length > 0 ? (selectedWorkbooks.length === workbooks.length ? `All (${selectedWorkbooks.length}) selected` : `${selectedWorkbooks.length} selected`) : "")}
                    selectedOptions={
                      selectedWorkbooks.length === workbooks.length && workbooks.length > 0
                        ? ["select-all", ...selectedWorkbooks]
                        : selectedWorkbooks
                    }
                    onChange={(e) => setWorkbookSearchQuery(e.target.value)}
                    onOpenChange={(_, d) => {
                      if (!d.open) setWorkbookSearchQuery("")
                    }}
                    onOptionSelect={(_, d) => {
                      if (d.optionValue === "select-all") {
                        if (d.selectedOptions.includes("select-all")) {
                          setSelectedWorkbooks(workbooks.map(w => w.id))
                        } else {
                          setSelectedWorkbooks([])
                        }
                        setWorkbookSearchQuery("")
                      } else if (d.optionValue) {
                        setSelectedWorkbooks(d.selectedOptions.filter(val => val !== "select-all"))
                        setWorkbookSearchQuery("")
                      }
                    }}
                    disabled={!selectedProject || loadingWorkbooks || isProcessing || isStarting}
                    style={{ width: "100%" }}
                    positioning="below"
                  >
                    {loadingWorkbooks ? <Option disabled>Loading Workbook...</Option> : filteredWorkbooks.length === 0 ? <Option disabled>No workbooks found.</Option> : (
                      <>
                        {workbookSearchQuery.trim() === "" && (
                          <Option key="select-all" value="select-all" style={{ fontWeight: "bold", borderBottom: "1px solid #e2e8f0", marginBottom: "4px" }}>Select All</Option>
                        )}
                        {[...filteredWorkbooks].sort((a, b) => (a.name || "").localeCompare(b.name || "")).slice(0, 1000).map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
                      </>
                    )}
                  </Combobox>
                )}
              </div>
            )}
          </div>
        </Card>

        <div className={styles.arrowContainer}><ArrowRight24Regular primaryFill="#64748b" /></div>

        <Card className={mergeClasses(styles.card, styles.targetCard)}>
          <div className={mergeClasses(styles.cardHeader, styles.targetHeader)}>
            <div className={styles.headerContent}>
              <Image
                src="/Fabric_Color_48.svg"
                alt="Microsoft Fabric"
                width={48}
                height={48}
                style={{ flexShrink: 0 }}
              />
              <div><Text size={500} weight="semibold" style={{ color: "#166534" }}>Target</Text><br /><Text size={200} style={{ color: "#16a34a" }}>Microsoft Fabric</Text></div>
            </div>
          </div>
          <div className={styles.cardInnerPadding}>
            <div>
              <Label className={styles.sectionTitle} style={{ color: "#166534" }}>Target Fabric Workspace</Label>
              <Dropdown
                className={styles.truncateDropdown}
                placeholder={isLiteMode() ? "Workspace not required in Lite Mode" : "Select target workspace"}
                value={isLiteMode() ? "" : (fabricWorkspaces.find(w => w.id === selectedWorkspace)?.displayName ?? "")}
                selectedOptions={selectedWorkspace && !isLiteMode() ? [selectedWorkspace] : []}
                onOptionSelect={(_, d) => setSelectedWorkspace(d.optionValue as string)}
                disabled={isLiteMode() || loadingWorkspaces || !isAuthenticated || !fabricCredentials || !tableauCredentials?.TABLEAU_SERVER_URL || isProcessing || isStarting}
                style={{ width: "100%" }}
                positioning="below"
              >
                {loadingWorkspaces ? (
                  <Option key="loading" text="Loading workspaces...">Loading workspaces...</Option>
                ) : fabricWorkspaces.length === 0 ? (
                  <Option disabled key="no-data">No workspaces available</Option>
                ) : (
                  [...fabricWorkspaces]
                    .sort((a, b) => {
                      const nameA = (a.displayName || "").toLowerCase();
                      const nameB = (b.displayName || "").toLowerCase();
                      if (nameA === "my workspace") return -1;
                      if (nameB === "my workspace") return 1;
                      return nameA.localeCompare(nameB);
                    })
                    .map((ws) => {
                      const workbookCount = (ws as any).workbooks ? (ws as any).workbooks.length : 0;
                      return (
                        <Option key={ws.id} value={ws.id} text={ws.displayName || ""}>
                          {ws.displayName} {workbookCount > 0 ? `(${workbookCount} workbooks)` : ""}
                        </Option>
                      );
                    })
                )}
              </Dropdown>
            </div>
            {dataLayerEnabled && (
              <div className={styles.marginTopSpacing}>
                <Label className={styles.sectionTitle} style={{ color: "#166534" }}>Lakehouse</Label>
                <Dropdown
                  className={styles.truncateDropdown}
                  placeholder={loadingLakehouses ? "Loading lakehouses..." : "Select a lakehouse"}
                  value={
                    selectedLakehouse === ""
                      ? "Create New Lakehouse"
                      : lakehouses.find(lh => lh.id === selectedLakehouse)?.displayName ?? ""
                  }
                  selectedOptions={[selectedLakehouse]}
                  onOptionSelect={(_, d) => setSelectedLakehouse(d.optionValue as string)}
                  disabled={!selectedWorkspace || loadingLakehouses || isProcessing || isStarting}
                  style={{ width: "100%" }}
                  positioning="below"
                >
                  <Option key="__create_new__" value="">Create New Lakehouse</Option>
                  {lakehouses.map(lh => (
                    <Option key={lh.id} value={lh.id}>{lh.displayName}</Option>
                  ))}
                </Dropdown>
              </div>
            )}
            <Card className={styles.configCard}>
              <div className={styles.configHeader}><Text weight="semibold" style={{ color: "#1f2937" }}>Target Configuration</Text></div>
              <div>
                <div className={styles.configRow}><span className={styles.labelText}>Workspace:</span><span className={isLiteMode() ? styles.statusGreen : (selectedWorkspace ? styles.statusGreen : styles.statusYellow)}>{isLiteMode() ? "Skipped in Lite Mode ✓" : (selectedWorkspace ? "Configured ✓" : "Not selected ⚠️")}</span></div>
                <div className={styles.configRow}><span className={styles.labelText}>Migration:</span><span className={migrationColorClass}>{migrationText} {migrationIcon}</span></div>
                <div className={styles.configRow}><span className={styles.labelText}>Status:</span><span className={statusClass}>{statusText}</span></div>
              </div>
            </Card>
          </div>
        </Card>
      </div>

      <div className={styles.buttonContainer}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "16px" }}>
          <Button
            appearance="primary"
            size="large"
            className={styles.largeButton}
            icon={isParsingPaused || isValidationPaused ? <CheckmarkCircle24Regular /> : (isStarting || isProcessing ? <Spinner size="tiny" /> : currentRunId ? <ArrowClockwise24Regular /> : <Play24Regular />)}
            onClick={isParsingPaused || isValidationPaused || (currentRunId && !isProcessing && !isStarting) ? handleReload : debouncedStart}
            disabled={isStarting || (isProcessing && !isParsingPaused && !isValidationPaused) || (!isReady && !currentRunId)}
          >
            {isStarting ? "Starting..." : isParsingPaused ? "Quit" : hasAnyGenerationFailure ? "Generation Failed" : isValidationPaused ? "Completed" : isProcessing ? `Processing` : currentRunId ? "Start New Migration" : mode === 'single' ? "Start Assessment" : isLiteMode() ? "Assess" : "Migrate"}
          </Button>

          {isParsingPaused && !hasContinued && !isLiteMode() && (
            <Button
              appearance="primary"
              size="large"
              icon={isResuming ? <Spinner size="tiny" /> : <ArrowRight24Regular />}
              disabled={!isAllParsingDone || isResuming}
              onClick={handleResumeClick}
              className={mergeClasses(styles.largeButton, isAllParsingDone && !isResuming && styles.pulseButton)}
              style={{ paddingLeft: "32px", paddingRight: "32px" }}
            >
              {isResuming ? "Processing..." : "Continue to Full Analysis"}
            </Button>
          )}
        </div>
      </div>


      {migrationStartedLocal && (
        <div style={{ marginTop: "32px" }}>
          <MessageBar
            intent={hasAnyGenerationFailure ? "error" : (isParsingPaused || isValidationPaused ? "success" : (isProcessing ? "info" : "success"))}
            className={styles.successAlert}
          >
            <MessageBarBody>
              <MessageBarTitle>
                {hasAnyGenerationFailure ? "Report Generation Failed" : (isParsingPaused ? (isLiteMode() ? "Extraction Completed" : "Parsing Complete") : (isValidationPaused ? "Generation Complete" : (isProcessing ? "Processing Workbooks..." : (isLiteMode() ? "Extraction Completed" : "Extraction Complete"))))}
              </MessageBarTitle>
              {hasAnyGenerationFailure ? (
                <Text>Report Generation failed. Migration process stopped before the Validation stage. Please review the error in the <strong>Results → Report Generation</strong> tab.</Text>
              ) : isParsingPaused ? (
                isLiteMode() ? (
                  <Text>Extraction Completed</Text>
                ) : (
                  <Text>Detailed analysis and parsing is finished. Click <strong>&quot;Continue to Full Analysis&quot;</strong> in the Results tab to proceed.</Text>
                )
              ) : isValidationPaused ? (
                <Text>Migration successful till Report Generation. Please run the <strong>Validation Agent</strong> in the Results section to see the validation results.</Text>
              ) : isProcessing ? (
                <Text>Orchestrating Agents. Please wait...</Text>
              ) : (
                isLiteMode() ? (
                  <Text>Extraction Completed</Text>
                ) : (
                  <Text>All agents completed successfully. You can review the results below.</Text>
                )
              )}
            </MessageBarBody>
          </MessageBar>
        </div>
      )}

      <div className={styles.subTabsWrapper}>
        <style>{`
          .vl-subtabs-scroll-wrapper::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <TabList
          selectedValue={activeSubTab}
          onTabSelect={(_, data) => { const value = data.value as SubTab; if (value === "results" && !canAccessResults) return; setActiveSubTab(value) }}
          className={mergeClasses(styles.subTabList, "vl-subtabs-scroll-wrapper")}
          appearance="subtle"
        >
          <Tab value="configurations" className={mergeClasses(styles.subTabBase, activeSubTab === "configurations" && styles.subTabSelected)}>Configurations</Tab>
          <Tab value="overview" className={mergeClasses(styles.subTabBase, activeSubTab === "overview" && styles.subTabSelected, !canAccessResults && styles.subTabDisabled)} disabled={!canAccessResults}>Migration Overview</Tab>
          <Tab value="results" className={mergeClasses(styles.subTabBase, activeSubTab === "results" && styles.subTabSelected, !canAccessResults && styles.subTabDisabled)} disabled={!canAccessResults}>Results</Tab>
        </TabList>
      </div>
      {activeSubTab === "configurations" && <ConfigurationsContent />}
      {activeSubTab === "overview" && <MigrationOverview onRequestPdf={() => setIsGeneratingPdf(true)} />}
      {activeSubTab === "results" && <ResultTab />}

      {/* PdfReportRenderer is rendered at MigrationTab level so the minimized
          floating widget remains visible even when the user navigates away from
          the overview sub-tab to results or configurations. */}
      {isGeneratingPdf && (
        <PdfReportRenderer onClose={() => setIsGeneratingPdf(false)} />
      )}
    </div>
  )
}