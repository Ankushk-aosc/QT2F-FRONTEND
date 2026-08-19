"use client";

import React from "react";
import { Folder, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface QlikSpace {
  id: string;
  name: string;
}

interface QlikSpaceSelectorProps {
  selectedQlikSpace: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  qlikSpaces: QlikSpace[];
  isProcessing: boolean;
  hasProcessed: boolean;
  showNoAppsPopup: boolean;
  setShowNoAppsPopup: (show: boolean) => void;
  /** True while the space fetch is in flight. */
  isLoadingSpaces?: boolean;
  /** Message from a failed fetch, shown beneath the picker. */
  loadError?: string | null;
  /** Re-runs the fetch. Omit to hide the retry control. */
  onRetry?: () => void;
}

export function QlikSpaceSelectorContent({
  selectedQlikSpace,
  onChange,
  qlikSpaces,
  isProcessing,
  showNoAppsPopup,
  setShowNoAppsPopup,
  isLoadingSpaces = false,
  loadError = null,
  onRetry,
}: QlikSpaceSelectorProps) {
  const placeholderText = qlikSpaces.length > 0
    ? "Select a space"
    : isLoadingSpaces
    ? "Loading spaces..."
    : "No spaces available";

  return (
    <>
      <div className="space-y-1.5 w-full">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Select Qlik Space
        </label>
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            {isLoadingSpaces ? (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            ) : (
              <Folder className="w-4 h-4 text-blue-500" />
            )}
          </div>
          <select
            value={selectedQlikSpace}
            onChange={onChange}
            disabled={isProcessing || isLoadingSpaces}
            className={cn(
              "w-full pl-9 pr-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 shadow-xs appearance-none transition-all duration-200",
              "hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50/50 dark:hover:bg-slate-800/40",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
              (isProcessing || isLoadingSpaces) && "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800",
              loadError && !isLoadingSpaces && "border-rose-300 dark:border-rose-800"
            )}
          >
            <option value="" disabled>
              {placeholderText}
            </option>
            {qlikSpaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {loadError && !isLoadingSpaces && (
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

      {showNoAppsPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs z-50 animate-in fade-in-0 duration-200">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-88 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mx-auto">
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">No Applications Found</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                We couldn&apos;t find any applications in the selected Qlik space.
              </p>
            </div>
            <Button
              onClick={() => setShowNoAppsPopup(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
            >
              Understand
            </Button>
          </div>
        </div>
      )}
    </>
  );
}