"use client";

import React from "react";
import { Database, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  isLoadingWorkspaces?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
}

export function TargetWorkspaceSelectorContent({
  selectedWorkspace,
  onChange,
  workspaces,
  isProcessing,
  isLoadingWorkspaces = false,
  loadError = null,
  onRetry,
}: TargetWorkspaceSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedWorkspaceData = workspaces.find((ws) => ws.id === selectedId);

    if (selectedWorkspaceData) {
      localStorage.setItem(
        "selected_workspace",
        JSON.stringify({
          id: selectedWorkspaceData.id,
          displayName: selectedWorkspaceData.displayName,
        })
      );
    }

    onChange(e);
  };

  const placeholderText = workspaces.length > 0
    ? "Select a workspace"
    : isLoadingWorkspaces
    ? "Loading workspaces..."
    : "No workspaces available — check the Fabric connection";

  return (
    <div className="space-y-1.5 w-full">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Target Fabric Workspace
      </label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          {isLoadingWorkspaces ? (
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
          ) : (
            <Database className="w-4 h-4 text-indigo-500" />
          )}
        </div>
        <select
          value={selectedWorkspace}
          onChange={handleChange}
          disabled={isProcessing || isLoadingWorkspaces}
          className={cn(
            "w-full pl-9 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 shadow-xs appearance-none transition-all duration-200",
            "hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50/50 dark:hover:bg-slate-800/40",
            "focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500",
            (isProcessing || isLoadingWorkspaces) && "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800",
            loadError && !isLoadingWorkspaces && "border-rose-300 dark:border-rose-800"
          )}
        >
          <option value="" disabled>
            {placeholderText}
          </option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.displayName}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {loadError && !isLoadingWorkspaces && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{loadError}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold underline hover:no-underline ml-1 text-rose-700 dark:text-rose-300"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}