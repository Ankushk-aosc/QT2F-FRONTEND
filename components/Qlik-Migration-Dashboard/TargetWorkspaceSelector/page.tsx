"use client";

import React, { useState } from "react";
import { Dropdown, Option } from "@/components/ui/dropdown";
import { Label } from "@/components/ui/label";

interface Workspace {
  id: string;
  displayName: string;
}

interface TargetWorkspaceSelectorProps {
  selectedWorkspace: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  workspaces: Workspace[];
  isLoadingWorkspaces?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  isProcessing: boolean;
  hasProcessed: boolean;
  /** False until the Qlik source side (space + apps, or spaces) is fully picked. */
  isSourceConfigured?: boolean;
}

function ConfirmationPopup({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded-lg bg-white p-6 text-center shadow-lg">
        <h2 className="mb-4 text-lg font-bold">Start New Processing?</h2>
        <p className="mb-4">Do you want to start new processing?</p>
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover"
          >
            OK
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-surface-subtle px-4 py-2 text-foreground hover:bg-border"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function TargetWorkspaceSelectorContent({
  selectedWorkspace,
  onChange,
  workspaces,
  isLoadingWorkspaces,
  loadError,
  onRetry,
  isProcessing,
  hasProcessed,
}: TargetWorkspaceSelectorProps) {
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  // The upstream handler only ever reads e.target.value, so hand it a
  // matching shape rather than re-typing the whole prop chain.
  const handleSelect = (selectedId: string) => {
    const selectedWorkspaceData = workspaces.find((ws) => ws.id === selectedId);
    if (selectedWorkspaceData) {
      localStorage.setItem(
        "selected_workspace",
        JSON.stringify({ id: selectedWorkspaceData.id, displayName: selectedWorkspaceData.displayName })
      );
    }
    if (hasProcessed && !isProcessing) {
      setShowConfirmPopup(true);
    } else {
      onChange({ target: { value: selectedId } } as React.ChangeEvent<HTMLSelectElement>);
    }
  };

  const handleConfirm = () => {
    setShowConfirmPopup(false);
    window.location.reload();
  };

  const handleCancel = () => {
    setShowConfirmPopup(false);
  };

  return (
    <>
      <div>
        <Label className="text-success">Target Fabric Workspace</Label>
        {!isLoadingWorkspaces && loadError && (
          <div className="mb-2 rounded bg-destructive/10 p-2 text-xs text-destructive flex items-center justify-between">
            <span>{loadError}</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="font-medium underline ml-2 hover:opacity-80"
              >
                Retry
              </button>
            )}
          </div>
        )}
        <Dropdown
          placeholder="Select target workspace"
          selectedOptions={selectedWorkspace ? [selectedWorkspace] : []}
          onOptionSelect={(_, d) => handleSelect(d.optionValue as string)}
          disabled={isProcessing || isLoadingWorkspaces}
          className="w-full truncate"
        >
          {isLoadingWorkspaces ? (
            <Option disabled key="loading">Loading workspaces...</Option>
          ) : workspaces.length === 0 ? (
            <Option disabled key="no-data">No workspaces available — check the Fabric connection</Option>
          ) : (
            [...workspaces]
              .sort((a, b) => {
                const nameA = (a.displayName || "").toLowerCase();
                const nameB = (b.displayName || "").toLowerCase();
                if (nameA === "my workspace") return -1;
                if (nameB === "my workspace") return 1;
                return nameA.localeCompare(nameB);
              })
              .map((ws) => (
                <Option key={ws.id} value={ws.id} text={ws.displayName || ""}>
                  {ws.displayName}
                </Option>
              ))
          )}
        </Dropdown>
      </div>
      {showConfirmPopup && <ConfirmationPopup onConfirm={handleConfirm} onCancel={handleCancel} />}
    </>
  );
}
