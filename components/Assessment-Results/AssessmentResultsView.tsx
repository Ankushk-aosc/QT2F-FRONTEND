"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  Code,
  Database,
  PieChart,
  Key,
  Table as TableIcon,
  AlertTriangle,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "@/components/ui/toaster";
import type { AssessmentData } from "@/types/assessment";
import {
  mapQlikAssessment,
  type ChallengePair,
  type ConnectionInfo,
  type KpiSheetGroup,
  type MasterItem,
  type QlikAssessment,
  type SectionAccessRule,
  type Tone,
  type VariableItem,
} from "@/lib/qlikAssessment";

/**
 * Assessment Results, rebuilt on T2F's AssessmentTab layout
 * (vl-t2f-frontend/components/tabs/AssessmentTab.tsx): page header, a
 * vl-metrics-grid of headline figures, then a vl-tabs-card whose panels are
 * vl-section-cards. Only the chrome is inherited — every figure below comes out
 * of the Qlik assessment payload via `lib/qlikAssessment.ts`, and the tab set is
 * Qlik's (apps, sheets, KPIs, Qlik load scripts) rather than Tableau's
 * (workbooks, worksheets, LODs, calculated fields).
 */

/** Strips the `_20250731_142530` style suffix the pipeline appends to folder names. */
/** `"2026-08-18T05:11:29.406Z"` → `"Aug 18, 2026"`; blank input passes through as "Unknown". */
const formatDate = (iso: string): string => {
  if (!iso) return "Unknown";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const removeTimestampFromFolderName = (folderName: string): string => {
  if (!folderName) return "Unknown";
  const cleaned = folderName
    .replace(/_?\d{8}_\d{6}/g, "")
    .replace(/_?\d{8}/g, "")
    .replace(/_?\d{4}-\d{2}-\d{2}/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned.trim() || "Unknown";
};

/* ──────────────────────────────────────────────────────────────
   Shared presentational pieces (T2F's vl-* vocabulary)
   ────────────────────────────────────────────────────────────── */

const SectionCard = ({
  title,
  icon,
  action,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Adds a chevron to the header and toggles the body's visibility on click. */
  collapsible?: boolean;
  /** Only read on mount, and only when collapsible. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="vl-section-card">
      <div
        className="vl-section-header"
        style={{
          justifyContent: action || collapsible ? "space-between" : undefined,
          cursor: collapsible ? "pointer" : undefined,
        }}
        onClick={collapsible ? () => setOpen((prev) => !prev) : undefined}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
          {icon}
          {title}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
          {action}
          {collapsible && (open ? <ChevronDown size={20} /> : <ChevronRight size={20} />)}
        </span>
      </div>
      {(!collapsible || open) && children}
    </div>
  );
};

/** Fluent's Badge `color` tones -> our variant set; "informative" has no exact match, so it falls back to "secondary". */
const toneToVariant = (tone: Tone): "default" | "secondary" | "destructive" | "success" | "warning" | "outline" => {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "destructive";
    case "informative":
    default:
      return "secondary";
  }
};

const InfoTile = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="vl-info-item">
    <div className="vl-info-label">{label}</div>
    <div className="vl-info-value">{value}</div>
  </div>
);

const EmptyState = ({ message }: { message: string }) => <div className="vl-empty-state">{message}</div>;

/**
 * T2F's muted "(N sheets)" / "(N)" suffix beside a collapsible card's title
 * (AssessmentTab.tsx: `styles.sectionHeader` + inline span), e.g. "Visual
 * Types (16 sheets)". Reused wherever a SectionCard header needs the same
 * count treatment.
 */
const TitleCount = ({ count, noun }: { count: number; noun: string }) => (
  <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px", fontWeight: 400 }}>
    ({count} {noun}
    {count === 1 ? "" : "s"})
  </span>
);

/**
 * The assessment's reasoning lines. Anything that reads as a caution
 * ("redesign", "significant", "high …") picks up T2F's amber breakdown styling
 * so a reader can scan a list of eight findings and see which three matter.
 */
const CAUTION_PATTERN = /redesign|restructur|significant|challeng|complex|unsupported|risk|effort/i;

const DetailList = ({ items, emptyMessage }: { items: string[]; emptyMessage: string }) => {
  if (items.length === 0) return <EmptyState message={emptyMessage} />;
  return (
    <div>
      {items.map((item, idx) => {
        const isCaution = CAUTION_PATTERN.test(item);
        // The bot writes "<headline> - <explanation>."; split on the first dash so
        // the headline can carry the weight, as T2F's breakdown rows do.
        const separator = item.indexOf(" - ");
        const label = separator > 0 ? item.slice(0, separator) : item;
        const description = separator > 0 ? item.slice(separator + 3) : "";
        return (
          <div key={idx} className={isCaution ? "vl-breakdown-item vl-breakdown-warning" : "vl-breakdown-item"}>
            <div className="vl-breakdown-text">
              <div className="vl-breakdown-label">{label}</div>
              {description && <div className="vl-breakdown-desc">{description}</div>}
            </div>
            {isCaution && <AlertTriangle size={20} style={{ color: "#b45309", flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
};

/** Collapsible block, matching T2F's expandable section rows. */
const Expandable = ({
  summary,
  defaultOpen = false,
  children,
}: {
  summary: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", marginBottom: "12px", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="vl-section-header-row"
        style={{
          width: "100%",
          background: "#f8fafc",
          border: "none",
          padding: "14px 18px",
          margin: 0,
          marginBottom: 0,
          textAlign: "left",
          font: "inherit",
        }}
      >
        {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        <div style={{ flex: 1 }}>{summary}</div>
      </button>
      {open && <div style={{ padding: "16px 18px", background: "#ffffff" }}>{children}</div>}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   Tab panels
   ────────────────────────────────────────────────────────────── */

const OverviewPanel = ({ data, appName }: { data: QlikAssessment; appName: string }) => (
  <>
    <SectionCard title="Application Information" icon={<LayoutGrid size={20} />}>
      <div className="vl-grid-2">
        <InfoTile label="Application" value={appName} />
        <InfoTile label="Source Platform" value={data.fileType} />
        <InfoTile label="Owner" value={data.ownerName || "Unknown"} />
        <InfoTile label="Space" value={data.spaceName || "Unknown"} />
        <InfoTile label="Dimension Model Type" value={data.dimensionalModelType || "Unknown"} />
        <InfoTile label="Last Modified" value={formatDate(data.lastModified)} />
      </div>
    </SectionCard>

    <SectionCard title="Content Summary" icon={<PieChart size={20} />}>
      <div className="vl-grid-3">
        <InfoTile label="Total Sheets" value={data.totalPages} />
        <InfoTile label="Tables" value={data.datasetCount} />
        <InfoTile label="Total Visualizations" value={data.visualCount} />
      </div>
    </SectionCard>
  </>
);

/**
 * Complexity / Criticality / Documentation ratings and the Dimensional Model's
 * free-text notes -- pulled out of Overview and Data Model respectively into
 * their own tab so those two panels stay focused on structured data (tiles,
 * tables) and this one holds the narrative findings.
 */
/** The same "tint" badge Query Complexity already showed, generalized to any rating. */
const RatingBadge = ({ rating }: { rating: { value: string; tone: Tone } | undefined }) =>
  rating ? (
    <Badge variant={toneToVariant(rating.tone)} style={{ fontSize: "14px", padding: "4px 14px" }}>
      {rating.value}
    </Badge>
  ) : null;

const KeyFindingsPanel = ({ data }: { data: QlikAssessment }) => {
  const complexityRating = data.ratings.find((r) => r.key === "complexity");
  const queryRating = data.ratings.find((r) => r.key === "query");
  const criticalityRating = data.ratings.find((r) => r.key === "criticality");
  const documentationRating = data.ratings.find((r) => r.key === "documentation");

  return (
  <>
    <SectionCard title="Complexity Findings" action={<RatingBadge rating={complexityRating} />} collapsible>
      <DetailList
        items={complexityRating?.details ?? []}
        emptyMessage="No complexity findings were reported."
      />
    </SectionCard>

    {/* Moved from Data Sources -- query-level findings belong with the rest
        of the narrative analysis, not beside the connection inventory. */}
    <SectionCard
      title="Query Complexity"
      action={<RatingBadge rating={queryRating} />}
      collapsible
      defaultOpen={false}
    >
      <div className="vl-grid-3" style={{ marginBottom: "20px" }}>
        <InfoTile label="Table Queries Analysed" value={data.queryFindings.length} />
        {/* Was "Subqueries Found", hardcoded to 0 for every app -- see
            customSqlCount's doc comment in lib/qlikAssessment.ts. This is
            Qlik's real analog to T2F's Custom SQL count: tables whose
            script passes raw SQL through rather than using pure Qlik
            LOAD/Resident logic. */}
        <InfoTile label="Custom SQL Queries" value={data.customSqlCount} />
        <InfoTile label="Overall Rating" value={queryRating?.value ?? "Unknown"} />
      </div>

      <DetailList items={data.queryNotes} emptyMessage="No query-level notes were reported." />
    </SectionCard>

    <SectionCard title="Business Criticality" action={<RatingBadge rating={criticalityRating} />} collapsible defaultOpen={false}>
      <DetailList
        items={criticalityRating?.details ?? []}
        emptyMessage="No criticality findings were reported."
      />
    </SectionCard>

    <SectionCard title="Metric Documentation" action={<RatingBadge rating={documentationRating} />} collapsible defaultOpen={false}>
      <DetailList
        items={documentationRating?.details ?? []}
        emptyMessage="No documentation findings were reported."
      />
    </SectionCard>

    {/* Dimensional Model has no risk/quality rating -- dimensionalModelType is
        its Qlik-reported classification (Star Schema, Snowflake, ...), the
        same headline value Data Model's "Model Structure" card already
        badges, informative rather than graded since a model shape is
        descriptive, not good/bad. */}
    <SectionCard
      title="Dimensional Model Notes"
      action={
        data.dimensionalModelType && (
          <span className="bg-primary-subtle text-primary" style={{ padding: "4px 14px", borderRadius: "999px", fontSize: "14px", fontWeight: 600 }}>
            {data.dimensionalModelType}
          </span>
        )
      }
      collapsible
      defaultOpen={false}
    >
      <DetailList items={data.dimensionalNotes} emptyMessage="No additional dimensional notes were reported." />
      <div style={{ marginTop: "16px" }}>
        <DetailList items={data.dataModelDetails} emptyMessage="No data model notes were reported." />
      </div>
    </SectionCard>
  </>
  );
};

/**
 * Master dimensions/measures -- the DAX-rewrite candidate list, and arguably
 * the most migration-relevant data in the whole payload. Both share this
 * shape: a dimension's expression sits under `field_defs`, a measure's under
 * `expression`, but `lib/qlikAssessment.ts` already normalises that into one
 * `MasterItem` shape.
 *
 * Rendered as a flat card list rather than a table -- T2F's `P_FieldsAndLODs`
 * (vl-t2f-frontend/components/tabs/ParsingTab.tsx) and Q2F's own Parsing ->
 * Dimensions/Measures tabs (Parsing-Results/shared.tsx's `ItemCard` +
 * `PaginatedList`) both show name/badges/expression this way instead of
 * nesting a `vl-code-block` inside a table cell, which is what made the old
 * table read as a stack of boxes.
 */
const MASTER_ITEM_PAGE_SIZE = 5;

const MasterItemList = ({ items, emptyMessage }: { items: MasterItem[]; emptyMessage: string }) => {
  const [page, setPage] = useState(0);
  if (items.length === 0) return <EmptyState message={emptyMessage} />;

  const totalPages = Math.ceil(items.length / MASTER_ITEM_PAGE_SIZE);
  const needsPagination = items.length > MASTER_ITEM_PAGE_SIZE;
  const pageItems = needsPagination
    ? items.slice(page * MASTER_ITEM_PAGE_SIZE, (page + 1) * MASTER_ITEM_PAGE_SIZE)
    : items;

  return (
    <div>
      {pageItems.map((item, idx) => (
        <div key={`${item.name}-${idx}`} className="vl-info-item" style={{ marginBottom: "12px", backgroundColor: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "14px", color: "#0f172a" }}>{item.name}</strong>
            <Badge variant="outline">
              {item.dataType}
            </Badge>
            {item.tables.length > 0 && (
              <span style={{ fontSize: "12px", color: "#64748b" }}>Tables: {item.tables.join(", ")}</span>
            )}
          </div>
          <pre className="vl-code-block" style={{ margin: 0 }}>
            {item.expression || "—"}
          </pre>
        </div>
      ))}
      {needsPagination && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", padding: "12px 0", fontSize: "13px", color: "#64748b" }}>
          <span>
            Page {page + 1} of {totalPages} ({Math.min((page + 1) * MASTER_ITEM_PAGE_SIZE, items.length)} of {items.length} items)
          </span>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === 0 ? "#f8fafc" : "#ffffff", color: page === 0 ? "#cbd5e1" : "#666666", cursor: page === 0 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page >= totalPages - 1 ? "#f8fafc" : "#ffffff", color: page >= totalPages - 1 ? "#cbd5e1" : "#666666", cursor: page >= totalPages - 1 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

const DataModelPanel = ({ data }: { data: QlikAssessment }) => {
  return (
  <>
    <SectionCard
      title="Model Structure"
      icon={<TableIcon size={20} />}
      action={
        <span className="bg-primary-subtle text-primary" style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 600 }}>
          {data.dimensionalModelType}
        </span>
      }
    >
      {data.dataModelStats && (
        <div className="vl-list-item" style={{ marginBottom: "20px" }}>
          <span style={{ color: "#64748b" }}>Reported model stats</span>
          <strong>{data.dataModelStats}</strong>
        </div>
      )}
      <div className="vl-grid-2">
        <InfoTile label="Fact Tables" value={data.factCount} />
        <InfoTile label="Dimension Tables" value={data.dimensionCount} />
      </div>
    </SectionCard>

    <SectionCard
      title="Master Dimensions"
      icon={<PieChart size={20} />}
      action={
        <Badge variant={data.masterDimensionCount > 0 ? "default" : "secondary"}>
          {data.masterDimensionCount} defined
        </Badge>
      }
    >
      <MasterItemList items={data.masterDimensions} emptyMessage="No master dimensions were reported for this app." />
    </SectionCard>

    <SectionCard
      title="Master Measures"
      icon={<Code size={20} />}
      action={
        <Badge variant={data.masterMeasureCount > 0 ? "default" : "secondary"}>
          {data.masterMeasureCount} defined
        </Badge>
      }
    >
      <MasterItemList items={data.masterMeasures} emptyMessage="No master measures were reported for this app." />
    </SectionCard>
  </>
  );
};

/**
 * Splits one Section Access rule's `fields` into the pieces the table below
 * renders: the access-level field (ADMIN/USER…), the email/identity field(s)
 * ("Applies To"), and whatever reduction field(s) remain ("Condition"). Uses
 * the bot's own `securityFields`/`reductionFields` classification rather than
 * guessing from field names, except for telling an identity field (email)
 * apart from a genuine reduction condition, which the payload doesn't
 * distinguish itself -- Qlik's own naming convention (a field with "email" in
 * it) is the only signal available.
 */
/**
 * "SECTION_ACCESS" -> "Section Access". `rule.table` is the raw Qlik load
 * script table name (SECTION_ACCESS is a reserved, always-uppercase
 * convention there), which read fine in a script but as a UI heading looked
 * like an untranslated constant next to the rest of this panel's normal
 * title casing.
 */
function formatSectionAccessTableName(table: string): string {
  return table
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function analyseSectionAccessRule(rule: SectionAccessRule) {
  const accessField = rule.securityFields[0] ?? rule.fields.find((f) => /^access$/i.test(f)) ?? "";
  const emailFields = rule.fields.filter((f) => /email/i.test(f));
  const conditionFields = rule.reductionFields.filter((f) => !emailFields.includes(f));
  return { accessField, emailFields, conditionFields };
}

/**
 * Groups one rule's rows by their "Applies To" value, so the UI can show one
 * collapsible section per distinct grantee -- as many as the data actually
 * has -- instead of repeating "Applies To" as a table column on every row.
 *
 * A row with no email at all forms its own "Unassigned" group. A row naming
 * more than one email is keyed on the exact combined value (joined, in
 * field order) rather than split across each email's group -- "unique
 * values" means unique Applies-To content, not unique individual emails.
 */
function groupRowsByAppliesTo(
  rows: Array<Record<string, string>>,
  emailFields: string[],
): Array<{ appliesTo: string; emails: string[]; rows: Array<Record<string, string>> }> {
  const groups = new Map<string, { emails: string[]; rows: Array<Record<string, string>> }>();
  for (const row of rows) {
    const emails = emailFields.map((field) => row[field]).filter(Boolean);
    const key = emails.length > 0 ? emails.join(", ") : "—";
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { emails, rows: [row] });
  }
  return Array.from(groups, ([appliesTo, { emails, rows }]) => ({ appliesTo, emails, rows }));
}

/**
 * Qlik's row-level security (Section Access). Shares its visual pattern —
 * flat rule table with Field / Access Type / Condition / Applies To columns,
 * grouped by table when a run has more than one — with the Parsing
 * Permissions tab, since both surface the same underlying `sectionAccess`
 * data for the same feature.
 */
/**
 * `"change_owner"` -> `"Change Owner"`. Qlik's privilege ids are snake_case;
 * T2F's Tableau capability names (ShareView, ExportImage, …) already arrive
 * readable, so this is the equivalent formatting step for Qlik's own shape.
 */
const formatPrivilege = (raw: string): string =>
  raw
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * T2F reference: vl-t2f-frontend/components/tabs/ParsingTab.tsx's
 * `P_Permissions` "Workbook Permissions" card (collapsible header with a
 * count suffix, a light rounded box per grantee, a 2-column grid of
 * capability pills each tinted green/red for Allow/Deny).
 *
 * Qlik's `metadata.metadata.privileges` has no grantee concept at all -- it's
 * one flat list of privilege ids the app carries, not T2F's per-grantee
 * Allow/Deny capability set -- so the grantee identity row (Badge + "ID:- …")
 * is dropped and every privilege renders as an Allow pill straight in the
 * grid, since the payload only ever lists what's granted.
 */
const AppPrivilegesPanel = ({ data }: { data: QlikAssessment }) => (
  <SectionCard
    title={
      <>
        App Privileges
        <TitleCount count={data.privileges.length} noun="privilege" />
      </>
    }
    icon={<Key size={20} />}
    collapsible
  >
    {data.privileges.length === 0 ? (
      <EmptyState message="No privileges were reported for this app." />
    ) : (
      <div
        style={{
          padding: "16px",
          background: "#f8fafc",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
          {data.privileges.map((privilege) => (
            <div
              key={privilege}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "#f0fdf4",
                borderRadius: "8px",
                border: "1px solid #bbf7d0",
              }}
            >
              <span style={{ fontSize: "14px", color: "#1e293b" }}>{formatPrivilege(privilege)}</span>
              <Badge variant="success" style={{ fontSize: "11px" }}>
                ALLOW
              </Badge>
            </div>
          ))}
        </div>
      </div>
    )}
  </SectionCard>
);

const SecurityPanel = ({ data }: { data: QlikAssessment }) => (
  <>
  <SectionCard title="Security (Section Access)" icon={<Key size={20} />} collapsible defaultOpen={false}>
    {!data.hasSectionAccess || data.sectionAccess.length === 0 ? (
      <EmptyState message="No row-level security rules defined for this app." />
    ) : (
      data.sectionAccess.map((rule, ruleIdx) => {
        const { accessField, emailFields, conditionFields } = analyseSectionAccessRule(rule);
        // One nested collapsible per unique "Applies To" value below -- the
        // parent badge counts those groups (distinct accounts), not the raw
        // rule rows, so it reads as "how many accounts have rules here"
        // rather than a number that double-counts an account with several
        // conditions.
        const groups = groupRowsByAppliesTo(rule.rows, emailFields);
        return (
          <Expandable
            key={`${rule.table}-${ruleIdx}`}
            defaultOpen={ruleIdx === 0}
            summary={
              <span style={{ display: "inline-flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <strong style={{ color: "#0f172a" }}>
                  {rule.table ? formatSectionAccessTableName(rule.table) : `Section Access Rule ${ruleIdx + 1}`}
                </strong>
                <Badge variant="secondary">
                  {groups.length} account{groups.length === 1 ? "" : "s"}
                </Badge>
              </span>
            }
          >
            {/* One nested collapsible per unique "Applies To" value, rather
                than repeating it as a table column on every row -- as many
                sections as the data actually has distinct grantees for. */}
            {groups.map((group, groupIdx) => (
              <Expandable
                key={`${group.appliesTo}-${groupIdx}`}
                defaultOpen={groupIdx === 0}
                summary={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    {group.emails.length === 0 ? (
                      <span style={{ color: "#94a3b8", fontWeight: 600 }}>Unassigned</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {group.emails.map((email, emailIdx) => (
                          <Badge
                            key={emailIdx}
                            variant="outline"
                            style={{
                              height: "auto",
                              maxWidth: "100%",
                              whiteSpace: "normal",
                              wordBreak: "break-all",
                              lineHeight: 1.4,
                              padding: "4px 10px",
                              textAlign: "center",
                              fontWeight: 700,
                            }}
                          >
                            {email}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Badge variant="secondary">
                      {group.rows.length} rule{group.rows.length === 1 ? "" : "s"}
                    </Badge>
                  </span>
                }
              >
                <div className="vl-table-container" style={{ marginTop: 0 }}>
                  <table aria-label={`Section access rules applying to ${group.appliesTo}`}>
                    <thead>
                      <tr>
                        <th className="vl-table-header-cell">Field</th>
                        <th className="vl-table-header-cell">Access Type</th>
                        <th className="vl-table-header-cell">Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row, rowIdx) => {
                        const accessValue = accessField ? row[accessField] ?? "" : "";
                        const isFullAccess = /admin/i.test(accessValue);
                        const conditionValue = conditionFields
                          .map((field) => row[field])
                          .filter(Boolean)
                          .join(" / ");
                        return (
                          <tr key={rowIdx}>
                            <td className="vl-wrap-cell" style={{ fontWeight: 600 }}>
                              {conditionFields.join(", ") || accessField || "—"}
                            </td>
                            <td className="vl-wrap-cell">
                              <Badge variant={isFullAccess ? "success" : "warning"}>
                                {accessValue || "Unknown"}
                              </Badge>
                            </td>
                            <td className="vl-wrap-cell">
                              {conditionValue ? (
                                <pre className="vl-code-block" style={{ margin: 0 }}>
                                  {conditionValue}
                                </pre>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Expandable>
            ))}
          </Expandable>
        );
      })
    )}
  </SectionCard>
  <AppPrivilegesPanel data={data} />
  </>
);

/**
 * T2F reference: ParsingTab.tsx's P_Params "Parameters" card -- a light-grey
 * "Total N" banner row above the table (fontWeight 600/15px label, 17px bold
 * count), then a Name(+muted caption)/Current Value(mono)/-type table.
 * Replicated 1:1 for spacing, typography, and the banner; the Allowable
 * Values column T2F shows has no Qlik analogue -- Qlik variables carry no
 * allowable-value list in the mapped data (VariableItem has no such field),
 * so it's dropped rather than fabricated, and the Type badge Q2F already had
 * (System/User-defined) takes its place instead.
 */
const VariablesTable = ({ items }: { items: VariableItem[] }) => {
  if (items.length === 0) return <EmptyState message="No variables were reported for this app." />;
  return (
    <div className="vl-table-container">
      <table aria-label="Variables">
        <thead>
          <tr>
            <th className="vl-table-header-cell">Name</th>
            <th className="vl-table-header-cell">Current Value</th>
            <th className="vl-table-header-cell">Type</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={`${item.name}-${idx}`}>
              <td className="vl-wrap-cell">
                <div>
                  <strong style={{ color: "#0f172a" }}>{item.name}</strong>
                  {item.description && (
                    <>
                      <br />
                      <span style={{ fontSize: "10px", color: "#64748b" }}>{item.description}</span>
                    </>
                  )}
                </div>
              </td>
              <td className="vl-wrap-cell" style={{ fontFamily: "monospace", fontSize: "13px" }}>
                {item.definition || "—"}
              </td>
              <td className="vl-wrap-cell">
                <Badge variant={item.isReserved ? "secondary" : "default"}>
                  {item.isReserved ? "System" : "User-defined"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const VariablesPanel = ({ data }: { data: QlikAssessment }) => (
  <SectionCard title="Variables" icon={<Code size={20} />}>
    <div
      style={{
        padding: "12px 16px",
        background: "#f1f5f9",
        borderRadius: "6px",
        marginBottom: "16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontWeight: 600, fontSize: "15px" }}>Total Variables</span>
      <strong style={{ fontSize: "17px" }}>{data.variableCount}</strong>
    </div>
    <VariablesTable items={data.variables} />
  </SectionCard>
);

/**
 * T2F reference: vl-t2f-frontend/components/tabs/AssessmentTab.tsx's
 * "Detailed Connections" card (Total Connections banner + a Datasource /
 * Type / Server / Database table). Q2F's `ConnectionInfo` has no logical vs.
 * physical split, so every entry is one row rather than T2F's
 * datasource-groups-connections nesting, and the "Type" column reads
 * `sourceConnector` (Qlik's connector id, e.g. "redshift") in place of T2F's
 * `connection_type`.
 */
const DetailedConnectionsCard = ({ connections }: { connections: ConnectionInfo[] }) => (
  <SectionCard title="Detailed Connections" icon={<Database size={20} />}>
    {connections.length === 0 ? (
      <EmptyState message="No database connections were reported for this app." />
    ) : (
      <>
        <div className="vl-list-item" style={{ marginBottom: "16px" }}>
          <span style={{ color: "#64748b" }}>Total Connections</span>
          <strong style={{ fontSize: "17px" }}>{connections.length}</strong>
        </div>
        <div className="vl-table-container">
          <table aria-label="Detailed connections">
            <thead>
              <tr>
                <th className="vl-table-header-cell">Datasource</th>
                <th className="vl-table-header-cell">Type</th>
                <th className="vl-table-header-cell">Server</th>
                <th className="vl-table-header-cell">Database</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((connection, idx) => (
                <tr key={`${connection.name}-${idx}`}>
                  <td className="vl-wrap-cell" style={{ fontWeight: 600 }}>
                    {connection.name || `Connection ${idx + 1}`}
                  </td>
                  <td className="vl-wrap-cell">
                    {connection.sourceConnector ? (
                      <Badge variant="default">
                        {connection.sourceConnector}
                      </Badge>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td className="vl-wrap-cell" style={{ color: connection.server ? "#475569" : "#94a3b8" }}>
                    {connection.server || "—"}
                  </td>
                  <td className="vl-wrap-cell" style={{ color: connection.database ? "#475569" : "#94a3b8" }}>
                    {connection.database || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: "12px", fontSize: "12px", color: "#64748b" }}>
          Showing {connections.length} connection{connections.length !== 1 ? "s" : ""}.
        </div>
      </>
    )}
  </SectionCard>
);

const DataSourcesPanel = ({ data }: { data: QlikAssessment }) => {
  return <DetailedConnectionsCard connections={data.connections} />;
};

/**
 * Widened to every visualization type the Visualizations category reports
 * (kpi, barchart, linechart, piechart, filterpane, sn-table, gauge,
 * scatterplot, treemap, boxplot, extension charts…), not just `kpi` tiles --
 * `lib/qlikAssessment.ts` used to filter everything else out before it
 * reached this panel. Overview's "Total KPIs" tile stays scoped to true KPI
 * tiles (`data.kpiCount`); this tab is the full inventory.
 */
const VisualsPanel = ({ data }: { data: QlikAssessment }) => {
  const visualTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const visual of data.visuals) counts.set(visual.visualizationType, (counts.get(visual.visualizationType) ?? 0) + 1);
    return Array.from(counts, ([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [data.visuals]);

  return (
    <>
      {/* T2F reference: AssessmentTab.tsx's "Visual Overview" card -- a
          collapsible chevron header over the stat tiles, with the type
          breakdown broken out into its own card below rather than tacked on
          underneath. */}
      <SectionCard title="Visual Overview" icon={<PieChart size={20} />} collapsible>
        <div className="vl-grid-2">
          <InfoTile label="Total Visualizations" value={data.visualCount} />
          <InfoTile label="Sheets With Visuals" value={data.sheetsWithVisuals} />
        </div>
      </SectionCard>

      {/* T2F's "Visual Types (N sheets)" card lists one row per sheet with its
          dominant chart type; a Qlik sheet freely mixes types, so there is no
          single "sheet type" to list. This reads the app's type inventory
          instead -- one row per visualization type with its total count --
          in the same collapsible-card-with-count-suffix and vl-info-item row
          styling T2F uses. */}
      <SectionCard
        title={
          <>
            Visual Types
            <TitleCount count={visualTypes.length} noun="type" />
          </>
        }
        icon={<LayoutGrid size={20} />}
        collapsible
        defaultOpen={false}
      >
        {visualTypes.length === 0 ? (
          <EmptyState message="No visualizations were detected in this app." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {visualTypes.map((entry) => (
              <div
                key={entry.type}
                className="vl-info-item"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span style={{ fontSize: "15px", fontWeight: 500, color: "#1e293b" }}>{entry.type}</span>
                <Badge variant="default">
                  {entry.count}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={
          <>
            Visualizations by Sheet
            <TitleCount count={data.visualsBySheet.length} noun="sheet" />
          </>
        }
        icon={<TableIcon size={20} />}
        collapsible
        defaultOpen={false}
      >
        {data.visualsBySheet.length === 0 ? (
          <EmptyState message="No visualizations were detected in this app." />
        ) : (
          data.visualsBySheet.map((group, idx) => (
            <Expandable
              key={group.sheetName}
              defaultOpen={idx === 0}
              summary={
                <span style={{ display: "inline-flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <strong style={{ color: "#0f172a" }}>{group.sheetName}</strong>
                  <Badge variant="default">
                    {group.kpis.length} visualization{group.kpis.length === 1 ? "" : "s"}
                  </Badge>
                </span>
              }
            >
              <div className="vl-table-container" style={{ marginTop: 0 }}>
                <table aria-label={`Visualizations on ${group.sheetName}`}>
                  <thead>
                    <tr>
                      <th className="vl-table-header-cell">Object ID</th>
                      <th className="vl-table-header-cell">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.kpis.map((visual, visualIdx) => (
                      <tr key={`${visual.title}-${visualIdx}`}>
                        <td
                          className="vl-wrap-cell"
                          style={{ fontFamily: "'Cascadia Code', 'Consolas', monospace", fontSize: "13px" }}
                        >
                          {visual.title || "—"}
                        </td>
                        <td className="vl-wrap-cell">
                          <Badge variant="secondary">
                            {visual.visualizationType}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Expandable>
          ))
        )}
      </SectionCard>

      {/*
        T2F reference: AssessmentTab.tsx's "Formatting & Styling" card's
        "Unique Custom Colors" swatch grid + "Custom Colors & Sheets Using
        Them" list. Narrower than T2F's version by necessity: Qlik's
        `colours_used` is mostly palette *index* references into a theme
        resource this payload never includes, so most colors can't be
        resolved to an actual value. Only entries where the user picked a
        color outside the palette (`index: -1`, carrying a literal hex
        `color`) are real -- see `extractLiteralColors` in lib/qlikAssessment.ts.
        Scoped per-visual rather than workbook-wide for the same reason.
      */}
      <SectionCard
        title={
          <>
            Custom Colors
            <TitleCount count={data.customColors.length} noun="color" />
          </>
        }
        collapsible
        defaultOpen={false}
      >
        {data.customColors.length === 0 ? (
          <EmptyState message="No custom (non-palette) colors were detected on this app's visuals." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.customColors.map((entry) => (
              <div
                key={entry.color}
                className="vl-info-item"
                style={{ display: "flex", alignItems: "center", gap: "16px" }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    backgroundColor: entry.color,
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }}
                  title={entry.color}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", fontFamily: "'Cascadia Code', 'Consolas', monospace" }}>
                    {entry.color}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", wordBreak: "break-word" }}>
                    Used in: {entry.visuals.join(" • ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
};

/**
 * T2F's Challenges tab is a Challenge / Risk Mitigation pair per row. The Qlik
 * payload has no mitigation field, so the right column carries the Power BI
 * Replicability line covering the same topic — see `pairChallenges`.
 */
const ChallengesPanel = ({ data }: { data: QlikAssessment }) => {
  const sensitivity = data.ratings.find((r) => r.key === "sensitivity");
  const migration = data.ratings.find((r) => r.key === "migration");

  return (
    <>
      <SectionCard
        title="Migration Challenges"
        icon={<AlertTriangle size={20} />}
        action={
          migration && (
            <Badge variant={toneToVariant(migration.tone)} style={{ fontSize: "14px", padding: "4px 14px" }}>
              {migration.value}
            </Badge>
          )
        }
      >
        {data.challenges.length === 0 ? (
          <EmptyState message="No migration challenges were identified for this app." />
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "16px", padding: "0 16px" }}>
              <div style={{ textAlign: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: "#fef2f2",
                    color: "#b91c1c",
                    padding: "6px 20px",
                    borderRadius: "24px",
                    fontWeight: 700,
                    fontSize: "14px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    border: "1px solid #fecaca",
                  }}
                >
                  Challenge
                </span>
              </div>
              <div style={{ textAlign: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: "#f0fdf4",
                    color: "#15803d",
                    padding: "6px 20px",
                    borderRadius: "24px",
                    fontWeight: 700,
                    fontSize: "14px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  Power BI Outlook
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {data.challenges.map((pair: ChallengePair, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    background: "#ffffff",
                    borderRadius: "20px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                    border: "1px solid #f1f5f9",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "24px 28px",
                      borderRight: "1px dashed #e2e8f0",
                      background: "linear-gradient(180deg, #fffafa 0%, #ffffff 100%)",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "24px",
                        bottom: "24px",
                        width: "4px",
                        background: "linear-gradient(to bottom, #ef4444, #fca5a5)",
                        borderTopRightRadius: "4px",
                        borderBottomRightRadius: "4px",
                      }}
                    />
                    <ul style={{ margin: 0, paddingLeft: "24px", color: "#1e293b", fontSize: "15px", lineHeight: 1.7 }}>
                      <li>{pair.challenge}</li>
                    </ul>
                  </div>
                  <div
                    style={{
                      padding: "24px 28px",
                      background: "linear-gradient(180deg, #f7fdf9 0%, #ffffff 100%)",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "24px",
                        bottom: "24px",
                        width: "4px",
                        background: "linear-gradient(to bottom, #22c55e, #86efac)",
                        borderTopRightRadius: "4px",
                        borderBottomRightRadius: "4px",
                      }}
                    />
                    <ul style={{ margin: 0, paddingLeft: "24px", color: "#334155", fontSize: "15px", lineHeight: 1.7 }}>
                      <li>{pair.replicabilityNote || "-"}</li>
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Data Sensitivity"
        action={
          sensitivity && (
            <Badge variant={toneToVariant(sensitivity.tone)} style={{ fontSize: "14px", padding: "4px 14px" }}>
              {sensitivity.value}
            </Badge>
          )
        }
      >
        <DetailList items={sensitivity?.details ?? []} emptyMessage="No sensitivity findings were reported." />
      </SectionCard>
    </>
  );
};

/* ──────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────── */

interface AssessmentResultsViewProps {
  assessmentItem?: {
    appId?: string;
    appName?: string;
    assessmentData?: AssessmentData;
    [key: string]: unknown;
  };
  assessmentData?: AssessmentData;
  appName?: string;
  isPdfMode?: boolean;
}

// T2F's Formatting & Styling tab (fonts/colors/borders) has no Qlik-schema
// analog -- confirmed absent from assessment-example.json and decided out of
// scope 2026-08-18.
//
// Power BI Readiness (Power BI Replicability / Data Volume / Unsupported Data
// Types) removed 2026-08-18 per explicit request -- that content isn't shown
// anywhere else in Assessment.
const TABS = [
  { value: "overview", label: "Overview" },
  { value: "model", label: "Data Model" },
  { value: "security", label: "Security" },
  { value: "variables", label: "Variables" },
  { value: "sources", label: "Data Sources" },
  { value: "visuals", label: "Visuals & KPIs" },
  { value: "key-findings", label: "Key Findings" },
  { value: "challenges", label: "Challenges & Risks" },
] as const;

export default function AssessmentResultsView({
  assessmentItem,
  assessmentData: assessmentDataProp,
  appName: appNameProp,
  isPdfMode = false,
}: AssessmentResultsViewProps) {
  const [selectedTab, setSelectedTab] = useState<string>("overview");
  const [stored, setStored] = useState<{ data: AssessmentData; appName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const propData = assessmentItem?.assessmentData ?? assessmentDataProp ?? null;

  // Same storage fallback the previous Assessment Results page used, so this
  // stays a drop-in replacement for callers that navigate in without props.
  useEffect(() => {
    if (propData) {
      setLoading(false);
      return;
    }
    const readStore = (raw: string | null) => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        const entry = Array.isArray(parsed) ? parsed[0] : parsed;
        const candidate: AssessmentData | undefined = entry?.assessmentData ?? entry;
        if (candidate?.results && Array.isArray(candidate.results)) {
          return { data: candidate, appName: entry?.appName || candidate.report_name || "Unknown Application" };
        }
      } catch {
        /* fall through to the next source */
      }
      return null;
    };

    setStored(
      readStore(localStorage.getItem("assessment_data")) ?? readStore(sessionStorage.getItem("assessmentResults")),
    );
    setLoading(false);
  }, [propData]);

  const rawData = propData ?? stored?.data ?? null;
  const data = useMemo(() => mapQlikAssessment(rawData), [rawData]);
  const appName = appNameProp || assessmentItem?.appName || stored?.appName || removeTimestampFromFolderName(data.reportName);

  const downloadAsPDF = () => {
    if (!rawData) {
      toast("error", "No assessment data available to generate PDF.");
      return;
    }
    setDownloading(true);
    try {
      const doc = new jsPDF();
      let y = 12;
      const line = (text: string, size = 11, bold = false) => {
        doc.setFontSize(size);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        for (const wrapped of doc.splitTextToSize(text, 180) as string[]) {
          if (y > 280) {
            doc.addPage();
            y = 12;
          }
          doc.text(wrapped, 10, y);
          y += size * 0.55;
        }
        y += 2;
      };

      line(`Assessment Report: ${appName}`, 16, true);
      line(`Source platform: ${data.fileType}  |  Generated: ${new Date().toLocaleString()}`, 10);

      line("Content Summary", 13, true);
      line(
        `Sheets: ${data.totalPages}   KPIs: ${data.kpiCount}   Sheets with KPIs: ${data.sheetsWithKpis}   ` +
          `Tables: ${data.datasetCount}   Fields: ${data.totalFields}   Keys: ${data.totalKeys}`,
      );

      // "volume"/"unsupported" excluded: those were Power BI Readiness-only
      // ratings, and that tab (and data.powerBi entirely) was removed
      // 2026-08-18 -- the PDF should match what the UI actually shows.
      const shownRatings = data.ratings.filter((r) => r.key !== "volume" && r.key !== "unsupported");
      line("Assessment Ratings", 13, true);
      for (const rating of shownRatings) line(`${rating.label}: ${rating.value}`);
      line(`Dimensional Model: ${data.dimensionalModelType}`);

      line("Data Model", 13, true);
      line(`Structure: ${data.dataModelStructure}${data.dataModelStats ? ` (${data.dataModelStats})` : ""}`);
      for (const dataset of data.datasets) {
        line(`${dataset.name} — ${dataset.role}, ${dataset.fieldCount} fields, ${dataset.keyCount} keys`);
      }

      line("Connections", 13, true);
      for (const connection of data.connections) {
        const parts = [
          connection.name && `name: ${connection.name}`,
          connection.database && `database: ${connection.database}`,
          connection.driver && `driver: ${connection.driver}`,
          connection.server && `server: ${connection.server}`,
          connection.sourceConnector && `source connector: ${connection.sourceConnector}`,
        ].filter(Boolean);
        line(parts.length > 0 ? parts.join(", ") : "No connection attributes reported");
      }

      for (const rating of shownRatings) {
        if (rating.details.length === 0) continue;
        line(`${rating.label} — ${rating.value}`, 13, true);
        for (const detail of rating.details) line(`- ${detail}`);
      }

      doc.save(`Assessment_Report_${appName}_${new Date().toISOString().split("T")[0]}.pdf`);
      toast("success", "PDF downloaded successfully!");
    } catch (error) {
      toast("error", `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="vl-container">
        <span style={{ fontSize: "16px" }}>Loading assessment data…</span>
      </div>
    );
  }

  if (!rawData) {
    return (
      <div className="vl-container">
        <div className="vl-header">
          <div className="vl-title">Assessment Results</div>
          <div className="vl-subtitle">We couldn&apos;t find any assessment data to display.</div>
        </div>
        <EmptyState message="Run an assessment for this app to see its results here." />
      </div>
    );
  }

  const complexity = data.ratings.find((rating) => rating.key === "complexity");
  const metrics: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Total Sheets", value: data.totalPages },
    { label: "KPIs", value: data.kpiCount },
    { label: "Tables", value: data.datasetCount },
    { label: "Total Fields", value: data.totalFields },
    // 6th tile -- 5 left the second row short one card in a 3-column grid
    // (vl-metrics-grid). data.customSqlCount already reads the backend's
    // real total_custom_sqls field (see lib/qlikAssessment.ts) and was
    // previously only surfaced deep in the Query Complexity panel; this
    // tile summarizes it at the top the same way Tables/Total Fields
    // summarize their own panels.
    { label: "Custom SQL", value: data.customSqlCount },
    {
      label: "Complexity",
      value: (
        <>
          {data.complexityScore ?? "NA"}
          <span style={{ fontSize: "20px", color: "#64748b", marginLeft: "4px" }}>/100</span>
          <Badge variant={complexity ? toneToVariant(complexity.tone) : "secondary"} style={{ fontSize: "14px", padding: "4px 14px", marginLeft: "12px" }}>
            {complexity?.value ?? "Unknown"}
          </Badge>
        </>
      ),
    },
  ];

  return (
    <div className="vl-container" style={isPdfMode ? { backgroundColor: "#ffffff" } : undefined}>
      <div className="vl-flex-col-mobile">
        <div className="vl-header">
          <div className="vl-title">Assessment Results</div>
          <div className="vl-subtitle">
            Migration feasibility and complexity breakdown for <strong>{appName}</strong>, assessed from its{" "}
            {data.fileType} export.
          </div>
        </div>
        {/* Download lives only on Migration Overview, which exports the whole
            run as a ZIP (overview + one PDF per application). This button
            produced a separate, assessment-only PDF built by a different code
            path (jsPDF text output rather than the captured layout), so the two
            disagreed about what "the report" is. */}
      </div>

      <div className="vl-metrics-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className="vl-metric-card" style={isPdfMode ? { backgroundColor: "#ffffff" } : undefined}>
            <div className="vl-metric-value">{metric.value}</div>
            <div className="vl-metric-label">{metric.label}</div>
          </div>
        ))}
      </div>

      <div className="vl-tabs-card" style={isPdfMode ? { backgroundColor: "#ffffff" } : undefined}>
        {!isPdfMode && (
          <div className="vl-tab-list-wrapper">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="vl-tab-list">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        <div className="vl-tab-content">
          {/* PDF capture has no tab strip to click, so every panel is stacked. */}
          {isPdfMode ? (
            <>
              <OverviewPanel data={data} appName={appName} />
              <DataModelPanel data={data} />
              <SecurityPanel data={data} />
              <VariablesPanel data={data} />
              <DataSourcesPanel data={data} />
              <VisualsPanel data={data} />
              <KeyFindingsPanel data={data} />
              <ChallengesPanel data={data} />
            </>
          ) : (
            <>
              {selectedTab === "overview" && <OverviewPanel data={data} appName={appName} />}
              {selectedTab === "model" && <DataModelPanel data={data} />}
              {selectedTab === "security" && <SecurityPanel data={data} />}
              {selectedTab === "variables" && <VariablesPanel data={data} />}
              {selectedTab === "sources" && <DataSourcesPanel data={data} />}
              {selectedTab === "visuals" && <VisualsPanel data={data} />}
              {selectedTab === "key-findings" && <KeyFindingsPanel data={data} />}
              {selectedTab === "challenges" && <ChallengesPanel data={data} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { AssessmentResultsView };
