"use client";

import React, { useState } from "react";
import { Dropdown, Option } from "@/components/ui/dropdown";
import { Label } from "@/components/ui/label";

interface QlikSpace {
  id: string;
  name: string;
}

interface QlikSpaceSelectorProps {
  selectedQlikSpace: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  qlikSpaces: QlikSpace[];
  /** True while the space list itself is in flight -- mirrors QlikAppsSelector's isFetchingApps. */
  isFetchingSpaces?: boolean;
  isLoadingSpaces?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  isProcessing: boolean;
  hasProcessed: boolean;
  showNoAppsPopup: boolean;
  setShowNoAppsPopup: (show: boolean) => void;
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

export function QlikSpaceSelectorContent({
  selectedQlikSpace,
  onChange,
  qlikSpaces,
  isFetchingSpaces = false,
  isLoadingSpaces,
  loadError,
  onRetry,
  isProcessing,
  hasProcessed,
  showNoAppsPopup,
  setShowNoAppsPopup,
}: QlikSpaceSelectorProps) {
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const loading = isFetchingSpaces || !!isLoadingSpaces;

  // The upstream handler only ever reads e.target.value, so hand it a
  // matching shape rather than re-typing the whole prop chain.
  const handleSelect = (spaceId: string) => {
    if (hasProcessed && !isProcessing) {
      setShowConfirmPopup(true);
    } else {
      onChange({ target: { value: spaceId } } as React.ChangeEvent<HTMLSelectElement>);
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
        <Label className="text-primary">Select Qlik Space</Label>
        {!loading && loadError && (
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
          placeholder="Select a space"
          selectedOptions={selectedQlikSpace ? [selectedQlikSpace] : []}
          onOptionSelect={(_, d) => handleSelect(d.optionValue as string)}
          disabled={isProcessing || loading}
          className="w-full"
        >
          {/* The in-flight case has to come first. Without it an empty
              `qlikSpaces` during the fetch renders "No spaces available", so a
              slow tenant looks like an empty one. */}
          {loading ? (
            <Option disabled key="loading">Loading spaces...</Option>
          ) : qlikSpaces.length === 0 ? (
            <Option disabled key="no-data">No spaces available</Option>
          ) : (
            [...qlikSpaces]
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((space) => (
                <Option key={space.id} value={space.id} text={space.name}>
                  {space.name}
                </Option>
              ))
          )}
        </Dropdown>
      </div>
      {showNoAppsPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg bg-white p-6 text-center shadow-lg">
            <h2 className="mb-4 text-lg font-bold">No Qlik Apps Found</h2>
            <p className="mb-4">We couldn&apos;t find any apps for the selected space.</p>
            <button
              type="button"
              onClick={() => setShowNoAppsPopup(false)}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary-hover"
            >
              OK
            </button>
          </div>
        </div>
      )}
      {showConfirmPopup && <ConfirmationPopup onConfirm={handleConfirm} onCancel={handleCancel} />}
    </>
  );
}
