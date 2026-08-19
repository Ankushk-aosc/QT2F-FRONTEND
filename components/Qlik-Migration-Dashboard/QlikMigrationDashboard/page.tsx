"use client";

import React from "react";

import { EndpointCard } from "@/components/dashboard/EndpointCard";
import { MigrationLayout } from "@/components/dashboard/MigrationLayout";
import { QlikSpaceSelectorContent } from "@/components/Qlik-Migration-Dashboard/QlikSpaceSelector/page";
import { QlikAppsSelectorContent } from "@/components/Qlik-Migration-Dashboard/QlikAppsSelector/page";
import { TargetWorkspaceSelectorContent } from "@/components/Qlik-Migration-Dashboard/TargetWorkspaceSelector/page";
import { useConnectorReadiness } from "@/hooks/useConnectorReadiness";

/**
 * The Qlik → Fabric migration screen.
 *
 * This used to carry a Qlik Cloud URL form of its own, and took thirty-odd
 * props to drive it — save state, edit state, error and success strings — all
 * so a migration screen could reconfigure a connection. That form is gone. The
 * connection is configured once in Settings, and this screen reads it.
 *
 * What remains is the screen's actual job: pick a space, pick applications,
 * pick a target workspace, start.
 */

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
  isProcessing: boolean;
  isProcessCompleted: boolean;
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
  /** True while the Fabric workspace fetch is still in flight. */
  isLoadingWorkspaces?: boolean;
  /** True while the Qlik space fetch is still in flight. */
  isLoadingSpaces?: boolean;
  /** Load failures, surfaced beside the picker that failed. */
  spacesError?: string | null;
  workspacesError?: string | null;
  /** Re-runs both discovery fetches. */
  onRetryConfig?: () => void;
  onQlikSpaceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAppSelection: (appId: string) => void;
  onRemoveApp: (appId: string) => void;
  onWorkspaceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onStartProcessing: () => void;
}

export function QlikMigrationDashboard(props: QlikMigrationDashboardProps) {
  const qlik = useConnectorReadiness("qlik");
  const fabric = useConnectorReadiness("fabric");

  // Why the action is unavailable, in the order the user would fix it. One
  // sentence beats three disabled controls with no explanation.
  const blockedReason = (() => {
    if (props.isProcessing) return undefined;
    if (props.isProcessCompleted) return undefined;
    if (!props.selectedQlikSpace) return "Select a Qlik space to continue.";
    if (props.selectedApps.length === 0) return "Select at least one application to migrate.";
    if (!props.selectedWorkspace) return "Select a target Fabric workspace.";
    return undefined;
  })();

  const handleAction = () => {
    if (props.isProcessCompleted) {
      // Reset for a fresh run. The parent owns the run state, so it clears it.
      props.onStartProcessing();
      return;
    }
    props.onStartProcessing();
  };

  const actionLabel = props.isProcessing
    ? "Migrating…"
    : props.isProcessCompleted
      ? "Start a new migration"
      : "Start Migration";

  const qlikEndpoint =
    typeof qlik.connection?.values?.cloudUrl === "string"
      ? qlik.connection.values.cloudUrl
      : undefined;

  const selectedWorkspaceName = props.workspaces.find(
    (workspace) => workspace.id === props.selectedWorkspace,
  )?.displayName;

  return (
    <MigrationLayout
      error={props.globalError}
      blockedReason={blockedReason}
      actionLabel={actionLabel}
      onAction={handleAction}
      busy={props.isProcessing}
      source={
        <EndpointCard
          role="Source"
          name="Qlik Cloud"
          status={qlik.connection?.status ?? "not-configured"}
          endpoint={qlikEndpoint}
          onConfigure={qlik.openConfiguration}
        >
          <QlikSpaceSelectorContent
            selectedQlikSpace={props.selectedQlikSpace}
            onChange={props.onQlikSpaceChange}
            qlikSpaces={props.qlikSpaces}
            isProcessing={props.isProcessing}
            hasProcessed={props.hasProcessed}
            showNoAppsPopup={props.showNoAppsPopup}
            setShowNoAppsPopup={props.setShowNoAppsPopup}
            isLoadingSpaces={props.isLoadingSpaces}
            loadError={props.spacesError}
            onRetry={props.onRetryConfig}
          />
          <QlikAppsSelectorContent
            selectedApps={props.selectedApps}
            apps={props.apps}
            isProcessing={props.isProcessing}
            hasProcessed={props.hasProcessed}
            dropdownOpen={props.dropdownOpen}
            setDropdownOpen={props.setDropdownOpen}
            dropdownDirection={props.dropdownDirection}
            setDropdownDirection={props.setDropdownDirection}
            onAppSelection={props.onAppSelection}
            onRemoveApp={props.onRemoveApp}
            dropdownRef={props.dropdownRef}
          />
        </EndpointCard>
      }
      target={
        <EndpointCard
          role="Target"
          name="Microsoft Fabric"
          status={fabric.connection?.status ?? "not-configured"}
          endpoint={selectedWorkspaceName}
          onConfigure={fabric.openConfiguration}
        >
          <TargetWorkspaceSelectorContent
            selectedWorkspace={props.selectedWorkspace}
            onChange={props.onWorkspaceChange}
            workspaces={props.workspaces}
            isProcessing={props.isProcessing}
            hasProcessed={props.hasProcessed}
            isLoadingWorkspaces={props.isLoadingWorkspaces}
            loadError={props.workspacesError}
            onRetry={props.onRetryConfig}
          />
        </EndpointCard>
      }
    />
  );
}
