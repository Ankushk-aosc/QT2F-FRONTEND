"use client"

import { useAgentStore } from "@/stores/agent.store"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChevronDown,
  ChevronRight,
  Gauge,
  Database,
  LayoutDashboard,
  Table as TableIcon,
  PieChart,
  Calculator,
  Zap,
  Settings,
  Shapes,
  AlertTriangle,
} from "lucide-react"
import React, { useState, useEffect } from "react"
import { useUIStore } from "@/stores/ui.store"
import AssessmentResultsView from "@/components/Assessment-Results/AssessmentResultsView"

const WEIGHT_MAP: Record<string, number> = { regular: 400, medium: 500, semibold: 600, bold: 700 }
const SIZE_MAP: Record<number, number> = { 100: 10, 200: 12, 300: 14, 400: 16, 500: 20, 600: 24, 700: 28, 800: 32, 900: 40, 1000: 68 }

function Text({
  weight,
  size,
  style,
  ...props
}: { weight?: "regular" | "medium" | "semibold" | "bold"; size?: number } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      style={{
        fontWeight: weight ? WEIGHT_MAP[weight] : undefined,
        fontSize: size ? `${SIZE_MAP[size]}px` : undefined,
        ...style,
      }}
      {...props}
    />
  )
}

/* ── Reusable pagination for AssessmentTab tables ── */
function usePagination<T>(items: T[], pageSize = 5, isPdfMode = false) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const needsPagination = items.length > pageSize && !isPdfMode
  // Clamp page inside an effect — never call setState during render
  const safePage = Math.min(page, totalPages - 1)
  useEffect(() => {
    if (safePage !== page && !isPdfMode) setPage(safePage)
  }, [safePage, page, isPdfMode])
  const pageItems = isPdfMode ? items : (needsPagination ? items.slice(safePage * pageSize, (safePage + 1) * pageSize) : items)
  return { page: safePage, setPage, totalPages, needsPagination, pageItems, total: items.length }
}

function PaginationControls({ page, totalPages, total, setPage, pageSize = 10 }: { page: number; totalPages: number; total: number; setPage: (fn: (p: number) => number) => void; pageSize?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", padding: "12px 16px", borderTop: "1px solid #e2e8f0", fontSize: "13px", color: "#64748b" }}>
      <span>Page {page + 1} of {totalPages} ({Math.min((page + 1) * pageSize, total)} of {total} items)</span>
      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === 0 ? "#f8fafc" : "#ffffff", color: page === 0 ? "#cbd5e1" : "#334155", cursor: page === 0 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Previous</button>
      <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page >= totalPages - 1 ? "#f8fafc" : "#ffffff", color: page >= totalPages - 1 ? "#cbd5e1" : "#334155", cursor: page >= totalPages - 1 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Next</button>
    </div>
  )
}

const useStyles = () => ({
  container: "vl-container",
  wrapCell: "vl-wrap-cell",
  header: "vl-header",
  title: "vl-title",
  subtitle: "vl-subtitle",
  metricsGrid: "vl-metrics-grid",
  metricCard: "vl-metric-card",
  metricValue: "vl-metric-value",
  metricLabel: "vl-metric-label",
  tabsCard: "vl-tabs-card",
  tabList: "vl-tab-list",
  tabContent: "vl-tab-content",
  sectionCard: "vl-section-card",
  sectionHeaderRow: "vl-section-header-row",
  sectionHeader: "vl-section-header",
  grid2: "vl-grid-2",
  grid3: "vl-grid-3",
  grid4: "vl-grid-4",
  grid5: "vl-grid-5",
  infoItem: "vl-info-item",
  infoLabel: "vl-info-label",
  infoValue: "vl-info-value",
  riskPill: "vl-risk-pill",
  listItem: "vl-list-item",
  tableContainer: "vl-table-container",
  breakdownItem: "vl-breakdown-item",
  breakdownWarning: "vl-breakdown-item vl-breakdown-warning",
  breakdownText: "vl-breakdown-text",
  breakdownLabel: "vl-breakdown-label",
  breakdownDesc: "vl-breakdown-desc",
});

