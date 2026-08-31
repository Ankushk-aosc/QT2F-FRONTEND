"use client";

import React from "react";
import { Combobox, Option } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";

/**
 * Multi-select of whole Qlik spaces, for the "Entire Space" migration scope.
 *
 * Feeds `workspace_id: [...]` on POST /qlik/process-space, which takes an array
 * -- hence multi-select rather than the single-select used by the app scope.
 * "personal" is a legitimate space id here.
 */

interface QlikSpace {
  id: string;
  name: string;
}

interface QlikSpacesSelectorProps {
  selectedSpaces: string[];
  setSelectedSpaces: (ids: string[]) => void;
  qlikSpaces: QlikSpace[];
  /** True while the space list itself is in flight -- mirrors QlikAppsSelector's isFetchingApps. */
  isFetchingSpaces?: boolean;
  isProcessing: boolean;
}

export function QlikSpacesSelectorContent({
  selectedSpaces,
  setSelectedSpaces,
  qlikSpaces,
  isFetchingSpaces = false,
  isProcessing,
}: QlikSpacesSelectorProps) {
  // Same count-summary the apps selector uses, so both scopes present the same
  // way and the control keeps a fixed height regardless of how many are picked.
  const summary =
    selectedSpaces.length === 0
      ? ""
      : selectedSpaces.length === qlikSpaces.length
        ? `All (${selectedSpaces.length}) selected`
        : `${selectedSpaces.length} selected`;

  return (
    <div>
      <Label className="text-primary">Select Qlik Spaces</Label>
      <Combobox
        multiselect
        placeholder={isFetchingSpaces ? "Loading spaces…" : "Select spaces to migrate"}
        value={summary}
        selectedOptions={selectedSpaces}
        onOptionSelect={(_, d) => setSelectedSpaces(d.selectedOptions)}
        disabled={isProcessing || isFetchingSpaces}
        className="w-full [&_input]:truncate"
      >
        {/* The in-flight case has to come first. Without it an empty
            `qlikSpaces` during the fetch renders "No spaces available", so a
            slow tenant looks like an empty one. */}
        {isFetchingSpaces ? (
          <Option disabled key="loading">Loading spaces…</Option>
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
      </Combobox>
    </div>
  );
}
