"use client"
import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  X,
  List,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Tooltip } from "@/components/ui/tooltip"
import { Spinner } from "@/components/ui/spinner"
import { useUIStore } from "@/stores/ui.store"
import { useQlikStore } from "@/stores/qlikStore"
import { useDashboardStore } from "@/stores/dashboard.store"
import { useAgentStore } from "@/stores/agent.store"
import { useParsingStore } from "@/stores/parsing.store"
import { useMappingStore } from "@/stores/mapping.store"
import { useGenerationStore } from "@/stores/generation.store"
import { useValidationStore } from "@/stores/validation.store"
import { useDatalayerStore } from "@/stores/datalayer.store"
import { useMonitoringStore } from "@/stores/monitoring.store"
import { matchesAgent } from "@/lib/agentNames"
import { isLiteMode } from "@/lib/config"

interface Application {
  id: string
  workbookId: string
  siteName: string
  projectName: string
  projectId: string
  workbookName: string
  status: string
  currentAgent?: string | null
  startTime: Date
  endTime?: Date
  final_status?: string
}

interface ProjectGroup {
  name: string
  id: string
  workbooks: Application[]
}

interface SiteGroup {
  name: string
  projects: ProjectGroup[]
}

interface LeftSidebarProps {
  onClose?: () => void
}

const STATUS_BADGE_VARIANT: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  warning: "warning",
  success: "success",
  danger: "destructive",
  subtle: "secondary",
}

const getStatusColor = (status: string | undefined): "warning" | "success" | "danger" | "subtle" => {
  const s = status?.toLowerCase() || ""
  if (s === "running" || s.includes("processing")) {
    return "warning"
  }
  if (
    s === "success" ||
    s === "completed" ||
    s.includes("interactive") ||
    s.includes("extraction completed") ||
    s.includes("parsing done") ||
    s.includes("validation pending") ||
    s.includes("generation done") ||
    s.includes("migration completed")
  ) {
    return "success"
  }
  if (s === "failed" || s.includes("validation failed")) {
    return "danger"
  }
  return "subtle"
}

const checkAssessmentExists = (app: Application, runId: string | null | undefined, activities: any) => {
  if (!runId || !activities || !activities[runId]) return false
  const acts = activities[runId][app.workbookId] || []
  const assessmentActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'assessment'))
  return assessmentActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
}

const checkParsingExists = (app: Application, runId: string | null | undefined, activities: any) => {
  if (!runId || !activities || !activities[runId]) return false
  const acts = activities[runId][app.workbookId] || []
  const parsingActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'parsing'))
  return parsingActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
}

const checkMappingExists = (app: Application, runId: string | null | undefined, activities: any) => {
  if (!runId || !activities || !activities[runId]) return false
  const acts = activities[runId][app.workbookId] || []
  const mappingActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'mapping'))
  return mappingActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
}

const checkDataLayerExists = (app: Application, runId: string | null | undefined, activities: any) => {
  if (!runId || !activities || !activities[runId]) return false
  const acts = activities[runId][app.workbookId] || []
  const dlActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'datalayer'))
  return dlActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
}

const checkValidationExists = (app: Application, runId: string | null | undefined, activities: any) => {
  if (!runId || !activities || !activities[runId]) return false
  const acts = activities[runId][app.workbookId] || []
  const validationActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'validation'))
  return validationActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
}

const checkGenerationExists = (app: Application, runId: string | null | undefined, activities: any) => {
  if (!runId || !activities || !activities[runId]) return false
  const acts = activities[runId][app.workbookId] || []
  const generationActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'generation'))
  return generationActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
}

