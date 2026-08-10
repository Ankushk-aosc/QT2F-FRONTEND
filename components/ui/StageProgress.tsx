"use client";

import React from "react";
import {
  makeStyles,
  tokens,
  ProgressBar,
  Text,
  Spinner,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "12px 0",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  label: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  hint: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground4,
  },
});

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
 * Used in QlikMigrationTab to communicate long-running agent operations.
 */
export function StageProgress({ stageLabel, value, hint }: StageProgressProps) {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Spinner size="tiny" />
        <Text className={styles.label}>{stageLabel}</Text>
      </div>
      <ProgressBar
        value={value}
        // If value is undefined, renders indeterminate
        thickness="medium"
        color="brand"
      />
      {hint && <Text className={styles.hint}>{hint}</Text>}
    </div>
  );
}
