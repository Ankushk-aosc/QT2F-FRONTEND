"use client"
import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  Text,
  Badge,
  makeStyles,
  Button,
  tokens,
  mergeClasses,
  Spinner,
  Tooltip,
} from "@fluentui/react-components"
import {
  Dismiss24Regular,
  List20Regular,
  Play24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  Clock24Regular,
  Sparkle20Regular,
  ChevronDown20Regular,
  ChevronRight20Regular,
  PanelLeftContract24Regular,
  PanelLeftExpand24Regular,
} from "@fluentui/react-icons"

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

const useStyles = makeStyles({
  sidebar: {
    width: "100%",
    height: "100%",
    backgroundColor: tokens.colorNeutralBackground1,
    padding: "16px 12px 24px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    overflowY: "auto",
    position: "relative",
    boxSizing: "border-box",
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow16, // Add strong shadow for mobile visibility
    transition: "padding 0.3s ease-in-out",
  },
  sidebarCollapsed: {
    padding: "16px 8px",
    alignItems: "center",
  },
  sidebarToggleButton: {
    marginLeft: "auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "16px",
    fontWeight: 600,
    color: tokens.colorNeutralForeground1,
    cursor: "pointer",
    userSelect: "none",
  },
  summaryContent: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "0 0 12px 4px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: tokens.colorNeutralForeground2,
  },
  statusLabel: {
    flex: 1,
  },
  statusValue: {
    fontWeight: 600,
    minWidth: "32px",
    textAlign: "right",
    color: tokens.colorNeutralForeground1,
  },
  introContainer: {
    fontSize: "13.5px",
    lineHeight: "1.55",
    color: tokens.colorNeutralForeground2,
    minHeight: "80px",
    padding: "8px 0",
  },
  introText: {
    whiteSpace: "pre-wrap",
  },
  appSectionTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    marginTop: "8px",
  },
  appCard: {
    padding: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  appHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "6px",
    flexWrap: "wrap",
  },
  appName: {
    fontSize: "14px",
    fontWeight: 600,
    flex: 1,
    wordBreak: "break-word",
    whiteSpace: "normal",
    lineHeight: "1.4",
  },
  levelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    userSelect: "none",
    transitionProperty: "background-color, box-shadow",
    transitionDuration: tokens.durationNormal,
  },
  levelHeaderSite: {
    backgroundColor: "#eaf4ff",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: "15px",
    fontWeight: 600,
  },
  levelHeaderProject: {
    backgroundColor: "#f5faff",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: "14px",
    fontWeight: 600,
  },
  levelHeaderProjectPromoted: {
    backgroundColor: "#eaf4ff",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: "15px",
    fontWeight: 600,
  },
  levelHeaderHover: {
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      boxShadow: tokens.shadow2,
    },
  },
  countText: {
    fontSize: "13px",
    fontWeight: 400,
    color: tokens.colorNeutralForeground2,
  },
  workbookActions: {
    marginTop: "8px",
    marginLeft: "12px",
    padding: "10px",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: "12.5px",
  },
  actionsHeader: {
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    userSelect: "none",
  },
  waitingContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 0",
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  workbookHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    flex: 1,
  },
  activityItem: {
    padding: "6px 10px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
    marginTop: "4px",
    borderLeft: `4px solid ${tokens.colorBrandForeground1}`,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
})

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

const getStatusColor = (status: string | undefined) => {
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
  const stoppedRunIds = useMonitoringStore.getState().stoppedRunIds || [];
  const isRunStopped = runId ? stoppedRunIds.includes(runId) : false;

  if (isRunStopped) {
    return "Stopped"
  }

  if (hasAnyFailure || app.final_status?.toLowerCase() === "failed" || app.status?.toLowerCase() === "failed") {
    return "Failed"
  }
  // ★ Show "Completed" only when result data has actually loaded in all tabs
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
    }, 40) // Word-by-word feels more premium

    return () => clearTimeout(timeout)
  }, [wordIndex, words, onComplete])

  return (
    <span>
      {displayedText}
      {wordIndex < words.length && <span style={{ animation: "blink 1s step-end infinite" }}>|</span>}
    </span>
  )
}