const getDisplayedStatus = (
  app: Application,
  runId: string | null | undefined,
  activities: any,
  migrationPhase: string,
  showDataLayer: boolean = true,
  hasAllResults: boolean = false,
  hasAnyFailure: boolean = false
) => {
  const stoppedRunIds = useMonitoringStore.getState().stoppedRunIds || []
  const isRunStopped = runId ? stoppedRunIds.includes(runId) : false

  if (isRunStopped) {
    return "Stopped"
  }

  if (hasAnyFailure || app.final_status?.toLowerCase() === "failed" || app.status?.toLowerCase() === "failed") {
    return "Failed"
  }
  if (hasAllResults) {
    return "Completed"
  } else if (
    checkValidationExists(app, runId, activities) ||
    checkGenerationExists(app, runId, activities) ||
    checkMappingExists(app, runId, activities) ||
    (showDataLayer && checkDataLayerExists(app, runId, activities)) ||
    checkParsingExists(app, runId, activities) ||
    app.final_status?.toLowerCase() === "running" || app.status?.toLowerCase() === "running"
  ) {
    return "Processing..."
  }

  if (app.final_status?.toLowerCase().includes("completed") || app.status?.toLowerCase().includes("completed")) {
    return "Completed"
  }
  return app.final_status || app.status || "Pending"
}

function TypingText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState("")
  const [wordIndex, setWordIndex] = useState(0)
  const words = useMemo(() => text.split(" "), [text])
  const calledRef = useRef(false)

  useEffect(() => {
    if (wordIndex >= words.length) {
      if (onComplete && !calledRef.current) {
        calledRef.current = true
        onComplete()
      }
      return
    }

    const timeout = setTimeout(() => {
      setDisplayedText((prev) => (prev ? prev + " " + words[wordIndex] : words[wordIndex]))
      setWordIndex(wordIndex + 1)
    }, 40)

    return () => clearTimeout(timeout)
  }, [wordIndex, words, onComplete])

  return (
    <span>
      {displayedText}
      {wordIndex < words.length && <span className="animate-pulse">|</span>}
    </span>
  )
}

const _typedActivities = new Set<string>()

