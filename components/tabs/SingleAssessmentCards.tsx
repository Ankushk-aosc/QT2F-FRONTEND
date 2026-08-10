"use client"

import React, { useMemo } from "react"
import { useAgentStore } from "@/stores/agent.store"
import { useDashboardStore } from "@/stores/dashboard.store"
import {
  Card,
  Text,
  Badge,
  makeStyles,
  shorthands,
  tokens,
} from "@fluentui/react-components"
import {
  Database24Regular,
  Folder24Regular,
  Board24Regular,
  DocumentSplitHint24Regular,
  Receipt24Regular,
  Code24Regular,
  Warning24Regular,
} from "@fluentui/react-icons"

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    marginBottom: "24px",
  },
  row: {
    display: "flex",
    gap: "24px",
    flexWrap: "wrap",
    // 2 cards row at the top (Inventory Overview + Summary Cards)
    // Actually we can do display grid or flex
  },
  card: {
    flex: 1,
    minWidth: "350px",
    ...shorthands.padding("20px"),
    ...shorthands.borderRadius("12px"),
    boxShadow: tokens.shadow4,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "20px",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
  },
  gridCard: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
  },
  metricBox: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding("16px"),
    ...shorthands.borderRadius("8px"),
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  metricHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  metricValue: {
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
  },
  barContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  barRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  barLabel: {
    width: "80px",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  barTrack: {
    flex: 1,
    height: "12px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("6px"),
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
  },
  barValue: {
    width: "40px",
    textAlign: "right",
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  riskItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    ...shorthands.padding("12px", "16px"),
    backgroundColor: tokens.colorStatusDangerBackground1,
    border: `1px solid ${tokens.colorStatusDangerBorder1}`,
    ...shorthands.borderRadius("8px"),
    marginBottom: "8px",
  },
  riskText: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorStatusDangerForeground1,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
})

export function SingleAssessmentCards() {
  const styles = useStyles()
  const { currentRunId, assessmentData, currentWorkbookIds, workbookProjectMap } = useAgentStore()
  const { applications } = useDashboardStore()

  const metrics = useMemo(() => {
    let _sites = new Set<string>()
    let _projects = new Set<string>()
    let _workbooksCount = 0
    let _dashboards = 0
    let _stories = 0
    let _customSql = 0

    let _dataSources = 0
    let _estEffort = 0
    let _totalComplexity = 0
    let _scoredWorkbooks = 0

    const complexityDist = {
      Simple: 0,
      Moderate: 0,
      Complex: 0,
      Extreme: 0,
    }

    const riskFreq: Record<string, number> = {}

    // For site, we typically only have 1 active site connected in migration. 
    // We'll set it to 1 if we have any workbooks.
    if (currentWorkbookIds.length > 0) {
      _sites.add("active_site")
    }

    const runData = currentRunId ? assessmentData[currentRunId] : {}

    currentWorkbookIds.forEach(wbId => {
      // Collect projects from map or apps
      const projId = workbookProjectMap[wbId] || applications.find(a => a.workbookId === wbId)?.projectId || "unknown"
      _projects.add(projId)

      // Get payload if exists
      const data = runData?.[wbId]?.payload
      if (!data) return

      _workbooksCount++

      _dashboards += (data.dashboards_detailed?.count || 0)
      _stories += (data.visuals?.story_count || 0)
      _customSql += (data.semantics?.custom_sql_count || data.custom_sql_details?.length || 0)

      _dataSources += (data.logical_datasources?.length || 0)

      const compScore = data.complexity?.complexity_score
      const estMin = data.complexity?.estimated_migration_minutes || 0

      _estEffort += estMin
      if (typeof compScore === 'number') {
        _totalComplexity += compScore
        _scoredWorkbooks++
      }

      const riskLvl = (data.complexity?.risk_level || "Unknown").toString()
      if (riskLvl.includes("Simple")) complexityDist.Simple++
      else if (riskLvl.includes("Moderate")) complexityDist.Moderate++
      else if (riskLvl.includes("Complex")) complexityDist.Complex++
      else if (riskLvl.includes("Extreme")) complexityDist.Extreme++
      else complexityDist.Moderate++ // Fallback

      const reasoning = data.complexity?.reasoning || []
      reasoning.forEach((r: string) => {
        riskFreq[r] = (riskFreq[r] || 0) + 1
      })
    })

    const topRisks = Object.entries(riskFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)

    return {
      sites: _sites.size,
      projects: _projects.size,
      workbooks: Math.max(_workbooksCount, currentWorkbookIds.length),
      dashboards: _dashboards,
      stories: _stories,
      customSql: _customSql,
      dataSources: _dataSources,
      effort: _estEffort,
      avgComplexity: _scoredWorkbooks > 0 ? Math.round(_totalComplexity / _scoredWorkbooks) : 0,
      complexityDist,
      topRisks,
      totalScored: Math.max(1, _scoredWorkbooks)
    }
  }, [currentRunId, assessmentData, currentWorkbookIds, workbookProjectMap, applications])

  return (
    <div className={styles.container}>
      {/* Row 1 */}
      <div className={styles.row}>
        {/* Inventory Overview */}
        <Card className={styles.card}>
          <div className={styles.cardHeader}>
            <Database24Regular />
            Inventory Overview
          </div>
          <div className={styles.gridCard}>
            <div className={styles.metricBox}>
              <div className={styles.metricHeader}>
                Sites
              </div>
              <div className={styles.metricValue}>{metrics.sites}</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricHeader}>
                <Folder24Regular fontSize={16} /> Projects
              </div>
              <div className={styles.metricValue}>{metrics.projects}</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricHeader}>
                <Board24Regular fontSize={16} /> Workbooks
              </div>
              <div className={styles.metricValue}>{metrics.workbooks}</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricHeader}>
                <DocumentSplitHint24Regular fontSize={16} /> Dashboards
              </div>
              <div className={styles.metricValue}>{metrics.dashboards}</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricHeader}>
                <Receipt24Regular fontSize={16} /> Stories
              </div>
              <div className={styles.metricValue}>{metrics.stories}</div>
            </div>
            <div className={styles.metricBox}>
              <div className={styles.metricHeader}>
                <Code24Regular fontSize={16} /> Custom SQL
              </div>
              <div className={styles.metricValue}>{metrics.customSql}</div>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        <Card className={styles.card} style={{ flex: 1.5 }}>
          <div className={styles.cardHeader}>
            Summary Cards
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", height: "100%" }}>
            <div className={styles.metricBox} style={{ justifyContent: "center", alignItems: "center" }}>
              <div className={styles.metricHeader}>Total Workbooks</div>
              <div className={styles.metricValue}>{metrics.workbooks}</div>
            </div>
            <div className={styles.metricBox} style={{ justifyContent: "center", alignItems: "center" }}>
              <div className={styles.metricHeader}>Data Sources</div>
              <div className={styles.metricValue}>{metrics.dataSources}</div>
            </div>
            <div className={styles.metricBox} style={{ justifyContent: "center", alignItems: "center" }}>
              <div className={styles.metricHeader}>Estimated Effort</div>
              <div className={styles.metricValue} style={{ color: tokens.colorBrandForeground1 }}>{metrics.effort} <span style={{ fontSize: "14px", fontWeight: "normal" }}>min</span></div>
            </div>
            <div className={styles.metricBox} style={{ justifyContent: "center", alignItems: "center" }}>
              <div className={styles.metricHeader}>Avg Complexity</div>
              <div className={styles.metricValue}>
                {metrics.avgComplexity} <span style={{ fontSize: "14px", color: tokens.colorNeutralForeground3 }}>/100</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

    </div>
  )
}
