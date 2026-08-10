"use client"

import React, { useMemo, useState } from "react"
import { useAgentStore } from "@/stores/agent.store"
import { useDashboardStore } from "@/stores/dashboard.store"
import { useParsingStore } from "@/stores/parsing.store"
import {
  Badge,
  Card,
  Spinner,
  Text,
  tokens,
  shorthands,
  makeStyles,
  ProgressBar,
  Skeleton,
  SkeletonItem,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell
} from "@fluentui/react-components"
import {
  List20Regular,
  Warning24Regular
} from "@fluentui/react-icons"

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    marginBottom: "24px",
  },
  topRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    "@media (max-width: 1550px)": {
      gridTemplateColumns: "repeat(2, 1fr)",
    },
    "@media (max-width: 700px)": {
      gridTemplateColumns: "1fr",
    },
  },
  summaryCard: {
    ...shorthands.padding("16px", "20px"),
    ...shorthands.borderRadius("12px"),
    boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
    border: `1px solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  iconWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    ...shorthands.borderRadius("8px"),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    marginBottom: "16px"
  },
  summaryTitle: {
    color: tokens.colorNeutralForeground2,
    fontSize: "13px",
    fontWeight: tokens.fontWeightRegular,
    marginBottom: "8px"
  },
  summaryValue: {
    fontSize: "28px",
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    lineHeight: "1.2",
    marginBottom: "4px"
  },
  summarySubtext: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
  },
  bottomRow: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    alignItems: "stretch"
  },
  moduleCard: {
    flex: 1,
    minWidth: "400px",
    ...shorthands.padding("24px"),
    ...shorthands.borderRadius("12px"),
    boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
    border: `1px solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 900px)": {
      minWidth: "100%",
    },
  },
  moduleHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "24px",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground1
  },
  chartRow: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "1.6fr 1fr",
    "@media (max-width: 1400px)": {
      gridTemplateColumns: "1fr",
    },
  },
  chartCard: {
    ...shorthands.padding("20px"),
    ...shorthands.borderRadius("12px"),
    boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
    border: `1px solid ${tokens.colorNeutralStroke3}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  chartHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  chartTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  chartSubtitle: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginBottom: "12px",
  },
  filterGroup: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  matrixWrap: {
    position: "relative",
    width: "100%",
    height: "360px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    ...shorthands.borderRadius("10px"),
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: "hidden",
  },
  matrixLegend: {
    display: "flex",
    gap: "14px",
    alignItems: "center",
    marginTop: "10px",
    flexWrap: "wrap",
  },
  legendItem: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  legendDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  quadrantLabel: {
    position: "absolute",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    pointerEvents: "none",
  },
  axisLabel: {
    position: "absolute",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    pointerEvents: "none",
  },
  assetBars: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    marginTop: "8px",
  },
  assetRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 60px",
    gap: "10px",
    alignItems: "center",
  },
  assetName: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  assetTrack: {
    height: "10px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("8px"),
    overflow: "hidden",
  },
  assetFill: {
    height: "100%",
    backgroundColor: tokens.colorBrandBackground,
  },
  assetValue: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
    textAlign: "right",
  },
  ratioRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
    marginTop: "16px",
  },
  ratioCard: {
    ...shorthands.padding("10px", "12px"),
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    ...shorthands.borderRadius("10px"),
  },
  ratioLabel: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  ratioValue: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginTop: "2px",
  },
  // Lineage Diagram Styles
  lineageWrap: {
    position: "relative",
    width: "100%",
    height: "320px",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    ...shorthands.borderRadius("10px"),
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: "auto",
    padding: "12px",
  },
  lineageNode: {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    margin: "8px",
  },
  lineageNodeBox: {
    padding: "6px 12px",
    backgroundColor: tokens.colorBrandBackground,
    color: "white",
    ...shorthands.borderRadius("6px"),
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    maxWidth: "120px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  vizTypeRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  vizTypeName: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    minWidth: "80px",
  },
  vizTypeBar: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    height: "24px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("4px"),
    overflow: "hidden",
  },
  vizTypeFill: {
    height: "100%",
    backgroundColor: tokens.colorBrandBackground,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: "4px",
    fontSize: tokens.fontSizeBase100,
    color: "white",
    fontWeight: tokens.fontWeightSemibold,
  },
  connectionModeRow: {
    display: "flex",
    gap: "16px",
    alignItems: "stretch",
  },
  connectionModeCard: {
    flex: 1,
    ...shorthands.padding("16px"),
    backgroundColor: tokens.colorNeutralBackground2,
    border: `2px solid ${tokens.colorNeutralStroke2}`,
    ...shorthands.borderRadius("10px"),
    textAlign: "center",
  },
  connectionModeLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    marginBottom: "8px",
  },
  connectionModeValue: {
    fontSize: "32px",
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    marginBottom: "6px",
  },
  connectionModePercent: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  // Complexity Dist Styles
  distRow: {
    marginBottom: "16px",
  },
  distTopRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px"
  },
  distLabel: {
    fontSize: "13px",
    color: tokens.colorNeutralForeground2
  },
  distValue: {
    fontSize: "13px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1
  },
  barTrack: {
    height: "8px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("4px"),
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
  },
  compositeBar: {
    display: "flex",
    height: "8px",
    gap: "2px",
    marginTop: "24px",
    ...shorthands.borderRadius("4px"),
    overflow: "hidden"
  },
  // Risk Factors Styles
  riskRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "16px"
  },
  riskRank: {
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorNeutralBackground3,
    fontSize: "12px",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    flexShrink: 0
  },
  riskContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },
  riskNameRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  riskName: {
    fontSize: "13px",
    color: tokens.colorNeutralForeground1,
  },
  riskPill: {
    fontSize: "11px",
    padding: "2px 8px",
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
    ...shorthands.borderRadius("12px"),
  },
  riskBarTrack: {
    height: "8px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("4px"),
    overflow: "hidden",
    width: "100%"
  },
  riskBarFill: {
    height: "100%",
    backgroundColor: tokens.colorBrandBackground
  }
})

export const SectionHeading = ({ title, description }: { title: string, description?: string }) => (
  <div className="pdf-section" style={{ borderBottom: `2px solid ${tokens.colorBrandForeground1}`, paddingBottom: "12px", marginBottom: "24px", pageBreakAfter: "avoid" }}>
    <div style={{ fontSize: "24px", fontWeight: "600", color: "#0f172a", fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", letterSpacing: "-0.025em", marginBottom: description ? "8px" : "0" }}>
      {title}
    </div>
    {description && (
      <div style={{ fontSize: "14px", color: "#64748b" }}>
        {description}
      </div>
    )}
  </div>
);

export function OnlyAssessmentTab({ isPdfMode = false, children }: { isPdfMode?: boolean, children?: React.ReactNode }) {
  const styles = useStyles()
  const [hoveredNode, setHoveredNode] = useState<{ row: any, x: number, y: number, containerWidth: number, containerHeight: number } | null>(null)
  const { currentRunId, assessmentData, currentWorkbookIds, workbookProjectMap } = useAgentStore()
  const { applications } = useDashboardStore()
  const parsingData = useParsingStore(state => state.parsingData)

  const metrics = useMemo(() => {
    let _workbooksCount = 0
    let _dataSources = 0
    let _estEffort = 0
    let _totalComplexity = 0
    let _scoredWorkbooks = 0

    const complexityDist = {
      Low: 0,
      Medium: 0,
      High: 0,
    }

    const riskFreq: Record<string, number> = {}
    const ownerFreq: Record<string, number> = {}
    const assetCounts = {
      workbooks: 0,
      datasources: 0,
      tables: 0,
      worksheets: 0,
      dashboards: 0,
      calculations: 0,
    }
    const matrixPoints: Array<{
      id: string
      name: string
      type: "Workbook" | "Datasource"
      complexity: number
      business: number
      color: string
    }> = []
    const vizTypeFreq: Record<string, number> = {}
    const connectionModes = { live: 0, extract: 0 }
    const relationshipsList: Array<{ from: string; to: string }> = []

    const runData = currentRunId ? assessmentData[currentRunId] : {}

    currentWorkbookIds.forEach(wbId => {
      const data = runData?.[wbId]?.payload
      if (!data) return
      const pData = parsingData[wbId]

      _workbooksCount++
      _dataSources += (data.logical_datasources?.length || 0)
      assetCounts.workbooks += 1
      assetCounts.datasources += data.logical_datasources?.length || pData?.sources?.length || 0
      assetCounts.tables += pData?.tables?.length || 0
      assetCounts.worksheets += pData?.worksheets?.length || data.visuals?.sheet_count || 0
      assetCounts.dashboards += pData?.dashboards_list?.length || data.dashboards_detailed?.count || 0
      assetCounts.calculations += pData?.calculations?.length || data.calculation_stats?.total_calculations || 0

      const owner = (data.owner_name || "Unknown Owner").replace(/^ID:\s*/i, "")
      ownerFreq[owner] = (ownerFreq[owner] || 0) + 1

      const compScore = data.complexity?.complexity_score
      const estMin = data.complexity?.estimated_migration_minutes || 0

      _estEffort += estMin
      if (typeof compScore === 'number') {
        _totalComplexity += compScore
        _scoredWorkbooks++

        if (compScore < 40) {
          complexityDist.Low++
        } else if (compScore < 75) {
          complexityDist.Medium++
        } else {
          complexityDist.High++
        }
      } else {
        // Fallback for unscored workbooks
        complexityDist.Medium++
      }

      const workbookRisks = new Set<string>()

      // 1. Cube metadata
      const hasCube = (data.logical_datasources || []).some((ds: any) =>
        ds.class?.toLowerCase().includes("cube") ||
        ds.type?.toLowerCase().includes("cube") ||
        ds.caption?.toLowerCase().includes("cube")
      )
      if (hasCube) workbookRisks.add("Cube data sources")

      // 2. Complex LODs
      if ((data.lods_analysis?.total_count || 0) > 0 || (data.calculation_stats?.pct_lod || 0) > 0) {
        workbookRisks.add("Complex LOD expressions")
      }

      // 3. Row-level security
      if (data.security_entitlements?.has_rls) {
        workbookRisks.add("Row-level security")
      }

      // 4. Legacy version
      if (data.version_info?.version) {
        const vNum = parseFloat(data.version_info.version)
        if ((!isNaN(vNum) && vNum < 2018.1) || data.legacy_risks?.has_legacy || String(data.version_info.version).startsWith("10.")) {
          workbookRisks.add("Legacy Tableau version")
        }
      }

      // 5. Multiple extract dependencies
      if ((data.extract_analysis?.hyper_count || 0) > 1) {
        workbookRisks.add("Multiple extract dependencies")
      }

      // 6. Custom SQL
      if (data.semantics?.has_custom_sql || (data.custom_sql_details?.length || 0) > 0) {
        workbookRisks.add("Custom SQL Queries")
      }

      // 7. Scripts
      if ((data.calculation_stats?.pct_scripts || 0) > 0) {
        workbookRisks.add("Python/R Scripts dependencies")
      }

      const workbookBusiness = Math.min(
        100,
        Math.max(
          10,
          (assetCounts.worksheets > 0 ? Math.min(35, (pData?.worksheets?.length || data.visuals?.sheet_count || 0) * 2.8) : 0) +
          Math.min(30, (pData?.calculations?.length || data.calculation_stats?.total_calculations || 0) * 1.6) +
          Math.min(20, (data.logical_datasources?.length || pData?.sources?.length || 0) * 5) +
          Math.min(15, (data.actions?.length || pData?.actions || 0) * 5)
        )
      )

      matrixPoints.push({
        id: `wb-${wbId}`,
        name: data.workbook_name || `Workbook ${_workbooksCount}`,
        type: "Workbook",
        complexity: typeof compScore === "number" ? Math.max(1, Math.min(100, compScore)) : 50,
        business: workbookBusiness,
        color: "#0f6cbd",
      })

        ; (data.logical_datasources || []).forEach((ds: any, idx: number) => {
          const dsComplexity = Math.min(100, Math.max(8, (typeof compScore === "number" ? compScore * 0.7 : 45) + (ds.has_extract ? 8 : 0)))
          const dsBusiness = Math.min(95, Math.max(10, 35 + (ds.has_extract ? 10 : 0) + (ds.is_published_datasource ? 12 : 0) + idx * 3))
          matrixPoints.push({
            id: `ds-${wbId}-${idx}`,
            name: ds.name || `Datasource ${idx + 1}`,
            type: "Datasource",
            complexity: dsComplexity,
            business: dsBusiness,
            color: "#107c10",
          })
          const mode = ds.mode?.toLowerCase() === "live" || ds.connection_type?.toLowerCase().includes("live") ? "live" : "extract"
          if (mode === "live") connectionModes.live += 1
          else connectionModes.extract += 1
        })

      // Collect visualization types from parsing
      if (pData?.worksheets) {
        pData.worksheets.forEach((ws: any) => {
          const vType = ws.mark_type || ws.visual_type || "Other"
          const normalized = String(vType).toLowerCase().replace(/\s+/g, " ")
          vizTypeFreq[normalized] = (vizTypeFreq[normalized] || 0) + 1
        })
      }

      // Collect relationships for lineage
      if (pData?.model?.logical) {
        ; (pData.model.logical || []).forEach((rel: any) => {
          relationshipsList.push({ from: rel.left, to: rel.right })
        })
      }

      workbookRisks.forEach((r: string) => {
        riskFreq[r] = (riskFreq[r] || 0) + 1
      })
    })

    // Prepare Top Risks sorted by frequency
    const topRisks = Object.entries(riskFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
      .slice(0, 5)

    const maxRiskCount = topRisks.length > 0 ? topRisks[0].count : 1

    const ownerSpread = Object.entries(ownerFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    const maxAssetCount = Math.max(
      1,
      assetCounts.workbooks,
      assetCounts.datasources,
      assetCounts.tables,
      assetCounts.worksheets,
      assetCounts.dashboards,
      assetCounts.calculations
    )

    const vizTypes = Object.entries(vizTypeFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
      .slice(0, 8)
    const maxVizCount = vizTypes.length > 0 ? vizTypes[0].count : 1

    const totalConnections = connectionModes.live + connectionModes.extract
    const livePercent = totalConnections > 0 ? Math.round((connectionModes.live / totalConnections) * 100) : 0
    const extractPercent = totalConnections > 0 ? Math.round((connectionModes.extract / totalConnections) * 100) : 0

    return {
      workbooks: Math.max(_workbooksCount, currentWorkbookIds.length),
      dataSources: _dataSources,
      effortMin: _estEffort,
      avgComplexity: _scoredWorkbooks > 0 ? Math.round(_totalComplexity / _scoredWorkbooks) : 0,
      complexityDist,
      topRisks,
      maxRiskCount,
      ownerSpread,
      assetCounts,
      maxAssetCount,
      matrixPoints,
      vizTypes,
      maxVizCount,
      connectionModes,
      livePercent,
      extractPercent,
      relationshipsList,
      uniqueTables: new Set(relationshipsList.flatMap(r => [r.from, r.to])),
      totalScored: Math.max(1, _scoredWorkbooks),
      hasData: _scoredWorkbooks > 0
    }
  }, [currentRunId, assessmentData, currentWorkbookIds, parsingData])

  // Helpers for text formatting
  const formatEffortText = (mins: number) => {
    if (mins < 60) return `${parseFloat(mins.toFixed(2))} min`
    const hrs = Math.round(mins / 60)
    return `${hrs}h`
  }

  const effortSubtext = useMemo(() => {
    if (metrics.effortMin === 0) return ""
    const days = Math.ceil((metrics.effortMin / 60) / 8) // assuming 8h workday
    if (days < 5) return `~${days} days`
    const weeks = Math.round(days / 5)
    return `~${weeks} weeks`
  }, [metrics.effortMin])

  const getPct = (val: number, total: number) => {
    if (total === 0) return 0
    return Math.round((val / total) * 100)
  }

  const cpLowPct = getPct(metrics.complexityDist.Low, metrics.totalScored)
  const cpMedPct = getPct(metrics.complexityDist.Medium, metrics.totalScored)
  const cpHighPct = getPct(metrics.complexityDist.High, metrics.totalScored)

  const complexityRanking = useMemo(() => {
    const runData = currentRunId ? assessmentData[currentRunId] : {}
    const ranking: any[] = []

    currentWorkbookIds.forEach(wbId => {
      const data = runData?.[wbId]?.payload
      if (!data) return
      const pData = parsingData[wbId]

      const compScore = data.complexity?.complexity_score
      const compScoreValue = typeof compScore === "number" ? Math.max(1, Math.min(100, compScore)) : 50

      const customSqlCount = data.custom_sql_details?.length || (data.semantics?.has_custom_sql ? 1 : 0)
      const lodCount = data.lods_analysis?.total_count || 0
      const calcCount = pData?.calculations?.length || data.calculation_stats?.total_calculations || 0

      const hasLegacy = data.legacy_risks?.is_legacy_detected || data.legacy_risks?.has_legacy || false
      const extensionsCount = data.extensions?.length || 0

      let riskScore = 10
      if (customSqlCount > 0) riskScore += 30
      riskScore += Math.min(25, lodCount * 2)
      riskScore += Math.min(20, calcCount * 0.5)
      if (hasLegacy) riskScore += 15
      if (extensionsCount > 0) riskScore += 10

      riskScore = Math.max(0, Math.min(100, riskScore))

      let priorityLabel = "Low"
      if (compScoreValue >= 75) priorityLabel = "High"
      else if (compScoreValue >= 40) priorityLabel = "Medium"

      let riskLabel = "Low"
      if (riskScore >= 75) riskLabel = "High"
      else if (riskScore >= 40) riskLabel = "Medium"

      ranking.push({
        id: wbId,
        name: data.workbook_name || "Unknown Workbook",
        complexityScore: Math.round(compScoreValue),
        riskScore: Math.round(riskScore),
        customSqlCount,
        lodCount,
        calcCount,
        priorityLabel,
        riskLabel
      })
    })

    return ranking.sort((a, b) => b.complexityScore - a.complexityScore)
  }, [currentRunId, assessmentData, currentWorkbookIds, parsingData])

  const { avgComplexity, avgRisk } = useMemo(() => {
    if (complexityRanking.length === 0) return { avgComplexity: 50, avgRisk: 50 }
    const sumC = complexityRanking.reduce((acc, r) => acc + r.complexityScore, 0)
    const sumR = complexityRanking.reduce((acc, r) => acc + r.riskScore, 0)
    return {
      avgComplexity: sumC / complexityRanking.length,
      avgRisk: sumR / complexityRanking.length
    }
  }, [complexityRanking])

  const assetRows = [
    { key: "Workbooks", value: metrics.assetCounts.workbooks, color: "#0f6cbd" },
    { key: "Data Sources", value: metrics.assetCounts.datasources, color: "#107c10" },
    { key: "Tables", value: metrics.assetCounts.tables, color: "#c239b3" },
    { key: "Worksheets", value: metrics.assetCounts.worksheets, color: "#d83b01" },
    { key: "Dashboards", value: metrics.assetCounts.dashboards, color: "#605e5c" },
    { key: "Calculations", value: metrics.assetCounts.calculations, color: "#8764b8" },
  ]

  // Build lineage graph layout
  const buildLineageLayout = useMemo(() => {
    if (metrics.relationshipsList.length === 0 || metrics.uniqueTables.size === 0) {
      return { nodes: [], edges: [] as any[] }
    }

    const tables = Array.from(metrics.uniqueTables).map(t => String(t))
    const nodeMap = new Map<string, { x: number; y: number; label: string; id: string }>()
    const edges: Array<{ from: string; to: string }> = []

    // Build graph structure - organize by incoming/outgoing relationships
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()

    tables.forEach(t => {
      inDegree.set(t, 0)
      outDegree.set(t, 0)
    })

    metrics.relationshipsList.forEach(rel => {
      outDegree.set(rel.from, (outDegree.get(rel.from) || 0) + 1)
      inDegree.set(rel.to, (inDegree.get(rel.to) || 0) + 1)
      edges.push({ from: rel.from, to: rel.to })
    })

    // Sort tables: sources (inDegree=0) first, then by outDegree
    const sortedTables = [...tables].sort((a, b) => {
      const aIsSource = inDegree.get(a) === 0 ? 0 : 1
      const bIsSource = inDegree.get(b) === 0 ? 0 : 1
      if (aIsSource !== bIsSource) return aIsSource - bIsSource
      return (outDegree.get(b) || 0) - (outDegree.get(a) || 0)
    })

    // Assign positions in a grid layout
    const nodesPerRow = Math.ceil(Math.sqrt(sortedTables.length))
    sortedTables.forEach((table, idx) => {
      const col = idx % nodesPerRow
      const row = Math.floor(idx / nodesPerRow)
      const x = 60 + (col * 140)
      const y = 50 + (row * 90)
      const label = String(table).split(".").pop() || table
      nodeMap.set(table, { x, y, label, id: table })
    })

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
    }
  }, [metrics.relationshipsList, metrics.uniqueTables])

  return (
    <div className={styles.container} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
      {/* ROW 1: COMPLEXITY & RISKS */}
      <div className={styles.bottomRow}>
        {/* Estate Distribution */}
        <Card className={styles.moduleCard} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
          <SectionHeading title="Estate Distribution" description="Distribution of workbooks across migration complexity categories based on assessment analysis." />

          <div className={styles.distRow}>
            <div className={styles.distTopRow}>
              <span className={styles.distLabel}>Low Complexity</span>
              <span className={styles.distValue}>{metrics.complexityDist.Low} workbooks ({cpLowPct}%)</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${cpLowPct}%`, backgroundColor: "#0078d4", height: "8px", display: "block" }} />
            </div>
          </div>

          <div className={styles.distRow}>
            <div className={styles.distTopRow}>
              <span className={styles.distLabel}>Medium Complexity</span>
              <span className={styles.distValue}>{metrics.complexityDist.Medium} workbooks ({cpMedPct}%)</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${cpMedPct}%`, backgroundColor: "#0078d4", height: "8px", display: "block" }} />
            </div>
          </div>

          <div className={styles.distRow}>
            <div className={styles.distTopRow}>
              <span className={styles.distLabel}>High Complexity</span>
              <span className={styles.distValue}>{metrics.complexityDist.High} workbooks ({cpHighPct}%)</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${cpHighPct}%`, backgroundColor: "#0078d4", height: "8px", display: "block" }} />
            </div>
          </div>

        </Card>

        {/* Top Risk Factors */}
        <Card className={styles.moduleCard} style={{ flex: 1.2 }}>
          <SectionHeading title="Top Risk Factors" description="Most common technical challenges and migration blockers identified across the selected migration scope." />

          <div>
            {metrics.topRisks.length > 0 ? (
              metrics.topRisks.map((risk, idx) => {
                const relativePct = (risk.count / metrics.maxRiskCount) * 100
                return (
                  <div key={idx} className={styles.riskRow}>
                    <div className={styles.riskRank}>{idx + 1}</div>
                    <div className={styles.riskContent}>
                      <div className={styles.riskNameRow}>
                        <span className={styles.riskName}>{risk.name}</span>
                        <span className={styles.riskPill}>{risk.count} workbooks</span>
                      </div>
                      <div className={styles.riskBarTrack}>
                        <div className={styles.riskBarFill} style={{ width: `${relativePct}%`, backgroundColor: "#0078d4", height: "100%", display: "block" }} />
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ color: tokens.colorNeutralForeground3, textAlign: "center", padding: "40px 0" }}>
                No significant risk factors detected
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ROW 2: PRIORITIZATION MATRIX & PORTFOLIO WITH ASSET MIX */}
      <div className={styles.chartRow}>
        <Card className={styles.chartCard} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
          <SectionHeading title="Migration Risk vs Complexity" description="Relationship between workbook complexity and estimated migration risk based on assessment findings." />

          <div id="scatter-chart-container" style={{ position: "relative", width: "100%", height: "360px", marginTop: "16px", border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: "10px", backgroundColor: tokens.colorNeutralBackground2, overflow: "visible" }}>
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "10px" }}>
              <svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="Risk vs Complexity Scatter Plot" style={{ display: "block", overflow: "visible" }}>
                <g transform="translate(10, 10) scale(0.8, 0.8)">
                  {/* Axis Ticks and Grid */}
                  {[0, 20, 40, 60, 80, 100].map(tick => (
                    <g key={`x-${tick}`}>
                      <line x1={tick} y1="100" x2={tick} y2="102" stroke="#d1d5db" strokeWidth="0.5" />
                      <text x={tick} y="106" fontSize="3" fill={tokens.colorNeutralForeground3} textAnchor="middle">{tick}</text>
                    </g>
                  ))}
                  {[0, 20, 40, 60, 80, 100].map(tick => (
                    <g key={`y-${tick}`}>
                      <line x1="-2" y1={100 - tick} x2="0" y2={100 - tick} stroke="#d1d5db" strokeWidth="0.5" />
                      <text x="-4" y={100 - tick + 1} fontSize="3" fill={tokens.colorNeutralForeground3} textAnchor="end">{tick}</text>
                    </g>
                  ))}

                  {/* Reference Lines */}
                  <line x1={avgComplexity} y1="0" x2={avgComplexity} y2="100" stroke="#d1d5db" strokeDasharray="2 2" strokeWidth="0.5" />
                  <line x1="0" y1={100 - avgRisk} x2="100" y2={100 - avgRisk} stroke="#d1d5db" strokeDasharray="2 2" strokeWidth="0.5" />
                  <text x={avgComplexity + 1} y="2" fontSize="2.5" fill={tokens.colorNeutralForeground3} fontWeight="600">Avg Complexity = {Math.round(avgComplexity)}</text>
                  <text x="98" y={100 - avgRisk - 1} fontSize="2.5" fill={tokens.colorNeutralForeground3} fontWeight="600" textAnchor="end">Avg Risk = {Math.round(avgRisk)}</text>

                  {/* Points */}
                  {complexityRanking.map((row) => {
                    const color = row.riskLabel === "High" ? "#d13438" : row.riskLabel === "Medium" ? "#ea8600" : "#107c10";
                    const cx = Math.max(0, Math.min(100, row.complexityScore));
                    const cy = Math.max(0, Math.min(100, 100 - row.riskScore));
                    return (
                      <circle
                        key={row.id}
                        cx={cx}
                        cy={cy}
                        r={1.8}
                        fill={color}
                        opacity={0.8}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const parent = document.getElementById("scatter-chart-container")?.getBoundingClientRect();
                          if (parent) {
                            setHoveredNode({
                              row,
                              x: rect.left - parent.left + rect.width / 2,
                              y: rect.top - parent.top,
                              containerWidth: parent.width,
                              containerHeight: parent.height
                            })
                          }
                        }}
                        onMouseLeave={() => setHoveredNode(null)}
                      />
                    )
                  })}
                </g>
              </svg>

              {/* Quadrant Labels */}
              <div style={{ position: "absolute", top: "12px", left: "16px", fontSize: "11px", color: tokens.colorNeutralForeground3, fontWeight: 600 }}>Complex Migrations</div>
              <div style={{ position: "absolute", top: "12px", right: "16px", fontSize: "11px", color: tokens.colorNeutralForeground3, fontWeight: 600 }}>Critical Migrations</div>
              <div style={{ position: "absolute", bottom: "12px", left: "16px", fontSize: "11px", color: tokens.colorNeutralForeground3, fontWeight: 600 }}>Simple Candidates</div>
              <div style={{ position: "absolute", bottom: "12px", right: "16px", fontSize: "11px", color: tokens.colorNeutralForeground3, fontWeight: 600 }}>Review Required</div>

              {/* Axis Labels */}
              <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%) rotate(-90deg)", fontSize: "11px", color: tokens.colorNeutralForeground3, backgroundColor: tokens.colorNeutralBackground2, padding: "2px 8px", borderRadius: "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                Migration Risk Score
              </div>
              <div style={{ position: "absolute", left: "50%", bottom: "8px", transform: "translateX(-50%)", fontSize: "11px", color: tokens.colorNeutralForeground3, backgroundColor: tokens.colorNeutralBackground2, padding: "2px 8px", borderRadius: "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                Complexity Score
              </div>
            </div>

            {/* Custom Tooltip - outside overflow:hidden wrapper */}
            {hoveredNode && (
              <div style={{
                position: "absolute",
                left: `${hoveredNode.x}px`,
                top: `${hoveredNode.y}px`,
                transform: `translate(${hoveredNode.x < 130 ? '0%' : hoveredNode.x > (hoveredNode.containerWidth - 130) ? '-100%' : '-50%'
                  }, ${hoveredNode.y < 160 ? '15px' : 'calc(-100% - 15px)'
                  })`,
                backgroundColor: tokens.colorNeutralBackground1,
                borderRadius: "10px",
                boxShadow: tokens.shadow8,
                border: `1px solid ${tokens.colorNeutralStroke2}`,
                padding: "16px",
                minWidth: "220px",
                maxWidth: "280px",
                zIndex: 100,
                pointerEvents: "none"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "12px" }}>
                  <Text weight="semibold" style={{ color: tokens.colorNeutralForeground1, wordBreak: "break-word", fontSize: "13px" }}>{hoveredNode.row.name}</Text>
                  <Badge appearance="tint" color={hoveredNode.row.riskLabel === "High" ? "danger" : hoveredNode.row.riskLabel === "Medium" ? "warning" : "success"} style={{ flexShrink: 0 }}>
                    {hoveredNode.row.riskLabel} Risk
                  </Badge>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px", fontSize: "12px" }}>
                  <span style={{ color: tokens.colorNeutralForeground2 }}>Complexity Score</span>
                  <span style={{ fontWeight: 600, color: tokens.colorNeutralForeground1 }}>{hoveredNode.row.complexityScore}</span>

                  <span style={{ color: tokens.colorNeutralForeground2 }}>Risk Score</span>
                  <span style={{ fontWeight: 600, color: tokens.colorNeutralForeground1 }}>{hoveredNode.row.riskScore}</span>

                  <span style={{ color: tokens.colorNeutralForeground2, marginTop: "6px" }}>Custom SQL</span>
                  <span style={{ fontWeight: 600, color: tokens.colorNeutralForeground1, marginTop: "6px" }}>{hoveredNode.row.customSqlCount}</span>

                  <span style={{ color: tokens.colorNeutralForeground2 }}>LOD Count</span>
                  <span style={{ fontWeight: 600, color: tokens.colorNeutralForeground1 }}>{hoveredNode.row.lodCount}</span>

                  <span style={{ color: tokens.colorNeutralForeground2 }}>Calculated Fields</span>
                  <span style={{ fontWeight: 600, color: tokens.colorNeutralForeground1 }}>{hoveredNode.row.calcCount}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "24px", marginTop: "16px", flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: tokens.colorNeutralForeground2 }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#107c10" }} /> Low Risk
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: tokens.colorNeutralForeground2 }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ea8600" }} /> Medium Risk
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: tokens.colorNeutralForeground2 }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#d13438" }} /> High Risk
            </div>
          </div>
        </Card>

        <Card className={styles.chartCard} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
          <SectionHeading title="Estate at a Glance" description="High-level inventory summary of workbooks, datasources, tables, worksheets, dashboards, and calculations." />
          <div className={styles.assetBars}>
            {assetRows.map((row) => {
              const pct = Math.round((row.value / metrics.maxAssetCount) * 100)
              return (
                <div key={row.key} className={styles.assetRow}>
                  <div className={styles.assetName}>{row.key}</div>
                  <div className={styles.assetTrack}>
                    <div className={styles.assetFill} style={{ width: `${pct}%`, backgroundColor: row.color }} />
                  </div>
                  <div className={styles.assetValue}>{row.value}</div>
                </div>
              )
            })}
          </div>

          <div className={styles.ratioRow}>
            <div className={styles.ratioCard}>
              <div className={styles.ratioLabel}>Avg Tables / Workbook</div>
              <div className={styles.ratioValue}>
                {metrics.workbooks > 0 ? (metrics.assetCounts.tables / metrics.workbooks).toFixed(1) : "0.0"}
              </div>
            </div>
            <div className={styles.ratioCard}>
              <div className={styles.ratioLabel}>Avg Datasources / Workbook</div>
              <div className={styles.ratioValue}>
                {metrics.workbooks > 0 ? (metrics.assetCounts.datasources / metrics.workbooks).toFixed(1) : "0.0"}
              </div>
            </div>
            <div className={styles.ratioCard}>
              <div className={styles.ratioLabel}>Top Owner Coverage</div>
              <div className={styles.ratioValue}>
                {metrics.ownerSpread.length > 0 ? metrics.ownerSpread[0][1] : 0}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {children}

      {/* ROW 3: VISUALIZATION TYPES */}
      <Card className={styles.chartCard} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
        <SectionHeading title="Visualization Types" description="Breakdown of visualization patterns detected across the selected migration scope." />
        <div style={{ marginTop: "16px" }}>
          {metrics.vizTypes.length > 0 ? (
            metrics.vizTypes.map((vtype, idx) => {
              const pct = Math.round((vtype.count / metrics.maxVizCount) * 100)
              return (
                <div key={idx} className={styles.vizTypeRow}>
                  <div className={styles.vizTypeName}>{vtype.name}</div>
                  <div className={styles.vizTypeBar}>
                    <div
                      className={styles.vizTypeFill}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: [
                          "#5B9FA0",
                          "#9BB8A1",
                          "#C78A6F",
                          "#A599B5",
                          "#4A9EA8",
                          "#E8A9A0",
                          "#8BA89B",
                          "#B5A99E",
                        ][idx % 8],
                      }}
                    >
                      {pct > 5 && <span>{vtype.count}</span>}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{ color: tokens.colorNeutralForeground3, textAlign: "center", padding: "20px 0" }}>
              No visualizations found
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
