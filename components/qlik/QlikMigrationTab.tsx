"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQlikStore } from "@/stores/qlikStore";
import { QlikService } from "@/services/qlik.service";
import { fabricService, FabricWorkspace } from "@/services/fabric.service";
import { QlikMigrationDashboard } from "@/components/Qlik-Migration-Dashboard/QlikMigrationDashboard/page";
import { ConfigurationsAndResults } from "@/components/Qlik-Migration-Dashboard/ConfigurationsAndResults/page";
import { QlikApp, AssessmentData, ParsedData, MappedData, ReportGenerationData } from "@/types/assessment";
import { useUIStore } from "@/stores/ui.store";
import { StageProgress } from "@/components/ui/StageProgress";
import { FadeIn } from "@/components/ui/FadeIn";
import { Toaster } from "@fluentui/react-components";
import { QLIK_TOASTER_ID } from "@/hooks/useQlikToast";

export function QlikMigrationTab() {
  const {
    apps,
    setApps,
    processStates,
    updateProcessState,
    setIsProcessing,
    isProcessing,
    fetchAgentActions,
  } = useQlikStore();

  const workspace = useUIStore((s) => s.workspace);

  // Connection configurations
  const [qlikUrl, setQlikUrl] = useState("https://your-qlik-tenant.us.qlikcloud.com");
  const [originalQlikUrl, setOriginalQlikUrl] = useState("");
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlSuccess, setUrlSuccess] = useState<string | null>(null);

  // Spaces and Apps Selection
  const [qlikSpaces, setQlikSpaces] = useState<{ id: string; name: string }[]>([]);
  const [selectedQlikSpace, setSelectedQlikSpace] = useState("");
  const [isFetchingApps, setIsFetchingApps] = useState(false);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [showNoAppsPopup, setShowNoAppsPopup] = useState(false);

  // Target Fabric configurations
  const [workspaces, setWorkspaces] = useState<FabricWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");

  // Process States
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isProcessCompleted, setIsProcessCompleted] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [isAssessmentTriggered, setIsAssessmentTriggered] = useState(false);
  const [dropdownAppId, setDropdownAppId] = useState("");

  // API Results storage
  const [apiResults, setApiResults] = useState<Array<{
    appId: string;
    appName: string;
    folderName?: string;
    assessmentData?: AssessmentData;
    parsedData?: ParsedData;
    mappedData?: MappedData;
    reportGenData?: ReportGenerationData;
  }>>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownDirection, setDropdownDirection] = useState<"down" | "up">("down");

  // Load Initial Configurations
  useEffect(() => {
    async function loadConfig() {
      try {
        const urlData = await QlikService.getQlikUrl();
        if (urlData?.server_url) {
          setQlikUrl(urlData.server_url);
          setOriginalQlikUrl(urlData.server_url);
        }
      } catch (err) {
        console.warn("Failed to load Qlik URL from server, using default.");
      }

      try {
        const spaces = await QlikService.getSpaces();
        setQlikSpaces(spaces);
      } catch (err) {
        console.error("Failed to load Qlik spaces:", err);
      }

      try {
        const fbWorkspaces = await fabricService.getWorkspaces();
        setWorkspaces(fbWorkspaces);
      } catch (err) {
        console.error("Failed to load Fabric workspaces:", err);
      }
    }

    loadConfig();
  }, []);

  // Fetch Qlik apps when space changes
  useEffect(() => {
    if (!selectedQlikSpace) return;
    async function fetchApps() {
      setIsFetchingApps(true);
      try {
        const spaceApps = await QlikService.getApps(selectedQlikSpace);
        setApps(spaceApps);
        setSelectedApps([]);
      } catch (err) {
        console.error("Failed to load Qlik apps:", err);
      } finally {
        setIsFetchingApps(false);
      }
    }
    fetchApps();
  }, [selectedQlikSpace, setApps]);

  const handleAppSelection = (appId: string) => {
    setSelectedApps((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  };

  const handleRemoveApp = (appId: string) => {
    setSelectedApps((prev) => prev.filter((id) => id !== appId));
  };

  const handleQlikSpaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedQlikSpace(e.target.value);
  };

  const handleWorkspaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedWorkspace(e.target.value);
  };

  const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDropdownAppId(e.target.value);
  };

  const handleSaveUrl = async () => {
    setIsSavingUrl(true);
    setUrlError(null);
    setUrlSuccess(null);
    try {
      await QlikService.saveQlikUrl(qlikUrl);
      setOriginalQlikUrl(qlikUrl);
      setUrlSuccess("URL updated successfully!");
      setIsEditingUrl(false);
    } catch (err: any) {
      setUrlError(err.message || "Failed to save URL");
    } finally {
      setIsSavingUrl(false);
    }
  };

  // Run sequential agent processing
  const handleStartProcessing = async () => {
    if (isProcessCompleted) {
      // Start new processing state
      setSelectedApps([]);
      setApiResults([]);
      setIsProcessCompleted(false);
      setHasProcessed(false);
      setIsAssessmentTriggered(false);
      setDropdownAppId("");
      return;
    }

    setIsProcessing(true);
    setGlobalError(null);
    setIsAssessmentTriggered(true);

    const selectedAppObjects = apps.filter((app) => selectedApps.includes(app.id));

    try {
      const workspaceName = workspaces.find((w) => w.id === selectedWorkspace)?.name || "Default Workspace";

      for (let i = 0; i < selectedAppObjects.length; i++) {
        const app = selectedAppObjects[i];
        await processAppSequence(app, workspaceName);
      }
    } catch (err: any) {
      setGlobalError(err.message || "Processing encountered error.");
    } finally {
      setIsProcessing(false);
      setIsProcessCompleted(true);
      setHasProcessed(true);
      if (selectedApps.length > 0) {
        setDropdownAppId(selectedApps[0]);
      }
    }
  };

  // Single app sequential execution
  const processAppSequence = async (app: QlikApp, workspaceName: string) => {
    const appId = app.id;
    
    // Generate folder name
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").split(".")[0];
    const folderName = `${app.name.replace(/\s+/g, "_")}_${timestamp}`;

    // Initialize state
    updateProcessState(appId, "assessment", { status: "running" });
    updateProcessState(appId, "parsing", { status: "pending" });
    updateProcessState(appId, "mapping", { status: "pending" });
    updateProcessState(appId, "reportGeneration", { status: "pending" });

    // Add initial results shell
    setApiResults((prev) => [
      ...prev.filter((r) => r.appId !== appId),
      { appId, appName: app.name, folderName },
    ]);

    // Active log poller ref
    let isPolling = true;

    // Start logs poller
    const pollLogs = async (agentName: string) => {
      while (isPolling) {
        try {
          await fetchAgentActions(appId, folderName, agentName);
        } catch (e) {
          // Silent log error
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
    };

    try {
      // 0. Unbuild
      await QlikService.unbuild(appId, app.name);

      // 1. Assessment
      pollLogs("assessment");
      const assessmentData = await QlikService.runAssessment(folderName);
      isPolling = false;
      updateProcessState(appId, "assessment", { status: "completed", result: assessmentData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, assessmentData } : r))
      );

      // 2. Parsing
      isPolling = true;
      pollLogs("parsing");
      updateProcessState(appId, "parsing", { status: "running" });
      const parsedData = await QlikService.runParsing(folderName);
      isPolling = false;
      updateProcessState(appId, "parsing", { status: "completed", result: parsedData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, parsedData } : r))
      );

      // 3. Mapping
      isPolling = true;
      pollLogs("mapping");
      updateProcessState(appId, "mapping", { status: "running" });
      const mappedData = await QlikService.runMapping(appId, folderName);
      isPolling = false;
      updateProcessState(appId, "mapping", { status: "completed", result: mappedData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, mappedData } : r))
      );

      // 4. Report Generation
      isPolling = true;
      pollLogs("reportGeneration");
      updateProcessState(appId, "reportGeneration", { status: "running" });
      const reportGenData = await QlikService.runReportGeneration(appId, folderName, workspaceName);
      isPolling = false;
      updateProcessState(appId, "reportGeneration", { status: "completed", result: reportGenData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, reportGenData } : r))
      );

    } catch (err: any) {
      isPolling = false;
      console.error(`Execution failed for ${app.name}:`, err);
      
      // Fail remaining stages
      const stages = ["assessment", "parsing", "mapping", "reportGeneration"] as const;
      stages.forEach((stage) => {
        if (processStates[appId]?.[stage]?.status !== "completed") {
          updateProcessState(appId, stage, { status: "failed", error: err.message || "Execution failed" });
        }
      });
      throw err;
    }
  };

  // Derive the human-readable stage label from current processStates
  const activeStageLabelForUI = useMemo(() => {
    if (!isProcessing) return null;
    const appIds = Object.keys(processStates);
    if (appIds.length === 0) return "Initializing…";
    const latestAppId = appIds[appIds.length - 1];
    const appState = processStates[latestAppId];
    if (appState?.assessment?.status === "running") return "Running Assessment…";
    if (appState?.parsing?.status === "running") return "Parsing QVF files…";
    if (appState?.mapping?.status === "running") return "Mapping to Fabric schema…";
    if (appState?.reportGeneration?.status === "running") return "Generating Power BI reports…";
    return "Processing…";
  }, [isProcessing, processStates]);

  return (
    <FadeIn>
      <Toaster toasterId={QLIK_TOASTER_ID} />
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px" }}>
        <QlikMigrationDashboard
          globalError={globalError}
          isProcessing={isProcessing}
          isProcessCompleted={isProcessCompleted}
          selectedApps={selectedApps}
          selectedQlikSpace={selectedQlikSpace}
          qlikSpaces={qlikSpaces}
          showNoAppsPopup={showNoAppsPopup}
          setShowNoAppsPopup={setShowNoAppsPopup}
          apps={apps}
          hasProcessed={hasProcessed}
          dropdownOpen={dropdownOpen}
          setDropdownOpen={setDropdownOpen}
          dropdownDirection={dropdownDirection}
          setDropdownDirection={setDropdownDirection}
          dropdownRef={dropdownRef}
          selectedWorkspace={selectedWorkspace}
          workspaces={workspaces as any}
          qlikUrl={qlikUrl}
          setQlikUrl={setQlikUrl}
          originalQlikUrl={originalQlikUrl}
          setOriginalQlikUrl={setOriginalQlikUrl}
          error={urlError}
          setError={setUrlError}
          success={urlSuccess}
          setSuccess={setUrlSuccess}
          isEditing={isEditingUrl}
          setIsEditing={setIsEditingUrl}
          isSaving={isSavingUrl}
          setIsSaving={setIsSavingUrl}
          onSaveSuccess={() => {}}
          onQlikSpaceChange={handleQlikSpaceChange}
          onAppSelection={handleAppSelection}
          onRemoveApp={handleRemoveApp}
          onWorkspaceChange={handleWorkspaceChange}
          onStartProcessing={handleStartProcessing}
        />

        {/* Inline progress bar shown only while pipeline is active */}
        {isProcessing && activeStageLabelForUI && (
          <StageProgress
            stageLabel={activeStageLabelForUI}
            hint="This may take several minutes. Please do not close this window."
          />
        )}

        <ConfigurationsAndResults
          isAssessmentTriggered={isAssessmentTriggered}
          dropdownAppId={dropdownAppId}
          onDropdownChange={handleDropdownChange}
          apiResults={apiResults}
          processStates={processStates}
          backendToken="dummy" // Handled client-side automatically by fetchWithAuth
        />
      </div>
    </FadeIn>
  );
}
