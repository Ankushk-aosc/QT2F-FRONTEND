"use client";

import React from "react";
import Image from "next/image";
import { ArrowRight, RefreshCw, Play, X, Database, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, Radio } from "@/components/ui/radio";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import type { MigrationScope } from "@/lib/api/runContract";
import { isLiteMode, isPartialProcessing } from "@/lib/config";
import { QlikUrlConfigContent } from "@/components/Qlik-Migration-Dashboard/QlikUrlConfig/page";
import { QlikConnectionConfigContent } from "@/components/Qlik-Migration-Dashboard/QlikConnectionConfig/page";
import { QlikSpaceSelectorContent } from "@/components/Qlik-Migration-Dashboard/QlikSpaceSelector/page";
import { QlikAppsSelectorContent } from "@/components/Qlik-Migration-Dashboard/QlikAppsSelector/page";
import { QlikSpacesSelectorContent } from "@/components/Qlik-Migration-Dashboard/QlikSpacesSelector/page";
import { TargetWorkspaceSelectorContent } from "@/components/Qlik-Migration-Dashboard/TargetWorkspaceSelector/page";
import { useMonitoringStore } from "@/stores/monitoring.store";

interface QlikSpace {
  id: string;
  name: string;
}
interface Workspace {
  id: string;
  displayName: string;
}
interface QlikApp {
  id: string;
  name: string;
}
interface QlikMigrationDashboardProps {
  globalError: string | null;
  /** Clears the inline error banner so the user can dismiss it and keep working. */
  onClearGlobalError?: () => void;
  /** A run is in flight -- from run id returned to run terminal. */
  isProcessing: boolean;
  /**
   * The start request is in flight but no run id has come back yet.
   *
   * Separate from isProcessing for the reason T2F separates them: the start
   * call only queues work, so without this the page has no state for "clicked,
   * waiting" and the button stays enabled and labelled "Migrate" through it.
   */
  isStarting?: boolean;
  isProcessCompleted: boolean;
  processStates?: any;
  selectedApps: string[];
  selectedQlikSpace: string;
  qlikSpaces: QlikSpace[];
  showNoAppsPopup: boolean;
  setShowNoAppsPopup: (show: boolean) => void;
  apps: QlikApp[];
  hasProcessed: boolean;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  dropdownDirection: "down" | "up";
  setDropdownDirection: (direction: "down" | "up") => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  selectedWorkspace: string;
  workspaces: Workspace[];
  qlikUrl?: string;
  setQlikUrl?: (url: string) => void;
  originalQlikUrl?: string;
  setOriginalQlikUrl?: (url: string) => void;
  error?: string | null;
  setError?: (error: string | null) => void;
  success?: string | null;
  setSuccess?: (success: string | null) => void;
  isEditing?: boolean;
  setIsEditing?: (editing: boolean) => void;
  isSaving?: boolean;
  setIsSaving?: (saving: boolean) => void;
  onSaveSuccess?: () => void;
  onQlikSpaceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAppSelection: (appId: string) => void;
  onRemoveApp: (appId: string) => void;
  onWorkspaceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onStartProcessing: () => void;
  /** Clears a finished run and returns the page to a clean slate. */
  onReload?: () => void;
  /** Which start endpoint the Migrate button will hit. */
  migrationScope?: MigrationScope;
  setMigrationScope?: (scope: MigrationScope) => void;
  /** Qlik space ids, used only when migrationScope is "spaces". */
  selectedSpaces?: string[];
  setSelectedSpaces?: (ids: string[]) => void;
  /** True while the app list for the selected space is loading. */
  isFetchingApps?: boolean;
  /** True while the Qlik space list itself is loading. */
  isFetchingSpaces?: boolean;
  /** True while the target Fabric workspace list is loading. */
  isLoadingWorkspaces?: boolean;
  /** True while the Qlik space list is loading (alias kept for older callers). */
  isLoadingSpaces?: boolean;
  spacesError?: string | null;
  workspacesError?: string | null;
  onRetryConfig?: () => void;
  /** Run started by the current Migrate click, if any. */
  currentRunId?: string | null;
  /**
   * Stops currentRunId via POST /qlik/stop-run. Kept on the prop surface for
   * callers that still pass it, but this component no longer renders a Stop
   * button itself -- that control now lives solely in the Monitoring tab, so
   * there is exactly one place to stop a run.
   */
  onStopRun?: () => void;
  /** Unused by this component now; see the note on onStopRun. */
  isRunActive?: boolean;
  /**
   * Fired with the saved connection's id whenever it changes (mount auto-load
   * or an explicit Configure Source Connection save), so the Migrate button can
   * send connection_id on the run-start body. Empty string when no connection
   * is configured.
   */
  onConnectionIdChange?: (connectionId: string) => void;
}

