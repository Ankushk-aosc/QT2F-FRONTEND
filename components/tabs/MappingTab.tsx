"use client"

import { matchesAgent } from "@/lib/agentNames";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogClose, DialogContent as DialogSurfaceContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Dropdown, Option } from "@/components/ui/dropdown";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import {
  ChevronRight,
  Filter,
  Sparkles
} from "lucide-react";
import React, { useEffect, useMemo, useState } from 'react';

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

const WEIGHT_MAP: Record<string, number> = { regular: 400, medium: 500, semibold: 600, bold: 700 };
const SIZE_MAP: Record<number, number> = { 100: 10, 200: 12, 300: 14, 400: 16, 500: 20, 600: 24, 700: 28, 800: 32, 900: 40, 1000: 68 };

function Text({
  weight,
  size,
  italic,
  color,
  style,
  ...props
}: {
  weight?: "regular" | "medium" | "semibold" | "bold";
  size?: number;
  italic?: boolean;
  color?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      style={{
        fontWeight: weight ? WEIGHT_MAP[weight] : undefined,
        fontSize: size ? `${SIZE_MAP[size]}px` : undefined,
        fontStyle: italic ? "italic" : undefined,
        color: color === "neutralTertiary" ? "var(--text-muted)" : color,
        ...style,
      }}
      {...props}
    />
  );
}

function Title2({ style, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 700, ...style }} {...props} />;
}

