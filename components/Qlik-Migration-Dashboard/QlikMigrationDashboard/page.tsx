"use client";

import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TriangleAlert, Database, Cloud } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // Ensure this import is correct
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QlikUrlConfigContent } from "@/components/Qlik-Migration-Dashboard/QlikUrlConfig/page";
import { QlikSpaceSelectorContent } from "@/components/Qlik-Migration-Dashboard/QlikSpaceSelector/page";
import { QlikAppsSelectorContent } from "@/components/Qlik-Migration-Dashboard/QlikAppsSelector/page";
import { TargetWorkspaceSelectorContent } from "@/components/Qlik-Migration-Dashboard/TargetWorkspaceSelector/page";

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
  qlikUrl: string;
  setQlikUrl: (url: string) => void;
  originalQlikUrl: string;
  setOriginalQlikUrl: (url: string) => void;
  error: string | null;
  setError: (error: string | null) => void;
  success: string | null;
  setSuccess: (success: string | null) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  onSaveSuccess: () => void;
  onQlikSpaceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAppSelection: (appId: string) => void;
  onRemoveApp: (appId: string) => void;
  onWorkspaceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onStartProcessing: () => void;
}

export function QlikMigrationDashboard(props: QlikMigrationDashboardProps) {
  const isSourceConfigured = !!props.qlikUrl && !!props.selectedQlikSpace && props.selectedApps.length > 0;
  const isTargetConfigured = !!props.selectedWorkspace;
  const isReady = isSourceConfigured && isTargetConfigured;

  const handleStartProcessing = () => {
    if (props.isProcessCompleted) {
      // Refresh the entire page
      window.location.reload();
    } else {
      // Proceed with normal migration processing
      props.onStartProcessing();
    }
  };

  let migrationText = "Awaiting";
  let migrationIcon = "⚠️";
  let migrationColor = "text-yellow-600";

  if (props.isProcessing) {
    migrationText = "Migrating";
    migrationIcon = "...";
    migrationColor = "text-indigo-600";
  } else if (props.isProcessCompleted) {
    migrationText = " Migrated";
    migrationIcon = "✓";
    migrationColor = "text-green-600";
  }

  return (
    <AccordionItem value="dashboard" className="mt-0 pt-0">
      <AccordionTrigger className="text-2xl sm:text-3xl font-bold mt-0 pt-0">
        Qlik Migration Dashboard
      </AccordionTrigger>
      <AccordionContent className="mt-0 pt-0 space-y-0">
        {props.globalError && (
          <Alert variant="destructive" className="mt-0">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{props.globalError}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-start gap-4">
          {/* Source Panel */}
          <Card className="w-full flex-1 bg-blue-50 border-blue-200">
            <CardHeader className="bg-blue-100 border-b-blue-200">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-800">Source</CardTitle>
              </div>
              <CardDescription className="text-blue-600">Qlik Environment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <QlikUrlConfigContent
                qlikUrl={props.qlikUrl}
                setQlikUrl={props.setQlikUrl}
                originalQlikUrl={props.originalQlikUrl}
                setOriginalQlikUrl={props.setOriginalQlikUrl}
                error={props.error}
                setError={props.setError}
                success={props.success}
                setSuccess={props.setSuccess}
                isEditing={props.isEditing}
                setIsEditing={props.setIsEditing}
                isSaving={props.isSaving}
                setIsSaving={props.setIsSaving}
                onSaveSuccess={props.onSaveSuccess}
              />
              <QlikSpaceSelectorContent
                selectedQlikSpace={props.selectedQlikSpace}
                onChange={props.onQlikSpaceChange}
                qlikSpaces={props.qlikSpaces}
                isProcessing={props.isProcessing}
                hasProcessed={props.hasProcessed}
                showNoAppsPopup={props.showNoAppsPopup}
                setShowNoAppsPopup={props.setShowNoAppsPopup}
              />
              <QlikAppsSelectorContent
                selectedApps={props.selectedApps}
                apps={props.apps}
                isProcessing={props.isProcessing}
                hasProcessed={props.hasProcessed}
                dropdownOpen={props.dropdownOpen}
                setDropdownOpen={props.setDropdownOpen}
                dropdownDirection={props.dropdownDirection}
                setDropdownDirection={props.setDropdownDirection as any}
                onAppSelection={props.onAppSelection}
                onRemoveApp={props.onRemoveApp}
                dropdownRef={props.dropdownRef}
              />
            </CardContent>
          </Card>

          {/* Arrow */}
          <div className="pt-50 self-center text-2xl text-gray-400 font-bold">→</div>

          {/* Target Panel */}
          <Card className="w-full flex-1 bg-green-50 border-green-200">
            <CardHeader className="bg-green-100 border-b-green-200">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-green-600" />
                <CardTitle className="text-green-800">Target</CardTitle>
              </div>
              <CardDescription className="text-green-600">Microsoft Fabric</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <TargetWorkspaceSelectorContent
                selectedWorkspace={props.selectedWorkspace}
                onChange={props.onWorkspaceChange}
                workspaces={props.workspaces}
                isProcessing={props.isProcessing}
                hasProcessed={props.hasProcessed}
              />
              <Card className="bg-gray-50 border-gray-200">
                <CardHeader className="bg-gray-100 border-b-gray-200">
                  <CardTitle className="text-gray-800">Target Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Workspace:</span>
                    <span className={`text-sm ${props.selectedWorkspace ? "text-green-600" : "text-yellow-600"}`}>
                      {props.selectedWorkspace ? "Configured ✓" : "Not selected ⚠️"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Migration:</span>
                    <span className={`text-sm font-medium ${migrationColor}`}>
                      {migrationText}{migrationIcon}
                    </span>
                  </div>
                <div className="flex justify-between items-center">
  <span className="text-sm text-gray-600">Status:</span>
  <span
    className={`text-sm font-medium ${
      props.isProcessCompleted
        ? "text-green-600"
        : isReady
        ? "text-green-600"
        : "text-yellow-600"
    }`}
  >
    {props.isProcessCompleted
      ? "Completed ✓"
      : isReady
      ? "Ready ✓"
      : "Awaiting ⚠️"}
  </span>
</div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>

        <div className="pt-5 flex justify-center mt-6">
          <Button
            onClick={handleStartProcessing}
            disabled={
              props.isProcessing ||
              props.selectedApps.length === 0 ||
              !props.selectedWorkspace
            }
            className="gap-2 px-8 py-3 text-lg"
          >
            <Database className="h-4 w-4" />
            {props.isProcessing
              ? "Processing..."
              : props.isProcessCompleted
              ? "Start New Processing"
              : "Migrate"}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}