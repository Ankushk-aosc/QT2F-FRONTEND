"use client";

import React from "react";
import { Spinner } from "@/components/ui/spinner";
import { ProgressBar } from "@/components/ui/progress";

interface StageProgressProps {
  /** Human-readable label for the current stage (e.g. "Running Assessment…") */
  stageLabel: string;
  /** 0–1 decimal representing completion. Omit for indeterminate. */
  value?: number;
  /** Optional hint text shown below the bar */
  hint?: string;
}

/**
 * StageProgress – displays a labelled progress bar for the current pipeline stage.
 * Uses the shimmer-bar animation when indeterminate and the pulsing-dot indicator.
 */
export function StageProgress({ stageLabel, value, hint }: StageProgressProps) {
  return (
    <div className="stage-progress-container">
      <div className="stage-progress-header">
        <span className="stage-progress-dot" aria-hidden="true" />
        <span className="stage-progress-label">{stageLabel}</span>
      </div>
      {value !== undefined ? (
        <ProgressBar value={value} />
      ) : (
        <div className="shimmer-bar" role="progressbar" aria-label="Processing" />
      )}
      {hint && <span className="stage-progress-hint">{hint}</span>}
    </div>
  );
}
