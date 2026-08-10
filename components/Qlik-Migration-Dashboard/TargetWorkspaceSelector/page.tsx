"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Workspace {
  id: string;
  displayName: string;
}

interface TargetWorkspaceSelectorProps {
  selectedWorkspace: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  workspaces: Workspace[];
  isProcessing: boolean;
  hasProcessed: boolean;
}

// Confirmation Popup Component
const ConfirmationPopup: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-80 text-center">
        <h2 className="text-lg font-bold mb-4">Start New Processing?</h2>
        <p className="mb-4">Do you want to start new processing?</p>
        <div className="flex justify-center gap-4">
          <Button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            OK
          </Button>
          <Button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-black rounded-md hover:bg-gray-400"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export function TargetWorkspaceSelectorContent({
  selectedWorkspace,
  onChange,
  workspaces,
  isProcessing,
  hasProcessed,
}: TargetWorkspaceSelectorProps) {
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedWorkspaceData = workspaces.find((ws) => ws.id === selectedId);

    if (selectedWorkspaceData) {
      // Store both ID and displayName in localStorage
      localStorage.setItem(
        "selected_workspace",
        JSON.stringify({
          id: selectedWorkspaceData.id,
          displayName: selectedWorkspaceData.displayName,
        })
      );
    }

    if (hasProcessed && !isProcessing) {
      setShowConfirmPopup(true);
    } else {
      onChange(e);
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
      <div className="space-y-2">
        <label className="text-sm font-medium">Target Fabric Workspace</label>
        <div className="relative">
          <select
            value={selectedWorkspace}
            onChange={handleChange}
            className={cn(
              "w-full p-2 border rounded-md appearance-none bg-white",
              isProcessing && "opacity-60 cursor-not-allowed"
            )}
            disabled={isProcessing}
          >
            <option value="" disabled>
              {workspaces.length === 0 ? "Loading workspaces..." : "Select a workspace"}
            </option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.displayName}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none" />
        </div>
      </div>
      {showConfirmPopup && <ConfirmationPopup onConfirm={handleConfirm} onCancel={handleCancel} />}
    </>
  );
}