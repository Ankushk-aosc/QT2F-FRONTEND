"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQlikStore } from "@/stores/qlikStore";
import { useMsal } from "@azure/msal-react";
import { semanticKernelService } from "@/services/semanticKernel.service";
import { QlikService } from "@/services/qlik.service";
import { fabricService, FabricWorkspace } from "@/services/fabric.service";
import { withRetry } from "@/lib/api/retry";
import { QlikMigrationDashboard } from "@/components/Qlik-Migration-Dashboard/QlikMigrationDashboard/page";
import { ConfigurationsAndResults } from "@/components/Qlik-Migration-Dashboard/ConfigurationsAndResults/page";
import { QlikApp, AssessmentData, ParsedData, MappedData, ReportGenerationData } from "@/types/assessment";
import { ConnectorRequired } from "@/components/connectors/ConnectorRequired";
import { StageProgress } from "@/components/ui/StageProgress";
import { FadeIn } from "@/components/ui/FadeIn";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { formatApiErrorMessage } from "@/lib/utils";

export function QlikMigrationTab() {
  const { accounts } = useMsal();
  const { toast } = useToast();
  const {
    apps,
    setApps,
    processStates,
    updateProcessState,
    setIsProcessing,
    isProcessing,
    fetchAgentActions,
  } = useQlikStore();

  // Spaces and Apps Selection
  const [qlikSpaces, setQlikSpaces] = useState<{ id: string; name: string }[]>([]);
  const [selectedQlikSpace, setSelectedQlikSpace] = useState("");
  const [isFetchingApps, setIsFetchingApps] = useState(false);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [showNoAppsPopup, setShowNoAppsPopup] = useState(false);

  // Target Fabric configurations
  const [workspaces, setWorkspaces] = useState<FabricWorkspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(true);
  // Surfaced next to the pickers. Without these a failed load left both
  // dropdowns silently empty, with a full page reload as the only retry.
  const [spacesError, setSpacesError] = useState<string | null>(null);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [configReloadKey, setConfigReloadKey] = useState(0);
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

  // Load the pickers' options. The Qlik connection itself is not loaded here —
  // it is configured in Settings and read from the connector store by the
  // dashboard, which is what stops this screen owning connection state.
  useEffect(() => {
    async function loadConfig() {
      // Both backends are cold-start prone, so a single attempt on mount is
      // what left these dropdowns permanently empty after one transient
      // failure. `withRetry` backs off across the wake-up window.
      setIsLoadingSpaces(true);
      setSpacesError(null);
      try {
        const spaces = await withRetry(() => QlikService.getSpaces(), {
          retries: 3,
          delay: 1500,
        });
        setQlikSpaces(spaces);
      } catch (err) {
        console.error("Failed to load Qlik spaces:", err);
        setSpacesError(
          err instanceof Error ? err.message : "Could not load Qlik spaces."
        );
      } finally {
        setIsLoadingSpaces(false);
      }

      setIsLoadingWorkspaces(true);
      setWorkspacesError(null);
      try {
        const fbWorkspaces = await withRetry(() => fabricService.getWorkspaces(), {
          retries: 3,
          delay: 1500,
        });
        setWorkspaces(fbWorkspaces);
      } catch (err) {
        console.error("Failed to load Fabric workspaces:", err);
        setWorkspacesError(
          err instanceof Error ? err.message : "Could not load Fabric workspaces."
        );
      } finally {
        // Cleared on both paths so a failed fetch stops reading as "loading".
        setIsLoadingWorkspaces(false);
      }
    }

    loadConfig();
  }, [configReloadKey]);

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
      // The Fabric API returns `displayName`; `name` is undefined on these
      // objects, so reading `.name` alone always fell through to the literal
      // "Default Workspace" and that string was sent downstream as the real
      // workspace name.
      const selected = workspaces.find((w) => w.id === selectedWorkspace);
      const workspaceName = selected?.displayName || selected?.name || "Default Workspace";

      // ─── Semantic Kernel Space Orchestration Call ───
      const userEmail = accounts?.[0]?.username || "admin@unified.local";
      if (selectedQlikSpace) {
        try {
          await semanticKernelService.processQlikSpace({
            email: userEmail,
            source_type: "cloud",
            workspace_id: [selectedQlikSpace],
            deployment_type: "fabric",
            fabric_group_id: selectedWorkspace,
          });
        } catch (skErr) {
          console.warn("[QlikMigrationTab] Semantic Kernel Space orchestration notice:", skErr);
        }
      }

      for (let i = 0; i < selectedAppObjects.length; i++) {
        const app = selectedAppObjects[i];
        await processAppSequence(app, workspaceName, selectedQlikSpace || "personal");
      }
    } catch (err: any) {
      setGlobalError(formatApiErrorMessage(err.message));
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
  // `qlikSpaceId` is the Qlik space the app belongs to and is what the
  // Assessment and Parsing APIs mean by `workspace_id`. It is distinct from
  // `workspaceName`, which names the *Fabric* target workspace and was
  // previously being sent as the Qlik workspace id.
  const processAppSequence = async (
    app: QlikApp,
    workspaceName: string,
    qlikSpaceId: string
  ) => {
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
      const unbuildRes = await QlikService.unbuild(appId, app.name);
      const engineData = unbuildRes?.data || unbuildRes;

      // 1. Assessment
      pollLogs("assessment");
      const assessmentData = await QlikService.runAssessment(appId, folderName, qlikSpaceId, app.name, engineData);
      isPolling = false;
      updateProcessState(appId, "assessment", { status: "completed", result: assessmentData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, assessmentData } : r))
      );

      // 2. Parsing
      isPolling = true;
      pollLogs("parsing");
      updateProcessState(appId, "parsing", { status: "running" });
      const parsedData = await QlikService.runParsing(appId, folderName, qlikSpaceId, app.name, engineData);
      isPolling = false;
      updateProcessState(appId, "parsing", { status: "completed", result: parsedData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, parsedData } : r))
      );

      // 3. Mapping
      isPolling = true;
      pollLogs("mapping");
      updateProcessState(appId, "mapping", { status: "running" });
      const mappedData = await QlikService.runMapping(appId, folderName, qlikSpaceId, app.name, engineData);
      isPolling = false;
      updateProcessState(appId, "mapping", { status: "completed", result: mappedData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, mappedData } : r))
      );

      // 4. Report Generation
      isPolling = true;
      pollLogs("reportGeneration");
      updateProcessState(appId, "reportGeneration", { status: "running" });
      const reportGenData = await QlikService.runReportGeneration(appId, folderName, workspaceName, app.name, engineData);
      isPolling = false;
      updateProcessState(appId, "reportGeneration", { status: "completed", result: reportGenData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, reportGenData } : r))
      );

    } catch (err: any) {
      isPolling = false;
      console.error(`Execution failed for ${app.name}:`, err);
      
      // Fail remaining stages with clean error
      const stages = ["assessment", "parsing", "mapping", "reportGeneration"] as const;
      const cleanError = formatApiErrorMessage(err.message);
      stages.forEach((stage) => {
        if (processStates[appId]?.[stage]?.status !== "completed") {
          updateProcessState(appId, stage, { status: "failed", error: cleanError });
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
      <Toaster />
      <ConnectorRequired
        connectorId="qlik"
        description="Configure the Qlik connection once in Settings. Its spaces and applications are discovered automatically and appear here."
      >
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
          isLoadingWorkspaces={isLoadingWorkspaces}
          isLoadingSpaces={isLoadingSpaces}
          spacesError={spacesError}
          workspacesError={workspacesError}
          onRetryConfig={() => setConfigReloadKey((key) => key + 1)}
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
      </ConnectorRequired>
    </FadeIn>
  );
}
