"use client";

import React from "react";

import { useFluentStyles } from "./styles";

/**
 * Renders a block of technical text — SQL, an M query, a Tableau formula or a
 * join condition — with light reformatting and keyword highlighting.
 *
 * Extracted from `MigrationValidationView` unchanged in behaviour. It is purely
 * presentational: given the same string and label it produces the same markup,
 * and it holds no state and makes no requests.
 *
 * ## On `dangerouslySetInnerHTML`
 *
 * Highlighting wraps keywords in `<span>`s, which is why this sets HTML
 * directly. The input is validation output describing a customer's own
 * workbooks, but it is still not authored here, so the text is HTML-escaped
 * *before* any markup is added — the escape below must stay ahead of the
 * keyword pass, or a workbook containing a `<script>` tag in a calculated field
 * name would execute it.
 */

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON",
  "GROUP BY", "ORDER BY", "AND", "OR", "AS", "NOT", "NULL", "IS", "IN",
];

const M_KEYWORDS = [
  "let", "in", "if", "then", "else", "try", "otherwise", "error", "each",
  "type", "true", "false", "source", "import",
];

const FORMULA_KEYWORDS = [
  "FIXED", "INCLUDE", "EXCLUDE", "SUM", "AVG", "COUNT", "MIN", "MAX", "IF",
  "THEN", "ELSE", "END", "CASE", "WHEN", "FLOAT", "INT", "STRING",
];

/** Breaks a long single-line statement onto several lines so it can be read. */
function reflow(text: string, kind: { isSql: boolean; isMQuery: boolean; isFormula: boolean }): string {
  // Only reflow dense, genuinely unformatted blocks — text that already has
  // newlines was formatted by whoever wrote it and is left alone.
  if (text.length <= 50 || text.includes("\n")) return text;

  if (kind.isSql) {
    return text
      .replace(/SELECT /gi, "SELECT\n  ")
      .replace(/FROM /gi, "\nFROM ")
      .replace(/JOIN /gi, "\nJOIN ")
      .replace(/WHERE /gi, "\nWHERE ")
      .replace(/,/g, ",\n ");
  }
  if (kind.isMQuery) {
    return text
      .replace(/let /g, "let\n  ")
      .replace(/in /g, "\nin ")
      .replace(/, /g, ",\n  ");
  }
  if (kind.isFormula) {
    return text
      .replace(/ THEN /gi, " THEN\n  ")
      .replace(/ ELSE /gi, "\nELSE\n  ")
      .replace(/ END/gi, "\nEND");
  }
  return text;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface TechnicalContentProps {
  content: string;
  /** Drives which dialect's keywords are highlighted, e.g. "Custom SQL". */
  label: string;
}

export function TechnicalContent({ content, label }: TechnicalContentProps) {
  const fluentStyles = useFluentStyles();

  if (!content) return null;

  const text = String(content);
  const lowerLabel = label.toLowerCase();
  const isSql = lowerLabel.includes("sql");
  const isMQuery = lowerLabel.includes("m query");
  const isFormula = lowerLabel.includes("formula") || lowerLabel.includes("expression");
  const isJoin = lowerLabel.includes("join");

  const formatted = reflow(text, { isSql, isMQuery, isFormula });

  const keywords = isSql
    ? SQL_KEYWORDS
    : isMQuery
      ? M_KEYWORDS
      : isFormula || isJoin
        ? FORMULA_KEYWORDS
        : [];

  // Escape first, then highlight. Reversing these would let escaped markup be
  // reintroduced by the keyword spans.
  let highlighted = escapeHtml(formatted);
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, "g" + (isSql || isFormula || isJoin ? "i" : ""));
    highlighted = highlighted.replace(
      regex,
      `<span style="color: var(--primary); font-weight: 700;">$&</span>`,
    );
  }

  return (
    <div className={fluentStyles.codeBlock} dangerouslySetInnerHTML={{ __html: highlighted }} />
  );
}