export function QlikMigrationDashboard(props: QlikMigrationDashboardProps) {
  // Held here rather than lifted into props: the saved-connection name is only
  // ever read by the Configure control and its combobox, so threading it up
  // through app/migration/page.tsx would add a prop no other panel uses.
  const [currentConnectionName, setCurrentConnectionName] = React.useState("");
  /*
   * Whether this page's run was stopped. Sourced from the same monitoring-store
   * slice the Monitoring tab and the sidebar read, so all three surfaces agree.
   * The stop handler sets isProcessCompleted, which on its own would leave the
   * banner below congratulating the user on a "Migration Complete" they had
   * just cancelled.
   */
  const stoppedRunIds = useMonitoringStore((s) => s.stoppedRunIds);
  const isRunStopped = !!props.currentRunId && (stoppedRunIds ?? []).includes(props.currentRunId);

  const selectedSpaces = props.selectedSpaces || [];

  /**
   * What "configured" means depends on the scope: the app scope needs a space
   * AND apps within it, the space scope needs only the spaces themselves.
   *
   * `qlikUrl` is deliberately NOT part of this.
   *
   * It never was a real prerequisite. Nothing on the start path sends it:
   * startRun's body is scope + email + Fabric token + the selection, and the
   * space and app lookups go to the Qlik base API, which resolves the tenant
   * itself from the records host. The URL is display state for the connection
   * panel and nothing more. Requiring it here turned any hiccup in that one
   * unrelated GET into a hard block with all three dropdowns visibly filled --
   * the "Still needed: Qlik Cloud URL (not loaded)" the deployed app showed
   * while it was perfectly able to run. Gate on what the run actually consumes.
   */
  const isSourceConfigured =
    props.migrationScope === "apps"
      ? !!props.selectedQlikSpace && props.selectedApps.length > 0
      : props.migrationScope === "spaces"
        ? selectedSpaces.length > 0
        : props.migrationScope === "sites"
          ? selectedSpaces.length > 0 || props.qlikSpaces.length > 0
          : false;
  const isTargetConfigured = !!props.selectedWorkspace;
  const isReady = isSourceConfigured && isTargetConfigured;

  /**
   * Exactly which prerequisites are still missing.
   *
   * The start button was otherwise disabled with no explanation, which is
   * unreadable when the empty input is off screen -- the target workspace sits
   * in a separate panel. Naming the missing item turns that into something the
   * user can act on. Same list that drives `isReady`, so the hint can never
   * disagree with the button.
   */
  const missingRequirements: string[] = [];
  if (props.migrationScope === "apps") {
    if (!props.selectedQlikSpace) missingRequirements.push("a Qlik space");
    if (props.selectedApps.length === 0) missingRequirements.push("at least one app");
  } else if (props.migrationScope === "spaces") {
    if (selectedSpaces.length === 0) missingRequirements.push("at least one Qlik space");
  } else if (props.migrationScope === "sites") {
    if (selectedSpaces.length === 0 && props.qlikSpaces.length === 0) {
      missingRequirements.push("at least one Qlik space to be available");
    }
  }
  if (!props.selectedWorkspace) missingRequirements.push("a target Fabric workspace");

  /**
   * The primary button's identity, following vl-t2f-frontend's MigrationTab.
   *
   * There, one button carries the whole run lifecycle and its three facets --
   * label, icon and click target -- are all derived from the same ordered set
   * of conditions, so they can never disagree. Q2F had drifted: `isProcessing`
   * meant "the start request is in flight" rather than "a run is in flight",
   * so the moment the start call returned the label fell through to "Start New
   * Migration" while the run was still going and Stop Migration was still
   * offering to stop it. That is the screenshot. `isStarting` now carries the
   * request phase and `isProcessing` the run, exactly as T2F splits them.
   *
   * Order matters and is T2F's: starting, then finished, then running, then a
   * spent run id, then idle.
   */
  const isRunInFlight = props.isProcessing && !props.isProcessCompleted;
  /**
   * Every configuration control locks while a start is in flight or a run is
   * going, which is what T2F does -- each of its dropdowns, its scope radio
   * group and its Configure button all carry `disabled={isProcessing ||
   * isStarting}`. Q2F passed only isProcessing down, so during the start
   * request the user could still change the space or workspace the request had
   * already been sent with.
   */
  const controlsLocked = props.isProcessing || !!props.isStarting || props.hasProcessed || props.isProcessCompleted || !!props.currentRunId;
  const hasSpentRun = !!props.currentRunId && !isRunInFlight && !props.isStarting;
  const isRestart = props.isProcessCompleted || hasSpentRun;

  const isFailed = React.useMemo(() => {
    if (props.globalError) return true;
    if (!props.processStates) return false;
    return Object.values(props.processStates).some((appState: any) =>
      Object.values(appState || {}).some((stage: any) => stage?.status === "failed")
    );
  }, [props.globalError, props.processStates]);

  const failedStageName = React.useMemo(() => {
    if (!props.processStates) return "Migration Failed";
    for (const appState of Object.values(props.processStates) as any[]) {
      if (appState?.mapping?.status === "failed") return "Mapping Failed";
      if (appState?.parsing?.status === "failed") return "Parsing Failed";
      if (appState?.assessment?.status === "failed") return "Assessment Failed";
      if (appState?.reportGeneration?.status === "failed") return "Report Generation Failed";
      if (appState?.validation?.status === "failed") return "Validation Failed";
    }
    return "Migration Failed";
  }, [props.processStates]);

  const buttonLabel = props.isStarting
    ? "Starting..."
    : isRestart
      ? "Start New Migration"
      : isRunInFlight
        ? "Processing"
        : isLiteMode()
          // Lite Mode stops after parsing, so it never performs a migration --
          // T2F labels the same button "Assess".
          ? "Assess"
          : "Migrate";

  const buttonIcon =
    props.isStarting || isRunInFlight ? (
      <Spinner size="tiny" />
    ) : isRestart ? (
      <RefreshCw size={18} />
    ) : (
      <Play size={18} />
    );

  /**
   * Disabled while the request is in flight, while the run is in flight, and
   * while the form is incomplete.
   *
   * The `!isRestart` on the readiness term is T2F's `(!isReady && !currentRunId)`:
   * a finished run must still be clearable even though the form it left behind
   * no longer satisfies the start requirements.
   */
  const isButtonDisabled = props.isStarting || isRunInFlight || (!isReady && !isRestart);

  const handleStartProcessing = () => {
    // Restart is a reset, not a start: it routes to onReload, matching T2F's
    // `? handleReload : debouncedStart` split on the same conditions.
    if (isRestart) {
      props.onReload?.();
      return;
    }
    props.onStartProcessing();
  };

  let migrationText = "Awaiting";
  let migrationIcon = "⚠️";
  let migrationColorClass = "text-warning font-semibold";
  // Ranked ahead of the in-flight and completed cases for the same reason the
  // banner is: a stopped run is neither.
  if (isRunStopped) {
    migrationText = "Stopped";
    migrationIcon = "⛔";
    migrationColorClass = "text-warning font-semibold";
  } else if (props.isProcessing) {
    migrationText = "Migrating";
    migrationIcon = "...";
    migrationColorClass = "font-semibold text-[#4f46e5]";
  } else if (props.isProcessCompleted) {
    // "Parsing Done" rather than "Migrated" in Partial Processing: nothing was
    // migrated into Fabric, and T2F's config row says exactly this at the same
    // point in its Lite run.
    migrationText = isPartialProcessing() ? "Parsing Done" : "Migrated";
    migrationIcon = "✓";
    migrationColorClass = "text-success font-semibold";
  }
  const statusText = isRunStopped
    ? "Stopped ⛔"
    : props.isProcessCompleted
      ? "Completed ✓"
      : isReady
        ? "Ready ✓"
        : "Awaiting ⚠️";
  const statusClass =
    !isRunStopped && (props.isProcessCompleted || isReady) ? "text-success font-semibold" : "text-warning font-semibold";

  return (
    <div className="px-4 py-6">
      {props.globalError && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive-subtle px-4 py-3 text-destructive">
          <div>
            <div className="font-semibold">Error</div>
            {props.globalError}
          </div>
          {props.onClearGlobalError && (
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={props.onClearGlobalError}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-black/5"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      <div className="flex items-stretch gap-8 max-[1200px]:flex-col max-[1200px]:gap-6">
        {/* Source Panel */}
        <Card className="relative min-h-[520px] min-w-0 flex-1 !rounded-xl border border-[#bfdbfe] !bg-[#eff6ff] shadow-card">
          <div className="rounded-t-xl border-b border-[#bfdbfe] bg-[#dbeafe] px-5 py-4">
            <div className="flex items-center gap-3">
              <Image src="/qliklogo.png" alt="Qlik" width={48} height={48} className="shrink-0" />
              <div>
                <span className="block text-lg font-semibold text-[#1e40af]">Source</span>
                <span className="text-xs text-[#2563eb]">Qlik Environment</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            {/* Connection Name + Configure, mirroring T2F's MigrationTab where
                the Configure button sits beside the Connection Name combobox. */}
            <QlikConnectionConfigContent
              isProcessing={controlsLocked}
              currentConnectionName={currentConnectionName}
              setCurrentConnectionName={setCurrentConnectionName}
              onConnectionApplied={(creds) => {
                // Saving a connection is also how the page learns its Qlik URL,
                // so the space and app lookups below keep working unchanged.
                if (creds.QLIK_TENANT_URL) {
                  props.setQlikUrl?.(creds.QLIK_TENANT_URL);
                  props.setOriginalQlikUrl?.(creds.QLIK_TENANT_URL);
                }
                // The Migrate button needs this to send connection_id -- see
                // the prop doc on onConnectionIdChange.
                props.onConnectionIdChange?.(creds.connection_id || "");
              }}
            />

            <div className="mt-6">
              <QlikUrlConfigContent qlikUrl={props.qlikUrl || ""} />
            </div>

            {/* Migration Scope picks which start endpoint fires:
                  "apps"   -> space dropdown, then apps in it -> /invoke-batch
                  "spaces" -> whole spaces, multi-select      -> /qlik/process-space
                  "sites"  -> whole tenant, no picker -- UI-only for now, see
                              MigrationScope's doc comment in runContract.ts
                Mirrors T2F's Migration Scope radio group (Selected Workbook /
                Project All Workbooks / Site All Projects). */}
            <div className="mt-6">
              <Label className="text-primary">Migration Scope</Label>
              <RadioGroup
                value={props.migrationScope || "apps"}
                onChange={(_, d) => props.setMigrationScope?.(d.value as MigrationScope)}
                layout="vertical"
                disabled={controlsLocked}
              >
                <Radio value="apps" label="Selected Applications" />
                <Radio value="spaces" label="Entire Space (All Applications)" />
                <Radio value="sites" label="Sites (All Spaces)" />
              </RadioGroup>
            </div>

            {(props.migrationScope || "apps") === "apps" ? (
              <>
                <div className="mt-6">
                  <QlikSpaceSelectorContent
                    selectedQlikSpace={props.selectedQlikSpace}
                    onChange={props.onQlikSpaceChange}
                    qlikSpaces={props.qlikSpaces}
                    isFetchingSpaces={props.isFetchingSpaces}
                    isProcessing={controlsLocked}
                    hasProcessed={props.hasProcessed}
                    showNoAppsPopup={props.showNoAppsPopup}
                    setShowNoAppsPopup={props.setShowNoAppsPopup}
                  />
                </div>
                <div className="mt-6">
                  <QlikAppsSelectorContent
                    selectedApps={props.selectedApps}
                    apps={props.apps}
                    isProcessing={controlsLocked}
                    isFetchingApps={props.isFetchingApps}
                    isSpaceSelected={!!props.selectedQlikSpace}
                    hasProcessed={props.hasProcessed}
                    dropdownOpen={props.dropdownOpen}
                    setDropdownOpen={props.setDropdownOpen}
                    dropdownDirection={props.dropdownDirection}
                    setDropdownDirection={props.setDropdownDirection as any}
                    onAppSelection={props.onAppSelection}
                    onRemoveApp={props.onRemoveApp}
                    dropdownRef={props.dropdownRef}
                  />
                </div>
              </>
            ) : (props.migrationScope || "apps") === "spaces" ? (
              <div className="mt-6">
                <QlikSpacesSelectorContent
                  selectedSpaces={selectedSpaces}
                  setSelectedSpaces={props.setSelectedSpaces || (() => {})}
                  qlikSpaces={props.qlikSpaces}
                  isFetchingSpaces={props.isFetchingSpaces}
                  isProcessing={controlsLocked}
                />
              </div>
            ) : (
              <div className="mt-6 rounded-md border border-border bg-surface-subtle p-3">
                <span className="text-sm text-secondary-foreground">
                  All spaces and applications across the entire Qlik tenant will be migrated automatically.
                </span>
              </div>
            )}
          </div>
        </Card>

        <div className="flex min-w-5 items-center justify-center px-2 text-muted-foreground max-[1200px]:rotate-90 max-[1200px]:py-4">
          <ArrowRight size={40} />
        </div>

        {/* Target Panel */}
        <Card className="relative min-h-[520px] min-w-0 flex-1 !rounded-xl border border-[#bbf7d0] !bg-[#f0fdf4] shadow-card">
          <div className="rounded-t-xl border-b border-[#bbf7d0] bg-[#dcfce7] px-5 py-4">
            <div className="flex items-center gap-3">
              <Image src="/Fabric_Color_48.svg" alt="Microsoft Fabric" width={48} height={48} className="shrink-0" />
              <div>
                <span className="block text-lg font-semibold text-[#166534]">Target</span>
                <span className="text-xs text-[#16a34a]">Microsoft Fabric</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            <TargetWorkspaceSelectorContent
              selectedWorkspace={props.selectedWorkspace}
              onChange={props.onWorkspaceChange}
              workspaces={props.workspaces}
              isProcessing={controlsLocked}
              hasProcessed={props.hasProcessed}
              isSourceConfigured={isSourceConfigured}
            />
            <Card className="mt-6 overflow-hidden !rounded-lg border border-border !bg-[#f8fafc]">
              <div className="border-b border-border bg-[#f1f5f9] px-4 py-3">
                <span className="font-semibold text-[#1f2937]">Target Configuration</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 last:border-b-0">
                  <span className="text-xs text-[#475569]">Workspace:</span>
                  <span className={props.selectedWorkspace ? "font-semibold text-success" : "font-semibold text-warning"}>
                    {props.selectedWorkspace ? "Configured ✓" : "Not selected ⚠️"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 last:border-b-0">
                  <span className="text-xs text-[#475569]">Migration:</span>
                  <span className={migrationColorClass}>
                    {migrationText} {migrationIcon}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 last:border-b-0">
                  <span className="text-xs text-[#475569]">Status:</span>
                  <span className={statusClass}>{statusText}</span>
                </div>
              </div>
            </Card>
          </div>
        </Card>
      </div>

      {/* Run status banner, as T2F shows below its Migrate button. Without it
          the only completion signal was the Migrate button changing label --
          easy to miss, and in Lite Mode there is no later stage to make the
          finish obvious. Says plainly which stages ran, so a partial run does
          not read as an unfinished full one. */}
      {(props.isProcessing || props.isProcessCompleted || isRunStopped) && (
        <div
          className={[
            "mt-8 rounded-lg border px-4 py-3",
            isRunStopped
              ? "border-warning/30 bg-warning-subtle text-warning"
              : props.isProcessing
                ? "border-info/30 bg-info-subtle text-info"
                : "border-success/30 bg-success-subtle text-success",
          ].join(" ")}
        >
          <div className="font-semibold">
            {isRunStopped
              ? "Processing terminated"
              : props.isProcessing
                ? "Processing applications..."
                : isPartialProcessing()
                  // T2F's wording for the same state -- its Lite Mode banner
                  // reads "Extraction Completed" once parsing lands.
                  ? "Extraction Completed"
                  : "Migration Complete"}
          </div>
          <p className="mt-0.5 text-sm">
            {isRunStopped
              ? "This run was stopped. Applications that had not been processed yet were not run — whatever finished before the stop is still under Results."
              : props.isProcessing
                ? "Orchestrating agents. Please wait — results appear in the Results tab as each agent finishes."
                : isPartialProcessing()
                  ? "The Assessment and Parsing agents finished for every selected application. Review them under Results, or download the report from Migration Overview."
                  : "All agents completed successfully. You can review the results below."}
          </p>
        </div>
      )}

      <div className="mt-10 flex min-h-12 flex-wrap items-center justify-center gap-4">
        {props.isStarting || isRunInFlight ? (
          <Button
            size="lg"
            className="min-w-[200px] gap-2 px-8 py-3 text-base"
            disabled
          >
            <Spinner size="tiny" />
            {props.isStarting ? "Starting..." : "Migrating..."}
          </Button>
        ) : isFailed ? (
          <Button
            size="lg"
            className="min-w-[200px] gap-2 px-8 py-3 text-base !bg-[#ef4444] !text-white opacity-90 cursor-not-allowed"
            disabled
          >
            <X size={18} />
            {failedStageName}
          </Button>
        ) : props.isProcessCompleted || hasSpentRun ? (
          <Button
            size="lg"
            className="min-w-[200px] gap-2 px-8 py-3 text-base !bg-[#22c55e] !text-white opacity-90 cursor-not-allowed"
            disabled
          >
            <CheckCircle2 size={18} />
            Migration Completed
          </Button>
        ) : (
          <Button
            size="lg"
            className="min-w-[200px] gap-2 px-8 py-3 text-base"
            onClick={handleStartProcessing}
            disabled={!isReady}
          >
            <Play size={18} />
            Migrate
          </Button>
        )}

        {(props.isProcessCompleted || hasSpentRun || isFailed) && (
          <Button
            size="lg"
            variant="outline"
            className="min-w-[200px] gap-2 px-8 py-3 text-base border-2 border-primary text-primary hover:bg-primary-subtle"
            onClick={() => {
              if (props.onReload) {
                props.onReload();
              } else {
                window.location.reload();
              }
            }}
          >
            <RefreshCw size={18} />
            Start New Migration
          </Button>
        )}
      </div>
    </div>
  );
}