// ★ Module-level: persists across sidebar open/close — activities typed once are NEVER re-typed
const _typedActivities = new Set<string>()

function AgentActionsBlock({
  app,
  runId,
  agentName,
  title,
  iconColor,
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
  const styles = useStyles()
  const { getActivitiesForWorkbook, datalayerActivitiesDone, assessmentActivitiesDone, parsingActivitiesDone, mappingActivitiesDone, generationActivitiesDone, validationActivitiesDone } = useAgentStore()

  const stoppedRunIds = useMonitoringStore(s => s.stoppedRunIds) || []
  const isRunStopped = runId ? stoppedRunIds.includes(runId) : false

  const [isOpen, setIsOpen] = useState(true)

  const allActivities = getActivitiesForWorkbook(app.workbookId)
  const activities = useMemo(() => {
    const raw = allActivities.filter(a => matchesAgent(a.agent_name, agentName))
    // ★ Deduplicate based on: ${agent}-${timestamp}-${message}
    // This prevents first/last logs of an agent stage from showing twice
    const seen = new Set<string>()
    return raw.filter(act => {
      const key = `${act.agent_name}-${act.created_at}-${act.activity_summary}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [allActivities, agentName])

  // Check if the stage is marked done in the store (even without actual activity records)
  const stageCompletionMap: Record<string, Record<string, boolean>> = {
    assessment: assessmentActivitiesDone,
    parsing: parsingActivitiesDone,
    datalayer: datalayerActivitiesDone,
    mapping: mappingActivitiesDone,
    generation: generationActivitiesDone,
    validation: validationActivitiesDone,
  }
  const isStageDone = !!stageCompletionMap[agentName]?.[app.workbookId]

  // ★ FIX: typingIndex must start at 0 on mount when no activities have loaded yet.
  // On mount: if activities already exist, start at first untyped one.
  const [typingIndex, setTypingIndex] = useState(() => {
    const firstUntyped = activities.findIndex(a => !_typedActivities.has(a.id))
    return firstUntyped === -1 ? activities.length : firstUntyped
  })

  // ★ BATCH REVEAL FIX: When multiple activities arrive at once (e.g. 10 from a single
  // API call), we must NOT type them one-by-one — that would take minutes.
  // Instead: instantly reveal all activities EXCEPT the most recent one, which gets
  // the typing animation. This gives a "live update" feel for the latest entry
  // while showing all historical context immediately.
  useEffect(() => {
    setTypingIndex(prev => {
      if (activities.length <= prev) return prev

      const newActivities = activities.slice(prev)
      if (newActivities.length > 1) {
        // Batch arrival: instantly mark all-but-last as already-typed
        newActivities.slice(0, -1).forEach(a => {
          if (a.id) _typedActivities.add(a.id)
        })
        // Set frontier to the last new activity so it gets the typing animation
        return activities.length - 1
      }
      // Single new activity via live polling: animate normally
      return prev
    })
  }, [activities.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!runId) return null

  return (
    <div className={styles.workbookActions}>
      <div className={styles.actionsHeader} onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkle20Regular fontSize={14} primaryFill={iconColor || tokens.colorBrandForeground1} />
          <span style={{ color: tokens.colorNeutralForeground1 }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {isCompleted && <CheckmarkCircle24Regular fontSize={16} primaryFill={tokens.colorStatusSuccessForeground1} />}
          {isFailed && <ErrorCircle24Regular fontSize={16} primaryFill={tokens.colorPaletteRedForeground1} />}
          {isOpen ? <ChevronDown20Regular fontSize={14} /> : <ChevronRight20Regular fontSize={14} />}
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: "10px" }}>
          {activities.length === 0 ? (
            isStageDone ? (
              <div className={styles.waitingContainer} style={{ fontStyle: "normal", color: tokens.colorNeutralForeground2 }}>
                <CheckmarkCircle24Regular fontSize={16} primaryFill={tokens.colorStatusSuccessForeground1} />
                <span>{title.replace(" Agent", "")} completed.</span>
              </div>
            ) : isRunStopped ? (
              <div className={styles.waitingContainer} style={{ fontStyle: "normal", color: tokens.colorPaletteRedForeground1 }}>
                <Dismiss24Regular fontSize={16} />
                <span>processing terminated</span>
              </div>
            ) : (
              <div className={styles.waitingContainer}>
                <Clock24Regular fontSize={16} />
                <span>Waiting for {title.toLowerCase()}...</span>
                <Spinner size="tiny" />
              </div>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {activities.map((act, index) => {
                // ★ FIX: Show ALL activities that have arrived — don't gate on typingIndex
                // for already-typed ones. Only the "current typing" one is gated.
                const alreadyTyped = _typedActivities.has(act.id)

                // Activities beyond the typing frontier are hidden (not yet revealed)
                if (!alreadyTyped && index > typingIndex) return null

                const isCurrentlyTyping = !alreadyTyped && index === typingIndex

                return (
                  <div
                    key={act.id}
                    className={styles.activityItem}
                    style={iconColor ? { borderLeftColor: iconColor } : undefined}
                  >
                    {alreadyTyped ? (
                      // ★ Already typed before — show instantly as plain text
                      <span>{act.activity_summary}</span>
                    ) : isCurrentlyTyping ? (
                      // ★ New activity — type it out, then mark as done permanently
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
  const styles = useStyles()
  const { activities, parsingTriggered, datalayerTriggered, mappingTriggered, generationTriggered, validationTriggered, shouldSkipDataLayer, assessmentData, currentRunId, manualValidationStarted } = useAgentStore()
  const { migrationPhase } = useDashboardStore()
  const { mode, hasContinued, dataLayerEnabled } = useUIStore()
  const [open, setOpen] = useState(true)

  // ★ Subscribe to result stores to know when actual data has loaded
  const hasAssessment = !!(runId && assessmentData[runId]?.[app.workbookId])
  const hasParsing = !!useParsingStore(s => s.parsingData[app.workbookId])
  const hasDataLayer = !!useDatalayerStore(s => s.datalayerData[app.workbookId])
  const hasMapping = !!useMappingStore(s => s.mappingData[app.workbookId])
  const generationEntry = useGenerationStore(s => s.generationData[app.workbookId])
  const generationRawEntry = useGenerationStore(s => s.generationRaw[app.workbookId])
  const hasGeneration = !!generationEntry
  const hasValidation = !!useValidationStore(s => s.validationData[app.workbookId])
  const hasAllResults = hasParsing && hasMapping && hasGeneration && hasValidation

  // ★ Robust failure detection: check mapped status, raw outer status, AND nested final_response
  const hasGenerationFailed = hasGeneration && (() => {
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

  const isSinglePreContinue = mode === 'single' && !hasContinued;

  const isAssessmentComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false;
    const acts = activities[runId][app.workbookId] || [];
    const assessmentActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'assessment'));
    return assessmentActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()));
  }, [activities, runId, app.workbookId]);

  let displayedStatus = getDisplayedStatus(app, runId, activities, migrationPhase, !shouldSkipDataLayer(app.workbookId), hasAllResults, hasGenerationFailed)

  // ★ For partial processing: show "Extraction Completed" only when parsing result data is loaded
  if (isSinglePreContinue && hasParsing && displayedStatus === "Processing...") {
    displayedStatus = isLiteMode() ? "Extraction Completed" : "Extraction Completed"
  }

  // ★ Replace paused or parsing status with Extraction Completed
  if (displayedStatus.toLowerCase().includes("paused") || displayedStatus.toLowerCase().includes("parsing") || displayedStatus === "Parsing Done") {
    displayedStatus = isLiteMode() ? "Extraction Completed" : "Extraction Completed"
  }

  // ★ Generation failed — always show "Failed" badge regardless of other state
  if (hasGenerationFailed) {
    displayedStatus = "Failed"
  } else {
    // ★ For manual validation pause: show "Completed"
    const isPausedWaitingForValidation = hasGeneration && !manualValidationStarted[app.workbookId]
    if (isPausedWaitingForValidation && displayedStatus === "Processing...") {
      displayedStatus = "Completed"
    }
  }

  const toggleOpen = () => setOpen((prev) => !prev)

  const isParsingComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false;
    const acts = activities[runId][app.workbookId] || [];
    const parsingActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'parsing'));
    return parsingActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()));
  }, [activities, runId, app.workbookId]);

  const isMappingComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false;
    const acts = activities[runId][app.workbookId] || [];
    const mappingActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'mapping'));
    return mappingActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()));
  }, [activities, runId, app.workbookId]);

  const isDataLayerComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false;
    const acts = activities[runId][app.workbookId] || [];
    const dlActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'datalayer'));
    return dlActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()));
  }, [activities, runId, app.workbookId]);

  const isGenerationComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false;
    const acts = activities[runId][app.workbookId] || [];
    const generationActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'generation'));
    return generationActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()));
  }, [activities, runId, app.workbookId]);

  const isValidationComplete = useMemo(() => {
    if (!runId || !activities || !activities[runId]) return false;
    const acts = activities[runId][app.workbookId] || [];
    const validationActs = acts.filter((a: any) => matchesAgent(a.agent_name, 'validation'));
    return validationActs.some((a: any) => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()));
  }, [activities, runId, app.workbookId]);

  const hasDownstream = hasValidation || hasGeneration || hasMapping || isMappingComplete || isDataLayerComplete || isGenerationComplete || isValidationComplete;

  if (displayedStatus === "Completed" || displayedStatus === "Success") {
    if (isLiteMode() && !hasDownstream) {
      displayedStatus = "Extraction Completed"
    } else if (hasValidation) {
      displayedStatus = "Migration Completed"
    } else if (hasGeneration) {
      displayedStatus = "Validation Pending"
    } else {
      displayedStatus = "Migration Completed"
    }
  } else if (isLiteMode() && !hasDownstream && displayedStatus === "Migration Completed") {
    displayedStatus = "Extraction Completed"
  }

  const statusColor = getStatusColor(displayedStatus)

  return (
    <div className={styles.appCard}>
      <div
        className={styles.appHeader}
        onClick={toggleOpen}
        style={{ cursor: "pointer" }}
      >
        <div className={styles.workbookHeader}>
          <Badge
            appearance="filled"
            color={statusColor}
            style={(displayedStatus === "Migration Completed" || displayedStatus === "Extraction Completed") ? { height: "auto", padding: "4px 8px", lineHeight: "1.2" } : undefined}
          >
            {(displayedStatus === "Migration Completed" || displayedStatus === "Extraction Completed") ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span>{displayedStatus === "Migration Completed" ? "Migration" : "Interactive"}</span>
                <span>Completed</span>
              </div>
            ) : (
              displayedStatus
            )}
          </Badge>
          <Text className={styles.appName}>{app.workbookName}</Text>
        </div>
        {open ? <ChevronDown20Regular fontSize={16} /> : <ChevronRight20Regular fontSize={16} />}
      </div>

      <div style={{ display: open ? "block" : "none" }}>
        <AgentActionsBlock
          app={app}
          runId={runId}
          agentName="assessment"
          title="Assessment Agent"
          isCompleted={hasAssessment}
        />

        {isAssessmentComplete && parsingTriggered[app.workbookId] && (
          <AgentActionsBlock
            app={app}
            runId={runId}
            agentName="parsing"
            title="Parsing Agent"
            iconColor="#121513"
            isCompleted={hasParsing}
          />
        )}

        {isParsingComplete && !isSinglePreContinue && mappingTriggered[app.workbookId] && (
          <AgentActionsBlock
            app={app}
            runId={runId}
            agentName="mapping"
            title="Mapping Agent"
            iconColor="#3b82f6"
            isCompleted={hasMapping}
          />
        )}

        {!shouldSkipDataLayer(app.workbookId) && isMappingComplete && !isSinglePreContinue && datalayerTriggered[app.workbookId] && (
          <AgentActionsBlock
            app={app}
            runId={runId}
            agentName="datalayer"
            title="Data Layer Agent"
            iconColor="#6366f1"
            isCompleted={hasDataLayer}
          />
        )}

        {(shouldSkipDataLayer(app.workbookId) ? isMappingComplete : isDataLayerComplete) && !isSinglePreContinue && generationTriggered[app.workbookId] && (
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

        {isGenerationComplete && !isSinglePreContinue && validationTriggered[app.workbookId] && !hasGenerationFailed && (
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
  const styles = useStyles()
  const [open, setOpen] = useState(true)

  const totalWorkbooks = project.workbooks.length
  const totalRunning = project.workbooks.filter((w) => w.status.toLowerCase() === "running").length

  return (
    <div>
      <div
        className={mergeClasses(
          styles.levelHeader,
          isPromoted ? styles.levelHeaderProjectPromoted : styles.levelHeaderProject,
          styles.levelHeaderHover
        )}
        onClick={() => setOpen(!open)}
      >
        <span>{project.name || "Default Project"}</span>
        <Text className={styles.countText}>
          {totalRunning} / {totalWorkbooks}
        </Text>
        {open ? <ChevronDown20Regular fontSize={16} /> : <ChevronRight20Regular fontSize={16} />}
      </div>

      <div
        style={{
          display: open ? "flex" : "none",
          padding: "10px 0 10px 16px",
          flexDirection: "column",
          gap: "12px",
        }}
      >
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
  const styles = useStyles()
  const [open, setOpen] = useState(true)

  const totalWorkbooks = site.projects.reduce((sum, p) => sum + p.workbooks.length, 0)
  const totalRunning = site.projects.reduce(
    (sum, p) => sum + p.workbooks.filter((w) => w.status.toLowerCase() === "running").length,
    0
  )

  return (
    <div>
      <div
        className={mergeClasses(styles.levelHeader, styles.levelHeaderSite, styles.levelHeaderHover)}
        onClick={() => setOpen(!open)}
      >
        <span>{site.name || "Default Site"}</span>
        <Text className={styles.countText}>
          {totalRunning} / {totalWorkbooks}
        </Text>
        {open ? <ChevronDown20Regular fontSize={16} /> : <ChevronRight20Regular fontSize={16} />}
      </div>

      <div
        style={{
          display: open ? "flex" : "none",
          padding: "10px 0 10px 16px",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {site.projects.map((proj) => (
          <ProjectLevel key={proj.name} project={proj} runId={runId} />
        ))}
      </div>
    </div>
  )
}

function TableauSidebarContent({ onClose }: LeftSidebarProps) {
  const styles = useStyles()
  const { setSidebarOpen, mode, hasContinued } = useUIStore()
  const {
    applications,
    runId: dashboardRunId,
    migrationPhase,
    tableauSiteName,
    activeRunStats
  } = useDashboardStore()
  const { currentRunId: agentRunId, activities, assessmentData, generationActivitiesDone } = useAgentStore()
  const isSinglePreContinue = mode === 'single' && !hasContinued


  const runId = agentRunId || dashboardRunId
  const [displayedIntro, setDisplayedIntro] = useState("")

  const introMessage =
    "This agent automatically fetches Tableau Projects & Workbooks and loads them into the system for further processing."

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
  }, [])

  const parsingData = useParsingStore(s => s.parsingData)
  const mappingData = useMappingStore(s => s.mappingData)
  const generationData = useGenerationStore(s => s.generationData)
  const generationRaw = useGenerationStore(s => s.generationRaw)
  const validationData = useValidationStore(s => s.validationData)

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
    const total = activeRunStats ? activeRunStats.total_workbooks : dynamicCounters.total;
    const success = activeRunStats ? Math.max((activeRunStats.total_generation_completed ?? activeRunStats.total_migrated) || 0, dynamicCounters.success) : dynamicCounters.success;
    const failed = activeRunStats ? Math.max(activeRunStats.total_failed || 0, dynamicCounters.failed) : dynamicCounters.failed;
    const cancelled = activeRunStats ? activeRunStats.total_cancelled || 0 : 0;
    
    let running = total - success - failed - cancelled;
    if (running < 0) running = 0;
    
    return {
      total, running, success, failed, cancelled
    };
  }, [activeRunStats, dynamicCounters]);

  const sitesMap = new Map<string, Map<string, { id: string; workbooks: Application[] }>>()
  applications.forEach((app) => {
    const siteKey = tableauSiteName || app.siteName || "Default Site"
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

  const stoppedRunIds = useMonitoringStore(s => s.stoppedRunIds) || [];
  const isRunStopped = runId ? stoppedRunIds.includes(runId) : false;

  let statusMessage: string | null = null
  let messageBg = ""
  let messageBorder = ""
  let messageColor = ""

  if (isRunStopped) {
    statusMessage = "processing terminated"
    messageBg = "#fef2f2"
    messageBorder = "#fca5a5"
    messageColor = "#991b1b"
  } else if (migrationPhase === 'starting') {
    statusMessage = "Processing has been Started."
    messageBg = "#fefce8"
    messageBorder = "#fef08a"
    messageColor = "#854d0e"

  } else if (migrationPhase === 'completed') {
    statusMessage = "Processing has been completed."
    messageBg = "#f0fdf4"
    messageBorder = "#bbf7d0"
    messageColor = "#166534"
  }

  return (
    <>
      <div className={styles.header}>
        <Sparkle20Regular fontSize={20} />
        <span>Migration Summary</span>
        <Tooltip content="Collapse" relationship="label">
          <Button
            appearance="subtle"
            icon={<PanelLeftContract24Regular />}
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse Sidebar"
            className={styles.sidebarToggleButton}
          />
        </Tooltip>
      </div>

      <div className={styles.summaryContent}>
        <div className={styles.statusRow}>
          <List20Regular fontSize={20} primaryFill={tokens.colorBrandForeground1} />
          <Text className={styles.statusLabel}>Total Queue Size:</Text>
          <Text className={styles.statusValue}>{stats.total}</Text>
        </div>
        <div className={styles.statusRow}>
          <Play24Regular primaryFill={tokens.colorStatusWarningForeground1} />
          <Text className={styles.statusLabel}>Pending Migrations:</Text>
          <Text className={styles.statusValue}>{stats.running}</Text>
        </div>
        <div className={styles.statusRow}>
          <CheckmarkCircle24Regular primaryFill={tokens.colorStatusSuccessForeground1} />
          <Text className={styles.statusLabel}>Processed Workbooks:</Text>
          <Text className={styles.statusValue}>{stats.success}</Text>
        </div>
        <div className={styles.statusRow}>
          <ErrorCircle24Regular primaryFill={tokens.colorStatusDangerForeground1} />
          <Text className={styles.statusLabel}>Failed Migrations:</Text>
          <Text className={styles.statusValue}>{stats.failed}</Text>
        </div>
        <div className={styles.statusRow}>
          <Dismiss24Regular fontSize={20} primaryFill={tokens.colorNeutralForeground2} />
          <Text className={styles.statusLabel}>Cancelled Migrations:</Text>
          <Text className={styles.statusValue}>{stats.cancelled}</Text>
        </div>
      </div>
      <div className={styles.introContainer}>
        <div className={styles.introText}>
          {displayedIntro}
          {displayedIntro.length < introMessage.length && (
            <span style={{ animation: "blink 1s step-end infinite", marginLeft: "2px" }}>|</span>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            margin: "16px 0 20px",
            padding: "14px 18px",
            backgroundColor: messageBg,
            border: `1px solid ${messageBorder}`,
            borderRadius: "8px",
            color: messageColor,
            fontWeight: 500,
            fontSize: "14.5px",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          {statusMessage}
        </div>
      )}

      {applications.length > 0 ? (
        <>
          <Text className={styles.appSectionTitle}>Selected Workbooks</Text>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>{content}</div>
        </>
      ) : runId ? (
        <Text style={{ color: tokens.colorNeutralForeground3, textAlign: "center", padding: "20px 0" }}>
          Loading applications...
        </Text>
      ) : null}
    </>
  )
}

function QlikAppLevel({
  app,
  processStatus,
}: {
  app: any
  processStatus: any
}) {
  const [open, setOpen] = useState(false)
  const activities = useQlikStore((s) => s.activities[app.id] || {})

  const steps = ["assessment", "parsing", "mapping", "reportGeneration"] as const
  const completedCount = steps.filter((step) => {
    const s = processStatus?.[step]?.status?.toLowerCase()
    return s === "completed" || s === "success" || s === "done"
  }).length

  const hasFailed = steps.some((step) => {
    const s = processStatus?.[step]?.status?.toLowerCase()
    return s === "failed" || s === "error"
  })

  const progress = (completedCount / steps.length) * 100

  let statusColor: "success" | "warning" | "danger" | "subtle" = "subtle"
  let statusText = "Pending"
  if (hasFailed) {
    statusColor = "danger"
    statusText = "Failed"
  } else if (completedCount === steps.length) {
    statusColor = "success"
    statusText = "Completed"
  } else if (completedCount > 0 || steps.some((step) => processStatus?.[step]?.status?.toLowerCase() === "running")) {
    statusColor = "warning"
    statusText = "Processing"
  }

  return (
    <div style={{ marginBottom: "12px", borderBottom: "1px solid #f0f1f3", paddingBottom: "12px" }}>
      <div 
        style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "8px" }}
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
        <Text style={{ fontWeight: 600, fontSize: "14px", flex: 1 }} truncate>
          {app.name}
        </Text>
        <Badge appearance="filled" color={statusColor as any}>
          {statusText}
        </Badge>
      </div>

      <div style={{ width: "95%", backgroundColor: "#e2e8f0", borderRadius: "9999px", height: "6px", marginTop: "8px", overflow: "hidden" }}>
        <div 
          style={{ 
            backgroundColor: hasFailed ? "#ef4444" : completedCount === steps.length ? "#22c55e" : "#3b82f6", 
            width: `${progress}%`, 
            height: "100%", 
            transition: "width 0.3s ease" 
          }} 
        />
      </div>

      {open && (
        <div style={{ marginLeft: "20px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {steps.map((step) => {
            const stepData = processStatus?.[step] || { status: "pending" }
            const stepStatus = stepData.status?.toLowerCase()
            const stepLogs = activities[step] || []

            let stepColor = "subtle"
            let stepLabel = "Pending"
            if (stepStatus === "completed" || stepStatus === "success" || stepStatus === "done") {
              stepColor = "success"
              stepLabel = "Completed"
            } else if (stepStatus === "running" || stepStatus === "in_progress") {
              stepColor = "warning"
              stepLabel = "Processing"
            } else if (stepStatus === "failed" || stepStatus === "error") {
              stepColor = "danger"
              stepLabel = "Failed"
            }

            const stepDisplayName = step === "reportGeneration" ? "Report Generation" : step.charAt(0).toUpperCase() + step.slice(1)

            return (
              <div key={step} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: "13px", color: "#475569", fontWeight: 500 }}>
                    {stepDisplayName} Agent
                  </Text>
                  <Badge appearance="tint" color={stepColor as any}>
                    {stepLabel}
                  </Badge>
                </div>
                {stepLogs.length > 0 && (
                  <div style={{ paddingLeft: "8px", borderLeft: "2px solid #cbd5e1", fontSize: "11px", color: "#64748b", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {stepLogs.map((log: any, idx: number) => (
                      <div key={idx}>{log.action}</div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function QlikSidebarContent({ onClose }: LeftSidebarProps) {
  const styles = useStyles()
  const { apps, processStates } = useQlikStore()
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  
  const [displayedIntro, setDisplayedIntro] = useState("")
  const introMessage = "This agent automatically fetches Qlik Sense spaces and unbuilds applications for migration."

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
  }, [])

  const stats = useMemo(() => {
    const total = apps.length
    let running = 0
    let success = 0
    let failed = 0
    let pending = 0

    apps.forEach((app) => {
      const states = processStates[app.id] || {}
      const statuses = Object.values(states).map((s: any) => s.status?.toLowerCase())
      if (statuses.includes("failed") || statuses.includes("error")) {
        failed++
      } else if (statuses.includes("running") || statuses.includes("in_progress")) {
        running++
      } else if (statuses.length === 4 && statuses.every((s) => s === "completed" || s === "success" || s === "done")) {
        success++
      } else {
        pending++
      }
    })

    return { total, running, success, failed, pending }
  }, [apps, processStates])

  return (
    <>
      <div className={styles.header}>
        <Sparkle20Regular fontSize={20} />
        <span>Qlik Migration Summary</span>
        <Tooltip content="Collapse" relationship="label">
          <Button
            appearance="subtle"
            icon={<PanelLeftContract24Regular />}
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse Sidebar"
            className={styles.sidebarToggleButton}
          />
        </Tooltip>
      </div>

      <div className={styles.summaryContent}>
        <div className={styles.statusRow}>
          <List20Regular fontSize={20} primaryFill={tokens.colorBrandForeground1} />
          <Text className={styles.statusLabel}>Total Apps Size:</Text>
          <Text className={styles.statusValue}>{stats.total}</Text>
        </div>
        <div className={styles.statusRow}>
          <Play24Regular primaryFill={tokens.colorStatusWarningForeground1} />
          <Text className={styles.statusLabel}>Pending/Running:</Text>
          <Text className={styles.statusValue}>{stats.running + stats.pending}</Text>
        </div>
        <div className={styles.statusRow}>
          <CheckmarkCircle24Regular primaryFill={tokens.colorStatusSuccessForeground1} />
          <Text className={styles.statusLabel}>Processed Apps:</Text>
          <Text className={styles.statusValue}>{stats.success}</Text>
        </div>
        <div className={styles.statusRow}>
          <ErrorCircle24Regular primaryFill={tokens.colorStatusDangerForeground1} />
          <Text className={styles.statusLabel}>Failed Migrations:</Text>
          <Text className={styles.statusValue}>{stats.failed}</Text>
        </div>
      </div>

      <div className={styles.introContainer}>
        <div className={styles.introText}>
          {displayedIntro}
          {displayedIntro.length < introMessage.length && (
            <span style={{ animation: "blink 1s step-end infinite", marginLeft: "2px" }}>|</span>
          )}
        </div>
      </div>

      {apps.length > 0 ? (
        <>
          <Text className={styles.appSectionTitle}>Selected Apps</Text>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "0 16px" }}>
            {apps.map((app) => (
              <QlikAppLevel key={app.id} app={app} processStatus={processStates[app.id]} />
            ))}
          </div>
        </>
      ) : (
        <Text style={{ color: tokens.colorNeutralForeground3, textAlign: "center", padding: "20px 0" }}>
          No applications loaded.
        </Text>
      )}
    </>
  )
}

export function LeftSidebar({ onClose }: LeftSidebarProps) {
  const styles = useStyles()
  const workspace = useUIStore((s) => s.workspace)
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)

  return (
    <div className={mergeClasses(styles.sidebar, !isSidebarOpen && styles.sidebarCollapsed)}>
      {!isSidebarOpen ? (
        <Tooltip content="Expand" relationship="label">
          <Button
            appearance="subtle"
            icon={<PanelLeftExpand24Regular />}
            onClick={() => setSidebarOpen(true)}
            aria-label="Expand Sidebar"
          />
        </Tooltip>
      ) : workspace === "qlik" ? (
        <QlikSidebarContent onClose={onClose} />
      ) : (
        <TableauSidebarContent onClose={onClose} />
      )}
    </div>
  )
}