// ────────────────────────────────────────────────────────────
// Formatting Overview Card – extracted to fix React hook violations
// ────────────────────────────────────────────────────────────
const FormattingOverviewCard = ({ formatting, styles, isPdfMode }: { formatting: any, styles: any, isPdfMode?: boolean }) => {
  const summary = formatting?.summary || {};
  const details = formatting?.details || [];

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Auto-expand the first item by default — expandedItems must NOT be a dep
  // to avoid the effect re-running every time it sets state.
  useEffect(() => {
    const firstItem = details.find((item: any) => item.has_custom_formatting);
    if (firstItem) {
      const name = firstItem.name || "Object 1";
      setExpandedItems(prev => Object.keys(prev).length === 0 ? { [name]: true } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details]);

  // Determine if there's any custom formatting at all
  const hasAnyCustomFormatting =
    summary.uses_custom_fonts ||
    summary.uses_custom_colors ||
    summary.uses_custom_borders ||
    details.some((item: any) => item.has_custom_formatting);

  if (!hasAnyCustomFormatting) {
    return null;
  }

  const uniqueCustomColors = Array.isArray(summary.unique_custom_colors) ? summary.unique_custom_colors : [];
  const uniqueCustomFonts = Array.isArray(summary.unique_custom_fonts) ? summary.unique_custom_fonts : [];
  const uniqueBorderStyles = Array.isArray(summary.unique_border_styles) ? summary.unique_border_styles : [];

  const worksheetMetrics = summary.worksheet_metrics || {};

  // Prepare usage maps: which sheets use each custom font/color
  const fontUsageMap: Record<string, string[]> = {};
  const colorUsageMap: Record<string, string[]> = {};

  details.forEach((item: any) => {
    const name = item.name || "Unnamed";
    if (!item.has_custom_formatting) return;

    (item.custom_fonts || []).forEach((font: string) => {
      if (!fontUsageMap[font]) fontUsageMap[font] = [];
      fontUsageMap[font].push(name);
    });

    (item.custom_colors || []).forEach((color: string) => {
      if (!colorUsageMap[color]) colorUsageMap[color] = [];
      colorUsageMap[color].push(name);
    });
  });

  const toggleExpand = (name: string) => {
    if (isPdfMode) return;
    setExpandedItems((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  return (
    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeader}>Formatting & Styling</div>

      {/* Summary Grid */}
      <div className={styles.grid3} style={{ margin: "20px 0 24px" }}>
        <div className={styles.infoItem}>
          <div className={styles.infoLabel}>Custom Fonts</div>
          <div className={styles.infoValue}>
            {summary.uses_custom_fonts ? (
              <Badge variant="warning">
                Yes ({uniqueCustomFonts.length})
              </Badge>
            ) : (
              <Badge variant="success">No</Badge>
            )}
          </div>
        </div>

        <div className={styles.infoItem}>
          <div className={styles.infoLabel}>Custom Colors</div>
          <div className={styles.infoValue}>
            {summary.uses_custom_colors ? (
              <Badge variant="warning">
                Yes ({uniqueCustomColors.length})
              </Badge>
            ) : (
              <Badge variant="success">No</Badge>
            )}
          </div>
        </div>

        <div className={styles.infoItem}>
          <div className={styles.infoLabel}>Custom Borders</div>
          <div className={styles.infoValue}>
            {summary.uses_custom_borders ? (
              <Badge variant="warning">
                Yes ({uniqueBorderStyles.length} styles)
              </Badge>
            ) : (
              <Badge variant="success">No</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Default + Custom Usage Counts – big card in single row */}
      <div className={styles.grid4}
        style={{
          margin: "0 0 32px",
          padding: "20px",
          background: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "6px" }}>
            Default Colors Used
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#1e293b" }}>
            {worksheetMetrics.default_colors_used_count ?? 0}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "6px" }}>
            Default Fonts Used
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#1e293b" }}>
            {worksheetMetrics.default_fonts_used_count ?? 0}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "6px" }}>
            Custom Colors Used
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#c2410c" }}>
            {worksheetMetrics.custom_colors_used_count ?? 0}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "6px" }}>
            Custom Fonts Used
          </div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#c2410c" }}>
            {worksheetMetrics.custom_fonts_used_count ?? 0}
          </div>
        </div>
      </div>

      {/* Unique Custom Colors Preview */}
      {uniqueCustomColors.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div className={styles.infoLabel} style={{ marginBottom: "12px" }}>
            Unique Custom Colors (Workbook-Wide)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
            {uniqueCustomColors.map((color: string, idx: number) => (
              <div
                key={idx}
                style={{
                  width: 52,
                  height: 52,
                  backgroundColor: color,
                  borderRadius: "10px",
                  border: "2px solid #e5e7eb",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                  position: "relative",
                }}
                title={color}
              >
                <div
                  style={{
                    position: "absolute",
                    bottom: "4px",
                    right: "4px",
                    fontSize: "10px",
                    color: "#fff",
                    textShadow: "0 0 2px #000",
                    background: "rgba(0,0,0,0.4)",
                    padding: "2px 4px",
                    borderRadius: "4px",
                  }}
                >
                  {color.substring(1, 7)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Fonts + Usage */}
      {Object.keys(fontUsageMap).length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div className={styles.infoLabel} style={{ marginBottom: "12px" }}>
            Custom Fonts & Sheets Using Them
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Object.entries(fontUsageMap).map(([font, sheets]) => (
              <div
                key={font}
                style={{
                  padding: "12px 16px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontFamily: font,
                    fontWeight: 600,
                    fontSize: "15px",
                    marginBottom: "6px",
                  }}
                >
                  {font}
                </div>
                <div style={{ fontSize: "13px", color: "#475569" }}>
                  Used in: {sheets.join(" • ")}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  ({sheets.length} object{sheets.length !== 1 ? "s" : ""})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Colors + Usage */}
      {Object.keys(colorUsageMap).length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div className={styles.infoLabel} style={{ marginBottom: "12px" }}>
            Custom Colors & Sheets Using Them
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Object.entries(colorUsageMap).map(([color, sheets]) => (
              <div
                key={color}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "12px 16px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: color,
                    borderRadius: "8px",
                    border: "2px solid #cbd5e1",
                    flexShrink: 0,
                    position: "relative",
                  }}
                  title={color}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: "4px",
                      right: "4px",
                      fontSize: "10px",
                      color: "#fff",
                      textShadow: "0 0 2px #000",
                      background: "rgba(0,0,0,0.5)",
                      padding: "1px 4px",
                      borderRadius: "4px",
                    }}
                  >
                    {color.replace("#", "")}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: "14px" }}>{color}</div>
                  <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
                    Used in: {sheets.join(" • ")}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    ({sheets.length} object{sheets.length !== 1 ? "s" : ""})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unique Border Styles */}
      {uniqueBorderStyles.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div className={styles.infoLabel} style={{ marginBottom: "8px" }}>
            Unique Border Styles (Workbook-Wide)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {uniqueBorderStyles.map((style: string, idx: number) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  style={{ textTransform: "capitalize", whiteSpace: "nowrap" }}
                >
                {style}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Per-Object Expandable Details */}
      {details.length > 0 && (
        <>
          <div style={{ fontWeight: 600, margin: "0 0 16px 0", fontSize: "15px" }}>
            Objects with Custom Formatting (
            {details.filter((item: any) => item.has_custom_formatting).length})
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {details
              .filter((item: any) => item.has_custom_formatting)
              .map((item: any, idx: number) => {
                const name = item.name || `Object ${idx + 1}`;
                const isExpanded = isPdfMode || expandedItems[name] || false;

                const customColors = Array.isArray(item.custom_colors) ? item.custom_colors : [];
                const customBorders = Array.isArray(item.custom_borders) ? item.custom_borders : [];
                const customFonts = Array.isArray(item.custom_fonts) ? item.custom_fonts : [];

                const colorCount = customColors.length;
                const borderCount = customBorders.length;
                const fontCount = customFonts.length;

                return (
                  <div key={idx}>
                    <div
                      className={styles.sectionHeaderRow}
                      style={{
                        cursor: "pointer",
                        background: "#f8fafc",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        border: "1px solid #e2e8f0",
                        marginBottom: isExpanded ? 0 : "8px",
                      }}
                      onClick={() => toggleExpand(name)}
                    >
                      {isExpanded ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
                      <div className={styles.sectionHeader} style={{ fontSize: "16px", margin: 0 }}>
                        <Badge
                          variant="default"
                          style={{ marginRight: "8px" }}
                        >
                          {item.type}
                        </Badge>
                        {name}
                      </div>
                      <div style={{ display: "flex", gap: "12px", fontSize: "14px", color: "#64748b" }}>
                        {colorCount > 0 && <span title="Custom colors">🎨 {colorCount}</span>}
                        {borderCount > 0 && <span title="Custom borders">⬜ {borderCount}</span>}
                        {fontCount > 0 && <span title="Custom fonts">🔤 {fontCount}</span>}
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          background: "white",
                          border: "1px solid #e2e8f0",
                          borderTop: "none",
                          borderRadius: "0 10px 10px 10px",
                          padding: "20px 24px",
                          marginTop: "-1px",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: "24px",
                          }}
                        >
                          {colorCount > 0 && (
                            <div>
                              <div className={styles.infoLabel} style={{ marginBottom: "12px" }}>
                                Custom Colors
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                                {customColors.map((color: string, cIdx: number) => (
                                  <div
                                    key={cIdx}
                                    style={{
                                      width: 44,
                                      height: 44,
                                      backgroundColor: color,
                                      borderRadius: "8px",
                                      border: "2px solid #e5e7eb",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                      position: "relative",
                                    }}
                                    title={color}
                                  >
                                    <div
                                      style={{
                                        position: "absolute",
                                        bottom: "2px",
                                        right: "2px",
                                        fontSize: "9px",
                                        color: "#fff",
                                        textShadow: "0 0 2px #000",
                                      }}
                                    >
                                      {color.substring(1, 7)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {borderCount > 0 && (
                            <div>
                              <div className={styles.infoLabel} style={{ marginBottom: "12px" }}>
                                Custom Border Styles
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                {customBorders.map((borderStyle: string, bIdx: number) => (
                                  <Badge
                                    key={bIdx}
                                    variant="secondary"
                                    style={{
                                      textTransform: "capitalize",
                                      whiteSpace: "nowrap"
                                    }}
                                  >
                                    {borderStyle}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {fontCount > 0 && (
                            <div>
                              <div className={styles.infoLabel} style={{ marginBottom: "12px" }}>
                                Custom Fonts
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {customFonts.map((font: string, fIdx: number) => (
                                  <div
                                    key={fIdx}
                                    style={{
                                      fontFamily: font,
                                      fontSize: "15px",
                                      padding: "6px 12px",
                                      background: "#f1f5f9",
                                      borderRadius: "6px",
                                      border: "1px solid #e2e8f0",
                                      display: "inline-block",
                                    }}
                                  >
                                    {font}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}
    </Card>
  );
};

import { useDashboardStore } from "@/stores/dashboard.store"

interface AssessmentTabProps {
  selectedWorkbookId: string
  projectId?: string
  runId?: string
  isPdfMode?: boolean
}


// ────────────────────────────────────────────────────────────
// Prop Interfaces for sub-tabs
// ────────────────────────────────────────────────────────────
interface ModelingTabProps {
  parameters: any[];
  sets: any[];
  total_calculations: number;
  pct_basic: number;
  pct_table_calc: number;
  pct_lod: number;
  pct_parameters: number;
  pct_scripts: number;
  pct_raw_sql: number;
  lods_analysis: any;
  lodCounts: any;
  styles: any;
  isPdfMode?: boolean;
}

interface VisualsTabProps {
  viz_extensions: any[];
  actions: any[];
  visualDetails: any[];
  containers: any[];
  dashboards_detailed: any;
  detailed_layouts: any[];
  visualization_count: number;
  sheet_count: number;
  story_count: number;
  embeddedImages: number;
  webObjects: number;
  styles: any;
  PaginationControls: any;
  usePagination: any;
  isPdfMode?: boolean;
}

interface OverviewTabProps {
  workbook_name: string;
  owner_name: string;
  last_modified_at: string;
  status: string;
  styles: any;
  // New props for summary counts
  total_calculations?: number;
  total_actions?: number;
  total_parameters?: number;
  total_sets?: number;
  total_sheets?: number;
  total_dashboards?: number;
  total_sources?: number;
  total_stories?: number;
  visualization_count?: number;
  legacy_risks: any;
  version_info: any;
}

interface FormattingTabProps {
  formatting: any;
  styles: any;
  isPdfMode?: boolean;
}

interface DataSourcesTabProps {
  logical_datasources: any[];
  detailed_connections: any[];
  custom_sql_details: any[];
  connection_type: string;
  hasCustomSQL: boolean;
  customSqlCount: number;
  database_sources: any[];
  custom_sql?: any[];
  semantics_raw?: any;
  styles: any;
  PaginationControls: any;
  usePagination: any;
  isPdfMode?: boolean;
}

interface SecurityTabProps {
  security_entitlements: any;
  detailed_connections: any[];
  extract_analysis?: any;
  refresh_schedule?: any;
  styles: any;
  tags?: string[];
  isPdfMode?: boolean;
}

interface ChallengesTabProps {
  complexity: any;
  styles: any;
}

const ModelingTab = ({
  parameters,
  sets,
  total_calculations,
  pct_basic,
  pct_table_calc,
  pct_lod,
  pct_parameters,
  pct_scripts,
  pct_raw_sql,
  lods_analysis,
  lodCounts,
  styles,
  isPdfMode
}: ModelingTabProps) => {
  const calculatedItems = [
    { label: "Total Calculations", value: `${total_calculations || 0}`, secondary: "calculated fields" },
    { label: "Basic Calculations", value: `${Math.round((pct_basic / 100) * total_calculations)}`, secondary: `(${pct_basic?.toFixed(1)}%)` },
    { label: "Table Calculations", value: `${Math.round((pct_table_calc / 100) * total_calculations)}`, secondary: `(${pct_table_calc?.toFixed(1)}%)` },
    { label: "LOD Expressions", value: `${Math.round((pct_lod / 100) * total_calculations)}`, secondary: `(${pct_lod?.toFixed(1)}%)` },
    { label: "Parameter Calculations", value: `${Math.round((pct_parameters / 100) * total_calculations)}`, secondary: `(${pct_parameters?.toFixed(1)}%)` },
    { label: "Scripts", value: `${Math.round((pct_scripts / 100) * total_calculations)}`, secondary: `(${pct_scripts?.toFixed(1)}%)` },
    { label: "RAWSQL", value: `${Math.round((pct_raw_sql / 100) * total_calculations)}`, secondary: `(${pct_raw_sql?.toFixed(1)}%)` },
  ];

  const calcMid = Math.ceil(calculatedItems.length / 2);
  const calcLeft = calculatedItems.slice(0, calcMid);
  const calcRight = calculatedItems.slice(calcMid);

  const lodItems = [
    { label: "Total LODs", value: `${lods_analysis.total_count || 0}`, secondary: "expressions" },
    { label: "FIXED", value: `${lodCounts.FIXED || lodCounts.fixed || 0}`, secondary: "expressions" },
    { label: "INCLUDE", value: `${lodCounts.INCLUDE || lodCounts.include || 0}`, secondary: "expressions" },
    { label: "EXCLUDE", value: `${lodCounts.EXCLUDE || lodCounts.exclude || 0}`, secondary: "expressions" },
    { label: "(2+ levels) LOD", value: `${lodCounts["(2+ levels) LOD"] || 0}`, secondary: "expressions" },
    { label: "LOD + dimension filters", value: `${lodCounts["LOD + dimension filters"] || 0}`, secondary: "expressions" },
  ];

  const lodMid = Math.ceil(lodItems.length / 2);
  const lodLeft = lodItems.slice(0, lodMid);
  const lodRight = lodItems.slice(lodMid);

  return (
    <>
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Calculations</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" }}>
          {[calcLeft, calcRight].map((column, colIdx) => (
            <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {column.map((item, i) => (
                <div key={i} className={styles.breakdownItem}>
                  <div className={styles.breakdownText}><div className={styles.breakdownLabel}>{item.label}</div></div>
                  <div style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <strong>{item.value}</strong>
                    {item.secondary && <span style={{ color: "#64748b", fontSize: "13px", marginLeft: "8px" }}>{item.secondary}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>LOD Expressions</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" }}>
          {[lodLeft, lodRight].map((column, colIdx) => (
            <div key={colIdx} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {column.map((item, i) => (
                <div key={i} className={styles.breakdownItem}>
                  <div className={styles.breakdownText}><div className={styles.breakdownLabel}>{item.label}</div></div>
                  <div style={{ whiteSpace: "nowrap" }}>
                    <strong>{item.value}</strong>
                    {item.secondary && <span style={{ color: "#64748b", fontSize: "13px", marginLeft: "8px" }}>{item.secondary}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
      {parameters.length > 0 && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Parameters</div>
          <div style={{ padding: "12px 16px", background: "#f1f5f9", borderRadius: "6px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "15px" }}>Total Parameters</span>
            <strong style={{ fontSize: "17px" }}>{parameters.length}</strong>
          </div>
          <div style={{ overflowX: "auto", width: "100%", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 700, fontSize: "12px" }}>Parameter Name</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 700, fontSize: "12px" }}>Data Type</th>
                </tr>
              </thead>
              <tbody>
                {parameters.map((param, idx) => (
                  <tr key={idx} style={{ borderBottom: idx === parameters.length - 1 ? "none" : "1px solid #f1f5f9", background: "#ffffff" }}>
                    <td style={{ padding: "14px 16px", verticalAlign: "middle", fontWeight: 600, color: "#1e293b" }}>{param.name}</td>
                    <td style={{ padding: "14px 16px", verticalAlign: "middle", color: "#64748b" }}>{param.data_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {sets.length > 0 && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Sets Summary</div>
          <div style={{ padding: "12px 16px", background: "#f1f5f9", borderRadius: "6px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "15px" }}>Total Sets</span>
            <strong style={{ fontSize: "17px" }}>{sets.length}</strong>
          </div>
          <div style={{ overflowX: "auto", width: "100%", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 700, fontSize: "12px" }}>Set Category</th>
                  <th style={{ textAlign: "right", padding: "12px 16px", color: "#64748b", fontWeight: 700, fontSize: "12px" }}>Count</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#ffffff" }}>
                  <td style={{ padding: "14px 16px", verticalAlign: "middle", fontWeight: 600, color: "#1e293b" }}>Static Sets</td>
                  <td style={{ padding: "14px 16px", verticalAlign: "middle", textAlign: "right", color: "#64748b" }}><strong>{sets.filter(s => (s.type || "").toLowerCase().includes("static")).length}</strong></td>
                </tr>
                <tr style={{ background: "#ffffff" }}>
                  <td style={{ padding: "14px 16px", verticalAlign: "middle", fontWeight: 600, color: "#1e293b" }}>Dynamic Sets</td>
                  <td style={{ padding: "14px 16px", verticalAlign: "middle", textAlign: "right", color: "#64748b" }}><strong>{sets.filter(s => (s.type || "").toLowerCase().includes("dynamic")).length}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
};

const VisualsTab = ({
  viz_extensions,
  actions,
  visualDetails,
  containers,
  dashboards_detailed,
  detailed_layouts,
  visualization_count,
  sheet_count,
  story_count,
  embeddedImages,
  webObjects,
  styles,
  PaginationControls,
  usePagination,
  isPdfMode
}: VisualsTabProps) => {
  const [openSections, setOpenSections] = useState({ 
    overview: true, 
    actions: isPdfMode, 
    objects: isPdfMode, 
    types: isPdfMode, 
    containers: isPdfMode, 
    deviceLayouts: isPdfMode 
  });
  const toggleSection = (key: keyof typeof openSections) => {
    if (isPdfMode) return;
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const customSheets = new Set(viz_extensions.flatMap((ext: any) => ext.used_in_sheets || []));
  const actionsPagination = usePagination(actions || [], 5, isPdfMode);
  const visualTypesPagination = usePagination(visualDetails || [], 5, isPdfMode);

  const groupedContainers = containers.reduce((acc: Record<string, any[]>, cont: any) => {
    const db = cont.dashboard || "Unknown";
    if (!acc[db]) acc[db] = [];
    acc[db].push(cont);
    return acc;
  }, {});

  const layoutsSource = detailed_layouts?.length > 0 ? detailed_layouts : (dashboards_detailed?.dashboards || []);
  const groupedDeviceLayouts = layoutsSource.reduce((acc: Record<string, any[]>, db: any) => {
    const name = db.dashboard_name || db.name || "Unknown";
    acc[name] = db.device_layouts || [];
    return acc;
  }, {});

  return (
    <>
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} onClick={() => toggleSection("overview")}>
          {openSections.overview ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
          <div className={styles.sectionHeader}>Visual Overview</div>
        </div>
        {openSections.overview && (
          <div className={styles.grid3}>
            <div className={styles.infoItem}><div className={styles.infoLabel}>Visualizations</div><div className={styles.infoValue}>{visualization_count || 0}</div></div>
            <div className={styles.infoItem}><div className={styles.infoLabel}>Dashboards</div><div className={styles.infoValue}>{dashboards_detailed?.count || 0}</div></div>
            <div className={styles.infoItem}><div className={styles.infoLabel}>Stories</div><div className={styles.infoValue}>{story_count || 0}</div></div>
          </div>
        )}
      </Card>
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} onClick={() => toggleSection("types")} style={{ cursor: "pointer" }}>
          {openSections.types ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
          <div className={styles.sectionHeader}>Visual Types<span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({visualDetails.length} sheet{visualDetails.length !== 1 ? "s" : ""})</span></div>
        </div>
        {openSections.types && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {visualTypesPagination.pageItems.map((visual: any, idx: number) => {
              // DEBUG: log full visual object to verify correct field for type
              if (idx === 0) console.log("[VisualTypes] Sample visual object keys:", JSON.stringify(visual, null, 2));
              const isCustom = customSheets.has(visual.sheet_name);
              const rawType = visual.visual_type || visual.type || visual.mark_type || visual.chart_type || visual.viz_type || visual.mark || "Unknown";
              const displayType = isCustom ? `${rawType} (Custom)` : rawType;
              return (
                <div key={idx} className={styles.infoItem} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 500, color: '#1e293b', flex: 1 }}>{visual.sheet_name}</div>
                  <Badge variant={isCustom ? "warning" : "secondary"} style={{ minWidth: '90px', textAlign: 'center', fontWeight: 500, whiteSpace: "nowrap" }}>{displayType}</Badge>
                </div>
              );
            })}
            {visualTypesPagination.needsPagination && <PaginationControls page={visualTypesPagination.page} totalPages={visualTypesPagination.totalPages} total={visualTypesPagination.total} setPage={visualTypesPagination.setPage} />}
          </div>
        )}
      </Card>
      {actions?.length > 0 && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow} onClick={() => toggleSection("actions")} style={{ cursor: "pointer" }}>
            {openSections.actions ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
            <div className={styles.sectionHeader}>Actions<span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({actions.length})</span></div>
          </div>
          {openSections.actions && (
            <div style={{ marginTop: "16px" }}>
              <div style={{ padding: "12px 16px", background: "#f1f5f9", borderRadius: "6px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: "15px" }}>Total Actions</span>
                <strong style={{ fontSize: "17px" }}>{actions.length}</strong>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead><tr style={{ background: "#f8fafc", textAlign: "left" }}><th style={{ padding: "10px 16px", borderBottom: "2px solid #e2e8f0" }}><strong>Action Name</strong></th><th style={{ padding: "10px 16px", borderBottom: "2px solid #e2e8f0", width: "160px" }}><strong>Type</strong></th></tr></thead>
                <tbody>
                  {actionsPagination.pageItems.map((action: any, idx: number) => {
                    const attr = action["@attributes"] || {};
                    let typeLabel = attr.type;
                    if (!typeLabel || typeLabel === "Unknown" || (typeof typeLabel === 'string' && typeLabel.trim() === "")) {
                      if (action.command?.param?.some((p: any) => p["@attributes"]?.name === "target-parameter") || action.params?.param?.some((p: any) => p["@attributes"]?.name === "target-parameter")) typeLabel = "Change Parameter";
                      else if (action.command?.param?.some((p: any) => p["@attributes"]?.name === "target-group") || action.params?.param?.some((p: any) => p["@attributes"]?.name === "target-group")) typeLabel = "Change Set Values";
                      else if (attr.caption === "Navigation" || attr.name === "Navigation") typeLabel = "Go to Sheet";
                      else typeLabel = typeLabel || "NA";
                    }
                    let typeColor = "secondary";
                    if (typeLabel === "Filter") typeColor = "success";
                    else if (typeLabel === "Highlight") typeColor = "warning";
                    else if (typeLabel === "Go to URL" || typeLabel === "Go to Sheet") typeColor = "default";
                    else if (typeLabel === "Change Parameter" || typeLabel === "Change Set Values") typeColor = "secondary";
                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 500 }}>{attr.caption || attr.name || "Unnamed Action"}</td>
                        <td style={{ padding: "12px 16px" }}><Badge variant={typeColor as any} style={{ whiteSpace: "normal", wordBreak: "break-word", height: "auto", padding: "4px 8px", textAlign: "center" }}>{typeLabel}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {actionsPagination.needsPagination && <PaginationControls page={actionsPagination.page} totalPages={actionsPagination.totalPages} total={actionsPagination.total} setPage={actionsPagination.setPage} />}
            </div>
          )}
        </Card>
      )}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} onClick={() => toggleSection("objects")}>
          {openSections.objects ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
          <div className={styles.sectionHeader}>Dashboard Objects</div>
        </div>
        {openSections.objects && (
          <div className={styles.grid2}>
            <div className={styles.infoItem}><div className={styles.infoLabel}>Embedded Images</div><div className={styles.infoValue}>{embeddedImages}</div></div>
            <div className={styles.infoItem}><div className={styles.infoLabel}>Web Objects</div><div className={styles.infoValue}>{webObjects}</div></div>
          </div>
        )}
      </Card>
      {containers.length > 0 && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow} onClick={() => toggleSection("containers")}>{openSections.containers ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}<div className={styles.sectionHeader}>Dashboard Containers</div></div>
          {openSections.containers && (
            <div style={{ marginTop: "16px" }}>
              {(Object.entries(groupedContainers) as [string, any[]][]).map(([dashboardName, conts]) => (
                <div key={dashboardName} style={{ marginBottom: "28px" }}>
                  <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>{dashboardName}<Badge variant="default" style={{ whiteSpace: "nowrap" }}>{conts.length} container{conts.length !== 1 ? "s" : ""}</Badge></div>
                  <div className={styles.grid2} style={{ marginBottom: "16px" }}>
                    <div className={styles.infoItem}><div className={styles.infoLabel}>Floating</div><div className={styles.infoValue}>{conts.filter(c => c.layout_mode === "Floating").length}</div></div>
                    <div className={styles.infoItem}><div className={styles.infoLabel}>Tiled</div><div className={styles.infoValue}>{conts.filter(c => c.layout_mode === "Tiled").length}</div></div>
                  </div>
                  {conts.length > 0 ? (
                    <div className={styles.tableContainer}><table><thead><tr><th style={{ fontWeight: "bold" }}>Type</th><th style={{ fontWeight: "bold" }}>Layout Mode</th><th style={{ fontWeight: "bold" }}>Container ID</th><th style={{ fontWeight: "bold" }}>Name</th></tr></thead><tbody>{conts.map((cont: any, idx: number) => (<tr key={idx}><td>{cont.type || "NA"}</td><td><Badge variant={cont.layout_mode === "Floating" ? "warning" : "success"} style={{ whiteSpace: "nowrap" }}>{cont.layout_mode || "NA"}</Badge></td><td>{cont.container_id || "NA"}</td><td>{cont.name || "NA"}</td></tr>))}</tbody></table></div>
                  ) : (<Text size={200} weight="regular" style={{ color: "#64748b", fontStyle: "italic" }}>No containers found for this dashboard.</Text>)}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      {Object.keys(groupedDeviceLayouts).length > 0 && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow} onClick={() => toggleSection("deviceLayouts")} style={{ cursor: "pointer" }}>
            {openSections.deviceLayouts ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
            <div className={styles.sectionHeader}>
              Dashboard Device Layouts
            </div>
          </div>
          {openSections.deviceLayouts && (
            <div style={{ marginTop: "16px" }}>
              {(Object.entries(groupedDeviceLayouts) as [string, any[]][]).map(([dashboardName, layouts]: [string, any[]]) => (
                <div key={dashboardName} style={{ marginBottom: "28px" }}>
                  <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>{dashboardName}<Badge variant="default" style={{ whiteSpace: "nowrap" }}>{layouts.length} layout{layouts.length !== 1 ? "s" : ""}</Badge></div>
                  {layouts.length > 0 ? (
                    <div className={styles.tableContainer}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ fontWeight: "bold" }}>Device</th>
                            <th style={{ fontWeight: "bold" }}>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {layouts.map((layout, idx) => {
                            const isAuto = layout.auto_generated === true;
                            return (
                              <tr key={idx}>
                                <td>
                                  <span style={{ fontWeight: 500, color: "#1e293b" }}>{layout.device_type || "Unknown"}</span>
                                </td>
                                <td>
                                  <div style={{ width: "max-content" }}>
                                    <Badge
                                      variant={isAuto ? "secondary" : "default"}
                                      style={{ whiteSpace: "nowrap" }}
                                    >
                                      {isAuto ? "Auto-Generated" : "Custom"}
                                    </Badge>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Text
                      size={200}
                      weight="regular"
                      style={{ color: "#64748b", fontStyle: "italic" }}
                    >
                      No layout details found for this dashboard.
                    </Text>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
};

const SecurityTab = ({
  security_entitlements,
  detailed_connections,
  extract_analysis,
  refresh_schedule,
  styles,
  tags = [],
  isPdfMode
}: SecurityTabProps) => {
  const [openSections, setOpenSections] = useState({
    permissions: true,
    rlsFindings: isPdfMode,
    embeddedCreds: isPdfMode,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    if (isPdfMode) return;
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const workbookPermissions = security_entitlements?.workbook_permissions || [];
  const rlsFindings = security_entitlements?.findings || [];
  const hasRLS = security_entitlements?.has_rls ?? false;

  const embeddedCreds = detailed_connections?.filter((c: any) => c.is_embedded) || [];

  // Robust data mapping & formatting
  const formattedRefreshDate = (() => {
    const raw = refresh_schedule?.last_full_refresh;
    if (!raw) return "NA";
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {}
    return String(raw);
  })();

  return (
    <>
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader}>Security & Permissions</div>
        <div className={styles.grid3}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>ROW-LEVEL SECURITY (RLS)</div>
            <div className={styles.infoValue}>
              <Badge variant={hasRLS ? "warning" : "success"}>
                {hasRLS ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>EMBEDDED CREDENTIALS</div>
            <div className={styles.infoValue}>{embeddedCreds.length}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>RLS RULES FOUND</div>
            <div className={styles.infoValue}>{rlsFindings.length}</div>
          </div>
        </div>
      </Card>

      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} onClick={() => toggleSection("rlsFindings")} style={{ cursor: "pointer" }}>
          {openSections.rlsFindings ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
          <div className={styles.sectionHeader}>Row-Level Security (RLS) Findings ({rlsFindings.length})</div>
        </div>
        {openSections.rlsFindings && (
          <div style={{ marginTop: "16px" }}>
            {rlsFindings.length > 0 ? rlsFindings.map((finding: any, idx: number) => (
              <div key={idx} style={{ marginBottom: "12px", padding: "12px", background: "#f8fafc", borderRadius: "8px" }}>
                <div style={{ fontWeight: 600 }}>{finding.field_caption || "Unnamed field"}</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>{finding.datasource}  {finding.risk_level}</div>
              </div>
            )) : <div style={{ textAlign: "center", color: "#64748b" }}>No findings</div>}
          </div>
        )}
      </Card>

      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} onClick={() => toggleSection("embeddedCreds")} style={{ cursor: "pointer" }}>
          {openSections.embeddedCreds ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
          <div className={styles.sectionHeader}>Embedded Credentials ({embeddedCreds.length})</div>
        </div>
        {openSections.embeddedCreds && (
          <div style={{ marginTop: "16px", overflowX: "auto" }}>
            {embeddedCreds.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f1f5f9" }}>
                    <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 700 }}>Datasource</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 700 }}>Type</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 700 }}>Server</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 700 }}>Database</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 700 }}>Username</th>
                  </tr>
                </thead>
                <tbody>
                  {embeddedCreds.map((conn: any, idx: number) => {
                    const attrs = conn["@attributes"] || conn.attributes || {};
                    const serverVal = conn.server || attrs.server || conn.host || attrs.host || conn.filename || attrs.filename || conn.path || null;
                    const dbVal = conn.database || attrs.database || conn.dbname || attrs.dbname || conn.schema || null;
                    const typeVal = conn.type || conn.connection_type || conn.class || attrs.class || attrs.type || "NA";
                    const username = conn.username || attrs.username || "NA";

                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: "#ffffff" }}>
                        <td style={{ padding: "14px", color: "#1e293b", fontWeight: 600 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span>{conn.parent_logical_datasource || conn.datasource || conn.name || "NA"}</span>
                            {conn.friendly_name && <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>{conn.friendly_name}</span>}
                          </div>
                        </td>
                        <td style={{ padding: "14px" }}>
                          <Badge variant="default" style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{typeVal}</Badge>
                        </td>
                        <td style={{ padding: "14px", color: serverVal ? "#475569" : "#94a3b8" }}>{serverVal || "—"}</td>
                        <td style={{ padding: "14px", color: dbVal ? "#475569" : "#94a3b8" }}>{dbVal || "—"}</td>
                        <td style={{ padding: "14px", color: "#475569" }}>{username}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: "center", color: "#64748b" }}>No embedded credentials found</div>
            )}
          </div>
        )}
      </Card>

      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader}>Extracts</div>
        <div className={styles.grid4}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>HYPER EXTRACTS</div>
            <div className={styles.infoValue}>{extract_analysis?.hyper_count || 0}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>TOTAL SIZE (GB)</div>
            <div className={styles.infoValue}>{extract_analysis?.total_size_gb || "0.00"}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>LAST FULL REFRESH</div>
            <div className={styles.infoValue}>
              <Badge
                style={{
                  fontSize: "11px",
                  height: "auto",
                  padding: "4px 10px",
                  lineHeight: "1.2",
                  textAlign: "center",
                  fontWeight: 600
                }}
              >
                {formattedRefreshDate}
              </Badge>
            </div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>REFRESH FREQUENCY</div>
            <div className={styles.infoValue}>
              <Badge variant="warning" style={{ height: "auto", padding: "4px 8px", textAlign: "center", lineHeight: "1.2" }}>
                {refresh_schedule?.refresh_frequency || "Manual / None"}
              </Badge>
            </div>
          </div>
        </div>
        <div style={{ marginTop: "16px", fontSize: "13px", color: "#64748b" }}>
          Incremental refresh supported:{" "}
          <strong
            style={{
              color: extract_analysis?.incremental_refresh_supported
                ? "#16a34a"
                : "#dc2626",
            }}
          >
            {extract_analysis?.incremental_refresh_supported ? "Yes" : "No"}
          </strong>
        </div>
      </Card>

      {/* Tags – matching ParsingTab design */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Tags ({tags.length})</div>
        {tags.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
            No tags found for this workbook.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 0" }}>
            {tags.map((tag, i) => (
              <Badge key={i} variant="default">{tag}</Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} onClick={() => toggleSection("permissions")} style={{ cursor: "pointer" }}>
          {openSections.permissions ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
          <div className={styles.sectionHeader}>
            Workbook Permissions
            <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({workbookPermissions.length} grantees)</span>
          </div>
        </div>
        {openSections.permissions && (
          <div style={{ marginTop: "16px" }}>
            {workbookPermissions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {workbookPermissions.slice(0, 50).map((perm: any, idx: number) => {
                  const capabilities = Array.isArray(perm.capabilities) 
                    ? perm.capabilities 
                    : Object.entries(perm.capabilities || {}).map(([name, value]) => ({ name, value: String(value) }));

                  return (
                    <div key={idx} style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", fontWeight: 600, fontSize: "15px" }}>
                        <Badge variant={perm.grantee_type === "User" ? "default" : "secondary"}>{perm.grantee_type || "User"}</Badge>
                        <span style={{ color: "#334155" }}>
                          <span style={{ fontWeight: 700 }}>ID:- </span>{perm.grantee_id || "Unnamed Grantee"}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                        {capabilities.map((cap: any, j: number) => (
                          <div key={j} style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center", 
                            padding: "8px 12px", 
                            background: cap.value === "Allow" ? "#f0fdf4" : "#fef2f2", 
                            borderRadius: "8px", 
                            border: `1px solid ${cap.value === "Allow" ? "#bbf7d0" : "#fecaca"}` 
                          }}>
                            <span style={{ fontSize: "14px", color: "#1e293b" }}>{cap.name}</span>
                            <Badge variant={cap.value === "Allow" ? "success" : "destructive"}>
                              {cap.value.toUpperCase()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
                No detailed permissions found (likely inherits project/default settings)
              </div>
            )}
          </div>
        )}
      </Card>
    </>

  );
};

const cleanChallengeText = (text: string) => {
  if (!text) return text;
  // Remove bot names (e.g., "Parsing Agent: ", "Mapping Agent: ", "Data Layer Agent: ")
  let cleaned = text.replace(/^[A-Za-z\s]+Agent:\s*/i, "");
  // Remove estimated time (e.g., " (~0.4 minutes)" or " (~ 2.3 minutes)")
  cleaned = cleaned.replace(/\s*\(\s*~?[\d.]+\s+(minutes|mins|hours|seconds)\s*\)/i, "");
  return cleaned.trim();
};

const ChallengesTab = ({ complexity, styles }: ChallengesTabProps) => {
  const challenges = complexity?.technical_challenges || [];
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Card className={styles.sectionCard}>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "16px" }}>
          {challenges.length > 0 ? (
            <>
              {/* Header Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "16px", padding: "0 16px" }}>
                <div style={{ textAlign: "center" }}>
                  <span style={{ display: "inline-block", backgroundColor: "#fef2f2", color: "#b91c1c", padding: "6px 20px", borderRadius: "24px", fontWeight: 700, fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase", border: "1px solid #fecaca" }}>
                    Challenge
                  </span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ display: "inline-block", backgroundColor: "#f0fdf4", color: "#15803d", padding: "6px 20px", borderRadius: "24px", fontWeight: 700, fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase", border: "1px solid #bbf7d0" }}>
                    Risk Mitigation
                  </span>
                </div>
              </div>
              
              {/* Cards Row */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {challenges.map((c: any, i: number) => {
                  const challengeText = typeof c === 'string' ? c : c?.challenge || JSON.stringify(c);
                  const riskMitigationText = typeof c === 'string' ? null : c?.risk_mitigation;

                  return (
                    <div key={i} style={{ 
                      display: "grid", 
                      gridTemplateColumns: "1fr 1fr", 
                      background: "#ffffff",
                      borderRadius: "20px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                      border: "1px solid #f1f5f9",
                      overflow: "hidden",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      cursor: "default"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)"; }}
                    >
                      <div style={{ padding: "28px 32px", borderRight: "1px dashed #e2e8f0", background: "linear-gradient(180deg, #fffafa 0%, #ffffff 100%)", position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: "28px", bottom: "28px", width: "4px", background: "linear-gradient(to bottom, #ef4444, #fca5a5)", borderTopRightRadius: "4px", borderBottomRightRadius: "4px" }}></div>
                        <ul style={{ margin: 0, paddingLeft: "24px", color: "#1e293b", fontSize: "15px", lineHeight: "1.7" }}>
                          <li>{challengeText}</li>
                        </ul>
                      </div>
                      <div style={{ padding: "28px 32px", background: "linear-gradient(180deg, #f7fdf9 0%, #ffffff 100%)", position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: "28px", bottom: "28px", width: "4px", background: "linear-gradient(to bottom, #22c55e, #86efac)", borderTopRightRadius: "4px", borderBottomRightRadius: "4px" }}></div>
                        <ul style={{ margin: 0, paddingLeft: "24px", color: "#334155", fontSize: "15px", lineHeight: "1.7" }}>
                          <li>{riskMitigationText || "-"}</li>
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b", backgroundColor: "#ffffff" }}>
              No technical challenges identified for this workbook.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

const FormattingTab = ({
  formatting,
  styles,
  isPdfMode
}: FormattingTabProps) => {
  const [openSections, setOpenSections] = useState({ 
    summary: true, 
    colors: isPdfMode, 
    fonts: isPdfMode, 
    details: isPdfMode 
  });
  const toggleSection = (key: keyof typeof openSections) => {
    if (isPdfMode) return;
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const toggleExpand = (name: string) => {
    if (isPdfMode) return;
    setExpandedItems((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const summary = formatting?.summary || {};
  const worksheets = formatting?.details?.worksheets || [];
  const dashboards = formatting?.details?.dashboards || [];
  const details = Array.isArray(formatting?.details) ? formatting.details : [...worksheets, ...dashboards];

  // Auto-expand first detail item — using functional updater to prevent infinite loop
  useEffect(() => {
    const firstItem = details.find((item: any) => item.has_formatting || item.has_custom_formatting);
    if (firstItem) {
      const name = firstItem.name || "Object 1";
      setExpandedItems((prev) => Object.keys(prev).length === 0 ? { [name]: true } : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details]);

  const hasAnyCustomFormatting =
    summary.has_fonts ||
    summary.uses_custom_fonts ||
    summary.has_colors ||
    summary.uses_custom_colors ||
    summary.has_borders ||
    summary.uses_custom_borders ||
    summary.has_number_formats ||
    details.some((item: any) => item.has_formatting || item.has_custom_formatting);

  const fontUsageMap: Record<string, string[]> = {};
  const colorUsageMap: Record<string, string[]> = {};

  details.forEach((item: any) => {
    const name = item.name || "Unnamed";
    if (!item.has_formatting && !item.has_custom_formatting) return;
    (item.fonts || item.custom_fonts || []).forEach((font: string) => {
      if (!fontUsageMap[font]) fontUsageMap[font] = [];
      fontUsageMap[font].push(name);
    });
    (item.colors || item.custom_colors || []).forEach((color: string) => {
      if (!colorUsageMap[color]) colorUsageMap[color] = [];
      colorUsageMap[color].push(name);
    });
  });

  const uniqueCustomFonts = Array.isArray(summary.unique_fonts) ? summary.unique_fonts : [];
  const uniqueCustomColors = Array.isArray(summary.unique_colors) ? summary.unique_colors : [];
  const uniqueBorderStyles = Array.isArray(summary.unique_border_styles) ? summary.unique_border_styles : [];
  const uniqueNumberFormats = Array.isArray(summary.unique_number_formats) ? summary.unique_number_formats : [];

  if (!hasAnyCustomFormatting) {
    return (
      <Card className={styles.sectionCard}>
        <div style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
          No custom formatting detected for this workbook.
        </div>
      </Card>
    );
  }

  return (
    <Card className={styles.sectionCard}>
      {/* 1. Summary Overview */}
      <div className={styles.sectionHeaderRow} onClick={() => toggleSection("summary")} style={{ cursor: "pointer" }}>
        {openSections.summary ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
        <div className={styles.sectionHeader}>Formatting Summary</div>
      </div>
      {openSections.summary && (
        <div style={{ marginTop: "16px" }}>
          <div className={styles.grid3} style={{ marginBottom: "24px" }}>
            <div className={styles.infoItem}><div className={styles.infoLabel}>Custom Fonts</div><div className={styles.infoValue}>{summary.has_fonts ? <Badge variant="success">Yes ({uniqueCustomFonts.length})</Badge> : <Badge variant="warning">No</Badge>}</div></div>
            <div className={styles.infoItem}><div className={styles.infoLabel}>Custom Colors</div><div className={styles.infoValue}>{summary.has_colors ? <Badge variant="success">Yes ({uniqueCustomColors.length})</Badge> : <Badge variant="warning">No</Badge>}</div></div>
            <div className={styles.infoItem}><div className={styles.infoLabel}>Custom Borders</div><div className={styles.infoValue}>{summary.has_borders ? <Badge variant="success">Yes ({uniqueBorderStyles.length} styles)</Badge> : <Badge variant="warning">No</Badge>}</div></div>
          </div>
          {uniqueBorderStyles.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div className={styles.infoLabel} style={{ marginBottom: "8px" }}>Unique Border Styles</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {uniqueBorderStyles.map((style: string, idx: number) => (
                  <Badge key={idx} variant="secondary" style={{ textTransform: "capitalize", whiteSpace: "nowrap" }}>{style}</Badge>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* 2. Global Color Palette */}
      <div className={styles.sectionHeaderRow} onClick={() => toggleSection("colors")} style={{ cursor: "pointer", marginTop: "12px", borderTop: `1px solid var(--border)`, paddingTop: "12px" }}>
        {openSections.colors ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
        <div className={styles.sectionHeader}>Global Color Palette & Usage</div>
      </div>
      {openSections.colors && (
        <div style={{ marginTop: "16px" }}>
          {uniqueCustomColors.length > 0 && (
            <div style={{ marginBottom: "32px" }}>
              <div className={styles.infoLabel} style={{ marginBottom: "12px" }}>Unique Custom Colors (Workbook-Wide)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
                {uniqueCustomColors.map((color: string, idx: number) => (
                  <div key={idx} style={{ width: 52, height: 52, backgroundColor: color, borderRadius: "10px", border: "2px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.1)", position: "relative" }} title={color}>
                    <div style={{ position: "absolute", bottom: "4px", right: "4px", fontSize: "10px", color: "#fff", textShadow: "0 0 2px #000", background: "rgba(0,0,0,0.4)", padding: "2px 4px", borderRadius: "4px" }}>{color.substring(1)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(colorUsageMap).length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div className={styles.infoLabel} style={{ marginBottom: "12px" }}>Custom Colors & Objects Using Them</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(colorUsageMap).map(([color, objects]) => (
                  <div key={color} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ width: 48, height: 48, backgroundColor: color, borderRadius: "8px", border: "2px solid #cbd5e1", flexShrink: 0, position: "relative" }} title={color}>
                      <div style={{ position: "absolute", bottom: "4px", right: "4px", fontSize: "10px", color: "#fff", textShadow: "0 0 2px #000", background: "rgba(0,0,0,0.5)", padding: "1px 4px", borderRadius: "4px" }}>{color.replace("#", "")}</div>
                    </div>
                      <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>Used in: {objects.join(" • ")}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>({objects.length} object{objects.length !== 1 ? "s" : ""})</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Typography Usage */}
      <div className={styles.sectionHeaderRow} onClick={() => toggleSection("fonts")} style={{ cursor: "pointer", marginTop: "12px", borderTop: `1px solid var(--border)`, paddingTop: "12px" }}>
        {openSections.fonts ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
        <div className={styles.sectionHeader}>Typography Usage</div>
      </div>
      {openSections.fonts && (
        <div style={{ marginTop: "16px" }}>
          {Object.keys(fontUsageMap).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Object.entries(fontUsageMap).map(([font, objects]) => (
                <div key={font} style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "6px" }}>{font}</div>
                  <div style={{ fontSize: "13px", color: "#475569" }}>Used in: {objects.join(" • ")}</div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>({objects.length} object{objects.length !== 1 ? "s" : ""})</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#64748b", fontSize: "14px", fontStyle: "italic" }}>No custom fonts detected.</div>
          )}
        </div>
      )}

      {/* 4. Detailed Object Formatting */}
      <div className={styles.sectionHeaderRow} onClick={() => toggleSection("details")} style={{ cursor: "pointer", marginTop: "12px", borderTop: `1px solid var(--border)`, paddingTop: "12px" }}>
        {openSections.details ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
        <div className={styles.sectionHeader}>Detailed Object Formatting<span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({details.filter((item: any) => item.has_formatting || item.has_custom_formatting).length} objects)</span></div>
      </div>
      {openSections.details && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {details.filter((item: any) => item.has_formatting || item.has_custom_formatting).map((item: any, idx: number) => {
              const name = item.name || `Object ${idx + 1}`;
              const isExpanded = isPdfMode || expandedItems[name] || false;
              const itemFonts = item.fonts || item.custom_fonts || [];
              const itemColors = item.colors || item.custom_colors || [];
              const itemBorders = item.borders || item.custom_borders || [];

              return (
                <div key={idx}>
                  <div className={styles.sectionHeaderRow} style={{ cursor: "pointer", background: "#f8fafc", borderRadius: "10px", padding: "12px 16px", border: "1px solid #e2e8f0", marginBottom: isExpanded ? 0 : "8px" }} onClick={() => toggleExpand(name)}>
                    {isExpanded ? <ChevronDown fontSize={20} /> : <ChevronRight fontSize={20} />}
                    <div className={styles.sectionHeader} style={{ fontSize: "16px", margin: 0 }}><Badge variant="default" style={{ marginRight: "8px" }}>{item.type}</Badge>{name}</div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      {itemFonts.length > 0 && <Badge variant="secondary" style={{ whiteSpace: "nowrap" }}>Fonts: {itemFonts.length}</Badge>}
                      {itemColors.length > 0 && <Badge variant="secondary" style={{ whiteSpace: "nowrap" }}>Colors: {itemColors.length}</Badge>}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div style={{ padding: "16px", background: "white", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 10px 10px", marginBottom: "8px" }}>
                      {itemColors.length > 0 && (
                        <div style={{ marginBottom: "16px" }}>
                          <div className={styles.infoLabel} style={{ marginBottom: "8px", fontSize: "12px" }}>CUSTOM COLORS</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {itemColors.map((color: string, cidx: number) => (
                              <div key={cidx} style={{ width: "40px", height: "40px", backgroundColor: color, borderRadius: "6px", border: "1px solid #e2e8f0", position: "relative" }} title={color}>
                                <div style={{ position: "absolute", bottom: "2px", right: "2px", fontSize: "8px", color: "#fff", textShadow: "0 0 2px #000" }}>{color.replace("#", "")}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {itemFonts.length > 0 && (
                        <div style={{ marginBottom: "16px" }}>
                          <div className={styles.infoLabel} style={{ marginBottom: "8px", fontSize: "12px" }}>CUSTOM FONTS</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {itemFonts.map((font: string, fidx: number) => (
                              <Badge key={fidx} variant="default" style={{ whiteSpace: "nowrap" }}>{font}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {itemBorders.length > 0 && (
                        <div style={{ marginBottom: item.number_formats?.length > 0 ? "16px" : 0 }}>
                          <div className={styles.infoLabel} style={{ marginBottom: "8px", fontSize: "12px" }}>CUSTOM BORDERS</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {itemBorders.map((style: string, bidx: number) => (
                              <Badge key={bidx} variant="secondary" style={{ whiteSpace: "nowrap" }}>{style}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.number_formats && item.number_formats.length > 0 && (
                        <div>
                          <div className={styles.infoLabel} style={{ marginBottom: "8px", fontSize: "12px" }}>CUSTOM NUMBER FORMATS</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {item.number_formats.map((format: string, nidx: number) => (
                              <Badge key={nidx} variant="secondary" style={{ width: "max-content", fontFamily: "monospace" }}>{format}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

const OverviewTab = ({
  workbook_name,
  owner_name,
  last_modified_at,
  status,
  styles,
  total_calculations = 0,
  total_actions = 0,
  total_parameters = 0,
  total_sets = 0,
  total_sheets = 0,
  total_dashboards = 0,
  total_sources = 0,
  total_stories = 0,
  visualization_count = 0,
  legacy_risks,
  version_info,
}: OverviewTabProps) => {
  const legacyDetected =
    legacy_risks?.is_legacy_detected ??
    legacy_risks?.legacy_detected ??
    legacy_risks?.has_legacy ??
    false;

  const tableauVersion =
    legacy_risks?.version ||
    version_info?.tableau_version ||
    version_info?.version ||
    "NA";

  const legacyConnections = Array.isArray(legacy_risks?.legacy_connections)
    ? legacy_risks.legacy_connections.length
    : (legacy_risks?.legacy_connections_count ?? 0);

  const summaryMetrics = [
    { label: "TOTAL VISUALIZATIONS", value: visualization_count, color: "#db2777", icon: <PieChart /> },
    { label: "TOTAL CALCULATIONS", value: total_calculations, color: "#ea580c", icon: <Calculator /> },
    { label: "TOTAL ACTIONS", value: total_actions, color: "#16a34a", icon: <Zap /> },
    { label: "TOTAL PARAMETERS", value: total_parameters, color: "#4f46e5", icon: <Settings /> },
    { label: "TOTAL SETS", value: total_sets, color: "#9333ea", icon: <Shapes /> },
  ];

  return (
    <>
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader}>Workbook Information</div>
        <div className={styles.grid2}>
          <div className={styles.infoItem}><div className={styles.infoLabel}>Name</div><div className={styles.infoValue}>{workbook_name || "NA"}</div></div>
          <div className={styles.infoItem}><div className={styles.infoLabel}>Owner</div><div className={styles.infoValue}>{owner_name || "NA"}</div></div>
          <div className={styles.infoItem}><div className={styles.infoLabel}>Last Modified</div><div className={styles.infoValue}>{last_modified_at || "NA"}</div></div>
          <div className={styles.infoItem}><div className={styles.infoLabel}>Status</div><div className={styles.infoValue}><Badge variant="success">{status || "Active"}</Badge></div></div>
        </div>
      </Card>

      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader}>Legacy & Unsupported Features</div>
        <div className={styles.grid3}>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>LEGACY DETECTED</div>
            <div className={styles.infoValue}>
              <Badge
                variant={legacyDetected ? "warning" : "success"}
                style={{ height: "auto", padding: "4px 12px", textAlign: "center", fontWeight: 600 }}
              >
                {legacyDetected ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>TABLEAU VERSION</div>
            <div className={styles.infoValue}>{tableauVersion}</div>
          </div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>LEGACY CONNECTIONS</div>
            <div className={styles.infoValue}>{legacyConnections}</div>
          </div>
        </div>
      </Card>

      <Card className={styles.sectionCard} style={{ marginTop: "32px" }}>
        <div className={styles.sectionHeader} style={{ marginBottom: "24px" }}>Content Summary</div>
        <div className={styles.grid5}>
          {summaryMetrics.map((item, idx) => (
            <div key={idx} className={styles.infoItem}>
              <div className={styles.infoLabel}>{item.label}</div>
              <div className={styles.infoValue}>{item.value}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
};

const DataSourcesTab = ({
  logical_datasources,
  detailed_connections,
  custom_sql_details,
  connection_type,
  hasCustomSQL,
  customSqlCount,
  database_sources,
  custom_sql,
  semantics_raw,
  styles,
  PaginationControls,
  usePagination,
  isPdfMode
}: DataSourcesTabProps) => {
  const hasCubes = (detailed_connections || []).some((c: any) =>
    ["ssas", "essbase", "sap bw"].includes((c.type || c.Type || "").toLowerCase())
  );

  // Calculate SQL metrics if missing from semantics
  const calculatedSqlCount = (custom_sql_details || custom_sql || []).length;
  const calculatedSqlLines = (custom_sql_details || custom_sql || []).reduce((acc: number, q: any) => {
    const rawSql = q.query || q.Query || q.sql_query || q.sql || "";
    return acc + (rawSql ? rawSql.split('\n').length : 0);
  }, 0);
  const calculatedUsesParams = (custom_sql_details || custom_sql || []).some((q: any) =>
    (q.parameters && q.parameters.length > 0) || (q.Parameters && q.Parameters.length > 0) || (q.params && q.params.length > 0)
  );

  // Robust SQL metrics from custom_sql_details or semantics
  const sqlCount = customSqlCount || (custom_sql_details || custom_sql || []).length || semantics_raw?.custom_sql_count || 0;

  const firstSqlDetail = (custom_sql_details && custom_sql_details.length > 0) ? custom_sql_details[0] : null;
  const sqlLines = firstSqlDetail?.line_count || semantics_raw?.total_lines_of_custom_sql || semantics_raw?.total_sql_lines || calculatedSqlLines;
  const sqlParams = firstSqlDetail?.uses_parameters !== undefined ? firstSqlDetail.uses_parameters : (semantics_raw?.uses_parameters_in_sql !== undefined ? semantics_raw.uses_parameters_in_sql : calculatedUsesParams);

  const dsPagination = usePagination(logical_datasources || []);
  const detailedConnPagination = usePagination(detailed_connections || []);

  return (
    <>
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader}>Data Sources Summary</div>
        <div className={styles.grid2}>
          <div className={styles.infoItem}><div className={styles.infoLabel}>Total Sources</div><div className={styles.infoValue}>{(logical_datasources || []).length}</div></div>
          <div className={styles.infoItem}><div className={styles.infoLabel}>Connection Type</div><div className={styles.infoValue}><Badge variant="default">{connection_type || "NA"}</Badge></div></div>
          <div className={styles.infoItem}><div className={styles.infoLabel}>Custom SQL</div><div className={styles.infoValue}>{hasCustomSQL ? <Badge variant="success">Yes</Badge> : <Badge variant="warning">No</Badge>}</div></div>
          <div className={styles.infoItem}><div className={styles.infoLabel}>Multidimensional</div><div className={styles.infoValue}>{hasCubes ? "Yes" : "No"}</div></div>
          <div className={styles.infoItem}>
            <div className={styles.infoLabel}>Published Datasources</div>
            <div className={styles.infoValue}>{Array.isArray(logical_datasources) ? logical_datasources.filter((ds: any) => ds.is_published_datasource).length : 0}</div>
          </div>
        </div>
      </Card>

      {(logical_datasources || []).length > 0 && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Logical Data Sources</div>
          <div style={{ padding: "12px 16px", background: "#f1f5f9", borderRadius: "6px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "15px" }}>Total Logical Sources</span>
            <strong style={{ fontSize: "17px" }}>{logical_datasources.length}</strong>
          </div>
          <div style={{ overflowX: "auto", width: "100%", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 700, fontSize: "12px" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 700, fontSize: "12px" }}>Extract</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#64748b", fontWeight: 700, fontSize: "12px" }}>Published</th>
                </tr>
              </thead>
              <tbody>
                {dsPagination.pageItems.map((ds: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: idx === dsPagination.pageItems.length - 1 ? "none" : "1px solid #f1f5f9", background: "#ffffff" }}>
                    <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                      <strong style={{ color: "#1e293b" }}>{ds.name || ds.caption || ds.Name || ds.Caption || "NA"}</strong>
                    </td>
                    <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                      <Badge variant={(ds.has_extract || ds.is_extract || ds.Extract) ? "success" : "secondary"}>{(ds.has_extract || ds.is_extract || ds.Extract) ? "Yes" : "No"}</Badge>
                    </td>
                    <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                      <Badge variant={(ds.is_published_datasource || ds.published || ds.Published) ? "default" : "secondary"}>{(ds.is_published_datasource || ds.published || ds.Published) ? "Published" : "Embedded"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dsPagination.needsPagination && <PaginationControls page={dsPagination.page} totalPages={dsPagination.totalPages} total={dsPagination.total} setPage={dsPagination.setPage} />}
        </Card>
      )}

      {hasCustomSQL && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader}>Custom SQL Details</div>
          <div className={styles.grid3}>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>CUSTOM SQL COUNT</div>
              <div className={styles.infoValue}>{sqlCount}</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>TOTAL LINES OF CUSTOM SQL</div>
              <div className={styles.infoValue}>{(sqlLines !== undefined && sqlLines !== null) ? sqlLines : "NA"}</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>USES PARAMETERS IN SQL</div>
              <div className={styles.infoValue}>{sqlParams ? "Yes" : "No"}</div>
            </div>
          </div>
        </Card>
      )}

      {database_sources && database_sources.length > 0 && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader}>Database Connections</div>
          <div className={styles.grid3}>
            {/* If database_sources is array of strings (from user JSON) */}
            {typeof database_sources[0] === 'string' ? (
              <>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>CONNECTION TYPE</div>
                  <div className={styles.infoValue}><Badge variant="default">{database_sources[0] || "NA"}</Badge></div>
                </div>
                {/* 
                {database_sources.length > 1 && (
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>STORAGE FORMAT</div>
                    <div className={styles.infoValue}><Badge variant="secondary">{database_sources[1] || "NA"}</Badge></div>
                  </div>
                )}
                {database_sources.length > 2 && (
                  <div className={styles.infoItem}>
                    <div className={styles.infoLabel}>SERVER ADDRESS</div>
                    <div className={styles.infoValue}><Badge variant="secondary">{database_sources[2] || "NA"}</Badge></div>
                  </div>
                )}
                */}
              </>
            ) : (
              /* Fallback if it's array of objects */
              <div className={styles.grid3}>
                {database_sources.map((src: any, i: number) => (
                  <React.Fragment key={i}>
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>CONNECTION TYPE</div>
                      <div className={styles.infoValue}><Badge variant="default">{src.type || src.connection_type || src.Type || src.class || "NA"}</Badge></div>
                    </div>
                    {/* 
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>STORAGE FORMAT</div>
                      <div className={styles.infoValue}><Badge variant="secondary">{src.storage_format || src.mode || src.Storage_Format || "hyper"}</Badge></div>
                    </div>
                    <div className={styles.infoItem}>
                      <div className={styles.infoLabel}>SERVER ADDRESS</div>
                      <div className={styles.infoValue}><Badge variant="secondary">{src.server || src.address || src.Server || src.host || src.server_address || "NA"}</Badge></div>
                    </div>
                    */}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {detailed_connections.length > 0 && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Detailed Connections</div>
          <div style={{ padding: "12px 16px", background: "#f1f5f9", borderRadius: "6px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "15px" }}>Total Connections</span>
            <strong style={{ fontSize: "17px" }}>{detailed_connections.length}</strong>
          </div>
          <div style={{ overflowX: "auto", width: "100%", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "800px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 700, fontSize: "12px", minWidth: "140px" }}>Datasource</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 700, fontSize: "12px", minWidth: "160px" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 700, fontSize: "12px", minWidth: "120px" }}>Server</th>
                  <th style={{ textAlign: "left", padding: "12px 14px", color: "#64748b", fontWeight: 700, fontSize: "12px", minWidth: "120px" }}>Database</th>
                </tr>
              </thead>
              <tbody>
                {detailedConnPagination.pageItems.map((conn: any, idx: number) => {
                  const attrs = conn["@attributes"] || conn.attributes || {};
                  const serverVal = conn.server || conn.Server || conn.host || conn.Host ||
                    attrs.server || attrs.host || conn.filename || conn.Filename ||
                    conn.directory || conn.Directory || conn.path || conn.Path ||
                    attrs.filename || attrs.directory || null;
                  const dbVal = conn.database || conn.Database || conn.dbname || conn.Dbname ||
                    attrs.database || attrs.dbname || conn.schema || conn.Schema ||
                    conn.catalog || conn.Catalog || conn.port || null;
                  const typeVal = conn.type || conn.Type || conn.connection_type || conn.class ||
                    attrs.class || attrs.type || "NA";

                  return (
                    <tr key={idx} style={{ borderBottom: idx === detailedConnPagination.pageItems.length - 1 ? "none" : "1px solid #f1f5f9", background: "#ffffff" }}>
                      <td style={{ padding: "14px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <strong style={{ color: "#1e293b" }}>{conn.parent_logical_datasource || conn.datasource || conn.Datasource || conn.name || conn.caption || "NA"}</strong>
                          {conn.friendly_name && <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 400 }}>{conn.friendly_name}</span>}
                        </div>
                      </td>
                      <td style={{ padding: "14px", verticalAlign: "middle" }}>
                        <Badge variant="default" style={{ fontSize: "12px", maxWidth: "100%", whiteSpace: "normal", wordBreak: "break-all", lineHeight: "1.3", height: "auto", padding: "3px 8px", textAlign: "left", display: "inline-block" }}>
                          {typeVal}
                        </Badge>
                      </td>
                      <td style={{ padding: "14px", verticalAlign: "middle", color: serverVal ? "#475569" : "#94a3b8" }}>{serverVal || "—"}</td>
                      <td style={{ padding: "14px", verticalAlign: "middle", color: dbVal ? "#475569" : "#94a3b8" }}>{dbVal || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {detailedConnPagination.needsPagination && (
            <PaginationControls
              page={detailedConnPagination.page}
              totalPages={detailedConnPagination.totalPages}
              total={detailedConnPagination.total}
              setPage={detailedConnPagination.setPage}
            />
          )}
          <div style={{ marginTop: "12px", fontSize: "12px", color: "#64748b" }}>
            Showing {detailed_connections.length} connection{detailed_connections.length !== 1 ? "s" : ""} for logical datasource(s): {logical_datasources.map(d => d.name).join(", ")}
          </div>
        </Card>
      )}
    </>
  );
};


export function AssessmentTab({ selectedWorkbookId, projectId: propProjectId, runId: propRunId, isPdfMode }: AssessmentTabProps) {
  const styles = useStyles()
  const { mode } = useUIStore()

  const { getAssessmentForWorkbook, fetchAssessmentData, currentRunId, currentProjectId, error: storeError } = useAgentStore()
  const { selectedProject } = useDashboardStore()

  const [selectedTab, setSelectedTab] = useState("overview")

  const projectId = propProjectId || currentProjectId || selectedProject || ""
  const runId = propRunId || currentRunId || ""
  const isHistoricalRun = !!propRunId && propRunId !== currentRunId

  const assessment = getAssessmentForWorkbook(selectedWorkbookId, runId)
  const hasData = !!assessment?.payload

  useEffect(() => {
    if (isHistoricalRun && !hasData && projectId && selectedWorkbookId && runId) {
      console.log(`[AssessmentTab] Fetching historical data for ${selectedWorkbookId}`);
      fetchAssessmentData(projectId, selectedWorkbookId, runId);
    }
  }, [isHistoricalRun, hasData, projectId, selectedWorkbookId, runId, fetchAssessmentData]);

  if (storeError) {
    return (
      <div className={styles.container}>
        <Text weight="semibold" style={{ color: "#dc2626", fontSize: "18px" }}>
          Error: {storeError}
        </Text>
      </div>
    )
  }

  const isFetching = isHistoricalRun && !hasData;

  if (isFetching) {
    return (
      <div className={styles.container}>
        <Card className={styles.tabsCard} style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner size="large" label="Fetching historical assessment data..." />
        </Card>
      </div>
    )
  }

  if (!hasData || !assessment) {
    return (
      <div className={styles.container}>
        <Text size={500} weight="semibold">
          No assessment data available for this workbook yet.
        </Text>
      </div>
    )
  }

  const payload = assessment.payload

  // If this is a Qlik assessment result (has results array of category items), render AssessmentResultsView
  if ((payload?.results && Array.isArray(payload.results)) || Array.isArray(payload) || (assessment?.results && Array.isArray(assessment.results))) {
    const qlikData = payload?.results ? payload : (Array.isArray(payload) ? { results: payload } : assessment)
    const appName = payload?.workbook_name || assessment?.workbook_name || ""
    return <AssessmentResultsView assessmentData={qlikData} appName={appName} isPdfMode={isPdfMode} />
  }

  // Robust fallback for last_modified_at — check payload, then document-level fields
  const rawLastModified =
    payload?.last_modified_at ||
    payload?.lastModifiedAt ||
    payload?.updated_at ||
    payload?.updatedAt ||
    payload?.modified_date ||
    assessment.last_modified_at ||
    assessment.created_at ||
    assessment.updated_at ||
    assessment.updatedAt ||
    (assessment._ts ? new Date(assessment._ts * 1000).toISOString() : null)

  // Format the date if it's an ISO string, otherwise use as-is
  const last_modified_at = (() => {
    if (!rawLastModified) return null
    try {
      const d = new Date(rawLastModified)
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      }
    } catch {}
    return String(rawLastModified)
  })()

  const {
    workbook_name,
    owner_name,
    last_modified_at: _payloadLastModified, // consumed but overridden above
    status,
    connection_type,
    detailed_connections = [],
    database_sources = [],
    file_based_sources = [],
    logical_datasources = [],
    parameters = [],
    actions = [],
    sets = [],
    viz_extensions = [],
    visuals: { visualization_count = 0, sheet_count = 0, story_count = 0, details: visualDetails = [] } = {},
    dashboards_detailed = { count: 0 },
    calculation_stats = {},
    lods_analysis = {},
    security_entitlements = {},
    extract_analysis = {},
    complexity = {},
    version_info = {},
    legacy_risks = {},
    custom_sql_details = [],
    custom_sql = [],

    semantics = {},
    dashboard_objects = [],
    formatting = { summary: {}, details: [] },
    containers = [], // Added for new containers section
    detailed_layouts = [], // Added for new containers section
    tags = [],
  } = payload

  const dashboard_count = dashboards_detailed.count || 0

  const {
    hyper_count: hyper_extract_count = 0,
    total_size_gb: total_extract_size_gb = 0,
  } = extract_analysis

  const refresh_schedule = payload.refresh_schedule || {}
  const last_refresh_at = refresh_schedule.last_full_refresh || null

  const {
    total_calculations = 0,
    pct_basic = 0,
    pct_lod = 0,
    pct_table_calc = 0,
    pct_parameters = 0,
    pct_scripts = 0,
    pct_raw_sql = 0,
  } = calculation_stats

  const lodCounts = lods_analysis?.summary_counts || {}

  const hasRLS = security_entitlements?.has_rls || false
  const rlsFindings = security_entitlements?.findings || []

  const hasCustomSQL = custom_sql_details.length > 0 || semantics?.has_custom_sql || false
  const customSqlCount = semantics?.custom_sql_count || 0

  // Complexity/risk score bands (0-100, higher = riskier). Independent from
  // the unrelated 0-100 *confidence* score in MappingTab.tsx, where higher
  // means better -- the two are not the same scale despite both being
  // percentages, so they intentionally use their own thresholds.
  const RISK_SCORE_HIGH = 75
  const RISK_SCORE_MEDIUM = 50
  const getRiskColor = (score: number) => {
    if (score >= RISK_SCORE_HIGH) return "destructive"
    if (score >= RISK_SCORE_MEDIUM) return "warning"
    return "success"
  }

  // Updated keyMetrics with proper complexity display (same style as in Overview tab)
  const keyMetrics = [
    { value: logical_datasources.length, label: "Data Sources" },
    { value: dashboard_count, label: "Dashboards" },
    { value: sheet_count, label: "Sheets" },
    {
      value: (
        <>
          {complexity.complexity_score || "NA"}<span style={{ fontSize: "20px", color: "#64748b", marginLeft: "4px" }}> /100</span>
          {complexity.complexity_score !== undefined && (
            <Badge
              variant={getRiskColor(complexity.complexity_score)}
              style={{ marginLeft: "12px" }}
            >
              {complexity.risk_level || "Unknown"}
            </Badge>
          )}
        </>
      ),
      label: "Complexity",
    },
  ];



  const filterActions = actions.filter((a: any) => a["@attributes"]?.type === "Filter").length
  const highlightActions = actions.filter((a: any) => a["@attributes"]?.type === "Highlight").length
  const urlActions = actions.filter((a: any) => a["@attributes"]?.type === "Go to URL" || a["@attributes"]?.type === "Hyperlink").length
  const navigationActions = actions.filter((a: any) => a["@attributes"]?.type === "Go to Sheet").length
  const parameterActions = actions.filter((a: any) => a["@attributes"]?.type === "Change Parameter" || a["@attributes"]?.type === "Unknown" && a.params?.param?.some((p: any) => p["@attributes"]?.name === "target-parameter")).length
  const setActions = actions.filter((a: any) => a["@attributes"]?.type === "Change Set Values" || a["@attributes"]?.type === "Unknown" && a.params?.param?.some((p: any) => p["@attributes"]?.name === "target-group")).length

  const embeddedImages = dashboard_objects.reduce((acc: number, obj: any) => acc + (obj.stats?.images || 0), 0)
  const webObjects = dashboard_objects.reduce((acc: number, obj: any) => acc + (obj.stats?.web_objects || 0), 0)

  // ────────────────────────────────────────────────────────────
  // AssessmentTab Main Return
  // ────────────────────────────────────────────────────────────
  return (
    <div className={styles.container} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
      <div className={styles.header}>
        <Text className={styles.title} style={{ fontSize: "32px", fontWeight: 600 }}>Assessment Results</Text>
        <Text className={styles.subtitle}>
          Detailed migration feasibility and complexity breakdown for{" "}
          <strong>{workbook_name || "this workbook"}</strong>
        </Text>
      </div>

      <div className={styles.metricsGrid} style={{ marginBottom: mode === 'single' ? '0' : '24px' }}>
        {keyMetrics.map((metric, idx) => (
          <Card key={idx} className={styles.metricCard} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
            <div className={styles.metricValue}>{metric.value}</div>
            <div className={styles.metricLabel}>{metric.label}</div>
          </Card>
        ))}
      </div>

      <Card className={styles.tabsCard} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
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
            value={selectedTab}
            onValueChange={(value) => setSelectedTab(value)}
          >
            <TabsList className={styles.tabList} style={{ minWidth: "max-content", borderBottom: "none" }}>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="formatting">Formatting & Styling</TabsTrigger>
              <TabsTrigger value="sources">Data Sources</TabsTrigger>
              <TabsTrigger value="modeling">Modeling</TabsTrigger>
              <TabsTrigger value="visuals">Visuals & Actions</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="challenges">Challenges & Risks</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className={styles.tabContent}>
          {isPdfMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              <div style={{ pageBreakInside: "avoid" }}>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                  Overview
                </div>
                <OverviewTab
                  workbook_name={workbook_name}
                  owner_name={owner_name}
                  last_modified_at={last_modified_at || ""}
                  status={status}
                  styles={styles}
                  total_calculations={total_calculations}
                  total_actions={actions.length}
                  total_parameters={parameters.length}
                  total_sets={sets.length}
                  total_sheets={sheet_count}
                  total_dashboards={dashboard_count}
                  total_sources={logical_datasources.length}
                  total_stories={story_count}
                  visualization_count={visualization_count}
                  legacy_risks={legacy_risks}
                  version_info={version_info}
                />
              </div>

              <div style={{ pageBreakInside: "avoid" }}>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                  Formatting & Styling
                </div>
                <FormattingTab
                  formatting={formatting}
                  styles={styles}
                  isPdfMode={isPdfMode}
                />
              </div>

              <div style={{ pageBreakInside: "avoid" }}>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                  Data Sources
                </div>
                <DataSourcesTab
                  logical_datasources={logical_datasources}
                  detailed_connections={detailed_connections}
                  custom_sql_details={custom_sql_details}
                  connection_type={connection_type}
                  hasCustomSQL={hasCustomSQL}
                  customSqlCount={customSqlCount}
                  database_sources={database_sources}
                  custom_sql={custom_sql}
                  semantics_raw={semantics}
                  styles={styles}
                  PaginationControls={PaginationControls}
                  usePagination={usePagination}
                  isPdfMode={isPdfMode}
                />
              </div>

              <div style={{ pageBreakInside: "avoid" }}>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                  Modeling
                </div>
                <ModelingTab
                  parameters={parameters}
                  sets={sets}
                  total_calculations={total_calculations}
                  pct_basic={pct_basic}
                  pct_table_calc={pct_table_calc}
                  pct_lod={pct_lod}
                  pct_parameters={pct_parameters}
                  pct_scripts={pct_scripts}
                  pct_raw_sql={pct_raw_sql}
                  lods_analysis={lods_analysis}
                  lodCounts={lodCounts}
                  styles={styles}
                  isPdfMode={isPdfMode}
                />
              </div>

              <div style={{ pageBreakInside: "avoid" }}>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                  Visuals & Actions
                </div>
                <VisualsTab
                  viz_extensions={viz_extensions}
                  actions={actions}
                  visualDetails={visualDetails}
                  containers={containers}
                  dashboards_detailed={dashboards_detailed}
                  detailed_layouts={detailed_layouts}
                  visualization_count={visualization_count}
                  sheet_count={sheet_count}
                  story_count={story_count}
                  embeddedImages={embeddedImages}
                  webObjects={webObjects}
                  styles={styles}
                  PaginationControls={PaginationControls}
                  usePagination={usePagination}
                  isPdfMode={isPdfMode}
                />
              </div>

              <div style={{ pageBreakInside: "avoid" }}>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                  Security & Risks
                </div>
                <SecurityTab
                  security_entitlements={security_entitlements}
                  detailed_connections={detailed_connections}
                  extract_analysis={extract_analysis}
                  refresh_schedule={refresh_schedule}
                  styles={styles}
                  tags={tags}
                  isPdfMode={isPdfMode}
                />
              </div>

              <div style={{ pageBreakInside: "avoid" }}>
                <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                  Challenges
                </div>
                <ChallengesTab
                  complexity={complexity}
                  styles={styles}
                />
              </div>
            </div>
          ) : (
            <>
              {selectedTab === "overview" && (
                <OverviewTab
                  workbook_name={workbook_name}
                  owner_name={owner_name}
                  last_modified_at={last_modified_at || ""}
                  status={status}
                  styles={styles}
                  total_calculations={total_calculations}
                  total_actions={actions.length}
                  total_parameters={parameters.length}
                  total_sets={sets.length}
                  total_sheets={sheet_count}
                  total_dashboards={dashboard_count}
                  total_sources={logical_datasources.length}
                  total_stories={story_count}
                  visualization_count={visualization_count}
                  legacy_risks={legacy_risks}
                  version_info={version_info}
                />
              )}
              {selectedTab === "formatting" && (
                <FormattingTab
                  formatting={formatting}
                  styles={styles}
                />
              )}
              {selectedTab === "sources" && (
                <DataSourcesTab
                  logical_datasources={logical_datasources}
                  detailed_connections={detailed_connections}
                  custom_sql_details={custom_sql_details}
                  connection_type={connection_type}
                  hasCustomSQL={hasCustomSQL}
                  customSqlCount={customSqlCount}
                  database_sources={database_sources}
                  custom_sql={custom_sql}
                  semantics_raw={semantics}
                  styles={styles}
                  PaginationControls={PaginationControls}
                  usePagination={usePagination}
                />
              )}
              {selectedTab === "modeling" && (
                <ModelingTab
                  parameters={parameters}
                  sets={sets}
                  total_calculations={total_calculations}
                  pct_basic={pct_basic}
                  pct_table_calc={pct_table_calc}
                  pct_lod={pct_lod}
                  pct_parameters={pct_parameters}
                  pct_scripts={pct_scripts}
                  pct_raw_sql={pct_raw_sql}
                  lods_analysis={lods_analysis}
                  lodCounts={lodCounts}
                  styles={styles}
                />
              )}
              {selectedTab === "visuals" && (
                <VisualsTab
                  viz_extensions={viz_extensions}
                  actions={actions}
                  visualDetails={visualDetails}
                  containers={containers}
                  dashboards_detailed={dashboards_detailed}
                  detailed_layouts={detailed_layouts}
                  visualization_count={visualization_count}
                  sheet_count={sheet_count}
                  story_count={story_count}
                  embeddedImages={embeddedImages}
                  webObjects={webObjects}
                  styles={styles}
                  PaginationControls={PaginationControls}
                  usePagination={usePagination}
                />
              )}
              {selectedTab === "security" && (
                <SecurityTab
                  security_entitlements={security_entitlements}
                  detailed_connections={detailed_connections}
                  extract_analysis={extract_analysis}
                  refresh_schedule={refresh_schedule}
                  styles={styles}
                  tags={tags}
                />
              )}

              {selectedTab === "challenges" && (
                <ChallengesTab
                  complexity={complexity}
                  styles={styles}
                />
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

