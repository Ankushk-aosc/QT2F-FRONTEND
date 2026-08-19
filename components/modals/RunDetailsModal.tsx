"use client"

import React, { useState, useEffect, useMemo } from "react"
import { X, CheckCircle2, XCircle, Hourglass } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Import your existing components
import { AssessmentTab } from "@/components/tabs/AssessmentTab"
import { ParsingTab } from "@/components/tabs/ParsingTab"
import MappingTab from "@/components/tabs/MappingTab"
import { ReportGenerationTab } from "@/components/tabs/ReportGenerationTab"
import { ValidationTab } from "@/components/tabs/ValidationTab"
import { DataLayerTab } from "@/components/tabs/DataLayerTab"

// Import stores for pre-fetching
import { useAgentStore } from "@/stores/agent.store"
import { useParsingStore } from "@/stores/parsing.store"
import { useMappingStore } from "@/stores/mapping.store"
import { useGenerationStore } from "@/stores/generation.store"
import { useValidationStore } from "@/stores/validation.store"
import { useDatalayerStore } from "@/stores/datalayer.store"

import { isLiteMode } from "@/lib/config"

interface RunDetailsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  runData: any // Flat structure passed from RunHistoryTab
}

export function RunDetailsModal({ isOpen, onOpenChange, runData }: RunDetailsModalProps) {
  const [activeTopTab, setActiveTopTab] = useState("Assessment")

  // Determine which tabs to show based on step statuses
  const lite = isLiteMode()
  const hasStep = (status: string | undefined) => {
    if (!status) return false
    const s = status.trim().toLowerCase()
    return s !== "" &&
      s !== "pending" &&
      s !== "unknown" &&
      s !== "not_run" &&
      s !== "not-run" &&
      s !== "not_started" &&
      s !== "not-started" &&
      !s.includes("skipped")
  }
  const showParsing = hasStep(runData?.parsing_status)
  const showMapping = !lite && hasStep(runData?.mapping_status)
  const showGeneration = !lite && hasStep(runData?.generation_status)
  const showValidation = !lite && (hasStep(runData?.validation_status) || hasStep(runData?.generation_status))

  // Pre-fetch stores
  const fetchAssessmentData = useAgentStore(state => state.fetchAssessmentData)
  const fetchParsingResult = useParsingStore(state => state.fetchParsingResult)
  const fetchMappingResult = useMappingStore(state => state.fetchMappingResult)
  const fetchGenerationResult = useGenerationStore(state => state.fetchGenerationResult)
  const fetchValidationResult = useValidationStore(state => state.fetchValidationResult)
  const fetchDataLayerResult = useDatalayerStore(state => state.fetchDataLayerResult)

  const assessmentData = useAgentStore(state => state.assessmentData)
  const datalayerData = useDatalayerStore(state => state.datalayerData)
  const validationDataMap = useValidationStore(state => state.validationData)

  // Pre-fetch only available agent data when modal opens
  useEffect(() => {
    if (!isOpen || !runData) return

    const projectId = runData.project_id || ""
    const workbookId = runData.workbook_id || ""
    const runId = runData.run_id || ""

    if (!projectId || !workbookId || !runId) return

    console.log(`[RunDetailsModal] Pre-fetching agent data for workbook: ${workbookId}, run: ${runId}`)

    // Only fire fetches for steps that exist in this run
    const fetches: Promise<any>[] = [
      fetchAssessmentData(projectId, workbookId, runId),
    ]
    if (showParsing) fetches.push(fetchParsingResult(projectId, workbookId, runId))

    // Only try DL if it shouldn't be skipped globally via the agent store configuration
    const skipDL = lite || useAgentStore.getState().shouldSkipDataLayer(workbookId)
    if (!skipDL) fetches.push(fetchDataLayerResult(projectId, workbookId, runId))

    if (showMapping) fetches.push(fetchMappingResult(projectId, workbookId, runId))
    if (showGeneration) fetches.push(fetchGenerationResult(projectId, workbookId, runId))

    // Only pre-fetch validation if it has actually run (not just because generation finished)
    const didValidationRun = !lite && hasStep(runData?.validation_status);
    if (didValidationRun) fetches.push(fetchValidationResult(projectId, workbookId, runId))

    Promise.allSettled(fetches).then(results => {
      console.log(`[RunDetailsModal] Pre-fetch complete (${results.length} calls):`, results.map(r => r.status))
    })
  }, [isOpen, runData, fetchAssessmentData, fetchParsingResult, fetchDataLayerResult, fetchMappingResult, fetchGenerationResult, fetchValidationResult, showParsing, showMapping, showGeneration, showValidation, lite])

  // Auto-select the first available tab when modal opens or runData changes
  useEffect(() => {
    if (!isOpen || !runData) return
    // Always default to Assessment since it's always present
    setActiveTopTab("Assessment")
  }, [isOpen, runData, runData?.run_id, runData?.workbook_id])

  const showDataLayerTab = useMemo(() => {
    if (lite || !runData) return false
    const workbookId = runData.workbook_id
    const runId = runData.run_id

    // Check connection type from assessment data
    const assessment = assessmentData[runId]?.[workbookId]
    const connType = (assessment?.connection_type || assessment?.payload?.connection_type || "").toLowerCase()
    const isExtract = connType.includes("extract")

    // Check if Data Layer has results
    const hasDL = !!datalayerData[workbookId]

    return isExtract && hasDL
  }, [lite, runData, assessmentData, datalayerData])

  if (!runData) return null

  const getStatusIcon = (status: string, overrideCompleted?: boolean) => {
    if (overrideCompleted) return <CheckCircle2 size={16} style={{ color: "var(--success)" }} />

    switch (status?.toString().trim().toLowerCase()) {
      case "completed":
      case "success":
      case "done":
      case "generated":
      case "validated":
      case "passed": return <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
      case "failed":
      case "error":
      case "cancelled":
      case "stopped": return <XCircle size={16} style={{ color: "var(--danger)" }} />
      case "running":
      case "processing":
      case "in-progress":
      case "pending": return <Hourglass size={16} style={{ color: "var(--warning)" }} />
      default: return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="run-details-surface">
        <div className="run-details-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="run-details-title">
              {runData.workbook_name ? `${runData.workbook_name} (${runData.project_name || 'Unknown Project'})` : (runData.workbook_id || "Run Details")}
            </span>
            {(runData.execution_level || runData.project_type || runData.workbook_type || runData.site_type) && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                {runData.execution_level && <Badge variant="outline" style={{ fontSize: "11px" }}>Execution: {runData.execution_level}</Badge>}
                {runData.project_type && <Badge variant="outline" style={{ fontSize: "11px" }}>Project: {runData.project_type}</Badge>}
                {runData.workbook_type && <Badge variant="outline" style={{ fontSize: "11px" }}>Workbook: {runData.workbook_type}</Badge>}
                {runData.site_type && <Badge variant="outline" style={{ fontSize: "11px" }}>Site: {runData.site_type}</Badge>}

                {/* Validation Status Badge */}
                {!lite && (() => {
                  // First check live validation store for automatic updates without refresh
                  const rawLiveValidationData = validationDataMap[runData?.workbook_id];
                  // IMPORTANT: Prevent validation state bleeding from other runs!
                  const liveValidationData = (rawLiveValidationData && rawLiveValidationData.run_id === runData?.run_id)
                      ? rawLiveValidationData : undefined;

                  if (liveValidationData) {
                    const liveStatus = (liveValidationData.status || "completed").toLowerCase();
                    if (liveStatus === "failed" || liveStatus === "error") {
                      return <Badge variant="destructive" style={{ fontSize: "11px" }}>Validation: Failed</Badge>;
                    }
                    return <Badge variant="success" style={{ fontSize: "11px" }}>Validation: Passed</Badge>;
                  }

                  const hasGenerationStep = hasStep(runData.generation_status);

                  if (liveValidationData === null) {
                     // If explicitly null, it means we definitely know it hasn't run
                     if (hasGenerationStep) {
                         return <Badge variant="warning" style={{ fontSize: "11px" }}>Validation: Pending</Badge>;
                     }
                     return null;
                  }

                  // Fallback to static runData if store is undefined (still loading or hasn't fetched yet)
                  const valStep = runData.steps?.validation || runData.steps?.["Validation Agent"];
                  const valStatusRaw = (runData.validation_status || (typeof valStep === 'object' ? (valStep.status || valStep.final_status) : valStep) || "").toLowerCase();
                  const hasValidationStep = hasStep(runData.validation_status) || hasStep(typeof valStep === 'string' ? valStep : (valStep?.status || valStep?.final_status));
                  if (hasValidationStep && (valStatusRaw === "failed" || valStatusRaw === "error" || valStatusRaw.includes("fail"))) {
                    return <Badge variant="destructive" style={{ fontSize: "11px" }}>Validation: Failed</Badge>;
                  }
                  if (hasValidationStep && (valStatusRaw === "passed" || valStatusRaw === "success" || valStatusRaw === "completed")) {
                    return <Badge variant="success" style={{ fontSize: "11px" }}>Validation: Passed</Badge>;
                  }
                  if (hasGenerationStep) {
                    return <Badge variant="warning" style={{ fontSize: "11px" }}>Validation: Pending</Badge>;
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
            <X size={24} />
          </Button>
        </div>

        <div className="run-details-tabs-wrapper hide-scrollbar" style={{ overflowX: "auto", whiteSpace: "nowrap", scrollbarWidth: "none" }}>
          <style dangerouslySetInnerHTML={{__html: `
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar [role="tab"]:focus,
            .hide-scrollbar [role="tab"]:focus-visible {
                outline: none !important;
                box-shadow: none !important;
            }
          `}} />
          <Tabs value={activeTopTab} onValueChange={setActiveTopTab}>
            <TabsList>
              <TabsTrigger value="Assessment"><span className="run-details-tab-status">{getStatusIcon(runData.assessment_status)}Assessment</span></TabsTrigger>
              {showParsing && (
                <TabsTrigger value="Parsing"><span className="run-details-tab-status">{getStatusIcon(runData.parsing_status)}Parsing</span></TabsTrigger>
              )}
              {showDataLayerTab && (
                <TabsTrigger value="DataLayer">
                  <span className="run-details-tab-status">
                    {getStatusIcon(runData.datalayer_status, !!datalayerData[runData.workbook_id])}Data Layer
                  </span>
                </TabsTrigger>
              )}
              {showMapping && (
                <TabsTrigger value="Mapping"><span className="run-details-tab-status">{getStatusIcon(runData.mapping_status)}Mapping</span></TabsTrigger>
              )}
              {showGeneration && (
                <TabsTrigger value="Generation"><span className="run-details-tab-status">{getStatusIcon(runData.generation_status)}Report Generation</span></TabsTrigger>
              )}
              {showValidation && (
                <TabsTrigger value="Validation"><span className="run-details-tab-status">{getStatusIcon(runData.validation_status, !!validationDataMap[runData.workbook_id]?.metrics)}Validation</span></TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        <div className="run-details-content">
          {/* Contextual routing to existing tabs — only render tabs that exist in this run */}
          {activeTopTab === "Assessment" && <AssessmentTab selectedWorkbookId={runData.workbook_id} runId={runData.run_id} projectId={runData.project_id} />}
          {activeTopTab === "Parsing" && showParsing && <ParsingTab workbookId={runData.workbook_id} runId={runData.run_id} projectId={runData.project_id} />}
          {activeTopTab === "DataLayer" && <DataLayerTab workbookId={runData.workbook_id} projectId={runData.project_id} runId={runData.run_id} />}
          {activeTopTab === "Mapping" && showMapping && <MappingTab workbookId={runData.workbook_id} runId={runData.run_id} projectId={runData.project_id} />}
          {activeTopTab === "Generation" && showGeneration && (
            <ReportGenerationTab
              workbookId={runData.workbook_id}
              workbookName={runData.workbook_name}
              projectId={runData.project_id}
              runId={runData.run_id}
              workspaceName={runData.folder_name || runData.workspace_name || runData.payload?.folder_name || runData.payload?.workspace_name}
            />
          )}
          {activeTopTab === "Validation" && showValidation && <ValidationTab workbookId={runData.workbook_id} workbookName={runData.workbook_name} runId={runData.run_id} projectId={runData.project_id} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
