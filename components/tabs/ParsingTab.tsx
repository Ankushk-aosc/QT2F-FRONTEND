"use client"
import { useAgentStore } from "@/stores/agent.store"
import { useDashboardStore } from "@/stores/dashboard.store"
import { useParsingStore } from "@/stores/parsing.store"
import { matchesAgent } from "@/lib/agentNames"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    ChevronDown,
    ChevronRight,
    Database,
    FileText,
    Filter,
    Zap,
    Image as ImageIcon,
    Info,
    Key,
    Shapes,
    Sparkles
} from "lucide-react"
import type { ReactNode, HTMLAttributes } from "react"
import { useEffect, useMemo, useState, isValidElement, Fragment } from "react"

function cx(...parts: Array<string | undefined | false>) {
    return parts.filter(Boolean).join(" ")
}

const WEIGHT_MAP: Record<string, number> = { regular: 400, medium: 500, semibold: 600, bold: 700 }
const SIZE_MAP: Record<number, number> = { 100: 10, 200: 12, 300: 14, 400: 16, 500: 20, 600: 24, 700: 28, 800: 32, 900: 40, 1000: 68 }

function Text({
    weight,
    size,
    style,
    ...props
}: { weight?: "regular" | "medium" | "semibold" | "bold"; size?: number } & HTMLAttributes<HTMLSpanElement>) {
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

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════════ */

export interface RiskFlag { label: string; danger: boolean }
export interface DataSource { name: string; type: string; mode: "Live" | "Extract" | "File"; server?: string; schema?: string | null; custom_sql: boolean; tables?: string[]; id?: string; connections?: any[] }
export interface LogicalRelationship { left: string; right: string; on: string; type: string; cardinality?: string }
export interface PhysicalJoin { left: string; right: string; join_type: string; condition: string }
export interface DataModel { logical: LogicalRelationship[]; physical: PhysicalJoin[]; blends: any[] }
export interface FieldDef { name: string; data_type: string; source?: string; default_aggregation?: string; usage_count?: number; formula?: string; }
export interface CalcField { name: string; formula: string; is_lod: boolean; data_type?: string; source?: string; usage_count?: number; lod_type?: string; type?: string; dependencies?: string[] }
export interface Parameter { name: string; data_type: string; current_value: string | number; allowable_values?: string; allowable_list?: { value: string; display_as: string }[]; id?: string }
export interface SetDef { name: string; base_field: string; type: string; subtype?: string; mode?: string; count?: number; expression?: string; condition?: string; selected_members?: string[]; member_count?: number }
export interface StoryPoint { index: number; caption: string; content: string; name?: string }
export interface Story { name: string; navigator: string; points: StoryPoint[] }
export interface Worksheet { name: string; type: string; mark_type: string; rows?: string[]; columns?: string[]; filters?: string[]; filters_detail?: { name: string, type: string }[]; fields_used: number; actions: number; sheet_id?: string; visual_properties?: { fonts?: { font?: string; applied_to: string; size?: string; alignment?: string; bold?: boolean; color?: string }[]; colors?: { color: string; applied_to: string }[]; formatting?: { applied_to: string; font?: string; font_color?: string; size?: string; bold?: string | boolean; bg_color?: string; alignment?: string }[]; axes?: any[]; has_formatting?: boolean; background_color?: string }; marks_text?: string[]; marks_color?: string[]; marks_detail?: string[]; marks_size?: string[]; colors?: string[]; fonts?: string[]; tooltips?: any[]; axis_formatting?: any[]; borders?: any[]; tooltip_formatting?: any[]; }
export interface EmbeddedAsset { name: string; source: string; embedded: boolean; relative_path: string; size_kb: number; type?: "image" | "shape"; palette?: string; mapped_to?: string; }
export interface EmbeddedCredential { connection_type: string; username: string; authentication: string; embed_password: boolean; }
export interface GranteeCapability { name: string; value: string; }
export interface WorkbookPermission { grantee_type: string; grantee_id: string; capabilities: GranteeCapability[]; }
export interface CustomSqlQuery { datasource: string; table_name?: string; query: string; parameters?: string[]; }
export interface HyperColumn { name: string; type: string; }
export interface HyperPreviewDetail { schema: string; table: string; row_count: number; columns?: HyperColumn[]; }
export interface HyperPreview { hyper_file: string; details: HyperPreviewDetail[]; }
export interface TableColumn { name: string; renamed_column_name?: string; datatype: string; }
export interface TableDetail { datasource_id?: string; datasource?: string; table_name: string; table_id: string; schema_name?: string; relation_type?: string; schema_source?: string; columns: TableColumn[]; }

export interface LayoutNode {
  id: string;
  name: string;
  type: string;
  x: string;
  y: string;
  w: string;
  h: string;
  style: any;
  layout_cache: any;
  level: number;
}

export interface DashboardEntry {
  name: string;
  layout: string;
  width: number;
  height: number;
  device_layout: string;
  containers: number;
  containers_list: string[];
  objects: string[];
  device_layouts_list: string[];
  device_layouts_styling?: Record<string, any> | null;
  formatted_text_runs: { text: string; attributes: Record<string, string> }[];
  sheets: string[];
  actions: number;
  actionsList: { name: string; activation: string; type?: string }[];
  layouts?: Record<string, LayoutNode[]>;
}

export interface ParsingPayload {
  workbook_name: string; live: number; extract: number; logical: number; physical: number; blends: number; sheets: number; dashboards: number; stories: number; dimensions: number; measures: number; calculated: number; lod_total: number; actions: number; lod_fixed: number; lod_include: number; lod_exclude: number;
  risks: RiskFlag[]; sources: DataSource[]; custom_sql_queries: CustomSqlQuery[]; model: DataModel; tables?: TableDetail[]; fields: { dimensions: FieldDef[]; measures: FieldDef[] }; calculations: CalcField[]; parameters: Parameter[]; sets: SetDef[]; worksheets: Worksheet[]; dashboards_list: DashboardEntry[]; stories_list: Story[]; embedded_assets: EmbeddedAsset[]; embedded_credentials: EmbeddedCredential[]; permissions: WorkbookPermission[]; tags: string[];
  hyper_previews: HyperPreview[];
  version: string; file_type: string; source_build: string; site: string; owner: string; last_modified: string;
}

export interface ParsingTabProps { workbookId: string; projectId?: string; runId?: string; isPdfMode?: boolean; }

const isHexColor = (str: any) => typeof str === 'string' && /^#([0-9A-F]{3}){1,2}$/i.test(str.trim());
const cleanLabel = (val: any) => typeof val === 'string' ? val.replace(/\s*\({0,1}not in xml\){0,1}\s*/ig, '').trim() : (val || "");

/* Helper to safely extract a display string from potentially nested objects */
function extractString(obj: any): string {
    if (typeof obj !== 'object' || obj === null) return String(obj);
    if (isValidElement(obj)) return "[Complex Element]";
    const val = obj.name || obj.field || obj.caption || obj.text;
    if (val !== undefined && val !== null) {
        if (typeof val === 'object') return extractString(val);
        return String(val);
    }
    return JSON.stringify(obj);
}

/* Helper to safely render any value into a React-compatible format */
function safeRender(v: any): ReactNode {
    if (v === null || v === undefined) return "";
    if (typeof v === 'object' && !isValidElement(v)) {
        if (Array.isArray(v)) return v.map(item => extractString(item)).join(", ");
        return extractString(v);
    }
    return v;
}

/* ═══════════════════════════════════════════════════════════════════════
   DESIGN TOKENS & STYLES
═══════════════════════════════════════════════════════════════════════ */

const T = { font: "'DM Sans','Segoe UI',system-ui,sans-serif", mono: "'Cascadia Code','Fira Code','Consolas',monospace" } as const

const useStyles = () => ({
  container: "vl-container",
  header: "vl-header",
  title: "vl-title",
  subtitle: "vl-subtitle",
  sectionHeading: "vl-section-heading",
  sectionCard: "vl-section-card",
  metricsGrid3: "vl-metrics-grid",
  metricCard: "vl-metric-card",
  metricValue: "vl-metric-value",
  metricValueText: "vl-metric-text",
  metricLabel: "vl-metric-label",
  infoTile: "vl-info-tile",
  grid3: "vl-grid-3",
  codeBlock: "vl-code-block",
  emptyState: "vl-empty-state",
  tableContainer: "vl-table-container",
  wrapCell: "vl-wrap-cell",
  sectionHeaderRow: "vl-section-header-row",
  sectionHeader: "vl-section-header",
  infoItem: "vl-info-item",
  infoLabel: "vl-info-label",
  tabListWrapper: "vl-tab-list-wrapper",
  noHoverTab: "vl-no-hover-tab",
  tabList: "vl-tab-list",
  tabContent: "vl-tab-content",
  tabsCard: "vl-tabs-card",
  bluePillBadge: "vl-blue-pill-badge",
  bluePillBadgeSmall: "vl-blue-pill-badge-small"
});

/* ═══════════════════════════════════════════════════════════════════════
   PRIMITIVE COMPONENTS
═══════════════════════════════════════════════════════════════════════ */

function Empty({ label = "No data available." }: { label?: string }) {
  const styles = useStyles(); return <div className={styles.emptyState}>{label}</div>
}

function SectionCard({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  const styles = useStyles(); return (<Card className={cx(styles.sectionCard, className)}> {title && <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>{title}</div>} {children} </Card>)
}

interface ColDef<Row = any> { key: keyof Row | string; label: string; mono?: boolean; muted?: boolean; align?: "left" | "center" | "right"; render?: (row: Row, isPdfMode?: boolean) => ReactNode }

function LogicalLineage({ relationships, isPdfMode = false }: { relationships: LogicalRelationship[], isPdfMode?: boolean }) {
  const nodes = useMemo(() => {
    const map = new Map<string, { id: string; incoming: number; outgoing: number }>()
    for (const rel of relationships) {
      const left = String(rel.left || "").trim()
      const right = String(rel.right || "").trim()
      if (!left || !right) continue
      if (!map.has(left)) map.set(left, { id: left, incoming: 0, outgoing: 0 })
      if (!map.has(right)) map.set(right, { id: right, incoming: 0, outgoing: 0 })
      map.get(left)!.outgoing += 1
      map.get(right)!.incoming += 1
    }
    return map
  }, [relationships])

  const layout = useMemo(() => {
    const names = Array.from(nodes.keys())
    const leftToRight = new Map<string, string[]>()
    const indegree = new Map<string, number>()

    names.forEach((n) => {
      leftToRight.set(n, [])
      indegree.set(n, 0)
    })

    relationships.forEach((rel) => {
      const from = String(rel.left || "").trim()
      const to = String(rel.right || "").trim()
      if (!from || !to || !leftToRight.has(from) || !leftToRight.has(to)) return
      leftToRight.get(from)!.push(to)
      indegree.set(to, (indegree.get(to) || 0) + 1)
    })

    const level = new Map<string, number>()
    const queue: string[] = []
    indegree.forEach((deg, node) => {
      if (deg === 0) {
        queue.push(node)
        level.set(node, 0)
      }
    })

    while (queue.length > 0) {
      const current = queue.shift()!
      const currentLevel = level.get(current) || 0
      for (const next of leftToRight.get(current) || []) {
        level.set(next, Math.max(level.get(next) || 0, currentLevel + 1))
        indegree.set(next, (indegree.get(next) || 0) - 1)
        if ((indegree.get(next) || 0) === 0) {
          queue.push(next)
        }
      }
    }

    let fallbackLevel = Math.max(0, ...Array.from(level.values()))
    names.forEach((n) => {
      if (!level.has(n)) {
        fallbackLevel += 1
        level.set(n, fallbackLevel)
      }
    })

    const columns = new Map<number, string[]>()
    names.forEach((n) => {
      const l = level.get(n) || 0
      if (!columns.has(l)) columns.set(l, [])
      columns.get(l)!.push(n)
    })

    const sortedLevels = Array.from(columns.keys()).sort((a, b) => a - b)
    sortedLevels.forEach((l) => columns.get(l)!.sort((a, b) => a.localeCompare(b)))

    const nodeWidth = 250
    const nodeHeight = 78
    const colGap = 110
    const rowGap = 44
    const padX = 40
    const padY = 28
    const maxRows = Math.max(1, ...sortedLevels.map((l) => columns.get(l)!.length))
    const width = Math.max(820, padX * 2 + sortedLevels.length * nodeWidth + Math.max(0, sortedLevels.length - 1) * colGap)
    const height = Math.max(240, padY * 2 + maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap)

    const positions = new Map<string, { x: number; y: number }>()
    sortedLevels.forEach((l, colIdx) => {
      const colNodes = columns.get(l)!
      const colHeight = colNodes.length * nodeHeight + Math.max(0, colNodes.length - 1) * rowGap
      const startY = Math.max(padY, (height - colHeight) / 2)
      colNodes.forEach((n, rowIdx) => {
        positions.set(n, {
          x: padX + colIdx * (nodeWidth + colGap),
          y: startY + rowIdx * (nodeHeight + rowGap)
        })
      })
    })

    return { positions, nodeWidth, nodeHeight, width, height }
  }, [nodes, relationships])

  const edgeColor = "var(--primary)"
  const pdfScale = isPdfMode && layout.width > 1000 ? 1000 / layout.width : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{
        border: `1px solid var(--border)`,
        borderRadius: "12px",
        background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
        overflowX: isPdfMode ? "hidden" : "auto",
        overflowY: "hidden",
        padding: "8px",
        height: isPdfMode ? layout.height * pdfScale + 16 : undefined
      }}>
        <div style={{ 
          position: "relative", 
          width: layout.width, 
          height: layout.height,
          transform: isPdfMode && pdfScale < 1 ? `scale(${pdfScale})` : undefined,
          transformOrigin: "top left"
        }}>
          <svg width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {relationships.map((rel, idx) => {
              const from = String(rel.left || "").trim()
              const to = String(rel.right || "").trim()
              const fromPos = layout.positions.get(from)
              const toPos = layout.positions.get(to)
              if (!fromPos || !toPos) return null

              const sx = fromPos.x + layout.nodeWidth
              const sy = fromPos.y + layout.nodeHeight / 2
              const ex = toPos.x
              const ey = toPos.y + layout.nodeHeight / 2
              const curve = Math.max(60, Math.abs(ex - sx) * 0.45)
              const path = `M ${sx} ${sy} C ${sx + curve} ${sy}, ${ex - curve} ${ey}, ${ex} ${ey}`

              return (
                <g key={`edge-${idx}`}>
                  <path d={path} fill="none" stroke={edgeColor} strokeWidth="2" opacity="0.9" />
                  <circle cx={sx} cy={sy} r="2.5" fill={edgeColor} opacity="0.8" />
                  <polygon points={`${ex},${ey} ${ex - 8},${ey - 4} ${ex - 8},${ey + 4}`} fill={edgeColor} opacity="0.95" />
                </g>
              )
            })}
          </svg>

          {Array.from(nodes.entries()).map(([name, meta]) => {
            const pos = layout.positions.get(name)
            if (!pos) return null
            return (
              <Card
                key={name}
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: layout.nodeWidth,
                  minHeight: layout.nodeHeight,
                  borderRadius: "10px",
                  border: `1px solid var(--border)`,
                  background: "var(--surface)",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <Text weight="semibold" style={{ color: "#0f172a", overflowWrap: "anywhere" }}>{name}</Text>
                  <Database size={16} color={"var(--primary)"} />
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <Badge variant="secondary">In {meta.incoming}</Badge>
                  <Badge variant="default">Out {meta.outgoing}</Badge>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {relationships.map((r, idx) => {
          const val = (r.cardinality && r.cardinality !== "—") ? r.cardinality : r.type
          return (
            <Card
              key={`rel-${idx}`}
              style={{
                borderRadius: "10px",
                border: `1px solid var(--border)`,
                background: "var(--surface)",
                padding: "12px 14px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <Badge variant="default">{r.left}</Badge>
                  <Text style={{ color: "#64748b", fontWeight: 600 }}>to</Text>
                  <Badge variant="default">{r.right}</Badge>
                </div>
                <Badge variant="secondary" style={{ whiteSpace: "nowrap" }}>{val || "Unknown"}</Badge>
              </div>
              <div style={{ marginTop: "12px", display: "flex" }}>
                <Badge 
                  variant="secondary" 
                  style={{ 
                    fontFamily: T.mono, 
                    fontSize: "12px",
                    padding: "6px 12px",
                    borderRadius: "99px",
                    height: "auto",
                    textAlign: "left",
                    whiteSpace: "normal",
                    wordBreak: "break-all",
                    color: "#0f172a"
                  }}
                >
                  {r.on}
                </Badge>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function DataTable<Row extends Record<string, any>>({ cols, rows, pageSize = 5, isPdfMode = false }: { cols: ColDef<Row>[]; rows: Row[]; pageSize?: number, isPdfMode?: boolean }) {
  const styles = useStyles()
  const [page, setPage] = useState(0)
  if (!rows?.length) return <Empty />
  const totalPages = Math.ceil(rows.length / pageSize)
  const needsPagination = rows.length > pageSize && !isPdfMode
  const pageRows = isPdfMode ? rows : (needsPagination ? rows.slice(page * pageSize, (page + 1) * pageSize) : rows)
  const renderCell = (row: Row, c: ColDef<Row>) => {
    const val = c.render ? c.render(row, isPdfMode) : row[c.key as string];
    return safeRender(val);
  };

  return (
    <div>
      <div className={styles.tableContainer}>
        <table style={{ tableLayout: "auto", width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{cols.map(c => (<th key={String(c.key)} style={{ whiteSpace: "nowrap", fontWeight: "bold" }} align={c.align === "center" ? "center" : "left"}>{c.label}</th>))}</tr></thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={String(c.key)} className={styles.wrapCell} align={c.align === "center" ? "center" : "left"}>
                    <Text style={{ fontFamily: c.mono ? T.mono : "inherit", color: c.muted ? "#64748b" : "inherit" }}>
                      {renderCell(row, c)}
                    </Text>
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
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === 0 ? "#f8fafc" : "#ffffff", color: page === 0 ? "#cbd5e1" : "#666666", cursor: page === 0 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Previous</button>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page >= totalPages - 1 ? "#f8fafc" : "#ffffff", color: page >= totalPages - 1 ? "#cbd5e1" : "#666666", cursor: page >= totalPages - 1 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Next</button>
        </div>
      )}
    </div>
  )
}

function PaginatedList<T>({ items, renderItem, pageSize = 5, isPdfMode = false }: { items: T[]; renderItem: (item: T, index: number) => ReactNode; pageSize?: number, isPdfMode?: boolean }) {
  const [page, setPage] = useState(0)
  if (!items?.length) return null
  const totalPages = Math.ceil(items.length / pageSize)
  const needsPagination = items.length > pageSize && !isPdfMode
  const pageItems = isPdfMode ? items : (needsPagination ? items.slice(page * pageSize, (page + 1) * pageSize) : items)
  return (
    <div>
      {pageItems.map((item, i) => renderItem(item, page * pageSize + i))}
      {needsPagination && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", padding: "12px 0", fontSize: "13px", color: "#64748b" }}>
          <span>Page {page + 1} of {totalPages} ({Math.min((page + 1) * pageSize, items.length)} of {items.length} items)</span>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === 0 ? "#f8fafc" : "#ffffff", color: page === 0 ? "#cbd5e1" : "#666666", cursor: page === 0 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Previous</button>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page >= totalPages - 1 ? "#f8fafc" : "#ffffff", color: page >= totalPages - 1 ? "#cbd5e1" : "#666666", cursor: page >= totalPages - 1 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Next</button>
        </div>
      )}
    </div>
  )
}

function Section({ title, children, defaultOpen = false, isPdfMode = false }: { title: string, children: ReactNode, defaultOpen?: boolean, isPdfMode?: boolean }) {
  const styles = useStyles()
  const [isOpen, setIsOpen] = useState(defaultOpen || isPdfMode)

  return (
    <Card className={styles.sectionCard} style={{ padding: "16px 20px" }}>
      <div className={styles.sectionHeaderRow} onClick={() => !isPdfMode && setIsOpen(!isOpen)} style={{ marginBottom: isOpen ? "16px" : "0", cursor: isPdfMode ? "default" : "pointer" }}>
        {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        <div className={styles.sectionHeader}>{title}</div>
      </div>
      {isOpen && <div>{children}</div>}
    </Card>
  )
}

function ItemCard({
  name,
  typeBadgeLabel,
  typeBadgeColor,
  usageCount,
  sourceText,
  codeBlock
}: {
  name: string,
  typeBadgeLabel?: string,
  typeBadgeColor?: "default" | "success" | "warning" | "secondary" | "destructive" | "outline",
  usageCount?: number,
  sourceText?: string,
  codeBlock?: string
}) {
  const styles = useStyles()
  return (
    <div className={styles.infoItem} style={{ marginBottom: "12px", backgroundColor: "#ffffff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "14px", color: "#0f172a" }}>{safeRender(name)}</strong>
        {typeBadgeLabel && <Badge variant={typeBadgeColor || "secondary"}>{typeBadgeLabel}</Badge>}
        {usageCount !== undefined && <Badge variant="default">Used: {usageCount}</Badge>}
        {sourceText && <span style={{ fontSize: "12px", color: "#64748b" }}>{sourceText}</span>}
      </div>
      {codeBlock && <div className={styles.codeBlock}>{codeBlock}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   INNER TAB DEFINITIONS
═══════════════════════════════════════════════════════════════════════ */

const P_TABS = [
  { key: "sources", label: "Data Sources" },
  { key: "tables_entities", label: "Tables / Entities" },
  { key: "analytical_model", label: "Analytical Model" },
  { key: "dashboard_objects", label: "Dashboard Objects" },
  { key: "insights", label: "Insights" },
  { key: "renamed_fields", label: "Renamed Fields" }
] as const

type TabKey = typeof P_TABS[number]["key"]

/* ═══════════════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════════════ */

export function ParsingTab({ workbookId, projectId: propProjectId, runId: propRunId, isPdfMode }: ParsingTabProps) {
  const styles = useStyles()
  const [tab, setTab] = useState<TabKey>("sources")

  const parsingDataMap = useParsingStore(state => state.parsingData)
  const isLoadingMap = useParsingStore(state => state.isLoading)
  const errorMap = useParsingStore(state => state.error)
  const fetchParsingResult = useParsingStore(state => state.fetchParsingResult)

  const d = parsingDataMap[workbookId]
  const storeError = errorMap[workbookId]

  const { currentRunId, currentProjectId, activities, assessmentData } = useAgentStore()
  const { selectedProject, applications } = useDashboardStore()

  const projectId = propProjectId || currentProjectId || selectedProject || ""
  const runId = propRunId || currentRunId || ""
  const isHistoricalRun = !!propRunId && propRunId !== currentRunId

  const hasData = !!d?.workbook_name;

  const hasParsingStarted = useMemo(() => {
    if (hasData) return true;
    if (!runId || !activities[runId]?.[workbookId]) return false;
    return activities[runId][workbookId].some(a => matchesAgent(a.agent_name, 'parsing'));
  }, [activities, runId, workbookId, hasData]);

  const isParsingComplete = useMemo(() => {
    if (isHistoricalRun || hasData) return true;
    if (!runId || !activities[runId]?.[workbookId]) return false;
    const parsingActs = activities[runId][workbookId].filter(a => matchesAgent(a.agent_name, 'parsing'));
    return parsingActs.some(a => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()));
  }, [activities, runId, workbookId, isHistoricalRun, hasData]);

  useEffect(() => {
    if (!workbookId || !projectId || !runId) return;
    if (!isParsingComplete) return;
    if (hasData) return;

    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    const pullData = async () => {
      if (!isMounted || useParsingStore.getState().parsingData[workbookId]) {
        clearInterval(intervalId);
        return;
      }
      await fetchParsingResult(projectId, workbookId, runId);
    };

    pullData();
    intervalId = setInterval(pullData, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [workbookId, projectId, runId, isParsingComplete, hasData, fetchParsingResult]);

  useEffect(() => { setTab("sources") }, [workbookId])

  const resolvedWorkbookName = useMemo(() => {
    // 1. Check if parsing data d has a valid workbook_name that isn't "Unknown Workbook" / "Unknown" / UUID
    const dName = d?.workbook_name || (d as any)?.app_name || (d as any)?.name;
    if (dName && dName !== "Unknown Workbook" && dName !== "Unknown" && !/^[0-9a-fA-F-]{32,36}$/.test(dName)) {
      return dName;
    }

    // 2. Check assessmentData from useAgentStore
    const assessObj = runId ? assessmentData[runId]?.[workbookId] : undefined;
    const payload = assessObj?.payload || assessObj || {};
    const assessName = payload.app_name 
      || payload.app?.app_name 
      || payload.workbook_name 
      || assessObj?.workbook_name 
      || (assessObj as any)?.app_name;

    if (assessName && assessName !== "Unknown Workbook" && assessName !== "Unknown" && !/^[0-9a-fA-F-]{32,36}$/.test(assessName)) {
      return assessName;
    }

    // 3. Check applications from useDashboardStore
    const appObj = (applications || []).find(a => a.workbookId === workbookId || a.id === workbookId);
    if (appObj?.workbookName && appObj.workbookName !== "Unknown Workbook" && appObj.workbookName !== "Unknown") {
      return appObj.workbookName;
    }

    // 4. Fallback to dName if present, or workbookId
    return (dName && dName !== "Unknown Workbook") ? dName : (workbookId || "Application");
  }, [d, workbookId, runId, assessmentData, applications]);

  const displayWorkbookName = resolvedWorkbookName;

  const uniqueDsTypes = useMemo(() => {
    if (!d) return "N/A";
    const types = Array.from(new Set(d.sources.map(s => s.type))).filter(Boolean);
    return types.length > 0 ? types.join(", ") : d.file_type || "snowflake";
  }, [d]);

  const tableCount = useMemo(() => {
    if (!d) return 0;
    return d.tables?.length || d.sources.reduce((acc, s) => acc + (s.tables?.length || 0), 0) || 0;
  }, [d]);

  const dimCount = useMemo(() => d?.fields?.dimensions?.length || 0, [d]);
  const measCount = useMemo(() => d?.fields?.measures?.length || 0, [d]);
  const filterCount = useMemo(() => {
    if (!d) return 0;
    const paramCount = d.parameters?.length || 0;
    const setCount = d.sets?.length || 0;
    const wsFilterCount = (d.worksheets || []).reduce((acc, w) => acc + (w.filters?.length || 0), 0);
    return paramCount + setCount + wsFilterCount;
  }, [d]);

  const handleExportJson = () => {
    if (!d) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(d, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${resolvedWorkbookName}_parsing_results.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className={styles.container} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
      {!isParsingComplete ? (
        <Card className={styles.tabsCard} style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner size="large" label={hasParsingStarted ? "Generating structural breakdown..." : "Waiting for parsing to begin..."} />
        </Card>
      ) : storeError ? (
        <Card className={styles.tabsCard} style={{ padding: "40px" }}>
          <Text weight="semibold" style={{ color: "#dc2626", fontSize: "16px" }}>Error: {storeError}</Text>
        </Card>
      ) : !d ? (
        <Card className={styles.tabsCard} style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner size="large" label={isHistoricalRun ? "Fetching historical parsing results..." : "Finalizing parsing results..."} />
        </Card>
      ) : (
        <>
          <div className={styles.header} style={{ marginBottom: "24px" }}>
            <div>
              <div className={styles.title} style={{ fontSize: "28px", fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>Parsing Results</div>
              <div className={styles.subtitle} style={{ fontSize: "14px", color: "#64748b", marginTop: "6px" }}>
                Detailed structural metadata of data sources, tables, and metrics for <span style={{ color: "#0f172a", fontWeight: 600 }}>{resolvedWorkbookName}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px", marginBottom: "24px", width: "100%", boxSizing: "border-box" }}>
            <Card style={{ padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
              <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Shapes size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>APPLICATION</div>
                <div title={resolvedWorkbookName} style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{resolvedWorkbookName}</div>
              </div>
            </Card>

            <Card style={{ padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
              <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Database size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>DATA SOURCE TYPE</div>
                <div title={uniqueDsTypes} style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{uniqueDsTypes}</div>
              </div>
            </Card>

            <Card style={{ padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
              <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Database size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>TABLES</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>{tableCount}</div>
              </div>
            </Card>

            <Card style={{ padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
              <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Key size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>DIMENSIONS</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>{dimCount}</div>
              </div>
            </Card>

            <Card style={{ padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
              <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>MEASURES</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>{measCount}</div>
              </div>
            </Card>

            <Card style={{ padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff", display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
              <div style={{ padding: "10px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Filter size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>FILTERS</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>{filterCount}</div>
              </div>
            </Card>
          </div>

          <Card className={styles.tabsCard} style={isPdfMode ? { backgroundColor: "#ffffff", border: "none" } : { padding: 0, overflow: "hidden" }}>
            <div style={{ 
              width: "100%",
              overflowX: "auto", 
              scrollbarWidth: "none", 
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
              borderBottom: `1px solid var(--border)`
            }}>
              <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
                <TabsList style={{ display: "inline-flex", minWidth: "max-content", borderBottom: "none" }}>
                  {P_TABS.map(t => (
                    <TabsTrigger key={t.key} value={t.key} className={styles.noHoverTab} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className={styles.tabContent}>
              {isPdfMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                  <div style={{ pageBreakInside: "avoid" }}>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                      Data Sources
                    </div>
                    <P_Sources d={d} isPdfMode={isPdfMode} />
                  </div>

                  <div style={{ pageBreakInside: "avoid" }}>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                      Tables / Entities
                    </div>
                    <P_Model d={d} isPdfMode={isPdfMode} />
                  </div>

                  <div style={{ pageBreakInside: "avoid" }}>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                      Analytical Model
                    </div>
                    <P_FieldsAndLODs d={d} isPdfMode={isPdfMode} />
                  </div>

                  <div style={{ pageBreakInside: "avoid" }}>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                      Dashboard Objects
                    </div>
                    <P_DashboardObjects d={d} isPdfMode={isPdfMode} />
                  </div>

                  <div style={{ pageBreakInside: "avoid" }}>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                      Insights
                    </div>
                    <P_Visuals d={d} isPdfMode={isPdfMode} />
                  </div>

                  <div style={{ pageBreakInside: "avoid" }}>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "8px", borderBottom: `2px solid var(--primary)` }}>
                      Renamed Fields
                    </div>
                    <P_RenamedFields d={d} isPdfMode={isPdfMode} />
                  </div>
                </div>
              ) : (
                <>
                  {tab === "sources" && <P_Sources d={d} isPdfMode={isPdfMode} />}
                  {tab === "tables_entities" && <P_Model d={d} isPdfMode={isPdfMode} />}
                  {tab === "analytical_model" && <P_FieldsAndLODs d={d} isPdfMode={isPdfMode} />}
                  {tab === "dashboard_objects" && <P_DashboardObjects d={d} isPdfMode={isPdfMode} />}
                  {tab === "insights" && <P_Visuals d={d} isPdfMode={isPdfMode} />}
                  {tab === "renamed_fields" && <P_RenamedFields d={d} isPdfMode={isPdfMode} />}
                </>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB PANELS
═══════════════════════════════════════════════════════════════════════ */

function P_Sources({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
  const styles = useStyles();
  const [showCustomSql, setShowCustomSql] = useState(isPdfMode);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Data Sources & Connections</div>
        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>Live and extract connections used in the workbook</div>
        <div style={{ overflowX: "auto", borderRadius: "8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "700px" }}>

            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Name</th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Type</th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Mode</th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Server</th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Custom SQL</th>
                <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Uses Parameters</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: any[] = [];
                (d.sources || []).forEach(r => {
                  if (r.connections && r.connections.length > 0) {
                    r.connections.forEach(conn => {
                      rows.push({ ...r, ...conn, originalSource: r });
                    });
                  } else {
                    rows.push({ ...r, originalSource: r });
                  }
                });
                return rows.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "16px", fontWeight: 600, color: "#0f172a", lineHeight: "1.4" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span>{safeRender(r.originalSource.name)}</span>
                        {r.database && <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>{r.database}</span>}
                      </div>
                    </td>
                    <td style={{ padding: "16px", color: "#475569" }}>{r.type}</td>
                    <td style={{ padding: "16px" }}>
                      <Badge variant={r.originalSource.mode === "Live" ? "secondary" : "default"} style={{ textTransform: "lowercase" }}>{r.originalSource.mode === "Live" ? "live" : "extract"}</Badge>
                    </td>

                    <td style={{ padding: "16px", color: "#666666", fontSize: "13px", wordBreak: "break-word" }}>{r.server || "—"}</td>
                    <td style={{ padding: "16px" }}>
                      {r.originalSource.custom_sql ? <Badge variant="destructive">Yes</Badge> : <span style={{ color: "#64748b" }}>No</span>}
                    </td>
                    <td style={{ padding: "16px" }}>
                      {(() => {
                        const matchedParams = r.originalSource.custom_sql
                          ? (d.custom_sql_queries || [])
                            .filter(q => q.datasource === r.originalSource.name && q.parameters && q.parameters.length > 0)
                            .flatMap(q => q.parameters as string[])
                          : [];
                        return matchedParams.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <Badge variant="default" style={{ fontWeight: 600, alignSelf: "flex-start" }}>Yes</Badge>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "2px" }}>
                              {matchedParams.map((p, pi) => (
                                <Badge key={pi} variant="secondary">{p}</Badge>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#64748b" }}>No</span>
                        );
                      })()}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      {d.custom_sql_queries && d.custom_sql_queries.length > 0 && (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow} onClick={() => !isPdfMode && setShowCustomSql(!showCustomSql)} style={{ cursor: isPdfMode ? "default" : "pointer" }}>
            {showCustomSql ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <div className={styles.sectionHeader}>
              Custom SQL Queries
              <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({d.custom_sql_queries.length})</span>
            </div>
          </div>
          {showCustomSql && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <PaginatedList items={d.custom_sql_queries} isPdfMode={isPdfMode} renderItem={(sql, i) => (
                <div key={i} className={styles.infoItem} style={{ backgroundColor: "#ffffff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "14px", color: "#0f172a" }}>{sql.table_name || sql.datasource}</strong>
                    <Badge variant="warning" style={{ whiteSpace: "nowrap" }}>Custom SQL</Badge>
                    {sql.parameters && sql.parameters.length > 0 && (
                      <Badge variant="default" style={{ whiteSpace: "nowrap" }}>Uses Parameters</Badge>
                    )}
                  </div>
                  <div className={styles.codeBlock}>{sql.query}</div>
                  {sql.parameters && sql.parameters.length > 0 && (
                    <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Parameters:</span>
                      {sql.parameters.map((p, pi) => (
                        <Badge key={pi} variant="secondary">{p}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )} />
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function P_Model({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
    const styles = useStyles();
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Logical Layer - Relationships</div>
        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>Table relationships and cardinality defined in the data model</div>
        {(!d.model?.logical || d.model.logical.length === 0) ? (
          <Empty label="No logical relationships defined." />
        ) : (
          <LogicalLineage relationships={d.model.logical} isPdfMode={isPdfMode} />

        )}
      </Card>

      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Physical Layer - Joins</div>
        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>Physical join definitions between tables</div>
        {(!d.model?.physical || d.model.physical.length === 0) ? (
          <Text style={{ color: '#64748b' }}>No physical joins — relationships only.</Text>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "650px" }}>

              <thead>
                <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Left Table</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Right Table</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Join Type</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#0f172a", fontWeight: 700, fontSize: "13px" }}>Join Condition(s)</th>
                </tr>
              </thead>
              <tbody>
                {d.model.physical.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 500, color: "#0f172a" }}>{r.left}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 500, color: "#0f172a" }}>{r.right}</td>
                    <td style={{ padding: "14px 16px" }}><Badge variant="warning">{r.join_type}</Badge></td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ display: "inline-block", padding: "4px 10px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "6px", fontFamily: "ui-monospace, Consolas, monospace", fontSize: "12px", color: "#92400e", wordBreak: "break-word" }}>{r.condition}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <P_TablesAndColumns d={d} isPdfMode={isPdfMode} />
    </div>
  )
}

function P_TablesAndColumns({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
  const styles = useStyles();
  const tables = d.tables || [];

  return (
    <Card className={styles.sectionCard} style={{ marginTop: "24px" }}>
      <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Tables & Columns</div>
      <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>Detailed schema and column structure for all tables in the workbook</div>
      {tables.length === 0 ? (
        <Empty label="No detailed table metadata found for this connection type." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
              <Database size={18} color="#6366f1" />
              <Text size={400} weight="bold" style={{ color: "#0f172a" }}>Workbook Tables</Text>
              <Badge variant="default" style={{ marginLeft: "auto" }}>{tables.length} table{tables.length !== 1 ? "s" : ""}</Badge>
            </div>
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "600px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ textAlign: "left", padding: "12px 14px", color: "#475569", fontWeight: 700, fontSize: "12px", borderBottom: "1px solid #e2e8f0", width: "35%" }}>Table Name</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", color: "#475569", fontWeight: 700, fontSize: "12px", borderBottom: "1px solid #e2e8f0", width: "25%" }}>Schema / Source</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", color: "#475569", fontWeight: 700, fontSize: "12px", borderBottom: "1px solid #e2e8f0", width: "20%" }}>Type</th>
                    <th style={{ textAlign: "left", padding: "12px 14px", color: "#475569", fontWeight: 700, fontSize: "12px", borderBottom: "1px solid #e2e8f0", width: "20%" }}>Structure</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t, idx) => (
                    <Fragment key={idx}>
                      <tr style={{ background: idx % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: isPdfMode ? "none" : "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxWidth: "240px" }}>
                            <Text weight="bold" style={{ color: "#0f172a", wordBreak: "break-word" }}>{t.table_name}</Text>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {t.schema_name && (
                              <div style={{ 
                                display: "block", 
                                padding: "4px 8px", 
                                backgroundColor: "#f1f5f9", 
                                borderRadius: "4px", 
                                fontSize: "11px", 
                                color: "#475569", 
                                border: "1px solid #e2e8f0",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                                lineHeight: "1.5"
                              }}>
                                {t.schema_name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <Badge variant="default" style={{ textTransform: "capitalize" }}>{(t.relation_type || "table").replace(/_/g, " ")}</Badge>
                        </td>
                        {!isPdfMode && (
                          <td style={{ padding: "12px 14px" }}>
                            {t.columns && t.columns.length > 0 ? (
                              <Popover withArrow positioning="below-start">
                                <PopoverTrigger disableButtonEnhancement>
                                  <Button variant="ghost" style={{ color: "var(--primary)", fontWeight: 600, padding: "4px 8px" }}><FileText size={14} />
                                    {t.columns.length} Columns
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent style={{ width: "340px", padding: "16px", maxHeight: "400px", overflowY: "auto", backgroundColor: "#ffffff", border: `1px solid var(--border)`, boxShadow: "var(--shadow-md)", borderRadius: "12px" }}>
                                  <div style={{ borderBottom: `1px solid var(--border)`, paddingBottom: "8px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <Text weight="bold" size={400} style={{ color: "#0f172a" }}>{t.table_name} Columns</Text>
                                    <Badge variant="default">{t.columns.length}</Badge>
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {t.columns.map((c, cIdx) => (
                                      <div key={cIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#666666", wordBreak: "break-word" }}>{c.renamed_column_name || c.name}</span>
                                          {c.renamed_column_name && c.renamed_column_name !== c.name && (
                                            <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace", wordBreak: "break-word", overflowWrap: "anywhere" }}>orig: {c.name}</span>
                                          )}
                                        </div>
                                        <Badge variant="secondary">{c.datatype}</Badge>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>No columns detected</span>}
                          </td>
                        )}
                      </tr>
                      {isPdfMode && t.columns && t.columns.length > 0 && (
                        <tr style={{ background: idx % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: "1px solid #f1f5f9" }}>
                          <td colSpan={4} style={{ padding: "0 14px 14px 14px" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}>
                              <thead>
                                <tr style={{ background: "#f8fafc" }}>
                                  <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #e2e8f0", color: "#64748b", textTransform: "uppercase", fontSize: "10px", fontWeight: 700 }}>COLUMN NAME</th>
                                  <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #e2e8f0", color: "#64748b", textTransform: "uppercase", fontSize: "10px", fontWeight: 700 }}>ORIGINAL NAME</th>
                                  <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "1px solid #e2e8f0", color: "#64748b", textTransform: "uppercase", fontSize: "10px", fontWeight: 700 }}>DATA TYPE</th>
                                </tr>
                              </thead>
                              <tbody>
                                {t.columns.map((c, cIdx) => (
                                  <tr key={cIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#334155" }}>{c.renamed_column_name || c.name}</td>
                                    <td style={{ padding: "8px 12px", color: "#64748b", fontFamily: "monospace" }}>{c.renamed_column_name && c.renamed_column_name !== c.name ? c.name : "—"}</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right" }}><Badge variant="secondary">{c.datatype}</Badge></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function P_FieldsAndLODs({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
  const styles = useStyles()
  const lods = (d.calculations || []).filter(c => c.is_lod)
  const [openSections, setOpenSections] = useState({ dimensions: true, measures: isPdfMode, lods: isPdfMode })
  const toggleSection = (key: keyof typeof openSections) => {
    if (isPdfMode) return;
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Dimensions — collapsible */}
      <Card className={styles.sectionCard} style={{ padding: "20px 28px" }}>
        <div className={styles.sectionHeaderRow} onClick={() => toggleSection("dimensions")} style={{ marginBottom: openSections.dimensions ? "16px" : "0", cursor: isPdfMode ? "default" : "pointer" }}>
          {openSections.dimensions ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <div className={styles.sectionHeader} style={{ fontSize: "20px" }}>
            Dimensions
            <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({d.fields?.dimensions?.length || 0})</span>
          </div>
        </div>
        {openSections.dimensions && (
          <div>
            {d.fields?.dimensions && d.fields.dimensions.length > 0 ? (
              <PaginatedList items={d.fields.dimensions} isPdfMode={isPdfMode} renderItem={(f, i) => (
                <ItemCard key={`dim-${i}`} name={f.name} usageCount={f.usage_count} sourceText={f.source} codeBlock={f.formula && f.formula !== "—" ? f.formula : undefined} />
              )} />
            ) : <Empty label="No dimensions found." />}
          </div>
        )}
      </Card>

      {/* Measures — collapsible */}
      <Card className={styles.sectionCard} style={{ padding: "20px 28px" }}>
        <div className={styles.sectionHeaderRow} onClick={() => toggleSection("measures")} style={{ marginBottom: openSections.measures ? "16px" : "0", cursor: isPdfMode ? "default" : "pointer" }}>
          {openSections.measures ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <div className={styles.sectionHeader} style={{ fontSize: "20px" }}>
            Measures
            <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({d.fields?.measures?.length || 0})</span>
          </div>
        </div>
        {openSections.measures && (
          <div>
            {d.fields?.measures && d.fields.measures.length > 0 ? (
              <PaginatedList items={d.fields.measures} isPdfMode={isPdfMode} renderItem={(f, i) => (
                <ItemCard key={`mea-${i}`} name={f.name} usageCount={f.usage_count} sourceText={f.source} codeBlock={f.formula && f.formula !== "—" ? f.formula : undefined} />
              )} />
            ) : <Empty label="No measures found." />}
          </div>
        )}
      </Card>

      {/* LODs — collapsible */}
      <Card className={styles.sectionCard} style={{ padding: "20px 28px" }}>
        <div className={styles.sectionHeaderRow} onClick={() => toggleSection("lods")} style={{ marginBottom: openSections.lods ? "16px" : "0", cursor: isPdfMode ? "default" : "pointer" }}>
          {openSections.lods ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <div className={styles.sectionHeader} style={{ fontSize: "20px" }}>
            LODs
            <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({lods.length})</span>
          </div>
        </div>
        {openSections.lods && (
          <div>
            {lods.length > 0 ? (
              <PaginatedList items={lods} isPdfMode={isPdfMode} renderItem={(c, i) => (
                <ItemCard key={`lod-${i}`} name={c.name} typeBadgeLabel={c.lod_type ? c.lod_type.toUpperCase() : "LOD"} typeBadgeColor="default" usageCount={c.usage_count} sourceText={c.source} codeBlock={c.formula} />
              )} />
            ) : <Empty label="No LOD expressions found." />}
          </div>
        )}
      </Card>

      {/* Table Calculations — collapsible */}
      <P_TableCalculations d={d} isPdfMode={isPdfMode} />

    </div>
  )
}

function P_Params({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
  const styles = useStyles()
  const [dynSubTab, setDynSubTab] = useState<string>("top_bottom")
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Parameters Card – non-collapsible */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Parameters</div>
        <div style={{ padding: "12px 16px", background: "#f1f5f9", borderRadius: "6px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: "15px" }}>Total Parameters</span>
          <strong style={{ fontSize: "17px" }}>{d.parameters.length}</strong>
        </div>
        {d.parameters.length > 0 ? (
          <DataTable<Parameter> cols={[
            { key: "name", label: "Name", render: (r: Parameter) => <div><strong>{r.name}</strong><br /><span style={{ fontSize: '10px', color: '#64748b' }}>{r.id}</span></div> },
            { key: "current_value", label: "Current Value", mono: true, render: (r: Parameter) => String(r.current_value) },
            {
              key: "allowable_values", label: "Allowable Values", render: (r: Parameter, isPdfMode?: boolean) => {
                if (r.allowable_list && r.allowable_list.length > 0) {
                  if (isPdfMode) {
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {r.allowable_list.map((v, i) => (
                          <Badge key={i} variant="secondary">{v.display_as}</Badge>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <Popover withArrow positioning="below-start">
                      <PopoverTrigger disableButtonEnhancement>
                        <Button variant="ghost" style={{ color: "var(--primary)", fontWeight: 600, padding: "4px 8px" }}>
                          List ({r.allowable_list.length} values)
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent style={{ width: "340px", padding: "16px", maxHeight: "350px", overflowY: "auto", backgroundColor: "#ffffff", border: `1px solid var(--border)`, boxShadow: "var(--shadow-md)", borderRadius: "12px" }}>
                        <div style={{ borderBottom: `1px solid var(--border)`, paddingBottom: "8px", marginBottom: "12px" }}><Text weight="bold" size={400} style={{ color: "#0f172a" }}>Allowable Values</Text></div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", marginBottom: "8px", borderBottom: "1px solid #e2e8f0" }}>
                          <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Displayed Value</Text>
                          <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Actual Value</Text>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {r.allowable_list.map((v, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                              <span style={{ fontSize: "13px", fontWeight: 500, color: "#666666" }}>{v.display_as}</span>
                              <Badge variant="secondary">{v.value}</Badge>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )
                }
                return <span style={{ color: "#64748b", fontSize: "13px" }}>{r.allowable_values || "All values"}</span>
              }
            }
          ]} rows={d.parameters} isPdfMode={isPdfMode} />
        ) : <Empty label="No parameters found." />}
      </Card>

      {/* Dynamic Sets Card with Top/Bottom + Condition sub-tabs */}
      {(() => {
        const dynamicSets = d.sets.filter(s => s.type?.toLowerCase() === "dynamic");
        const topBottomSets = dynamicSets.filter(s => s.subtype?.toLowerCase() === "top_bottom");
        const conditionSets = dynamicSets.filter(s => s.subtype?.toLowerCase() === "condition" || (!s.subtype && !topBottomSets.includes(s)));
        const staticSets = d.sets.filter(s => s.type?.toLowerCase() === "static");

        const topBottomCols: ColDef<SetDef>[] = [
          { key: "name", label: "Name", render: r => <strong>{r.name}</strong> },
          { key: "base_field", label: "Base Field", mono: true },
          { key: "subtype", label: "Subtype", render: r => <Badge variant="secondary" style={{ height: "auto", padding: "4px 10px", lineHeight: "1.2", textAlign: "center" }}>{r.subtype || "—"}</Badge> },
          { key: "mode", label: "Mode", render: r => <Badge variant={r.mode === "top" ? "success" : "warning"}>{r.mode || "—"}</Badge> },
          { key: "count", label: "Count", render: r => <strong>{r.count ?? "—"}</strong> },
          { key: "expression", label: "Expression", mono: true, muted: true, render: r => r.expression || "—" },
        ];

        const conditionCols: ColDef<SetDef>[] = [
          { key: "name", label: "Name", render: r => <strong>{r.name}</strong> },
          { key: "base_field", label: "Base Field", mono: true },
          { key: "subtype", label: "Subtype", render: r => <Badge variant="secondary" style={{ height: "auto", padding: "4px 10px", lineHeight: "1.2", textAlign: "center" }}>{r.subtype || "condition"}</Badge> },
          { key: "condition", label: "Condition", mono: true, muted: true, render: r => r.condition || "—" },
          { key: "expression", label: "Expression", mono: true, muted: true, render: r => r.expression || "—" },
        ];

        const staticCols: ColDef<SetDef>[] = [
          { key: "name", label: "Name", render: r => <strong>{r.name}</strong> },
          { key: "base_field", label: "Base Field", mono: true },
          {
            key: "selected_members", label: "Selected Members", render: (r, isPdfMode) => {
              const members = r.selected_members ?? [];
              if (members.length === 0) return <span style={{ color: "#94a3b8", fontStyle: "italic" }}>None</span>;
              if (isPdfMode) {
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {members.map((m, i) => <Badge key={i} variant="secondary">{m}</Badge>)}
                  </div>
                );
              }
              return (
                <Popover withArrow positioning="below-start">
                  <PopoverTrigger disableButtonEnhancement>
                    <Button variant="ghost" style={{ color: "var(--primary)", fontWeight: 600, padding: "4px 8px" }}>
                      {members.length} Members
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent style={{ width: "300px", padding: "16px", maxHeight: "350px", overflowY: "auto", backgroundColor: "#ffffff", border: `1px solid var(--border)`, boxShadow: "var(--shadow-md)", borderRadius: "12px" }}>
                    <div style={{ borderBottom: `1px solid var(--border)`, paddingBottom: "8px", marginBottom: "12px" }}><Text weight="bold" size={400} style={{ color: "#0f172a" }}>Selected Members</Text></div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {members.map((m, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", backgroundColor: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "#666666" }}>{m}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }
          },
        ];

        return (
          <>
            <Card className={styles.sectionCard}>
              <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Dynamic Sets</div>
              <div style={{ padding: "12px 16px", background: "#f1f5f9", borderRadius: "6px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: "15px" }}>Total Dynamic Sets</span>
                <strong style={{ fontSize: "17px" }}>{dynamicSets.length}</strong>
              </div>

              <div style={{ borderBottom: "1px solid #e2e8f0", marginBottom: "16px" }}>
                <Tabs value={dynSubTab} onValueChange={(value) => setDynSubTab(value)}>
                  <TabsList>
                    <TabsTrigger value="top_bottom" className={styles.noHoverTab} style={{ fontSize: "14px", fontWeight: 500 }}>Top / Bottom ({topBottomSets.length})</TabsTrigger>
                    <TabsTrigger value="condition" className={styles.noHoverTab} style={{ fontSize: "14px", fontWeight: 500 }}>Condition ({conditionSets.length})</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {dynSubTab === "top_bottom" && (
                topBottomSets.length > 0 ? (
                  <DataTable<SetDef> cols={topBottomCols} rows={topBottomSets} isPdfMode={isPdfMode} />
                ) : <Empty label="No top/bottom dynamic sets found." />
              )}
              {dynSubTab === "condition" && (
                conditionSets.length > 0 ? (
                  <DataTable<SetDef> cols={conditionCols} rows={conditionSets} isPdfMode={isPdfMode} />
                ) : <Empty label="No condition dynamic sets found." />
              )}
            </Card>

            <Card className={styles.sectionCard}>
              <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Static Sets</div>
              <div style={{ padding: "12px 16px", background: "#f1f5f9", borderRadius: "6px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: "15px" }}>Total Static Sets</span>
                <strong style={{ fontSize: "17px" }}>{staticSets.length}</strong>
              </div>
              {staticSets.length > 0 ? (
                <DataTable<SetDef> cols={staticCols} rows={staticSets} isPdfMode={isPdfMode} />
              ) : <Empty label="No static sets found." />}
            </Card>
          </>
        );
      })()}
    </div>
  )
}

/* Shared column defs for Visual tables */
const filterCol: ColDef<Worksheet> = {
  key: "filters", label: "Filters", align: "center",
  render: (r: Worksheet, isPdfMode?: boolean) => {
    const detailCount = r.filters_detail?.length || 0;
    const basicCount = r.filters?.length || 0;
    
    if (detailCount === 0 && basicCount === 0) return <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>None</span>;
    
    if (isPdfMode) {
      if (detailCount > 0) {
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {r.filters_detail!.map((f, i) => (
              <Badge key={i} variant={f.type.toLowerCase() === 'measure' ? "success" : "secondary"}>{f.name}</Badge>
            ))}
          </div>
        );
      }
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {r.filters!.map((f, i) => <Badge key={i} variant="secondary">{f}</Badge>)}
        </div>
      );
    }

    // If we have basic filters but no detail, show a simple badge
    if (detailCount === 0 && basicCount > 0) {
      return (
        <Popover withArrow positioning="below-start">
          <PopoverTrigger disableButtonEnhancement>
            <Button variant="ghost" style={{ color: "var(--primary)", fontWeight: 600, padding: "4px 8px" }}><Filter size={16} />{basicCount} Filters</Button>
          </PopoverTrigger>
          <PopoverContent style={{ width: "260px", padding: "16px", maxHeight: "400px", overflowY: "auto", backgroundColor: "#ffffff" }}>
            <div style={{ borderBottom: `1px solid var(--border)`, paddingBottom: "8px", marginBottom: "12px" }}><Text weight="bold" size={400}>Applied Filters</Text></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {r.filters!.map((f, i) => <Badge key={i} variant="secondary" style={{ whiteSpace: "nowrap" }}>{f}</Badge>)}
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Popover withArrow positioning="below-start">
        <PopoverTrigger disableButtonEnhancement>
          <Button variant="ghost" style={{ color: "var(--primary)", fontWeight: 600, padding: "4px 8px" }}><Filter size={16} />{detailCount} Filters</Button>
        </PopoverTrigger>
        <PopoverContent style={{ width: "300px", padding: "16px", maxHeight: "400px", overflowY: "auto", backgroundColor: "#ffffff", border: `1px solid var(--border)`, boxShadow: "var(--shadow-md)", borderRadius: "12px" }}>
          <div style={{ borderBottom: `1px solid var(--border)`, paddingBottom: "8px", marginBottom: "12px" }}><Text weight="bold" size={400} style={{ color: "#0f172a" }}>Applied Filters</Text></div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {r.filters_detail!.map((f, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#666666" }}>{f.name}</span>
                <Badge variant={f.type.toLowerCase() === 'measure' ? "success" : "secondary"}>{f.type}</Badge>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }
};

const formattingCol: ColDef<Worksheet> = {
  key: "formatting", label: "Formatting", align: "center",
  render: (r: Worksheet, isPdfMode?: boolean) => {
    const combinedTooltips = [
      ...(r.tooltips || []),
      ...(r.tooltip_formatting || [])
    ];
    // Deduplicate by stringifying content
    const uniqueTooltips = Array.from(new Set(combinedTooltips.map(t => typeof t === 'string' ? t : JSON.stringify(t))))
      .map(s => { try { return JSON.parse(s); } catch (e) { return s; } });

    const rawFormatting = r.visual_properties?.formatting || [];
    const vpFontsFromFormatting = rawFormatting.map(f => ({
      applied_to: f.applied_to,
      font: f.font,
      size: f.size,
      bold: f.bold === "true" || f.bold === true,
      color: f.font_color,
      alignment: f.alignment
    })).filter(f => f.font || f.size || f.color);

    const vpColorsFromFormatting = rawFormatting
      .filter(f => f.bg_color && f.bg_color !== "None")
      .map(f => ({ color: f.bg_color!, applied_to: f.applied_to }));

    const colorsCount = r.colors?.length || 0;
    const fontsCount = r.fonts?.length || 0;
    const axisCount = r.axis_formatting?.length || 0;
    const bordersCount = r.borders?.length || 0;
    const vpFonts = [...(r.visual_properties?.fonts || []), ...vpFontsFromFormatting];
    const vpColors = [...(r.visual_properties?.colors || []), ...vpColorsFromFormatting];
    const bgColor: string | null = r.visual_properties?.background_color || null;
    const vpAxes: any[] = r.visual_properties?.axes || [];
    const marksText = r.marks_text?.filter(m => m && m !== "None") || [];
    const marksColor = r.marks_color?.filter(m => m && m !== "None") || [];
    const marksDetail = r.marks_detail?.filter(m => m && m !== "None") || [];
    const marksSize = r.marks_size?.filter(m => m && m !== "None") || [];
    const hasMarks = marksText.length > 0 || marksColor.length > 0 || marksDetail.length > 0 || marksSize.length > 0;

    const hasFormatting = fontsCount > 0 || colorsCount > 0 || uniqueTooltips.length > 0 || axisCount > 0 || bordersCount > 0 || vpFonts.length > 0 || vpColors.length > 0 || !!bgColor || hasMarks || vpAxes.length > 0;
    if (!hasFormatting) return <span style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>None</span>;
    
    if (isPdfMode) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", textAlign: "left" }}>
          {vpColors.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.5px" }}>COLORS ({vpColors.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {vpColors.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px" }}>
                    <div style={{ width: "12px", height: "12px", borderRadius: "3px", backgroundColor: String(c.color), border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }} title={cleanLabel(c.color)} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {vpFonts.length > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.5px" }}>FONTS ({vpFonts.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {vpFonts.map((f, i) => (
                   <Badge key={i} style={{ fontSize: "10px", height: "auto", padding: "2px 6px", background: "#f8fafc", color: "#475569" }}>{cleanLabel(f.font || "Arial")}</Badge>
                ))}
              </div>
            </div>
          )}
          {hasMarks && (
            <div style={{ marginTop: "4px" }}>
              <Badge variant="default" style={{ fontWeight: 700 }}>Custom Marks</Badge>
            </div>
          )}
        </div>
      );
    }

    return (
      <Popover withArrow positioning="below-start">
        <PopoverTrigger disableButtonEnhancement>
          <Button variant="ghost" style={{ color: "var(--primary)", fontWeight: 600, padding: "4px 8px" }}><Sparkles size={16} />View Styles</Button>
        </PopoverTrigger>
        <PopoverContent style={{ width: "380px", padding: "16px", maxHeight: "500px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px", backgroundColor: "#ffffff", border: `1px solid var(--border)`, boxShadow: "var(--shadow-md)", borderRadius: "12px" }}>
          <div style={{ borderBottom: `1px solid var(--border)`, paddingBottom: "8px" }}><Text weight="bold" size={400} style={{ color: "#0f172a" }}>Formatting Details</Text></div>

          {/* Visual Properties — Colors with applied_to */}
          {vpColors.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Visual Colors ({vpColors.length})</Text>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {vpColors.map((c, i) => (
                  <div key={`vpc-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "6px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {isHexColor(c.color) && <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: typeof c.color === 'string' ? c.color.trim() : "" }} />}
                      <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#666666" }}>{cleanLabel(c.color)}</span>
                    </div>
                    <Badge variant="secondary" style={{ whiteSpace: "nowrap" }}>{c.applied_to}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worksheet Colors (Direct) */}
          {colorsCount > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Worksheet Colors ({colorsCount})</Text>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {r.colors!.map((c, i) => (
                  <Badge key={`clr-${i}`} variant="secondary" style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {isHexColor(c) && <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: typeof c === 'string' ? c.trim() : "" }} />}
                      <span>{safeRender(c)}</span>
                    </div>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Visual Properties — Fonts with full details (size, alignment, bold), grouped by applied_to */}
          {vpFonts.length > 0 && (() => {
            // Group fonts by applied_to, merging properties from duplicate entries
            const grouped = vpFonts.reduce<Record<string, { font?: string; size?: string; alignment?: string; bold?: boolean; color?: string }>>((acc, f) => {
              const key = f.applied_to;
              if (!acc[key]) acc[key] = {};
              if (f.font) acc[key].font = f.font;
              if (f.size) acc[key].size = f.size;
              if (f.alignment) acc[key].alignment = f.alignment;
              if (f.bold !== undefined) acc[key].bold = f.bold;
              if (f.color) acc[key].color = f.color;
              return acc;
            }, {});
            const entries = Object.entries(grouped);
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Visual Fonts ({entries.length})</Text>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {entries.map(([appliedTo, props], i) => (
                    <div key={`vpf-${i}`} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                      {/* Header — applied_to */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <Badge variant="secondary">{appliedTo}</Badge>
                        {props.bold && <Badge variant="warning">Bold</Badge>}
                      </div>
                      {/* Property rows */}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {props.font && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>Font</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", fontFamily: props.font }}>{cleanLabel(props.font)}</span>
                          </div>
                        )}
                        {props.size && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>Size</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", fontFamily: "monospace" }}>{props.size}pt</span>
                          </div>
                        )}
                        {props.color && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>Color</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {isHexColor(props.color) && <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: typeof props.color === 'string' ? props.color.trim() : "" }} />}
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", fontFamily: "monospace" }}>{cleanLabel(props.color)}</span>
                            </div>
                          </div>
                        )}
                        {props.alignment && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>Alignment</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>{props.alignment}</span>
                          </div>
                        )}
                        {props.bold !== undefined && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px" }}>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>Bold</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: props.bold ? "#0f172a" : "#94a3b8" }}>{props.bold ? "Yes" : "No"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Background Color from visual_properties */}
          {bgColor && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Background Color</Text>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#f8fafc", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "6px", backgroundColor: bgColor, border: "1px solid #e2e8f0", flexShrink: 0 }} />
                <span style={{ fontFamily: "monospace", fontSize: "13px", color: "#666666", fontWeight: 600 }}>{bgColor}</span>
              </div>
            </div>
          )}

          {/* Visual Properties — Axes */}
          {vpAxes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Axes ({vpAxes.length})</Text>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {vpAxes.map((ax: any, i: number) => (
                  <div key={`vpa-${i}`} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                    {/* Header — target */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <Badge variant="warning">{ax.target || "Axis"}</Badge>
                    </div>
                    {/* Property rows */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {/* Axis Title */}
                      {ax.axis_title && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>Title</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>{ax.axis_title.text || "—"}</span>
                            {ax.axis_title.custom && <Badge variant="default">Custom</Badge>}
                          </div>
                        </div>
                      )}
                      {/* Range */}
                      {ax.range && (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>Range</span>
                            <Badge variant={ax.range.type === "fixed" ? "default" : "secondary"}>{ax.range.type || "auto"}</Badge>
                          </div>
                          {ax.range.type === "fixed" && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ fontSize: "12px", color: "#64748b" }}>Min / Max</span>
                              <span style={{ fontSize: "11px", fontWeight: 600, color: "#0f172a", fontFamily: "monospace" }}>
                                {Number(ax.range.min).toFixed(2)} — {Number(ax.range.max).toFixed(2)}
                              </span>
                            </div>
                          )}
                          {ax.range.include_zero !== undefined && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ fontSize: "12px", color: "#64748b" }}>Include Zero</span>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: ax.range.include_zero ? "#0f172a" : "#94a3b8" }}>{ax.range.include_zero ? "Yes" : "No"}</span>
                            </div>
                          )}
                        </>
                      )}
                      {/* Scale */}
                      {ax.scale && (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>Scale</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>{ax.scale.type || "Linear"}</span>
                          </div>
                          {ax.scale.reversed && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ fontSize: "12px", color: "#64748b" }}>Reversed</span>
                              <Badge variant="warning">Yes</Badge>
                            </div>
                          )}
                          {ax.scale.logarithmic && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px" }}>
                              <span style={{ fontSize: "12px", color: "#64748b" }}>Logarithmic</span>
                              <Badge variant="warning">Yes</Badge>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Marks Channel */}
          {hasMarks && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Marks Channel</Text>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                {marksText.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Text</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "flex-end" }}>
                      {marksText.map((m, mi) => <Badge key={`mt-${mi}`} variant="secondary" style={{ fontFamily: "'Cascadia Code','Consolas',monospace", fontSize: "11px", whiteSpace: "nowrap" }}>{safeRender(m)}</Badge>)}
                    </div>
                  </div>
                )}
                {marksColor.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Color</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "flex-end" }}>
                      {marksColor.map((m, mi) => <Badge key={`mc-${mi}`} variant="success" style={{ whiteSpace: "nowrap" }}>{safeRender(m)}</Badge>)}
                    </div>
                  </div>
                )}
                {marksDetail.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Detail</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "flex-end" }}>
                      {marksDetail.map((m, mi) => <Badge key={`md-${mi}`} variant="secondary" style={{ whiteSpace: "nowrap" }}>{safeRender(m)}</Badge>)}
                    </div>
                  </div>
                )}
                {marksSize.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Size</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "flex-end" }}>
                      {marksSize.map((m, mi) => <Badge key={`ms-${mi}`} variant="default" style={{ whiteSpace: "nowrap" }}>{safeRender(m)}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formatting list fonts */}
          {fontsCount > 0 && (<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Fonts ({fontsCount})</Text><div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>{r.fonts!.map((f: any, i: number) => (<Badge key={`font-${i}`} variant="secondary" style={{ padding: "4px 8px" }}>{safeRender(f)}</Badge>))}</div></div>)}

          {/* Merged & Deduplicated Tooltip formatting */}
          {uniqueTooltips.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tooltip Formatting ({uniqueTooltips.length})</Text>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {uniqueTooltips.map((t: any, i: number) => (
                  <div key={`tooltip-${i}`} style={{ backgroundColor: "#f1f5f9", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: "#666666", wordBreak: "break-word", lineHeight: "1.4" }}>
                    {typeof t === 'object' && t.fields_used ? (
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
                        <strong>Fields:</strong>
                        {Array.isArray(t.fields_used) ? (
                          t.fields_used.map((f: any, fi: number) => (
                            <Badge key={`tf-${fi}`} variant="secondary" style={{ fontFamily: "'Cascadia Code','Consolas',monospace", fontSize: "11px", whiteSpace: "nowrap" }}>
                              {safeRender(f)}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary" style={{ fontFamily: "'Cascadia Code','Consolas',monospace", fontSize: "11px", whiteSpace: "nowrap" }}>
                            {safeRender(t.fields_used)}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontFamily: typeof t === 'string' && (t.includes('<') || t.includes('>')) ? "monospace" : "inherit" }}>
                        {typeof t === 'string' ? t : JSON.stringify(t)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Axis formatting — structured property cards */}
          {axisCount > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Axis Formatting ({axisCount})</Text>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {r.axis_formatting!.map((a: any, i: number) => {
                  if (typeof a === 'string') {
                    return <div key={`axis-${i}`} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontFamily: "monospace", color: "#666666" }}>{a}</div>;
                  }
                  const { target, style_rule, ...rest } = a;
                  return (
                    <div key={`axis-${i}`} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        {target && <Badge variant="warning">{target}</Badge>}
                        {style_rule !== undefined && <Badge variant={style_rule ? "success" : "secondary"}>Style Rule: {String(style_rule)}</Badge>}
                      </div>
                      {/* Properties */}
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {Object.entries(rest).map(([k, v], ki) => (
                          <div key={ki} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: ki < Object.entries(rest).length - 1 ? "1px solid #f1f5f9" : "none" }}>
                            <span style={{ fontSize: "12px", color: "#64748b", textTransform: "capitalize" }}>{k.replace(/-/g, ' ')}</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", fontFamily: "monospace" }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {bordersCount > 0 && (<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}><Text weight="semibold" size={200} style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Borders ({bordersCount})</Text><div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>{r.borders!.map((b: any, i: number) => (<Badge key={`border-${i}`} variant="secondary" style={{ padding: "4px 8px" }}>{typeof b === 'string' ? b : JSON.stringify(b)}</Badge>))}</div></div>)}



        </PopoverContent>
      </Popover>
    );
  }
};

function P_Visuals({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
  const styles = useStyles();
  const [visualTab, setVisualTab] = useState<string>("sheets");
  const ws = d.worksheets || [];
  const sheetsWithRowsCols = ws.filter(w => (w.rows?.length || 0) > 0 || (w.columns?.length || 0) > 0);
  const kpiSheets = ws.filter(w => (w.rows?.length || 0) === 0 && (w.columns?.length || 0) === 0);

  const commonCols = [
    { key: "name", label: "Sheet Name", render: (r: Worksheet) => <div><strong style={{ color: "#0f172a", fontSize: "14px" }}>{r.name}</strong></div> },
    { key: "mark_type", label: "Mark Type", render: (r: Worksheet) => <Badge variant="secondary" style={{ textTransform: "capitalize", whiteSpace: "nowrap" }}>{r.mark_type}</Badge> },
  ];
  const rowColCols = [
    ...commonCols,
    { key: "rows", label: "Rows", mono: true },
    { key: "columns", label: "Columns", mono: true },
    filterCol,
    formattingCol
  ];
  const marksTextCol = {
    key: "marks_text", label: "Mark Text",
    render: (r: Worksheet) => r.marks_text && r.marks_text.length > 0
      ? <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {r.marks_text.map((m, i) => <Badge key={i} variant="secondary" style={{ fontFamily: "'Cascadia Code','Consolas',monospace", fontSize: "11px", whiteSpace: "nowrap" }}>{safeRender(m)}</Badge>)}
      </div>
      : <span style={{ color: "#94a3b8" }}>—</span>
  };
  const kpiCols = [...commonCols, marksTextCol, filterCol, formattingCol];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Text size={500} weight="bold" style={{ color: "#0f172a" }}>Visuals ({(d.worksheets || []).length})</Text>

      {isPdfMode ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "4px", borderBottom: `1px solid var(--primary)` }}>
              Sheets ({sheetsWithRowsCols.length})
            </div>
            {sheetsWithRowsCols.length > 0 ? <DataTable<Worksheet> cols={rowColCols} rows={sheetsWithRowsCols} isPdfMode={isPdfMode} /> : <Empty label="No sheets with rows/columns found." />}
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--primary)", marginBottom: "16px", paddingBottom: "4px", borderBottom: `1px solid var(--primary)` }}>
              KPI & Summary ({kpiSheets.length})
            </div>
            {kpiSheets.length > 0 ? <DataTable<Worksheet> cols={kpiCols} rows={kpiSheets} isPdfMode={isPdfMode} /> : <Empty label="No KPI/summary sheets found." />}
          </div>
        </div>
      ) : (
        <>
          <div style={{ 
            overflowX: "auto", 
            scrollbarWidth: "none", 
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            borderBottom: `1px solid var(--border)`,
            marginBottom: "16px"
          }} className="vl-tablist-scroll-wrapper">
            <style>{`
              .vl-tablist-scroll-wrapper::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            <Tabs value={visualTab} onValueChange={(value) => setVisualTab(value)}>
              <TabsList className={styles.tabList} style={{ minWidth: "max-content", borderBottom: "none" }}>
                <TabsTrigger value="sheets" className={styles.noHoverTab} style={{ fontSize: "14px", fontWeight: 500 }}>Sheets ({sheetsWithRowsCols.length})</TabsTrigger>
                <TabsTrigger value="kpi" className={styles.noHoverTab} style={{ fontSize: "14px", fontWeight: 500 }}>KPI & Summary ({kpiSheets.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {visualTab === "sheets" && (
            sheetsWithRowsCols.length > 0 ? <DataTable<Worksheet> cols={rowColCols} rows={sheetsWithRowsCols} isPdfMode={isPdfMode} /> : <Empty label="No sheets with rows/columns found." />
          )}
          {visualTab === "kpi" && (
            kpiSheets.length > 0 ? <DataTable<Worksheet> cols={kpiCols} rows={kpiSheets} isPdfMode={isPdfMode} /> : <Empty label="No KPI/summary sheets found." />
          )}
        </>
      )}
    </div>
  )
}

function DeviceLayoutTree({ nodes }: { nodes: any[] }) {
  if (!Array.isArray(nodes)) return null;
  const items: { name: string, type?: string, param?: string, style: Record<string, any>, position: Record<string, string>, textRuns: { text: string; attributes: Record<string, string> }[] }[] = [];

  const recurse = (nodeList: any[]) => {
    nodeList.forEach(node => {
      const attrs = node.attributes || {};
      const name = attrs.name || node.name;
      const typeV2 = attrs['type-v2'];
      const isContentNode = (name && name.trim() !== "") || (typeV2 && !typeV2.includes('layout'));
      
      const textRuns: { text: string; attributes: Record<string, string> }[] = [];
      if (node.formatted_text?.runs && Array.isArray(node.formatted_text.runs)) {
        node.formatted_text.runs.forEach((run: any) => {
          if (run.text && run.text.trim() && run.text.trim() !== 'Æ' && run.text.trim() !== '\n') {
            textRuns.push({ text: run.text.trim(), attributes: run.attributes || {} });
          }
        });
      }

      if (isContentNode && node.style && Object.keys(node.style).length > 0) {
        const position: Record<string, string> = {};
        if (attrs.x !== undefined) position['x'] = attrs.x;
        if (attrs.y !== undefined) position['y'] = attrs.y;
        if (attrs.w !== undefined) position['w'] = attrs.w;
        if (attrs.h !== undefined) position['h'] = attrs.h;

        let finalName = name || `[${typeV2}]`;
        let finalParam = attrs.param;
        let finalRuns = [...textRuns];

        // Promote content to heading for better UX (per user request)
        if (typeV2 === 'web' && finalParam) {
          finalName = finalParam;
          finalParam = undefined;
        } else if (typeV2 === 'text' && finalRuns.length > 0) {
          finalName = finalRuns[0].text;
          finalRuns.shift();
        }

        items.push({ 
          name: finalName, 
          type: typeV2 === 'text' && finalName === name ? undefined : typeV2, 
          param: finalParam, 
          style: node.style, 
          position, 
          textRuns: finalRuns 
        });
      } else if (textRuns.length > 0) {
        const position: Record<string, string> = {};
        if (attrs.x !== undefined) position['x'] = attrs.x;
        if (attrs.y !== undefined) position['y'] = attrs.y;
        if (attrs.w !== undefined) position['w'] = attrs.w;
        if (attrs.h !== undefined) position['h'] = attrs.h;
        const label = attrs['type-v2'] ? `[${attrs['type-v2']}]` : `[id: ${attrs.id || '?'}]`;
        items.push({ name: label, style: node.style || {}, position, textRuns });
      }

      if (node.children && Array.isArray(node.children)) {
        recurse(node.children);
      }
    });
  };
  recurse(nodes);

  if (items.length === 0) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
        No layout objects detected for this view.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px", padding: "4px" }}>
      {items.map((item, idx) => (
        <Card key={idx} style={{ 
          background: "var(--surface)",
          border: `1px solid var(--border)`,
          boxShadow: "var(--shadow-sm)",
          borderRadius: "12px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          transition: "transform 0.2s, box-shadow 0.2s",
          cursor: "default"
        }} className="vl-hover-card">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: `1px solid var(--border)`, paddingBottom: "10px" }}>
            <div style={{ background: "#eff6ff", padding: "6px", borderRadius: "8px" }}>
              <Sparkles size={18} color="#3b82f6" />
            </div>
            <Text weight="bold" size={400} style={{ color: "#0f172a", wordBreak: "break-word" }}>
              {item.name}
            </Text>
            {item.type && <Badge variant="secondary" style={{ textTransform: "capitalize" }}>{item.type}</Badge>}
          </div>

          {/* Functional Params (e.g. URLs) */}
          {item.param && (
            <div style={{ background: "#f8fafc", padding: "6px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "11px", color: "#64748b", wordBreak: "break-word", fontFamily: "monospace" }}>
              <strong>Source:</strong> {item.param}
            </div>
          )}

          {/* Formatted Text Runs if any */}
          {item.textRuns.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {item.textRuns.map((run, ri) => (
                <div key={ri} style={{
                  fontSize: run.attributes.fontsize ? `${Math.min(Number(run.attributes.fontsize), 14)}px` : "12px",
                  fontWeight: run.attributes.bold === "true" ? 700 : 400,
                  color: "#475569",
                  background: "#f1f5f9",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0"
                }}>
                  {run.text}
                </div>
              ))}
            </div>
          )}

          {/* Position Badges - Matches Screenshot */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {['x', 'y', 'w', 'h'].map(key => item.position[key] !== undefined && (
              <div key={key} style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                background: "#f0f9ff", 
                padding: "4px 10px", 
                borderRadius: "6px",
                border: "1px solid #bae6fd"
              }}>
                <span style={{ color: "#0369a1", fontWeight: 800, fontSize: "11px", textTransform: "uppercase" }}>{key}</span>
                <span style={{ color: "#0c4a6e", fontWeight: 600, fontSize: "12px" }}>{item.position[key]}</span>
              </div>
            ))}
          </div>

          {/* Style Properties Table - Matches Screenshot */}
          <div style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #f1f5f9", overflow: "hidden" }}>
            {Object.entries(item.style).length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <tbody>
                  {Object.entries(item.style).map(([key, val], i) => (
                    <tr key={key} style={{ borderBottom: i === Object.entries(item.style).length - 1 ? "none" : "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px", color: "#64748b", fontWeight: 500, textTransform: "capitalize", width: "40%" }}>{key.replace(/-/g, ' ')}</td>
                      <td style={{ padding: "8px 12px", color: "#0f172a", fontWeight: 600, textAlign: "right" }}>
                        {String(val) === "[object Object]" ? "NA" : String(val)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>No style attributes</div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function DashboardCard({ db, isPdfMode = false }: { db: DashboardEntry, isPdfMode?: boolean }) {
  const styles = useStyles();
  const availableLayouts = useMemo(() => Object.keys(db.device_layouts_styling || {}), [db.device_layouts_styling]);
  const [selectedLayoutTab, setSelectedLayoutTab] = useState<string>("");

  useEffect(() => {
    if (availableLayouts.length > 0 && !selectedLayoutTab) {
      // Prefer 'Main' if it exists, otherwise use the first available
      const mainTab = availableLayouts.find(l => l.toLowerCase() === 'main');
      setSelectedLayoutTab(mainTab || availableLayouts[0]);
    }
  }, [availableLayouts, selectedLayoutTab]);

  return (
    <Section title={db.name} isPdfMode={isPdfMode}>
      {/* Formatted Text Runs — dedicated card with all attributes */}
      {(db as any).formatted_text_runs && (db as any).formatted_text_runs.length > 0 && (
        <Card className={styles.sectionCard} style={{ marginBottom: "20px", padding: "16px 20px" }}>
          <div className={styles.sectionHeader} style={{ fontSize: "15px", marginBottom: "14px" }}>📝 Formatted Text ({(db as any).formatted_text_runs.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {(db as any).formatted_text_runs.map((run: any, ri: number) => {
              const attrs = run.attributes || {};
              const fontSize = (attrs.fontsize || attrs.size || run.fontsize || run.size) ? `${Math.min(Number(attrs.fontsize || attrs.size || run.fontsize || run.size), 26)}px` : "16px";
              const isBold = attrs.bold === "true" || attrs.bold === true || attrs.bold === 1 || attrs.bold === "1" || run.bold === "true" || run.bold === true;
              const fontColor = attrs.fontcolor || attrs.color || run.fontcolor || run.color || "#666666";
              
              // Search both attrs and the root run object
              const searchSource = { ...run, ...attrs };
              const fontName = searchSource.fontname || searchSource.font_name || searchSource.fontFamily || searchSource.face || searchSource.family || searchSource['font-family'] || searchSource['font-name'] || searchSource.FontName || searchSource.FontFamily || searchSource.font || searchSource.typeface || searchSource.fontface || searchSource.font_face || searchSource['font-face'] || searchSource.font_family || searchSource.familyName || searchSource['family-name'] || 
                Object.entries(searchSource).find(([k, v]) => {
                  const kl = k.toLowerCase();
                  const vs = String(v);
                  if (kl === 'text' || kl === 'attributes' || kl.includes('size') || kl.includes('color') || kl.includes('align') || kl.includes('bold') || kl.includes('italic') || kl.includes('underline') || kl.includes('weight') || kl.includes('style')) return false;
                  if (vs === '1' || vs === '0' || vs === 'true' || vs === 'false' || vs.startsWith('#') || vs === '[object Object]') return false;
                  return kl.includes('font') || kl.includes('face') || kl.includes('family');
                })?.[1] || "Default Tableau Book"; // Default to Arial if missing (Tableau standard)

              const alignVal = searchSource.fontalignment || searchSource.alignment || searchSource.align || searchSource.font_alignment || searchSource.textAlign || searchSource['text-align'] || searchSource.justify || "left";
              const alignMap: Record<string, string> = { "0": "Left", "1": "Center", "2": "Right", "3": "Justify", "left": "Left", "center": "Center", "right": "Right" };
              const alignment = alignVal ? (alignMap[alignVal.toString()] || alignVal) : null;
              return (
                <div key={ri} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                  {/* Rendered text preview */}
                  <div style={{
                    padding: "12px 16px",
                    background: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    fontSize,
                    fontWeight: isBold ? 700 : 400,
                    color: "#475569",
                    fontFamily: fontName || "inherit",
                    textAlign: (alignment as any) || "left",
                    wordBreak: "break-word"
                  }}>
                    {run.text}
                  </div>
                  {/* Attribute grid */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0", borderTop: "1px solid #f1f5f9" }}>
                    {[
                      { label: "Font Size", value: attrs.fontsize ? `${attrs.fontsize}pt` : "—" },
                      { label: "Bold", value: isBold ? "Yes" : "No" },
                      { 
                        label: "Font Name", 
                        value: fontName || "—"
                      },
                      { label: "Font Color", value: fontColor, isColor: true },
                      { label: "Alignment", value: alignment || "—" },
                    ].map(({ label, value, isColor }) => (
                      <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "8px 14px", minWidth: "110px", flex: "1 1 auto", borderRight: "1px solid #f1f5f9" }}>
                        <span style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>{label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {isColor && value !== "—" && <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: value as string, border: "1px solid #e2e8f0", flexShrink: 0 }} />}
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>{value}</span>
                          
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Info cards: Containers, Layout Mode */}
      <div className={styles.grid3} style={{ alignItems: "stretch", marginBottom: "20px" }}>
        <div className={styles.infoItem}>
          <div className={styles.infoLabel}>Containers</div>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#0f172a" }}>{db.containers}</div>
          {db.containers_list && db.containers_list.length > 0 && (
            <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {db.containers_list.map((c, i) => <Badge key={i} variant="secondary" style={{ whiteSpace: "nowrap" }}>{c}</Badge>)}
            </div>
          )}
        </div>
        <div className={styles.infoItem}>
          <div className={styles.infoLabel}>Layout Mode</div>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#0f172a" }}>{db.layout || "Unknown"}</div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Dashboard Structure</div>
        </div>
      </div>

      {/* Dashboard Objects */}
      {db.objects && db.objects.length > 0 && (
        <Card className={styles.sectionCard} style={{ marginBottom: "16px", padding: "16px 20px" }}>
          <div className={styles.sectionHeader} style={{ fontSize: "16px", marginBottom: "16px" }}>Dashboard Objects ({db.objects.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "4px 0" }}>
            {db.objects.map((obj, i) => (
              <Badge key={i} variant="default" style={{ whiteSpace: "nowrap" }}>{obj}</Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Device Layouts */}
      {db.device_layouts_list && db.device_layouts_list.length > 0 && (
        <Card className={styles.sectionCard} style={{ marginBottom: "16px", padding: "16px 20px" }}>
          <div className={styles.sectionHeader} style={{ fontSize: "16px", marginBottom: "16px" }}>Device Layouts ({db.device_layouts_list.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "4px 0" }}>
            {db.device_layouts_list.map((dl, i) => (
              <Badge key={i} variant="default">{dl}</Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Actions as proper table */}
      <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "12px", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
        <Zap size={14} /> Actions ({db.actionsList?.length || 0})
      </div>
      {db.actionsList && db.actionsList.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={{ padding: "10px 16px", borderBottom: "2px solid #e2e8f0" }}>Action Name</th>
              <th style={{ padding: "10px 16px", borderBottom: "2px solid #e2e8f0" }}>Type</th>
              <th style={{ padding: "10px 16px", borderBottom: "2px solid #e2e8f0" }}>Activation</th>
            </tr>
          </thead>
          <tbody>
            {db.actionsList.map((act, idx) => {
              return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 500 }}>{act.name}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {(() => {
                      const t = (act.type || "").toLowerCase()
                      let c: "success" | "warning" | "default" | "secondary" = "secondary"
                      if (t.includes("filter")) c = "success"
                      else if (t.includes("highlight")) c = "warning"
                      else if (t.includes("url") || t.includes("hyperlink")) c = "default"
                      else if (t.includes("parameter") || t.includes("set")) c = "secondary"
                      else if (t.includes("navigation")) c = "default"
                      return <Badge variant={c}>{act.type}</Badge>
                    })()}
                  </td>
                  <td style={{ padding: "10px 16px" }}><Badge variant="default">{act.activation}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <Text size={200} style={{ color: "#94a3b8" }}>No actions configured.</Text>
      )}


      <div style={{ marginTop: "24px", background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <Text weight="semibold" style={{ fontSize: "16px", color: "#0f172a", marginBottom: "16px", display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Device Layout Styling
        </Text>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "24px" }}>
          {["Main", "Desktop", "Tablet", "Phone"].map(l => {
            const matchLayout = availableLayouts.find(al => al.toLowerCase() === l.toLowerCase());
            const isSelected = selectedLayoutTab === matchLayout || (selectedLayoutTab === l && !matchLayout);
            const hasData = !!matchLayout;
            
            return (
              <div
                key={l}
                onClick={() => { if (hasData && matchLayout) setSelectedLayoutTab(matchLayout); else if (!hasData) return; }}
                style={{
                  padding: "10px 14px",
                  flex: "1 1 calc(25% - 10px)",
                  minWidth: "120px",
                  textAlign: "center",
                  cursor: hasData ? "pointer" : "not-allowed",
                  borderRadius: "10px",
                  border: isSelected ? `2px solid var(--primary)` : `1px solid var(--border)`,
                  background: isSelected ? "#eff6ff" : (hasData ? "var(--surface)" : "#f1f5f9"),
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? "var(--primary)" : (hasData ? "var(--text)" : "#94a3b8"),
                  opacity: hasData ? 1 : 0.6,
                  boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                {l === "Main" && <Sparkles size={14} />}
                {l}
                {hasData && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: isSelected ? "var(--primary)" : "#22c55e" }} />}
              </div>
            );
          })}
        </div>

        {db.device_layouts_styling?.[selectedLayoutTab] && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {Array.isArray(db.device_layouts_styling[selectedLayoutTab]) ? (
              <DeviceLayoutTree nodes={db.device_layouts_styling[selectedLayoutTab]} />
            ) : (
              <>
                {db.device_layouts_styling[selectedLayoutTab].visible_worksheets && (
                  <div>
                    <Text weight="semibold" size={300} style={{ color: "#475569", marginBottom: "12px", display: "block" }}>Visible Worksheets</Text>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {db.device_layouts_styling[selectedLayoutTab].visible_worksheets.map((ws: string, i: number) => (
                        <Badge key={i} variant="default">{ws}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {db.device_layouts_styling[selectedLayoutTab].styling && Object.keys(db.device_layouts_styling[selectedLayoutTab].styling).length > 0 && (
                  <div>
                    <Text weight="semibold" size={300} style={{ color: "#475569", marginBottom: "12px", display: "block" }}>Applied Styling</Text>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                      {Object.entries(db.device_layouts_styling[selectedLayoutTab].styling).map(([key, value]) => (
                        <div key={key} style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ fontSize: "12px", color: "#64748b", textTransform: "capitalize", fontWeight: 500 }}>{key}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {key.toLowerCase().includes("background") && isHexColor(String(value)) && (
                              <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: typeof value === 'string' ? value.trim() : String(value).trim(), border: "1px solid #cbd5e1" }} />
                            )}
                            <span style={{ fontSize: "14px", color: "#0f172a", fontWeight: 600, fontFamily: key.toLowerCase().includes("font") && typeof value === 'string' && value !== "" && value !== "[object Object]" ? value : "inherit" }}>
                              {(value === "" || value === null || value === undefined || String(value) === "[object Object]") ? "NA" : String(value)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {!db.device_layouts_styling?.[selectedLayoutTab] && (
          <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontStyle: "italic", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            No styling detected for {selectedLayoutTab}
          </div>
        )}
      </div>
    </Section>
  );
}

function P_TableCalculations({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
  const styles = useStyles()
  const tableCalcs = (d.calculations || []).filter(c => c.type === "table_calculation")
  const [isOpen, setIsOpen] = useState(isPdfMode)

  return (
    <Card className={styles.sectionCard} style={{ padding: "20px 28px" }}>
      <div className={styles.sectionHeaderRow} onClick={() => !isPdfMode && setIsOpen(!isOpen)} style={{ marginBottom: isOpen ? "16px" : "0", cursor: isPdfMode ? "default" : "pointer" }}>
        {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        <div className={styles.sectionHeader} style={{ fontSize: "20px" }}>
          Table Calculations
          <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({tableCalcs.length})</span>
        </div>
      </div>
      {isOpen && (
        <div>
          {tableCalcs.length > 0 ? (
            <PaginatedList items={tableCalcs} isPdfMode={isPdfMode} renderItem={(c, i) => (
              <ItemCard
                key={`tc-${i}`}
                name={c.name}
                typeBadgeLabel="Table Calc"
                typeBadgeColor="warning"
                usageCount={c.usage_count}
                sourceText={c.dependencies?.length ? `deps: ${c.dependencies.join(", ")}` : undefined}
                codeBlock={c.formula}
              />
            )} />
          ) : <Empty label="No table calculations found." />}
        </div>
      )}
    </Card>
  )
}

//     </div>
//   );
// }
function P_DashboardsAndStories({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
  const styles = useStyles();

  // Filter: Exclude dashboards that are actually part of a Story narrative
  const filteredDashboards = useMemo(() => {
    return (d.dashboards_list || []).filter(db =>
      !db.name?.toLowerCase().includes("story")
    );
  }, [d.dashboards_list]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <Text size={500} weight="bold" style={{ color: "#0f172a" }}>
          Dashboards ({filteredDashboards.length})
        </Text>

        {filteredDashboards.map((db, i) => (
          <DashboardCard key={db.name || `db-${i}`} db={db} isPdfMode={isPdfMode} />
        ))}

        {filteredDashboards.length === 0 && <Empty label="No dashboards found." />}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
        <Text size={500} weight="bold" style={{ color: "#0f172a" }}>
          Stories ({(d.stories_list || []).length})
        </Text>

        {(d.stories_list || []).length > 0 ? (d.stories_list || []).map((st: any, i: number) => {
          // Map the correct JSON fields with fallbacks
          const points = st.story_points || st.points || [];
          const navigatorMode = st.navigator_style || st.navigator || "—";
          const storyName = st.story_name || st.name || `Story ${i + 1}`;

          return (
            <Section key={`st-${i}`} title={storyName} defaultOpen={i === 0} isPdfMode={isPdfMode}>
              <div className={styles.grid3} style={{ alignItems: "stretch", marginBottom: "20px" }}>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Total Points</div>
                  <div style={{ fontSize: "22px", fontWeight: 600, color: "#0f172a" }}>{points.length}</div>
                </div>
                <div className={styles.infoItem}>
                  <div className={styles.infoLabel}>Navigator Mode</div>
                  {/* Now properly reading navigator_style */}
                  <div style={{ fontSize: "22px", fontWeight: 600, color: "#0f172a" }}>{navigatorMode}</div>
                </div>
              </div>

              <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "12px", color: "#0f172a" }}>
                Story Points ({points.length})
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "10px 16px", borderBottom: "2px solid #e2e8f0" }}>#</th>
                    <th style={{ padding: "10px 16px", borderBottom: "2px solid #e2e8f0" }}>Name/Caption</th>
                    <th style={{ padding: "10px 16px", borderBottom: "2px solid #e2e8f0" }}>Content</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((pt: any, idx: number) => {
                    // Map the correct point details
                    const pointNum = pt.point_number || pt.index;
                    const pointName = pt.caption || pt.name;
                    const pointContent = pt.source_content || pt.content;

                    return (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "10px 16px" }}>{pointNum}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 500 }}>
                          {(pointName === "" || pointName === "[object Object]" || !pointName) ? "NA" : pointName}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {(pointContent === "" || pointContent === "[object Object]" || !pointContent) ? "NA" : pointContent}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          );
        }) : <Empty label="No stories found." />}
      </div>
    </div>
  );
}

function P_Permissions({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
  const styles = useStyles()
  const [openPermissions, setOpenPermissions] = useState(true)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Tags – non-collapsible */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "20px" }}>Tags ({d.tags?.length || 0})</div>
        {d.tags?.length === 0 ? (
          <Empty label="No tags found for this workbook." />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 0" }}>
            {(d.tags || []).map((tag, i) => (
              <Badge key={i} variant="default">{tag}</Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Workbook Permissions – collapsible, matching Assessment design */}
      {(d.permissions || []).length > 0 ? (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow} onClick={() => !isPdfMode && setOpenPermissions(!openPermissions)} style={{ cursor: isPdfMode ? "default" : "pointer" }}>
            {openPermissions ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <div className={styles.sectionHeader}>
              Workbook Permissions
              <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>({d.permissions.length} grantees)</span>
            </div>
          </div>

          {openPermissions && (
            <div style={{ marginTop: "16px" }}>
              {(d.permissions || []).map((perm, idx) => (
                <div key={idx} style={{ marginBottom: "20px", padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", fontWeight: 600, fontSize: "15px" }}>
                    <Badge variant={perm.grantee_type === "User" ? "default" : "secondary"}>{perm.grantee_type}</Badge>
                    <span style={{ color: "#666666" }}><span style={{ fontWeight: 700 }}>ID:- </span>{perm.grantee_id}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                    {(perm.capabilities || []).map((cap, j) => (
                      <div key={j} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: cap.value === "Allow" ? "#f0fdf4" : "#fef2f2", borderRadius: "8px", border: `1px solid ${cap.value === "Allow" ? "#bbf7d0" : "#fecaca"}` }}>
                        <span style={{ fontSize: "14px", color: "#1e293b" }}>{cap.name}</span>
                        <Badge variant={cap.value === "Allow" ? "success" : "destructive"}>{cap.value?.toUpperCase()}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader}>Workbook Permissions</div>
          <Text size={300} style={{ color: "#64748b", padding: "20px 0" }}>

            No specific permissions defined (likely inherits project/default settings)
          </Text>
        </Card>
      )}
    </div>
  )
}

function P_EmbeddedAssets({ d, isPdfMode = false }: { d: ParsingPayload, isPdfMode?: boolean }) {
  const styles = useStyles();
  const [expandedAsset, setExpandedAsset] = useState<Record<string, boolean>>({});
  const toggleAsset = (key: string) => {
    if (isPdfMode) return;
    setExpandedAsset(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Auto-expand assets logic - safely using functional updater to prevent infinite loops
  useEffect(() => {
    if (isPdfMode && d.embedded_assets) {
      setExpandedAsset((prev) => {
        const all: Record<string, boolean> = {};
        d.embedded_assets!.forEach((a, i) => {
          const type = a.type === "shape" ? "shape" : "img";
          all[`${type}-${i}`] = true;
        });
        // Avoid returning a new object if lengths match (since all are set to true anyway)
        if (Object.keys(prev).length === Object.keys(all).length) return prev;
        return all;
      });
      return;
    }
    if (d.embedded_assets && d.embedded_assets.length > 0) {
      setExpandedAsset((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const type = d.embedded_assets![0].type === "shape" ? "shape" : "img";
        return { [`${type}-0`]: true };
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.embedded_assets, isPdfMode]);

  const assets = d.embedded_assets || [];
  const images = assets.filter(a => a.type !== "shape");
  const shapes = assets.filter(a => a.type === "shape");
  const creds = d.embedded_credentials || [];
  const hyperPreviews = d.hyper_previews || [];

  const renderExpandableItem = (asset: any, idx: number, prefix: string, icon: React.ReactNode, extraFields?: { label: string; value: React.ReactNode }[]) => {
    const key = `${prefix}-${idx}`;
    const isOpen = expandedAsset[key];
    return (
      <div key={key} style={{ borderBottom: "1px solid #f1f5f9" }}>
        <div
          onClick={() => !isPdfMode && toggleAsset(key)}
          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", cursor: isPdfMode ? "default" : "pointer", transition: "background 0.15s", background: isOpen ? "#f8fafc" : "transparent" }}
        >
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {icon}
          <span style={{ fontWeight: 600, color: "#0f172a", fontSize: "14px", flex: 1 }}>{asset.name}</span>
          <Badge variant="secondary">{asset.size_kb} KB</Badge>

        </div>
        {isOpen && (
          <div style={{ padding: "0 16px 16px 46px", marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>Source</span>
              <Badge variant="secondary">{asset.source}</Badge>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>Embedded</span>
              <span style={{ color: asset.embedded ? "#16a34a" : "#dc2626", fontWeight: 700, fontSize: "13px" }}>{asset.embedded ? "Yes" : "No"}</span>
            </div>
            {extraFields?.map((ef, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>{ef.label}</span>
                {ef.value}
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1", padding: "8px 12px", background: "#f1f5f9", borderRadius: "6px", fontSize: "12px" }}>
              <span style={{ color: "#64748b", fontWeight: 600 }}>Path: </span>
              <span style={{ fontFamily: "monospace", color: "#666666", wordBreak: "break-all" }}>{asset.relative_path}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Hyper Previews — professional marketplace card */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Hyper Previews</div>
        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>Local data extract files embedded in the workbook</div>
        {hyperPreviews.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
            <Text weight="semibold" style={{ color: "#475569", display: "block", marginBottom: "8px" }}>No Hyper Previews Available</Text>
            {d.live > 0 ? (
              <Text size={200} style={{ color: "#64748b" }}>
                Because of **Live Connection**, there is no Hyper Preview.
              </Text>
            ) : (
              <Text size={200} style={{ color: "#64748b" }}>Local data extract files embedded in the workbook would appear here.</Text>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {hyperPreviews.map((hp, i) => (
              <div key={i} style={{ background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #e2e8f0" }}>
                  <Database size={18} color="#3b82f6" />
                  <Text size={400} weight="bold" style={{ color: "#0f172a", wordBreak: "break-word" }}>{hp.hyper_file}</Text>
                  {hp.details && <Badge variant="default" style={{ marginLeft: "auto" }}>{hp.details.length} table{hp.details.length !== 1 ? "s" : ""}</Badge>}
                </div>
                {hp.details && hp.details.length > 0 && (
                  <div style={{ overflowX: "auto", width: "100%" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "500px" }}>
                      <thead>
                        <tr style={{ background: "#ffffff" }}>
                          <th style={{ textAlign: "left", padding: "10px 14px", color: "#0f172a", fontWeight: 700, fontSize: "12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", width: "20%" }}>Schema</th>
                          <th style={{ textAlign: "left", padding: "10px 14px", color: "#0f172a", fontWeight: 700, fontSize: "12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", width: "30%" }}>Table</th>
                          <th style={{ textAlign: "left", padding: "10px 14px", color: "#0f172a", fontWeight: 700, fontSize: "12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", width: "20%" }}>Rows</th>
                          <th style={{ textAlign: "left", padding: "10px 14px", color: "#0f172a", fontWeight: 700, fontSize: "12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", width: "30%" }}>Columns</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hp.details.map((detail, idx) => (
                          <Fragment key={idx}>
                            <tr style={{ background: idx % 2 === 0 ? "#ffffff" : "#fafbff", borderBottom: isPdfMode ? "none" : "1px solid #e2e8f0" }}>
                              <td style={{ padding: "10px 14px" }}><Badge variant="secondary">{detail.schema}</Badge></td>
                              <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#666666", wordBreak: "break-word" }}>{detail.table}</td>
                              <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0f172a" }}>{detail.row_count.toLocaleString()}</td>
                              <td style={{ padding: "10px 14px" }}>
                                {!isPdfMode && (
                                  detail.columns && detail.columns.length > 0 ? (
                                    <Popover withArrow positioning="below-start">
                                      <PopoverTrigger disableButtonEnhancement>
                                        <Button variant="ghost" style={{ color: "var(--primary)", fontWeight: 600, padding: "4px 8px" }}><FileText size={14} />
                                          {detail.columns.length} Columns
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent style={{ width: "320px", padding: "16px", maxHeight: "400px", overflowY: "auto", backgroundColor: "#ffffff", border: `1px solid var(--border)`, boxShadow: "var(--shadow-md)", borderRadius: "12px" }}>
                                        <div style={{ borderBottom: `1px solid var(--border)`, paddingBottom: "8px", marginBottom: "12px" }}>
                                          <Text weight="bold" size={400} style={{ color: "#0f172a" }}>Column Details</Text>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                          {detail.columns.map((c, cIdx) => (
                                            <div key={cIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                              <span style={{ fontSize: "13px", fontWeight: 500, color: "#666666" }}>{c.name}</span>
                                              <Badge variant="secondary">{c.type}</Badge>
                                            </div>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  ) : <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>—</span>
                                )}
                                {isPdfMode && <Badge variant="default">{detail.columns?.length || 0} columns</Badge>}
                              </td>
                            </tr>
                            {isPdfMode && detail.columns && detail.columns.length > 0 && (
                              <tr style={{ background: idx % 2 === 0 ? "#ffffff" : "#fafbff" }}>
                                <td colSpan={4} style={{ padding: "0 14px 14px 14px" }}>
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0" }}>
                                    <thead>
                                      <tr style={{ background: "#f8fafc" }}>
                                        <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #e2e8f0", color: "#64748b", textTransform: "uppercase", fontSize: "10px", fontWeight: 700 }}>COLUMN NAME</th>
                                        <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "1px solid #e2e8f0", color: "#64748b", textTransform: "uppercase", fontSize: "10px", fontWeight: 700 }}>DATA TYPE</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.columns.map((c, cIdx) => (
                                        <tr key={cIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                          <td style={{ padding: "8px 12px", fontWeight: 600, color: "#334155" }}>{c.name}</td>
                                          <td style={{ padding: "8px 12px", textAlign: "right" }}><Badge variant="secondary">{c.type}</Badge></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Images & Logos — expandable list */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Images</div>
        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "16px" }}>Click on any item to view details</div>
        {images.length === 0 ? <Empty label="No embedded images found." /> : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
            <PaginatedList items={images} renderItem={(asset, i) => renderExpandableItem(asset, i, "img", <ImageIcon size={14} color="#3b82f6" />)} />
          </div>
        )}
      </Card>

      {/* Custom Shapes — expandable list */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Custom Shapes</div>
        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "16px" }}>Click on any item to view details</div>
        {shapes.length === 0 ? <Empty label="No custom shapes found." /> : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
            <PaginatedList items={shapes} renderItem={(asset, i) => renderExpandableItem(asset, i, "shape", <Shapes size={14} color="#8b5cf6" />, [
              { label: "Palette", value: <Badge variant="default" style={{ whiteSpace: "nowrap" }}>{asset.palette}</Badge> },
              { label: "Mapped To", value: <Badge variant="secondary" style={{ whiteSpace: "nowrap" }}>{asset.mapped_to}</Badge> },
            ])} />
          </div>
        )}
      </Card>

      {/* Embedded Credentials — professional security cards */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Embedded Credentials</div>
        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>Authentication credentials stored within the workbook</div>
        {creds.length === 0 ? <Empty label="No embedded credentials found." /> : (
          <PaginatedList items={creds} renderItem={(cred, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              <div style={{ background: "linear-gradient(135deg, #fafafa 0%, #f0f4ff 100%)", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: cred.embed_password ? "linear-gradient(90deg, #22c55e, #16a34a)" : "linear-gradient(90deg, #3b82f6, #2563eb)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <Key size={16} color="#6366f1" />
                  <Text size={400} weight="bold" style={{ color: "#0f172a", textTransform: "capitalize" }}>{cred.connection_type}</Text>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", flexWrap: "nowrap", gap: "12px" }}>
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>Username</span>
                    <span style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600, wordBreak: "break-word", textAlign: "right" }}>{cred.username}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>Auth Type</span>
                    <Badge variant="secondary" style={{ textTransform: "uppercase", whiteSpace: "nowrap" }}>{cred.authentication}</Badge>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: cred.embed_password ? "#f0fdf4" : "#fef2f2", borderRadius: "8px", border: `1px solid ${cred.embed_password ? "#bbf7d0" : "#fecaca"}` }}>
                    <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>Embed Password</span>
                    <Badge variant={cred.embed_password ? "success" : "destructive"} style={{ whiteSpace: "nowrap" }}>{cred.embed_password ? "YES" : "NO"}</Badge>
                  </div>
                </div>
              </div>
            </div>
          )} />
        )}
      </Card>

    </div>
  )
}

function P_DashboardObjects({ d, isPdfMode = false }: { d: ParsingPayload; isPdfMode?: boolean }) {
  const styles = useStyles();
  const ws = d.worksheets || [];
  const kpis = ws.filter(w => w.mark_type === 'kpi' || w.type === 'kpi');
  const charts = ws.filter(w => w.mark_type !== 'kpi' && w.type !== 'kpi');
  const actionsCount = d.actions || 0;
  const navMenusCount = d.stories_list?.length || 0;
  const imageCount = (d.embedded_assets || []).filter(a => a.type === 'image').length;
  const filterPaneCount = ws.reduce((acc, w) => acc + (w.filters?.length || 0), 0);

  const [openSection, setOpenSection] = useState<string>("charts");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* KPIs Accordion */}
      <Card className={styles.sectionCard}>
        <div 
          className={styles.sectionHeaderRow} 
          onClick={() => setOpenSection(openSection === "kpi" ? "" : "kpi")}
          style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {openSection === "kpi" ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <span style={{ fontWeight: 600, fontSize: "16px", color: "#0f172a" }}>KPIs</span>
            <Badge variant="secondary">({kpis.length})</Badge>
          </div>
        </div>
        {openSection === "kpi" && (
          <div style={{ marginTop: "16px" }}>
            {kpis.length > 0 ? (
              <DataTable<Worksheet>
                cols={[
                  { key: "name", label: "Title", render: r => <strong>{r.name}</strong> },
                  { key: "sheet_id", label: "Sheet", render: r => r.sheet_id || r.name },
                  { key: "mark_type", label: "Chart Type", render: r => <Badge variant="secondary">KPI</Badge> },
                  { key: "columns", label: "Dimensions", mono: true, render: r => r.columns?.join(", ") || "—" },
                  { key: "rows", label: "Measures", mono: true, render: r => r.rows?.join(", ") || "—" }
                ]}
                rows={kpis}
                isPdfMode={isPdfMode}
              />
            ) : (
              <Empty label="No KPI objects found." />
            )}
          </div>
        )}
      </Card>

      {/* Standard Charts Accordion */}
      <Card className={styles.sectionCard}>
        <div 
          className={styles.sectionHeaderRow} 
          onClick={() => setOpenSection(openSection === "charts" ? "" : "charts")}
          style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {openSection === "charts" ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <span style={{ fontWeight: 600, fontSize: "16px", color: "#0f172a" }}>Standard Charts</span>
            <Badge variant="default">({charts.length})</Badge>
          </div>
        </div>
        {(openSection === "charts" || isPdfMode) && (
          <div style={{ marginTop: "16px" }}>
            {charts.length > 0 ? (
              <DataTable<Worksheet>
                cols={[
                  { key: "name", label: "Title", render: r => <strong style={{ color: "#0f172a" }}>{r.name}</strong> },
                  { key: "sheet_id", label: "Sheet", render: r => r.sheet_id || r.name },
                  { key: "mark_type", label: "Chart Type", render: r => <Badge variant="secondary" style={{ textTransform: "capitalize" }}>{r.mark_type || r.type}</Badge> },
                  { key: "columns", label: "Dimensions", mono: true, render: r => r.columns?.join(", ") || "—" },
                  { key: "rows", label: "Measures", mono: true, render: r => r.rows?.join(", ") || "—" }
                ]}
                rows={charts}
                pageSize={5}
                isPdfMode={isPdfMode}
              />
            ) : (
              <Empty label="No standard charts found." />
            )}
          </div>
        )}
      </Card>

      {/* Action Buttons Accordion */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} style={{ cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: 600, fontSize: "16px", color: "#0f172a" }}>Action Buttons</span>
            <Badge variant="secondary">({actionsCount})</Badge>
          </div>
        </div>
      </Card>

      {/* Navigation Menus Accordion */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} style={{ cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: 600, fontSize: "16px", color: "#0f172a" }}>Navigation Menus</span>
            <Badge variant="secondary">({navMenusCount})</Badge>
          </div>
        </div>
      </Card>

      {/* Custom Objects / Extensions Accordion */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} style={{ cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: 600, fontSize: "16px", color: "#0f172a" }}>Custom Objects / Extensions</span>
            <Badge variant="secondary">(0)</Badge>
          </div>
        </div>
      </Card>

      {/* Images Accordion */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} style={{ cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: 600, fontSize: "16px", color: "#0f172a" }}>Images</span>
            <Badge variant="secondary">({imageCount})</Badge>
          </div>
        </div>
      </Card>

      {/* Filter Panes Accordion */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeaderRow} style={{ cursor: "default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: 600, fontSize: "16px", color: "#0f172a" }}>Filter Panes</span>
            <Badge variant="secondary">({filterPaneCount})</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

function P_RenamedFields({ d, isPdfMode = false }: { d: ParsingPayload; isPdfMode?: boolean }) {
  const styles = useStyles();

  const renamedFieldsList = useMemo(() => {
    if (!d) return [];
    const result: { original: string; renamed: string; type: string; table: string; sheet: string }[] = [];

    (d.tables || []).forEach(t => {
      (t.columns || []).forEach(c => {
        if (c.renamed_column_name && c.renamed_column_name !== c.name) {
          result.push({
            original: c.name,
            renamed: c.renamed_column_name,
            type: c.datatype || "String",
            table: t.table_name || "Table",
            sheet: d.workbook_name || "App"
          });
        }
      });
    });

    return result;
  }, [d]);

  return (
    <Card className={styles.sectionCard}>
      <div className={styles.sectionHeader} style={{ marginBottom: "4px" }}>Renamed Fields</div>
      <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>
        Fields carrying custom display names or aliases in the workbook layout
      </div>

      {renamedFieldsList.length === 0 ? (
        <Empty label="No renamed fields or aliases detected in this application." />
      ) : (
        <DataTable<{ original: string; renamed: string; type: string; table: string; sheet: string }>
          cols={[
            {
              key: "original",
              label: "Original Name",
              render: r => (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontFamily: T.mono, color: "#64748b" }}>{r.original}</span>
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>→</span>
                  <strong style={{ color: "#0f172a" }}>{r.renamed}</strong>
                </div>
              )
            },
            { key: "renamed", label: "Renamed To", render: r => <Badge variant="default">{r.renamed}</Badge> },
            { key: "type", label: "Type", render: r => <Badge variant="secondary">{r.type}</Badge> },
            { key: "table", label: "Table", render: r => r.table },
            { key: "sheet", label: "Sheet", render: r => r.sheet }
          ]}
          rows={renamedFieldsList}
          pageSize={5}
          isPdfMode={isPdfMode}
        />
      )}
    </Card>
  );
}
