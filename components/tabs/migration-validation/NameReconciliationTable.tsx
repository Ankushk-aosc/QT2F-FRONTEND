"use client";

import React from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { useFluentStyles } from "./styles";

/**
 * Side-by-side reconciliation of Tableau names against their Power BI
 * counterparts, split into matched, missing and extra.
 *
 * Extracted from `MigrationValidationView` with its markup unchanged. The one
 * intentional difference: the heading previously carried a mojibake literal
 * (a UTF-8 emoji that had been decoded as Latin-1 at some point and saved back,
 * rendering as `ÃƒÂ°Ã…Â¸...`). It is now a Fluent icon, matching every other
 * section heading in this view.
 *
 * Returns null when there is nothing to reconcile, so a caller can render it
 * unconditionally.
 */

export interface NameReconciliationTableProps {
  /**
   * Per-category validation metrics. Shape is backend-defined and varies by
   * category, hence the loose typing and the alias tolerance below.
   */
  categoryMetrics: {
    original_names?: string[];
    matched_names?: string[];
    mapped_names?: string[];
    names?: string[];
    missing_names?: string[];
    extra_names?: string[];
  } | null | undefined;
}

export function NameReconciliationTable({ categoryMetrics }: NameReconciliationTableProps) {
  const fluentStyles = useFluentStyles();

  if (!categoryMetrics) return null;

  const originalNames = categoryMetrics.original_names || [];
  // The backend has used three names for this field across versions; accept all
  // of them rather than showing an empty table against older results.
  const matchedNames =
    categoryMetrics.matched_names || categoryMetrics.mapped_names || categoryMetrics.names || [];
  const missingNames = categoryMetrics.missing_names || [];
  const extraNames = categoryMetrics.extra_names || [];

  if (
    originalNames.length === 0 &&
    matchedNames.length === 0 &&
    missingNames.length === 0 &&
    extraNames.length === 0
  ) {
    return null;
  }

  return (
    <div className={fluentStyles.reconciliationCard}>
      <div className={fluentStyles.sectionLabel}>
        <FileText size={20} aria-hidden /> Name Reconciliation
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Name reconciliation table">
        <thead>
          <tr>
            <th className={fluentStyles.statusHeaderCell} style={{ textAlign: "left", padding: "8px" }}>Status</th>
            <th className={fluentStyles.headerCell} style={{ textAlign: "left", padding: "8px" }}>Tableau Name (Source)</th>
            <th className={fluentStyles.headerCell} style={{ textAlign: "left", padding: "8px" }}>Power BI Name (Target)</th>
          </tr>
        </thead>
        <tbody>
          {matchedNames.map((name: string, i: number) => (
            <tr key={`matched-${i}`}>
              <td style={{ padding: "8px" }}>
                <Badge variant="success">PASS</Badge>
              </td>
              <td className={fluentStyles.statusTextMatched} style={{ padding: "8px" }}>{name}</td>
              <td className={fluentStyles.statusTextMatched} style={{ padding: "8px" }}>{name}</td>
            </tr>
          ))}
          {missingNames.map((name: string, i: number) => (
            <tr key={`missing-${i}`}>
              <td style={{ padding: "8px" }}>
                <Badge variant="destructive">Missing</Badge>
              </td>
              <td className={fluentStyles.statusTextMissing} style={{ padding: "8px" }}>{name}</td>
              <td className={fluentStyles.statusTextPlaceholder} style={{ padding: "8px" }}>-</td>
            </tr>
          ))}
          {extraNames.map((name: string, i: number) => (
            <tr key={`extra-${i}`}>
              <td style={{ padding: "8px" }}>
                <Badge variant="warning">Extra</Badge>
              </td>
              <td className={fluentStyles.statusTextPlaceholder} style={{ padding: "8px" }}>-</td>
              <td className={fluentStyles.statusTextExtra} style={{ padding: "8px" }}>{name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