function AgentActionsBlock({
  app,
  runId,
  agentName,
  title,
  iconColor = "#2554c7",
  isCompleted,
  isFailed,
}: {
  app: Application
  runId: string | null
  agentName: string
  title: string
  iconColor?: string
  isCompleted?: boolean
  isFailed?: boolean
}) {
  const workspace = useUIStore(s => s.workspace)
  const { getActivitiesForWorkbook, datalayerActivitiesDone, assessmentActivitiesDone, parsingActivitiesDone, mappingActivitiesDone, generationActivitiesDone, validationActivitiesDone } = useAgentStore()
  const qlikActivities = useQlikStore(s => s.activities[app.workbookId])
  const isQlikProcessing = useQlikStore(s => s.isProcessing)

  const stoppedRunIds = useMonitoringStore(s => s.stoppedRunIds)
  const isRunStopped = runId && stoppedRunIds ? stoppedRunIds.includes(runId) : false

  const [isOpen, setIsOpen] = useState(true)

  const activities = useMemo(() => {
    if (workspace === "qlik") {
      let logs: any[] = [];
      if (qlikActivities) {
        if (agentName.toLowerCase() === "generation" || agentName.toLowerCase() === "reportgeneration") {
          logs = qlikActivities["generation"] || qlikActivities["reportGeneration"] || qlikActivities["reportgeneration"] || [];
        } else {
          logs = qlikActivities[agentName] || qlikActivities[agentName.toLowerCase()] || [];
        }
      }

      if (Array.isArray(logs)) {
        return logs.map((log: any, idx: number) => ({
          id: log.id || `${app.workbookId}-${agentName}-${idx}`,
          activity_summary: typeof log === "string" ? log : log.activity_summary || log.action || log.message || log.text || JSON.stringify(log),
          created_at: log.timestamp || log.created_at || new Date().toISOString(),
          agent_name: agentName,
        }))
      }
      return []
    }

    const allActivities = getActivitiesForWorkbook(app.workbookId)
    const raw = allActivities.filter(a => matchesAgent(a.agent_name, agentName))
    const seen = new Set<string>()
    return raw.filter(act => {
      const key = `${act.agent_name}-${act.created_at}-${act.activity_summary}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [workspace, qlikActivities, app.workbookId, agentName, getActivitiesForWorkbook])

  const stageCompletionMap: Record<string, Record<string, boolean>> = {
    assessment: assessmentActivitiesDone,
    parsing: parsingActivitiesDone,
    datalayer: datalayerActivitiesDone,
    mapping: mappingActivitiesDone,
    generation: generationActivitiesDone,
    validation: validationActivitiesDone,
  }
  const isAgentCompleted = isCompleted !== undefined ? isCompleted : stageCompletionMap[agentName]?.[app.workbookId]

  const isCurrentAgentRunning = activities.length > 0 && !isAgentCompleted && !isRunStopped && (workspace === "qlik" ? isQlikProcessing : true)

  const [typingIndex, setTypingIndex] = useState(() => {
    const firstUntyped = activities.findIndex(a => !_typedActivities.has(a.id))
    return firstUntyped === -1 ? activities.length : firstUntyped
  })

  useEffect(() => {
    setTypingIndex(prev => {
      if (activities.length <= prev) return prev

      const newActivities = activities.slice(prev)
      if (newActivities.length > 1) {
        newActivities.slice(0, -1).forEach(a => {
          if (a.id) _typedActivities.add(a.id)
        })
        return activities.length - 1
      }
      return prev
    })
  }, [activities.length])

  return (
    <div className="mt-2 ml-3 rounded-lg border border-border bg-surface-subtle p-2.5 text-xs">
      <div
        className="flex cursor-pointer select-none items-center justify-between font-semibold text-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} style={{ color: iconColor }} />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isCompleted && <CheckCircle2 size={16} className="text-success" />}
          {isFailed && <XCircle size={16} className="text-destructive" />}
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {isOpen && (
        <div className="mt-2.5">
          {activities.length === 0 ? (
            isAgentCompleted ? (
              <div className="flex items-center gap-2 py-1 text-muted-foreground">
                <CheckCircle2 size={16} className="text-success" />
                <span>{title.replace(" Agent", "")} completed.</span>
              </div>
            ) : isRunStopped ? (
              <div className="flex items-center gap-2 py-1 text-destructive">
                <X size={16} />
                <span>processing terminated</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-1 italic text-muted-foreground">
                <Clock size={16} />
                <span>Waiting for {title.toLowerCase()}...</span>
                <Spinner size="tiny" />
              </div>
            )
          ) : (
            <div className="flex flex-col gap-1.5">
              {activities.map((act, index) => {
                const alreadyTyped = _typedActivities.has(act.id)
                if (!alreadyTyped && index > typingIndex) return null
                const isCurrentlyTyping = !alreadyTyped && index === typingIndex

                return (
                  <div
                    key={act.id}
                    className="break-words rounded-md bg-surface py-1.5 px-2.5 border-l-4"
                    style={{ borderLeftColor: iconColor }}
                  >
                    {alreadyTyped ? (
                      <span>{act.activity_summary}</span>
                    ) : isCurrentlyTyping ? (
                      <TypingText
                        text={act.activity_summary}
                        onComplete={() => {
                          _typedActivities.add(act.id)
                          setTypingIndex(index + 1)
                        }}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WorkbookLevel({
  app,
  runId,
}: {
  app: Application
  runId: string | null
}) {
  const workspace = useUIStore(s => s.workspace)
  const { activities, parsingTriggered, datalayerTriggered, mappingTriggered, generationTriggered, validationTriggered, shouldSkipDataLayer, assessmentData, manualValidationStarted } = useAgentStore()

  // Safe Zustand selectors returning stable references
  const qlikProcessStates = useQlikStore(s => s.processStates[app.workbookId])
  const isQlikProcessing = useQlikStore(s => s.isProcessing)
  const { migrationPhase } = useDashboardStore()
  const { mode, hasContinued } = useUIStore()
  const [open, setOpen] = useState(true)

  // Unconditional hook subscriptions for Tableau
  const hasTableauParsing = useParsingStore(s => !!s.parsingData[app.workbookId])
  const hasTableauDataLayer = useDatalayerStore(s => !!s.datalayerData[app.workbookId])
  const hasTableauMapping = useMappingStore(s => !!s.mappingData[app.workbookId])
  const generationEntry = useGenerationStore(s => s.generationData[app.workbookId])
  const generationRawEntry = useGenerationStore(s => s.generationRaw[app.workbookId])
  const hasTableauValidation = useValidationStore(s => !!s.validationData[app.workbookId])

  // Unconditional useMemo hooks
  const isTableauAssessmentComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false
    const acts = activities[runId][app.workbookId] || []
    const assessmentActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'assessment'))
    return assessmentActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
  }, [activities, runId, app.workbookId])

  const isTableauParsingComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false
    const acts = activities[runId][app.workbookId] || []
    const parsingActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'parsing'))
    return parsingActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
  }, [activities, runId, app.workbookId])

  const isTableauMappingComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false
    const acts = activities[runId][app.workbookId] || []
    const mappingActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'mapping'))
    return mappingActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
  }, [activities, runId, app.workbookId])

  const isTableauGenerationComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false
    const acts = activities[runId][app.workbookId] || []
    const generationActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'generation'))
    return generationActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
  }, [activities, runId, app.workbookId])

  const isTableauValidationComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false
    const acts = activities[runId][app.workbookId] || []
    const validationActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'validation'))
    return validationActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
  }, [activities, runId, app.workbookId])

  // Determine stage completion for Qlik vs Tableau
  const hasAssessment = workspace === "qlik"
    ? ["completed", "success"].includes(qlikProcessStates?.assessment?.status?.toLowerCase() || "")
    : !!(runId && assessmentData[runId]?.[app.workbookId])

  const hasParsing = workspace === "qlik"
    ? ["completed", "success"].includes(qlikProcessStates?.parsing?.status?.toLowerCase() || "")
    : hasTableauParsing

  const hasDataLayer = workspace === "qlik"
    ? false
    : hasTableauDataLayer

  const hasMapping = workspace === "qlik"
    ? ["completed", "success"].includes(qlikProcessStates?.mapping?.status?.toLowerCase() || "")
    : hasTableauMapping

  const hasGeneration = workspace === "qlik"
    ? ["completed", "success"].includes(qlikProcessStates?.reportGeneration?.status?.toLowerCase() || "")
    : !!generationEntry

  const hasValidation = workspace === "qlik"
    ? false
    : hasTableauValidation

  const hasAllResults = workspace === "qlik"
    ? (hasAssessment && hasParsing && hasMapping && hasGeneration)
    : (hasParsing && hasMapping && hasGeneration && hasValidation)

  const hasGenerationFailed = workspace === "qlik"
    ? qlikProcessStates?.reportGeneration?.status?.toLowerCase() === "failed" || qlikProcessStates?.reportGeneration?.status?.toLowerCase() === "error"
    : hasGeneration && (() => {
        const mappedStatus = (generationEntry?.status || "").toLowerCase()
        const rawOuterStatus = (generationRawEntry?.status || "").toLowerCase()
        const rawFinalStatus = (generationRawEntry?.payload?.final_response?.status ||
          generationRawEntry?.final_response?.status || "").toLowerCase()
        return (
          mappedStatus === 'failed' || mappedStatus === 'error' ||
          rawOuterStatus === 'failed' || rawOuterStatus === 'error' ||
          rawFinalStatus === 'failed' || rawFinalStatus === 'error'
        )
      })()

  const isSinglePreContinue = mode === 'single' && !hasContinued

  const isAssessmentComplete = workspace === "qlik"
    ? hasAssessment
    : isTableauAssessmentComplete

  let displayedStatus = workspace === "qlik"
    ? (app.status === "completed" ? "Migration Completed" : app.status === "running" ? "Processing..." : app.status === "failed" ? "Failed" : "Pending")
    : getDisplayedStatus(app, runId, activities, migrationPhase, !shouldSkipDataLayer(app.workbookId), hasAllResults, hasGenerationFailed)

  if (isSinglePreContinue && hasParsing && displayedStatus === "Processing...") {
    displayedStatus = "Extraction Completed"
  }

  if (hasGenerationFailed) {
    displayedStatus = "Failed"
  } else {
    const isPausedWaitingForValidation = hasGeneration && !manualValidationStarted[app.workbookId]
    if (isPausedWaitingForValidation && displayedStatus === "Processing...") {
      displayedStatus = "Completed"
    }
  }

  const toggleOpen = () => setOpen((prev) => !prev)

  const isParsingComplete = workspace === "qlik"
    ? hasParsing
    : isTableauParsingComplete

  const isMappingComplete = workspace === "qlik"
    ? hasMapping
    : isTableauMappingComplete

  const isGenerationComplete = workspace === "qlik"
    ? hasGeneration
    : isTableauGenerationComplete

  const isValidationComplete = workspace === "qlik"
    ? false
    : isTableauValidationComplete

  const statusColor = getStatusColor(displayedStatus)
  const isMultilineBadge = displayedStatus === "Migration Completed" || displayedStatus === "Extraction Completed"

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex cursor-pointer items-start justify-between gap-2" onClick={toggleOpen}>
        <div className="flex flex-1 items-center gap-2">
          <Badge variant={STATUS_BADGE_VARIANT[statusColor]} className={isMultilineBadge ? "flex-col !items-center px-2 py-1 leading-tight" : undefined}>
            {isMultilineBadge ? (
              <span className="flex flex-col items-center">
                <span>{displayedStatus === "Migration Completed" ? "Migration" : "Extraction"}</span>
                <span>Completed</span>
              </span>
            ) : (
              displayedStatus
            )}
          </Badge>
          <span className="flex-1 break-words text-sm font-semibold leading-snug text-foreground">{app.workbookName}</span>
        </div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>

      <div className={open ? "block" : "hidden"}>
        <AgentActionsBlock
          app={app}
          runId={runId}
          agentName="assessment"
          title="Assessment Agent"
          isCompleted={hasAssessment}
        />

        {(isAssessmentComplete || (workspace === "qlik" && (hasParsing || qlikProcessStates?.parsing?.status === "running"))) && (
          <AgentActionsBlock
            app={app}
            runId={runId}
            agentName="parsing"
            title="Parsing Agent"
            iconColor="#0f172a"
            isCompleted={hasParsing}
          />
        )}

        {(isParsingComplete || (workspace === "qlik" && (hasMapping || qlikProcessStates?.mapping?.status === "running"))) && (
          <AgentActionsBlock
            app={app}
            runId={runId}
            agentName="mapping"
            title="Mapping Agent"
            iconColor="#2554c7"
            isCompleted={hasMapping}
          />
        )}

        {workspace !== "qlik" && !shouldSkipDataLayer(app.workbookId) && isMappingComplete && !isSinglePreContinue && datalayerTriggered[app.workbookId] && (
          <AgentActionsBlock
            app={app}
            runId={runId}
            agentName="datalayer"
            title="Data Layer Agent"
            iconColor="#6366f1"
            isCompleted={hasDataLayer}
          />
        )}

        {(isMappingComplete || (workspace === "qlik" && (hasGeneration || qlikProcessStates?.reportGeneration?.status === "running"))) && (
          <AgentActionsBlock
            app={app}
            runId={runId}
            agentName="generation"
            title="Report Generation Agent"
            iconColor="#10b981"
            isCompleted={hasGeneration && !hasGenerationFailed}
            isFailed={hasGenerationFailed}
          />
        )}

        {workspace !== "qlik" && isGenerationComplete && !isSinglePreContinue && validationTriggered[app.workbookId] && !hasGenerationFailed && (
          <AgentActionsBlock
            app={app}
            runId={runId}
            agentName="validation"
            title="Validation Agent"
            iconColor="#8b5cf6"
            isCompleted={hasValidation}
          />
        )}
      </div>
    </div>
  )
}

function ProjectLevel({
  project,
  isPromoted = false,
  runId,
}: {
  project: ProjectGroup
  isPromoted?: boolean
  runId: string | null
}) {
  const [open, setOpen] = useState(true)

  const totalWorkbooks = project.workbooks.length
  const totalRunning = project.workbooks.filter((w) => w.status.toLowerCase() === "running").length

  return (
    <div>
      <div
        className={[
          "flex cursor-pointer select-none items-center justify-between rounded-lg border border-border px-3 py-2.5 font-semibold transition-colors hover:shadow-xs",
          isPromoted ? "bg-primary-subtle text-[15px]" : "bg-surface-subtle text-sm",
        ].join(" ")}
        onClick={() => setOpen(!open)}
      >
        <span>{project.name || "Default Project"}</span>
        <span className="text-sm font-normal text-muted-foreground">
          {totalRunning} / {totalWorkbooks}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>

      <div className={["flex-col gap-3 py-2.5 pl-4", open ? "flex" : "hidden"].join(" ")}>
        {project.workbooks.map((wb) => (
          <WorkbookLevel key={wb.id} app={wb} runId={runId} />
        ))}
      </div>
    </div>
  )
}

function SiteLevel({
  site,
  runId,
}: {
  site: SiteGroup
  runId: string | null
}) {
  const [open, setOpen] = useState(true)

  const totalWorkbooks = site.projects.reduce((sum, p) => sum + p.workbooks.length, 0)
  const totalRunning = site.projects.reduce(
    (sum, p) => sum + p.workbooks.filter((w) => w.status.toLowerCase() === "running").length,
    0
  )

  return (
    <div>
      <div
        className="flex cursor-pointer select-none items-center justify-between rounded-lg border border-border bg-primary-subtle px-3 py-2.5 text-[15px] font-semibold transition-colors hover:shadow-xs"
        onClick={() => setOpen(!open)}
      >
        <span>{site.name || "Default Site"}</span>
        <span className="text-sm font-normal text-muted-foreground">
          {totalRunning} / {totalWorkbooks}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>

      <div className={["flex-col gap-3 py-2.5 pl-4", open ? "flex" : "hidden"].join(" ")}>
        {site.projects.map((proj) => (
          <ProjectLevel key={proj.name} project={proj} runId={runId} />
        ))}
      </div>
    </div>
  )
}

export function LeftSidebar({ onClose }: LeftSidebarProps) {
  const { isSidebarOpen, setSidebarOpen, mode, hasContinued, workspace } = useUIStore()

  // Tableau Store Data
  const {
    applications: tableauApps,
    runId: dashboardRunId,
    migrationPhase,
    tableauSiteName,
    activeRunStats
  } = useDashboardStore()
  const { currentRunId: agentRunId, activities, assessmentData, generationActivitiesDone } = useAgentStore()
  const isSinglePreContinue = mode === 'single' && !hasContinued

  // Qlik Store Data
  const qlikApps = useQlikStore((s) => s.apps)
  const selectedQlikApps = useQlikStore((s) => s.selectedApps)
  const qlikProcessStates = useQlikStore((s) => s.processStates)
  const isQlikProcessing = useQlikStore((s) => s.isProcessing)
  const isQlikProcessCompleted = useQlikStore((s) => s.isProcessCompleted)

  const runId = agentRunId || dashboardRunId
  const [displayedIntro, setDisplayedIntro] = useState("")

  const introMessage = workspace === "qlik"
    ? "This agent automatically discovers Qlik Sense Spaces & Applications and loads them into the pipeline for Microsoft Fabric migration."
    : "This agent automatically fetches Tableau Projects & Workbooks and loads them into the system for further processing."

  useEffect(() => {
    setDisplayedIntro("")
    let i = 0
    const interval = setInterval(() => {
      setDisplayedIntro((prev) => {
        if (i < introMessage.length) {
          i++
          return introMessage.slice(0, i)
        }
        clearInterval(interval)
        return prev
      })
    }, 35)

    return () => clearInterval(interval)
  }, [introMessage])

  const parsingData = useParsingStore(s => s.parsingData)
  const mappingData = useMappingStore(s => s.mappingData)
  const generationData = useGenerationStore(s => s.generationData)
  const generationRaw = useGenerationStore(s => s.generationRaw)
  const validationData = useValidationStore(s => s.validationData)

  // Map Qlik apps to Application interface if workspace is qlik
  const applications: Application[] = useMemo(() => {
    if (workspace === "qlik") {
      let targetQlikApps = qlikApps || []
      if (selectedQlikApps.length > 0) {
        targetQlikApps = targetQlikApps.filter((qa) => selectedQlikApps.includes(qa.id))
      } else if (isQlikProcessing || isQlikProcessCompleted) {
        targetQlikApps = targetQlikApps.filter((qa) => {
          const states = qlikProcessStates[qa.id]
          return states && Object.values(states).some((s: any) => s?.status && s.status !== "pending")
        })
      } else {
        // No apps selected yet and not running: don't flood queue with unselected apps
        targetQlikApps = []
      }

      return targetQlikApps.map((qa) => {
        const states = qlikProcessStates[qa.id] || {}
        const statuses = Object.values(states).map((s: any) => s?.status?.toLowerCase())
        let status = "pending"
        if (statuses.includes("failed") || statuses.includes("error")) {
          status = "failed"
        } else if (statuses.includes("running") || statuses.includes("in_progress")) {
          status = "running"
        } else if (statuses.length >= 4 && statuses.every((s) => s === "completed" || s === "success" || s === "done")) {
          status = "completed"
        }
        return {
          id: qa.id,
          workbookId: qa.id,
          siteName: (qa as any).spaceName || "Qlik Space",
          projectName: (qa as any).spaceName || "Applications",
          projectId: (qa as any).spaceId || "qlik-space",
          workbookName: qa.name,
          status,
          startTime: new Date(),
        }
      })
    }
    return tableauApps
  }, [workspace, qlikApps, selectedQlikApps, qlikProcessStates, isQlikProcessing, isQlikProcessCompleted, tableauApps])

  const dynamicCounters = useMemo(() => {
    let running = 0
    let success = 0
    let failed = 0
    let queued = 0

    applications.forEach((app) => {
      const wbId = app.workbookId
      const pData = parsingData[wbId]
      const mData = mappingData[wbId]
      const gData = generationData[wbId]
      const gRaw = generationRaw[wbId]
      const vData = validationData[wbId]

      const hasAllResults = !!pData && !!mData && !!gData
      const hasGenerationFailedByTimeout = generationActivitiesDone[wbId] === true && !gData

      const hasAnyFailure =
        hasGenerationFailedByTimeout ||
        (gData?.status?.toLowerCase() === 'failed') ||
        (gData?.status?.toLowerCase() === 'error') ||
        (gRaw?.status?.toLowerCase() === 'failed') ||
        (gRaw?.payload?.final_response?.status?.toLowerCase() === 'error') ||
        (vData?.status?.toLowerCase() === 'failed') ||
        (app.status?.toLowerCase() === 'failed')

      if (hasAnyFailure) {
        failed++
      } else if (hasAllResults || app.final_status?.toLowerCase().includes("completed") || app.status?.toLowerCase().includes("completed") || app.status?.toLowerCase() === "success" || app.final_status?.toLowerCase() === "success") {
        success++
      } else if (isSinglePreContinue && (runId && assessmentData[runId]?.[app.workbookId])) {
        success++
      } else {
        const s = (app.final_status || app.status)?.toLowerCase()
        if (s === "running" || checkParsingExists(app, runId, activities) || checkMappingExists(app, runId, activities)) {
          running++
        } else {
          queued++
        }
      }
    })

    return { total: applications.length, running, success, failed, queued }
  }, [applications, activities, runId, isSinglePreContinue, parsingData, mappingData, generationData, generationRaw, validationData, assessmentData])

  const stats = useMemo(() => {
    const total = activeRunStats ? activeRunStats.total_workbooks : dynamicCounters.total
    const success = activeRunStats ? Math.max((activeRunStats.total_generation_completed ?? activeRunStats.total_migrated) || 0, dynamicCounters.success) : dynamicCounters.success
    const failed = activeRunStats ? Math.max(activeRunStats.total_failed || 0, dynamicCounters.failed) : dynamicCounters.failed
    const cancelled = activeRunStats ? activeRunStats.total_cancelled || 0 : 0

    let running = total - success - failed - cancelled
    if (running < 0) running = 0

    return {
      total, running, success, failed, cancelled
    }
  }, [activeRunStats, dynamicCounters])

  const sitesMap = new Map<string, Map<string, { id: string; workbooks: Application[] }>>()
  applications.forEach((app) => {
    const siteKey = (workspace === "tableau" ? tableauSiteName : null) || app.siteName || "Default Site"
    const projectKey = app.projectName || "Default Project"
    if (!sitesMap.has(siteKey)) sitesMap.set(siteKey, new Map())
    const projects = sitesMap.get(siteKey)!
    if (!projects.has(projectKey)) {
      projects.set(projectKey, { id: app.projectId || "", workbooks: [] })
    }
    projects.get(projectKey)!.workbooks.push(app)
  })

  const sites: SiteGroup[] = Array.from(sitesMap.entries()).map(([siteName, projMap]) => ({
    name: siteName,
    projects: Array.from(projMap.entries()).map(([projName, data]) => ({
      name: projName,
      id: data.id,
      workbooks: data.workbooks,
    })),
  }))

  let content: React.ReactNode = null
  if (applications.length > 0) {
    if (sites.length === 1) {
      const singleSite = sites[0]
      if (singleSite.projects.length === 1) {
        content = <ProjectLevel project={singleSite.projects[0]} isPromoted={true} runId={runId} />
      } else {
        content = <SiteLevel site={singleSite} runId={runId} />
      }
    } else {
      content = sites.map((site) => <SiteLevel key={site.name} site={site} runId={runId} />)
    }
  }

  const stoppedRunIds = useMonitoringStore(s => s.stoppedRunIds) || []
  const isRunStopped = runId ? stoppedRunIds.includes(runId) : false

  let statusMessage: string | null = null
  let messageClasses = ""

  if (isRunStopped) {
    statusMessage = "processing terminated"
    messageClasses = "bg-destructive-subtle border-destructive/30 text-destructive"
  } else if (migrationPhase === 'starting' || (workspace === "qlik" && isQlikProcessing)) {
    statusMessage = "Processing has been Started."
    messageClasses = "bg-warning-subtle border-warning/30 text-warning"
  } else if (migrationPhase === 'completed') {
    statusMessage = "Processing has been completed."
    messageClasses = "bg-success-subtle border-success/30 text-success"
  }

  return (
    <div className={["flex h-full w-full flex-col gap-4 overflow-y-auto border-r border-border bg-surface py-4 shadow-card transition-[padding]", isSidebarOpen ? "px-3 pb-6" : "items-center px-2 py-4"].join(" ")}>
      {isSidebarOpen ? (
        <>
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles size={20} className="text-primary" />
            <span>Migration Summary</span>
            <Tooltip content="Collapse Sidebar" relationship="label">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Collapse Sidebar"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
              >
                <PanelLeftClose size={18} />
              </button>
            </Tooltip>
          </div>

          <div className="flex flex-col gap-2.5 border-b border-border pb-3 pl-1">
            <div className="flex items-center gap-2.5 text-sm text-secondary-foreground">
              <List size={20} className="text-primary" />
              <span className="flex-1">Total Queue Size:</span>
              <span className="min-w-8 text-right font-semibold text-foreground">{stats.total}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-secondary-foreground">
              <Play size={20} className="text-warning" />
              <span className="flex-1">Pending Migrations:</span>
              <span className="min-w-8 text-right font-semibold text-foreground">{stats.running}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-secondary-foreground">
              <CheckCircle2 size={20} className="text-success" />
              <span className="flex-1">
                {workspace === "qlik" ? "Processed Apps:" : "Processed Workbooks:"}
              </span>
              <span className="min-w-8 text-right font-semibold text-foreground">{stats.success}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-secondary-foreground">
              <XCircle size={20} className="text-destructive" />
              <span className="flex-1">Failed Migrations:</span>
              <span className="min-w-8 text-right font-semibold text-foreground">{stats.failed}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-secondary-foreground">
              <X size={20} className="text-muted-foreground" />
              <span className="flex-1">Cancelled Migrations:</span>
              <span className="min-w-8 text-right font-semibold text-foreground">{stats.cancelled}</span>
            </div>
          </div>

          <div className="min-h-20 py-2 text-[13.5px] leading-relaxed text-secondary-foreground">
            <span className="whitespace-pre-wrap">
              {displayedIntro}
              {displayedIntro.length < introMessage.length && <span className="ml-0.5 animate-pulse">|</span>}
            </span>
          </div>

          {statusMessage && (
            <div className={["rounded-lg border px-4.5 py-3.5 text-center text-sm font-medium shadow-xs", messageClasses].join(" ")}>
              {statusMessage}
            </div>
          )}

          {applications.length > 0 ? (
            <>
              <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {workspace === "qlik" ? "Selected Applications" : "Selected Workbooks"}
              </span>
              <div className="flex flex-col gap-3">{content}</div>
            </>
          ) : runId ? (
            <p className="py-5 text-center text-muted-foreground">Loading applications...</p>
          ) : null}
        </>
      ) : (
        <Tooltip content="Expand Sidebar" relationship="label">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Expand Sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
          >
            <PanelLeftOpen size={18} />
          </button>
        </Tooltip>
      )}
    </div>
  )
}
