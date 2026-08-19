"use client";

import React from "react";
import { CustomMultiSelect } from "@/components/ui/CustomMultiSelect";
import { QlikApp } from "@/types/assessment";

interface QlikAppsSelectorProps {
  selectedApps: string[];
  apps: QlikApp[];
  isProcessing: boolean;
  hasProcessed: boolean;
  dropdownOpen?: boolean;
  setDropdownOpen?: (open: boolean) => void;
  dropdownDirection?: "down" | "up";
  setDropdownDirection?: (direction: "down" | "up") => void;
  onAppSelection: (appId: string) => void;
  onRemoveApp: (appId: string) => void;
  dropdownRef?: React.RefObject<HTMLDivElement>;
}

export function QlikAppsSelectorContent({
  selectedApps,
  apps,
  isProcessing,
  onAppSelection,
  onRemoveApp,
}: QlikAppsSelectorProps) {
  const options = apps.map((app) => ({
    value: app.id,
    label: app.name,
  }));

  const handleSelectAll = () => {
    apps.forEach((app) => {
      if (!selectedApps.includes(app.id)) {
        onAppSelection(app.id);
      }
    });
  };

  const handleClearAll = () => {
    selectedApps.forEach((id) => {
      onRemoveApp(id);
    });
  };

  return (
    <CustomMultiSelect
      label="Select Applications"
      placeholder="Select applications"
      selectedValues={selectedApps}
      options={options}
      onSelect={onAppSelection}
      onRemove={onRemoveApp}
      onSelectAll={handleSelectAll}
      onClearAll={handleClearAll}
      disabled={isProcessing}
    />
  );
}