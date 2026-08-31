"use client";

import React, { useState } from "react";
import { Combobox, Option } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { QlikApp } from "@/types/assessment";

interface QlikAppsSelectorProps {
  selectedApps: string[];
  apps: QlikApp[];
  isProcessing: boolean;
  /** True while the app list for the selected space is in flight. */
  isFetchingApps?: boolean;
  /** False until a Qlik space has been picked -- there is nothing to list yet. */
  isSpaceSelected: boolean;
  hasProcessed: boolean;
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  dropdownDirection: "down" | "up";
  setDropdownDirection: (direction: "right" | "up") => void;
  onAppSelection: (appId: string) => void;
  onRemoveApp: (appId: string) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
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

export function QlikAppsSelectorContent({
  selectedApps,
  apps,
  isProcessing,
  isFetchingApps = false,
  isSpaceSelected,
  hasProcessed,
  onAppSelection,
  onRemoveApp,
}: QlikAppsSelectorProps) {
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  // Fluent's multiselect Combobox hands back the full selection plus the option
  // that was just toggled, so derive add-vs-remove and keep the existing
  // onAppSelection / onRemoveApp parent API untouched.
  const handleOptionSelect = (optionValue: string | undefined, selected: string[]) => {
    if (!optionValue) return;
    if (hasProcessed && !isProcessing) {
      setShowConfirmPopup(true);
      return;
    }
    if (selected.includes(optionValue)) {
      onAppSelection(optionValue);
    } else {
      onRemoveApp(optionValue);
    }
  };

  const handleConfirm = () => {
    setShowConfirmPopup(false);
    window.location.reload();
  };

  const handleCancel = () => {
    setShowConfirmPopup(false);
  };

  // Mirrors T2F's "Select Workbook" multiselect Combobox: the field shows a
  // count rather than chips, which is what keeps its height identical to the
  // single-select dropdowns above it.
  const summary =
    selectedApps.length === 0
      ? ""
      : selectedApps.length === apps.length
        ? `All (${selectedApps.length}) selected`
        : `${selectedApps.length} selected`;

  return (
    <>
      <div>
        <Label className="text-primary">Select Applications</Label>
        <Combobox
          multiselect
          placeholder={
            !isSpaceSelected ? "Select a Qlik space first" : isFetchingApps ? "Loading applications…" : "Select applications"
          }
          value={summary}
          selectedOptions={selectedApps}
          onOptionSelect={(_, d) => handleOptionSelect(d.optionValue, d.selectedOptions)}
          disabled={isProcessing || isFetchingApps || !isSpaceSelected}
          className="w-full [&_input]:truncate"
        >
          {/* The in-flight case has to come first. Without it an empty `apps`
              during the fetch renders "No applications found.", so a slow space
              looks like an empty one. */}
          {!isSpaceSelected ? (
            <Option disabled key="no-space">Select a Qlik space first</Option>
          ) : isFetchingApps ? (
            <Option disabled key="loading">Loading applications…</Option>
          ) : apps.length === 0 ? (
            <Option disabled key="no-data">No applications found.</Option>
          ) : (
            [...apps]
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .map((app) => (
                <Option key={app.id} value={app.id} text={app.name}>
                  {app.name}
                </Option>
              ))
          )}
        </Combobox>
      </div>
      {showConfirmPopup && <ConfirmationPopup onConfirm={handleConfirm} onCancel={handleCancel} />}
    </>
  );
}
