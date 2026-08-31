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
import { useAgentStore } from "@/stores/agent.store";
import { useDashboardStore } from "@/stores/dashboard.store";
import { useUIStore } from "@/stores/ui.store";
import { useParsingStore, mapParsingPayload } from "@/stores/parsing.store";
import { useMappingStore } from "@/stores/mapping.store";
import { useGenerationStore } from "@/stores/generation.store";
import { useAuthStore } from "@/stores/auth.store";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

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
  const [qlikUrl, setQlikUrl] = useState("");
  const [originalQlikUrl, setOriginalQlikUrl] = useState("");
  const [migrationScope, setMigrationScope] = useState<"apps" | "spaces" | "sites">("apps");
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [qlikConnectionId, setQlikConnectionId] = useState("");

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

  // One lookup per Fabric workspace per run, not once per app -- validation
  // needs a lakehouse to check the migrated data against, and there's no
  // lakehouse picker in this UI yet, so the first lakehouse found in the
  // selected target workspace is used (mirrors the same "default" pattern
  // used for the Qlik connection when none is explicitly selected).
  const lakehouseCacheRef = useRef<Map<string, string | null>>(new Map());
  const resolveLakehouseId = async (fabricWorkspaceId: string): Promise<string | null> => {
    if (!fabricWorkspaceId) return null;
    const cache = lakehouseCacheRef.current;
    if (cache.has(fabricWorkspaceId)) return cache.get(fabricWorkspaceId) ?? null;
    try {
      const lakehouses = await fabricService.getLakehouses(fabricWorkspaceId);
      const id = lakehouses?.[0]?.id || null;
      cache.set(fabricWorkspaceId, id);
      return id;
    } catch (e) {
      console.warn("[QlikMigrationTab] Failed to resolve Lakehouse for validation:", e);
      cache.set(fabricWorkspaceId, null);
      return null;
    }
  };

  // Load the pickers' options. The Qlik connection itself is not loaded here —
  // it is configured in Settings and read from the connector store by the
  // dashboard, which is what stops this screen owning connection state.
  useEffect(() => {
    async function loadConfig() {
      setIsLoadingSpaces(true);
      setIsLoadingWorkspaces(true);
      setSpacesError(null);
      setWorkspacesError(null);

      const [spacesResult, workspacesResult] = await Promise.allSettled([
        withRetry(() => QlikService.getSpaces(qlikConnectionId || undefined), { retries: 2, delay: 800 }),
        withRetry(() => fabricService.getWorkspaces(), { retries: 2, delay: 800 }),
      ]);

      if (spacesResult.status === "fulfilled") {
        const loadedSpaces = spacesResult.value || [];
        setQlikSpaces(loadedSpaces);
        if (loadedSpaces.length > 0) {
          setSelectedQlikSpace((curr) => curr || loadedSpaces[0].id);
          setSelectedSpaces((curr) => curr.length > 0 ? curr : [loadedSpaces[0].id]);
        }
      } else {
        console.warn("Failed to load Qlik spaces:", spacesResult.reason);
        setSpacesError(
          spacesResult.reason instanceof Error
            ? spacesResult.reason.message
            : "Could not load Qlik spaces."
        );
      }
      setIsLoadingSpaces(false);

      if (workspacesResult.status === "fulfilled") {
        const loadedWorkspaces = workspacesResult.value || [];
        setWorkspaces(loadedWorkspaces);
        if (loadedWorkspaces.length > 0) {
          setSelectedWorkspace((curr) => curr || loadedWorkspaces[0].id);
        }
      } else {
        console.warn("Failed to load Fabric workspaces:", workspacesResult.reason);
        setWorkspacesError(
          workspacesResult.reason instanceof Error
            ? workspacesResult.reason.message
            : "Could not load Fabric workspaces."
        );
      }
      setIsLoadingWorkspaces(false);
    }

    loadConfig();
  }, [configReloadKey, qlikConnectionId]);

  // Fetch Qlik apps when space changes
  useEffect(() => {
    if (!selectedQlikSpace) return;
    async function fetchApps() {
      setIsFetchingApps(true);
      try {
      const spaceApps = await QlikService.getApps(selectedQlikSpace, qlikConnectionId || undefined);
        setApps(spaceApps);
        setSelectedApps([]);
      } catch (err) {
        console.error("Failed to load Qlik apps:", err);
      } finally {
        setIsFetchingApps(false);
      }
    }
    fetchApps();
  }, [selectedQlikSpace, qlikConnectionId, setApps]);

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
    if (selectedApps.length > 0) {
      setDropdownAppId(selectedApps[0]);
    }

    const selectedAppObjects = apps.filter((app) => selectedApps.includes(app.id));
    const spaceName = qlikSpaces.find((s) => s.id === selectedQlikSpace)?.name || "Personal Space";
    const runId = `qlik_run_${new Date().toISOString().replace(/[-:T]/g, "").split(".")[0]}`;

    // Initialize unified stores so ResultTab & LeftSidebar immediately know about the running project/apps
    useAgentStore.setState((state) => ({
      currentRunId: runId,
      currentProjectId: selectedQlikSpace || "personal",
      currentWorkbookIds: selectedApps,
      workbookProjectMap: {
        ...state.workbookProjectMap,
        ...selectedApps.reduce((acc, id) => ({ ...acc, [id]: selectedQlikSpace || "personal" }), {}),
      },
      migrationStarted: true,
    }));

    useDashboardStore.setState(() => ({
      selectedProject: selectedQlikSpace || "personal",
      selectedProjectName: spaceName,
      applications: selectedAppObjects.map((a) => ({
        id: a.id,
        workbookId: a.id,
        siteName: "Qlik Sense",
        projectId: selectedQlikSpace || "personal",
        projectName: spaceName,
        workbookName: a.name,
        status: "Running" as const,
        currentAgent: "Assessment" as const,
        startTime: new Date(),
      })),
    }));

    if (selectedApps.length > 0) {
      useUIStore.getState().setSelectedWorkbookId(selectedApps[0]);
    }

    try {
      // The Fabric API returns `displayName`; `name` is undefined on these
      // objects, so reading `.name` alone always fell through to the literal
      // "Default Workspace" and that string was sent downstream as the real
      // workspace name.
      const selected = workspaces.find((w) => w.id === selectedWorkspace);
      const workspaceName = selected?.displayName || selected?.name || "Default Workspace";

      // Call new invokeBatch for specific items
      const userEmail = accounts?.[0]?.username || "admin@unified.local";
      let started: any;
      let actualRunId = runId;

      let fabricToken = (useAuthStore.getState() as any).fabricToken || (typeof window !== "undefined" ? sessionStorage.getItem("fabric_access_token") : null);
      if (!fabricToken) {
        try {
          const { getFabricToken } = await import("@/components/providers/MsalProviderWrapper");
          fabricToken = await getFabricToken(true);
        } catch (tErr) {
          console.warn("[QlikMigrationTab] MSAL token resolution warning:", tErr);
        }
      }
      if (!fabricToken) {
        fabricToken = (useAuthStore.getState().user as any)?.accessToken || "mock-fabric-access-token";
      }

      if (migrationScope === "apps" && selectedAppObjects.length > 0) {
         started = await semanticKernelService.invokeBatch({
            email: userEmail,
            source_type: "qlik",
            deployment_type: "DIRECT_FABRIC",
            fabric_group_id: selectedWorkspace,
            fabric_access_token: fabricToken,
            connection_id: qlikConnectionId || undefined,
            run_validation: false,
            model: "auto",
            items: selectedAppObjects.map((app) => ({
              workspace_id: selectedQlikSpace || "personal",
              workspace_name: spaceName || "Personal",
              app_id: app.id,
              app_name: app.name,
            })),
         });
      } else {
         // Fallback to process space if no apps selected
         started = await semanticKernelService.processQlikSpace({
           email: userEmail,
           source_type: "cloud",
           workspace_id: selectedSpaces.length > 0 ? selectedSpaces : [selectedQlikSpace],
           deployment_type: "DIRECT_FABRIC",
           fabric_group_id: selectedWorkspace,
           connection_id: qlikConnectionId || undefined,
         });
      }
      
      let backendRunId = null;
      if (started && typeof started === "object") {
         const direct = (started as any).run_id ?? (started as any).runId ?? (started as any).runID;
         if (typeof direct === "string" && direct.trim()) backendRunId = direct;
         else {
            for (const key of ["data", "result", "run"]) {
               const nested = (started as any)[key];
               if (nested && typeof nested === "object") {
                  const direct2 = nested.run_id ?? nested.runId ?? nested.runID;
                  if (typeof direct2 === "string" && direct2.trim()) backendRunId = direct2;
               }
            }
         }
      }
      
      actualRunId = backendRunId || runId;
      
      if (!backendRunId) {
        console.warn("[QlikMigrationTab] Failed to extract run_id from backend response, falling back to frontend ID:", started);
      }
      
      useAgentStore.setState({ currentRunId: actualRunId });
      setApiResults(selectedAppObjects.map((app) => ({
        appId: app.id,
        appName: app.name,
        folderName: actualRunId,
      })));

      // STAGE-BY-STAGE POLLING LOGIC
      let runStatusCompleted = false;
      let runFailed = false;
      let runCancelled = false;
      let errorMessage = "";
      const startTime = Date.now();
      const MAX_POLL_TIME = 25 * 60 * 1000; // 25 minutes max
      
      // Track which stages we've fetched to avoid redundant calls
      const fetchedStages = {
         assessment: false,
         parsing: false,
         mapping: false,
         report_generation: false,
      };

      const fetchStageResult = async (stageName: string, queryType: string, recordAppId?: string) => {
         try {
            await Promise.all(selectedAppObjects.map(async (app) => {
               const targetAppId = recordAppId || app.id;
               const workspaceId = selectedQlikSpace || "personal";
               
               let finalData: any = null;
               const stageEndpointMap: Record<string, string> = {
                  assessment: "/api/assessment",
                  parsing: "/api/parsing",
                  mapping: "/api/mapping",
                  report_generation: "/api/generation",
                  validation: "/api/validation"
               };
               
               const endpoint = stageEndpointMap[stageName];
               if (endpoint) {
                  try {
                     finalData = await fetchWithAuth<any>(`${endpoint}?app_id=${encodeURIComponent(targetAppId)}&workspace_id=${encodeURIComponent(workspaceId)}&run_id=${encodeURIComponent(actualRunId)}`);
                  } catch (e) {
                     console.warn(`Dedicated endpoint ${endpoint} fetch notice:`, e);
                  }
               }
               
               if (!finalData || finalData.error || (typeof finalData === "object" && Object.keys(finalData).length === 0)) {
                  try {
                     const fallbackRes = await fetchWithAuth<any>(`/api/qlik/history-results?type=${queryType}&folder=${encodeURIComponent(actualRunId)}`);
                     const rec = (Array.isArray(fallbackRes) ? fallbackRes : []).find((a: any) => a.app_id === app.id) || fallbackRes;
                     finalData = rec?.[`${queryType}_result`] || rec?.payload || rec;
                  } catch {
                     // fallback notice
                  }
               }

               if (!finalData || finalData.error) return;

               if (stageName === "assessment") {
                  const rawAssessment = finalData?.payload || finalData?.data || finalData;
                  const normalizedAssessment = {
                     run_id: actualRunId,
                     workbook_id: app.id,
                     workbook_name: app.name,
                     project_id: workspaceId,
                     project_name: spaceName,
                     status: "completed",
                     payload: rawAssessment,
                     results: rawAssessment?.results || rawAssessment?.payload?.results || rawAssessment?.data?.results || (Array.isArray(rawAssessment) ? rawAssessment : []),
                  };
                  useAgentStore.getState().setAssessmentData(actualRunId, app.id, normalizedAssessment);
                  useAgentStore.setState((s) => ({
                     assessmentActivitiesDone: { ...s.assessmentActivitiesDone, [app.id]: true },
                  }));
               }
               
               if (stageName === "parsing") {
                  const rawParsed = finalData?.payload || finalData?.data || finalData;
                  const mappedParsed = mapParsingPayload(rawParsed);
                  useParsingStore.setState((s) => ({
                     parsingData: { ...s.parsingData, [app.id]: mappedParsed },
                     parsingRaw: { ...s.parsingRaw, [app.id]: rawParsed },
                  }));
                  useAgentStore.setState((s) => ({
                     parsingActivitiesDone: { ...s.parsingActivitiesDone, [app.id]: true },
                  }));
               }
               
               if (stageName === "mapping") {
                  const rawMapping = finalData?.payload || finalData?.data || finalData;
                  useMappingStore.setState((s) => ({
                     mappingData: { ...s.mappingData, [app.id]: rawMapping },
                     mappingRaw: { ...s.mappingRaw, [app.id]: rawMapping },
                  }));
                  useAgentStore.setState((s) => ({
                     mappingActivitiesDone: { ...s.mappingActivitiesDone, [app.id]: true },
                  }));
               }
               
               if (stageName === "report_generation") {
                  const rawGen = finalData?.payload || finalData?.data || finalData;
                  useGenerationStore.setState((s) => ({
                     generationData: { ...s.generationData, [app.id]: rawGen },
                     generationRaw: { ...s.generationRaw, [app.id]: rawGen },
                  }));
                  useAgentStore.setState((s) => ({
                     generationActivitiesDone: { ...s.generationActivitiesDone, [app.id]: true },
                  }));
               }

               setApiResults((prev) => prev.map(r => {
                  if (r.appId !== app.id) return r;
                  if (stageName === "assessment") return { ...r, assessmentData: finalData };
                  if (stageName === "parsing") return { ...r, parsedData: finalData };
                  if (stageName === "mapping") return { ...r, mappedData: finalData };
                  if (stageName === "report_generation") return { ...r, reportGenData: finalData };
                  return r;
               }));
            }));
            
            fetchedStages[stageName as keyof typeof fetchedStages] = true;
         } catch(e) {
            console.error(`Failed to fetch ${stageName} results`, e);
         }
      };

      while (!runStatusCompleted && !runFailed && (Date.now() - startTime) < MAX_POLL_TIME) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const statusRes = await fetchWithAuth<any>(`/api/qlik/history?email=${encodeURIComponent(userEmail)}&run_id=${encodeURIComponent(actualRunId)}&project_id=${encodeURIComponent(selectedQlikSpace || "personal")}`);
          const items = Array.isArray(statusRes) ? statusRes : (statusRes?.data || statusRes?.items || statusRes?.records || statusRes?.runs || []);
          if (items && items.length > 0) {
             const record = items[0];
             const status = String(record.overall_status ?? record.status ?? "").toLowerCase();
             const folderForResults = record.folder_name || record.app_id || actualRunId;

             // Check individual stages incrementally
             const assessmentStatus = String(record.assessment_status || "").toLowerCase();
             if ((assessmentStatus === "completed" || assessmentStatus === "success") && !fetchedStages.assessment) {
                await fetchStageResult("assessment", "assessment", record.app_id);
             }

             const parsingStatus = String(record.parsing_status || "").toLowerCase();
             if ((parsingStatus === "completed" || parsingStatus === "success") && !fetchedStages.parsing) {
                await fetchStageResult("parsing", "parsing", record.app_id);
             }

             const mappingStatus = String(record.mapping_status || "").toLowerCase();
             if ((mappingStatus === "completed" || mappingStatus === "success") && !fetchedStages.mapping) {
                await fetchStageResult("mapping", "mapping", record.app_id);
             }

             const genStatus = String(record.report_generation_status || "").toLowerCase();
             if ((genStatus === "completed" || genStatus === "success") && !fetchedStages.report_generation) {
                await fetchStageResult("report_generation", "report-generation", record.app_id);
             }
             
             if (/cancel|stopped|abort/.test(status)) {
                runCancelled = true;
                runStatusCompleted = true;
             } else if (/fail|error/.test(status)) {
                runFailed = true;
                runStatusCompleted = true;
                errorMessage = record.error_message || record.error || record.message || "Migration failed.";
             } else if (status && !["running", "processing", "pending", "paused", "in_progress", ""].includes(status)) {
                runStatusCompleted = true;
             } else if (!status && record.total_pending === 0 && record.total_workbooks > 0) {
                runStatusCompleted = true; // Fallback
             }
          }
        } catch (e) {
           console.warn("Poll status failed", e);
        }
      }

      if (runCancelled) {
         throw new Error("Migration run was cancelled.");
      }
      
      // Do not throw a fatal error if Assessment or Parsing data was successfully fetched,
      // so that the UI can still display partial results even if Mapping/Overall failed.
      const hasPartialResults = fetchedStages.assessment || fetchedStages.parsing;
      if (runFailed && !hasPartialResults) {
         throw new Error(errorMessage || "Migration run failed.");
      } else if (runFailed && hasPartialResults) {
         console.warn("[QlikMigrationTab] Run failed globally, but displaying partial fetched results. Error:", errorMessage);
      }
      
      if (!runStatusCompleted && !hasPartialResults) {
         throw new Error("Migration run timed out waiting for completion.");
      }

    } catch (err: any) {
      console.error("[QlikMigrationTab] Migration error:", err);
      // Surface detailed backend errors if provided
      const details = err.details || err.detail;
      const errorMsg = details ? `${err.message || 'Migration failed'}: ${typeof details === 'object' ? JSON.stringify(details) : details}` : formatApiErrorMessage(err.message || err);
      setGlobalError(errorMsg);
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
    qlikSpaceId: string,
    runId: string,
    spaceName: string,
    fabricGroupId: string
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
    updateProcessState(appId, "validation", { status: "pending" });

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
      // No "unbuild" pre-fetch step: vl-q2f-assessment and vl-q2f-parsing
      // fetch Qlik app data themselves server-side and their request
      // schemas have no field to accept caller-supplied data -- the
      // pre-fetch was silently discarded downstream (and its own endpoint,
      // /all/:appId on qlik-base-api, doesn't exist, so it never even
      // returned real data). Removed rather than kept as dead weight.

      // 1. Assessment
      pollLogs("assessment");
      const assessmentData = await QlikService.runAssessment(appId, folderName, qlikSpaceId, app.name);
      isPolling = false;
      await fetchAgentActions(appId, folderName, "assessment");
      updateProcessState(appId, "assessment", { status: "completed", result: assessmentData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, assessmentData } : r))
      );

      const rawAssessment: any = assessmentData;
      const normalizedAssessment = {
        run_id: runId,
        workbook_id: appId,
        workbook_name: app.name,
        project_id: qlikSpaceId,
        project_name: spaceName,
        status: "completed",
        payload: rawAssessment?.payload || rawAssessment?.data || rawAssessment,
        results: rawAssessment?.results || rawAssessment?.payload?.results || rawAssessment?.data?.results || (Array.isArray(rawAssessment) ? rawAssessment : []),
      };
      useAgentStore.getState().setAssessmentData(runId, appId, normalizedAssessment);
      useAgentStore.setState((s) => ({
        assessmentActivitiesDone: { ...s.assessmentActivitiesDone, [appId]: true },
      }));

      // 2. Parsing
      isPolling = true;
      pollLogs("parsing");
      updateProcessState(appId, "parsing", { status: "running" });
      const parsedData = await QlikService.runParsing(appId, folderName, qlikSpaceId, app.name);
      isPolling = false;
      await fetchAgentActions(appId, folderName, "parsing");
      updateProcessState(appId, "parsing", { status: "completed", result: parsedData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, parsedData } : r))
      );

      const rawParsed: any = (parsedData as any)?.data || (parsedData as any)?.payload || parsedData;
      const mappedParsed = mapParsingPayload(rawParsed);
      useParsingStore.setState((s) => ({
        parsingData: { ...s.parsingData, [appId]: mappedParsed },
        parsingRaw: { ...s.parsingRaw, [appId]: rawParsed },
      }));
      useAgentStore.setState((s) => ({
        parsingActivitiesDone: { ...s.parsingActivitiesDone, [appId]: true },
      }));

      // 3. Mapping
      isPolling = true;
      pollLogs("mapping");
      updateProcessState(appId, "mapping", { status: "running" });
      const mappedData = await QlikService.runMapping(appId, folderName, qlikSpaceId, app.name);
      isPolling = false;
      await fetchAgentActions(appId, folderName, "mapping");
      updateProcessState(appId, "mapping", { status: "completed", result: mappedData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, mappedData } : r))
      );

      const rawMapping: any = (mappedData as any)?.data || (mappedData as any)?.payload || mappedData;
      useMappingStore.setState((s) => ({
        mappingData: { ...s.mappingData, [appId]: rawMapping },
        mappingRaw: { ...s.mappingRaw, [appId]: rawMapping },
      }));
      useAgentStore.setState((s) => ({
        mappingActivitiesDone: { ...s.mappingActivitiesDone, [appId]: true },
      }));

      // 4. Report Generation
      isPolling = true;
      pollLogs("reportGeneration");
      updateProcessState(appId, "reportGeneration", { status: "running" });
      const reportGenData = await QlikService.runReportGeneration(
        appId,
        folderName,
        qlikSpaceId,
        app.name,
        undefined,
        fabricGroupId
      );
      isPolling = false;
      await fetchAgentActions(appId, folderName, "reportGeneration");
      updateProcessState(appId, "reportGeneration", { status: "completed", result: reportGenData });
      setApiResults((prev) =>
        prev.map((r) => (r.appId === appId ? { ...r, reportGenData } : r))
      );

      const rawGen: any = (reportGenData as any)?.data || (reportGenData as any)?.payload || reportGenData;
      useGenerationStore.setState((s) => ({
        generationData: { ...s.generationData, [appId]: rawGen },
        generationRaw: { ...s.generationRaw, [appId]: rawGen },
      }));
      useAgentStore.setState((s) => ({
        generationActivitiesDone: { ...s.generationActivitiesDone, [appId]: true },
      }));

      // 5. Validation (best-effort — does not fail the run: the migration
      // already succeeded by this point, validation only checks it).
      isPolling = true;
      pollLogs("validation");
      updateProcessState(appId, "validation", { status: "running" });
      try {
        const lakehouseId = await resolveLakehouseId(fabricGroupId);
        if (lakehouseId) {
          const validationData = await QlikService.runValidation(appId, folderName, qlikSpaceId, lakehouseId);
          isPolling = false;
          await fetchAgentActions(appId, folderName, "validation");
          updateProcessState(appId, "validation", { status: "completed", result: validationData });
        } else {
          isPolling = false;
          updateProcessState(appId, "validation", {
            status: "skipped",
            error: "No Fabric Lakehouse found in the target workspace to validate against.",
          });
        }
      } catch (valErr: any) {
        isPolling = false;
        await fetchAgentActions(appId, folderName, "validation");
        updateProcessState(appId, "validation", { status: "failed", error: formatApiErrorMessage(valErr.message) });
      }

    } catch (err: any) {
      isPolling = false;
      console.error(`Execution failed for ${app.name}:`, err);
      
      // Fail remaining stages with clean error
      const stages = ["assessment", "parsing", "mapping", "reportGeneration", "validation"] as const;
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
          qlikUrl={qlikUrl}
          setQlikUrl={setQlikUrl}
          originalQlikUrl={originalQlikUrl}
          setOriginalQlikUrl={setOriginalQlikUrl}
          migrationScope={migrationScope}
          setMigrationScope={setMigrationScope}
          selectedSpaces={selectedSpaces}
          setSelectedSpaces={setSelectedSpaces}
          onRetryConfig={() => setConfigReloadKey((key) => key + 1)}
          onQlikSpaceChange={handleQlikSpaceChange}
          onAppSelection={handleAppSelection}
          onRemoveApp={handleRemoveApp}
          onWorkspaceChange={handleWorkspaceChange}
          processStates={processStates}
          onReload={() => window.location.reload()}
          onStartProcessing={handleStartProcessing}
          onConnectionIdChange={setQlikConnectionId}
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
          isProcessing={isProcessing}
          currentRunId={useAgentStore((s) => s.currentRunId)}
        />
      </div>
      </ConnectorRequired>
    </FadeIn>
  );
}