function Link({ style, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a style={{ color: "var(--primary)", textDecoration: "none", ...style }} {...props} />;
}

/** The previous Fluent `DialogContent` was the inner scrollable body, distinct
 * from the dialog surface itself — so it becomes a plain div here, while
 * `DialogSurfaceContent` (aliased from `@/components/ui/dialog`'s `DialogContent`)
 * takes over as the actual surface/backdrop. */
function DialogContent({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div style={style} {...props} />;
}

// 1. Import stores
import { useAgentStore } from "@/stores/agent.store";
import { useDashboardStore } from "@/stores/dashboard.store";
import { useMappingStore } from "@/stores/mapping.store";

// --- Styles — global vl-* CSS (matches AssessmentTab / ParsingTab) ---
const T = { mono: "'Cascadia Code','Fira Code','Consolas',monospace" } as const
const cleanLabel = (val: any) => typeof val === 'string' ? val.replace(/\s*\({0,1}not in xml\){0,1}\s*/ig, '').trim() : (val || "");

const useStyles = () => ({
  container: "vl-container",
  header: "vl-header",
  title: "vl-title",
  subtitle: "vl-subtitle",
  metricsGrid: "vl-metrics-grid",
  metricCard: "vl-metric-card",
  metricValue: "vl-metric-value",
  metricText: "vl-metric-text",
  metricLabel: "vl-metric-label",
  tabsCard: "vl-tabs-card",
  tabListWrapper: "vl-tab-list-wrapper",
  tabList: "vl-tab-list",
  tabContent: "vl-tab-content",
  sectionCard: "vl-section-card",
  sectionHeader: "vl-section-header",
  tableContainer: "vl-table-container",
  wrapCell: "vl-wrap-cell",
  codeBlock: "vl-code-block",
  emptyState: "vl-empty-state",
  infoItem: "vl-info-item",
  infoLabel: "vl-info-label",
  infoValue: "vl-info-value",
  grid2: "vl-grid-2",
  grid3: "vl-grid-3",
  grid4: "vl-grid-4",
  // kept for backward compat with internal render helpers
  tableHeaderCell: "vl-table-header-cell",
  spaciousCell: "vl-wrap-cell",
  codeText: "",
  paginationContainer: "",
  paginationControls: "",
  subTabContainer: "",
  popoverContent: "",
  visualDetailCard: "vl-info-item",
  detailLabel: "vl-info-label",
  detailValue: "",
  tabListContainer: "vl-tab-list-wrapper",
  contentHeader: "",
});

const TABS = [
  "Tables/Fields", "Calculated Fields", "Parameters & Sets",
  "Actions & Interactivity", "Data Queries", "Visual Configuration", "Relationships"
];

const ITEMS_PER_PAGE = 10;

/* ═══════════════════════════════════════════════════════════════════════
   REUSABLE DATA TABLE — same pattern as ParsingTab
═══════════════════════════════════════════════════════════════════════ */

interface MColDef<Row = any> { key: keyof Row | string; label: string; mono?: boolean; muted?: boolean; render?: (row: Row) => React.ReactNode }

function MDataTable<Row extends Record<string, any>>({ cols, rows, pageSize = ITEMS_PER_PAGE }: { cols: MColDef<Row>[]; rows: Row[]; pageSize?: number }) {
  const [page, setPage] = React.useState(0)
  if (!rows?.length) return (
    <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: "14px", fontStyle: "italic" }}>No data available.</div>
  )
  const totalPages = Math.ceil(rows.length / pageSize)
  const needsPagination = rows.length > pageSize
  const pageRows = needsPagination ? rows.slice(page * pageSize, (page + 1) * pageSize) : rows
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              {cols.map(c => (
                <th key={String(c.key)} style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap" }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: i % 2 === 1 ? "#f8fafc" : "#ffffff" }}>
                {cols.map(c => (
                  <td key={String(c.key)} style={{ padding: "14px 16px", verticalAlign: "top", fontFamily: c.mono ? "'Cascadia Code','Fira Code','Consolas',monospace" : "inherit", color: c.muted ? "#64748b" : "inherit" }}>
                    {c.render ? c.render(row) : row[c.key as string]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {needsPagination && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", padding: "12px 16px", borderTop: "1px solid #e2e8f0", fontSize: "13px", color: "#64748b" }}>
          <span>Page {page + 1} of {totalPages} ({Math.min((page + 1) * pageSize, rows.length)} of {rows.length} items)</span>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === 0 ? "#f8fafc" : "#ffffff", color: page === 0 ? "#cbd5e1" : "#334155", cursor: page === 0 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Previous</button>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page >= totalPages - 1 ? "#f8fafc" : "#ffffff", color: page >= totalPages - 1 ? "#cbd5e1" : "#334155", cursor: page >= totalPages - 1 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Next</button>
        </div>
      )}
    </div>
  )
}

// Confidence-match score bands (0-100, higher = better). Independent from
// the unrelated 0-100 *risk* score in AssessmentTab.tsx, where higher means
// worse -- the two are not the same scale despite both being percentages.
const CONFIDENCE_SCORE_HIGH = 90;
const CONFIDENCE_SCORE_MEDIUM = 70;

const renderConfidenceReview = (score: number | null, notes: string | null, link?: string | null) => {
  if (score === null && !notes) return <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "13px" }}>—</span>;

  let scoreColor = "#64748b";
  let scoreBg = "#f8fafc";
  if (score !== null) {
    if (score >= CONFIDENCE_SCORE_HIGH) { scoreColor = "#16a34a"; scoreBg = "#dcfce7"; }
    else if (score >= CONFIDENCE_SCORE_MEDIUM) { scoreColor = "#ca8a04"; scoreBg = "#fef08a"; }
    else { scoreColor = "#dc2626"; scoreBg = "#fee2e2"; }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "120px" }}>
      {score !== null && (
        <span style={{ display: "inline-block", width: "42px", textAlign: "center", fontSize: "12px", fontWeight: 800, color: scoreColor, background: scoreBg, padding: "4px 0", borderRadius: "16px" }}>{score}%</span>
      )}
      {notes && (
        <Dialog>
          <DialogTrigger disableButtonEnhancement>
            <Button variant="ghost" size="sm" style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb", padding: "0 6px", minWidth: "auto", cursor: "pointer" }}>Details</Button>
          </DialogTrigger>
          <DialogSurfaceContent>
            <DialogHeader>
              <DialogTitle>Mapping Review Notes</DialogTitle>
            </DialogHeader>
            <DialogContent>
              <div style={{ fontSize: "14px", color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                {notes}
              </div>
              {link && (
                <div style={{ marginTop: "16px" }}>
                  <Link href={link} target="_blank" style={{ fontSize: "14px", fontWeight: 600 }}>
                    How to import custom visual ➔
                  </Link>
                </div>
              )}
            </DialogContent>
            <DialogFooter>
              <DialogClose>
                <Button variant="secondary">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogSurfaceContent>
        </Dialog>
      )}
    </div>
  );
};

const VisualsDetailPopover = ({
  title,
  data,
  icon,
  styles,
  type
}: {
  title: string;
  data: any[];
  icon: any;
  styles: any;
  type: "filters" | "formatting";
}) => {
  const isEmpty = !data || data.length === 0;

  let groupedFormatting: Record<string, any[]> = {};
  if (type === "formatting" && !isEmpty) {
    groupedFormatting = {
      "VISUAL COLORS": data.filter(d => d.value === "Color"),
      "VISUAL FONTS": data.filter(d => d.value === "Font"),
      "OTHER FORMATTING": data.filter(d => d.value !== "Color" && d.value !== "Font"),
    };
  }

  if (isEmpty) {
    return (
      <Text italic size={200} color="neutralTertiary" style={{ paddingLeft: "8px" }}>
        None
      </Text>
    );
  }

  return (
    <Popover trapFocus>
      <PopoverTrigger disableButtonEnhancement>
        <Tooltip content={title} relationship="label">
          <Button
            variant="ghost"
            size="sm"
            style={{
              color: "#0284c7",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 8px",
              height: "auto"
            }}
          >
            {type === "formatting" ? <Sparkles style={{ fontSize: "20px" }} /> : icon}
            {type === "filters" ? (
              `${data.length} Filters`
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: "1.1" }}>
                <span style={{ fontSize: "14px" }}>View</span>
                <span style={{ fontSize: "14px" }}>Styles</span>
              </div>
            )}
          </Button>
        </Tooltip>
      </PopoverTrigger>
      <PopoverContent className={styles.popoverContent} style={{ minWidth: "420px", maxWidth: "520px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Text weight="bold" style={{ fontSize: "16px", color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", display: "block" }}>
            {type === "filters" ? "Applied Filters" : "Formatting Details"}
          </Text>
          {isEmpty ? (
            <Text size={200} italic color="neutralTertiary">No data available</Text>
          ) : type === "filters" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.map((item: any, idx) => (
                <div key={idx} style={{
                  padding: "10px 14px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", color: "#0f172a", fontWeight: 600 }}>
                      {cleanLabel(item.name || item.key || `Item ${idx + 1}`)}
                    </span>
                    {item.value && (
                      <Badge variant="secondary" style={{ fontSize: "11px" }}>
                        {item.value}
                      </Badge>
                    )}
                  </div>
                  {item.pbiMapped && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                      <Badge variant="default" style={{ fontSize: "11px", flexShrink: 0 }}>
                        {item.pbiMapped}
                      </Badge>
                      {item.pbiInstruction && (
                        <span style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
                          {item.pbiInstruction}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {Object.entries(groupedFormatting).map(([groupName, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={groupName} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      {groupName} ({items.length})
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {items.map((item: any, idx: number) => (
                        <div key={idx} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {groupName === "VISUAL COLORS" && (
                              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: cleanLabel(item.name) }} />
                            )}
                            <span style={{ fontSize: "13px", color: "#334155", fontWeight: 500, fontFamily: groupName === "VISUAL COLORS" ? "monospace" : "inherit" }}>
                              {cleanLabel(item.name)}
                            </span>
                          </div>
                          <Badge variant="secondary" style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", color: "#94a3b8", fontSize: "10px" }}>
                            {item.target || "Sheet Title"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ── Module-level set: persists across tab switches — activities typed once are NEVER re-typed
const _typedMappingActivities = new Set<string>()

// ── Typing animation helper (same as LeftSidebar)
function TypingText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = React.useState("")
  const [i, setI] = React.useState(0)
  const calledRef = React.useRef(false)

  React.useEffect(() => {
    if (i >= text.length) {
      if (onComplete && !calledRef.current) {
        calledRef.current = true
        onComplete()
      }
      return
    }
    const t = setTimeout(() => {
      setDisplayedText(text.slice(0, i + 1))
      setI(i + 1)
    }, 18)
    return () => clearTimeout(t)
  }, [i, text, onComplete])

  return (
    <span>
      {displayedText}
      {i < text.length && <span style={{ animation: "blink 1s step-end infinite" }}>|</span>}
    </span>
  )
}

// ── Mapping Agent Actions card — shows all activities in order, always visible
function MappingAgentActionsCard({ acts, styles }: { acts: any[]; styles: ReturnType<typeof useStyles> }) {
  const filteredActs = acts.filter(a => a.activity_summary && a.activity_summary.trim() !== "");
  const firstUntyped = filteredActs.findIndex((a: any) => !_typedMappingActivities.has(a.id))
  const [typingIndex, setTypingIndex] = useState(firstUntyped === -1 ? filteredActs.length : firstUntyped)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Card className={styles.sectionCard}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: collapsed ? 0 : "16px" }}
      >
        <span style={{ fontSize: "16px" }}>⚡</span>
        <span className={styles.sectionHeader} style={{ flex: 1, margin: 0 }}>Mapping Agent Actions</span>
        <Badge variant="default">{filteredActs.length} steps</Badge>
        <span style={{ fontSize: "12px", color: "#64748b" }}>{collapsed ? "▶" : "▼"}</span>
      </div>

      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {filteredActs.map((act: any, index: number) => {
            if (index > typingIndex) return null
            const alreadyTyped = _typedMappingActivities.has(act.id)
            const isCurrent = !alreadyTyped && index === typingIndex
            return (
              <div
                key={act.id}
                style={{
                  padding: "8px 12px",
                  background: "#f8fafc",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  borderLeft: "4px solid #3b82f6",
                  fontSize: "13px",
                  color: "#334155",
                  lineHeight: "1.5"
                }}
              >
                {alreadyTyped ? (
                  <span>{act.activity_summary}</span>
                ) : isCurrent ? (
                  <TypingText
                    text={act.activity_summary}
                    onComplete={() => {
                      _typedMappingActivities.add(act.id)
                      setTypingIndex(index + 1)
                    }}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Actions tab sub-components — defined at MODULE level so React preserves identity
// across renders and state (open/closed) is NOT reset on each parent re-render.
// ──────────────────────────────────────────────────────────────────────────────

function CollapsibleActionCard({ item, styles }: { item: any; styles: ReturnType<typeof useStyles> }) {
  const [open, setOpen] = React.useState(false);

  const MetaChip = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
    <div style={{ backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "10px 14px" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "13px", color: "#334155", fontWeight: 500, fontFamily: mono ? "'Cascadia Code','Fira Code','Consolas',monospace" : undefined }}>{value}</div>
    </div>
  );

  return (
    <Card className={styles.sectionCard} style={{ backgroundColor: "#ffffff" }}>
      {/* clickable header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
      >
        <ChevronRight style={{ color: "#94a3b8", flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }} />
        <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", flex: 1 }}>{item.id}</span>
        <Badge variant="secondary" style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
          {item.type.replace(/_/g, " ")}
        </Badge>
        {item.activation && item.activation !== "-" && (
          <Badge variant="default" style={{ fontSize: "11px" }}>{item.activation}</Badge>
        )}
      </div>

      {/* body — shown only when open */}
      {open && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* ── Tableau Action Section ── */}
          <div style={{ borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "9px 14px", background: "#f0f9ff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.7px" }}>Tableau Action</span>
            </div>
            <div style={{ padding: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
              {item.sourceDash && item.sourceDash !== "-" && <MetaChip label="Source Dashboard" value={item.sourceDash} />}
              {item.sourceWorksheet && item.sourceWorksheet !== "-" && <MetaChip label="Source Worksheet" value={item.sourceWorksheet} />}
              {item.targetDash && item.targetDash !== "-" && <MetaChip label="Target Dashboard" value={item.targetDash} />}
              {item.targetSheet && item.targetSheet !== "-" && <MetaChip label="Target Sheet" value={item.targetSheet} />}
            </div>
            {/* URL Expression */}
            {item.urlExpression && (
              <div style={{ margin: "0 12px 12px", padding: "10px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>URL Expression</div>
                <code style={{ fontSize: "12px", color: "#475569", fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace", wordBreak: "break-all" }}>{item.urlExpression}</code>
              </div>
            )}
            {/* Parameter Logic */}
            {item.paramLogic && (
              <div style={{ margin: "0 12px 12px", padding: "10px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "6px" }}>Parameter Logic</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {item.paramLogic["source-field"] && (
                    <div style={{ fontSize: "12px", color: "#475569" }}><span style={{ color: "#94a3b8", fontWeight: 600 }}>Source field: </span>{item.paramLogic["source-field"]}</div>
                  )}
                  {item.paramLogic["target-parameter"] && (
                    <div style={{ fontSize: "12px", color: "#475569" }}><span style={{ color: "#94a3b8", fontWeight: 600 }}>Target param: </span>{item.paramLogic["target-parameter"]}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Power BI Implementation Section ── */}
          <div style={{ borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "9px 14px", background: "#f0f9ff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.7px" }}>Power BI Equivalent</span>
              {item.displayType && item.displayType !== "-" && (
                <Badge variant="default" style={{ fontSize: "10px", marginLeft: "6px" }}>{item.displayType.replace(/_/g, " ")}</Badge>
              )}
            </div>

            <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Meta chips grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
                {item.implementationType && item.implementationType !== "-" && <MetaChip label="Implementation Type" value={item.implementationType.replace(/_/g, " ")} />}
                {item.sourcePage && <MetaChip label="Source Page" value={item.sourcePage} />}
                {item.pbiSourceVisual && item.pbiSourceVisual !== "-" && <MetaChip label="Source Visual" value={item.pbiSourceVisual} />}
                {item.pbiTargetPage && item.pbiTargetPage !== "-" && <MetaChip label="Target Page" value={item.pbiTargetPage} />}
                {item.targetParam && <MetaChip label="Target Parameter" value={item.targetParam} />}
                {item.sourceField && <MetaChip label="Source Field" value={item.sourceField} />}
                {item.targetTable && <MetaChip label="Target Table" value={item.targetTable} />}
                {item.keepFilters !== null && (
                  <div style={{ backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "10px 14px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "#2c6bc2ff", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Keep Filters</div>
                    <Badge variant={item.keepFilters ? "success" : "destructive"}>{item.keepFilters ? "Enabled" : "Disabled"}</Badge>
                  </div>
                )}
              </div>

              {/* Drillthrough fields */}
              {item.drillthroughFields.length > 0 && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Drillthrough Fields</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {item.drillthroughFields.map((f: string, idx: number) => (
                      <Badge key={idx} variant="default" style={{ fontSize: "11px" }}>{f}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* DAX Measure Name */}
              {item.daxMeasureName && (
                <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>DAX Measure Name</div>
                  <code style={{ fontSize: "13px", color: "#334155", fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace" }}>{item.daxMeasureName}</code>
                </div>
              )}

              {/* DAX Expression */}
              {(item.daxExpression || item.daxCode) && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>DAX Expression</div>
                  <div style={{ fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace", fontSize: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 14px", color: "#334155", lineHeight: 1.6, wordBreak: "break-word" }}>
                    {item.daxCode || item.daxExpression}
                  </div>
                </div>
              )}

              {/* Implementation Notes */}
              {item.implementationNotes && (
                <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", borderLeft: "3px solid #e2e8f0", fontSize: "13px", color: "#475569", lineHeight: 1.6 }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>Implementation Notes</div>
                  {item.implementationNotes}
                </div>
              )}

              {/* Visual interactions */}
              {item.visualInteractions && item.visualInteractions.length > 0 && (
                <div style={{ backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.7px", paddingLeft: "1px" }}>Visual Interactions</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 12px 6px 12px" }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Source</span>
                    </div>
                    <div style={{ width: "16px" }}></div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Target</span>
                    </div>
                    <div style={{ width: "70px" }}></div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {item.visualInteractions.map((vi: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px", fontWeight: 500, color: "#334155", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {vi.source_visual || vi.sourceVisual}
                        </div>
                        <div style={{ width: "16px", display: "flex", justifyContent: "center" }}>
                          <span style={{ color: "#94a3b8", fontSize: "14px" }}>→</span>
                        </div>
                        <div style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px", fontWeight: 500, color: "#334155", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {vi.target_visual || vi.targetVisual}
                        </div>
                        <div style={{ width: "70px", display: "flex", justifyContent: "flex-end" }}>
                          <Badge variant="default" style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px" }}>
                            {vi.type || "DataFilter"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </Card>
  );
}



function DashboardGroup({ name, actions, styles, defaultOpen = false }: { name: string; actions: any[]; styles: ReturnType<typeof useStyles>; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card className={styles.sectionCard}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
      >
        <ChevronRight style={{ color: "#64748b", transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
        <span className={styles.sectionHeader} style={{ margin: 0 }}>{name}</span>
        <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 400 }}>({actions.length} action{actions.length !== 1 ? "s" : ""})</span>
      </div>
      {open && (
        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {actions.map((item: any, idx: number) => (
            <CollapsibleActionCard key={idx} item={item} styles={styles} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Calculated Fields collapsible card — module level so state survives re-renders
// ──────────────────────────────────────────────────────────────────────────────
function CollapsibleCalcCard({ sec, calcCols, styles, defaultOpen = false }: { sec: any; calcCols: any[]; styles: ReturnType<typeof useStyles>; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card className={styles.sectionCard}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
      >
        <ChevronRight
          style={{ color: "#64748b", transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className={styles.sectionHeader} style={{ margin: 0 }}>{sec.label}</span>
          <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 400 }}>({sec.data.length} field{sec.data.length !== 1 ? "s" : ""})</span>
        </div>
      </div>
      {open && (
        <div style={{ marginTop: "16px" }}>
          <MDataTable cols={calcCols} rows={sec.data} pageSize={5} />
        </div>
      )}
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Generic collapsible section card — for Parameters & Sets
// ──────────────────────────────────────────────────────────────────────────────
function CollapsibleSectionCard({
  title, subtitle, count, countBg, children, defaultOpen = false
}: {
  title: string; subtitle: string; count: string; countBg?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
      {/* Clickable header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: "20px 28px", borderBottom: open ? "1px solid #e2e8f0" : "none", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", background: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)", userSelect: "none" }}
      >
        <ChevronRight style={{ color: "#64748b", transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>{title}</div>
          <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>{subtitle}</div>
        </div>
        <div style={{ background: countBg || "#0f172a", color: "#ffffff", borderRadius: "20px", padding: "4px 14px", fontSize: "13px", fontWeight: 600, flexShrink: 0 }}>
          {count}
        </div>
      </div>
      {open && children}
    </div>
  );
}

export default function MappingTab({ workbookId, projectId: propProjectId, runId: propRunId }: { workbookId?: string, projectId?: string, runId?: string }) {

  const styles = useStyles();

  // 1. UI Store Subscriptions
  const activeTab = useMappingStore((state) => state.activeTab);
  const setActiveTab = useMappingStore((state) => state.setActiveTab);
  const selectedTable = useMappingStore((state) => state.selectedTable);
  const setSelectedTable = useMappingStore((state) => state.setSelectedTable);
  const currentPage = useMappingStore((state) => state.currentPage);
  const setCurrentPage = useMappingStore((state) => state.setCurrentPage);
  const fetchMappingResult = useMappingStore((state) => state.fetchMappingResult);

  // 2. Data Store Subscriptions
  const currentRunId = useAgentStore((state) => state.currentRunId);
  const currentProjectId = useAgentStore((state) => state.currentProjectId);
  const isPolling = useAgentStore((state) => state.isPolling);
  const [visualSubTab, setVisualSubTab] = useState("Sheets");
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const activities = useAgentStore((state) => state.activities);
  const selectedProject = useDashboardStore((state) => state.selectedProject);

  const projectId = propProjectId || currentProjectId || selectedProject || "";
  const runId = propRunId || currentRunId || "";
  const targetWorkbookId = workbookId || "";
  const isHistoricalRun = !!propRunId && propRunId !== currentRunId;

  // Direct subscription to the mapping data vault (React updates instantly when this changes)
  const rawData = useMappingStore((state) => {
    if (!targetWorkbookId) return null;
    return state.mappingData?.[targetWorkbookId] || null;
  });

  const mappingIsLoading = useMappingStore((state) => state.isLoading[targetWorkbookId] ?? false);
  const isFetching = isHistoricalRun ? mappingIsLoading : (mappingIsLoading || isPolling || (!rawData && !!runId && !!targetWorkbookId));

  // Check if mapping agent has started or is running (used optionally for UI states, removed from strict fetch blocking)
  const agentActs = (runId && targetWorkbookId) ? (activities[runId]?.[targetWorkbookId] || []) : [];
  const mappingStarted = agentActs.some((a: any) => matchesAgent(a.agent_name, 'mapping'));

  // ★ Mapping data is fetched by the central poller in agent.store.ts (Step 3.5)
  // No independent polling needed here — data flows from the store automatically

  useEffect(() => {
    if (isHistoricalRun && !rawData && !mappingIsLoading && projectId && targetWorkbookId && runId) {
      console.log(`[MappingTab] Fetching historical data for ${targetWorkbookId}`);
      fetchMappingResult(projectId, targetWorkbookId, runId);
    }
  }, [isHistoricalRun, rawData, mappingIsLoading, projectId, targetWorkbookId, runId, fetchMappingResult]);

  const data = useMemo(() => {
    if (!rawData) return {};
    let d = Array.isArray(rawData) ? rawData[0] : rawData;

    // The mapping.store.ts and mappingMapper.ts structure return it flat or inside payload:
    d = d?.payload || d?.mapping_results || d?.data || d?.document || d?.result || d;

    if (typeof d === 'string') {
      try { d = JSON.parse(d); } catch (e) { console.error("JSON Parse Error:", e); }
    }

    console.log("[MappingTab] Received and shaped data:", d);
    return d || {};
  }, [rawData]);

  const isDataEmpty = Object.keys(data).length === 0;

  // --- TABLES EXTRACTION & AUTO-SELECT ---
  const DATA_TABLES = useMemo(() => {
    const tables = Array.isArray(data.tables) ? data.tables : [];
    return [...tables].sort((a, b) => {
      const getTName = (t: any) => {
        const inner = t?.payload || t?.data || t;
        return (inner?.bi_table_name || inner?.tableau_table_name || inner?.table_name || inner?.name || inner?.tableName || 
                inner?.target_table || inner?.source_table || "");
      };
      const nameA = getTName(a).toLowerCase();
      const nameB = getTName(b).toLowerCase();
      
      const isDevA = nameA.includes("dev");
      const isDevB = nameB.includes("dev");
      if (isDevA && !isDevB) return -1;
      if (!isDevA && isDevB) return 1;

      const isTestA = nameA.includes("test");
      const isTestB = nameB.includes("test");
      if (!isTestA && isTestB) return -1;
      if (isTestA && !isTestB) return 1;

      return nameA.localeCompare(nameB);
    });
  }, [data]);

  useEffect(() => {
    if (DATA_TABLES.length > 0 && !selectedTable) {
      const firstTab = DATA_TABLES[0];
      const innerTab = firstTab.payload || firstTab.data || firstTab;
      setSelectedTable(innerTab.bi_table_name || innerTab.table_name || innerTab.name || "Default Table");
    }
  }, [DATA_TABLES, selectedTable, setSelectedTable]);

  // --- SMART TABLE NAME EXTRACTOR FOR DAX ---
  const extractTableName = (item: any) => {
    if (item.table_name) return String(item.table_name);
    if (item.table) return String(item.table);

    const rawDax = item.powerbi_formula || item.dax_formula || item.dax || item.target_code || "";
    const dax = typeof rawDax === 'string' ? rawDax : JSON.stringify(rawDax);

    const match1 = dax.match(/'([^']+)'\[/);
    if (match1) return match1[1];

    const match2 = dax.match(/([a-zA-Z0-9_]+)\[/);
    if (match2) {
      const keyword = match2[1].toUpperCase();
      const reserved = ["CALCULATE", "FILTER", "SUM", "AVERAGE", "AVERAGEX", "MIN", "MAX", "COUNT", "COUNTROWS", "DISTINCTCOUNT", "DIVIDE", "VAR", "RETURN", "IF", "SWITCH"];
      if (!reserved.includes(keyword)) return match2[1];
    }

    return "Global Measure";
  };

  // --- DYNAMIC DATA MAPPERS ---
  const DAX_DATA = useMemo(() => {
    let calculatedFields: any[] = [];
    let lods: any[] = [];

    const cfl = data["Calculated Fields & LODs"];
    if (Array.isArray(cfl)) {
      cfl.forEach((item: any) => {
        if (Array.isArray(item.calculated_fields)) calculatedFields.push(...item.calculated_fields);
        if (Array.isArray(item.lod_expressions)) lods.push(...item.lod_expressions);
      });
    } else if (cfl && typeof cfl === "object") {
      if (Array.isArray(cfl.calculated_fields)) calculatedFields.push(...cfl.calculated_fields);
      if (Array.isArray(cfl.lod_expressions)) lods.push(...cfl.lod_expressions);
    }

    const possibleCalcKeys = ["calculated_fields", "measures", "Measures", "Calculated Fields", "calculations", "Calculations"];
    possibleCalcKeys.forEach(key => {
      if (Array.isArray(data[key])) calculatedFields.push(...data[key]);
    });

    const possibleLodKeys = ["lod_expressions", "LOD Expressions", "lods", "LODs"];
    possibleLodKeys.forEach(key => {
      if (Array.isArray(data[key])) lods.push(...data[key]);
    });

    const uniqueCalcs = new Map();
    calculatedFields.forEach((f: any) => {
      if (f && (f.name || f.title)) uniqueCalcs.set(f.name || f.title, f);
    });

    const uniqueLods = new Map();
    lods.forEach((l: any) => {
      if (l && (l.name || l.title)) uniqueLods.set(l.name || l.title, l);
    });

    const mappedCalc = Array.from(uniqueCalcs.values()).map((f: any, idx: number) => {
      const rawSource = f.tableau_formula || f.qlik_formula || f.formula || f.source_code || "N/A";
      const rawTarget = f.powerbi_formula || f.dax_formula || f.dax || f.target_code || "Pending translation";

      let calcType = "Measure"; // default
      if (f.role?.toLowerCase() === "dimension" || f.type?.toLowerCase() === "dimension" || f.is_dimension) calcType = "Dimension";
      else if (f.role?.toLowerCase() === "measure" || f.type?.toLowerCase() === "measure" || f.is_measure) calcType = "Measure";

      return {
        id: `c_${idx}`,
        tableName: extractTableName(f),
        title: String(f.name || f.title || "Unknown Measure"),
        type: calcType,
        sourceCode: typeof rawSource === 'string' ? rawSource : JSON.stringify(rawSource),
        targetCode: typeof rawTarget === 'string' ? rawTarget : JSON.stringify(rawTarget),
        confidenceScore: f.confidence_score !== undefined ? f.confidence_score : null,
        reviewNotes: f.review_notes || null
      };
    });

    const mappedLods = Array.from(uniqueLods.values()).map((l: any, idx: number) => {
      const rawSource = l.tableau_formula || l.qlik_formula || l.formula || l.source_code || "N/A";
      const rawTarget = l.dax_formula || l.powerbi_formula || l.dax || l.target_code || "Pending translation";
      return {
        id: `l_${idx}`,
        tableName: extractTableName(l),
        title: String(l.name || l.title || "Unknown LOD"),
        type: "LOD",
        sourceCode: typeof rawSource === 'string' ? rawSource : JSON.stringify(rawSource),
        targetCode: typeof rawTarget === 'string' ? rawTarget : JSON.stringify(rawTarget),
        confidenceScore: l.confidence_score !== undefined ? l.confidence_score : null,
        reviewNotes: l.review_notes || null
      };
    });

    return [...mappedCalc, ...mappedLods];
  }, [data]);

  const DATA_PARAMETERS = useMemo(() => {
    const params = data.parameters || data.Parameters || [];
    const safeString = (val: any) => typeof val === 'string' ? val : (val ? JSON.stringify(val) : "-");
    return Array.isArray(params) ? params.map((p: any) => ({
      name: safeString(p.name),
      tableauDataType: safeString(p.tableau?.data_type || p.data_type || "-"),
      powerbiDataType: safeString(p.powerbi?.data_type || "-"),
      tableauKind: safeString(p.tableau?.parameter_kind || "-"),
      powerbiKind: safeString(p.powerbi?.parameter_kind || "-"),
      powerbiDax: safeString(p.powerbi?.dax || "-"),
      confidenceScore: (p.powerbi?.confidence_score !== undefined ? p.powerbi.confidence_score : (p.confidence_score !== undefined ? p.confidence_score : null)),
      reviewNotes: p.powerbi?.review_notes || p.review_notes || null
    })) : [];
  }, [data]);

  const DATA_SETS = useMemo(() => {
    const sets = data.sets || data.Sets || [];
    const safeString = (val: any) => typeof val === 'string' ? val : (val ? JSON.stringify(val) : "-");
    return Array.isArray(sets) ? sets.map((s: any) => ({
      name: safeString(s.name),
      tableauType: safeString(s.type || s.tableau?.type || "-"),
      powerbiType: safeString(s.powerbi?.type || s.powerbi_approach || "DAX Filter"),
      tableauDax: safeString(s.tableau?.dax || "-"),
      powerbiDax: safeString(s.powerbi?.dax || "-"),
      powerbiCalculatedColumns: s.powerbi?.calculated_columns || [],
      tableauDesc: safeString(s.tableau?.description || s.notes || "-"),
      powerbiDesc: safeString(s.powerbi?.description || "-"),
      confidenceScore: (s.powerbi?.confidence_score !== undefined ? s.powerbi.confidence_score : (s.confidence_score !== undefined ? s.confidence_score : null)),
      reviewNotes: s.powerbi?.review_notes || s.review_notes || null
    })) : [];
  }, [data]);

  const DATA_ACTIONS = useMemo(() => {
    // Robustly find actions list - the backend may use various key names
    const actionsRaw = data.actions || data.Actions || data.tableau_actions ||
      data["Actions & Interactivity"] || data["actions_and_interactivity"] ||
      data["Actions and Interactivity"] || data["actions & interactivity"] || null;

    // If not found at top level, try to find it in nested structures
    let actions: any[] = [];
    if (Array.isArray(actionsRaw)) {
      actions = actionsRaw;
    } else if (actionsRaw && typeof actionsRaw === "object") {
      // Could be wrapped: { actions: [...] } or { items: [...] }
      actions = actionsRaw.actions || actionsRaw.items || actionsRaw.data ||
        (Array.isArray(Object.values(actionsRaw)[0]) ? Object.values(actionsRaw)[0] as any[] : []);
    }

    // ★ DIAGNOSTIC: Log what we found so we can see the actual data structure
    console.log("[MappingTab] Actions tab - raw key search:", {
      "data.actions": data.actions,
      "data.Actions": data.Actions,
      "data['Actions & Interactivity']": data["Actions & Interactivity"],
      "data.tableau_actions": data.tableau_actions,
      "actionsRaw": actionsRaw,
      "actions (resolved array)": actions,
      "all data keys": Object.keys(data),
    });
    if (actions.length > 0) {
      console.log("[MappingTab] First action item structure:", JSON.stringify(actions[0], null, 2));
    }

    return Array.isArray(actions) ? actions.map((a: any) => {
      // Handle potential nesting from Cosmos DB records
      const item = a.payload || a;

      const tabAction = item.tableau_action || item.tableauAction || {};
      const pbiAction = item.powerbi_equivalent || item.powerbiEquivalent || {};

      // Aggressively find dashboard names (check tabAction, then fallback to item root)
      const sourceDash = tabAction.source_dashboard || tabAction.sourceDashboard || tabAction.source_dashboard_name ||
        item.source_dashboard || item.sourceDashboard || item.dashboard || item.Dashboard || "-";
      const targetDash = tabAction.target_dashboard || tabAction.targetDashboard || tabAction.target_dashboard_name ||
        item.target_dashboard || item.targetDashboard || item.target_dashboard_name || "-";

      // New Detail Fields from JSON sample (check tabAction, then fallback to item root)
      const sourceWorksheet = tabAction.source_worksheet || tabAction.sourceWorksheet || item.source_worksheet || item.sourceWorksheet || item.worksheet || item.Worksheet || item.sheet || "-";
      const targetSheet = tabAction.target_sheet || tabAction.targetSheet || item.target_sheet || item.targetSheet || "-";
      const activation = tabAction.activation || tabAction.activation_type || item.activation || item.activation_type || "-";

      const pbiSourceVisual = pbiAction.source_visual || pbiAction.sourceVisual || item.pbi_source_visual || item.pbiSourceVisual || "-";
      const pbiTargetPage = pbiAction.target_page || pbiAction.targetPage || item.pbi_target_page || item.pbiTargetPage || "-";
      const drillthroughFields = Array.isArray(pbiAction.drillthrough_fields) ? pbiAction.drillthrough_fields :
        (pbiAction.drillthrough_fields ? [pbiAction.drillthrough_fields] :
          (Array.isArray(item.drillthrough_fields) ? item.drillthrough_fields : []));
      const keepFilters = pbiAction.keep_all_filters !== undefined ? pbiAction.keep_all_filters : (item.keep_all_filters !== undefined ? item.keep_all_filters : null);

      const actionType = tabAction.type || tabAction.action_type || item.type || item.action_type || "-";
      const implType = pbiAction.implementation_type || pbiAction.implementationType || item.implementation_type || item.implementationType || "-";

      // Condition: Same dashboard -> implementation_type, Different -> tableau_action.type
      let displayType = actionType;
      if (sourceDash !== "-" && targetDash !== "-" && sourceDash === targetDash) {
        displayType = implType !== "-" ? implType : actionType;
      }

      // Collect visual interactions for details view
      const visualInteractions = pbiAction.visualInteractions || pbiAction.visual_interactions || item.visualInteractions || item.visual_interactions || [];

      // ── URL action fields ──
      const urlExpression = tabAction.url_expression || tabAction.urlExpression || item.url_expression || null;

      // ── Parameter action fields ──
      const paramLogic = tabAction.parameter_logic || tabAction.parameterLogic || null;

      // ── Power BI implementation detail fields ──
      const daxMeasureName = pbiAction.dax_measure_name || pbiAction.daxMeasureName || null;
      const daxExpression = pbiAction.dax_expression || pbiAction.daxExpression || null;
      const daxCode = pbiAction.dax_code || pbiAction.daxCode || null;
      const implementationNotes = pbiAction.implementation_notes || pbiAction.implementationNotes || null;
      const sourcePage = pbiAction.source_page || pbiAction.sourcePage || null;
      const targetParam = pbiAction.target_parameter || pbiAction.targetParameter || null;
      const sourceField = pbiAction.source_field || pbiAction.sourceField || null;
      const targetTable = pbiAction.target_table || pbiAction.targetTable || null;

      return {
        id: item.action_id || item.actionId || tabAction.name || item.name || "Action",
        type: actionType,
        displayType,
        implementationType: implType,
        sourceDash,
        targetDash,
        sourceWorksheet,
        targetSheet,
        activation,
        pbiSourceVisual,
        pbiTargetPage,
        drillthroughFields,
        keepFilters,
        desc: item.description || item.desc || "-",
        visualInteractions,
        supported: item.supported !== undefined ? item.supported : true,
        // Extended fields
        urlExpression,
        paramLogic,
        daxMeasureName,
        daxExpression,
        daxCode,
        implementationNotes,
        sourcePage,
        targetParam,
        sourceField,
        targetTable
      };
    }) : [];
  }, [data]);


  const DATA_STRATEGY = useMemo(() => {
    const customSqlRules = data.custom_sql || data.CustomSql || data.customSql || data.customSQL || [];

    // If not using custom_sql, fallback to legacy datasources formatting
    if (!customSqlRules || customSqlRules.length === 0) {
      const sources = data.datasources || data.sources || data.Datasources || [];
      const safeString = (val: any) => typeof val === 'string' ? val : (val ? JSON.stringify(val) : "-");
      return Array.isArray(sources) ? sources.map((ds: any) => ({
        isLegacy: true,
        source: safeString(ds.name),
        mode: safeString(ds.mode || "unknown"),
        target: safeString(ds.target_strategy || ds.target || ds.powerbi_strategy || ((ds.mode || "").toLowerCase() === "live" ? "direct query" : "delta table")),
        lakehouse: safeString(ds.target_workspace || ds.lakehouse || ds.workspace || "Fabric Workspace"),
        notes: safeString(ds.notes || `Connection type: ${ds.connection_type || "unknown"}`)
      })) : [];
    }

    // Process the new custom_sql structure
    return Array.isArray(customSqlRules) ? customSqlRules.map((sqlData: any) => {
      let parsedColumns: any[] = [];
      if (Array.isArray(sqlData.columns)) {
        parsedColumns = sqlData.columns;
      } else if (typeof sqlData.columns === 'string') {
        try { parsedColumns = JSON.parse(sqlData.columns); } catch (e) { }
      } else if (sqlData.Columns && Array.isArray(sqlData.Columns)) {
        parsedColumns = sqlData.Columns;
      }

      let parsedMQuery: any[] = [];
      if (Array.isArray(sqlData.m_query)) {
        parsedMQuery = sqlData.m_query;
      } else if (typeof sqlData.m_query === 'string') {
        try { parsedMQuery = JSON.parse(sqlData.m_query); } catch (e) { }
      } else if (sqlData.mQuery && Array.isArray(sqlData.mQuery)) {
        parsedMQuery = sqlData.mQuery;
      }

      return {
        isLegacy: false,
        datasource: sqlData.datasource || "Unknown Datasource",
        tableauTable: sqlData.tableau_table_name || "-",
        biTable: sqlData.bi_table_name || "-",
        relationType: sqlData.relation_type || "-",
        sqlQuery: sqlData.query || "",
        mQuerySteps: parsedMQuery,
        columns: parsedColumns,
        confidenceScore: sqlData.m_query_confidence_score !== undefined ? sqlData.m_query_confidence_score : (sqlData.confidence_score !== undefined ? sqlData.confidence_score : null),
        reviewNotes: sqlData.m_query_review_notes || sqlData.review_notes || null
      };
    }) : [];

  }, [data]);

  const DATA_VISUALS = useMemo(() => {
    // Robustly find visuals list
    const visualsRaw = data.visuals?.sheet_visuals || data.worksheets || data.Visuals || data.visuals || [];
    const visualsList = Array.isArray(visualsRaw) ? visualsRaw : [];

    const getPbiEquivalent = (source: string) => {
      if (!source) return "Native Power BI Visual";
      const s = source.toLowerCase();
      if (s === "bar" || s.includes("bar")) return "Clustered Bar Chart";
      if (s === "pie" || s.includes("pie")) return "Pie Chart";
      if (s === "line" || s.includes("line")) return "Line Chart";
      if (s === "area" || s.includes("area")) return "Area Chart";
      if (s === "text" || s.includes("text")) return "Card Visual / Matrix";
      if (s === "shape" || s === "circle" || s.includes("scatter")) return "Scatter Chart";
      if (s === "map" || s.includes("map")) return "Map Visual";
      return "Native Power BI Visual";
    };

    const safeString = (val: any) => typeof val === 'string' ? val : (val ? JSON.stringify(val) : "-");

    return visualsList.map((v: any) => {
      const sourceVis = v.mark_type || v.type || v.source_visual || "Automatic";

      const rows = Array.isArray(v.rows || v.mapping?.rows) ? (v.rows || v.mapping?.rows) : [];
      const columns = Array.isArray(v.columns || v.mapping?.columns) ? (v.columns || v.mapping?.columns) : [];

      // Categorization for sub-tabs to match ParsingTab
      let category = "Sheets";
      if (rows.length === 0 && columns.length === 0) {
        category = "KPI & Summary";
      }

      // Extract filters — handles both old shape and real JSON shape
      let parsedFilters: any[] = [];
      const rawFilters = v.filters || v.mapping?.filters || [];
      if (Array.isArray(rawFilters)) {
        parsedFilters = rawFilters.map((f: any) => {
          // Real JSON: tableau_original_name / tableau_type / power_bi_mapped_type / power_bi_instruction
          const name = f.tableau_original_name || f.filter_name?.name || f.name || f.field || "Unknown";
          const type = f.tableau_type || f.filter_name?.type || f.type || f.filter_type || "quick";
          const pbiMapped = f.power_bi_mapped_type || f.powerbi_type || null;
          const pbiInstruction = f.power_bi_instruction || f.powerbi_instruction || null;
          return { name, value: type, pbiMapped, pbiInstruction };
        });
      } else if (typeof rawFilters === 'object' && Object.keys(rawFilters).length > 0) {
        parsedFilters = Object.entries(rawFilters).map(([k, val]) => ({ name: k, value: String(val), pbiMapped: null, pbiInstruction: null }));
      }

      // Extract formatting
      let parsedFormatting: any[] = [];
      const rawFormat = v.formatting || v.visual_properties || v.styling || {};

      const pbiVisualType = v.power_bi_visual_type || v.target_visual || {};
      if (pbiVisualType && typeof pbiVisualType === 'object') {
        // title formatting
        if (pbiVisualType.title && typeof pbiVisualType.title === 'object') {
          if (pbiVisualType.title.text) parsedFormatting.push({ name: cleanLabel(`Text: ${pbiVisualType.title.text}`), value: "Text", target: "Title" });
          if (pbiVisualType.title.alignment) parsedFormatting.push({ name: cleanLabel(`Align: ${pbiVisualType.title.alignment}`), value: "Alignment", target: "Title" });
          if (pbiVisualType.title.font_size) parsedFormatting.push({ name: cleanLabel(`${pbiVisualType.title.font_size}pt`), value: "Font Size", target: "Title" });
          if (pbiVisualType.title.font_color) parsedFormatting.push({ name: cleanLabel(pbiVisualType.title.font_color), value: "Color", target: "Title" });
        }

        // bars / colors
        if (Array.isArray(pbiVisualType.bars)) {
          pbiVisualType.bars.forEach((b: any) => {
            if (b.color) parsedFormatting.push({ name: cleanLabel(b.color), value: "Color", target: b.series || "Bar" });
          });
        }

        // line styling
        if (pbiVisualType.line_styling) {
          if (pbiVisualType.line_styling.line_style) parsedFormatting.push({ name: cleanLabel(pbiVisualType.line_styling.line_style), value: "Style", target: "Line" });
          if (pbiVisualType.line_styling.interpolation_type) parsedFormatting.push({ name: cleanLabel(pbiVisualType.line_styling.interpolation_type), value: "Interpolation", target: "Line" });
        }

        // labels enabled
        if (pbiVisualType.total_labels_enabled) {
          parsedFormatting.push({ name: cleanLabel(`Total Labels: ${pbiVisualType.total_labels_enabled}`), value: "Formatting", target: "Labels" });
        }
        if (pbiVisualType.data_labels && pbiVisualType.data_labels.show) {
          parsedFormatting.push({ name: cleanLabel(`Data Labels: ${pbiVisualType.data_labels.show}`), value: "Formatting", target: "Labels" });
        }
      }

      // Look for fonts — handles both old (name/family) and new (font/applied_to/size) shape
      const fonts = rawFormat.fonts || [];
      if (Array.isArray(fonts)) {
        fonts.forEach((f: any) => {
          if (typeof f === 'string') parsedFormatting.push({ name: cleanLabel(f), value: "Font", target: "Visual/Text" });
          else {
            let fontLabel = f.font || f.name || f.family;
            if (!fontLabel && f.alignment) fontLabel = `Alignment: ${f.alignment}`;
            if (!fontLabel) fontLabel = "Standard Font";

            const fontSize = f.size ? ` (${f.size}pt)` : "";
            const target = f.applied_to || f.target || "Sheet Title";
            parsedFormatting.push({ name: cleanLabel(`${fontLabel}${fontSize}`), value: "Font", target });
          }
        });
      }

      // Look for colors — handles both old (hex/value) and new (color/applied_to) shape
      const colors = rawFormat.colors || [];
      if (Array.isArray(colors)) {
        colors.forEach((c: any) => {
          if (typeof c === 'string') parsedFormatting.push({ name: cleanLabel(c), value: "Color", target: "Visual/Text" });
          else {
            const colorVal = c.color || c.value || c.hex || "Default Color";
            const target = c.applied_to || c.target || "Sheet Title";
            
            // Only add if not already added by power_bi_visual_type (primitive check)
            if (!parsedFormatting.some((pf) => pf.name === cleanLabel(colorVal))) {
                parsedFormatting.push({ name: cleanLabel(colorVal), value: "Color", target });
            }
          }
        });
      }

      // Generic fallback
      if (parsedFormatting.length === 0 && typeof rawFormat === 'object') {
        Object.entries(rawFormat).forEach(([k, val]) => {
          if (k !== 'has_formatting' && k !== 'axes' && !Array.isArray(val) && val !== null && val !== undefined) {
            parsedFormatting.push({ name: cleanLabel(String(val)), value: k.replace(/_/g, ' ') });
          }
        });
      }

      const rawPbiVis = v.power_bi_visual_type || v.target_visual || v.target || v.powerbi_visual;
      let finalPbiVis = "";
      let importLink = "";
      let customVisualName = "";

      if (rawPbiVis && typeof rawPbiVis === 'object' && !Array.isArray(rawPbiVis)) {
        finalPbiVis = String(rawPbiVis.power_bi_visual_type || rawPbiVis.visual_type || rawPbiVis.type || rawPbiVis.name || "Visual");
        importLink = rawPbiVis.import_link || "";
        customVisualName = rawPbiVis.custom_visual_name || "";
      } else {
        finalPbiVis = safeString(rawPbiVis || getPbiEquivalent(typeof sourceVis === 'string' ? sourceVis : String(sourceVis)));
      }

      return {
        id: v.visual_id || `${v.sheet || v.name}_${v.type}`,
        sheet: safeString(v.name || v.sheet || "-"),
        sourceVis: safeString(sourceVis),
        targetVis: finalPbiVis,
        importLink,
        customVisualName,
        pos: safeString(v.position || v.pos || v.layout?.position || "-"),
        size: safeString(v.size || v.layout?.size || "-"),
        rows: Array.isArray(v.rows || v.mapping?.rows) ? (v.rows || v.mapping?.rows) : [],
        columns: Array.isArray(v.columns || v.mapping?.columns) ? (v.columns || v.mapping?.columns) : [],
        filters: parsedFilters,
        formatting: parsedFormatting,
        category,
        ok: v.supported !== undefined ? v.supported : true
      };
    });
  }, [data]);

  const DATA_RELATIONSHIPS = useMemo(() => {
    let relsRaw = data.relationships || data.Relationships || [];

    // 🔥 DIAGNOSTIC: Log out the relationships shape so we can see it in browser console
    console.log("[MappingTab] Raw relationships data:", relsRaw);

    // If it's buried inside datasources_and_connections
    if (relsRaw.length === 0 && data.datasources_and_connections?.relationships) {
      relsRaw = data.datasources_and_connections.relationships;
      console.log("[MappingTab] Found relationships in datasources_and_connections:", relsRaw);
    }

    let rels = Array.isArray(relsRaw) ? relsRaw : [];

    return rels.map((r: any) => {
      let item = r;
      if (r.payload) item = r.payload;
      else if (r.data) item = r.data;

      // The JSON structure from Cosmos is wrapping inside 'tableau', 'powerBI', etc. Check for powerbi, fallback to tableau
      const pbi = item.power_bi || item.powerbi || item.powerBI || item.powerbi_equivalent || {};
      const tab = item.tableau || item.tableau_equivalent || {};

      // Flatten the properties across the wrapper to ensure we can read them regardless of where they are mapped
      const flatItem = { ...item, ...tab, ...pbi };

      // Support common snake_case properties from python serializers
      const fromTbl = flatItem.fromTable || flatItem.from_table || flatItem.FromTable;
      const displayFromTable = fromTbl || "-";

      const fromCol = flatItem.fromColumn || flatItem.from_column || flatItem.FromColumn;
      const displayFromCol = fromCol || "-";

      const toCol = flatItem.toColumn || flatItem.to_column || flatItem.ToColumn;
      const displayToCol = toCol || "-";

      const card = flatItem.cardinality || flatItem.Cardinality || flatItem.relationship_type || "-";

      return {
        fromTable: displayFromTable,
        toTable: flatItem.toTable || flatItem.to_table || flatItem.ToTable || "-",
        fromColumn: displayFromCol,
        toColumn: displayToCol,
        cardinality: card,
        crossFilterDirection: flatItem.crossFilterDirection || flatItem.cross_filter_direction || flatItem.CrossFilterDirection || "Single",
        isActive: flatItem.isActive !== undefined ? flatItem.isActive : (flatItem.is_active !== undefined ? flatItem.is_active : true)
      };
    });
  }, [data]);

  const lowConfidenceItems = useMemo(() => {
    const items: any[] = [];
    DAX_DATA.forEach(d => {
      if (d.confidenceScore !== null && d.confidenceScore < 90) {
        items.push({ ...d, category: d.type || "Calculated Field/LOD" });
      }
    });
    DATA_PARAMETERS.forEach(p => {
      if (p.confidenceScore !== null && p.confidenceScore < 90) {
        items.push({ ...p, title: p.name, category: "Parameter" });
      }
    });
    DATA_SETS.forEach(s => {
      if (s.confidenceScore !== null && s.confidenceScore < 90) {
        items.push({ ...s, title: s.name, category: "Set" });
      }
    });
    DATA_STRATEGY.forEach((st: any) => {
      if (st.confidenceScore !== null && st.confidenceScore < 90) {
        items.push({ ...st, title: st.biTable || st.tableauTable || "Custom SQL", category: "Data Strategy" });
      }
    });
    DATA_VISUALS.forEach((v: any) => {
      if (v.customVisualName || v.importLink) {
        items.push({
          ...v,
          title: v.sheet || "Visual",
          category: "Custom Visual",
          confidenceScore: null,
          reviewNotes: "Requires custom visual: " + (v.customVisualName || v.targetVis)
        });
      }
    });
    return items;
  }, [DAX_DATA, DATA_PARAMETERS, DATA_SETS, DATA_STRATEGY, DATA_VISUALS]);

  const METRICS_DATA = [
    { label: "Mapped Table Fields", value: Array.isArray(data.tables) ? data.tables.reduce((acc: number, t: any) => acc + (Array.isArray(t.columns) ? t.columns.length : 0), 0) : 0 },
    { label: "Mapped Calculated Fields", value: DAX_DATA.length },
    { label: "Mapped Visuals", value: DATA_VISUALS.length },
    { label: "Connection Type", value: data.connection_mode || data.mode || (Array.isArray(data.datasources) && data.datasources[0]?.mode) || "Live" },
    { label: "Data Source Name", value: (Array.isArray(data.datasources) && (data.datasources[0]?.name || data.datasources[0]?.type)) || data.connection_type || "N/A" },
    { label: "Needs Review", value: lowConfidenceItems.length, color: "#ca8a04", isClickable: true }
  ];

  // --- PAGINATION SLICERS ---
  const foundTable = DATA_TABLES.find((t: any, index: number) => {
    const innerTab = t.payload || t.data || t;
    const tName = innerTab?.bi_table_name || innerTab?.tableau_table_name || innerTab?.table_name || innerTab?.name || innerTab?.tableName ||
      innerTab?.target_table || innerTab?.source_table ||
      (Object.values(innerTab || {}).find((v: any) => v && v.table_name) as any)?.table_name ||
      `Table ${index}`;
    return tName === selectedTable;
  });

  // Auto-select the first table if none is selected, or if the selected table is not in the current dataset
  useEffect(() => {
    if (DATA_TABLES.length > 0) {
      const isSelectedValid = DATA_TABLES.some((t: any, index: number) => {
        const innerTab = t.payload || t.data || t;
        const tName = innerTab?.bi_table_name || innerTab?.tableau_table_name || innerTab?.table_name || innerTab?.name || innerTab?.tableName ||
          innerTab?.target_table || innerTab?.source_table ||
          (Object.values(innerTab || {}).find((v: any) => v && v.table_name) as any)?.table_name ||
          `Table ${index}`;
        return tName === selectedTable;
      });

      if (!selectedTable || !isSelectedValid) {
        const firstT = DATA_TABLES[0];
        const innerTab = firstT.payload || firstT.data || firstT;
        const tName = innerTab?.bi_table_name || innerTab?.tableau_table_name || innerTab?.table_name || innerTab?.name || innerTab?.tableName ||
          innerTab?.target_table || innerTab?.source_table ||
          (Object.values(innerTab || {}).find((v: any) => v && v.table_name) as any)?.table_name ||
          `Table 0`;
        setSelectedTable(tName);
      }
    }
  }, [DATA_TABLES, selectedTable, setSelectedTable]);

  const innerFoundTable = foundTable?.payload || foundTable?.data || Object.values(foundTable || {}).find((v: any) => v && v.columns) || foundTable;
  const modelCols = Array.isArray(innerFoundTable?.columns) ? innerFoundTable.columns : (Array.isArray(innerFoundTable?.Columns) ? innerFoundTable.Columns : []);
  const pagedModelData = modelCols.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pagedDaxData = DAX_DATA.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pagedParamsData = DATA_PARAMETERS.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pagedSetsData = DATA_SETS.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pagedActionsData = DATA_ACTIONS.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pagedStrategyData = DATA_STRATEGY.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pagedVisualsData = DATA_VISUALS.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const pagedRelationshipsData = DATA_RELATIONSHIPS.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const [openCalcSections, setOpenCalcSections] = useState({ dimensions: true, measures: true, lods: true });
  const toggleCalcSection = (key: keyof typeof openCalcSections) => setOpenCalcSections(prev => ({ ...prev, [key]: !prev[key] }));

  // Track the active inner tab for each Custom SQL item (key: index, value: tab name)
  const [activeSqlTabs, setActiveSqlTabs] = useState<Record<number, string>>({});

  // Filter DAX into groups
  const dimData = DAX_DATA.filter(d => d.type === "Dimension");
  const meaData = DAX_DATA.filter(d => d.type === "Measure");
  const lodData = DAX_DATA.filter(d => d.type === "LOD");

  const renderPagination = (totalItems: number) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    if (totalPages <= 1) return null;

    return (
      <div className={styles.paginationContainer}>
        <Text size={300} color="neutralSecondary">
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} entries
        </Text>
        <div className={styles.paginationControls}>
          <Button
            variant="ghost"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Text weight="semibold" style={{ margin: "0 8px", color: "#334155" }}>
            Page {currentPage} of {totalPages}
          </Text>
          <Button
            variant="ghost"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  if (!targetWorkbookId) {
    return null;
  }

  if (isFetching && isDataEmpty) {
    return (
      <div className={styles.container}>
        <Card className={styles.tabsCard} style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner size="large" label="Fetching live mapping results..." />
        </Card>
      </div>
    );
  }

  if (isDataEmpty && !isFetching) {
    return (
      <div className={styles.container}>
        <Card className={styles.tabsCard} style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isHistoricalRun ? (
            <Spinner size="large" label="Fetching historical mapping data..." />
          ) : (
            <div style={{ textAlign: "center" }}>
              <Text size={500} weight="semibold" style={{ color: "#64748b", display: "block", marginBottom: "16px" }}>
                No mapping data available for this workbook yet.
              </Text>
              <Spinner size="medium" label="Checking for updates..." />
            </div>
          )}
        </Card>
      </div>
    );
  }

  const rawTitle = data.project_name || data.workbook_name || "Unknown Workbook";
  const displayTitle = typeof rawTitle === 'string' ? rawTitle : JSON.stringify(rawTitle);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Mapping Results</div>
        <div className={styles.subtitle}>
          Field, calculated field, and visual mapping for <span style={{ color: "#0f172a", fontWeight: 600 }}>{displayTitle}</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className={styles.metricsGrid}>
        <style>{`
          .vl-metric-card-interactive {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .vl-metric-card-interactive:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 25px -10px rgba(202, 138, 4, 0.2) !important;
            background-color: #fffaf0 !important;
            border-color: #ca8a04 !important;
          }
        `}</style>
        {METRICS_DATA.map((metric: any, index) => {
          const isClickable = metric.isClickable && metric.value > 0;
          return (
            <Card
              key={index}
              className={`${styles.metricCard} ${isClickable ? "vl-metric-card-interactive" : ""}`}
              onClick={isClickable ? () => setIsReviewDialogOpen(true) : undefined}
              style={{
                cursor: isClickable ? "pointer" : "default",
                borderBottom: isClickable ? `2px solid ${metric.color || "#ca8a04"}` : undefined,
                position: "relative",
              }}
            >
              <div className={styles.metricValue}>
                {metric.value}
              </div>
              <div className={styles.metricLabel}>{metric.label}</div>
              {isClickable && (
                <div style={{
                  position: "absolute",
                  bottom: "10px",
                  right: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: 0.8
                }}>
                  <Text size={100} weight="bold" style={{ color: metric.color || "#ca8a04", textTransform: "uppercase", letterSpacing: "0.5px" }}>Details</Text>
                  <ChevronRight style={{ fontSize: "12px", color: metric.color || "#ca8a04" }} />
                </div>
              )}
            </Card>
          );
        })}
      </div>


      {/* Navigation Tabs — wrapped in vl-tabs-card */}
      <Card className={styles.tabsCard}>
        <div style={{
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
          marginBottom: "16px",
          borderBottom: `1px solid var(--border)`
        }} className="vl-tablist-scroll-wrapper">
          <style>{`
            .vl-tablist-scroll-wrapper::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value);
              setCurrentPage(1);
            }}
          >
            <TabsList className={styles.tabList} style={{ minWidth: "max-content", borderBottom: "none" }}>
              {TABS.map(tab => (
                <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content Area */}
        <div className={styles.tabContent}>

          {/* 1. TABLES/FIELDS TAB */}
          {activeTab === "Tables/Fields" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Dropdown row — no card header */}
              <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>Select Table</span>
                  <Dropdown
                    placeholder="Select a table"
                    value={selectedTable || ""}
                    selectedOptions={selectedTable ? [selectedTable] : []}
                    onOptionSelect={(_, data) => {
                      setSelectedTable(data.optionValue as string);
                    }}
                    style={{ minWidth: "240px", backgroundColor: "#ffffff" }}
                  >
                    {DATA_TABLES.map((t: any, index: number) => {
                      const innerTab = t?.payload || t?.data || t;
                      const tName = innerTab?.bi_table_name || innerTab?.tableau_table_name || innerTab?.table_name || innerTab?.name || innerTab?.tableName ||
                        innerTab?.target_table || innerTab?.source_table ||
                        (Object.values(innerTab || {}).find((v: any) => v && v.table_name) as any)?.table_name ||
                        `Table ${index}`;
                      return (
                        <Option key={tName} value={tName} text={tName}>{tName}</Option>
                      );
                    })}
                  </Dropdown>
                </div>

                {/* Table metadata strip */}
                {foundTable && (() => {
                  const inner = foundTable.payload || foundTable.data || foundTable;
                  const relType = inner.relation_type || "table";
                  const sourceName = inner.table_name || inner.tableau_table_name || "-";
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "0" }}>
                      {[{ label: "Source Table", value: sourceName, mono: false },
                      { label: "Relation Type", value: relType, badge: "outline" as const }].map((m, idx) => (
                        <div key={idx} style={{ padding: "14px 20px", borderRight: idx < 1 ? "1px solid #f1f5f9" : "none", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{m.label}</span>
                          {m.badge === "outline" ? (
                            <Badge variant="default" style={{ width: "fit-content", whiteSpace: "nowrap" }}>{m.value}</Badge>
                          ) : (
                            <span style={{ fontSize: "13.5px", color: "#0f172a", fontWeight: 500 }}>{m.value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Column Mappings table */}
              <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>Column Mappings</span>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>{modelCols.length} fields</span>
                </div>

                <MDataTable
                  pageSize={10}
                  rows={modelCols.map((col: any) => {
                    let colName = "Unknown Column", colType = "(unknown)", biType = "(unknown)";
                    let parsedCol = col;
                    if (typeof col === 'string') { try { parsedCol = JSON.parse(col); } catch (e) { } }
                    if (typeof parsedCol === 'string') { colName = parsedCol; }
                    else if (parsedCol && typeof parsedCol === 'object') {
                      const innerCol = parsedCol.payload || parsedCol.data || parsedCol;
                      colName = innerCol.tableau_renamed_column_name || innerCol.tableau_column_name || innerCol.source_column || innerCol.name || innerCol.column_name || innerCol.field || innerCol.target_column || innerCol.target_name || innerCol.SourceField || innerCol.FieldName || JSON.stringify(innerCol);
                      colType = innerCol.datatype || innerCol.tableau_datatype || innerCol.source_type || innerCol.DataType || "(unknown)";
                      biType = innerCol.bi_datatype || innerCol.powerbi_datatype || innerCol.target_type || innerCol.type || innerCol.data_type || "(unknown)";
                    }
                    return { colName: typeof colName === 'object' ? JSON.stringify(colName) : String(colName), colType: String(colType), biType: String(biType) };
                  })}
                  cols={[
                    { key: "colName", label: "Column Name", render: (r: any) => <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "13.5px" }}>{r.colName}</span> },
                    { key: "colType", label: "Tableau Data Type", render: (r: any) => <Badge variant="secondary" style={{ color: "#475569", whiteSpace: "nowrap" }}>{r.colType}</Badge> },
                    { key: "biType", label: "Power BI Target Type", render: (r: any) => <Badge variant="secondary" style={{ whiteSpace: "nowrap" }}>{r.biType}</Badge> },
                  ]}
                />
              </div>

              {/* Datasource ID & Schema Source card */}
              {foundTable && (() => {
                const inner = foundTable.payload || foundTable.data || foundTable;
                const dsId = inner.datasource_id;
                const schemaSrc = inner.schema_source;
                if (!dsId && !schemaSrc) return null;

                // Attempt to find datasource name from data.datasources
                let dsName = dsId;
                if (dsId && data.datasources && Array.isArray(data.datasources)) {
                  const dsMatch = data.datasources.find((d: any) => d.id === dsId);
                  if (dsMatch && dsMatch.name) {
                    dsName = dsMatch.name;
                  }
                }

                return (
                  <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", background: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>Source Details</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
                      {dsId && (
                        <div style={{ padding: "18px 24px", borderRight: schemaSrc ? "1px solid #f1f5f9" : "none", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Datasource</span>
                          <span style={{ fontSize: "13.5px", color: "#0f172a", fontWeight: 600, wordBreak: "break-all" }}>{dsName}</span>
                        </div>
                      )}
                      {schemaSrc && (
                        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>Schema Source</span>
                          <Badge variant="secondary" style={{ width: "fit-content" }}>{schemaSrc}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 2. CALCULATED FIELDS TAB */}
          {activeTab === "Calculated Fields" && (() => {
            const dimData2 = DAX_DATA.filter(d => d.type === "Dimension");
            const meaData2 = DAX_DATA.filter(d => d.type === "Measure");
            const lodData2 = DAX_DATA.filter(d => d.type === "LOD");

            const calcCols: MColDef<any>[] = [
              { key: "tableName", label: "Table", render: (r: any) => <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "13px" }}>{r.tableName}</span> },
              { key: "title", label: "Field Name", render: (r: any) => <span style={{ fontSize: "13px", color: "#334155" }}>{r.title}</span> },
              {
                key: "sourceCode", label: "Tableau Formula", mono: true, render: (r: any) => (
                  <div style={{ fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace", fontSize: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "6px 10px", color: "#334155", lineHeight: 1.5, wordBreak: "break-word" }}>{r.sourceCode}</div>
                )
              },
              {
                key: "targetCode", label: "Power BI DAX", mono: true, render: (r: any) => (
                  <div style={{ fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace", fontSize: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "6px 10px", color: "#166534", lineHeight: 1.5, wordBreak: "break-word" }}>{r.targetCode}</div>
                )
              },
              {
                key: "confidenceScore", label: "Confidence & Review", render: (r: any) => renderConfidenceReview(r.confidenceScore, r.reviewNotes)
              },
            ];

            const sectionDef = [
              { key: "dimensions", label: "Dimensions", data: dimData2, accent: "#4f46e5", badgeColor: "brand" as const },
              { key: "measures", label: "Measures", data: meaData2, accent: "#0891b2", badgeColor: "informative" as const },
              { key: "lods", label: "LOD Expressions", data: lodData2, accent: "#7c3aed", badgeColor: "warning" as const },
            ];


            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>
                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  Total: {DAX_DATA.length} field(s) — {dimData2.length} Dimension{dimData2.length !== 1 ? "s" : ""}, {meaData2.length} Measure{meaData2.length !== 1 ? "s" : ""}, {lodData2.length} LOD{lodData2.length !== 1 ? "s" : ""}
                </div>
                {sectionDef.map((sec, idx) => <CollapsibleCalcCard key={sec.key} sec={sec} calcCols={calcCols} styles={styles} defaultOpen={idx === 0} />)}
              </div>
            );
          })()}


          {/* 3. PARAMETERS & SETS TAB */}
          {activeTab === "Parameters & Sets" && (() => {
            const dynamicSets = DATA_SETS.filter((s: any) => (s.tableauType || "").toLowerCase() === "dynamic");
            const staticSets = DATA_SETS.filter((s: any) => (s.tableauType || "").toLowerCase() !== "dynamic");

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "28px", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>

                {/* ── Parameter Mappings ── */}
                <CollapsibleSectionCard
                  title="Parameter Mappings"
                  subtitle="Tableau parameters → Power BI slicers"
                  count={`${DATA_PARAMETERS.length} params`}
                  defaultOpen={true}
                >
                  {DATA_PARAMETERS.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "14px", fontStyle: "italic" }}>No parameter mapping data available yet.</div>
                  ) : (
                    <MDataTable
                      pageSize={ITEMS_PER_PAGE}
                      rows={DATA_PARAMETERS}
                      cols={[
                        {
                          key: "name", label: "Parameter Name",
                          render: (r: any) => (
                            <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>{r.name}</div>
                          )
                        },
                        {
                          key: "tableau", label: "Tableau Source",
                          render: (r: any) => (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", minWidth: "32px" }}>Type</span>
                                <Badge variant="secondary" style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{r.tableauDataType}</Badge>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", minWidth: "32px" }}>Kind</span>
                                <span style={{ fontSize: "13px", color: "#475569", fontWeight: 500 }}>{r.tableauKind}</span>
                              </div>
                            </div>
                          )
                        },
                        {
                          key: "powerbi", label: "Power BI Target",
                          render: (r: any) => (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", minWidth: "32px" }}>Type</span>
                                <Badge variant="default" style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{r.powerbiDataType}</Badge>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", minWidth: "32px" }}>Kind</span>
                                <span style={{ fontSize: "13px", color: "#334155", fontWeight: 500 }}>{r.powerbiKind}</span>
                              </div>
                            </div>
                          )
                        },
                        {
                          key: "powerbiDax", label: "Target DAX Definition",
                          render: (r: any) => r.powerbiDax !== "-" ? (
                            <div style={{ fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace", fontSize: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 12px", color: "#334155", lineHeight: "1.6", wordBreak: "break-word" }}>{r.powerbiDax}</div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "13px", fontStyle: "italic" }}>Standard slicer — no DAX required</span>
                          )
                        },
                        {
                          key: "confidenceScore", label: "Confidence & Review", render: (r: any) => renderConfidenceReview(r.confidenceScore, r.reviewNotes)
                        },
                      ]}
                    />
                  )}
                </CollapsibleSectionCard>

                {/* ── Dynamic Sets ── */}
                <CollapsibleSectionCard
                  title="Dynamic Sets"
                  subtitle="Computed set logic translated to DAX filters"
                  count={`${dynamicSets.length} sets`}
                  countBg="#334155"
                >
                  {dynamicSets.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "14px", fontStyle: "italic" }}>No dynamic sets found.</div>
                  ) : (
                    <MDataTable
                      pageSize={ITEMS_PER_PAGE}
                      rows={dynamicSets}
                      cols={[
                        { key: "name", label: "Set Name", render: (r: any) => <strong style={{ color: "#0f172a" }}>{r.name}</strong> },
                        { key: "tableauType", label: "Tableau Type", render: (r: any) => <Badge variant="secondary" style={{ whiteSpace: "nowrap" }}>{r.tableauType}</Badge> },
                        { key: "powerbiType", label: "Power BI Approach", render: (r: any) => <Badge variant="default" style={{ width: "fit-content", whiteSpace: "nowrap" }}>{r.powerbiType}</Badge> },
                        {
                          key: "powerbiDax", label: "DAX Implementation",
                          render: (r: any) => {
                            if (r.powerbiCalculatedColumns && r.powerbiCalculatedColumns.length > 0) {
                              return (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {r.powerbiCalculatedColumns.map((col: any, idx: number) => (
                                    <div key={idx} style={{ padding: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "4px" }}>
                                        {col.name} ({col.type || "Calculated Column"})
                                      </div>
                                      <code style={{ fontFamily: "'Cascadia Code',monospace", fontSize: "11px", color: "#334155", display: "block", background: "#ffffff", padding: "4px", borderRadius: "4px", border: "1px solid #f1f5f9" }}>
                                        {col.dax}
                                      </code>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return r.powerbiDax !== "-" ? (
                              <div style={{ fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace", fontSize: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 12px", color: "#334155", lineHeight: "1.6", wordBreak: "break-word" }}>{r.powerbiDax}</div>
                            ) : <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "13px" }}>—</span>;
                          }
                        },
                        {
                          key: "confidenceScore", label: "Confidence & Review", render: (r: any) => renderConfidenceReview(r.confidenceScore, r.reviewNotes)
                        },
                      ]}
                    />
                  )}
                </CollapsibleSectionCard>

                {/* ── Static Sets ── */}
                <CollapsibleSectionCard
                  title="Static Sets"
                  subtitle="Fixed member lists translated to DAX IN() expressions"
                  count={`${staticSets.length} sets`}
                  countBg="#334155"
                >
                  {staticSets.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "14px", fontStyle: "italic" }}>No static sets found.</div>
                  ) : (
                    <MDataTable
                      pageSize={ITEMS_PER_PAGE}
                      rows={staticSets}
                      cols={[
                        { key: "name", label: "Set Name", render: (r: any) => <strong style={{ color: "#0f172a" }}>{r.name}</strong> },
                        { key: "tableauType", label: "Tableau Type", render: (r: any) => <Badge variant="success" style={{ whiteSpace: "nowrap" }}>{r.tableauType || "static"}</Badge> },
                        { key: "powerbiType", label: "Power BI Approach", render: (r: any) => <Badge variant="default" style={{ width: "fit-content", whiteSpace: "nowrap" }}>{r.powerbiType}</Badge> },
                        {
                          key: "powerbiDax", label: "DAX Implementation",
                          render: (r: any) => r.powerbiDax !== "-" ? (
                            <div style={{ fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace", fontSize: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 12px", color: "#334155", lineHeight: "1.6", wordBreak: "break-word" }}>{r.powerbiDax}</div>
                          ) : <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "13px" }}>—</span>
                        },
                        {
                          key: "confidenceScore", label: "Confidence & Review", render: (r: any) => renderConfidenceReview(r.confidenceScore, r.reviewNotes)
                        },
                      ]}
                    />
                  )}
                </CollapsibleSectionCard>

              </div>
            );
          })()}

          {/* 5. ACTIONS TAB */}
          {activeTab === "Actions & Interactivity" && (() => {
            // Group actions by source dashboard
            const dashboardGroups: Record<string, typeof DATA_ACTIONS> = {};
            DATA_ACTIONS.forEach((a: any) => {
              const key = a.sourceDash && a.sourceDash !== "-" ? a.sourceDash : "Unassigned";
              if (!dashboardGroups[key]) dashboardGroups[key] = [];
              dashboardGroups[key].push(a);
            });
            const dashboardNames = Object.keys(dashboardGroups);

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>
                {/* Summary strip */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>Actions &amp; Interactivity</div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>Dashboard interactions, filters &amp; navigational flows</div>
                  </div>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>{DATA_ACTIONS.length}</div>
                      <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Actions</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>{dashboardNames.length}</div>
                      <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Dashboards</div>
                    </div>
                  </div>
                </div>

                {DATA_ACTIONS.length === 0 ? (
                  <Card className={styles.sectionCard}>
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8", fontSize: "15px" }}>No action mapping data available yet.</div>
                  </Card>
                ) : (
                  dashboardNames.map((name, idx) => (
                    <DashboardGroup key={name} name={name} actions={dashboardGroups[name]} styles={styles} defaultOpen={idx === 0} />
                  ))
                )}
              </div>
            );
          })()}
          {/* 6. DATA QUERIES TAB */}
          {activeTab === "Data Queries" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "28px", marginTop: "-20px" }}>
              {pagedStrategyData.length > 0 && pagedStrategyData[0].isLegacy ? (
                <div className={styles.tableContainer} style={{ padding: "20px 32px 32px 32px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", border: "none" }}>
                  <div style={{ marginBottom: "24px" }}>
                    <Title2 style={{ fontSize: "24px", color: "#0f172a", fontWeight: 700, margin: 0 }}>Data Connection Strategy</Title2>
                    <Text style={{ color: "#64748b", fontSize: "14px", display: "block", marginTop: "4px" }}>
                      Standard connection mapping and architecture fallback view
                    </Text>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th className={styles.tableHeaderCell} style={{ width: "25%" }}>Source Connection</th>
                        <th className={styles.tableHeaderCell} style={{ width: "15%" }}>Mode</th>
                        <th className={styles.tableHeaderCell} style={{ width: "20%" }}>Target Strategy</th>
                        <th className={styles.tableHeaderCell} style={{ width: "20%" }}>Fabric Lakehouse</th>
                        <th className={styles.tableHeaderCell} style={{ width: "20%" }}>Implementation Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedStrategyData.map((item: any, i: number) => (
                        <tr key={i}>
                          <td className={styles.spaciousCell}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.source}</div>
                          </td>
                          <td className={styles.spaciousCell}><Badge variant={item.mode.toLowerCase() === "live" ? "secondary" : "default"}>{item.mode}</Badge></td>
                          <td className={styles.spaciousCell}><Badge variant="success">{item.target}</Badge></td>
                          <td className={styles.spaciousCell}>{item.lakehouse}</td>
                          <td className={styles.spaciousCell}>{item.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {renderPagination(DATA_STRATEGY.length)}
                </div>
              ) : (pagedStrategyData.length > 0 && !pagedStrategyData[0].isLegacy) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                  {pagedStrategyData.map((item: any, i: number) => (
                    <div key={i} className={styles.tableContainer} style={{ padding: "20px 32px 32px 32px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", border: "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", flexWrap: "wrap" }}>
                            <Title2 style={{ fontSize: "24px", color: "#0f172a", fontWeight: 700, margin: 0 }}>Custom SQL Transformation</Title2>
                            <Badge variant="default" style={{ whiteSpace: "nowrap" }}>Relation: {item.relationType.replace(/_/g, ' ')}</Badge>
                          </div>
                          <Text style={{ color: "#64748b", fontSize: "14px" }}>Translating Tableau Custom SQL directly to Power Query M native queries</Text>
                        </div>

                      </div>

                      <div style={{ marginBottom: "24px" }}>
                        <Tabs
                          value={activeSqlTabs[i] || "Tableau Custom SQL"}
                          onValueChange={(value) => setActiveSqlTabs(prev => ({ ...prev, [i]: value }))}
                        >
                          <TabsList style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <TabsTrigger value="Tableau Custom SQL" style={{ fontWeight: 600, padding: "12px 24px", color: (activeSqlTabs[i] || "Tableau Custom SQL") === "Tableau Custom SQL" ? "#2563eb" : "#64748b" }}>Tableau Custom SQL</TabsTrigger>
                            <TabsTrigger value="Power BI M Query" style={{ fontWeight: 600, padding: "12px 24px", color: (activeSqlTabs[i] || "Tableau Custom SQL") === "Power BI M Query" ? "#047857" : "#64748b" }}>Power BI M Query</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      <div style={{ padding: "8px", borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                        {/* Left: Tab 1 Query */}
                        {(activeSqlTabs[i] || "Tableau Custom SQL") === "Tableau Custom SQL" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
                            <Title2 style={{ fontSize: "20px", color: "#1d4ed8", fontWeight: 700 }}>Tableau Custom SQL</Title2>
                            <div className={styles.codeText} style={{ padding: "20px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", maxHeight: "400px", overflowY: "auto", fontFamily: "Consolas, monospace", color: "#334155" }}>
                              {item.sqlQuery || "No SQL query provided."}
                            </div>
                          </div>
                        )}

                        {/* Right: Tab 2 Query */}
                        {(activeSqlTabs[i] || "Tableau Custom SQL") === "Power BI M Query" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
                              <Title2 style={{ fontSize: "20px", color: "#047857", fontWeight: 700 }}>Fabric Transformation Steps</Title2>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                {item.confidenceScore !== null && (
                                  <span style={{ display: "inline-block", width: "42px", textAlign: "center", fontSize: "12px", fontWeight: 800, color: item.confidenceScore >= 90 ? "#16a34a" : item.confidenceScore >= 70 ? "#ca8a04" : "#dc2626", background: item.confidenceScore >= 90 ? "#dcfce7" : item.confidenceScore >= 70 ? "#fef08a" : "#fee2e2", padding: "4px 0", borderRadius: "16px" }}>{item.confidenceScore}%</span>
                                )}
                                {item.reviewNotes && (
                                  <Dialog>
                                    <DialogTrigger disableButtonEnhancement>
                                      <Button variant="ghost" size="sm" style={{ fontSize: "12px", color: "#2563eb", padding: "0 6px", minWidth: "auto", cursor: "pointer" }}>Review</Button>
                                    </DialogTrigger>
                                    <DialogSurfaceContent>
                                      <DialogHeader>
                                        <DialogTitle>Mapping Review Notes</DialogTitle>
                                      </DialogHeader>
                                      <DialogContent>
                                        <div style={{ fontSize: "14px", color: "#334155", lineHeight: "1.6", whiteSpace: "pre-wrap", textAlign: "left" }}>
                                          {item.reviewNotes}
                                        </div>
                                      </DialogContent>
                                      <DialogFooter>
                                        <DialogClose>
                                          <Button variant="secondary">Close</Button>
                                        </DialogClose>
                                      </DialogFooter>
                                    </DialogSurfaceContent>
                                  </Dialog>
                                )}
                              </div>
                            </div>
                            <div className={styles.codeText} style={{ padding: "20px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", maxHeight: "400px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", fontFamily: "Consolas, monospace" }}>
                              {item.mQuerySteps && item.mQuerySteps.length > 0 ? (
                                item.mQuerySteps.map((step: any, sIdx: number) => (
                                  <div key={sIdx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    {item.mQuerySteps.length > 1 && <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Step {step.step}</span>}
                                    <div style={{ color: "#0f172a" }}>{step.content}</div>
                                  </div>
                                ))
                              ) : (
                                <Text style={{ fontStyle: "italic", color: "#94a3b8" }}>No M Query steps generated.</Text>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Columns Metadata — paginated */}
                      {item.columns && item.columns.length > 0 && (
                        <div style={{ marginTop: "20px" }}>
                          <div style={{ fontSize: "15px", fontWeight: 700, color: "#1e3a8a", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>Output Column Transformations</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, background: "#eff6ff", color: "#1e40af", borderRadius: "12px", padding: "2px 10px", border: "1px solid #bfdbfe" }}>{item.columns.length}</span>
                          </div>
                          <MDataTable
                            pageSize={5}
                            rows={item.columns.map((col: any) => ({
                              tabColName: col.tableau_column_name || "-",
                              tabColType: col.tableau_datatype || col.tableau_data_type || "-",
                              biColName: col.bi_column_name || "-",
                              biColType: col.bi_datatype || "-",
                            }))}
                            cols={[
                              { key: "tabColName", label: "Tableau Column Name", render: (r: any) => <span style={{ fontWeight: 500, color: "#0f172a", fontSize: "13px" }}>{r.tabColName}</span> },
                              {
                                key: "tabColType", label: "Tableau Data Type", render: (r: any) => r.tabColType !== "-" ? (
                                  <span style={{ display: "inline-block", padding: "2px 8px", fontSize: "12px", color: "#334155", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px" }}>{r.tabColType}</span>
                                ) : "-"
                              },
                              { key: "biColName", label: "Power BI Column Name", render: (r: any) => <span style={{ fontWeight: 500, color: "#0f172a", fontSize: "13px" }}>{r.biColName}</span> },
                              {
                                key: "biColType", label: "Power BI Data Type", render: (r: any) => (
                                  <span style={{ display: "inline-block", padding: "2px 8px", fontSize: "12px", color: "#0284c7", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "4px" }}>{r.biColType}</span>
                                )
                              },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {renderPagination(DATA_STRATEGY.length)}
                </div>
              ) : (
                <div className={styles.tableContainer} style={{ padding: "40px", backgroundColor: "#ffffff", borderRadius: "16px", border: "none", textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <Title2 style={{ color: "#0f172a", fontSize: "20px" }}>No Data Connection Mappings</Title2>
                    <Text style={{ color: "#64748b", fontSize: "14px" }}>No legacy connection or custom SQL mappings were detected in this workbook.</Text>
                  </div>
                </div>
              )}
            </div>
          )
          }

          {/* 7. VISUAL CONFIGURATION TAB */}
          {
            activeTab === "Visual Configuration" && (() => {
              const sheetsData = DATA_VISUALS.filter(v => v.category === "Sheets");
              const kpiData = DATA_VISUALS.filter(v => v.category === "KPI & Summary");

              const sheetCols: MColDef<any>[] = [
                {
                  key: "sheet", label: "Sheet Name",
                  render: (r: any) => <div><strong style={{ color: "#0f172a", fontSize: "14px", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>{r.sheet}</strong></div>
                },
                {
                  key: "sourceVis", label: "Source Visual Type",
                  render: (r: any) => <Badge variant="secondary" style={{ textTransform: "capitalize" }}>{r.sourceVis}</Badge>
                },
                {
                  key: "targetVis", label: "Power BI Visual",
                  render: (r: any) => {
                    if (!r.targetVis || r.targetVis === "-") return <span style={{ color: "#94a3b8" }}>—</span>;
                    const badge = <Badge variant="default" style={{ height: "auto", whiteSpace: "normal", padding: "4px 8px", textAlign: "center", lineHeight: "1.2", cursor: r.importLink ? "pointer" : "default", textDecoration: r.importLink ? "underline" : "none" }}>{r.targetVis}</Badge>;
                    if (r.importLink) {
                      return <Link href={r.importLink} target="_blank" style={{ textDecoration: 'none' }}>{badge}</Link>;
                    }
                    return badge;
                  }
                },
                {
                  key: "filters", label: "Filters",
                  render: (r: any) => <VisualsDetailPopover title="Applied Filters" data={r.filters} icon={<Filter />} styles={styles} type="filters" />
                },
                {
                  key: "formatting", label: "Formatting",
                  render: (r: any) => <VisualsDetailPopover title="Formatting Details" data={r.formatting} icon={<Sparkles style={{ width: "16px", height: "16px" }} />} styles={styles} type="formatting" />
                },
              ];

              const kpiCols: MColDef<any>[] = [
                {
                  key: "sheet", label: "Sheet Name",
                  render: (r: any) => <div><strong style={{ color: "#0f172a", fontSize: "14px", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>{r.sheet}</strong></div>
                },
                {
                  key: "sourceVis", label: "Source Visual Type",
                  render: (r: any) => <Badge variant="secondary" style={{ textTransform: "capitalize" }}>{r.sourceVis}</Badge>
                },
                {
                  key: "targetVis", label: "Power BI Visual",
                  render: (r: any) => {
                    if (!r.targetVis || r.targetVis === "-") return <span style={{ color: "#94a3b8" }}>—</span>;
                    const badge = <Badge variant="default" style={{ height: "auto", whiteSpace: "normal", padding: "4px 8px", textAlign: "center", lineHeight: "1.2", cursor: r.importLink ? "pointer" : "default", textDecoration: r.importLink ? "underline" : "none" }}>{r.targetVis}</Badge>;
                    if (r.importLink) {
                      return <Link href={r.importLink} target="_blank" style={{ textDecoration: 'none' }}>{badge}</Link>;
                    }
                    return badge;
                  }
                },
                {
                  key: "filters", label: "Filters",
                  render: (r: any) => <VisualsDetailPopover title="Applied Filters" data={r.filters} icon={<Filter />} styles={styles} type="filters" />
                },
                {
                  key: "formatting", label: "Formatting",
                  render: (r: any) => <VisualsDetailPopover title="Formatting Details" data={r.formatting} icon={<Sparkles style={{ width: "16px", height: "16px" }} />} styles={styles} type="formatting" />
                },
              ];

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <Text size={500} weight="bold" style={{ color: "#0f172a", fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" }}>Visuals ({DATA_VISUALS.length})</Text>

                  <div style={{ borderBottom: "1px solid #e2e8f0", marginBottom: "0" }}>
                    <Tabs
                      value={visualSubTab}
                      onValueChange={(value) => setVisualSubTab(value)}
                    >
                      <TabsList>
                        <TabsTrigger value="Sheets" className="vl-no-hover-tab" style={{ fontSize: "14px", fontWeight: 500 }}>Sheets ({sheetsData.length})</TabsTrigger>
                        <TabsTrigger value="KPI & Summary" className="vl-no-hover-tab" style={{ fontSize: "14px", fontWeight: 500 }}>KPI & Summary ({kpiData.length})</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {visualSubTab === "Sheets" && <MDataTable cols={sheetCols} rows={sheetsData} />}
                  {visualSubTab === "KPI & Summary" && <MDataTable cols={kpiCols} rows={kpiData} />}
                </div>
              );
            })()
          }

          {/* 8. RELATIONSHIPS TAB */}
          {
            activeTab === "Relationships" && (
              <Card className={styles.sectionCard} style={{ padding: "28px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <Title2 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>Data Model Relationships</Title2>
                  <Text style={{ color: "#64748b", fontSize: "14px", display: "block", marginTop: "4px" }}>
                    Tableau-to-Power BI table relationship cardinality and cross-filter direction mapping
                  </Text>
                </div>
                <div className={styles.tableContainer}>
                  <table>
                    <thead>
                      <tr>
                        <th className={styles.tableHeaderCell} style={{ width: "33%", fontWeight: "bold" }}>Source Table</th>
                        <th className={styles.tableHeaderCell} style={{ width: "34%", fontWeight: "bold" }}>Relationship Type</th>
                        <th className={styles.tableHeaderCell} style={{ width: "33%", fontWeight: "bold" }}>Target Table</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRelationshipsData.length > 0 ? (
                        pagedRelationshipsData.map((item: any, i: number) => {
                          const fromColText = typeof item.fromColumn === 'object' ? JSON.stringify(item.fromColumn) : (item.fromColumn || "-");
                          const toColText = typeof item.toColumn === 'object' ? JSON.stringify(item.toColumn) : (item.toColumn || "-");

                          let displayCardinality = item.cardinality || "-";
                          if (displayCardinality !== "-") {
                            displayCardinality = displayCardinality
                              .replace(/([A-Z])/g, ' $1')
                              .replace(/-/g, ' ')
                              .trim();
                            displayCardinality = displayCardinality.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                          }

                          return (
                            <tr key={i}>
                              <td className={styles.spaciousCell} style={{ padding: "22px 16px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  <span style={{ fontWeight: 500, fontSize: "15px", color: "#0f172a" }}>{item.fromTable}</span>
                                  <span style={{ fontSize: "12px", color: "#64748b" }}>Field: {fromColText}</span>
                                </div>
                              </td>
                              <td className={styles.spaciousCell} style={{ padding: "22px 16px" }}>
                                <Badge variant="default" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                                  {displayCardinality}
                                </Badge>
                              </td>
                              <td className={styles.spaciousCell} style={{ padding: "22px 16px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  <span style={{ fontWeight: 500, fontSize: "15px", color: "#0f172a" }}>{item.toTable}</span>
                                  <span style={{ fontSize: "12px", color: "#64748b" }}>Field: {toColText}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr><td colSpan={3} style={{ textAlign: "center", padding: "32px" }}><Text color="neutralSecondary">No relationship mapping data available yet.</Text></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {renderPagination(DATA_RELATIONSHIPS.length)}
              </Card>
            )
          }

        </div >
      </Card >

      {/* Low Confidence Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogSurfaceContent style={{ maxWidth: "1000px", width: "90vw" }}>
          <DialogHeader>
            <DialogTitle>Mapping Review - Low Confidence Items</DialogTitle>
          </DialogHeader>
          <DialogContent>
              <div style={{ marginBottom: "20px" }}>
                <Text size={300} color="neutralSecondary">
                  The following items have a mapping confidence score below 90% and should be reviewed to ensure migration accuracy.
                </Text>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
                <MDataTable
                  pageSize={8}
                  rows={lowConfidenceItems}
                  cols={[
                    { key: "category", label: "Category", render: (r: any) => <Badge variant="default" style={{ whiteSpace: "nowrap" }}>{r.category}</Badge> },
                    { key: "title", label: "Item Name", render: (r: any) => <Text weight="semibold" style={{ color: "#0f172a" }}>{r.title}</Text> },
                    { key: "confidenceScore", label: "Confidence", render: (r: any) => renderConfidenceReview(r.confidenceScore, null) },
                    { 
                      key: "reviewNotes", 
                      label: "Notes", 
                      render: (r: any) => (
                        <div style={{ fontSize: "12px", color: "#64748b", maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.reviewNotes || "No notes available"}
                        </div>
                      ) 
                    },
                    {
                      key: "actions",
                      label: "Action",
                      render: (r: any) => renderConfidenceReview(null, r.reviewNotes || "No specific details available for this item.", r.importLink)
                    }
                  ]}
                />
              </div>
            </DialogContent>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setIsReviewDialogOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogSurfaceContent>
      </Dialog>
    </div >
  );
}

